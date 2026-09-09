# AI 素材生成提示词工程(人工外跑配方)

AI = 首席画师。Claude 产合格提示词 → 人类在外部工具跑图/视频 → 抠图回填目标项目的美术映射点(角色立绘 / 布景氛围 / token;具体点见该项目设计文档,勿写死在通用技能)。本文件全部为「给人拿去跑」的配方;写 prompt 前先定用途与取景框(UI 先行)。

## 一、静态图片提示词

### 六段式核心公式

> **[主体] + [环境/场景] + [构图/视角] + [风格/媒介] + [光照/色彩] + [画质/参数]**

### 角色一致性关键技巧
- **角色锚点**:每角色一段固定精确描述块(脸型/五官/发型/发色/标志特征/服装);每次生成**原封不动置于提示词最前**。
- **锚点文本冻结**:锚点核心词(发型/瞳色/服装主色/种族特征)在项目期**禁增删、禁同义替换**(`red hair` ↔ `crimson hair` = AI 当两种色,即破功);`--stylize` 禁随意变。固定种子 + 冻结锚点字 = 角色唯一身份证。
- **固定种子**:Midjourney `--seed [数字]`;满意后复制 seed,后续仅改表情/动作,体型配色全统一。
- **以图生图**:标准照后,后续分镜传此图作参考(`--cref`)。

> **锚点存档与命名护栏**:目标项目通常无内置角色锚点档。产出锚点块时,把定稿锚点存**该项目设计文档/素材节**(或自建锚点库),避免每次重写漂移。造型/命名勿撞目标项目既有角色与资产表 —— 跑图前先查该角色是否已存在;若需**新角色**,常跨该项目的角色 union / 语音 / 数据 / 测试域(不单是美术),先走立项,勿当视觉小事。

### 镜头与构图词库

| 景别 | 关键词 | 角度 | 关键词 |
| --- | --- | --- | --- |
| 极特写 | Extreme Close-up | 平视 | Eye-level |
| 特写 | Close-up | 仰视 | Low Angle |
| 中景 | Medium Shot | 俯视 | High Angle |
| 全身 | Full Body Shot | 倾斜镜头 | Dutch Angle |
| 全景 | Wide Shot / Establishing Shot | | |

### 风格与氛围词库

- 漫画风格:Manga / Anime / Manhua / Comic book style。
- 质感:Halftone / Screentone / Thick outlines / Cell shading。
- 光照氛围:Cinematic lighting / Film noir / Volumetric lighting / Dreamy。

## 二、视频提示词

### 核心公式

> **[主体] + [动作] + [镜头运动] + [视觉风格] + [光照/氛围]**

- **动作**:用主动具体动词(`striding through a puddle, splashing water` > `walking`)。
- **镜头运动**:Static / Pan left/right / Dolly in-out / Orbit / Handheld。

### 平台选择

| 平台 | 核心优势 | 适用场景 |
| --- | --- | --- |
| Runway Gen-4 | 运动控制强、镜头精确 | 电影感画面 |
| Pika 2.1 | 上手简单、风格化好 | 快速尝试 |
| Kling | 可生成长视频(最长 2 分钟) | 叙事序列 |
| Seedance | 时间一致性强 | 风景/持续性动作 |

## 三、实战优化模板(红狐小女孩案例;换角色锚点即复用)

> 通用示范案例:提示词结构/分段可直接套到目标项目任何角色 —— 把【主体锚点】段换成该角色定稿锚点,改表情/动作/构图即复用;锚点定稿后存项目锚点库(见上「锚点存档」)。

### 立绘图(适配 UI 布局,带绿幕边距、固定侧视角)

> **【主体锚点】** Anthropomorphic red fox cub, fluffy genuine fox face with pointed snout, no human face, no cat ears (kemonomimi), beautiful flowing long orange-red hair, huge fluffy tail with white tip.
> **【服装道具】** Wearing exquisite ancient Chinese fantasy costume (Hanfu style), luxurious golden embroidery, holding a small worn parchment scroll gently in her small paws, wearing a round crimson red magic hat with a slightly curved drooping tip.
> **【视角构图】** Full body shot, 45-degree fixed side view, facing right, character strictly centered in frame. **Surrounded by 20% pure chroma key green screen margin (#00FF00) on all sides** for UI game sprite placement.
> **【表情状态】** Happy expression, smiling with tiny fangs visible, bright sparkling eyes.
> **【画风质感】** Anime game sprite reference sheet, clean flat coloring, no complex background shadows, uniform lighting to prevent green spill, sharp focus, high clarity, 8k resolution, cell shading style.
> **【参数】** `--ar 9:16 --niji 6 --style expressive --seed <固定值>`

设计点:`uniform lighting` + `no complex background shadows` → 硬边光照便于抠图、防红发绿幕溢色;锚点定妆后,后续只改「表情」「动作」段落,seed 不变保体型配色一致。

### 待机动画(开心呼吸循环,4s / 绿幕 / 静态机位 / 无缝循环)

> **【参考图】** Input image: [刚生成的标准图].
> **【锁定】** Keep the exact character design, facial structure, costume color, and body proportions strictly unchanged. Full body entirely visible within frame.
> **【背景】** Pure solid green screen background, no background elements, no text, no watermark.
> **【机位】** Static camera, no pan, no zoom, no movement, 4 seconds duration.
> **【动作精描】** Cheerful idle breathing animation:
>
> - Body: torso gently bobs up/down with light bounce (low amplitude).
> - Tail: large fluffy tail sways slowly left-right like a pendulum.
> - Head & Ears: head tilts slightly side to side, ears perk and droop softly.
> - Arms: paws clutching scroll, arms gently swing forward/backward with the bounce.
> - Face: eyes squinting happily with sustained bright smile, occasional soft blink.
>
> **【物理反馈】** Clothing and long hair flow dynamically with the body's up-down inertia. No distortion, no limb drift, seamless loop ready.

克制要点:叙事游戏里「开心」易过火(像蹦迪),改 `sways gently with breathing rhythm` 之类随呼吸轻摇保持文静感。

> 硬性底线:呼吸起伏幅度 ≤ 身高 **3%**(超 = 蹦迪);待机循环 **首尾帧姿态差 < 5%**(产前声明 `seamless loop` 并自查首尾,防 UI 循环卡顿跳变)。

## 四、避坑清单(出 prompt 时自查)

1. UI 先行:先画取景框再喂 AI,防头顶被切、塞不进布局。
2. 红/橙毛发绿幕溢绿边 = **红线:禁暴力 chroma key 抠除**(留荧光绿描边,精致 UI 秒变廉价学生作品)。产图先 `uniform lighting` + `no complex background shadows`;合成期用 **Spill Suppression(溢色抑制)** 将边缘绿替换为环境色(红狐 → 暖橙),再去饱和 + 色相偏移压净。
3. 动作幅度克制:待机/微动作用呼吸律动描述,别让角色蹦迪。
4. 回填项目:跑完图按目标项目美术映射点回填(角色立绘 / 布景氛围 / token 类集中点),勿在组件内联素材/死样式绕过既有接缝。具体点与「位图化改造」红线以该项目设计文档为准(本仓库: `docs/design/game-visual-local.md`)。
