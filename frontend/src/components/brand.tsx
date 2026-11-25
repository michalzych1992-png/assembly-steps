import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { StageStatus } from "@/lib/tasks";
import { STATUS_LABEL } from "@/lib/tasks";

export function WimedLogo({ className }: { className?: string }) {
  return (
    <Link to="/" data-testid="wimed-logo" aria-label="WIMED – strona główna" className={cn("group flex items-center gap-4", className)}>
      <img
        src="/wimed-logo.svg"
        alt="WIMED"
        className="h-8 w-auto transition-[filter] duration-200 group-hover:drop-shadow-[0_0_12px_rgba(207,33,43,0.55)] sm:h-9"
      />
      <span className="hidden border-l border-[#30363D] pl-4 text-[10px] font-semibold uppercase leading-tight tracking-[0.2em] text-muted-foreground sm:block">
        Zadania
        <br />
        montażowe
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
