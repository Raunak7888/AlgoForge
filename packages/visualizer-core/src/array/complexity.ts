import type { Op } from "./types";

/** Conceptual dynamic-array costs, not measurements. */
export const COMPLEXITY: Record<Op["type"], string> = {
    add: "O(1) at the end (amortized); O(n) in the middle or front, because later elements shift right.",
    append: "O(1) amortized: write one slot past the end.",
    prepend: "O(n): every element shifts right by one.",
    insertAt: "O(n − index): elements after the index shift right.",
    update: "O(1): jump straight to the index and overwrite.",
    delete: "O(n − index): elements after the index shift left.",
    pop: "O(1): remove the last slot, nothing shifts.",
    shift: "O(n): every remaining element shifts left.",
    read: "O(1): an index jumps directly to its slot.",
    swap: "O(1): two reads and two writes.",
    getLength: "O(1): the length is stored.",
    isEmpty: "O(1): compare the length with 0.",
    clear: "O(n) to release elements (O(1) if you just reset the length). Annotations are dropped with them.",
    initialize: "O(n): every value is written once.",
    reset: "O(n): rebuild the starter array.",
    mark: "O(1) conceptually: a marker stores an element id (this lab looks up the index).",
    deleteMark: "O(1): drop the marker; the element is untouched.",
    readMark:
        "O(1) conceptually; this lab finds the element's index with a scan.",
    moveMarkToIndex: "O(1): re-attach the marker to another element.",
    createMark: "O(1): store a number.",
    removeMark: "O(1): drop the number.",
    renameMarker:
        "O(1): change one label; the element and array are untouched.",
    renameMark: "O(1): change one label; the index it holds is untouched.",
    moveMarkOne: "O(1): add or subtract 1.",
    moveMarkBy: "O(1): add the steps.",
    moveMarkTo: "O(1): assign the index.",
    highlight: "O(1): annotation only; no array data is touched.",
    clearHighlight: "Annotation only; no array data is touched.",
    pointArrow: "O(1): annotation only.",
    pointArrowFromTo: "O(1): annotation only.",
    recolorArrows: "O(arrows): annotation only; no array data is touched.",
    clearArrows: "Annotation only.",
};