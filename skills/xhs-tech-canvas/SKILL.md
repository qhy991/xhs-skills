---
name: xhs-tech-canvas
description: Generate high-density tech visual decks (540x720 HTML cards) with flexible slide counts (4-12 slides), 10 modular card archetypes, 4 live-switchable visual themes (EVA NERV tactical style, Cyber Void, Swiss Blueprint, and Retro CRT), built-in 3x Retina PNG (1620x2160) & ZIP batch export, and viral social media copy for Xiaohongshu (RED/小红书) tech blogs, paper breakdowns, and system architecture reviews. Use when the user asks to create or write a Xiaohongshu post, RED deck, paper breakdown card, tech blog, or canvas slide deck for AI papers, algorithms, systems, or hardware.
---
# XHS Tech Canvas (小红薯多风格动态图文与 3x 超清导图引擎 v3.0)

Generate interactive, publication-grade Xiaohongshu (RED / 小红书) visual slide decks (`540px × 720px` cards) and companion viral social media copy for academic papers (arXiv, MLSys, OSDI, ISCA, NeurIPS, etc.), AI systems, GPU kernels, compilers, and deep tech engineering blogs.

## When to Use

Use this skill when the user asks to:
- Create a Xiaohongshu / RED blog post or visual card deck for an AI paper, tech report, open-source project, or system architecture.
- Turn an academic paper or engineering blog into a visual presentation in a self-contained HTML canvas format with one-click `1620×2160` PNG and `.zip` export.
- Render tech infographics in specific visual aesthetics such as **EVA / NERV Tactical (`eva-nerv`)**, **Cyberpunk Hardware Void (`cyber-void`)**, **Swiss Academic Blueprint (`swiss-blueprint`)**, or **Retro Amber CRT (`retro-crt`)**.
- Customize slide counts (4–12 slides) and modular technical breakdowns based on the paper's actual substance.

## Core Design Architecture

Each output is a single, self-contained, zero-external-image HTML file containing:
1. **Top Dual-Row Control Console (`风格切换 + 3x超清导图控制台`)**: Positioned outside the `.slide` containers so users can:
   - Live-switch between **`⚡ EVA 战术风`**, **`💠 赛博深空`**, **`📐 瑞士蓝图`**, and **`📟 琥珀终端`** with one click.
   - Export all cards sequentially as **3x Retina PNGs (`1620px × 2160px`)** or bundle all PNGs + the Xiaohongshu copywriting (`xiaohongshu_copywriting.txt`) into a **single `.zip` archive**.
2. **Collapsible 3x Retina Preview Gallery (`#export-gallery-panel`)**: Automatically displays rendered high-res thumbnails for single-click download or right-click saving.
3. **Dynamic Modular Slide Deck (`540px × 720px` per card)**: Flexible card count (**4 to 12 slides**) composed from 10 modular card archetypes, with an auto-injected hover quick-snap button (`data-export-ignore="true"`) in the top-right corner of every slide.
4. **One-Click Copywriting Footer (`一键引爆`)**: A `540px`-wide footer containing a `<textarea id="copy-area" readonly>` pre-populated with viral Xiaohongshu copywriting and a one-click copy button.

---

## 1. Dynamic Slide Count & 10 Modular Card Archetypes (动态篇幅与模块化母版)

Do **NOT** force every paper into a rigid 8-slide template. Let the paper's core contributions dictate the slide count and sequence:

### 1.1 Adaptive Slide Counts (三档动态篇幅)
- **⚡ Flash Mode (4–5 Slides)**: Best for focused engineering tricks, short blog posts, or quick open-source releases.
- **🔥 Standard Deep Dive (6–8 Slides, Default)**: Best for standard conference papers.
- **🌌 Full System Anatomy (9–12 Slides)**: Best for comprehensive system architectures, multi-stage compilers, or rich ablation studies.

### 1.2 Composable Card Archetypes (10 大可自由组合母版)
1. **`[COVER]` 视觉海报封皮**: Venue/arXiv badge, high-impact title, punchy Chinese thesis statement, central geometric/hardware emblem, and telemetry bar.
2. **`[CONFLICT]` 痛点与架构死穴**: Why existing systems fail (e.g., VRAM wall, 400K LOC black box, feedback friction, communication bubbles).
3. **`[PARADIGM]` 破局范式转移**: Old Way vs. New Way architectural contrast showing the core conceptual inversion or intermediate abstraction.
4. **`[ARCH_STACK]` 硬件/系统分层拓扑**: Multi-tier Flexbox system/memory hierarchy diagram (e.g., GPU Core ↔ SRAM ↔ HBM ↔ HBF).
5. **`[CODE_SURGERY]` 代码/汇编/IR 微观手术台**: Syntax-highlighted code diff, assembly instruction scheduling, DSL contract, or structured profiler JSON (`>= 12px` font).
6. **`[TIMELINE_LOOP]` 时序流水线与博弈闭环**: Execution timeline, compute-communication overlap, Self-Play Proposer-Coder loop, or multi-round evolution.
7. **`[MATH_FORMULATION]` 核心公理与形式化契约**: Mathematical formulation, E-Graph equality saturation, relational join mapping, or formal verification gates.
8. **`[BENCHMARK_LINEAR]` 严苛等距线性战绩图**: Single or dual linear charts with strict mathematical scaling (`Height % = Value / Max * 100%`).
9. **`[ABLATION_MATRIX]` 消融实验与跨任务迁移矩阵**: Step-by-step ablation gains, zero-shot transfer matrix, or feature comparison table.
10. **`[TAKEAWAY_OUTRO]` 行业终局洞察与档案卡**: Concluding engineering philosophy + full paper metadata & arXiv/GitHub link.

---

## 2. Multi-Style Visual System (四大实时切换主题引擎)

Support switching via `body[data-theme="..."]` CSS variables (see `assets/template.html` and `references/design-guide.md`):

1. **`eva-nerv` (EVA 战术终端风 — Default)**:
   - Abyssal Violet-Black (`#090610`), NERV Tactical Orange (`#ff6b00`), Unit-01 Acid Green (`#84cc16`), Unit-01 Violet (`#a855f7`), Apostle Crimson (`#ff0033`).
   - Iconic Condensed Heavy Mincho typography (`.font-eva-serif` using `'Noto Serif SC'`, weight `900`, `transform: scaleX(0.88)`), diagonal hazard stripes (`.eva-hazard-bar`), and chamfered armor panels (`.eva-chamfer`).
2. **`cyber-void` (赛博深空极客风)**:
   - Void Black (`#020617`), Neon Cyan (`#06b6d4`), Matrix Emerald (`#10b981`), `2px solid` glowing borders, frosted glass panels, and 3D liquid bars.
3. **`swiss-blueprint` (瑞士学术工程蓝图风 · 亮色系)**:
   - Warm Engineering Paper (`#f4f1ea`), Ink Black (`#0f172a`), International Klein Blue (`#1d4ed8`), `3px solid #0f172a` neo-brutalist borders, and hard offset shadows (`10px 10px 0px #0f172a`).
4. **`retro-crt` (琥珀大型机终端风)**:
   - Phosphor Black (`#0c0900`), Amber CRT (`#ffb000`), and Phosphor Green (`#33ff33`).

---

## 3. Engineering, Layout & Auto-Export Guardrails (防翻车与超清导图铁律)

1. **Razor-Sharp Borders & Zero Global Scan-Lines**:
   - Every `.slide` container must have a crisp `2px` or `3px solid` border.
   - **Strictly forbid** full-screen `.animate-scan` / `@keyframes scan-line` laser bars moving across cards.
2. **720px Vertical Budget & Anti-Clipping**:
   - Each `.slide` is strictly `w-[540px] h-[720px] overflow-hidden`. Use `flex-1 flex flex-col justify-between` inside slides so content never overflows or gets clipped at the bottom.
   - Never put `overflow-hidden` directly on a parent box that has a floating border badge (`top-0 -translate-y-1/2`); wrap background stripes in an inner `<div class="absolute inset-0 overflow-hidden pointer-events-none">`.
   - Enforce readable code and diagram typography (`text-xs` / `12px` minimum; never `8px` or `9px`).
3. **Strict Mathematical Linearity on All Benchmark Charts**:
   - Define `Max_Axis_Value` above the peak data point and render equidistant Y-axis ticks from `0` to `Max_Axis_Value`.
   - Calculate every bar's CSS height/width strictly via: `Height % = (Metric_Value / Max_Axis_Value) * 100%` and document the math in an HTML comment.
4. **Mandatory 3x Retina PNG & ZIP Batch Export Engine**:
   - Always include `html-to-image@1.11.11` and `jszip@3.10.1` via CDN, and add `crossorigin="anonymous"` on the Google Fonts `<link>` tag.
   - Auto-inject per-slide hover export buttons marked with `data-export-ignore="true"` and filter them out during `htmlToImage.toBlob(..., { pixelRatio: 3 })`.

## Workflow Steps

1. **Step 0 — Verify & Ground the Source**: Inspect or search the exact URL/ID provided by the user. Verify the true paper title, authors, core mechanisms, and benchmark numbers.
2. **Step 1 — Select Style, Slide Count & Modular Arc**: Choose the optimal slide count (4–12 slides) and select the best-fitting modular archetypes.
3. **Step 2 — Render the Self-Contained HTML File**: Use `assets/template.html` and `references/design-guide.md`. Populate custom pure-CSS diagrams and viral Xiaohongshu copywriting.
4. **Step 3 — Self-Audit**: Verify zero global scan-lines, zero vertical overflow beyond `720px`, `>= 12px` code text, unclipped border badges, exact linear bar heights, and working PNG/ZIP export controls.
