import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { StageStatus } from "@/lib/tasks";
import { STATUS_LABEL } from "@/lib/tasks";

export function WimedLogo({ className }: { className?: string }) {
  return (
    <Link to="/" data-testid="wimed-logo" className={cn("group flex items-center gap-3", className)}>
      <span className="relative grid h-10 w-10 place-items-center rounded-md bg-wimed shadow-[0_0_24px_rgba(225,29,72,0.35)] transition-transform duration-200 group-hover:-rotate-3">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
          <path d="M3 6l3.5 12L12 8l5.5 10L21 6" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block font-heading text-xl font-extrabold tracking-[0.12em] text-white">WIMED</span>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Zadania montażowe
        </span>
      </span>
    </Link>
  );
}

const STATUS_STYLE: Record<StageStatus, { pill: string; dot: string }> = {
  nie_rozpoczety: { pill: "bg-[#21262D] text-slate-400 border-[#30363D]", dot: "bg-slate-500" },
  w_trakcie: { pill: "bg-amber-950/70 text-amber-300 border-amber-600/50", dot: "bg-amber-400 animate-pulse" },
  ukonczony: { pill: "bg-emerald-950/70 text-emerald-300 border-emerald-600/50", dot: "bg-emerald-400" },
};

export function StatusBadge({ status, testId }: { status: StageStatus; testId?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wider",
        s.pill,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ProgressBar({ value, testId, className }: { value: number; testId?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)} data-testid={testId}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#21262D]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            value === 100 ? "bg-emerald-500" : "bg-wimed",
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono text-xs text-muted-foreground">{value}%</span>
    </div>
  );
}
