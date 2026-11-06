
# Linked List Teaching Animator — Master Plan

---

## What we are building

A browser-based tool that teaches linked list algorithms by animating them one primitive operation at a time. The user watches pointers move, links flip, nodes appear and disappear — and at every step the tool explains what just happened, why it matters, and what the code looks like.

The key idea is that the tool does not know about algorithms. It only knows how to execute small atomic operations like "move this pointer" or "change this node's color." Algorithms are just sequences of those operations written in a JSON file. This means adding a new algorithm never requires touching the engine — you just write a new file.

---

## Who it is for

Students learning linked lists for the first time. The tool is not a competitive programmer's reference. It is a visual explainer. Every design decision prioritizes clarity over density.

---

## What problem it solves

Every existing DSA visualizer either plays the whole algorithm as one black-box animation with no explanation, or shows pseudocode with no visual. This tool connects the two — each line of code maps to a visual moment, and each visual moment has a plain-English explanation of what and why.

---

## How it works — the big picture

```
Author writes a JSON file
        ↓
JSON describes steps, each step has operations
        ↓
Engine validates the JSON, then executes operations one by one
        ↓
Each operation triggers an animation on the canvas
        ↓
While the animation plays, the code panel highlights the relevant line
and the teaching panel shows the explanation
        ↓
User controls playback — forward, back, fast, slow
```

The JSON file is the single source of truth. The engine is a dumb executor. The UI is a display layer. These three things never mix.

---

## Features

### Core playback
- Step forward and backward through an algorithm one step at a time
- Auto-play mode that advances automatically at a chosen speed
- Speed control at 0.5x, 1x, and 2x
- Restart from the beginning at any point
- Keyboard shortcuts for all controls

### Canvas
- Nodes render with correct widths based on their value length
- Arrows between nodes animate when links change
- Arrows automatically curve underneath when a link goes backward
- Null terminator symbol appears on tail nodes
- Pointers (curr, prev, head, etc.) float above nodes with labeled arrows
- Multiple pointers on the same node stack vertically without overlapping
- Floating labels appear near nodes to annotate key moments
- Variable panel in the corner shows algorithm variables like `count = 3` or `found = false`
- Region boxes can be drawn around groups of nodes to highlight subsets
- Canvas pans smoothly when the active node is off-screen

### Teaching panel
- Each step shows a plain-English WHAT — what just happened
- Each step shows WHY — the reason this operation is necessary
- Each step shows a WARNING if this is a commonly misunderstood moment
- Each step shows the time complexity of the operation

### Code panel
- Full algorithm code displayed at all times
- The line or lines relevant to the current step are highlighted
- Language is specified per algorithm — Java, Python, or JavaScript

### Timeline
- Progress bar showing position in the algorithm
- Step pills — one per step — that show step titles and are clickable to jump

### Algorithm library
- Traversal, Search, Reverse
- Insert at head, tail, position
- Delete at head, tail, position
- Find middle node, cycle detection, merge sorted lists

---

## Architecture — three layers

**Data layer** — JSON files. One file per algorithm. Describes the initial list state, the code, and every step with its operations, teaching content, and code line references. The engine reads this and nothing else.

**Engine layer** — reads JSON, validates it, executes operations, manages animation timelines, handles playback state, manages undo via snapshots, handles errors via transactions. The engine has no knowledge of what an algorithm is doing — it only knows how to run primitives.

**UI layer** — renders the canvas, code panel, teaching panel, timeline, and controls. Reads from the store which the engine writes to. Has no animation logic of its own.

---

## Key elements

### Primitives

These are the only things the engine knows how to do. Every algorithm animation is built from combinations of these.

**Node primitives**
- Create a node with a value
- Delete a node
- Move a node to a position in the row
- Swap two nodes
- Update the value inside a node
- Clone a node
- Shake a node (signals error or not-found)
- Pulse a node (draws attention briefly)

**Background primitives**
- Change a node's background color
- Clear a single node's background
- Clear all node backgrounds at once

**Link primitives**
- Create a link from one node to another
- Delete a link
- Morph an existing link to a new target

**Pointer primitives**
- Create a named pointer above a node
- Move a pointer to a different node
- Delete a pointer

**Annotation primitives**
- Show a floating label near a node that fades after a duration
- Pin a permanent label below a node
- Remove a pinned label
- Show a variable in the variable panel
- Update a variable value
- Hide a variable

**Canvas primitives**
- Pan the viewport to center a specific node
- Draw a labeled region box around a group of nodes
- Remove a region box
- Force a layout reflow

**Control primitives**
- Wait for a number of milliseconds
- Batch — run multiple operations simultaneously instead of sequentially

---

### BATCH — the composition primitive

By default operations inside a step run one after the other. BATCH makes a group of operations run at exactly the same time. This is how you move a pointer and change a background simultaneously so the animation feels like one unified action instead of two mechanical steps. BATCH can be nested up to two levels deep.

---

### Layout engine

The layout engine computes where every node sits on the canvas. It has four responsibilities.

**Measure** — each node's width is calculated from its value's character length, not hardcoded. A node holding `10` is narrower than one holding `HashMap<K,V>`.

**Gap** — the space between nodes adapts to how many nodes exist and how wide the viewport is. When the list is short the gap is comfortable. When the list is long the gap compresses to a minimum before virtualization takes over.

**Virtualize** — for long lists, the engine tracks a virtual layout of every node's position but only renders a window of visible nodes. Nodes outside the window are parked off-screen but not destroyed, so links and pointers referencing them stay valid. PAN_TO shifts the window.

**Reflow** — after any structural change (create, delete, move, swap) the engine recomputes all positions, diffs against previous positions, and animates only the nodes that moved. All moved nodes slide simultaneously.

---

### Arrow system

Arrows connect nodes. They are SVG paths. The shape of the path depends entirely on the relative positions of the two nodes — there is no direction concept in the API. The path builder infers shape from geometry.

- Node to the right → straight arrow going right
- Node to the left → arrow curves underneath both nodes
- Node to itself → small teardrop loop above the node
- No target → short stub ending in a null terminator symbol

When a link changes, the old path morphs into the new path via animation. All four path types are built with the same number of anchor points so the morph is always smooth.

---

### Playback state machine

The player is a formal state machine, not a collection of boolean flags. This prevents bugs like double-play, clicking Next during a transition, or Previous firing while an animation is running.

States: Idle, Ready, Stepping, Paused, Complete.

While in Stepping, all inputs except Pause are silently ignored. This is intentional and enforced by the machine, not by manual if-checks scattered around the code.

---

### Snapshot system

Before every step executes, the engine saves a complete snapshot of the canvas state and layout. When the user hits Previous, the engine pops the last snapshot, restores state, and plays the previous step's animation in reverse. Because state is restored before the reverse animation plays, the visuals and data stay in sync throughout.

---

### Transaction system

Every operation executes inside a transaction. If any operation in a batch fails — a DOM ref is missing, an invalid node ID is referenced, anything — the transaction rolls back. The canvas is restored to the snapshot taken before the batch began. The failure is logged with the exact operation ID that caused it. The user sees an error indicator rather than a broken canvas.

---

### Operation IDs

Every operation in every JSON file has a unique deterministic ID. The format is `algorithmName_stepIndex_operationIndex`. Sub-operations inside a BATCH append `_b` and their index.

IDs serve four purposes. Debugging — the error log names the exact operation that failed. Replay — re-execute from any operation to reproduce a bug. Tracing — an analytics layer can log the start time, end time, and success of every operation. Timeline seeking — future deep-linking to a specific operation within a step.

A CLI tool called `stamp-ops` auto-generates IDs across an entire JSON file so authors do not write them by hand.

---

### Schema validator

The validator runs before the first step executes. It checks that all required fields exist, that code line references are in bounds, that every node ID referenced in operations exists in the initial state, that operation IDs are unique and correctly formatted, and that BATCH nesting does not exceed two levels. It throws descriptive errors that name the exact field or operation that failed — not generic "invalid JSON" messages.

---

## Tools and technologies

**React** — UI components. No animation logic inside components. Components only read from the store and render.

**GSAP** — all animations. Every primitive produces a GSAP tween or sub-timeline. The playback engine assembles these into a step timeline. Timelines are always scoped — never touching the global GSAP timeline. Speed control applies to the current step timeline only.

**SVG** — arrow rendering. Paths are built by the path builder and updated by GSAP tweening the SVG `d` attribute for morphs.

**XState or a hand-written enum machine** — playback state. One machine, one transition table, no scattered boolean flags.

**TypeScript** — everything is typed. No `any`. The operation union type is the contract between JSON authors and the engine.

**Zustand** — the store. Holds current canvas state, current layout, current step index, current timeline reference, snapshot stack.

**A small CLI script** — `stamp-ops` for auto-assigning operation IDs to JSON files.

---

## Color palette

Nine semantic colors for node backgrounds. All centralized in one constants file. No hex values anywhere else in the codebase.

| Name | Usage |
|---|---|
| Default | Untouched node |
| Blue | Current pointer is here |
| Gray | Previous pointer is here |
| Green | Next pointer or saved reference |
| Red | Link was just changed or broken |
| Purple | Visited during traversal |
| Amber | Head of the list |
| Teal | Found during search |
| Yellow | Two nodes being compared |

---

## JSON file structure

Each algorithm file has five sections.

**Metadata** — title, language, default speed.

**Code** — the algorithm code as an array of strings, one string per line.

**Initial nodes** — the starting list. Each node has an ID and a value.

**Initial links** — the starting connections. Each link names a from-node and a to-node.

**Steps** — the sequence of steps. Each step has a title, the code line numbers to highlight, a teaching block with what/why/warning/complexity, and the array of operations to execute.

---

## What the engine does not know

The engine does not know what a linked list is. It does not know what reversal means. It does not know what traversal means. It only knows how to move things on a canvas in response to operation objects. This is the core design principle. It is what makes the system extensible without ever modifying the engine.

---

## Algorithms at launch

Phase one — Traversal, Search, Reverse, Insert Head, Insert Tail, Delete Head, Delete Tail.

Phase two — Insert at Position, Delete at Position, Find Middle, Cycle Detection, Merge Sorted Lists.

Phase three — same engine, new data structures. Doubly linked list, stack, queue. The engine requires zero changes. Only new JSON files and new SVG components for the double-arrow head.

---

## Build sequence

Start with the parts that have no dependencies and build outward.

First — schema validator and JSON loading. Nothing else works without this.

Second — layout engine. Static nodes at correct positions with correct widths.

Third — path builder. Static arrows between nodes. Test all four path shapes.

Fourth — wire GSAP to the first primitive. CHANGE_BG is the right choice — simplest possible animation, confirms the pipeline end to end.

Fifth — pointer primitives. CREATE_PTR, MOVE_PTR, DELETE_PTR with collision stacking.

Sixth — playback machine. Play and Next only. Add Previous once snapshots are working.

Seventh — transaction manager. Write a test that simulates a crash and confirms the canvas is clean after rollback.

Eighth — BATCH with parallel timing.

Ninth — link primitives with morphing arrows.

Tenth — structural primitives with reflow. CREATE_NODE, DELETE_NODE, SWAP_NODES.

Eleventh — annotation and variable panel primitives.

Twelfth — canvas primitives. PAN_TO and DRAW_REGION.

Thirteenth — UI panels. Code highlighting, teaching panel, timeline pills, controls.

Last — author all algorithm JSON files using stamp-ops.