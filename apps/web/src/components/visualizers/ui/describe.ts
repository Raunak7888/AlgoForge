import { currentBeat, progressOf } from "../engine/selectors";
import type { TransportState } from "../engine/transport";
import type { Compiled } from "../script/compile";

export interface StepInfo {
    /** e.g. "A.swap(0, 3)". Null for a step that only has narration. */
    call: string | null;
    failed: boolean;
    error: string | null;
}

export function describeStep(c: Compiled | null, t: TransportState): StepInfo {
    const b = currentBeat(c, t);
    if (!b) return { call: null, failed: false, error: null };
    const ran = b.outcome.explain.ran.replace(/ \(rejected\)$/, "");
    return { call: `${b.instance}.${ran}`, failed: !b.outcome.ok, error: b.outcome.ok ? null : (b.outcome.error ?? null) };
}

/** Text for aria-valuetext on the slider: "Step 3 of 12: A.swap(0, 3)". */
export function valueText(c: Compiled | null, t: TransportState): string {
    const { position, total } = progressOf(t);
    if (position === 0) return total === 0 ? "No steps" : `Before step 1 of ${total}`;
    const d = describeStep(c, t);
    return `Step ${position} of ${total}${d.call ? `: ${d.call}` : ""}${d.failed ? " (rejected)" : ""}`;
}
