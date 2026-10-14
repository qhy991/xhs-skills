# XHS Tech Canvas 视觉体系、模块化母版与 3x 超清导图工程规范 (v3.0)

本规范定义了 `xhs-tech-canvas` 的四大核心支柱：**动态模块化叙事（4～12 页自由伸缩）**、**四大实时切换视觉主题引擎**、**排版防翻车与线性图表数学铁律**，以及 **客户端 3x 视网膜级（1620×2160）PNG & ZIP 自动化导出架构**。

---

## 一、 动态篇幅与 10 大模块化卡片母版（Dynamic Modular Funnel）

根据论文或开源项目的实际体量，在 **4～12 页** 间自由组合以下 10 大卡片母版：

1. **`[COVER]` 视觉海报封皮**：顶会/arXiv 标识、极太明朝主标题、一句话破局副标题、背景几何/芯片核心图腾与底部状态栏。
2. **`[CONFLICT]` 痛点与架构死穴**：剖析传统方案为何崩溃（如显存墙 OOM、黑盒报错、反馈摩擦、盲改负优化）。
3. **`[PARADIGM]` 破局范式转移**：Old Way vs. New Way 架构对比，展示中间层抽象、软硬协同或空间映射。
4. **`[ARCH_STACK]` 硬件/系统分层拓扑**：纯 Flexbox 构建的多层物理/逻辑架构图（严禁使用脆弱的多层 `absolute` 硬编码坐标堆叠）。
5. **`[CODE_SURGERY]` 代码/汇编/IR 微观手术台**：展示关键代码 Diff、DSL 契约或硬件探针 JSON 诊断报告（字号必须 `>= 12px`）。
6. **`[TIMELINE_LOOP]` 时序流水线与博弈闭环**：多轮迭代进化、投机解码时间轴、计算-通信重叠（Overlap）或双模型博弈流。
7. **`[MATH_FORMULATION]` 核心公理与形式化契约**：核心目标函数、代价模型或安全验证门控公理。
8. **`[BENCHMARK_LINEAR]` 严苛等距线性战绩图**：100% 遵守等距线性刻度与精确高度百分比换算。
9. **`[ABLATION_MATRIX]` 消融实验与跨任务迁移矩阵**：验证各组件贡献度与零样本（Zero-Shot）跨数据集迁移能力。
10. **`[TAKEAWAY_OUTRO]` 行业终局洞察与档案卡**：核心金句总结 + 完整论文/项目元数据档案卡。

---

## 二、 排版防翻车与严格线性图表铁律（Layout & Math Guardrails）

### 2.1 跨边框悬浮徽章防裁切标准结构
当容器既有斜纹背景又有骑在顶部边框上的悬浮标签（`top-0 -translate-y-1/2`）时，**严禁在父容器上直接加 `overflow-hidden`**，必须将背景纹理单独包裹在子层中：
```html
<div class="relative theme-recessed p-4">
    <!-- 背景纹理独立包裹在 overflow-hidden 子层 -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,0,51,0.06)_10px,rgba(255,0,51,0.06)_20px)]"></div>
    </div>
    <!-- 跨边框悬浮徽章完整不被裁切 -->
    <div class="absolute top-0 left-4 -translate-y-1/2 bg-black px-2.5 py-0.5 border border-current text-accent-alert text-xs font-code font-bold z-20">
        BOTTLENECK_TRAP
    </div>
    <div class="relative z-10 pt-2">...</div>
</div>
```

### 2.2 SOTA 柱状图 100% 严格等距线性换算
1. 设定整洁的坐标轴上限 `Max_Axis_Value`（如 `8.0x`、`1000`、`0.60`），绘制 5 个等距刻度（4 个 25% 区间，对应 `.chart-grid { background-size: 100% 25%; }`）。
2. 每个柱子的高度百分比严格按公式计算并写入 HTML 注释：
   `Height % = (Metric_Value / Max_Axis_Value) * 100%`

---

## 三、 3x 超清 PNG 导图与 ZIP 一键打包规范（Auto Export Engine）

1. **CDN 依赖与字体跨域属性**：
   - `<script src="https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js"></script>`
   - `<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>`
   - Google Fonts `<link>` 必须包含 `crossorigin="anonymous"`，防止 Canvas 导出时报 CORS 污染错误。
2. **单张快拍无痕过滤**：
   - 每张 `.slide` 右上角动态注入的快拍按钮必须携带 `data-export-ignore="true"`。
   - `htmlToImage.toBlob(slideEl, { width: 540, height: 720, pixelRatio: 3, filter: node => !(node.dataset && node.dataset.exportIgnore === 'true') })` 确保导出的 `1620×2160` 超清图片 100% 纯净。
3. **ZIP 图文同包下载**：
   - 点击「打包下载 ZIP」时，将所有卡片的 `1620×2160` PNG 与底部 `#copy-area` 中的文案（保存为 `xiaohongshu_copywriting.txt`）一起写入 `JSZip` 实例并触发单次下载。
