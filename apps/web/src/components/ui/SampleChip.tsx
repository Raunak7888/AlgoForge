export function SampleChip({ className = "" }: { className?: string }) {
    return (
        <span
            title="Fixed sample content. It does not come from your input."
            className={`inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 ${className}`}
        >
            Sample data
        </span>
    );
}
