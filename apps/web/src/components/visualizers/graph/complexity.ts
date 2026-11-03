import type { OpType } from "./types";

/**
 * Conceptual costs for a typical ADJACENCY-LIST graph (V vertices, E edges, deg = the vertex's degree).
 * Not measured. This lab keeps plain id-keyed maps and scans them, so real work here may differ.
 */
export const COMPLEXITY: Record<OpType, string> = {
    initialize: "O(V + E) to build; checking the Connected property adds one traversal, O(V + E).",
    reset: "O(V + E): rebuild the starter graph.",
    setProps: "Changing weights touches every edge, O(E). Turning on Connected needs a traversal, O(V + E).",
    addVertex: "O(1) to add an isolated vertex. With attachTo, O(1) more per edge created.",
    updateVertex: "O(1) once you hold the vertex.",
    readVertex: "O(1) for the value; listing neighbours is O(deg).",
    deleteVertex: "O(deg) with adjacency lists on both ends (O(V + E) if edges are scanned). Connected graphs add a traversal, O(V + E).",
    getVertex: "O(1) with a map from id to vertex.",
    getVertices: "O(V).",
    getVertexCount: "O(1) if a counter is kept.",
    isEmpty: "O(1).",
    clear: "O(V + E) to release everything (O(1) if you drop the roots).",
    addEdge: "O(1) to append to the adjacency lists; checking for a duplicate costs O(deg) in a list, O(1) with an edge set.",
    removeEdge: "O(deg) to find and remove it from the lists. Connected graphs add a traversal, O(V + E).",
    updateEdge: "O(deg) to find the edge; O(1) if you hold it.",
    readEdge: "O(deg) with adjacency lists.",
    hasEdge: "O(deg) with adjacency lists, O(1) with a hash set of pairs, O(1) with an adjacency matrix.",
    getEdges: "O(E).",
    getDegree: "O(deg) to count a list, O(1) if a counter is kept.",
    getInDegree: "O(E) with out-lists only (every edge must be checked); O(1) if in-degrees are kept.",
    getOutDegree: "O(1) if the out-list length is known.",
    moveVertex: "O(1): only the drawing changes, never the topology.",
    highlight: "Annotation only.",
    clearHighlights: "Annotation only.",
    pointArrow: "Annotation only.",
    pointArrowFromTo: "Annotation only.",
    clearArrows: "Annotation only.",
    mark: "O(1) once you hold the vertex; a marker stores the vertex id.",
    createMark: "O(1) once you hold the vertex; a marker stores the vertex id.",
    deleteMark: "O(1): drop the marker; the vertex is untouched.",
    readMark: "O(1): the marker stores the vertex id.",
    moveMarkTo: "O(1): re-attach the marker.",
    moveMarkToIndex: "O(1): re-attach the marker.",
};
