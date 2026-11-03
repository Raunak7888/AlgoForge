import type { OpType } from "./types";

/** Conceptual costs, not measurements. */
export const COMPLEXITY: Record<OpType, string> = {
    push: "O(1): write one slot at the top; nothing else moves.",
    pop: "O(1): remove the top slot; nothing else moves.",
    enqueue: "O(1): add at the rear; nothing else moves.",
    dequeue: "O(1) conceptually: take the front. (A plain array shifts every element, O(n); a real queue tracks the front instead.)",
    peek: "O(1): look at the top / front without removing it.",
    isEmpty: "O(1): compare the size with 0.",
    getSize: "O(1): the size is stored.",
    clear: "O(n) to release the elements (O(1) if you just reset the size).",
    initialize: "O(n): every value is written once.",
    reset: "O(n): rebuild the starter contents.",
    createMark: "O(1) conceptually; this lab finds the element by index.",
    deleteMark: "O(1): drop the mark; the element is untouched.",
    readMark: "O(1) conceptually; this lab scans to find the element's index.",
    highlight: "O(1): annotation only.",
    pointArrow: "O(1): annotation only.",
    clearHighlights: "Annotation only.",
    clearArrows: "Annotation only.",
};
