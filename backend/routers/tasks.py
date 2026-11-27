import asyncio
import re
import unicodedata
from datetime import datetime, timezone
from typing import List

from bson import Binary
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from lib.db import db
from lib.report import build_task_pdf
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
ACTIVE = {"deleted_at": None}  # matches photos never soft-deleted (field missing or null)
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
        {"$match": {"task_id": {"$in": task_ids}, **ACTIVE}},
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
        for p in await db.photos.find({"task_id": task_id, **ACTIVE}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    ]
    counts = {s: 0 for s in STAGES}
    for p in photos:
        counts[p.stage] += 1
    return TaskDetail(**doc, photo_counts=counts, progress=_progress(doc["stages"]), photos=photos)


@router.put("/tasks/{task_id}", response_model=TaskSummary)
async def update_task(task_id: str, payload: TaskCreate):
    await _get_task_doc(task_id)
    await db.tasks.update_one({"id": task_id}, {"$set": payload.model_dump()})
    doc = await _get_task_doc(task_id)
    counts = await _photo_counts([task_id])
    return TaskSummary(**doc, photo_counts=counts[task_id], progress=_progress(doc["stages"]))


@router.delete("/tasks/{task_id}/photos/{photo_id}", status_code=204)
async def delete_photo(task_id: str, photo_id: str):
    # Soft delete: anyone with the link can remove a photo, so keep it recoverable.
    res = await db.photos.update_one(
        {"id": photo_id, "task_id": task_id, **ACTIVE},
        {"$set": {"deleted_at": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Nie znaleziono zdjęcia")
    return Response(status_code=204)


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


@router.get("/tasks/{task_id}/report.pdf")
async def task_report(task_id: str):
    doc = await _get_task_doc(task_id)
    photos = [_aware(p) for p in await db.photos.find({"task_id": task_id, **ACTIVE}, {"_id": 0}).to_list(2000)]
    files = {
        f["id"]: bytes(f["data"])
        async for f in db.photo_files.find({"id": {"$in": [p["id"] for p in photos]}})
    }
    pdf = await asyncio.to_thread(build_task_pdf, doc, photos, files, _progress(doc["stages"]))
    slug = re.sub(r"[^A-Za-z0-9]+", "-", unicodedata.normalize("NFKD", doc["nazwa"]).encode("ascii", "ignore").decode()).strip("-")
    filename = f"raport-{slug or 'zadanie'}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
