# 千字谷 · AI 素材 prompt 定稿(素材回填档)

> **定位**:把「通用配方」(技能 `.claude/skills/game-visual-design/references/ai-materials.md`)与「项目锚点」(bible §3.1 角色一页卡的外貌锚)合成**可直接外跑的 prompt 定稿**。
> **分工**:六段式公式 / 锚点技巧 / 三件套 / 质检闸门 / 避坑 = **技能**;本项目的锚点指针、prompt 文本、回填点 = **本文**。
> ⚠ **状态:设计前置定稿,尚未回填**。当前全角色 = `ROLE_META` 单 emoji(零位图);角色立绘位图化需 spec §10 升级 + PLAN 立项(见 `game-visual.md`「AI 素材回填仓库点」)。prompt 可先存档,**禁止未立项直接回填**。
> ⚠ 标【待定】的字段 = 尚无设计裁决,跑图前须先定;**不要用 AI 输出的随机结果反过来当设计**。

## 0 使用方式

1. 取「全局风格锚」(§1)+ 对应主体 prompt,**整体复制**外跑(锚点段必须原封不动置于最前)。
2. 过**三无质检**(无畸形 / 无溢色 / 无穿帮)→ 不过 = 丢弃重绘,**禁 PS 修补**。
3. 回填映射点见 `game-visual.md`(需先立项)。

**三件套(每条 prompt 都要)**:锚点文本冻结 + 固定 seed + 色值硬编码。锚点核心词**禁同义替换**(`orange` ↔ `tangerine` 会被 AI 当两种色)。

## 1 全局风格锚(每条 prompt 前置)

```text
Style anchor (freeze, do not paraphrase):
children's picture-book manga, warm and friendly, rounded soft shapes, thick clean outlines,
flat cell shading with subtle halftone screentone, NO harsh shadows, NO horror or uncanny detail,
bright readable colors, screen-print texture
Palette (hardcode, do not substitute):
sky #bfe3ff · accent orange #ff8a2a · emerald #10b981 · sky-blue #0ea5e9 · ink navy #1f3a5f · white #ffffff
```

**本项目特有约束**:儿童向 —— 无尖牙、无利爪、无恐怖阴影、无写实毛发质感;表情夸张但友善。

**配色板(hex)**:上列 6 色即全局色板(硬编码,勿替换)。**角色主色 hex 不在此复制** —— 唯一事实源 = `game-story-bible.md` §3.1 对应一页卡的「外貌锚」栏,本档只引用。

## 2 角色 prompt

> **锚点来源**:`game-story-bible.md` §3.1 一页卡(苏灵灵🦊 / 徐万年🦥 / 皮小闹🦝 / 吴铭🦇)。**外貌锚(主色 hex / 形态 / 剪影记忆点 / 状态变体)只存 bible 卡内**,本档 prompt 以指针引用,**不复制、不另存一份**(两处各存一份 = 漂移源)。
> **旁白📖 无立绘**(渲染为叙述框),**不产素材**。
> 角色集 = `SpeechRole` **5 值**(`lingling` / `xuwannian` / `pixiaonao` / `changmo` / `narrator`,**无群众位**);加角色须先按 bible §3.4 立项(跨 6 处同步)。

### 2.1 苏灵灵🦊 `lingling`

**锚点(引用,冻结)**:`game-story-bible.md` §3.1「苏灵灵」一页卡 · 外貌锚栏(主色 / 形态 / 剪影记忆点 / 状态变体)。

- **3/4 侧视图**:45° 固定侧视,朝右,全身居中,四周 20% 纯绿幕 `#00FF00` 边距(跨立绘/待机一致)。
- **表情集(6–9 格)**:按卡内状态变体扩写 —— 普通 / 跑动 / 失望垂耳 + 笑 / 认真帮忙 / 惊讶 / 疑惑 / 坚定。
- **道具**:【待定】服装道具未裁决;裁决后写死于此,并回改 bible 卡。
- **配色板**:主色见 bible 卡;风格色板见 §1。

```text
[Subject anchor — freeze verbatim per bible §3.1 苏灵灵 card]
(主色 / 形态 / 剪影记忆点 / 状态变体 照抄一页卡,禁同义替换)
[Framing] Full body, 45-degree fixed side view facing right, strictly centered,
20% pure chroma key green #00FF00 margin on all sides.
[Expression sheet] 6–9 expression cells in one sheet, same design frozen, clean grid.
[Props] 【待定】
[Style] <§1 全局风格锚>
[Params] --ar 9:16 --niji 6 --style expressive --seed <SEED_LINGLING>
```

**待机 4s 循环**:以立绘为参考图,`Keep the exact character design, facial structure, costume color, body proportions strictly unchanged.` + 静态机位、纯绿幕、4 秒;动作按技能 §三「待机动画」模板(呼吸律动 + 尾巴钟摆 + 耳朵轻颤)。
**硬线**:呼吸起伏 ≤ 身高 3%;首尾帧姿态差 < 5%。

### 2.2 徐万年🦥 `xuwannian`

**锚点(引用,冻结)**:bible §3.1「徐万年」一页卡 · 外貌锚栏。

- **3/4 侧视图**:45° 固定侧视,朝右,全身居中,纯绿幕边距。
- **表情集(6–9 格)**:按卡内变体扩写 —— 笑 / 困惑 / 打盹 + 认真 / 恍然 / 着急 / 无奈 / 高兴。
- **道具**:【待定】(修东西的人;工具/眼镜等未裁决,勿擅自加)。
- **配色板**:主色见 bible 卡;风格色板见 §1。

```text
[Subject anchor — freeze verbatim per bible §3.1 徐万年 card]
[Framing] Full body, 45-degree fixed side view facing right, strictly centered,
20% pure chroma key green #00FF00 margin on all sides.
[Expression sheet] 6–9 expression cells in one sheet, same design frozen, clean grid.
[Props] 【待定】
[Style] <§1 全局风格锚>
[Params] --ar 9:16 --niji 6 --seed <SEED_XUWANNIAN>
```

**待机 4s 循环**:同上模板;动作 = 缓慢呼吸 + 偶尔挠头(慢,契合人物节奏)。
**硬线**:呼吸起伏 ≤ 身高 3%;首尾帧姿态差 < 5%。

### 2.3 皮小闹🦝 `pixiaonao`

**锚点(引用,冻结)**:bible §3.1「皮小闹」一页卡 · 外貌锚栏。

- **3/4 侧视图**:45° 固定侧视,朝右,全身居中,纯绿幕边距;**体型明显小于苏灵灵**。
- **表情集(6–9 格)**:按卡内变体扩写 —— 兴奋 / 心虚 / 得意 + 惊讶 / 委屈 / 好奇 / 笑了 / 认错。
- **道具**:【待定】。
- **配色板**:主色见 bible 卡;风格色板见 §1。

```text
[Subject anchor — freeze verbatim per bible §3.1 皮小闹 card]
[Framing] Full body, 45-degree fixed side view facing right, strictly centered,
20% pure chroma key green #00FF00 margin on all sides; clearly smaller than the lead.
[Expression sheet] 6–9 expression cells in one sheet, same design frozen, clean grid.
[Props] 【待定】
[Style] <§1 全局风格锚>
[Params] --ar 9:16 --niji 6 --seed <SEED_PIXIAONAO>
```

**待机 4s 循环**:同上模板;动作 = 坐不住的小幅蹦跳 + 尾巴甩动(不可盖过说者弹跳)。
**硬线**:呼吸起伏 ≤ 身高 3%;首尾帧姿态差 < 5%。

### 2.4 吴铭🦇 `changmo`

**锚点(引用,冻结)**:bible §3.1「吴铭」一页卡 · 外貌锚栏。渲染比例放大 1.5 倍(`roleScale`,代码已实现)。

**儿童向红线:好奇而非恐惧** —— 圆钝、友善、不可怖;不要尖牙、不要血口、不要骷髅意象。

- **3/4 侧视图**:45° 固定侧视,朝右,全身居中,纯绿幕边距。
- **表情集(6–9 格)**:按卡内变体扩写 —— 倒挂 / 侧目 / 展开 + 沉默 / 冷淡 / 被叫住 / 微动容 / 收起。
- **道具**:【待定】(斗篷形为剪影记忆点,非独立道具)。
- **配色板**:主色见 bible 卡;风格色板见 §1。

```text
[Subject anchor — freeze verbatim per bible §3.1 吴铭 card]
[Framing] Full body, 45-degree fixed side view facing right, strictly centered,
20% pure chroma key green #00FF00 margin on all sides.
[Expression sheet] 6–9 expression cells in one sheet, same design frozen, clean grid; friendly, never scary.
[Props] 【待定】
[Style] <§1 全局风格锚;此角色允许整体压暗一档>
[Params] --ar 9:16 --niji 6 --seed <SEED_CHANGMO>
```

**待机 4s 循环**:同上模板;动作 = 倒挂轻晃 + 收翅(少而动,契合「话少」)。
**硬线**:呼吸起伏 ≤ 身高 3%;首尾帧姿态差 < 5%。

> ⚠ ch1 中吴铭**不出场**(仅 `settle` 钩子指向)—— 立绘可先定稿存档,勿在此章节回填。

## 3 布景与元素 prompt

> 落点:`STAGE_BODIES`(太阳位 / 云 / 山 / 村 / 河 / 浪)+ 氛围 5 档,回填至 `stage-visuals.ts` + `index.css` token(见 `game-visual.md`)。
> 布景元素应产**透明背景单件**(便于 CSS 分层与换档),不产整幅背景 —— 整幅会被 5 档氛围渐变盖住且不可复用。

### 3.1 天空体元素(`STAGE_BODIES`)

> 现状 = emoji 单态(`stage-visuals.ts`),**无分档、无月星**。

| 元素 | 锚点要点 |
| --- | --- |
| 太阳位 | **固定单态**天空体(不是角色);一个就够,无分档 |
| 云 | 圆钝积云,白 `#ffffff` 带淡蓝底影;禁止写实卷云/乌云 |
| 山 | 分层远山,蓝紫渐变;谷地山壁**刻有汉字**(千字谷设定) |
| 村 | 圆顶小屋群,暖光窗;远景剪影级细节 |
| 河 | 浅蓝 `#bfe3ff` 反光带 |
| 浪 | 河面水波,浅蓝 `#bfe3ff` |

```text
[Subject] <择一元素> [Environment] isolated single asset, transparent background
[Style] <§1 全局风格锚>, flat vector-like shapes, minimal inner detail
[Params] --ar 1:1 --niji 6 --seed <各元素固定 seed>
```

### 3.2 氛围 5 档(`atmosphereToClass` / `.stage-sky--*`)

**不产位图**,产 **CSS 渐变配方 + 可选叠加滤镜**。5 档 = `dawn / day / dusk / night / dark` + **世界回春 4 档**叠灰(`worldDesatClass`:dim/light/half/none)。

| 档 | 用途(本章) | 色彩方向 |
| --- | --- | --- |
| dawn | 开场 / 多数 task / social | 淡橙 `#ff8a2a` → 浅蓝 `#bfe3ff` |
| day | ending / settle | 明亮天空蓝 `#bfe3ff` → 白 |
| dusk | 转场(本章未用) | 橙红 → 蓝紫 |
| night | `t5` 台灯两幕(全场唯一真夜戏) | 深蓝 → 墨 `#1f3a5f` |
| dark | BOSS 幕 | 近黑墨蓝,低对比 |

**回春滤镜**:低进度叠灰降饱和(失血感),高进度还原;仅作用布景层,**不得覆盖 UI 与对白泡**(可读性红线)。

### 3.3 太阳布景素材

见 §3.1 —— 太阳**只是天幕布景位,固定单态**,不产分档素材(旧分档机制已随代码删除)。

## 4 情绪符号元件(`moodBorder` 的视觉补强)

按技能配方**单独透明小图**跑,不与立绘同帧(便于 UI 层叠加、跨镜头复用):

```text
sweat drop / sparkle / question mark puff, emotion symbol, standalone sprite,
transparent background, clean outline, flat color, screentone shading,
same line weight as character sheets, palette #ff8a2a #0ea5e9 #10b981 #ef4444
```

> `mood` 边框色现由 `moodBorder` 提供:sad → `#0ea5e9` / happy → `#10b981` / scary → `#ef4444` / calm → 中性。情绪符号与边框色**须同源**,否则同一情绪出现两套色。

## 5 回填映射与红线

| 素材 | 回填点 | 前置 |
| --- | --- | --- |
| 角色立绘 / 表情集 / 待机视频 | `ROLE_META`(`scene-ui.tsx`)+ CastFigure 渲染改造(需新增视频渲染层) | **spec §10 位图升级 + PLAN 立项** |
| 布景元素 | `stage-visuals.ts` `STAGE_BODIES` + `index.css` token | 低(改映射表,组件零改) |
| 氛围渐变 | `index.css` `.stage-sky--*` | 低 |
| 太阳布景(单态) | `STAGE_BODIES.sun` + `index.css` token | 低 |
| 情绪符号 | `moodBorder` 同源新增 | 低 |

**红线**:

1. **加角色 = 跨语音域大改**(`SpeechRole` union + `speech.contract.test` + `ROLE_META` + 嗓音表 + bible 卡 + spec 表,共 6 处,见 bible §3.4),撞「语音零动」,须先立项。
2. 素材一律经**映射点**取,禁组件内联死样式(`architecture.test.ts` 纪律)。
3. **不过质检 = 丢弃重绘**,禁手工 PS 修补(补一张 = 一致性负债)。
4. 红/橙毛发**禁暴力 chroma key 抠除**,溢出边用 Spill Suppression 替换为环境暖橙。

## 6 指针

- 通用配方与质检:`.claude/skills/game-visual-design/references/ai-materials.md`
- 角色锚点权威:`docs/design/game-story-bible.md` §3.1 角色一页卡(外貌锚唯一事实源)
- 接缝/红线/现状:`docs/design/game-visual.md`
- 演出与交互:`docs/design/game-direction.md`
