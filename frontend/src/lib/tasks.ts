import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, apiUpload } from "@/lib/api";

// Mirrors backend/models/tasks.py
export type StageId = "produkcja" | "pakowanie" | "dostawa_rozladunek" | "montaz";
export type StageStatus = "nie_rozpoczety" | "w_trakcie" | "ukonczony";

export interface TaskCreate {
  nazwa: string;
  klient: string;
  adres: string;
  termin: string; // YYYY-MM-DD
  opis: string;
}

export interface Task extends TaskCreate {
  id: string;
  stages: Record<StageId, StageStatus>;
  created_at: string;
}

export interface TaskSummary extends Task {
  photo_counts: Record<StageId, number>;
  progress: number;
}

export interface Photo {
  id: string;
  task_id: string;
  stage: StageId;
  author: string;
  description: string;
  content_type: string;
  created_at: string;
}

export interface TaskDetail extends TaskSummary {
  photos: Photo[];
}

export const STAGES: { id: StageId; label: string; short: string }[] = [
  { id: "produkcja", label: "Produkcja", short: "Produkcja" },
  { id: "pakowanie", label: "Pakowanie", short: "Pakowanie" },
  { id: "dostawa_rozladunek", label: "Dostawa i rozładunek", short: "Dostawa" },
  { id: "montaz", label: "Montaż", short: "Montaż" },
];

export const STATUSES: { id: StageStatus; label: string }[] = [
  { id: "nie_rozpoczety", label: "Nie rozpoczęty" },
  { id: "w_trakcie", label: "W trakcie" },
  { id: "ukonczony", label: "Ukończony" },
];

export const STATUS_LABEL: Record<StageStatus, string> = {
  nie_rozpoczety: "Nie rozpoczęty",
  w_trakcie: "W trakcie",
  ukonczony: "Ukończony",
};

export const photoUrl = (id: string) => `/api/photos/${id}/file`;
export const publicTaskUrl = (id: string) => `${window.location.origin}/zadanie/${id}`;

export function useTasks() {
  return useQuery({ queryKey: ["tasks"], queryFn: () => apiGet<TaskSummary[]>("/tasks") });
}

export function useTask(id: string) {
  return useQuery({ queryKey: ["task", id], queryFn: () => apiGet<TaskDetail>(`/tasks/${id}`) });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskCreate) => apiPost<TaskSummary>("/tasks", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateStage(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stage, status }: { stage: StageId; status: StageStatus }) =>
      apiPatch<TaskSummary>(`/tasks/${taskId}/stages/${stage}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useAddPhoto(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => apiUpload<Photo>(`/tasks/${taskId}/photos`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Downscale large camera photos client-side before upload (keeps storage and upload time small).
export async function compressImage(file: File, maxSide = 1920, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
