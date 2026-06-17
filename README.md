# AI Agent Flow Visualizer

> An interactive canvas for designing, wiring, and simulating AI Agent workflows — zero dependencies, pure browser.

**[🚀 Live Demo →](https://lief.liaolief.com/agent-flow)**

![WebTech](https://img.shields.io/badge/WebTech-SVG%20%2B%20Canvas-blue?style=flat-square)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)

---

## What It Does

Most AI Agent frameworks give you code. This gives you **a whiteboard**.

Drop nodes onto a canvas, wire them together, hit Run — and watch your Agent pipeline execute in real time, edge by edge, with flowing particle effects tracing every data hop.

Designed to answer one question fast: **"Does this Agent architecture actually make sense before I write a single line of LangGraph?"**

---

## Features

### 5 Agent Primitives

| Node | What It Represents |
|------|-------------------|
| **Input** | Entry point — user query, trigger, or webhook |
| **LLM** | A language model call — GPT-4o, Claude, Gemini, Llama, any model |
| **Tool** | External API or function call — web search, code exec, calculator |
| **Condition** | Branch logic — `Yes` / `No` outputs for routing and retry loops |
| **Output** | Final result renderer or downstream sink |

### Canvas

- **Drag from palette → canvas** to place any node type
- **Drag between ports** to wire directed edges with auto-curved Bézier paths
- **Click any node** to open the inspector — edit label, model, tool name, condition expression, or notes
- **Click any edge** → `Delete` to remove
- Works on desktop and touch — no scroll drift, no zoom issues

### Simulation Engine

- **Topological sort** determines correct execution order before the run starts
- **Async step-by-step execution** — each node activates in sequence, not all at once
- **Particle effects** flow along edges as data moves through the pipeline
- **Condition node branching** — only the matching `Yes` or `No` branch fires downstream
- **Pause / Resume** mid-run without losing state
- **Speed slider** 0.5× → 3× — slow for explanation, fast for demo
- **Execution Log** — timestamped trace of every node activation with latency

---

## Zero Dependencies

The entire visualizer ships as three files: `index.html` + `style.css` + `app.js`.

- **SVG** for node and edge rendering — precise hit-testing, clean scaling, crisp at any resolution
- **Canvas 2D** for particle animation layer — composited over SVG, `requestAnimationFrame`-driven
- **ES6 Vanilla JS** — no build step, no `node_modules`, no bundler, no config hell

Open `index.html` in Chrome. That's it.

---

## Getting Started

```bash
git clone https://github.com/LIAlia111/agent-flow-visualizer.git
cd agent-flow-visualizer
open index.html          # macOS
# double-click index.html on Windows/Linux
```

Or serve with live reload:

```bash
npx serve .
# → http://localhost:3000
```

---

## Architecture

### State Model

All canvas state lives in a single `state` object — nodes array, edges array, current selection, in-progress edge being drawn, and simulation status. No reactive framework needed when the state surface is this contained.

### Edge Rendering

Edges are cubic Bézier `<path>` elements with `marker-end` arrowheads. Control points are computed from port positions so edges always curve naturally regardless of layout.

### Simulation Loop

```
buildTopologicalOrder(nodes, edges)
  → for each node in order:
      activate incoming edges (highlight + spawn particles)
      await execDelay(nodeType, simSpeed)
      mark node completed → write to execution log
      condition node: evaluate branch → activate only matching output
```

### Particle System

Particles ride `SVGPathElement.getPointAtLength(t * totalLength)` each frame. Rendered on a `<canvas>` layered over the SVG — keeps DOM clean and lets the particle loop run independently of SVG rendering.

### Port System

- Every node: one **input port** (left)
- Standard nodes: one **output port** (right)
- Condition nodes: **Yes port** (top-right, green) + **No port** (bottom-right, red)

---

## Extending

### Add a Node Type

1. `NODE_DEFAULTS` in `app.js` — add entry with `label`, `subtitle`, `color`, `bg`
2. `index.html` — add `<div class="palette-item" data-type="yourtype">`
3. `renderNode()` `iconMap` — add SVG icon path
4. `getExecTime()` — add execution delay for the new type
5. `style.css` — add `.type-yourtype` color variable

### Retheme

All colors are CSS custom properties in `:root`. Swap `--node-*` and `--bg-*` to retheme in under 2 minutes.

---

## Use Cases

- Whiteboard an Agent pipeline **before** writing LangChain/LangGraph code
- Interview prep — sketch a multi-agent architecture live in a technical discussion
- Team communication — share a URL instead of a wall of Python when explaining a system
- Portfolio demo — show how you think about Agent design, not just that you can prompt

---

## Examples

Ready-to-study workflow blueprints in `examples/`:

| File | Pipeline |
|------|----------|
| `rag-pipeline.json` | RAG Q&A with query rewriting, relevance filtering, and fallback |
| `react-agent.json` | ReAct (Reasoning + Acting) loop with tool dispatch |
| `multi-agent-research.json` | Parallel research agents with critic + synthesis |

---

## Docs

- [`docs/architecture.md`](docs/architecture.md) — deep dive: rendering layers, state model, Bézier routing, simulation engine, particle system

---

## About

Built by **[Lief](https://lief.liaolief.com)** — AI Agent Engineer.

Lief builds production AI Agent systems: a self-evolving personal AI (JARVIS), multi-agent orchestration pipelines, and AI-native SaaS products. This visualizer came out of the mental model he uses to design Agent graphs before they become code.

- Portfolio: [lief.liaolief.com](https://lief.liaolief.com)
- GitHub: [@LIAlia111](https://github.com/LIAlia111)
- npm: [claude-familiar](https://www.npmjs.com/package/claude-familiar)

---

## License

MIT — use it, fork it, build on it.
