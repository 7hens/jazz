# 千字谷视觉落地向导(game-visual-design 技能的本仓库绑定)

> 通用设计方法 + AI 素材配方(气泡/镜头/站位/六段式 prompt/绿幕约束)见项目技能 `.claude/skills/game-visual-design/`。本文 = 该通用技能**在本仓库(千字谷 ch1 现态)落地**时的接缝、红线、素材回填与现状快照,与技能本体解耦、独立维护。
>
> **代码演进会漂**:接缝符号/现状一律以 `src` + spec/PLAN 为权威,动手前 grep 复核,勿盲信本文快照。

## 流程守则(本仓库,先于动手)

1. **需求先入 PLAN 想法池**占位,确认才立项;详设唯一位置 `docs/superpowers/specs/`。禁止直接开工;新点子沿用现 spec/plan 轨(TDD)。
2. **先对账现状再设计**:仓库已有 = 勿重建。**设计 scene 前先翻 `src/features/qianzigu/ch1.ts` 场景表**(现有幕/段,避免撞已有如 `t5` 台灯夜戏)与角色注册表(§角色,勿造新)。
3. **「引擎/进度/语音零动」为红线**:只动视觉壳与数据可选字段(`chapter.ts` 的 `stage?` / `mood?`),不碰 engine/progress/speech/判分语义,不加 AudioCue。
4. **克制契合简约风**:儿童向大字可读 > 炫技;全屏纹理/高饱和易伤可读;`prefers-reduced-motion` 必兜底。
5. 视觉经映射点取、数据驱动,不内联死样式;feature 边界与 `architecture.test.ts` 纪律照常。

## 现状接缝映射(权威 = 重设 spec + 2026-09-09 舞台 spec + PLAN「场景两态升级」「漫画视觉语言增强」行 + src)

| 蓝图元素 | 仓库落点 | 现状 / 守则 |
| --- | --- | --- |
| 背景氛围层(100% 画布) | `StageFrame`(全窗不滚帧)+ `StageSky`(氛围渐变 dawn/day/dusk/night/dark + 世界回春灰档 + 云/太阳位/山/村/河/浪) | 已落地勿重建;新幕在 scene `stage` 数据扩展;蓝图「暗角防抢镜」未建,要则加 index.css `.stage-sky` 遮罩,克制 |
| 角色层(居中/偏侧,安全区不遮文) | `StageCast` + CastFigure;`stage-meta.ts` `castFor` 预推全员 + skySplit(narrator 旁白特判) | 已落地勿重建;说者 talk 弹跳 / idle 静态,全员首帧同框,无临场滑入淡出(要则最小化);站位/朝向/阵营感 = P2 |
| 前景交互层(底/侧固定) | `DialoguePresenter`(角色旁气泡 + 整屏热区 + 主推进钮);task/social/boss 漫画面板;作答复用 Choice/ListenChoice/MatchGame | 气泡白底圆角细边 + 三角尾已建;情绪造型(锯齿/云泡/字号自适应)未建 = P2 扩展点 |
| 视觉源集中点 | 角色 emoji/名 = `ROLE_META`(`scene-ui.tsx`);素材/氛围/尺寸 = `stage-visuals.ts`(`roleScale` / `moodBorder` / `atmosphereToClass` / `worldDesatClass` / `STAGE_BODIES`);样式 token = index.css `.stage-sky--*` 等 | 换布景/氛围/太阳素材大多改 stage-visuals + css token,组件零改;角色立绘位图化另需动 ROLE_META/CastFigure → spec §10 位图升级,先 PLAN。勿组件内联绕过 |
| 情绪色盘(→ mood 边框) | `chapter.ts` 可选 `mood?` + `moodBorder`:sad → border-sky / happy → border-emerald / scary → border-red / 缺省 calm → border-hairline-strong | 情绪显著句才标,其余留空;抽象情绪色盘须转译成此载体(氛围渐变 + mood 边框 + token),勿直译 |
| 对白/旁白字级(Type Ramp) | 现有字号 token + index.css | 扩字级前看 `docs/frontend-dev-standard.md` + index.css |
| 灰→彩点亮 / ending 白闪 | StageSky restore 点亮;白闪接 `celebrate`(现死) | 核心已落地;逐元素精确编排 / ending 白闪留「场景两态升级」行 |
| 拟声词艺术字 / 镜头编排 / 材质网点 | P2 待办,在 DialoguePresenter/StageFrame + CSS/motion 上扩展 | 现无(仅说者弹跳/题卡滑动);勿声称已有;引擎零动 |

## 角色注册表(勿撞,加新 = 跨域大改)

- `SpeechRole` **五字面量** = `lingling` 苏灵灵🦊 / `xuwannian` 徐万年🦥 / `pixiaonao` 皮小闹🦝 / `changmo` 吴铭🦇 / `narrator` 旁白📖(`src/shared/services/speech.ts`)。**无群众位**。
- 角色视觉(emoji/名)= `ROLE_META`(`scene-ui.tsx`,5 项);嗓音表 `SPEECH_ROLE_VOICE`(`src/features/speech/speech.ts`,5 项)。
- **加新角色 = 改 `SpeechRole` union + `speech.contract.test` 断言 + `SPEECH_ROLE_VOICE` + `ROLE_META` + bible 一页卡 + 重设 spec 命名表,共 6 处**(见 bible §3.4)→ 跨语音域大改,撞「语音零动」红线。先 PLAN 立项,勿当视觉小事。
- 布景 emoji 别撞:`STAGE_BODIES`(太阳位 / 云 / 山 / 村 / 河 / 浪)。

## AI 素材回填仓库点

- 素材产出于外部 AI 工具(见技能 ai-materials)后回填:**角色立绘 / 表情集 / 待机** → `ROLE_META`(+ CastFigure 渲染改造,属 spec §10 位图升级);**布景/氛围素材** → `stage-visuals.ts` + index.css token。换位图组件基本零改。
- **角色锚点定稿存档:`docs/design/game-story-bible.md` §3.1 角色一页卡 · 外貌锚栏**(唯一事实源,主色/形态/剪影记忆点/状态变体)。
  ⚠ 2026-09-10 修正:原此处指向 `game-visual-design/references/role-anchors.md` —— 该文件从不存在,且把**项目数据**写进**通用技能**违反解耦纪律。通用技能只留 prompt 配方,项目锚点归项目文档。

## 现状快照(2026-09,防陈旧)

- 全窗舞台 = StageFrame(全窗不滚帧);布景实景化 + 世界回春已落地;**太阳位 = 固定单态布景**(无分档;旧的太阳分档机制与月星已随代码删除,`stage-visuals.ts` 现导出 `roleScale` / `moodBorder` / `atmosphereToClass` / `worldDesatClass` / `STAGE_BODIES`)。
- 真夜幕(night/dark)由 `StageSky` 的 `HIDES_SUN` **隐去布景太阳**;`t5` 台灯两幕已布 `atmosphere: 'night'`,BOSS 幕走默认 `dark`。
- ch1 现态:**数据 3 处 `mood`**(social 旁白 `scary` / social `onGood` `happy` / boss `win` `happy`);`stage.sky` 本章**无使用者**(通用机制 `skySplit` 保留)。设计新情绪句按 moodBorder 色标 sad/happy/scary,克制。
- 舞台化后 scene 结构纪律见 PLAN recent:「门在顶部 case / 杜绝嵌套 frame」。

## 指针

- **素材 prompt 定稿**:`docs/design/game-assets.md`(角色/布景/氛围/情绪符号,含回填映射与红线)
- **演出与交互分镜**:`docs/design/game-direction.md`(逐幕镜头/交互/转场/钩子)
- **角色锚点权威**:`docs/design/game-story-bible.md` §3.1 角色一页卡
- **本轮重设 spec**:`docs/superpowers/specs/2026-09-10-qianzigu-town-redesign-design.md`
- 舞台/视觉 spec: `docs/superpowers/specs/2026-09-09-qianzigu-manga-stage-design.md`(§6 组件/§8 ch1 舞台字段/§9 视觉动效规范/§15 布景实景化)
- plan: `docs/superpowers/plans/2026-09-09-qianzigu-manga-stage-*.md`
- PLAN 行:千字谷「场景两态升级」「跑章漫画舞台化」「漫画视觉语言增强(P2)」
