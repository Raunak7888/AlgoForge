import { cn } from "@/lib/utils";
import { STATUS_LABEL, type FeatureStatus } from "@/lib/featureStatus";

const STYLE: Record<FeatureStatus, string> = {
    available: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    preview: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    planned: "border-foreground/15 bg-foreground/5 text-foreground/60",
};

export function StatusChip({ status, className }: { status: FeatureStatus; className?: string }) {
    return (
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider", STYLE[status], className)}>
            {STATUS_LABEL[status]}
        </span>
    );
}
