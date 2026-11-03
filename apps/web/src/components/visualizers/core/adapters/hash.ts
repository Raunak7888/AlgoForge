import { COMPLEXITY } from "../../hash/complexity";
import { applyOp } from "../../hash/hashEngine";
import { DEFAULT_CAPACITY } from "../../hash/hashing";
import { createTable } from "../../hash/tableModel";
import type { HashOp, Kind, TableState } from "../../hash/types";
import { makeAdapter } from "./make";

export const hashAdapter = makeAdapter<TableState, HashOp>("hash", { single: [], pair: null }, COMPLEXITY, (s, op) => applyOp(s, op));
export const createHash = (kind: Kind): TableState => createTable(kind, DEFAULT_CAPACITY, []);
