import { COMPLEXITY } from "../../linear/complexity";
import { applyOp } from "../../linear/engine";
import { createState } from "../../linear/model";
import type { Kind, LinearOp, LinearState } from "../../linear/types";
import { makeAdapter } from "./make";

export const linearAdapter = makeAdapter<LinearState, LinearOp>("linear", { single: [], pair: null }, COMPLEXITY, (s, op) => applyOp(s, op));
export const createLinear = (kind: Kind): LinearState => createState(kind, []);
