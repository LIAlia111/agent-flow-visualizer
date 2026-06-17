/* ═══════════════════════════════════════════════════════════════════════════
   AI Agent Flow Visualizer — Core Application
   Pure vanilla JS / SVG, zero dependencies
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ── Constants ────────────────────────────────────────────────────────────────

const NODE_W = 160;
const NODE_H = 72;
const PORT_R = 5;

const NODE_DEFAULTS = {
  input:     { label: 'User Input',    subtitle: 'Entry point',      color: '#58a6ff', bg: '#1a2e4a' },
  llm:       { label: 'LLM Call',      subtitle: 'GPT-4o',           color: '#c084fc', bg: '#2a1a4a' },
  tool:      { label: 'Tool',          subtitle: 'web_search',       color: '#4ade80', bg: '#1a3a22' },
  condition: { label: 'Condition',     subtitle: 'score > 0.8',      color: '#fbbf24', bg: '#3a2e10' },
  output:    { label: 'Final Output',  subtitle: 'Result',           color: '#f87171', bg: '#3a1a1a' },
};

// ── State ────────────────────────────────────────────────────────────────────

const state = {
  nodes: [],          // { id, type, x, y, label, subtitle, props }
  edges: [],          // { id, from, fromPort, to, toPort, condBranch }
  selected: null,     // { kind:'node'|'edge', id }
  nextId: 1,

  // Drawing edge
  drawingEdge: null,  // { fromNodeId, fromPort, x1, y1 }

  // Dragging node
  draggingNode: null, // { id, offsetX, offsetY }

  // Simulation
  simRunning: false,
  simPaused: false,
  simSpeed: 1,
  simTimeout: null,
};

// ── DOM Refs ─────────────────────────────────────────────────────────────────

const svg          = document.getElementById('canvas');
const edgesGroup   = document.getElementById('edgesGroup');
const nodesGroup   = document.getElementById('nodesGroup');
const tempEdgeEl   = document.getElementById('tempEdge');
const canvasHint   = document.getElementById('canvasHint');
const particleCanvas = document.getElementById('particleCanvas');
const pctx         = particleCanvas.getContext('2d');
const inspector    = document.getElementById('inspector');
const inspEmpty    = document.getElementById('inspectorEmpty');
const inspForm     = document.getElementById('inspectorForm');

const btnRun    = document.getElementById('btnRun');
const btnPause  = document.getElementById('btnPause');
const btnReset  = document.getElementById('btnReset');
const btnClear  = document.getElementById('btnClear');
const btnApply  = document.getElementById('btnApply');
const btnDelete = document.getElementById('btnDelete');
const speedSlider = document.getElementById('speedSlider');
const logBody   = document.getElementById('logBody');
const logToggle = document.getElementById('logToggle');

// Inspector fields
const propLabel    = document.getElementById('propLabel');
const propModel    = document.getElementById('propModel');
const propTool     = document.getElementById('propTool');
const propCond     = document.getElementById('propCond');
const propNote     = document.getElementById('propNote');
const propModelGroup = document.getElementById('propModelGroup');
const propToolGroup  = document.getElementById('propToolGroup');
const propCondGroup  = document.getElementById('propCondGroup');
const propNoteGroup  = document.getElementById('propNoteGroup');

// ── Particle System ──────────────────────────────────────────────────────────

const particles = [];

function resizeParticleCanvas() {
  const wrap = particleCanvas.parentElement;
  particleCanvas.width  = wrap.clientWidth;
  particleCanvas.height = wrap.clientHeight;
}

function spawnParticlesOnEdge(edgeId) {
  const edgeEl = svg.querySelector(`[data-edge-id="${edgeId}"]`);
  if (!edgeEl) return;
  const totalLen = edgeEl.getTotalLength();
  for (let i = 0; i < 6; i++) {
    particles.push({
      edgeId,
      edgeEl,
      progress: i * (1 / 6),
      speed: (0.004 + Math.random() * 0.003) * state.simSpeed,
      life: 1,
      size: 3 + Math.random() * 2,
      color: '#4ade80',
    });
  }
}

let particleRafId = null;

function animateParticles() {
  const wrap  = particleCanvas.parentElement;
  const rect  = wrap.getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();
  const offX  = svgRect.left - rect.left;
  const offY  = svgRect.top  - rect.top;

  pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.progress += p.speed;

    if (p.progress >= 1) {
      p.life -= 0.15;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.progress = 1;
    }

    const len = p.edgeEl.getTotalLength();
    const pt  = p.edgeEl.getPointAtLength(p.progress * len);

    const alpha = Math.min(1, p.life) * (1 - Math.max(0, p.progress - 0.85) / 0.15);
    pctx.save();
    pctx.globalAlpha = alpha;
    pctx.fillStyle = p.color;
    pctx.shadowColor = p.color;
    pctx.shadowBlur = 8;
    pctx.beginPath();
    pctx.arc(pt.x + offX, pt.y + offY, p.size, 0, Math.PI * 2);
    pctx.fill();
    pctx.restore();
  }

  particleRafId = requestAnimationFrame(animateParticles);
}

// ── Logging ──────────────────────────────────────────────────────────────────

function log(msg, level = 'info') {
  const now = new Date();
  const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">${t}</span><span class="log-level-${level}">${msg}</span>`;
  logBody.appendChild(entry);
  logBody.scrollTop = logBody.scrollHeight;
}

// ── ID generation ────────────────────────────────────────────────────────────

function newId(prefix) { return `${prefix}_${state.nextId++}`; }

// ── SVG helpers ──────────────────────────────────────────────────────────────

function svgPt(x, y) {
  const pt = svg.createSVGPoint();
  pt.x = x; pt.y = y;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function edgePath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  const cx = dx * 0.55;
  return `M${x1},${y1} C${x1+cx},${y1} ${x2-cx},${y2} ${x2},${y2}`;
}

// ── Port positions ────────────────────────────────────────────────────────────

function portPos(nodeId, port) {
  const n = getNode(nodeId);
  if (!n) return { x: 0, y: 0 };
  if (port === 'in')        return { x: n.x,            y: n.y + NODE_H / 2 };
  if (port === 'out')       return { x: n.x + NODE_W,   y: n.y + NODE_H / 2 };
  if (port === 'out-true')  return { x: n.x + NODE_W,   y: n.y + NODE_H * 0.35 };
  if (port === 'out-false') return { x: n.x + NODE_W,   y: n.y + NODE_H * 0.65 };
  return { x: n.x + NODE_W / 2, y: n.y };
}

// ── Node lookup ───────────────────────────────────────────────────────────────

function getNode(id)  { return state.nodes.find(n => n.id === id); }
function getEdge(id)  { return state.edges.find(e => e.id === id); }

// ── Render a single node ─────────────────────────────────────────────────────

function renderNode(n) {
  const def = NODE_DEFAULTS[n.type];
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', `node-group type-${n.type}`);
  g.setAttribute('data-node-id', n.id);
  g.setAttribute('tabindex', '0');

  // Shadow rect (glow layer)
  const glow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  glow.setAttribute('x', n.x - 2); glow.setAttribute('y', n.y - 2);
  glow.setAttribute('width', NODE_W + 4); glow.setAttribute('height', NODE_H + 4);
  glow.setAttribute('rx', 12); glow.setAttribute('fill', 'none');
  glow.setAttribute('stroke', def.color); glow.setAttribute('stroke-width', '0');
  glow.setAttribute('class', 'node-glow');

  // Body rect
  const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  body.setAttribute('x', n.x); body.setAttribute('y', n.y);
  body.setAttribute('width', NODE_W); body.setAttribute('height', NODE_H);
  body.setAttribute('rx', 10);
  body.setAttribute('fill', n.bg || def.bg);
  body.setAttribute('stroke', def.color);
  body.setAttribute('stroke-width', '1.5');
  body.setAttribute('class', 'node-body');

  // Top accent bar
  const accent = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  accent.setAttribute('x', n.x); accent.setAttribute('y', n.y);
  accent.setAttribute('width', NODE_W); accent.setAttribute('height', 3);
  accent.setAttribute('rx', 10);
  accent.setAttribute('fill', def.color);

  // Icon background
  const iconBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  iconBg.setAttribute('x', n.x + 10); iconBg.setAttribute('y', n.y + 10);
  iconBg.setAttribute('width', 28); iconBg.setAttribute('height', 28);
  iconBg.setAttribute('rx', 6);
  iconBg.setAttribute('fill', def.color + '25');

  // Type icon (text fallback)
  const iconMap = { input: '→', llm: '🧠', tool: '🔧', condition: '⚡', output: '✓' };
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  icon.setAttribute('x', n.x + 24); icon.setAttribute('y', n.y + 29);
  icon.setAttribute('text-anchor', 'middle'); icon.setAttribute('dominant-baseline', 'middle');
  icon.setAttribute('font-size', '13'); icon.setAttribute('fill', def.color);
  icon.textContent = iconMap[n.type] || '?';

  // Label
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', n.x + 46); label.setAttribute('y', n.y + 22);
  label.setAttribute('class', 'node-title');
  label.setAttribute('dominant-baseline', 'middle');
  const maxChars = 14;
  label.textContent = (n.label || def.label).length > maxChars
    ? (n.label || def.label).slice(0, maxChars) + '…'
    : (n.label || def.label);

  // Subtitle
  const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  sub.setAttribute('x', n.x + 46); sub.setAttribute('y', n.y + 38);
  sub.setAttribute('class', 'node-subtitle');
  sub.setAttribute('dominant-baseline', 'middle');
  const subText = n.subtitle || def.subtitle;
  sub.textContent = subText.length > 18 ? subText.slice(0, 18) + '…' : subText;

  // Type badge
  const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  badge.setAttribute('x', n.x + 46); badge.setAttribute('y', n.y + 55);
  badge.setAttribute('font-size', '9');
  badge.setAttribute('fill', def.color);
  badge.setAttribute('font-weight', '700');
  badge.setAttribute('text-transform', 'uppercase');
  badge.setAttribute('opacity', '0.8');
  badge.textContent = n.type.toUpperCase();

  // IN port
  const portIn = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  portIn.setAttribute('cx', n.x); portIn.setAttribute('cy', n.y + NODE_H / 2);
  portIn.setAttribute('r', PORT_R);
  portIn.setAttribute('class', 'port port-in');
  portIn.setAttribute('data-node', n.id); portIn.setAttribute('data-port', 'in');

  g.appendChild(glow); g.appendChild(body); g.appendChild(accent);
  g.appendChild(iconBg); g.appendChild(icon);
  g.appendChild(label); g.appendChild(sub); g.appendChild(badge);
  g.appendChild(portIn);

  // Output ports
  if (n.type === 'condition') {
    ['out-true', 'out-false'].forEach(port => {
      const pc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      const py = port === 'out-true' ? n.y + NODE_H * 0.35 : n.y + NODE_H * 0.65;
      pc.setAttribute('cx', n.x + NODE_W); pc.setAttribute('cy', py);
      pc.setAttribute('r', PORT_R);
      pc.setAttribute('class', 'port port-out');
      pc.setAttribute('data-node', n.id); pc.setAttribute('data-port', port);

      // Label Y/N
      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      pl.setAttribute('x', n.x + NODE_W + 9); pl.setAttribute('y', py + 1);
      pl.setAttribute('font-size', '9'); pl.setAttribute('fill', port === 'out-true' ? '#4ade80' : '#f87171');
      pl.setAttribute('dominant-baseline', 'middle');
      pl.textContent = port === 'out-true' ? 'Y' : 'N';
      g.appendChild(pl);
      g.appendChild(pc);
    });
  } else {
    const portOut = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    portOut.setAttribute('cx', n.x + NODE_W); portOut.setAttribute('cy', n.y + NODE_H / 2);
    portOut.setAttribute('r', PORT_R);
    portOut.setAttribute('class', 'port port-out');
    portOut.setAttribute('data-node', n.id); portOut.setAttribute('data-port', 'out');
    g.appendChild(portOut);
  }

  // Events
  g.addEventListener('mousedown', onNodeMouseDown);
  g.querySelector('.port-in') && g.querySelectorAll('.port-in').forEach(p => {
    p.addEventListener('mousedown', onPortMouseDown);
  });
  g.querySelectorAll('.port-out').forEach(p => {
    p.addEventListener('mousedown', onPortMouseDown);
  });
  g.addEventListener('click', (e) => {
    if (state.drawingEdge) return;
    e.stopPropagation();
    selectItem('node', n.id);
  });

  g.addEventListener('touchstart', onNodeTouchStart, { passive: false });

  nodesGroup.appendChild(g);
  return g;
}

// ── Render a single edge ──────────────────────────────────────────────────────

function renderEdge(e) {
  const from = portPos(e.from, e.fromPort);
  const to   = portPos(e.to,   e.toPort);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', edgePath(from.x, from.y, to.x, to.y));
  path.setAttribute('class', `edge ${e.condBranch ? 'edge-cond-' + e.condBranch : ''}`);
  path.setAttribute('data-edge-id', e.id);
  path.addEventListener('click', (ev) => {
    ev.stopPropagation();
    selectItem('edge', e.id);
  });
  edgesGroup.appendChild(path);
  return path;
}

// ── Full redraw ───────────────────────────────────────────────────────────────

function redraw() {
  edgesGroup.innerHTML = '';
  nodesGroup.innerHTML = '';
  state.edges.forEach(renderEdge);
  state.nodes.forEach(renderNode);
  applySelection();
  canvasHint.style.display = state.nodes.length ? 'none' : '';
}

// ── Selection ─────────────────────────────────────────────────────────────────

function selectItem(kind, id) {
  state.selected = { kind, id };
  applySelection();
  updateInspector();
}

function deselectAll() {
  state.selected = null;
  applySelection();
  updateInspector();
  closeMobileOnDeselect();
}

function applySelection() {
  svg.querySelectorAll('.node-group').forEach(g => g.classList.remove('selected'));
  svg.querySelectorAll('.edge').forEach(e => e.classList.remove('selected'));
  if (!state.selected) return;
  if (state.selected.kind === 'node') {
    const g = svg.querySelector(`[data-node-id="${state.selected.id}"]`);
    if (g) g.classList.add('selected');
  } else {
    const e = svg.querySelector(`[data-edge-id="${state.selected.id}"]`);
    if (e) e.classList.add('selected');
  }
}

// ── Inspector ─────────────────────────────────────────────────────────────────

function updateInspector() {
  if (!state.selected || state.selected.kind !== 'node') {
    inspEmpty.classList.remove('hidden');
    inspForm.classList.add('hidden');
    return;
  }
  const n = getNode(state.selected.id);
  if (!n) { inspEmpty.classList.remove('hidden'); inspForm.classList.add('hidden'); return; }

  inspEmpty.classList.add('hidden');
  inspForm.classList.remove('hidden');

  propLabel.value = n.label || NODE_DEFAULTS[n.type].label;
  propNote.value  = n.note || '';

  propModelGroup.classList.add('hidden');
  propToolGroup.classList.add('hidden');
  propCondGroup.classList.add('hidden');

  if (n.type === 'llm') {
    propModelGroup.classList.remove('hidden');
    propModel.value = n.model || 'gpt-4o';
  } else if (n.type === 'tool') {
    propToolGroup.classList.remove('hidden');
    propTool.value = n.toolName || '';
  } else if (n.type === 'condition') {
    propCondGroup.classList.remove('hidden');
    propCond.value = n.condition || '';
  }

  if (isMobile()) showMobileInspector(n);
}

function closeMobileOnDeselect() {
  if (isMobile()) hideMobileInspector();
}

btnApply.addEventListener('click', () => {
  if (!state.selected || state.selected.kind !== 'node') return;
  const n = getNode(state.selected.id);
  if (!n) return;
  n.label = propLabel.value.trim() || NODE_DEFAULTS[n.type].label;
  n.note  = propNote.value.trim();
  if (n.type === 'llm')       { n.model     = propModel.value; n.subtitle = propModel.value; }
  if (n.type === 'tool')      { n.toolName  = propTool.value;  n.subtitle = propTool.value || NODE_DEFAULTS.tool.subtitle; }
  if (n.type === 'condition') { n.condition = propCond.value;  n.subtitle = propCond.value || NODE_DEFAULTS.condition.subtitle; }
  redraw();
});

btnDelete.addEventListener('click', deleteSelected);

function deleteSelected() {
  if (!state.selected) return;
  if (state.selected.kind === 'node') {
    const id = state.selected.id;
    state.nodes = state.nodes.filter(n => n.id !== id);
    state.edges = state.edges.filter(e => e.from !== id && e.to !== id);
  } else {
    const id = state.selected.id;
    state.edges = state.edges.filter(e => e.id !== id);
  }
  state.selected = null;
  redraw();
  updateInspector();
}

document.addEventListener('keydown', e => {
  if ((e.key === 'Delete' || e.key === 'Backspace') &&
      !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    deleteSelected();
  }
});

// ── Palette drag-drop ─────────────────────────────────────────────────────────

document.querySelectorAll('.palette-item').forEach(item => {
  item.addEventListener('dragstart', e => {
    e.dataTransfer.setData('node-type', item.dataset.type);
    e.dataTransfer.effectAllowed = 'copy';
  });

  // Mobile: tap to add node at canvas center
  item.addEventListener('click', () => {
    if (!isMobile()) return;
    const type = item.dataset.type;
    const rect = svg.getBoundingClientRect();
    const pt = svgPt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    addNode(type, pt.x - NODE_W / 2, pt.y - NODE_H / 2);
    fitToView(40);
  });
});

svg.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
svg.addEventListener('drop', e => {
  e.preventDefault();
  const type = e.dataTransfer.getData('node-type');
  if (!type) return;
  const pt = svgPt(e.clientX, e.clientY);
  addNode(type, pt.x - NODE_W / 2, pt.y - NODE_H / 2);
});

function addNode(type, x, y) {
  const def = NODE_DEFAULTS[type];
  const n = {
    id: newId('n'), type, x, y,
    label: def.label, subtitle: def.subtitle, bg: def.bg,
  };
  state.nodes.push(n);
  redraw();
  selectItem('node', n.id);
  log(`Node created: ${type} — "${n.label}"`, 'info');
}

// ── Node drag (move) ─────────────────────────────────────────────────────────

function onNodeMouseDown(e) {
  if (e.target.classList.contains('port')) return;
  if (state.simRunning) return;
  const g = e.currentTarget;
  const nodeId = g.dataset.nodeId;
  const pt = svgPt(e.clientX, e.clientY);
  const n  = getNode(nodeId);
  state.draggingNode = { id: nodeId, offsetX: pt.x - n.x, offsetY: pt.y - n.y };
  e.stopPropagation();
}

svg.addEventListener('mousemove', e => {
  // Move node
  if (state.draggingNode) {
    const pt = svgPt(e.clientX, e.clientY);
    const n  = getNode(state.draggingNode.id);
    if (!n) return;
    n.x = pt.x - state.draggingNode.offsetX;
    n.y = pt.y - state.draggingNode.offsetY;
    // Update node el position
    const g = nodesGroup.querySelector(`[data-node-id="${n.id}"]`);
    if (g) {
      // Rerender this node
      g.remove();
      renderNode(n);
    }
    // Update edges
    updateEdgePositions(n.id);
    return;
  }

  // Draw temp edge
  if (state.drawingEdge) {
    const pt = svgPt(e.clientX, e.clientY);
    const { x1, y1 } = state.drawingEdge;
    tempEdgeEl.setAttribute('d', edgePath(x1, y1, pt.x, pt.y));
    tempEdgeEl.classList.remove('hidden');
  }
});

svg.addEventListener('mouseup', e => {
  if (state.draggingNode) { state.draggingNode = null; return; }
  if (state.drawingEdge) {
    const target = e.target;
    if (target.classList.contains('port-in')) {
      const toNode = target.dataset.node;
      const toPort = target.dataset.port;
      const { fromNodeId, fromPort } = state.drawingEdge;
      if (toNode !== fromNodeId) {
        addEdge(fromNodeId, fromPort, toNode, toPort);
      }
    }
    cancelDrawingEdge();
  }
});

// ── Touch node drag ───────────────────────────────────────────────────────────

function onNodeTouchStart(e) {
  if (state.simRunning) return;
  if (e.touches.length !== 1) return;
  e.preventDefault();
  e.stopPropagation();
  const touch = e.touches[0];
  const g = e.currentTarget;
  const nodeId = g.dataset.nodeId;
  const pt = svgPt(touch.clientX, touch.clientY);
  const n = getNode(nodeId);
  if (!n) return;
  state.draggingNode = { id: nodeId, offsetX: pt.x - n.x, offsetY: pt.y - n.y };
  selectItem('node', nodeId);
}

svg.addEventListener('touchmove', e => {
  if (!state.draggingNode || e.touches.length !== 1) return;
  e.preventDefault();
  const touch = e.touches[0];
  const pt = svgPt(touch.clientX, touch.clientY);
  const n = getNode(state.draggingNode.id);
  if (!n) return;
  n.x = pt.x - state.draggingNode.offsetX;
  n.y = pt.y - state.draggingNode.offsetY;
  const g = nodesGroup.querySelector(`[data-node-id="${n.id}"]`);
  if (g) { g.remove(); renderNode(n); }
  updateEdgePositions(n.id);
}, { passive: false });

svg.addEventListener('touchend', () => {
  if (state.draggingNode) state.draggingNode = null;
});

function updateEdgePositions(nodeId) {
  state.edges.forEach(e => {
    if (e.from !== nodeId && e.to !== nodeId) return;
    const el = svg.querySelector(`[data-edge-id="${e.id}"]`);
    if (!el) return;
    const from = portPos(e.from, e.fromPort);
    const to   = portPos(e.to,   e.toPort);
    el.setAttribute('d', edgePath(from.x, from.y, to.x, to.y));
  });
}

// ── Port drawing ──────────────────────────────────────────────────────────────

function onPortMouseDown(e) {
  if (!e.target.classList.contains('port-out')) return;
  e.stopPropagation();
  const port   = e.target.dataset.port;
  const nodeId = e.target.dataset.node;
  const pos    = portPos(nodeId, port);
  state.drawingEdge = { fromNodeId: nodeId, fromPort: port, x1: pos.x, y1: pos.y };
}

function cancelDrawingEdge() {
  state.drawingEdge = null;
  tempEdgeEl.classList.add('hidden');
  tempEdgeEl.setAttribute('d', '');
}

// ── Add edge ─────────────────────────────────────────────────────────────────

function addEdge(fromId, fromPort, toId, toPort) {
  // Prevent duplicate
  const dup = state.edges.find(e => e.from === fromId && e.fromPort === fromPort && e.to === toId && e.toPort === toPort);
  if (dup) return;

  const condBranch = fromPort === 'out-true' ? 'true' : fromPort === 'out-false' ? 'false' : null;
  const edge = { id: newId('e'), from: fromId, fromPort, to: toId, toPort, condBranch };
  state.edges.push(edge);
  redraw();
  log(`Edge connected: ${getNode(fromId)?.label} → ${getNode(toId)?.label}`, 'info');
}

// ── Canvas click (deselect) ───────────────────────────────────────────────────

svg.addEventListener('click', () => deselectAll());

// ── Topbar controls ───────────────────────────────────────────────────────────

btnRun.addEventListener('click', () => {
  if (!state.simRunning) startSimulation();
  else resumeSimulation();
});

btnPause.addEventListener('click', pauseSimulation);
btnReset.addEventListener('click', resetSimulation);
btnClear.addEventListener('click', () => {
  if (state.simRunning) resetSimulation();
  state.nodes = []; state.edges = [];
  state.selected = null;
  redraw(); updateInspector();
  logBody.innerHTML = '';
  log('Canvas cleared', 'warn');
});

speedSlider.addEventListener('input', () => {
  state.simSpeed = parseFloat(speedSlider.value);
});

logToggle.addEventListener('click', () => {
  const panel = document.getElementById('logPanel');
  const body  = document.getElementById('logBody');
  if (body.style.display === 'none') {
    body.style.display = ''; logToggle.textContent = '▼';
  } else {
    body.style.display = 'none'; logToggle.textContent = '▲';
  }
});

// ── Simulation engine ─────────────────────────────────────────────────────────

let simQueue = [];   // nodes to process in order
let simVisited = new Set();

function resetNodeStates() {
  svg.querySelectorAll('.node-group').forEach(g => {
    g.classList.remove('executing', 'completed', 'error');
  });
  svg.querySelectorAll('.edge').forEach(e => {
    e.classList.remove('active');
  });
  particles.length = 0;
  pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
}

function buildExecutionOrder() {
  // Topological sort (BFS from input/root nodes)
  const inDegree = {};
  state.nodes.forEach(n => { inDegree[n.id] = 0; });
  state.edges.forEach(e => { inDegree[e.to] = (inDegree[e.to] || 0) + 1; });

  const queue = state.nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
  const order = [];
  const visited = new Set(queue);
  while (queue.length) {
    const cur = queue.shift();
    order.push(cur);
    state.edges.filter(e => e.from === cur).forEach(e => {
      inDegree[e.to]--;
      if (inDegree[e.to] === 0 && !visited.has(e.to)) {
        visited.add(e.to);
        queue.push(e.to);
      }
    });
  }
  return order;
}

function delay(ms) {
  return new Promise(res => { state.simTimeout = setTimeout(res, ms); });
}

async function startSimulation() {
  if (state.nodes.length === 0) { log('No nodes on canvas', 'warn'); return; }

  resetNodeStates();
  logBody.innerHTML = '';
  state.simRunning = true;
  state.simPaused  = false;
  simVisited.clear();

  btnRun.classList.add('hidden');
  btnPause.classList.remove('hidden');

  log('▶ Simulation started', 'exec');

  const order = buildExecutionOrder();

  for (const nodeId of order) {
    const n = getNode(nodeId);
    if (!n) continue;

    // Wait while paused
    while (state.simPaused) {
      await delay(100);
      if (!state.simRunning) return;
    }
    if (!state.simRunning) return;

    // Highlight incoming edges first
    const inEdges = state.edges.filter(e => e.to === nodeId);
    inEdges.forEach(e => {
      const el = svg.querySelector(`[data-edge-id="${e.id}"]`);
      if (el) el.classList.add('active');
      spawnParticlesOnEdge(e.id);
    });

    await delay(400 / state.simSpeed);

    // Mark node as executing
    const g = svg.querySelector(`[data-node-id="${nodeId}"]`);
    if (g) g.classList.add('executing');

    const execMsgs = {
      input:     `Processing input: "${n.label}"`,
      llm:       `LLM inference: ${n.subtitle || 'GPT-4o'} (${n.type})`,
      tool:      `Calling tool: ${n.toolName || 'web_search'}`,
      condition: `Evaluating condition: ${n.condition || 'score > 0.8'}`,
      output:    `Rendering output: "${n.label}"`,
    };
    log(execMsgs[n.type] || `Executing ${n.type}`, 'exec');

    const execTime = getExecTime(n.type);
    await delay(execTime / state.simSpeed);

    if (!state.simRunning) return;

    // Mark completed
    if (g) { g.classList.remove('executing'); g.classList.add('completed'); }
    log(`✓ ${n.label} completed`, 'done');

    // Highlight out-edges
    const outEdges = state.edges.filter(e => e.from === nodeId);
    outEdges.forEach(e => {
      const el = svg.querySelector(`[data-edge-id="${e.id}"]`);
      if (el) el.classList.add('active');
      spawnParticlesOnEdge(e.id);
    });

    await delay(200 / state.simSpeed);
  }

  log('✅ Simulation complete', 'done');
  state.simRunning = false;
  btnRun.classList.remove('hidden');
  btnPause.classList.add('hidden');
}

function getExecTime(type) {
  const times = { input: 600, llm: 1600, tool: 1200, condition: 700, output: 500 };
  return times[type] || 800;
}

function pauseSimulation() {
  if (!state.simRunning) return;
  state.simPaused = !state.simPaused;
  btnPause.textContent = state.simPaused ? '▶ Resume' : '⏸ Pause';
  log(state.simPaused ? '⏸ Paused' : '▶ Resumed', 'warn');
}

function resumeSimulation() {
  if (state.simPaused) pauseSimulation();
}

function resetSimulation() {
  state.simRunning = false;
  state.simPaused  = false;
  if (state.simTimeout) { clearTimeout(state.simTimeout); state.simTimeout = null; }
  resetNodeStates();
  btnRun.classList.remove('hidden');
  btnPause.classList.add('hidden');
  btnPause.textContent = '⏸ Pause';
  log('↺ Reset', 'warn');
}

// ── Default example graph ─────────────────────────────────────────────────────

function loadExample() {
  state.nodes = [
    { id: 'n1', type: 'input',     x:  60, y: 160, label: 'User Query',    subtitle: 'Entry point',     bg: '#1a2e4a' },
    { id: 'n2', type: 'llm',       x: 290, y:  80, label: 'Intent Parser', subtitle: 'GPT-4o',          bg: '#2a1a4a', model: 'gpt-4o' },
    { id: 'n3', type: 'condition', x: 290, y: 240, label: 'Needs Search?',  subtitle: 'has_query=true',  bg: '#3a2e10', condition: 'has_query == true' },
    { id: 'n4', type: 'tool',      x: 520, y: 160, label: 'Web Search',     subtitle: 'search_api',      bg: '#1a3a22', toolName: 'search_api' },
    { id: 'n5', type: 'llm',       x: 520, y: 320, label: 'Summarizer',     subtitle: 'Claude 3.5 Sonnet', bg: '#2a1a4a', model: 'claude-3-5-sonnet' },
    { id: 'n6', type: 'output',    x: 750, y: 220, label: 'Final Answer',   subtitle: 'Result',          bg: '#3a1a1a' },
  ];
  state.edges = [
    { id: 'e1', from: 'n1', fromPort: 'out',      to: 'n2', toPort: 'in', condBranch: null },
    { id: 'e2', from: 'n1', fromPort: 'out',      to: 'n3', toPort: 'in', condBranch: null },
    { id: 'e3', from: 'n2', fromPort: 'out',      to: 'n4', toPort: 'in', condBranch: null },
    { id: 'e4', from: 'n3', fromPort: 'out-true', to: 'n4', toPort: 'in', condBranch: 'true' },
    { id: 'e5', from: 'n3', fromPort: 'out-false',to: 'n5', toPort: 'in', condBranch: 'false' },
    { id: 'e6', from: 'n4', fromPort: 'out',      to: 'n5', toPort: 'in', condBranch: null },
    { id: 'e7', from: 'n5', fromPort: 'out',      to: 'n6', toPort: 'in', condBranch: null },
  ];
  state.nextId = 10;
  redraw();
  log('📦 Example workflow loaded — click ▶ Run to simulate', 'info');
}

// ── Init ─────────────────────────────────────────────────────────────────────

function init() {
  resizeParticleCanvas();
  window.addEventListener('resize', () => {
    resizeParticleCanvas();
    if (isMobile() && state.nodes.length) fitToView();
  });
  animateParticles();
  loadExample();
  if (isMobile()) {
    fitToView(24);
    canvasHint.textContent = '↓ Tap a node type below to add it';
  }
  // Mobile inspector close button
  const closeBtn = document.getElementById('mobInspClose');
  if (closeBtn) closeBtn.addEventListener('click', () => { deselectAll(); });
}

// ── Mobile helpers ────────────────────────────────────────────────────────────

function isMobile() { return window.innerWidth <= 768; }

function fitToView(padding) {
  if (!state.nodes.length) return;
  padding = padding || 30;
  const xs = state.nodes.map(n => n.x);
  const ys = state.nodes.map(n => n.y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  const maxX = Math.max(...xs) + NODE_W + padding;
  const maxY = Math.max(...ys) + NODE_H + padding;
  svg.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
}

function showMobileInspector(node) {
  const el = document.getElementById('mobileInspector');
  if (!el) return;
  const badge = document.getElementById('mobInspBadge');
  const nameEl = document.getElementById('mobInspName');
  const grid = document.getElementById('mobInspGrid');
  if (!badge || !nameEl || !grid) return;

  const def = NODE_DEFAULTS[node.type];
  badge.textContent = node.type.toUpperCase();
  badge.style.color = def.color;
  nameEl.textContent = node.label || def.label;

  const rows = [];
  if (node.type === 'llm')       rows.push(['Model',     node.model     || 'GPT-4o']);
  if (node.type === 'tool')      rows.push(['Tool',      node.toolName  || node.subtitle]);
  if (node.type === 'condition') rows.push(['Condition', node.condition || node.subtitle]);
  if (node.note)                 rows.push(['Note',      node.note]);
  if (!rows.length)              rows.push(['Type', def.subtitle || '—']);

  grid.innerHTML = '';
  rows.forEach(([k, v]) => {
    const l = document.createElement('div');
    l.className = 'mob-insp-label'; l.textContent = k;
    const val = document.createElement('div');
    val.className = 'mob-insp-value'; val.textContent = v;
    grid.appendChild(l); grid.appendChild(val);
  });
  el.classList.add('open');
}

function hideMobileInspector() {
  const el = document.getElementById('mobileInspector');
  if (el) el.classList.remove('open');
}

init();
