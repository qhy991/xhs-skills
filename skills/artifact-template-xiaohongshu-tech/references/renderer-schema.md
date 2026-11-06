# 轮播图配置与渲染命令

该渲染器用 JSON 控制文案和布局。固定输出 **1440 × 1920 px、3:4、96 px 左右安全边距**，默认沿用深墨绿、纸白、荧光绿配色。主要标题最小 88 px，正文固定在 40–44 px；不会通过缩小字体解决溢出。

目录：[命令](#命令) · [输出与失败行为](#输出与失败行为) · [顶层字段](#顶层字段) · [每页公共字段](#每页公共字段) · [共用条目结构](#共用条目结构) · [六类布局](#六类布局) · [更换页序](#更换页序)

## 命令

```bash
node render_carousel.cjs \
  --input /absolute/path/post.json \
  --output /absolute/path/rendered \
  --font-regular /absolute/path/NotoSansCJKsc-Regular.otf \
  --font-bold /absolute/path/NotoSansCJKsc-Bold.otf
```

字体也可由 `XHS_FONT_REGULAR` 和 `XHS_FONT_BOLD` 环境变量提供；CLI 优先。需提供覆盖全部中文内容的真实字体文件，不依赖系统字体自动发现。中文常规和粗体可使用 Noto Sans CJK SC 或有相应许可的字体。

依赖 `@napi-rs/canvas`、`sharp`。先使用正常 Node `require()`；缺失时从 `CODEX_PRIMARY_RUNTIME_NODE_MODULES` 查找。普通环境可运行：

```bash
npm install @napi-rs/canvas sharp
```

`--help` 不需要字体。该脚本不联网，不自行下载字体或生成封面插图。

## 输出与失败行为

- `01_ready_to_post_JPG/01_<id>.jpg`：JPEG 96，4:4:4 色度采样。
- `02_lossless_PNG/01_<id>.png`：无损 PNG，同一画面。
- `overview.png`：按页序组成的概览图。
- `layout_audit.json`：页面与文本审计。

审计主字段为 `pages`（数字）、`overflow`（数组）、`files`（列表）、`status`、`dimensions`、`textRecords`、`images`、`overview`、`errors`。`files` 每项含 `index`、`name`、`layout`、`pngPath`、`jpgPath`、`width`、`height`，路径为绝对路径。只有全部页面通过排版检查后才写入 PNG/JPG；失败不删除输出目录里的旧文件，因此每个正式版本应使用独立输出目录，并以本次审计 `status: "passed"` 为准。

文字容器、行数或安全边距超出时，退出码 **2**，审计 `overflow` 会提供页码、JSON 字段路径、字号、文字和容器尺寸。无效配置、缺少图片或字体等错误退出码 **1**。缩短或重新组织文案后重跑，不要降低规定字号。标题和正文按测量宽度自动换行，也支持 JSON 字符串中的显式 `\n`。过长英文单词会按字素拆行。

审计检查的是文字布局，不核查文字事实或信息图的语义关系。正式交付仍应查看 `overview.png` 和各原图。

## 顶层字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `version` | number | 必须为 `1`。 |
| `title` | string | 内容主题，必填。 |
| `overviewTitle` | string | 可选；概览标题，最多自动换为两行。 |
| `brand` | string | 可选；每页左上标识，默认“学习观察”。 |
| `footer` | string | 可选；每页底部左侧文字。需要日期时在配置中显式写入，不从运行时间自动推断。 |
| `bodySize` | integer | 可选，40–44，默认 42。 |
| `palette` | object | 可选，仅允许下列颜色键，值为 `#RRGGBB`；通常保留默认风格。 |
| `pages` | array | 必填，1–20 页，数组顺序即发布顺序。 |

默认配色：

```json
{
  "paper": "#F2F3ED", "white": "#FFFFFF", "ink": "#14241C",
  "dark": "#101B17", "dark2": "#192A22", "muted": "#617064",
  "soft": "#DDE3D8", "line": "#CDD6C9", "lime": "#BCED72",
  "green": "#315A3B", "lightGreen": "#E2ECD6", "gray": "#AEBDB0"
}
```

## 每页公共字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 必填，唯一的文件名 slug，仅小写字母、数字、`_`、`-`，最多 64 字符。 |
| `layout` | string | 必填，见下列六类布局。 |
| `title` | string | 必填；普通页最多 2 行，封面最多 3 行。 |
| `titleSize` | integer | 可选，88–112；普通页默认 88，封面默认 106。 |
| `subtitle` | string | 可选，正文级字号，最多 2 行。 |
| `dark` | boolean | 可选；封面默认 `true`，其他页默认 `false`。 |
| `section` | string | 可选，右上角短标签。 |
| `takeaway` | string | 普通页可选，底部重点框，最多 2 行。封面使用 `caption`。 |
| `source` | string | 可选，来源或说明；普通页最多 2 行，封面最多 1 行。允许较小字号。 |
| `bodySize` | integer | 可选，40–44，覆盖顶层。 |
| `tags` | string[] | `cover`、`hub`、`process` 使用，最多 4 个；必须在一行内放下。 |

布局会限制每个文字容器。以下字数仅是建议，实际以字体测量为准：普通页标题每行约 10–13 个汉字；副标题每行约 27–29 个汉字；网格卡片正文每行约 11–12 个汉字；hub 单行正文约 9–10 个汉字。来源不应放入完整长 URL，完整链接可另附来源文件。

## 共用条目结构

`items` 和 `supporting` 中的每项可使用：

```json
{
  "title": "条目标题",
  "body": "正文第一行\n正文第二行",
  "icon": "search",
  "eyebrow": "ANALYSIS",
  "tag": "一个短标签"
}
```

`title` 必填；其余可选。`eyebrow` 用于卡片顶部，`tag` 用于 `cards / rows`。可用图标：`chip`、`folder`、`code`、`book`、`doc`、`clock`、`memory`、`battery`、`search`、`check`、`share`、`app`、`spark`。图标仅为简单示意，不代表品牌官方图标。

## 六类布局

### `cover`：封面

生产封面默认应先通过 **imagegen 新建无文字 hero 插图**，再传入相对或绝对路径。图片路径相对输入 JSON 所在目录解析。未提供可用图片时明确失败，不静默代替为图形。

```json
{
  "id": "cover", "layout": "cover", "dark": true,
  "title": "主标题第一行\n主标题第二行\n重点第三行",
  "accentLine": 2,
  "subtitle": "一句副标题。",
  "hero": {"mode": "image", "path": "assets/hero.png", "fit": "contain"},
  "caption": "封面下方的一句核心判断。",
  "tags": ["标签一", "标签二"]
}
```

`accentLine` 为 0 起始的标题行号，默认最后一行。`fit: "contain"` 保留整幅图；`cover` 等比填满后裁切边缘。脚本不修改源图片。`caption` 最多一行。

只有用户主动选择无图/程序示意，或者进行渲染器自测时，才显式使用：

```json
{
  "mode": "diagram",
  "illustrationStyle": "程序示意，仅用于自测",
  "center": "学习项目",
  "labels": ["提出问题", "动手实践", "验证结果"]
}
```

`example-post.json` 采用此模式，**它是无需图像资产的自测示例，不是生产封面的默认插画选择**。`center` 建议不超过 5 个汉字；3 个 `labels` 均建议不超过 6 个汉字。

### `cards`：2–4 张卡片

`items` 必须为 2–4 项。`arrangement` 可为：

- `stack`：纵向排列。两张卡片适合较详细内容，三张适合图标＋一句正文；四张只适合极短内容，放不下会失败。
- `grid`：两列网格，适合四种能力或成果。
- `rows`：编号＋分隔线，不画卡片背景，支持每条的 `tag`。

默认四项用 `grid`，其他项数用 `stack`。宽卡标题默认 54–64 px，网格卡标题 44 px；正文仍为 40–44 px。不要用卡片承载长段落。

### `hub`：四分支中心图

必须提供 `center` 和四个 `items`，按左上、右上、左下、右下排列。标题和正文各一行，`center` 最多两行。适合任务、场景或功能范围。

### `process`：三步流程

必须提供三个 `items`，中间步骤使用深色强调。各步骤建议短标题＋不超过四行的正文。可选 `note` 为流程下方一句说明；可选 `tags` 跟在说明下方。

### `roadmap`：四步路线

必须提供四个 `items`，沿纵向编号排列。各步骤使用短标题和一行正文；两行标题会减少正文空间，放不下时会报错。

### `comparison`：两侧比较或共享池

`variant` 必填：

- `side-by-side`：两个 `items` 作为并列大卡片，支持 `title`、`body`、`icon`、`eyebrow`。
- `shared`：两个 `items[].title` 作为上方节点，`shared` 为下方共享条文字。可用 `diagramCaption` 说明概念，可附恰好两个 `supporting` 卡片。共享模式的主 `items` 仅显示 `title`，不要在这里放正文。

共享池只表达节点与共同资源或目标的关系。应另行确认这种关系符合内容，不要把示意图当硬件结构事实。

## 更换页序

直接调整 `pages` 数组顺序、数量、布局与内容即可。页码、文件名前缀和概览会按新顺序自动生成，不写死九页。九页示例顺序为：封面、双卡片、四分支、三卡片、共享池、三行条目、三步流程、四格成果、四步路线。
