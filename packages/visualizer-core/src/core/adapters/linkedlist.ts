import { COMPLEXITY } from "../../linkedlist/complexity";
import { applyOp } from "../../linkedlist/engine";
import { createList } from "../../linkedlist/model";
import type { ListOp, ListState, ListType } from "../../linkedlist/types";
import { makeAdapter } from "./make";

export const linkedListAdapter = makeAdapter<ListState, ListOp>("linkedlist", { single: ["list"], pair: ["list1", "list2"] }, COMPLEXITY, (s, op, self) => applyOp(s, op, self));
export const createLinkedList = (type: ListType): ListState => createList(type, []);
