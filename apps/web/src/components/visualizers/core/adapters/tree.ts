import { COMPLEXITY } from "../../tree/complexity";
import { applyOp } from "../../tree/engine";
import { emptyTree } from "../../tree/model";
import type { TreeOp, TreeState, TreeType } from "../../tree/types";
import { makeAdapter } from "./make";

export const treeAdapter = makeAdapter<TreeState, TreeOp>("tree", { single: ["tree"], pair: ["tree1", "tree2"] }, COMPLEXITY, (s, op, self) => applyOp(s, op, self));
export const createTree = (type: TreeType): TreeState => emptyTree(type);
