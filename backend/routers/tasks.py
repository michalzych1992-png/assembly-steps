from datetime import timezone
from typing import List

from bson import Binary
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from lib.db import db
from models.tasks import (
    STAGES,
    Photo,
    StageStatusUpdate,
    Task,
    TaskCreate,
    TaskDetail,
    TaskSummary,
)

router = APIRouter()

MAX_PHOTO_BYTES = 12 * 1024 * 1024
STATUS_WEIGHT = {"nie_rozpoczety": 0, "w_trakcie": 0.5, "ukonczony": 1}


def _aware(doc: dict) -> dict:
    dt = doc.get("created_at")
    if dt is not None and dt.tzinfo is None:
        doc["created_at"] = dt.replace(tzinfo=timezone.utc)
    return doc


def _progress(stages: dict) -> int:
    return round(sum(STATUS_WEIGHT[stages.get(s, "nie_rozpoczety")] for s in STAGES) / len(STAGES) * 100)


async def _get_task_doc(task_id: str) -> dict:
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Nie znaleziono zadania")
    return _aware(doc)


async def _photo_counts(task_ids: List[str]) -> dict:
    counts: dict = {tid: {s: 0 for s in STAGES} for tid in task_ids}
    pipeline = [
        {"$match": {"task_id": {"$in": task_ids}}},
        {"$group": {"_id": {"t": "$task_id", "s": "$stage"}, "n": {"$sum": 1}}},
    ]
    async for row in db.photos.aggregate(pipeline):
        counts[row["_id"]["t"]][row["_id"]["s"]] = row["n"]
    return counts


@router.get("/tasks", response_model=List[TaskSummary])
async def list_tasks():
    docs = [_aware(d) for d in await db.tasks.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)]
    counts = await _photo_counts([d["id"] for d in docs])
    return [TaskSummary(**d, photo_counts=counts[d["id"]], progress=_progress(d["stages"])) for d in docs]


@router.post("/tasks", response_model=TaskSummary, status_code=201)
async def create_task(payload: TaskCreate):
    task = Task(**payload.model_dump())
    await db.tasks.insert_one(task.model_dump())
    return TaskSummary(**task.model_dump(), photo_counts={s: 0 for s in STAGES}, progress=0)


@router.get("/tasks/{task_id}", response_model=TaskDetail)
async def get_task(task_id: str):
    doc = await _get_task_doc(task_id)
    photos = [
        Photo(**_aware(p))
        for p in await db.photos.find({"task_id": task_id}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    ]
    counts = {s: 0 for s in STAGES}
    for p in photos:
        counts[p.stage] += 1
    return TaskDetail(**doc, photo_counts=counts, progress=_progress(doc["stages"]), photos=photos)


@router.patch("/tasks/{task_id}/stages/{stage}", response_model=TaskSummary)
async def update_stage(task_id: str, stage: str, payload: StageStatusUpdate):
    if stage not in STAGES:
        raise HTTPException(status_code=404, detail="Nieznany etap")
    await _get_task_doc(task_id)
    await db.tasks.update_one({"id": task_id}, {"$set": {f"stages.{stage}": payload.status}})
    doc = await _get_task_doc(task_id)
    counts = await _photo_counts([task_id])
    return TaskSummary(**doc, photo_counts=counts[task_id], progress=_progress(doc["stages"]))


@router.post("/tasks/{task_id}/photos", response_model=Photo, status_code=201)
async def add_photo(
    task_id: str,
    stage: str = Form(...),
    author: str = Form(..., min_length=1, max_length=120),
    description: str = Form(..., min_length=1, max_length=2000),
    file: UploadFile = File(...),
):
    if stage not in STAGES:
        raise HTTPException(status_code=422, detail="Nieznany etap")
    await _get_task_doc(task_id)
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="Plik musi być zdjęciem")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="Pusty plik")
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Zdjęcie jest za duże (maks. 12 MB)")
    photo = Photo(
        task_id=task_id,
        stage=stage,  # type: ignore[arg-type]
        author=author.strip(),
        description=description.strip(),
        content_type=content_type,
    )
    await db.photo_files.insert_one({"id": photo.id, "data": Binary(data), "content_type": content_type})
    await db.photos.insert_one(photo.model_dump())
    return photo


@router.get("/photos/{photo_id}/file")
async def get_photo_file(photo_id: str):
    doc = await db.photo_files.find_one({"id": photo_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Nie znaleziono zdjęcia")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc.get("content_type", "image/jpeg"),
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
