# WIMED – rozliczanie zadań montażowych

No auth: anyone can create tasks; anyone with a task link can change stage statuses and add photos.

## Data model (Mongo)
- `tasks`: id, nazwa, klient, adres, termin (YYYY-MM-DD), opis, stages {produkcja|pakowanie|dostawa_rozladunek|montaz: nie_rozpoczety|w_trakcie|ukonczony}, created_at
- `photos`: id, task_id, stage, author, description, content_type, created_at (set by the server = "data dodania")
- `photo_files`: id (= photo id), data (binary), content_type

## API (/api)
- GET /tasks → TaskSummary[] (photo_counts per stage, progress 0-100: ukonczony=1, w_trakcie=0.5 per stage)
- POST /tasks (TaskCreate) → 201
- GET /tasks/{id} → TaskDetail (+ photos)
- PATCH /tasks/{id}/stages/{stage} {status}
- POST /tasks/{id}/photos multipart: stage, author, description, file (image/*, max 12 MB; the client downscales to 1920px JPEG)
- GET /photos/{id}/file → image bytes

## Frontend
- `/` dashboard: progress table (4 stage columns + photo counts + progress bar), metrics, search, "Nowe zadanie" dialog, copy-link button
- `/zadanie/:id` public task page: stage tabs, status toggle buttons, add-photo form (name stored in localStorage), gallery, lightbox

## Seed
`python seed.py`: "Montaż tablic kierunkowych DK79" (62%), "Bariery energochłonne S8 Radzymin" (12%).
