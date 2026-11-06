import { applyOp, createState } from "../../array/arrayEngine";
import { COMPLEXITY } from "../../array/complexity";
import type { ArrayState, Op } from "../../array/types";
import { makeAdapter } from "./make";

export const arrayAdapter = makeAdapter<ArrayState, Op>("array", { single: ["arr"], pair: ["arr1", "arr2"] }, COMPLEXITY, (s, op, self) => applyOp(s, op, self));
export const createArray = (): ArrayState => createState([]);
