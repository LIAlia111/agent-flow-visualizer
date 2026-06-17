# Architecture Deep Dive

A technical walkthrough of how Agent Flow Visualizer works under the hood.

## The Core Insight: Two Rendering Layers

The biggest design decision is using **two distinct rendering layers** on top of each other:

```
┌─────────────────────────────────┐
│  Canvas 2D  (particles)         │  ← position: absolute, pointer-events: none
├─────────────────────────────────┤
│  SVG        (nodes + edges)     │  ← receives all mouse/touch events
└─────────────────────────────────┘
```

Why this split?

**SVG** has native hit-testing — `element.contains(event.target)` works across complex paths. Dragging nodes, clicking ports, selecting edges all happen through SVG's DOM. Every node and edge is a real DOM element you can query.

**Canvas** has no DOM — it's a pixel buffer. This makes it terrible for interaction but excellent for high-frequency animation. Particles update position every frame at 60fps, and Canvas can redraw thousands of them per frame without touching the DOM at all.

Trying to do particles in SVG (animating hundreds of `<circle>` elements) would thrash the DOM. Trying to do node interaction in Canvas (manual hit-test every frame) would be brittle. Split the concerns.

## State Model

All canvas state lives in one flat `state` object:

```javascript
const state = {
  nodes: [],           // { id, type, x, y, w, h, label, ... }
  edges: [],           // { id, fromNode, fromPort, toNode, toPort }
  selected: null,      // { kind: 'node'|'edge', id }
  drawingEdge: null,   // { fromNode, fromPort, x2, y2 } while dragging
  draggingNode: null,  // { id, offsetX, offsetY }
  simRunning: false,
  simPaused: false,
  simSpeed: 1.0,
  particles: [],       // active particle objects
  animFrameId: null,
};
```

No reactive framework, no event bus, no store. When state changes, call `render()`. This works because the state surface is small and the render is cheap (SVG update is fast for ~20 nodes).

## Rendering Pipeline

`render()` is called on every state mutation. It:

1. Clears the SVG children (edges first, then nodes on top)
2. Calls `renderEdge(edge)` for each edge → returns a `<path>` element
3. Calls `renderNode(node)` for each node → returns a `<g>` element
4. If `drawingEdge` is set, renders a ghost edge from port to cursor
5. Applies selection highlight to the selected element

### Bézier Edge Routing

```javascript
function edgePath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}
```

Control points offset horizontally by half the horizontal distance. This makes edges curve naturally whether nodes are left-to-right, right-to-left, or stacked vertically, without any layout algorithm.

## Simulation Engine

When the user hits Run:

### Step 1: Topological Sort

```javascript
function buildTopoOrder(nodes, edges) {
  const inDegree = {};
  const graph = {};
  // ... Kahn's algorithm (BFS-based topo sort)
  // Returns ordered array of node IDs, or null if cycle detected
}
```

Kahn's algorithm: repeatedly pull nodes with zero in-degree, add them to the order, decrement their successors. If any nodes remain at the end, there's a cycle.

### Step 2: Async Execution Loop

```javascript
async function runSimulation() {
  const order = buildTopoOrder(state.nodes, state.edges);
  for (const nodeId of order) {
    if (state.simPaused) await waitForResume();
    await activateNode(nodeId);
  }
}
```

`activateNode(id)`:
1. Finds all incoming edges → highlights them, spawns particles
2. Waits `getExecTime(node.type) / state.simSpeed` milliseconds
3. Marks node as completed (changes fill color)
4. Writes to execution log

### Step 3: Condition Branch Routing

Condition nodes have two output ports: `yes` (top) and `no` (bottom).

```javascript
if (node.type === 'condition') {
  const branch = evaluateBranch(node); // 'yes' or 'no'
  const outEdges = edges.filter(e =>
    e.fromNode === node.id && e.fromPort === branch
  );
  // Only activate the matching branch's edges
}
```

In simulation, only the selected branch fires downstream. The other branch's nodes are skipped.

## Particle System

### Spawning

```javascript
function spawnParticlesOnEdge(edgeEl, count = 12) {
  const totalLen = edgeEl.getTotalLength();
  for (let i = 0; i < count; i++) {
    state.particles.push({
      el: edgeEl,
      t: Math.random() * 0.3,  // stagger start position
      speed: 0.008 + Math.random() * 0.004,
      size: 3 + Math.random() * 2,
      opacity: 0.8 + Math.random() * 0.2,
    });
  }
}
```

Each particle stores a reference to its SVG `<path>` element and a normalized `t` value (0 = start, 1 = end).

### Animation Frame

```javascript
function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  state.particles = state.particles.filter(p => {
    p.t += p.speed;
    if (p.t > 1) return false; // remove when done
    const pt = p.el.getPointAtLength(p.t * p.el.getTotalLength());
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(99, 179, 237, ${p.opacity})`;
    ctx.fill();
    return true;
  });
  if (state.particles.length > 0 || state.simRunning) {
    requestAnimationFrame(animateParticles);
  }
}
```

`SVGPathElement.getPointAtLength(len)` is the key — it converts a linear parameter `t` to an `{x, y}` coordinate along the curved path. This means particles automatically follow any Bézier curve without manual curve math.

## Port Wiring (Drag-to-Connect)

1. `mousedown` on a port → set `state.drawingEdge = { fromNode, fromPort, x2: cursor.x, y2: cursor.y }`
2. `mousemove` → update `drawingEdge.x2/y2`, call `render()` → ghost edge follows cursor
3. `mouseup` on a port → create edge if compatible, clear `drawingEdge`
4. `mouseup` anywhere else → cancel, clear `drawingEdge`

Compatibility check: can't wire output to output, can't create duplicate edges, can't wire a node to itself.

## Why No Build Step

Build tools solve problems that don't exist here:

- **Bundling** — there's only one JS file to begin with
- **Transpilation** — targeting modern browsers only (WebGPU users are on Chrome 113+)
- **Tree-shaking** — no dependencies to shake
- **Hot reload** — just hit browser refresh

The absence of a build step is a feature, not a limitation. Zero config, zero `node_modules`, zero CI pipeline needed. Clone and open.
