# Contributing to Agent Flow Visualizer

Pull requests welcome. Here's what to know before you start.

## Ground Rules

- **Zero dependencies** — The whole point of this project is that it ships as three files. Do not add npm packages, bundlers, or build steps. If your feature requires a library, rethink the approach.
- **No frameworks** — Vanilla JS only. No React, Vue, Svelte, etc.
- **SVG for structure, Canvas for animation** — Don't mix these layers. Nodes and edges live in SVG. Particles live in Canvas.

## Setup

```bash
git clone https://github.com/LIAlia111/agent-flow-visualizer.git
cd agent-flow-visualizer
npx serve .
# open http://localhost:3000
```

No install step. No build step. Open in browser.

## How the Code Is Organized

Everything is in `app.js` (~900 lines). The main sections:

| Section | What's there |
|---------|-------------|
| `CONFIG` / `NODE_DEFAULTS` | Colors, sizes, node type definitions |
| `state` | Single source of truth for the canvas |
| `render*` functions | SVG generation (nodes, edges, ports) |
| `startSimulation` | Topological sort + async execution loop |
| `spawnParticlesOnEdge` / `animateParticles` | Canvas particle system |
| Event listeners | Drag-and-drop, port wiring, inspector updates |

## Adding a Node Type

1. Add to `NODE_DEFAULTS` with `label`, `subtitle`, `color`, `bg`
2. Add a `div.palette-item[data-type=yourtype]` in `index.html`
3. Add an SVG icon path to `iconMap` in `renderNode()`
4. Add execution delay to `getExecTime()`
5. Add `.type-yourtype` color variable to `:root` in `style.css`

## Reporting Bugs

Use GitHub Issues. Include:
- Browser and version (WebGPU/Canvas behavior varies)
- Steps to reproduce
- Expected vs actual behavior

## Feature Requests

Open an issue with `[Feature]` prefix. Describe the use case, not just the feature. Features that break the zero-dependency constraint will be closed.
