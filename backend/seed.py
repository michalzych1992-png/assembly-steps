"""Idempotent demo seed: `cd /app/backend && python seed.py`."""
import asyncio

from lib.db import db, ensure_indexes
from models.tasks import Task

DEMO = [
    dict(nazwa="Montaż tablic kierunkowych DK79", klient="GDDKiA O/Warszawa", adres="DK79 km 18+400, Piaseczno",
         termin="2026-09-15", opis="Dostawa i montaż 4 konstrukcji bramowych oraz oznakowania E-1, E-2.",
         stages={"produkcja": "ukonczony", "pakowanie": "ukonczony", "dostawa_rozladunek": "w_trakcie", "montaz": "nie_rozpoczety"}),
    dict(nazwa="Bariery energochłonne S8 Radzymin", klient="STRABAG Sp. z o.o.", adres="S8 węzeł Radzymin Płd.",
         termin="2026-10-02", opis="Montaż barier N2-W4 na długości 1,2 km.",
         stages={"produkcja": "w_trakcie", "pakowanie": "nie_rozpoczety", "dostawa_rozladunek": "nie_rozpoczety", "montaz": "nie_rozpoczety"}),
]


async def main():
    await ensure_indexes()
    for d in DEMO:
        if await db.tasks.find_one({"nazwa": d["nazwa"]}):
            continue
        await db.tasks.insert_one(Task(**d).model_dump())
    print("seeded", await db.tasks.count_documents({}))


if __name__ == "__main__":
    asyncio.run(main())
