# AI 素材生成提示词工程(人工外跑配方)

AI = 首席画师。Claude 产合格提示词 → 人类在外部工具跑图/视频 → 抠图回填目标项目的美术映射点(角色立绘 / 布景氛围 / token;具体点见该项目设计文档,勿写死在通用技能)。本文件全部为「给人拿去跑」的配方;写 prompt 前先定用途与取景框(UI 先行)。

## 一、静态图片提示词

### 六段式核心公式

> **[主体] + [环境/场景] + [构图/视角] + [风格/媒介] + [光照/色彩] + [画质/参数]**

### 漫画情绪符号元件(青筋/水滴/爱心/灯泡)

情绪符号(💢 青筋 / 💧 冷汗 / ❤ 爱心 / 💡 灯泡)作**单独透明小图**跑,不与立绘同帧 —— 便于 UI 层独立叠加、复用跨镜头。

> `angry vein mark / sweat drop / love mark / light bulb`, emotion symbol, standalone sprite, **transparent background**, clean outline, flat color, screentone shading, same line weight as character sheets. 多张一批跑保同风格。

### 角色一致性关键技巧
- **角色锚点**:每角色一段固定精确描述块(脸型/五官/发型/发色/标志特征/服装);每次生成**原封不动置于提示词最前**。
- **锚点文本冻结**:锚点核心词(发型/瞳色/服装主色/种族特征)在项目期**禁增删、禁同义替换**(`red hair` ↔ `crimson hair` = AI 当两种色,即破功);`--stylize` 禁随意变。固定种子 + 冻结锚点字 = 角色唯一身份证。
- **色值硬编码(防漂移)**:主色系注入固定 hex(例:`` `color palette: #FF8C00 and #FFFFFF` ``)逐条进 prompt,与「锚点文本冻结 + 固定 seed」并称三件套 —— 防跨情绪/跨镜头毛色与服装色突变(基因漂移)。
- **固定种子**:Midjourney `--seed [数字]`;满意后复制 seed,后续仅改表情/动作,体型配色全统一。
- **以图生图**:标准照后,后续分镜传此图作参考(`--cref`)。

**一致性技术分级(按产能选,别只用 prompt 硬扛)**:

| 手段 | 一致性 | 成本 | 何时用 |
| --- | --- | --- | --- |
| **LoRA**(角色专属) | 极高 | 高:10–30 张精选图训练,权重约 **0.6** 防过拟合 | 同一角色要出**几十张以上** |
| **身份锚点块**(本文件主推) | 高 | 低 | 角色少、张数中等的默认解 |
| 固定 seed 变体 | 中 | 极低 | 同姿势微调表情 |
| 图生图 / 参考图(`--cref`) | 中 | 低 | 快速铺量 |
| ControlNet | 锁结构不锁脸 | 中 | 锁姿势/构图 |
| 身份适配器(IP-Adapter 类) | 高 | 中 | 脸要紧、场景要换(权重 **0.7–0.9**;过高会连构图一起抄) |

> 口诀:**参考适配器求快,LoRA 求量,ControlNet 求结构。** 早期预期 **20–30% 返工**,按批量估工,别按 1:1。

> **锚点存档与命名护栏**:目标项目通常无内置角色锚点档。产出锚点块时,把定稿锚点存**该项目设计文档/素材节**(或自建锚点库),避免每次重写漂移。造型/命名勿撞目标项目既有角色与资产表 —— 跑图前先查该角色是否已存在;若需**新角色**,常跨该项目的角色 union / 语音 / 数据 / 测试域(不单是美术),先走立项,勿当视觉小事。

### 素材 prompt 档(交付物,存项目设计文档)

**只给配方不出成品档 = 项目拿不到能直接外跑的 prompt。** 定稿时必须落成一份档,建议字段:

```text
0 使用方式       取全局锚 + 主体段整体复制;跑完过三无质检;回填需立项
1 全局风格锚     每条 prompt 前置、冻结禁改写;含硬编码色值 + 项目特有约束
2 角色 prompt    每角色:锚点块(冻结) / 3/4 侧视 prompt / 表情差分 prompt / 立绘 prompt / 待机 4s 视频 prompt / seed 占位
                 ⚠ 无立绘者(如叙述位)与未登场者,明写「不产素材」,别留空
3 布景与元素     元素表(天空体/建筑/自然物,产透明单件)+ 氛围档(多为 CSS 渐变,不产位图)
4 情绪符号元件   单独透明小图,与边框色/情绪色同源
5 回填映射 + 红线 每类素材 → 项目哪一处;哪一步需先立项
6 指针           通用配方 / 锚点权威 / 接缝文档
```

纪律:**外貌锚的唯一事实源在项目角色卡**(由故事侧产出),本档**引用不复制**;档内标【待定】的字段 = 尚无设计裁决,**不要拿 AI 的随机输出反过来当设计**。

### 角色设定表(3/4 侧视图 + 表情集;素材档的核心附件)

**只给一张立绘,换角度、换情绪时 AI 就自由发挥。** 设定表把"没说的"变成"已定的":

| 件 | 内容 | 防的是什么 |
| --- | --- | --- |
| **3/4 侧视图** | 单一固定转角(约 3/4 侧),全身入镜,配固定 seed | 换镜头时比例与五官漂移 |
| **表情集** | **6–9 格**(AI 常用九宫格),覆盖常用情绪 | 角色说话永远顶同一张脸 |
| 道具设定 | 随身物件(卷轴/工具/武器)的形状与配色 | 道具每张一个样 |
| **配色板** | 主色 / 辅色**硬编码 hex** | 色偏;与「锚点冻结 + 固定 seed」并称三件套 |

> **只做一个转角,不做正/侧/背转面** —— 全屏演出里角色极少以正背示人,转面成本不划算。
> **没写进设定表的东西 —— 刘海分缝、衣领形状、配饰位置 —— AI 每张都会重新发明。** 叙事游戏里角色要反复说话,表情集是刚需,不是加分项。

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

## 四、AI 素材质检闸门(回填前)

产图/产视频后、回填项目前,过「三无测试」:

| 检查 | 含义 | 处置 |
| --- | --- | --- |
| 无畸形 | 手指/眼珠/肢体数量与结构正确 | 不过 = 重绘 |
| 无溢色 | 毛发/皮肤边缘无绿(紫)荧光描边 | 大片硬伤 = 重绘;仅轻微边缘溢色走合成期 Spill Suppression(见避坑) |
| 无穿帮 | 时代/物种/道具不混搭(古装兽人别混现代物) | 不过 = 重绘 |
| **风格一致** | 与 **3–4 张已定稿参考图**逐项比对:线宽 / 网点密度 / 色温 / 脸型 / 发际线 / 瞳形 / 标志服装 | 偏离 = 重绘;**整批同向偏离 = 回炉改锚点** |

> 前三项查"这张图坏没坏",第四项查"这张图还是不是同一个世界"。**逐张看都合格、一排开就散架**,是只有第四项能抓到的失败。

**不过 = 丢弃重绘(改 prompt),禁止手工 PS 修补** —— 补一张是一致性负债,成本高且成不一致源。同一角色多镜头一致性靠「固定 seed + 冻结锚点 + 色值硬编码」三件套保证,不是靠后期救。

## 五、素材清单与来源登记(批量产之前就建)

每件素材一行,存**项目设计文档**:

```text
素材 id | 类型 | 归属(角色/场景) | 工具+版本 | 模型/checkpoint | sampler·steps·size | seed | LoRA | 产出日期 | 授权状态
```

- **可再生成**:冻结模型/采样器/步数/尺寸/seed 并写进清单 → 任何一件日后都能重跑;**没清单 = 不可复现 = 不可维护**。
- **授权留痕**:纯 AI 生成图在多数法域**难以主张著作权**(美国版权局立场:缺人类作者 → 不可版权),别人可自由复用;商用前确认工具条款是否含赔偿;欧盟 AI 法案要求**机器可读的 AI 标注**。清单即版权底账。
- **别让随机输出倒灌设计**:标【待定】的字段等设计裁决,别拿某次幸存的随机结果反过来当设定。

> 字段可按项目裁剪;登记位置归项目文档,本文件只给字段建议。

## 六、避坑清单(出 prompt 时自查)

1. UI 先行:先画取景框再喂 AI,防头顶被切、塞不进布局。
2. 红/橙毛发绿幕溢绿边 = **红线:禁暴力 chroma key 抠除**(留荧光绿描边,精致 UI 秒变廉价学生作品)。产图先 `uniform lighting` + `no complex background shadows`;合成期用 **Spill Suppression(溢色抑制)** 将边缘绿替换为环境色(红狐 → 暖橙),再去饱和 + 色相偏移压净。
3. 动作幅度克制:待机/微动作用呼吸律动描述,别让角色蹦迪。
4. 回填项目:跑完图按目标项目美术映射点回填(角色立绘 / 布景氛围 / token 类集中点),勿在组件内联素材/死样式绕过既有接缝。具体点与「位图化改造」红线以该项目设计文档为准(本仓库: `docs/design/game-visual.md`)。
5. **回填完不做回归**:素材一换就"看着还行"地过 —— 换的可能是尺寸、透明边、首帧姿态,破的是布局与循环。**回填后必须重跑一遍已完成的成品幕**(纵切片那一幕),而不是只跑新素材那一处。
6. **一批跑完不比对**:只看单张合格就入库。**必须与 3–4 张已定稿参考图并排比对**(见质检第四项),整批同向偏离 = 锚点问题,早改便宜。
