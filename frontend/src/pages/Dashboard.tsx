import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Camera, Copy, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { ProgressBar, StatusBadge, WimedLogo } from "@/components/brand";
import { cn } from "@/lib/utils";
import { STAGES, publicTaskUrl, useTasks } from "@/lib/tasks";
import type { TaskSummary } from "@/lib/tasks";

async function copyLink(id: string) {
  try {
    await navigator.clipboard.writeText(publicTaskUrl(id));
    toast.success("Link do zadania skopiowany do schowka");
  } catch {
    toast.error("Nie udało się skopiować linku");
  }
}

function formatDate(iso: string) {
  try {
    return format(new Date(iso + "T00:00:00"), "dd.MM.yyyy");
  } catch {
    return iso;
  }
}

function Metric({ label, value, testId, accent }: { label: string; value: number; testId: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel/80 p-5 backdrop-blur-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p data-testid={testId} className={cn("mt-2 font-heading text-3xl font-bold", accent)}>
        {value}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { data, isError, isLoading } = useTasks();
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const tasks: TaskSummary[] = isError ? [] : (data ?? []);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return tasks;
    return tasks.filter((t) => [t.nazwa, t.klient, t.adres].some((v) => v.toLowerCase().includes(s)));
  }, [tasks, q]);

  const done = tasks.filter((t) => t.progress === 100).length;
  const inProgress = tasks.filter((t) => t.progress > 0 && t.progress < 100).length;

  return (
    <div className="min-h-screen">
      <header data-testid="app-header" className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <WimedLogo />
          <CreateTaskDialog />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="animate-fade-up">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-wimed">Tabela postępu</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Rozliczanie zadań montażowych</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Każde zadanie ma publiczny link — osoby z linkiem mogą aktualizować status etapów i dodawać zdjęcia z realizacji.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metric label="Łącznie zadań" value={tasks.length} testId="metric-total" />
          <Metric label="W realizacji" value={inProgress} testId="metric-in-progress" accent="text-amber-300" />
          <Metric label="Zakończone" value={done} testId="metric-done" accent="text-emerald-300" />
          <Metric label="Nierozpoczęte" value={tasks.length - done - inProgress} testId="metric-not-started" accent="text-slate-400" />
        </div>

        <section className="mt-8 rounded-xl border border-border bg-panel/80 backdrop-blur-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Zadania</h2>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                data-testid="input-search-tasks"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Szukaj: nazwa, klient, adres"
                className="pl-9"
              />
            </div>
          </div>

          <Table data-testid="table-tasks-progress">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-56 px-4">Zadanie</TableHead>
                <TableHead className="px-4">Termin</TableHead>
                {STAGES.map((s) => (
                  <TableHead key={s.id} className="px-4">{s.label}</TableHead>
                ))}
                <TableHead className="min-w-36 px-4">Postęp</TableHead>
                <TableHead className="px-4 text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t, i) => (
                <TableRow
                  key={t.id}
                  data-testid={`task-row-${t.id}`}
                  onClick={() => navigate(`/zadanie/${t.id}`)}
                  className="animate-fade-up cursor-pointer transition-colors duration-150 hover:bg-white/[0.03]"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <TableCell className="px-4 py-3.5">
                    <p className="font-semibold text-foreground">{t.nazwa}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.klient} · {t.adres}</p>
                  </TableCell>
                  <TableCell className="px-4 font-mono text-xs">{formatDate(t.termin)}</TableCell>
                  {STAGES.map((s) => (
                    <TableCell key={s.id} className="px-4">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={t.stages[s.id]} testId={`task-${t.id}-stage-${s.id}`} />
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                          <Camera className="h-3 w-3" /> {t.photo_counts[s.id] ?? 0}
                        </span>
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className="px-4">
                    <ProgressBar value={t.progress} testId={`task-progress-${t.id}`} />
                  </TableCell>
                  <TableCell className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Kopiuj link publiczny"
                        data-testid={`btn-copy-link-${t.id}`}
                        onClick={() => copyLink(t.id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Link
                        to={`/zadanie/${t.id}`}
                        aria-label="Otwórz zadanie"
                        data-testid={`btn-view-task-${t.id}`}
                        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9} className="px-4 py-14 text-center text-muted-foreground" data-testid="tasks-empty">
                    {isLoading ? "Wczytywanie…" : q ? "Brak zadań pasujących do wyszukiwania." : "Brak zadań. Utwórz pierwsze zadanie montażowe."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      </main>
    </div>
  );
}
