# 拼音短教单元锚点重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让拼音短教每声母/韵母拥有独立单字整音节锚点(emoji/读音不共享),并使合体 chip 朗读词内对应汉字而非整词。

**Architecture:** 纯前端数据 + 拆解派生变更:重写 `foundation/catalogs.ts` 声母/韵母锚值(符号集与计数不动)、`decompose.ts` 拼音音节增带词内汉字、`demo-blocks.ts` 合体 chip speak 改用音节汉字。消费方(TeachOverlay/teach-questions/持久化)契约不变。

**Tech Stack:** TypeScript 纯函数 + Vitest。无新依赖、无 db/API/worker 改动。

**Spec:** `docs/superpowers/specs/2026-09-06-pinyin-anchor-redesign-design.md`(plan 论证依据,执行时一并读)。

## Global Constraints

- 只改 `src/features/foundation/` 下文件。不碰 `PINYIN_TONES`、`ENGLISH_LETTERS`、worker/D1/API、词库 `words.ts`。
- catalogs 声母 23 / 韵母 34 的 `symbol`、`unitKey` 格式、顺序**一律不变**(worker `basics` unit_key 白名单依赖,`unit-key-charset.test.ts` 须保持绿)。
- 新锚硬约束(声母∪韵母):锚汉字两两不同、锚 emoji 两两不同、锚汉字单字、锚拼音单音节(无空格)。
- 韵母锚自拆归口恰本单元(single final);声母锚(除 `y`/`w`)自拆 `initial == symbol`;`y`/`w` 锚字以拼写 `y`/`w` 起头(两拼教学惯例列声母、算法零声母)。
- `ch/r/s → 车/日/伞` 沿用不换,`teach-questions.test.ts` 不须改。
- 朗读真相 = 汉字,zh-CN;无新增中文 UI 文案。
- 3 层架构边界 `architecture.test.ts` 保持绿(不新增跨 feature import)。

---

### Task 1: catalogs — 声母/韵母锚点值全量重写

**Files:**
- Modify: `src/features/foundation/catalogs.ts:22-47`(PINYIN_INITIALS 数组)、`:49-85`(PINYIN_FINALS 数组)、`:3-4`(文件头注释)
- Test: `src/features/foundation/decompose.test.ts`(追加不变量 describe)

**Interfaces:**
- Consumes: 现有类型 `InitialUnit`/`PinyinAnchor`(字段不变)
- Produces: 新锚值(仅内容),供 Task 2/3 及 quiz/demo 消费

- [ ] **Step 1: 在 decompose.test.ts 追加失败测试(锚不变量)**

文件顶部 import 补 `type { WordUnit }`。在 `describe('catalogs 完整性')` 后追加:

```ts
const pseudoUnit = (pinyin: string, hanzi: string): WordUnit =>
  ({ id: -1, emoji: '', pinyin, hanzi, english: '', category: 'shape' })

describe('锚点不变量:声母∪韵母独立单字整音节锚', () => {
  const all = [...PINYIN_INITIALS, ...PINYIN_FINALS]

  it('锚汉字两两不同、锚 emoji 两两不同', () => {
    const hanzi = all.map((u) => u.anchorHanzi)
    const emoji = all.map((u) => u.anchorEmoji)
    expect(new Set(hanzi).size).toBe(hanzi.length)
    expect(new Set(emoji).size).toBe(emoji.length)
  })

  it('锚汉字均单字、锚拼音均单音节(无空格)', () => {
    for (const u of all) {
      expect([...u.anchorHanzi]).toHaveLength(1)
      expect(u.anchorPinyin.includes(' ')).toBe(false)
    }
  })

  it('每个韵母锚单音节自拆归口恰本单元(无第二韵母)', () => {
    for (const f of PINYIN_FINALS) {
      const { pinyin } = decomposeWord(pseudoUnit(f.anchorPinyin, f.anchorHanzi))
      expect(pinyin.map((s) => s.final), `${f.symbol}(${f.anchorHanzi})`).toEqual([f.symbol])
    }
  })

  it('声母锚以该声母开头(y/w 例外:锚字以 y/w 拼写起头)', () => {
    for (const u of PINYIN_INITIALS) {
      if (u.symbol === 'y' || u.symbol === 'w') {
        expect(u.anchorPinyin[0]).toBe(u.symbol)
        continue
      }
      const { pinyin } = decomposeWord(pseudoUnit(u.anchorPinyin, u.anchorHanzi))
      expect(pinyin[0].initial, `${u.symbol}(${u.anchorHanzi})`).toBe(u.symbol)
    }
  })
})
```

- [ ] **Step 2: 运行确认红**

Run: `npx vitest run src/features/foundation/decompose.test.ts`
Expected: FAIL — 现锚整词/共享,唯一性、单字、单音节断言大面积红。

- [ ] **Step 3: 重写 PINYIN_INITIALS(替换 :23-47 整数组)**

```ts
export const PINYIN_INITIALS: InitialUnit[] = [
  { symbol: 'b', anchorPinyin: 'bà', anchorHanzi: '爸', anchorEmoji: '👨' },
  { symbol: 'p', anchorPinyin: 'pán', anchorHanzi: '盘', anchorEmoji: '🍽️' },
  { symbol: 'm', anchorPinyin: 'mā', anchorHanzi: '妈', anchorEmoji: '👩' },
  { symbol: 'f', anchorPinyin: 'fàn', anchorHanzi: '饭', anchorEmoji: '🍚' },
  { symbol: 'd', anchorPinyin: 'dàn', anchorHanzi: '蛋', anchorEmoji: '🥚' },
  { symbol: 't', anchorPinyin: 'tù', anchorHanzi: '兔', anchorEmoji: '🐰' },
  { symbol: 'n', anchorPinyin: 'niú', anchorHanzi: '牛', anchorEmoji: '🐮' },
  { symbol: 'l', anchorPinyin: 'lí', anchorHanzi: '梨', anchorEmoji: '🍐' },
  { symbol: 'g', anchorPinyin: 'guā', anchorHanzi: '瓜', anchorEmoji: '🍈' },
  { symbol: 'k', anchorPinyin: 'kǒu', anchorHanzi: '口', anchorEmoji: '👄' },
  { symbol: 'h', anchorPinyin: 'huā', anchorHanzi: '花', anchorEmoji: '🌸' },
  { symbol: 'j', anchorPinyin: 'jī', anchorHanzi: '鸡', anchorEmoji: '🐔' },
  { symbol: 'q', anchorPinyin: 'qiú', anchorHanzi: '球', anchorEmoji: '🏀' },
  { symbol: 'x', anchorPinyin: 'xié', anchorHanzi: '鞋', anchorEmoji: '👟' },
  { symbol: 'zh', anchorPinyin: 'zhū', anchorHanzi: '猪', anchorEmoji: '🐷' },
  { symbol: 'ch', anchorPinyin: 'chē', anchorHanzi: '车', anchorEmoji: '🚗' },
  { symbol: 'sh', anchorPinyin: 'shū', anchorHanzi: '书', anchorEmoji: '📖' },
  { symbol: 'r', anchorPinyin: 'rì', anchorHanzi: '日', anchorEmoji: '🌞' },
  { symbol: 'z', anchorPinyin: 'zú', anchorHanzi: '足', anchorEmoji: '🦶' },
  { symbol: 'c', anchorPinyin: 'cǎo', anchorHanzi: '草', anchorEmoji: '🌿' },
  { symbol: 's', anchorPinyin: 'sǎn', anchorHanzi: '伞', anchorEmoji: '☂️' },
  { symbol: 'y', anchorPinyin: 'yáng', anchorHanzi: '羊', anchorEmoji: '🐑' },
  { symbol: 'w', anchorPinyin: 'wǎng', anchorHanzi: '网', anchorEmoji: '🕸️' },
]
```

- [ ] **Step 4: 重写 PINYIN_FINALS(替换 :50-85 整数组)**

```ts
export const PINYIN_FINALS: PinyinAnchor[] = [
  { symbol: 'a', anchorPinyin: 'mǎ', anchorHanzi: '马', anchorEmoji: '🐴' },
  { symbol: 'o', anchorPinyin: 'ó', anchorHanzi: '哦', anchorEmoji: '😮' },
  { symbol: 'e', anchorPinyin: 'é', anchorHanzi: '鹅', anchorEmoji: '🪿' },
  { symbol: 'i', anchorPinyin: 'yī', anchorHanzi: '衣', anchorEmoji: '🧥' },
  { symbol: 'u', anchorPinyin: 'wū', anchorHanzi: '屋', anchorEmoji: '🏠' },
  { symbol: 'ü', anchorPinyin: 'yú', anchorHanzi: '鱼', anchorEmoji: '🐠' },
  { symbol: 'ai', anchorPinyin: 'ài', anchorHanzi: '爱', anchorEmoji: '❤️' },
  { symbol: 'ei', anchorPinyin: 'hēi', anchorHanzi: '黑', anchorEmoji: '⚫' },
  { symbol: 'ao', anchorPinyin: 'māo', anchorHanzi: '猫', anchorEmoji: '🐱' },
  { symbol: 'ou', anchorPinyin: 'gǒu', anchorHanzi: '狗', anchorEmoji: '🐶' },
  { symbol: 'an', anchorPinyin: 'shān', anchorHanzi: '山', anchorEmoji: '⛰️' },
  { symbol: 'en', anchorPinyin: 'mén', anchorHanzi: '门', anchorEmoji: '🚪' },
  { symbol: 'ang', anchorPinyin: 'fáng', anchorHanzi: '房', anchorEmoji: '🏡' },
  { symbol: 'eng', anchorPinyin: 'fēng', anchorHanzi: '风', anchorEmoji: '🌬️' },
  { symbol: 'ong', anchorPinyin: 'lóng', anchorHanzi: '龙', anchorEmoji: '🐉' },
  { symbol: 'ia', anchorPinyin: 'yā', anchorHanzi: '鸭', anchorEmoji: '🦆' },
  { symbol: 'ie', anchorPinyin: 'xiè', anchorHanzi: '蟹', anchorEmoji: '🦀' },
  { symbol: 'iao', anchorPinyin: 'niǎo', anchorHanzi: '鸟', anchorEmoji: '🐦' },
  { symbol: 'iou', anchorPinyin: 'yóu', anchorHanzi: '游', anchorEmoji: '🏊' },
  { symbol: 'ian', anchorPinyin: 'miàn', anchorHanzi: '面', anchorEmoji: '🍜' },
  { symbol: 'in', anchorPinyin: 'xīn', anchorHanzi: '心', anchorEmoji: '💗' },
  { symbol: 'iang', anchorPinyin: 'xiàng', anchorHanzi: '象', anchorEmoji: '🐘' },
  { symbol: 'ing', anchorPinyin: 'xīng', anchorHanzi: '星', anchorEmoji: '⭐' },
  { symbol: 'iong', anchorPinyin: 'xióng', anchorHanzi: '熊', anchorEmoji: '🐻' },
  { symbol: 'ua', anchorPinyin: 'wā', anchorHanzi: '蛙', anchorEmoji: '🐸' },
  { symbol: 'uo', anchorPinyin: 'guǒ', anchorHanzi: '果', anchorEmoji: '🍎' },
  { symbol: 'uei', anchorPinyin: 'guī', anchorHanzi: '龟', anchorEmoji: '🐢' },
  { symbol: 'uan', anchorPinyin: 'chuán', anchorHanzi: '船', anchorEmoji: '⛵' },
  { symbol: 'uen', anchorPinyin: 'wén', anchorHanzi: '蚊', anchorEmoji: '🦟' },
  { symbol: 'uang', anchorPinyin: 'chuāng', anchorHanzi: '窗', anchorEmoji: '🪟' },
  { symbol: 'üe', anchorPinyin: 'xuě', anchorHanzi: '雪', anchorEmoji: '❄️' },
  { symbol: 'üan', anchorPinyin: 'yuán', anchorHanzi: '圆', anchorEmoji: '⭕' },
  { symbol: 'ün', anchorPinyin: 'yún', anchorHanzi: '云', anchorEmoji: '☁️' },
  { symbol: 'ueng', anchorPinyin: 'wēng', anchorHanzi: '翁', anchorEmoji: '👴' },
]
```

- [ ] **Step 5: 更新文件头注释(:3-4)**

原「锚点尽量取自 100 词词库;无则用常见儿童词。」改为:

```ts
// 锚点为每单元独立单字整音节锚(声母∪韵母内汉字/emoji 全唯一,可超出词库,取常见儿童单字)。
// 声母锚 = 以该声母开头的单字整音节;韵母锚 = 含该韵母的单字整音节(单音节自拆只归口本韵母)。
```

- [ ] **Step 6: 运行测试确认绿**

Run: `npx vitest run src/features/foundation/decompose.test.ts src/features/foundation/teach-questions.test.ts src/features/foundation/unit-key-charset.test.ts`
Expected: PASS(新不变量绿;锚点诚实性扫描仍绿——单音节锚天然无夹带;ch/r/s 题照旧 车/日/伞;白名单照旧)。若某个新锚拆解归口错(如拼写未收录),`decomposeSyllable` 会抛「缺 Y_W/韵母未收录」,按错误修锚值(回到 spec §5 表核对)。

- [ ] **Step 7: Commit**

```bash
git add src/features/foundation/catalogs.ts src/features/foundation/decompose.test.ts
git commit -m "feat: 拼音短教声母/韵母锚点重写为独立单字整音节锚

修复人工验收:j/i 等 9 对声母/韵母共享整词锚(emoji/读音不独立)。
新锚汉字/emoji 轨内全唯一、单字单音节;韵母锚自拆归口恰本单元。
ch/r/s 沿用 车/日/伞。符号集与顺序不变,unit_key 白名单不受影响。"
```

---

### Task 2: decompose — 拼音音节携带词内汉字

**Files:**
- Modify: `src/features/foundation/decompose.ts:13-19`(PinyinSyllable 类型)、`:142-153`(decomposeWord)
- Test: `src/features/foundation/decompose.test.ts`(追加对齐 describe)

**Interfaces:**
- Consumes: Task 1 不变;`PinyinSyllable` 现有字段
- Produces: `PinyinSyllable` 增 `hanzi: string`(该音节在词内对应汉字);100 词音节数 == 汉字数已核 100/100,索引映射无死角

- [ ] **Step 1: 追加失败测试**

在 Task 1 新增 describe 之后追加:

```ts
describe('decompose 音节 ↔ 词内汉字对齐', () => {
  it('逐 100 词:拼音音节数与汉字数一致,逐位 hanzi 匹配', () => {
    for (const word of WORDS) {
      const chars = [...word.hanzi]
      const { pinyin } = decomposeWord(word)
      expect(pinyin.length).toBe(chars.length)
      pinyin.forEach((s, i) => expect(s.hanzi).toBe(chars[i]))
    }
  })
})
```

- [ ] **Step 2: 运行确认红**

Run: `npx vitest run src/features/foundation/decompose.test.ts`
Expected: FAIL — `s.hanzi` 现为 `undefined`,`toBe` 不匹配。

- [ ] **Step 3: 类型加 hanzi 字段(:13-19)**

```ts
/** 拆出的单音节。text = 原文(带调号,verbatim);initial 空即零声母;hanzi = 词内该音节对应汉字。 */
export type PinyinSyllable = {
  text: string
  initial: string | null
  final: string
  tone: number
  unitKeys: string[]
  hanzi: string
}
```

- [ ] **Step 4: decomposeWord 按序回填 hanzi(:142-153)**

```ts
export function decomposeWord(word: WordUnit): { pinyin: PinyinSyllable[]; english: EnglishLetter[] } {
  const chars = [...word.hanzi]
  const pinyin = word.pinyin
    .split(' ')
    .filter((s) => s.length > 0)
    .map((text, i) => ({ ...decomposeSyllable(text), hanzi: chars[i] ?? '' }))
  const english: EnglishLetter[] = []
  for (const ch of word.english) {
    const lower = ch.toLowerCase()
    if (/[a-z]/.test(lower)) english.push({ char: lower, unitKey: `english:${lower}` })
  }
  return { pinyin, english }
}
```

- [ ] **Step 5: 运行测试确认绿**

Run: `npx vitest run src/features/foundation/decompose.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/features/foundation/decompose.ts src/features/foundation/decompose.test.ts
git commit -m "feat: decompose 拼音音节携带词内对应汉字(hanzi)

100 词汉字数==音节数已核,按序回填。供合体 chip 逐音节朗读字音,
不再退读整词。越界兜底空串由消费方退整词。"
```

---

### Task 3: demo-blocks — 合体 chip 读词内对应汉字

**Files:**
- Modify: `src/features/foundation/demo-blocks.ts:1-5`(文件头注释)、`:56`(group.speak)
- Test: `src/features/foundation/demo-blocks.test.ts`(追加用例)

**Interfaces:**
- Consumes: Task 1 锚值 + Task 2 `PinyinSyllable.hanzi`;`DemoGroup.speak` 现语义 = 组读音文本
- Produces: 拼音合体 chip 点读 = 该音节词内汉字;砖 speak/emoji = 单元锚不变

- [ ] **Step 1: 追加失败测试**

在 demo-blocks.test.ts 追加 fixture 与用例:

```ts
const egg: WordUnit = { id: 1, emoji: '🥚', pinyin: 'jī dàn', hanzi: '鸡蛋', english: 'egg', category: 'food' }
const fish: WordUnit = { id: 2, emoji: '🐟', pinyin: 'yú', hanzi: '鱼', english: 'fish', category: 'food' }

describe('demoBlocksFor 合体 chip 读音', () => {
  it('多音节词:每音节 chip 读词内对应汉字,非整词', () => {
    const d = demoBlocksFor(egg, 'pinyin')
    expect(d.groups.map((g) => g.text)).toEqual(['jī', 'dàn'])
    expect(d.groups.map((g) => g.speak)).toEqual(['鸡', '蛋'])
  })
  it('声母 j 与韵母 i 砖卡锚点独立(emoji/读音各异)', () => {
    const d = demoBlocksFor(egg, 'pinyin')
    const j = d.blocks.find((b) => b.text === 'j')!
    const i = d.blocks.find((b) => b.text === 'i')!
    expect(j.speak).toBe('鸡')
    expect(i.speak).toBe('衣')
    expect(j.emoji).not.toBe(i.emoji)
  })
  it('单字词 chip 读音 = 该字', () => {
    const d = demoBlocksFor(fish, 'pinyin')
    expect(d.groups.map((g) => g.text)).toEqual(['yú'])
    expect(d.groups[0].speak).toBe('鱼')
  })
})
```

- [ ] **Step 2: 运行确认红**

Run: `npx vitest run src/features/foundation/demo-blocks.test.ts`
Expected: FAIL — group.speak 现为整词 `鸡蛋`/`鸡蛋`,`鱼` 词整词即 `鱼` 会过,靠前两条红。

- [ ] **Step 3: group.speak 改用音节汉字(:56)**

原 `groups.push({ text: s.text, speak: word.hanzi, blockIds: ids })` 改为:

```ts
    groups.push({ text: s.text, speak: s.hanzi || word.hanzi, blockIds: ids })
```

- [ ] **Step 4: 更新文件头注释(:3-4)**

原 `group.text = 带调音节 verbatim(UI 合体目标),点读该单元 catalogs 锚点汉字。` 改为:

```ts
//   group.text = 带调音节 verbatim(UI 合体目标);group.speak = 该音节在词内对应汉字(逐音节朗读字音)。
```

- [ ] **Step 5: 运行测试确认绿**

Run: `npx vitest run src/features/foundation/demo-blocks.test.ts src/features/foundation/decompose.test.ts`
Expected: PASS(含原「每个拼音砖可点读/英语逐字母」回归)。

- [ ] **Step 6: Commit**

```bash
git add src/features/foundation/demo-blocks.ts src/features/foundation/demo-blocks.test.ts
git commit -m "fix: 拼音短教合体 chip 读词内对应汉字而非整词

鸡蛋 → jī chip 读鸡、dàn chip 读蛋。逐音节字音,拆解对齐兜底整词。"
```

---

### Task 4: 全量回归 + 收尾

**Files:**
- Modify: `docs/PLAN.md:31`(feature 轨行勾选)

**Interfaces:**
- Consumes: Task 1-3 全部改动

- [ ] **Step 1: 全量测试 + lint**

Run: `npm test`
Expected: 全绿 — architecture 边界、foundation 全套(含锚点诚实性/白名单/teach-questions/estimator/coldstart/basics)、lesson/engine/vocabulary 等无回归。
Run: `npm run lint`
Expected: 无告警。

- [ ] **Step 2: PLAN.md 勾选该行**

`docs/PLAN.md:31` 行首 `- [ ]` 改 `- [x]`,链接不变。保留行级事实(标题/修法/链接),不抄细节。

- [ ] **Step 3: Commit**

```bash
git add docs/PLAN.md
git commit -m "docs: PLAN 拼音短教单元锚点重构完成"
```

- [ ] **Step 4: 人工验收提示(交给用户/收尾)**

dev 跑 `npm run dev`,验收重点:词 1 鸡蛋短教 — ① 合体 chip 点读 jī →「鸡」、dàn →「蛋」;② 演示/点读砖卡 j(🐔鸡)与 i(🧥衣)emoji/读音各异;③ 抽查 m(👩妈)/ao(🐱猫)、p(🍽️盘)/uo(🍎果)等曾撞轨对不再同锚;④ 🪿(鹅)/👴(翁)等生僻 emoji 在各系统渲染(缺字则回 spec §8 换图)。
