import { DS_NAMES, DS_TYPES, opsOf } from "../core/registry";
import type { ArgMeta } from "../core/types";
import { INSTANCE_ID_RE } from "../core/ids";
import { LIMITS } from "./compile";
import { MAX_MESSAGE_LENGTH } from "./normalize";

type Json = Record<string, unknown>;

const PRIMITIVE_TYPES = ["string", "number", "boolean", "null"];

function argSchema(a: ArgMeta, allowList: boolean): Json {
    switch (a.kind) {
        case "primitive":
            return allowList ? { type: [...PRIMITIVE_TYPES, "array"], items: { type: PRIMITIVE_TYPES } } : { type: PRIMITIVE_TYPES };
        case "primitiveArray":
            return { type: "array", items: { type: PRIMITIVE_TYPES } };
        case "integer":
            return { type: "integer" };
        case "number":
            return { type: "number" };
        case "string":
            return { type: "string" };
        case "boolean":
            return { type: "boolean" };
        case "enum":
            return { enum: [...(a.values ?? [])] };
        case "json":
            return {};
    }
}

/**
 * JSON Schema (draft-07) for the script, generated from the registry so autocomplete and hover
 * in the editor can never disagree with what the compiler accepts. Typos in operation arguments
 * are reported by the compiler (with "did you mean"), so the schema leaves extra keys open.
 */
export function buildScriptSchema(): Json {
    // One conditional block per operation name, merged across every structure that has it.
    const byOp = new Map<string, { props: Map<string, Json>; required: Set<string>; docs: string[]; count: number }>();
    for (const t of DS_TYPES) {
        for (const [name, meta] of Object.entries(opsOf(t))) {
            let e = byOp.get(name);
            const first = !e;
            if (!e) {
                e = { props: new Map(), required: new Set(), docs: [], count: 0 };
                byOp.set(name, e);
            }
            const mine = new Set(meta.args.filter((a) => !a.optional && !a.ref).map((a) => a.name));
            if (first) mine.forEach((n) => e!.required.add(n));
            else for (const n of [...e.required]) if (!mine.has(n)) e.required.delete(n);
            for (const a of meta.args) if (!a.ref && !e.props.has(a.name)) e.props.set(a.name, { ...argSchema(a, a.name === "value" && meta.args.length === 1), description: `${name}: ${a.name}` });
            if (meta.complexity && !e.docs.includes(meta.complexity)) e.docs.push(meta.complexity);
            e.count++;
        }
    }

    const opNames = [...byOp.keys()];
    const conditionals = opNames.map((name) => {
        const e = byOp.get(name)!;
        const properties: Json = {};
        e.props.forEach((v, k) => (properties[k] = v));
        return {
            if: { anyOf: [{ properties: { op: { const: name } }, required: ["op"] }, { properties: { operationname: { const: name } }, required: ["operationname"] }, { properties: { operation: { const: name } }, required: ["operation"] }] },
            then: { properties, ...(e.required.size ? { required: [...e.required] } : {}) },
        };
    });

    const opSchema = { type: "string", enum: opNames, description: "The operation to run. Its arguments are written next to it." };
    const dsSchema = { type: "string", enum: [...DS_NAMES], description: "The type of structure. Needed on the first step that uses an id." };

    const entry: Json = {
        type: "object",
        properties: {
            step: { type: "integer", minimum: 0, description: "Steps run in ascending order. Entries sharing a step number animate at the same time." },
            id: { type: "string", pattern: INSTANCE_ID_RE.source, description: "Name of the structure on the canvas, e.g. A." },
            ds: dsSchema,
            dsname: dsSchema,
            op: opSchema,
            operationname: opSchema,
            operation: opSchema,
            message: { type: "string", maxLength: MAX_MESSAGE_LENGTH, description: "Narration shown with this step (plain text)." },
            msg: { type: "string", maxLength: MAX_MESSAGE_LENGTH },
            at: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], additionalProperties: false },
        },
        allOf: conditionals,
    };

    return {
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "AlgoForge visualizer script",
        definitions: { entry },
        anyOf: [
            { type: "array", maxItems: LIMITS.entries, items: { $ref: "#/definitions/entry" } },
            {
                type: "object",
                properties: {
                    onError: { enum: ["continue", "halt"], description: '"halt" stops at the first rejected operation.' },
                    script: { type: "array", maxItems: LIMITS.entries, items: { $ref: "#/definitions/entry" } },
                },
                required: ["script"],
            },
        ],
    };
}
