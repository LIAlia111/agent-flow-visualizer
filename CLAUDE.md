# agent-flow-visualizer · CLAUDE.md

## 项目定位

Lief（AI工程师）的作品集项目。纯前端 AI Agent 工作流可视化器，展示 AI Agent 工程能力。

- **路径**：`/root/lief-projects/agent-flow-visualizer/`
- **部署**：`lief.liaolief.com/agent-flow`
- **所有者**：Lief（lwdong@proton.me）

## 文件结构

```
agent-flow-visualizer/
├── index.html    — 主入口，布局、SVG画布、节点面板、检视器
├── style.css     — 所有样式（CSS变量驱动，暗色主题）
├── app.js        — 核心逻辑（节点、边、拖拽、模拟引擎、粒子）
├── CLAUDE.md     — 本文件
└── README.md     — 项目说明
```

## 技术选型

- **零依赖**：纯 HTML5 / CSS3 / ES6+ Vanilla JS
- **SVG**：节点和边的渲染层，支持精确的点击和拖拽
- **Canvas 2D**：粒子动画叠加层（独立于 SVG）
- **无构建工具**：直接用 nginx 伺服静态文件

## 核心模块说明

### state 对象（app.js）

全局状态，包含：
- `nodes[]` — 节点数据数组
- `edges[]` — 边数据数组
- `selected` — 当前选中项 `{ kind: 'node'|'edge', id }`
- `drawingEdge` — 正在绘制的边（从out端口拖拽时）
- `simRunning/simPaused` — 模拟状态

### 节点渲染（renderNode）

每个节点是一个 `<g>` SVG group，包含：背景矩形、顶部accent条、图标、标签、端口圆点

### 边渲染（renderEdge）

贝塞尔曲线 `<path>`，有向，带箭头 marker

### 模拟引擎（startSimulation）

1. 拓扑排序确定执行顺序
2. async/await 逐节点延迟执行
3. 每步高亮边 → 高亮节点 → 触发粒子 → 完成
4. 支持 pause/resume/reset

### 粒子系统（spawnParticlesOnEdge / animateParticles）

沿 SVG path 的 `getTotalLength()` / `getPointAtLength()` 流动粒子，叠加在 Canvas 层

## 修改指南

### 新增节点类型

1. `NODE_DEFAULTS` 加一条（颜色、默认标签）
2. palette item HTML 新增一个 `div.palette-item[data-type=xxx]`
3. `renderNode` 的 `iconMap` 加入图标
4. `getExecTime` 加入执行时间
5. `style.css` 加入 `.type-xxx` 颜色变量

### 修改颜色主题

所有颜色在 `style.css :root` 的 CSS 变量中，修改 `--node-*` 系列即可。

### 修改动画速度

`getExecTime()` 控制各类型节点的基础执行时长，会被 `state.simSpeed` 除（slider 控制）。

## 部署

nginx 配置在 `/etc/nginx/sites-enabled/lief-portfolio`，`/agent-flow` location 指向此目录。

```nginx
location /agent-flow {
    alias /root/lief-projects/agent-flow-visualizer/;
    index index.html;
    try_files $uri $uri/ /agent-flow/index.html;
    add_header Cache-Control "no-cache";
}
```

更新部署：直接编辑文件，nginx 无需重载（静态文件）。

## 红线

- 不引入任何 JS 框架或 npm 包
- 不出工作棚围栏（不动 /root/.claude* 等 JARVIS 本体）
- 不修改其他 nginx location（只新增 /agent-flow）
