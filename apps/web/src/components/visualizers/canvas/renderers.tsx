"use client";
import type { ReactElement } from "react";
import { ArrayStageView, type ArrayStageViewProps } from "../array/ArrayStage";
import type { ArrayState } from "../array/types";
import type { InstanceMeta } from "../script/compile";
import { GraphStageView, type GraphStageViewProps } from "../graph/GraphStage";
import type { GraphState } from "../graph/types";
import { HashStageView, type HashStageViewProps } from "../hash/HashStage";
import type { TableState, Trace } from "../hash/types";
import { LinearStageView, type LinearStageViewProps } from "../linear/LinearStage";
import type { LinearState } from "../linear/types";
import { ListStageView, type ListStageViewProps } from "../linkedlist/ListStage";
import type { ListState } from "../linkedlist/types";
import { TreeStageView, type TreeStageViewProps } from "../tree/TreeStage";
import type { TreeState } from "../tree/types";
import type { GroupView } from "./runtime";

const noop = () => {};

/**
 * Draws one structure with the existing stage for its family.
 *
 * The casts below are the one place where untyped script data meets the typed stages: `view.state`
 * and `view.anim` were produced together by that family's own engine (see core/adapters), so they match.
 */
export function renderStage(meta: InstanceMeta, view: GroupView, finish: (token: number) => void): ReactElement | null {
    if (view.state === null) return null;
    const status = view.running ? "animating" : "ready";
    const anim = view.anim as unknown;
    const last = view.last as unknown;

    switch (meta.family) {
        case "array":
            return <ArrayStageView data={view.state as ArrayState} anim={anim as ArrayStageViewProps["anim"]} status={status} showIndex finishAnimation={finish} />;
        case "linear":
            return (
                <LinearStageView
                    kind={meta.ds === "queue" ? "queue" : "stack"}
                    data={view.state as LinearState}
                    last={last as LinearStageViewProps["last"]}
                    anim={anim as LinearStageViewProps["anim"]}
                    showIndex
                    finishAnimation={finish}
                />
            );
        case "linkedlist":
            return (
                <ListStageView
                    data={view.state as ListState}
                    last={last as ListStageViewProps["last"]}
                    selectedId={null}
                    anim={anim as ListStageViewProps["anim"]}
                    showIndex
                    finishAnimation={finish}
                />
            );
        case "tree":
            return (
                <TreeStageView
                    data={view.state as TreeState}
                    last={last as TreeStageViewProps["last"]}
                    selectedId={null}
                    anim={anim as TreeStageViewProps["anim"]}
                    status={status}
                    showIds
                    caption={null}
                    selectNode={noop}
                    finishAnimation={finish}
                    run={noop}
                />
            );
        case "hash":
            return (
                <HashStageView
                    kind={meta.ds === "set" ? "set" : "map"}
                    data={view.state as TableState}
                    trace={((view.last?.outcome as { trace?: Trace | null } | undefined)?.trace ?? null) as HashStageViewProps["trace"]}
                    anim={anim as HashStageViewProps["anim"]}
                    showIndex
                    finishAnimation={finish}
                />
            );
        case "graph":
            return (
                <GraphStageView
                    data={view.state as GraphState}
                    selV={null}
                    selE={null}
                    anim={anim as GraphStageViewProps["anim"]}
                    status={status}
                    showIds
                    caption={null}
                    tool="move"
                    connectFrom={null}
                    selectVertex={noop}
                    selectEdge={noop}
                    setConnectFrom={noop}
                    run={noop}
                    finishAnimation={finish}
                />
            );
        default:
            return null; // an unknown family: draw nothing rather than crash the canvas
    }
}
