import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { ArrowLeft, Calendar, Camera, Check, Copy, FileDown, ImagePlus, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ProgressBar, StatusBadge, WimedLogo } from "@/components/brand";
import { apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  STAGES,
  STATUSES,
  compressImage,
  photoUrl,
  publicTaskUrl,
  reportUrl,
  useAddPhoto,
  useTask,
  useUpdateStage,
} from "@/lib/tasks";
import type { Photo, StageId, StageStatus, TaskDetail } from "@/lib/tasks";

const AUTHOR_KEY = "wimed-author";

function fmtDateTime(iso: string) {
  return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: pl });
}

function StatusSelector({ taskId, stage, value }: { taskId: string; stage: StageId; value: StageStatus }) {
  const update = useUpdateStage(taskId);
  return (
    <div data-testid={`stage-status-selector-${stage}`} className="grid grid-cols-3 gap-2">
      {STATUSES.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            data-testid={`btn-status-${s.id}-${stage}`}
            aria-pressed={active}
            disabled={update.isPending}
            onClick={() =>
              !active &&
              update.mutate(
                { stage, status: s.id },
                {
                  onSuccess: () => toast.success(`Status zmieniony: ${s.label}`),
                  onError: (e) => toast.error(apiErrorMessage(e, "Nie udało się zmienić statusu")),
                },
              )
            }
            className={cn(
              "rounded-lg border px-3 py-2.5 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none disabled:opacity-60",
              active && s.id === "nie_rozpoczety" && "border-slate-500 bg-[#2D333B] text-white",
              active && s.id === "w_trakcie" && "border-amber-500/70 bg-amber-950/70 text-amber-200",
              active && s.id === "ukonczony" && "border-emerald-500/70 bg-emerald-950/70 text-emerald-200",
              !active && "border-border bg-[#0D1117] text-muted-foreground hover:border-[#30363D] hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function AddPhotoForm({ taskId, stage }: { taskId: string; stage: StageId }) {
  const [author, setAuthor] = useState(() => localStorage.getItem(AUTHOR_KEY) ?? "");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const add = useAddPhoto(taskId);

  const pick = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const valid = author.trim() && description.trim() && file;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !file) return;
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const form = new FormData();
      form.append("stage", stage);
      form.append("author", author.trim());
      form.append("description", description.trim());
      form.append("file", blob, file.name.replace(/\.\w+$/, "") + (blob.type === "image/jpeg" ? ".jpg" : ""));
      await add.mutateAsync(form);
      localStorage.setItem(AUTHOR_KEY, author.trim());
      toast.success("Zdjęcie dodane");
      setDescription("");
      pick(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      toast.error(apiErrorMessage(err, "Nie udało się dodać zdjęcia"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form data-testid={`form-add-photo-${stage}`} onSubmit={submit} className="grid gap-4 rounded-xl border border-border bg-[#0D1117]/60 p-5">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <ImagePlus className="h-4 w-4 text-wimed" /> Dodaj zdjęcie z etapu
      </h4>
      <label
        className={cn(
          "group relative grid min-h-36 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-[#30363D] bg-panel-2/50 transition-colors duration-150 hover:border-wimed/60",
          preview && "border-solid",
        )}
      >
        {preview ? (
          <img src={preview} alt="Podgląd" className="max-h-56 w-full object-contain" data-testid={`photo-preview-${stage}`} />
        ) : (
          <span className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <Camera className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
            Kliknij, aby wybrać zdjęcie lub zrobić je aparatem
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          data-testid={`input-photo-file-${stage}`}
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className="grid gap-1.5">
        <Label htmlFor={`author-${stage}`}>Imię i nazwisko *</Label>
        <Input
          id={`author-${stage}`}
          data-testid={`input-photo-author-${stage}`}
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="np. Jan Kowalski (Brygada 2)"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`desc-${stage}`}>Opis *</Label>
        <Textarea
          id={`desc-${stage}`}
          data-testid={`input-photo-desc-${stage}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Opis wykonanych prac / stan elementu"
        />
      </div>
      <p className="text-xs text-muted-foreground">Data dodania zostanie zapisana automatycznie.</p>
      <Button type="submit" data-testid={`btn-upload-photo-${stage}`} disabled={!valid || busy} className="hover:bg-wimed-dark">
        {busy ? "Wysyłanie…" : "Dodaj zdjęcie"}
      </Button>
    </form>
  );
}

function Gallery({ photos, stage, onOpen }: { photos: Photo[]; stage: StageId; onOpen: (p: Photo) => void }) {
  if (photos.length === 0) {
    return (
      <div data-testid={`gallery-empty-${stage}`} className="grid min-h-48 place-items-center rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Brak zdjęć dla tego etapu. Dodaj pierwsze zdjęcie z realizacji.
      </div>
    );
  }
  return (
    <div data-testid={`gallery-grid-${stage}`} className="grid content-start items-start gap-4 sm:grid-cols-2">
      {photos.map((p, i) => (
        <button
          key={p.id}
          type="button"
          data-testid={`photo-card-${p.id}`}
          onClick={() => onOpen(p)}
          className="group animate-fade-up overflow-hidden rounded-xl border border-border bg-panel-2 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-wimed/50"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="aspect-[4/3] overflow-hidden bg-black">
            <img src={photoUrl(p.id)} alt={p.description} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          </div>
          <div className="grid gap-2 p-4">
            <p className="line-clamp-2 text-sm">{p.description}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{p.author}</span>
              <span className="font-mono">{fmtDateTime(p.created_at)}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function TaskHeader({ task }: { task: TaskDetail }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicTaskUrl(task.id));
      setCopied(true);
      toast.success("Link do zadania skopiowany do schowka");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nie udało się skopiować linku");
    }
  };
  return (
    <section className="animate-fade-up relative overflow-hidden rounded-xl border border-border bg-panel/80 p-6 backdrop-blur-sm sm:p-8">
      <span className="absolute inset-y-0 left-0 w-1 bg-wimed" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-wimed">Zadanie montażowe</p>
          <h1 data-testid="task-title" className="mt-2 text-2xl font-bold sm:text-3xl">{task.nazwa}</h1>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span data-testid="task-client" className="inline-flex items-center gap-1.5"><User className="h-4 w-4" />{task.klient}</span>
            <span data-testid="task-address" className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{task.adres}</span>
            <span data-testid="task-deadline" className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />Termin: <span className="font-mono text-foreground">{format(new Date(task.termin + "T00:00:00"), "dd.MM.yyyy")}</span>
            </span>
          </div>
          {task.opis && <p data-testid="task-description" className="mt-4 max-w-3xl whitespace-pre-line leading-relaxed text-foreground/85">{task.opis}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <Button
            data-testid="btn-copy-public-link"
            onClick={copy}
            variant="outline"
            className="gap-2 border-wimed/40 hover:border-wimed hover:bg-wimed/10"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copied ? "Skopiowano" : "Kopiuj link do zadania"}
          </Button>
          <a
            href={reportUrl(task.id)}
            download
            data-testid="btn-download-report"
            className={cn(buttonVariants(), "gap-2 hover:bg-wimed-dark hover:shadow-[0_0_20px_rgba(225,29,72,0.35)]")}
          >
            <FileDown className="h-4 w-4" /> Pobierz raport PDF
          </a>
        </div>
      </div>
      <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <ProgressBar value={task.progress} testId="task-progress-bar" />
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {s.short}: <StatusBadge status={task.stages[s.id]} />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function TaskPage() {
  const { id = "" } = useParams();
  const { data, isError, isLoading } = useTask(id);
  const [stage, setStage] = useState<StageId>("produkcja");
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const task = isError ? undefined : data;

  return (
    <div className="min-h-screen" data-testid="public-task-view">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <WimedLogo />
          <Link to="/" data-testid="link-back" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Lista zadań
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {!task ? (
          <div data-testid="task-not-found" className="rounded-xl border border-border bg-panel/80 p-10 text-center text-muted-foreground">
            {isLoading ? "Wczytywanie zadania…" : "Nie znaleziono zadania lub jest ono chwilowo niedostępne."}
          </div>
        ) : (
          <>
            <TaskHeader task={task} />

            <Tabs value={stage} onValueChange={(v) => setStage(v as StageId)} className="mt-8">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-panel p-1 sm:grid-cols-4">
                {STAGES.map((s, i) => (
                  <TabsTrigger
                    key={s.id}
                    value={s.id}
                    data-testid={`stage-tab-${s.id}`}
                    className="h-auto flex-col items-start gap-1 px-3 py-2.5 data-[selected]:bg-[#21262D]"
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                        <Camera className="h-3 w-3" />{task.photo_counts[s.id] ?? 0}
                      </span>
                    </span>
                    <span className="text-sm font-semibold">{s.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {STAGES.map((s) => (
                <TabsContent key={s.id} value={s.id} className="mt-6">
                  <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
                    <div className="grid content-start gap-6">
                      <div className="rounded-xl border border-border bg-panel/80 p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-lg font-semibold">{s.label}</h3>
                          <StatusBadge status={task.stages[s.id]} testId={`stage-status-${s.id}`} />
                        </div>
                        <StatusSelector taskId={task.id} stage={s.id} value={task.stages[s.id]} />
                      </div>
                      <AddPhotoForm taskId={task.id} stage={s.id} />
                    </div>
                    <Gallery photos={task.photos.filter((p) => p.stage === s.id)} stage={s.id} onOpen={setLightbox} />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </main>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent data-testid="modal-photo-lightbox" className="max-w-[min(96vw,1100px)] gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1100px)]">
          {lightbox && (
            <>
              <img src={photoUrl(lightbox.id)} alt={lightbox.description} className="max-h-[75vh] w-full bg-black object-contain" />
              <div className="grid gap-2 p-5">
                <DialogTitle className="text-base font-medium leading-relaxed">{lightbox.description}</DialogTitle>
                <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{lightbox.author}</span>
                  <span className="font-mono">Dodano: {fmtDateTime(lightbox.created_at)}</span>
                  <span>Etap: {STAGES.find((x) => x.id === lightbox.stage)?.label}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
