import { COMPLEXITY } from "../../graph/complexity";
import { applyOp } from "../../graph/engine";
import { DEFAULT_PROPS, emptyGraph } from "../../graph/model";
import type { GraphOp, GraphState } from "../../graph/types";
import { makeAdapter } from "./make";

export const graphAdapter = makeAdapter<GraphState, GraphOp>("graph", { single: ["graph"], pair: ["graph1", "graph2"] }, COMPLEXITY, (s, op, self) => applyOp(s, op, self));
export const createGraph = (): GraphState => emptyGraph(DEFAULT_PROPS);
