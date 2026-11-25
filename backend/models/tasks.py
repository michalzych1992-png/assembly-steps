import uuid
from datetime import datetime, timezone
from typing import Dict, List, Literal

from pydantic import BaseModel, Field

StageId = Literal["produkcja", "pakowanie", "dostawa_rozladunek", "montaz"]
StageStatus = Literal["nie_rozpoczety", "w_trakcie", "ukonczony"]

STAGES: List[str] = ["produkcja", "pakowanie", "dostawa_rozladunek", "montaz"]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def default_stages() -> Dict[str, str]:
    return {s: "nie_rozpoczety" for s in STAGES}


class TaskCreate(BaseModel):
    nazwa: str = Field(min_length=1, max_length=200)
    klient: str = Field(min_length=1, max_length=200)
    adres: str = Field(min_length=1, max_length=300)
    termin: str = Field(min_length=10, max_length=10, description="YYYY-MM-DD")
    opis: str = Field(default="", max_length=5000)


class Task(TaskCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    stages: Dict[str, StageStatus] = Field(default_factory=default_stages)
    created_at: datetime = Field(default_factory=now_utc)


class TaskSummary(Task):
    photo_counts: Dict[str, int]
    progress: int  # 0-100


class Photo(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    stage: StageId
    author: str
    description: str
    content_type: str
    created_at: datetime = Field(default_factory=now_utc)


class TaskDetail(TaskSummary):
    photos: List[Photo]


class StageStatusUpdate(BaseModel):
    status: StageStatus
