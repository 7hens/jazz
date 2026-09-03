# 魔法语言岛 v2 · 词库学习岛一期 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将「新手村 10 关关卡制」替换为「100 词词库 + 一词三技能步进 + 运行时出题」,保留 ADMIN_TOKEN 登录门与单档案,进度改 DB 行级存储。

**Architecture:** 复用现有答题交互壳与 quiz 三组件(Choice/ListenChoice/MatchGame 判别联合类型不变),新增纯逻辑层(words 数据 / engine 出题 / lesson 步序 / progress 结算),新增 worker 行级端点(progress + settings),地图改为分类词库网格(地图即主页)。旧关卡文件(levels.ts / 关卡版 state·scoring·MapView·LevelPlay·LevelResult)在纯逻辑层就绪后一次性删除并重写 App。

**Tech Stack:** React 19 + TS(strict,`verbatimModuleSyntax`/`erasableSyntaxOnly`)、Vite、Tailwind 4、Cloudflare Workers + D1、vitest(node,仅 `src/**/*.test.ts`)。

**Spec:** `docs/superpowers/specs/2026-09-03-word-island-v2-design.md`(以下称 spec;任务的取舍理由都从该 spec 出发)。

## Global Constraints

- 认证不变:`ADMIN_TOKEN` cookie 单档案,worker 每个 handler 先 `getAuthenticatedUser`。
- 词库 id 与解锁顺序一致(1..100,id===数组下标+1),沿用五分类 `shape|food|animal|nature|object`。
- 发音约定:拼音/汉字技能朗读**汉字文本**;英语朗读英文;拼音串只显示不朗读。
- 题型组合限制:一期只 choice / listen-choice / match,不做 fillBlank(二期)。
- 选项数:`word.id <= 20 → 3 项`,其余 `4 项`。
- 进度完成只升不降;星尘:技能步首过 +30、词全启用技能完成首达 +20;重学不重复发。
- 源文件风格:`import type` 仅导类型;禁 enum/namespace;oxlint 与 `tsc -b` 全绿为每个任务的验收。
- UI 文案一律中文。

---

### Task 1: types.ts 追加词库类型(不动旧类型)

**Files:**
- Modify: `src/types.ts`(文件尾部追加;不删任何现有导出)

**Interfaces:**
- Produces(后续全链依赖):
  ```ts
  export type SkillKey = 'pinyin' | 'hanzi' | 'english'
  export type CategoryKey = 'shape' | 'food' | 'animal' | 'nature' | 'object'

  export type WordUnit = {
    id: number; emoji: string; pinyin: string; hanzi: string; english: string; category: CategoryKey
  }

  export type WordProgress = {
    wordId: number
    completed: Record<SkillKey, boolean>
    starsEarned: number
    updatedAt: string
  }

  export type UserSettings = {
    enablePinyin: boolean; enableHanzi: boolean; enableEnglish: boolean; updatedAt: string
  }
  ```
  `KingdomKey`(现有)、`Question` 判别联合(现有:listen-choice/choice/match)继续被复用为新题对象类型,不改。

- [ ] **Step 1: 追加类型**

在 `src/types.ts` 末尾追加上述代码块(保留文件原有全部导出)。

- [ ] **Step 2: 类型与既有测试仍绿**

Run: `npm run build && npm test`
Expected: PASS(新增纯类型导出不改变旧编译;旧测试不受影响)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: types 追加词库类型(WordUnit/WordProgress/UserSettings/SkillKey)"
```

---

### Task 2: words.ts 100 词词库 + 数据完整性测试

**Files:**
- Create: `src/data/words.ts`
- Create: `src/game/words.test.ts`

**Interfaces:**
- Consumes: `WordUnit`, `CategoryKey` (Task 1)
- Produces:
  ```ts
  export const WORDS: WordUnit[]            // 100 条,id 连续 1..100,顺序即解锁顺序
  export const CATEGORY_LABELS: Record<CategoryKey, string>
  // { shape:'基础形状', food:'食物', animal:'动物', nature:'自然界', object:'交通与物品' }
  export function wordById(id: number): WordUnit | undefined
  ```

- [ ] **Step 1: 写失败测试**

```ts
// src/game/words.test.ts
import { describe, expect, it } from 'vitest'
import { CATEGORY_LABELS, WORDS, wordById } from '../data/words'
import type { CategoryKey } from '../types'

const CATS = Object.keys(CATEGORY_LABELS) as CategoryKey[]

describe('词库数据完整性', () => {
  it('恰好 100 词且 id 与下标连续一致', () => {
    expect(WORDS).toHaveLength(100)
    WORDS.forEach((w, i) => expect(w.id).toBe(i + 1))
  })

  it('关键字段非空且汉字/英文全局唯一', () => {
    const hanzi = new Set(WORDS.map((w) => w.hanzi))
    const en = new Set(WORDS.map((w) => w.english))
    expect(hanzi.size).toBe(100)
    expect(en.size).toBe(100)
    for (const w of WORDS) {
      expect(w.emoji).toBeTruthy()
      expect(w.pinyin).toBeTruthy()
      expect(w.hanzi).toBeTruthy()
      expect(w.english).toBeTruthy()
    }
  })

  it('分类合法且每类 ≥ 8 词(保证同类别干扰项基数)', () => {
    for (const c of CATS) {
      expect(WORDS.filter((w) => w.category === c).length).toBeGreaterThanOrEqual(8)
    }
  })

  it('已知笔误已修正:饼干拼音为 bǐng gān', () => {
    const cookie = wordById(35)
    expect(cookie?.hanzi).toBe('饼干')
    expect(cookie?.pinyin).toBe('bǐng gān')
    expect(cookie?.english).toBe('cookie')
  })

  it('wordById 越界返回 undefined', () => {
    expect(wordById(0)).toBeUndefined()
    expect(wordById(101)).toBeUndefined()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/game/words.test.ts`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 写 100 词数据**

`src/data/words.ts` 全文(emoji 为拟定默认,内容正确性由二期人工校对;id/汉字/英文唯一由测试锁定):

```ts
import type { CategoryKey, WordUnit } from '../types'

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  shape: '基础形状',
  food: '食物',
  animal: '动物',
  nature: '自然界',
  object: '交通与物品',
}

export const WORDS: WordUnit[] = [
  // shape 1-20
  { id: 1, emoji: '☀️', pinyin: 'tài yáng', hanzi: '太阳', english: 'sun', category: 'shape' },
  { id: 2, emoji: '🌙', pinyin: 'yuè liang', hanzi: '月亮', english: 'moon', category: 'shape' },
  { id: 3, emoji: '⭐', pinyin: 'xīng xing', hanzi: '星星', english: 'star', category: 'shape' },
  { id: 4, emoji: '☁️', pinyin: 'yún', hanzi: '云', english: 'cloud', category: 'shape' },
  { id: 5, emoji: '⚽', pinyin: 'qiú', hanzi: '球', english: 'ball', category: 'shape' },
  { id: 6, emoji: '📖', pinyin: 'shū', hanzi: '书', english: 'book', category: 'shape' },
  { id: 7, emoji: '🚪', pinyin: 'mén', hanzi: '门', english: 'door', category: 'shape' },
  { id: 8, emoji: '🪟', pinyin: 'chuāng hu', hanzi: '窗户', english: 'window', category: 'shape' },
  { id: 9, emoji: '🕐', pinyin: 'zhōng', hanzi: '钟', english: 'clock', category: 'shape' },
  { id: 10, emoji: '🪁', pinyin: 'fēng zheng', hanzi: '风筝', english: 'kite', category: 'shape' },
  { id: 11, emoji: '⛰️', pinyin: 'shān', hanzi: '山', english: 'mountain', category: 'shape' },
  { id: 12, emoji: '☂️', pinyin: 'yǔ sǎn', hanzi: '雨伞', english: 'umbrella', category: 'shape' },
  { id: 13, emoji: '🏠', pinyin: 'fáng zi', hanzi: '房子', english: 'house', category: 'shape' },
  { id: 14, emoji: '🔑', pinyin: 'yào shi', hanzi: '钥匙', english: 'key', category: 'shape' },
  { id: 15, emoji: '☕', pinyin: 'bēi zi', hanzi: '杯子', english: 'cup', category: 'shape' },
  { id: 16, emoji: '🎩', pinyin: 'mào zi', hanzi: '帽子', english: 'hat', category: 'shape' },
  { id: 17, emoji: '👟', pinyin: 'xié zi', hanzi: '鞋子', english: 'shoe', category: 'shape' },
  { id: 18, emoji: '🎒', pinyin: 'bāo', hanzi: '包', english: 'bag', category: 'shape' },
  { id: 19, emoji: '💡', pinyin: 'tái dēng', hanzi: '台灯', english: 'lamp', category: 'shape' },
  { id: 20, emoji: '🎁', pinyin: 'lǐ wù', hanzi: '礼物', english: 'gift', category: 'shape' },
  // food 21-40
  { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' },
  { id: 22, emoji: '🍌', pinyin: 'xiāng jiāo', hanzi: '香蕉', english: 'banana', category: 'food' },
  { id: 23, emoji: '🥚', pinyin: 'jī dàn', hanzi: '鸡蛋', english: 'egg', category: 'food' },
  { id: 24, emoji: '🎂', pinyin: 'dàn gāo', hanzi: '蛋糕', english: 'cake', category: 'food' },
  { id: 25, emoji: '🍄', pinyin: 'mó gu', hanzi: '蘑菇', english: 'mushroom', category: 'food' },
  { id: 26, emoji: '🥕', pinyin: 'hú luó bo', hanzi: '胡萝卜', english: 'carrot', category: 'food' },
  { id: 27, emoji: '🍦', pinyin: 'bīng qí lín', hanzi: '冰淇淋', english: 'ice cream', category: 'food' },
  { id: 28, emoji: '🍩', pinyin: 'tián tián quān', hanzi: '甜甜圈', english: 'donut', category: 'food' },
  { id: 29, emoji: '🍉', pinyin: 'xī guā', hanzi: '西瓜', english: 'watermelon', category: 'food' },
  { id: 30, emoji: '🍓', pinyin: 'cǎo méi', hanzi: '草莓', english: 'strawberry', category: 'food' },
  { id: 31, emoji: '🍐', pinyin: 'lí', hanzi: '梨', english: 'pear', category: 'food' },
  { id: 32, emoji: '🍊', pinyin: 'chéng zi', hanzi: '橙子', english: 'orange', category: 'food' },
  { id: 33, emoji: '🍇', pinyin: 'pú tao', hanzi: '葡萄', english: 'grape', category: 'food' },
  { id: 34, emoji: '🍬', pinyin: 'táng guǒ', hanzi: '糖果', english: 'candy', category: 'food' },
  { id: 35, emoji: '🍪', pinyin: 'bǐng gān', hanzi: '饼干', english: 'cookie', category: 'food' },
  { id: 36, emoji: '🍕', pinyin: 'bǐ sà', hanzi: '披萨', english: 'pizza', category: 'food' },
  { id: 37, emoji: '🍞', pinyin: 'miàn bāo', hanzi: '面包', english: 'bread', category: 'food' },
  { id: 38, emoji: '🧀', pinyin: 'nǎi lào', hanzi: '奶酪', english: 'cheese', category: 'food' },
  { id: 39, emoji: '🧃', pinyin: 'guǒ zhī', hanzi: '果汁', english: 'juice', category: 'food' },
  { id: 40, emoji: '🥛', pinyin: 'niú nǎi', hanzi: '牛奶', english: 'milk', category: 'food' },
  // animal 41-60
  { id: 41, emoji: '🐱', pinyin: 'māo', hanzi: '猫', english: 'cat', category: 'animal' },
  { id: 42, emoji: '🐶', pinyin: 'gǒu', hanzi: '狗', english: 'dog', category: 'animal' },
  { id: 43, emoji: '🐰', pinyin: 'tù zi', hanzi: '兔子', english: 'rabbit', category: 'animal' },
  { id: 44, emoji: '🐟', pinyin: 'yú', hanzi: '鱼', english: 'fish', category: 'animal' },
  { id: 45, emoji: '🐦', pinyin: 'niǎo', hanzi: '鸟', english: 'bird', category: 'animal' },
  { id: 46, emoji: '🐭', pinyin: 'lǎo shǔ', hanzi: '老鼠', english: 'mouse', category: 'animal' },
  { id: 47, emoji: '🐸', pinyin: 'qīng wā', hanzi: '青蛙', english: 'frog', category: 'animal' },
  { id: 48, emoji: '🐢', pinyin: 'wū guī', hanzi: '乌龟', english: 'turtle', category: 'animal' },
  { id: 49, emoji: '🐮', pinyin: 'nǎi niú', hanzi: '奶牛', english: 'cow', category: 'animal' },
  { id: 50, emoji: '🐷', pinyin: 'zhū', hanzi: '猪', english: 'pig', category: 'animal' },
  { id: 51, emoji: '🐑', pinyin: 'mián yáng', hanzi: '绵羊', english: 'sheep', category: 'animal' },
  { id: 52, emoji: '🐤', pinyin: 'xiǎo jī', hanzi: '小鸡', english: 'chicken', category: 'animal' },
  { id: 53, emoji: '🦆', pinyin: 'yā zi', hanzi: '鸭子', english: 'duck', category: 'animal' },
  { id: 54, emoji: '🐴', pinyin: 'mǎ', hanzi: '马', english: 'horse', category: 'animal' },
  { id: 55, emoji: '🦁', pinyin: 'shī zi', hanzi: '狮子', english: 'lion', category: 'animal' },
  { id: 56, emoji: '🐘', pinyin: 'dà xiàng', hanzi: '大象', english: 'elephant', category: 'animal' },
  { id: 57, emoji: '🐵', pinyin: 'hóu zi', hanzi: '猴子', english: 'monkey', category: 'animal' },
  { id: 58, emoji: '🐻', pinyin: 'xióng', hanzi: '熊', english: 'bear', category: 'animal' },
  { id: 59, emoji: '🐼', pinyin: 'xióng māo', hanzi: '熊猫', english: 'panda', category: 'animal' },
  { id: 60, emoji: '🐯', pinyin: 'lǎo hǔ', hanzi: '老虎', english: 'tiger', category: 'animal' },
  // nature 61-80
  { id: 61, emoji: '🌸', pinyin: 'huā', hanzi: '花', english: 'flower', category: 'nature' },
  { id: 62, emoji: '🌳', pinyin: 'shù', hanzi: '树', english: 'tree', category: 'nature' },
  { id: 63, emoji: '🍃', pinyin: 'yè zi', hanzi: '叶子', english: 'leaf', category: 'nature' },
  { id: 64, emoji: '🌿', pinyin: 'cǎo', hanzi: '草', english: 'grass', category: 'nature' },
  { id: 65, emoji: '🌈', pinyin: 'cǎi hóng', hanzi: '彩虹', english: 'rainbow', category: 'nature' },
  { id: 66, emoji: '❄️', pinyin: 'xuě huā', hanzi: '雪花', english: 'snowflake', category: 'nature' },
  { id: 67, emoji: '🌵', pinyin: 'xiān rén zhǎng', hanzi: '仙人掌', english: 'cactus', category: 'nature' },
  { id: 68, emoji: '🌷', pinyin: 'yù jīn xiāng', hanzi: '郁金香', english: 'tulip', category: 'nature' },
  { id: 69, emoji: '🌻', pinyin: 'xiàng rì kuí', hanzi: '向日葵', english: 'sunflower', category: 'nature' },
  { id: 70, emoji: '🌹', pinyin: 'méi gui', hanzi: '玫瑰', english: 'rose', category: 'nature' },
  { id: 71, emoji: '🌲', pinyin: 'sōng shù', hanzi: '松树', english: 'pine tree', category: 'nature' },
  { id: 72, emoji: '🐝', pinyin: 'mì fēng', hanzi: '蜜蜂', english: 'bee', category: 'nature' },
  { id: 73, emoji: '🦋', pinyin: 'hú dié', hanzi: '蝴蝶', english: 'butterfly', category: 'nature' },
  { id: 74, emoji: '🐌', pinyin: 'wō niú', hanzi: '蜗牛', english: 'snail', category: 'nature' },
  { id: 75, emoji: '🐞', pinyin: 'piáo chóng', hanzi: '瓢虫', english: 'ladybug', category: 'nature' },
  { id: 76, emoji: '🕷️', pinyin: 'zhī zhū', hanzi: '蜘蛛', english: 'spider', category: 'nature' },
  { id: 77, emoji: '🐜', pinyin: 'mǎ yǐ', hanzi: '蚂蚁', english: 'ant', category: 'nature' },
  { id: 78, emoji: '🐳', pinyin: 'jīng yú', hanzi: '鲸鱼', english: 'whale', category: 'nature' },
  { id: 79, emoji: '🐬', pinyin: 'hǎi tún', hanzi: '海豚', english: 'dolphin', category: 'nature' },
  { id: 80, emoji: '🦈', pinyin: 'shā yú', hanzi: '鲨鱼', english: 'shark', category: 'nature' },
  // object 81-100
  { id: 81, emoji: '🚗', pinyin: 'qì chē', hanzi: '汽车', english: 'car', category: 'object' },
  { id: 82, emoji: '🚌', pinyin: 'gōng jiāo chē', hanzi: '公交车', english: 'bus', category: 'object' },
  { id: 83, emoji: '⛵', pinyin: 'xiǎo chuán', hanzi: '小船', english: 'boat', category: 'object' },
  { id: 84, emoji: '✈️', pinyin: 'fēi jī', hanzi: '飞机', english: 'plane', category: 'object' },
  { id: 85, emoji: '🚂', pinyin: 'huǒ chē', hanzi: '火车', english: 'train', category: 'object' },
  { id: 86, emoji: '🚲', pinyin: 'zì xíng chē', hanzi: '自行车', english: 'bicycle', category: 'object' },
  { id: 87, emoji: '🚀', pinyin: 'huǒ jiàn', hanzi: '火箭', english: 'rocket', category: 'object' },
  { id: 88, emoji: '🚚', pinyin: 'kǎ chē', hanzi: '卡车', english: 'truck', category: 'object' },
  { id: 89, emoji: '🪑', pinyin: 'yǐ zi', hanzi: '椅子', english: 'chair', category: 'object' },
  { id: 90, emoji: '🍽️', pinyin: 'zhuō zi', hanzi: '桌子', english: 'table', category: 'object' },
  { id: 91, emoji: '🛏️', pinyin: 'chuáng', hanzi: '床', english: 'bed', category: 'object' },
  { id: 92, emoji: '📱', pinyin: 'shǒu jī', hanzi: '手机', english: 'phone', category: 'object' },
  { id: 93, emoji: '🤖', pinyin: 'jī qì rén', hanzi: '机器人', english: 'robot', category: 'object' },
  { id: 94, emoji: '🏰', pinyin: 'chéng bǎo', hanzi: '城堡', english: 'castle', category: 'object' },
  { id: 95, emoji: '🎈', pinyin: 'qì qiú', hanzi: '气球', english: 'balloon', category: 'object' },
  { id: 96, emoji: '👑', pinyin: 'wáng guān', hanzi: '皇冠', english: 'crown', category: 'object' },
  { id: 97, emoji: '❤️', pinyin: 'ài xīn', hanzi: '爱心', english: 'heart', category: 'object' },
  { id: 98, emoji: '🕯️', pinyin: 'là zhú', hanzi: '蜡烛', english: 'candle', category: 'object' },
  { id: 99, emoji: '⛄', pinyin: 'xuě rén', hanzi: '雪人', english: 'snowman', category: 'object' },
  { id: 100, emoji: '🐉', pinyin: 'lóng', hanzi: '龙', english: 'dragon', category: 'object' },
]

export function wordById(id: number): WordUnit | undefined {
  return WORDS.find((w) => w.id === id)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/game/words.test.ts`
Expected: PASS(全部 5 项)

- [ ] **Step 5: 全量验证 + Commit**

Run: `npm run build && npm test`
Commit:

```bash
git add src/data/words.ts src/game/words.test.ts
git commit -m "feat: 100 词词库 words.ts + 完整性测试"
```

---

### Task 3: engine.ts 出题引擎 + 测试

**Files:**
- Create: `src/game/engine.ts`
- Create: `src/game/engine.test.ts`

**Interfaces:**
- Consumes: `WORDS`, `wordById` (Task 2); `WordUnit/SkillKey/Question/BaseOption/ChoiceQuestion/ListenChoiceQuestion/MatchQuestion` (types)
- Produces:
  ```ts
  export type Rng = () => number
  export function optionCountFor(wordId: number): number          // ≤20 → 3, 否则 4
  export function distractorsFor(word: WordUnit, count: number, rng?: Rng): WordUnit[]
       // 同 category 优先 → 不足跨类补齐;剔除与 word 的 hanzi/english/pinyin 相同者;返回恰 count 条
  export function textOf(word: WordUnit, skill: SkillKey): string
       // english→english; pinyin→pinyin; hanzi→hanzi
  export function speakOf(word: WordUnit, skill: SkillKey): string
       // english→english; pinyin→hanzi(同音汉字朗读); hanzi→hanzi
  export function makeStepQuestions(word: WordUnit, skill: SkillKey, rng?: Rng): Question[]
       // 返回恰 2 题。首题恒为 choice(看图);次题按 skill 变体:
       //   pinyin: rng<0.5 → listen-choice,否则再一道 choice(换干扰)
       //   hanzi : rng<0.5 → match,       否则 choice
       //   english:0.33 listen / 0.66 match / else choice
       // id 全局唯一:`{word.id}-{n}-{skill}-{kind}-{i}`
  ```

- [ ] **Step 1: 写失败测试**

```ts
// src/game/engine.test.ts
import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/words'
import { distractorsFor, makeStepQuestions, optionCountFor, speakOf, textOf } from './engine'
import type { Question } from '../types'

function allOptions(q: Question): string[] {
  if (q.kind === 'match') return [...q.left.map((o) => o.id), ...q.right.map((o) => o.id)]
  return q.options.map((o) => o.id)
}

describe('出题引擎', () => {
  const apple = WORDS[20] // id 21, food

  it('选项数按 id 门槛', () => {
    expect(optionCountFor(1)).toBe(3)
    expect(optionCountFor(20)).toBe(3)
    expect(optionCountFor(21)).toBe(4)
    expect(optionCountFor(100)).toBe(4)
  })

  it('同 category 优先抽取干扰项', () => {
    const d = distractorsFor(apple, 3)
    expect(d).toHaveLength(3)
    for (const w of d) {
      expect(w.id).not.toBe(apple.id)
      expect(w.category).toBe('food')
    }
  })

  it('同 category 不足时跨类补齐到指定数量', () => {
    // 请求超过同类别可用数 → 必须仍返回足够条
    const d = distractorsFor(apple, 30)
    expect(d).toHaveLength(30)
    expect(new Set(d.map((x) => x.id)).size).toBe(30)
  })

  it('textOf/speakOf 按技能取对字段', () => {
    expect(textOf(apple, 'pinyin')).toBe('píng guǒ')
    expect(textOf(apple, 'hanzi')).toBe('苹果')
    expect(textOf(apple, 'english')).toBe('apple')
    expect(speakOf(apple, 'pinyin')).toBe('苹果')
    expect(speakOf(apple, 'hanzi')).toBe('苹果')
    expect(speakOf(apple, 'english')).toBe('apple')
  })

  it('每步恰出 2 题且题干含正确答案', () => {
    for (const skill of ['pinyin', 'hanzi', 'english'] as const) {
      for (let seed = 0; seed < 20; seed++) {
        const qs = makeStepQuestions(apple, skill, () => seed / 21)
        expect(qs).toHaveLength(2)
        qs.forEach((q, n) => {
          const ids = allOptions(q)
          expect(new Set(ids).size).toBe(ids.length) // 全局唯一
          expect(q.kind).toMatch(/^(listen-choice|choice|match)$/)
          if (q.kind !== 'match') {
            expect(qs[n === 0 ? 0 : 1].kind).toBeDefined()
          }
        })
      }
    }
  })

  it('答案总在选项内且选项文本互不相同', () => {
    const q = makeStepQuestions(apple, 'english')[0]
    if (q.kind === 'match') return
    const texts = q.options.map((o) => o.text)
    expect(new Set(texts).size).toBe(texts.length)
    expect(q.options.some((o) => o.id === q.answerId)).toBe(true)
  })

  it('拼音题卡面是拼音、朗读文本是汉字', () => {
    const qs = makeStepQuestions(apple, 'pinyin')
    for (const q of qs) {
      if (q.kind === 'listen-choice') {
        expect(q.promptSpeak).toBe('苹果')
      }
      if (q.kind === 'choice' || q.kind === 'listen-choice') {
        const correct = q.options.find((o) => o.id === q.answerId)!
        expect(correct.text).toBe('píng guǒ')
        expect(correct.speak).toBe('苹果')
      }
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/game/engine.test.ts`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现 engine.ts**

```ts
// src/game/engine.ts
import { WORDS } from '../data/words'
import type {
  BaseOption, ChoiceQuestion, ListenChoiceQuestion, MatchQuestion, Question, SkillKey, WordUnit,
} from '../types'

export type Rng = () => number

export function optionCountFor(wordId: number): number {
  return wordId <= 20 ? 3 : 4
}

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 与 word 无关的基本随机源;无参调用给 Math.random,注入仅供测试确定性。 */
function defaultRng(): Rng {
  return Math.random
}

export function textOf(word: WordUnit, skill: SkillKey): string {
  return skill === 'english' ? word.english : skill === 'pinyin' ? word.pinyin : word.hanzi
}

export function speakOf(word: WordUnit, skill: SkillKey): string {
  return skill === 'english' ? word.english : word.hanzi // 拼音朗读用同音汉字
}

/** 干扰项:同 category 优先,不足跨类补齐;排除与 word 任何一门文本重复的词。 */
export function distractorsFor(word: WordUnit, count: number, rng: Rng = defaultRng()): WordUnit[] {
  const clash = (w: WordUnit) =>
    w.hanzi === word.hanzi || w.english.toLowerCase() === word.english.toLowerCase() || w.pinyin === word.pinyin
  const sameCat = WORDS.filter((w) => w.category === word.category && w.id !== word.id && !clash(w))
  const others = WORDS.filter((w) => w.category !== word.category && w.id !== word.id && !clash(w))
  const pool = shuffle([...sameCat, ...others], rng)
  if (pool.length < count) {
    throw new Error(`词库不足以生成 ${count} 个干扰项`)
  }
  return pool.slice(0, count)
}

// 文字选项(choice/listen 卡面):显示 textOf,可点读 speakOf。不放 emoji——
// choice 题题干大图由 UI 层传 word.emoji,选项放 emoji 会变成「看图选图」。
function textOption(word: WordUnit, skill: SkillKey, seed: string): BaseOption {
  return { id: seed, text: textOf(word, skill), speak: speakOf(word, skill) }
}

// 图选项(match 右列):只显示 emoji,文字留空。
function emojiOption(word: WordUnit, seed: string): BaseOption {
  return { id: seed, text: '', emoji: word.emoji }
}

const SKILL_PROMPT: Record<SkillKey, string> = {
  pinyin: '图片是什么?选出它的拼音',
  hanzi: '图片是什么?选出它的汉字',
  english: '图片是什么?选出它的英文',
}

// 组合一条目标词 + size-1 干扰词的文字选项;answerId 用词引用对齐,避免同音歧义。
function buildTextQuestion(
  kind: 'choice' | 'listen-choice',
  word: WordUnit,
  skill: SkillKey,
  rng: Rng,
): ChoiceQuestion | ListenChoiceQuestion {
  const size = optionCountFor(word.id)
  const distractors = distractorsFor(word, size - 1, rng)
  const picks = shuffle([word, ...distractors], rng) // 恒 size 项,word 必在
  const seed = `${word.id}-${kind === 'choice' ? 'c' : 'l'}-${skill}`
  const options = picks.map((w, i) => textOption(w, skill, `${seed}-${i}`))
  const answerId = options[picks.indexOf(word)].id
  const prompt =
    kind === 'choice' ? SKILL_PROMPT[skill] : '听一听,选出你听到的'
  return kind === 'choice'
    ? { kind: 'choice', prompt, options, answerId }
    : { kind: 'listen-choice', prompt, promptSpeak: speakOf(word, skill), options, answerId }
}

export function makeChoice(word: WordUnit, skill: SkillKey, rng: Rng): ChoiceQuestion {
  return buildTextQuestion('choice', word, skill, rng) as ChoiceQuestion
}

export function makeListen(word: WordUnit, skill: SkillKey, rng: Rng): ListenChoiceQuestion {
  return buildTextQuestion('listen-choice', word, skill, rng) as ListenChoiceQuestion
}

export function makeMatch(word: WordUnit, skill: SkillKey, rng: Rng): MatchQuestion {
  const size = optionCountFor(word.id)
  const picks = shuffle([word, ...distractorsFor(word, size - 1, rng)], rng) // 恒 size 项,word 必在
  // 两阶段配对:先按词对象给每张图打上"属于哪个词",再做两次独立 shuffle。
  // 左卡 = 每个词的文字;右卡 = 每个词的图;answerMap 经 word 引用关联 ——
  // 左右各自乱序,配对始终指向同一词,不依赖下标与 emoji 文本唯一。
  type Tagged = { opt: BaseOption; word: WordUnit }
  const leftRaw = picks.map<{ opt: BaseOption; word: WordUnit }>((w, i) => ({
    opt: textOption(w, skill, `${word.id}-m-${skill}-l${i}`),
    word: w,
  }))
  const rightRaw = picks.map<Tagged>((w, i) => ({
    opt: emojiOption(w, `${word.id}-m-${skill}-r${i}`),
    word: w,
  }))
  const left = shuffle(leftRaw, rng)
  const right = shuffle(rightRaw, rng)
  const rightIdByWord = new Map<WordUnit, string>()
  right.forEach((tag) => rightIdByWord.set(tag.word, tag.opt.id))
  const answerMap: Record<string, string> = {}
  left.forEach((tag) => {
    answerMap[tag.opt.id] = rightIdByWord.get(tag.word)!.id
  })
  return {
    kind: 'match',
    prompt: `把「${textOf(word, skill)}」和对应的图片连起来吧`,
    left: left.map((t) => t.opt),
    right: right.map((t) => t.opt),
    answerMap,
  }
}

/** 一步 2 题:首题恒 choice;次题按技能概率选变体。 */
export function makeStepQuestions(word: WordUnit, skill: SkillKey, rng: Rng = defaultRng()): Question[] {
  const first: Question = makeChoice(word, skill, rng)
  const roll = rng()
  let second: Question
  if (skill === 'pinyin') {
    second = roll < 0.5 ? makeListen(word, skill, rng) : makeChoice(word, skill, rng)
  } else if (skill === 'hanzi') {
    second = roll < 0.5 ? makeMatch(word, skill, rng) : makeChoice(word, skill, rng)
  } else {
    second = roll < 0.33 ? makeListen(word, skill, rng) : roll < 0.66 ? makeMatch(word, skill, rng) : makeChoice(word, skill, rng)
  }
  return [first, second]
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/game/engine.test.ts`
Expected: PASS

- [ ] **Step 5: 全量验证 + Commit**

Run: `npm run build && npm test`
Commit:

```bash
git add src/game/engine.ts src/game/engine.test.ts
git commit -m "feat: 运行时出题引擎 engine.ts + 测试"
```

---

### Task 4: lesson.ts 步序 / 完成判定 / 解锁 + 测试

**Files:**
- Create: `src/game/lesson.ts`
- Create: `src/game/lesson.test.ts`

**Interfaces:**
- Consumes: `WordProgress`, `UserSettings`, `SkillKey` (types)
- Produces:
  ```ts
  export const SKILL_ORDER: readonly SkillKey[]        // ['pinyin','hanzi','english']
  export function stepsFor(settings: UserSettings): SkillKey[]   // 过滤;空则强制 ['english']
  export function enabledSkills(settings: UserSettings): SkillKey[]
  export function fullComplete(p: WordProgress | undefined, settings: UserSettings): boolean
       // 启用技能全部 completed 即真;未启用技能不计。
  export function firstTargetId(words: Record<number, WordProgress>, settings: UserSettings): number
       // 从 1 扫到 100,返回第一个未 fullComplete 的 id;全部完成返回 101(无解锁)。
  ```

- [ ] **Step 1: 写失败测试**

```ts
// src/game/lesson.test.ts
import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/words'
import { firstTargetId, fullComplete, stepsFor } from './lesson'
import type { UserSettings, WordProgress } from '../types'

const allOn = (): UserSettings => ({ enablePinyin: true, enableHanzi: true, enableEnglish: true, updatedAt: '' })
const p = (over: Partial<WordProgress> = {}): WordProgress => ({
  wordId: 1, completed: { pinyin: false, hanzi: false, english: false }, starsEarned: 0, updatedAt: '', ...over,
})

describe('lesson 步序与完成', () => {
  it('stepsFor 默认三技能顺序', () => {
    expect(stepsFor(allOn())).toEqual(['pinyin', 'hanzi', 'english'])
  })

  it('stepsFor 关闭技能即裁剪', () => {
    expect(stepsFor({ ...allOn(), enableHanzi: false })).toEqual(['pinyin', 'english'])
  })

  it('全关强制英语', () => {
    expect(stepsFor({ enablePinyin: false, enableHanzi: false, enableEnglish: false, updatedAt: '' })).toEqual(['english'])
  })

  it('fullComplete 只看启用技能', () => {
    const donePy = p({ completed: { pinyin: true, hanzi: false, english: false } })
    expect(fullComplete(donePy, allOn())).toBe(false)
    expect(fullComplete(donePy, { ...allOn(), enableHanzi: false, enableEnglish: false })).toBe(true)
    expect(fullComplete(undefined, allOn())).toBe(false)
  })

  it('firstTargetId 找到首个未完成词', () => {
    const words: Record<number, WordProgress> = {}
    for (const w of WORDS.slice(0, 5)) {
      words[w.id] = p({ wordId: w.id, completed: { pinyin: true, hanzi: true, english: true } })
    }
    expect(firstTargetId(words, allOn())).toBe(6)
    expect(firstTargetId({}, allOn())).toBe(1)
  })

  it('全部完成返回 101', () => {
    const words: Record<number, WordProgress> = {}
    for (const w of WORDS) words[w.id] = p({ wordId: w.id, completed: { pinyin: true, hanzi: true, english: true } })
    expect(firstTargetId(words, allOn())).toBe(101)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/game/lesson.test.ts`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现 lesson.ts**

```ts
// src/game/lesson.ts
import type { SkillKey, UserSettings, WordProgress } from '../types'
import { WORDS } from '../data/words'

export const SKILL_ORDER: readonly SkillKey[] = ['pinyin', 'hanzi', 'english']

export function enabledSkills(settings: UserSettings): SkillKey[] {
  return SKILL_ORDER.filter((s) => settings[`enable${s[0].toUpperCase()}${s.slice(1)}` as 'enablePinyin'])
}

export function stepsFor(settings: UserSettings): SkillKey[] {
  const on = enabledSkills(settings)
  return on.length > 0 ? on : ['english']
}

export function fullComplete(p: WordProgress | undefined, settings: UserSettings): boolean {
  if (!p) return false
  return enabledSkills(settings).every((s) => p.completed[s])
}

export function firstTargetId(words: Record<number, WordProgress>, settings: UserSettings): number {
  for (const w of WORDS) {
    if (!fullComplete(words[w.id], settings)) return w.id
  }
  return WORDS.length + 1
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/game/lesson.test.ts`
Expected: PASS

- [ ] **Step 5: 全量验证 + Commit**

Run: `npm run build && npm test`
Commit:

```bash
git add src/game/lesson.ts src/game/lesson.test.ts
git commit -m "feat: 步序/完成判定/解锁 lesson.ts + 测试"
```

---

### Task 5: progress.ts 空态 / 校验 / 合并 / 称号 / 结算 + 测试

**Files:**
- Create: `src/game/progress.ts`
- Create: `src/game/progress.test.ts`

**Interfaces:**
- Consumes: types (Task 1); `firstTargetId` 不需要——只做单词结算。
- Produces:
  ```ts
  export function emptyProgress(wordId: number): WordProgress
  export function isValidWordProgress(s: unknown): s is WordProgress
  export function mergeProgress(local: WordProgress, server: WordProgress): WordProgress
       // completed 取 OR,starsEarned 取 max,updatedAt 取较新本地时刻
  export const TITLE_STEPS: ReadonlyArray<{ threshold: number; name: string }>
       // 依 spec §11.2:0 语言初学者 /300 小画家 /1000 拼音小达人 /2500 汉字小能手 /5000 英语小明星 /8000 语言小法师 /12000 语言大法师
  export function titleForStars(total: number): { name: string; level: number }
  export type SkillPass = { skill: SkillKey; passed: boolean }
  export function settleWord(wordId: number, prev: WordProgress | undefined, passes: SkillKey[], settings: UserSettings):
       { next: WordProgress; stepReward: number; wordBonus: number }
       // passes 里 passed=true 且 prev.completed 仍为 false 的技能 → +30 并置 true;
       // settle 后若 fullComplete(next, settings) 且 settle 前 prev 未 fullComplete → wordBonus +20。
       // stepReward/wordBonus 即本次应发星尘(重学已领 → 0)。
  ```

- [ ] **Step 1: 写失败测试**

```ts
// src/game/progress.test.ts
import { describe, expect, it } from 'vitest'
import { emptyProgress, isValidWordProgress, mergeProgress, settleWord, titleForStars } from './progress'
import { fullComplete } from './lesson'
import type { SkillKey, UserSettings, WordProgress } from '../types'

const allOn = (): UserSettings => ({ enablePinyin: true, enableHanzi: true, enableEnglish: true, updatedAt: '' })

describe('progress 纯态', () => {
  it('空态与校验', () => {
    const e = emptyProgress(5)
    expect(e.wordId).toBe(5)
    expect(e.completed).toEqual({ pinyin: false, hanzi: false, english: false })
    expect(isValidWordProgress(e)).toBe(true)
    expect(isValidWordProgress(null)).toBe(false)
    expect(isValidWordProgress({ ...e, completed: { pinyin: true } })).toBe(false)
  })

  it('合并:completed 升、stars 取大', () => {
    const a = emptyProgress(1)
    const b: WordProgress = { ...emptyProgress(1), completed: { pinyin: true, hanzi: false, english: true }, starsEarned: 60 }
    const m = mergeProgress(a, b)
    expect(m.completed.pinyin).toBe(true)
    expect(m.completed.hanzi).toBe(false)
    expect(m.starsEarned).toBe(60)
  })

  it('称号阈值与等级', () => {
    expect(titleForStars(0).name).toBe('语言初学者')
    expect(titleForStars(299).level).toBe(1)
    expect(titleForStars(300).name).toBe('小画家')
    expect(titleForStars(12000).name).toBe('语言大法师')
  })

  it('结算:首过技能步 +30,词全完成 +20', () => {
    const r = settleWord(21, undefined, [
      { skill: 'pinyin', passed: true },
      { skill: 'pinyin', passed: true },
    ], allOn())
    expect(r.stepReward).toBe(30) // 同一技能重复 pass 只计一次
    expect(r.wordBonus).toBe(0)
    expect(r.next.completed.pinyin).toBe(true)
  })

  it('结算:三技能齐 → 词完成 +20', () => {
    const r = settleWord(21, undefined, [
      { skill: 'pinyin', passed: true },
      { skill: 'hanzi', passed: true },
      { skill: 'english', passed: true },
    ], allOn())
    expect(r.stepReward).toBe(90)
    expect(r.wordBonus).toBe(20)
    expect(fullComplete(r.next, allOn())).toBe(true)
  })

  it('结算:已领过的技能重学不重复发', () => {
    const prev: WordProgress = {
      wordId: 21,
      completed: { pinyin: true, hanzi: false, english: false },
      starsEarned: 30,
      updatedAt: '',
    }
    const r = settleWord(21, prev, [{ skill: 'pinyin', passed: true }], allOn())
    expect(r.stepReward).toBe(0)
    expect(r.next.starsEarned).toBe(30)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/game/progress.test.ts`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现 progress.ts**

```ts
// src/game/progress.ts
import type { SkillKey, UserSettings, WordProgress } from '../types'
import { fullComplete } from './lesson'

const ALL_SKILLS: readonly SkillKey[] = ['pinyin', 'hanzi', 'english']

export function emptyProgress(wordId: number): WordProgress {
  return {
    wordId,
    completed: { pinyin: false, hanzi: false, english: false },
    starsEarned: 0,
    updatedAt: new Date().toISOString(),
  }
}

export function isValidWordProgress(s: unknown): s is WordProgress {
  if (typeof s !== 'object' || s === null || Array.isArray(s)) return false
  const w = s as Record<string, unknown>
  if (typeof w.wordId !== 'number' || !Number.isInteger(w.wordId) || w.wordId < 1) return false
  const c = w.completed as Record<string, unknown> | null
  if (typeof c !== 'object' || c === null) return false
  if (!ALL_SKILLS.every((k) => typeof c[k] === 'boolean')) return false
  return typeof w.starsEarned === 'number' && Number.isFinite(w.starsEarned)
}

export function mergeProgress(local: WordProgress, server: WordProgress): WordProgress {
  return {
    wordId: local.wordId,
    completed: {
      pinyin: local.completed.pinyin || server.completed.pinyin,
      hanzi: local.completed.hanzi || server.completed.hanzi,
      english: local.completed.english || server.completed.english,
    },
    starsEarned: Math.max(local.starsEarned, server.starsEarned),
    updatedAt: new Date().toISOString(),
  }
}

export const TITLE_STEPS: ReadonlyArray<{ threshold: number; name: string }> = [
  { threshold: 0, name: '语言初学者' },
  { threshold: 300, name: '小画家' },
  { threshold: 1000, name: '拼音小达人' },
  { threshold: 2500, name: '汉字小能手' },
  { threshold: 5000, name: '英语小明星' },
  { threshold: 8000, name: '语言小法师' },
  { threshold: 12000, name: '语言大法师' },
]

export function titleForStars(total: number): { name: string; level: number } {
  let level = 1
  let name = TITLE_STEPS[0].name
  for (const t of TITLE_STEPS) {
    if (total >= t.threshold) {
      name = t.name
      level = t.threshold === 0 ? 1 : Math.max(level, TITLE_STEPS.findIndex((x) => x.threshold === t.threshold) + 1)
    }
  }
  return { name, level }
}

export type SkillPass = { skill: SkillKey; passed: boolean }

export function settleWord(
  wordId: number,
  prev: WordProgress | undefined,
  passes: SkillPass[],
  settings: UserSettings,
): { next: WordProgress; stepReward: number; wordBonus: number } {
  const base = prev ?? emptyProgress(wordId)
  const wasComplete = fullComplete(base, settings)
  const next = {
    wordId: base.wordId,
    completed: { ...base.completed },
    starsEarned: base.starsEarned,
    updatedAt: new Date().toISOString(),
  }
  let stepReward = 0
  for (const pass of passes) {
    if (!pass.passed) continue
    if (!next.completed[pass.skill]) {
      next.completed[pass.skill] = true
      stepReward += 30
    }
  }
  const isComplete = fullComplete(next, settings)
  const wordBonus = isComplete && !wasComplete ? 20 : 0
  next.starsEarned += stepReward + wordBonus
  return { next, stepReward, wordBonus }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/game/progress.test.ts`
Expected: PASS

- [ ] **Step 5: 全量验证 + Commit**

Run: `npm run build && npm test`
Commit:

```bash
git add src/game/progress.ts src/game/progress.test.ts
git commit -m "feat: 结算/合并/称号纯逻辑 progress.ts + 测试"
```

---

### Task 6: Choice 组件支持题干大图 promptEmoji

**Files:**
- Modify: `src/components/game/quiz/Choice.tsx`

**Interfaces:**
- Consumes: 现 props;新增可选 `promptEmoji?: string`(向下兼容;ListenChoice 透传含此 prop,但听力题调用方不传即无图)。
- Produces: `ChoiceProps` 增 `promptEmoji?: string`。题目卡片顶部居中渲染大 emoji(题干文字上方)。

- [ ] **Step 1: 类型加可选 promptEmoji**

在 `ChoiceProps` 里 `promptSpeak?: string` 之后插一行:

```diff
 export type ChoiceProps = {
   prompt: string
   promptSpeak?: string
+  promptEmoji?: string
   kingdom: KingdomKey | 'mixed'
   options: BaseOption[]
```

- [ ] **Step 2: 解构加入 promptEmoji**

`Choice({ prompt, promptSpeak, kingdom, ... })` 改为:

```diff
 export function Choice({
   prompt,
   promptSpeak,
+  promptEmoji,
   kingdom,
   options,
```

- [ ] **Step 3: return 顶部渲染大图**

`return (<div className="space-y-5">` 之后、`<div className="flex items-center justify-center gap-2 px-2">` 之前插入:

```diff
   return (
     <div className="space-y-5">
+      {promptEmoji ? (
+        <div className="flex justify-center pb-1" aria-hidden>
+          <span className="text-7xl leading-none drop-shadow-sm">{promptEmoji}</span>
+        </div>
+      ) : null}
       <div className="flex items-center justify-center gap-2 px-2">
```

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: PASS(纯追加可选 prop;旧调用方未传 promptEmoji → 渲染不变)

- [ ] **Step 5: Commit**

```bash
git add src/components/game/quiz/Choice.tsx
git commit -m "feat: Choice 支持题干大图 promptEmoji"
```

---
### Task 7: schema.sql + 迁移脚本

**Files:**
- Modify: `schema.sql`(移除 `game_state` 表与其上 FK;新增两表)
- Create: `migrations/2026-09-03-word-progress.sql`

**Interfaces:**
- Produces: D1 两表 `progress`、`user_settings`(结构即 Task 8/9 后端读写对象)。

- [ ] **Step 1: 改写 schema.sql 为新幂等来源**

`schema.sql` 全文替换为:

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '私密用户',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 词库学习进度:每词一行,按 user_id 隔离
CREATE TABLE IF NOT EXISTS progress (
  user_id   TEXT NOT NULL,
  word_id   INTEGER NOT NULL,
  pinyin_completed  INTEGER NOT NULL DEFAULT 0,
  hanzi_completed   INTEGER NOT NULL DEFAULT 0,
  english_completed INTEGER NOT NULL DEFAULT 0,
  stars_earned      INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, word_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);

-- 家长可配置的模块开关(单档案一行)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id        TEXT PRIMARY KEY,
  enable_pinyin  INTEGER NOT NULL DEFAULT 1,
  enable_hanzi   INTEGER NOT NULL DEFAULT 1,
  enable_english INTEGER NOT NULL DEFAULT 1,
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 2: 建迁移脚本**

`migrations/2026-09-03-word-progress.sql`:

```sql
-- v1 关卡制(game_state 整档)下线 → 词库行级 progress + user_settings。
-- 幂等:重复执行安全(DROP IF EXISTS + CREATE IF NOT EXISTS)。
DROP TABLE IF EXISTS game_state;
CREATE TABLE IF NOT EXISTS progress (
  user_id   TEXT NOT NULL,
  word_id   INTEGER NOT NULL,
  pinyin_completed  INTEGER NOT NULL DEFAULT 0,
  hanzi_completed   INTEGER NOT NULL DEFAULT 0,
  english_completed INTEGER NOT NULL DEFAULT 0,
  stars_earned      INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, word_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE TABLE IF NOT EXISTS user_settings (
  user_id        TEXT PRIMARY KEY,
  enable_pinyin  INTEGER NOT NULL DEFAULT 1,
  enable_hanzi   INTEGER NOT NULL DEFAULT 1,
  enable_english INTEGER NOT NULL DEFAULT 1,
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 3: 本地应用验证**

Run: `npm run db:apply && npm run db:migrate`
Expected: 无报错;两命令皆可重复执行。

- [ ] **Step 4: 提交**

```bash
git add schema.sql migrations/2026-09-03-word-progress.sql
git commit -m "feat: schema 迁移——progress/user_settings 行级表,下线 game_state"
```

---

### Task 8: worker 后端 progress + settings 行级端点

**Files:**
- Modify: `worker/index.ts`(路由:替换 /api/game 为 /api/progress + /api/settings)
- Create: `worker/progress.ts`
- Create: `worker/settings.ts`
- Delete: `worker/game.ts`
- Modify: `worker/_lib/http.ts` 不需要改。

**Interfaces:**
- Consumes: `getAuthenticatedUser`(worker/_lib/auth)、`jsonResponse`(worker/_lib/http)、`WordProgress/UserSettings`(前端 types 同步形态)、D1。
- Produces:
  - `worker/progress.ts`:
    ```ts
    export async function handleGetProgress(request, env): Promise<Response>
       // GET → { progress: WordProgress[] };user 无行返回空数组。
    export async function handlePutProgress(request, env): Promise<Response>
       // PUT body { progress: WordProgress[] } → 批量 upsert;
       // completed 列用 OR 合并、stars_earned 用 MAX;校验行数 ≤200、word_id 1..100。
    export async function handleDeleteProgress(request, env): Promise<Response>
       // DELETE → 清空该 user 全部行。
    ```
  - `worker/settings.ts`:
    ```ts
    export async function handleGetSettings(request, env): Promise<Response>
       // GET → { settings } 默认三开。
    export async function handlePutSettings(request, env): Promise<Response>
       // PUT body { settings } → upsert 单行。
    ```

- [ ] **Step 1: 写失败期望(以 tsc 为门)**

无 worker 单测框架;先写实现,用 `npx tsc -b worker` 报类型错驱动。

- [ ] **Step 2: 创建 worker/progress.ts(完整实现)**

```ts
import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

const MAX_WORD_ID = 100
const MAX_BATCH = 200

type Row = {
  word_id: number
  pinyin_completed: number
  hanzi_completed: number
  english_completed: number
  stars_earned: number
}

function toClient(r: Row) {
  return {
    wordId: r.word_id,
    completed: {
      pinyin: r.pinyin_completed === 1,
      hanzi: r.hanzi_completed === 1,
      english: r.english_completed === 1,
    },
    starsEarned: r.stars_earned,
  }
}

export async function handleGetProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const { results } = await env.DB.prepare(
    'SELECT word_id, pinyin_completed, hanzi_completed, english_completed, stars_earned FROM progress WHERE user_id = ? ORDER BY word_id',
  ).bind(user.id).all<Row>()
  return jsonResponse({ progress: results.map(toClient) })
}

export async function handlePutProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { progress?: unknown } | null
  const list = Array.isArray(body?.progress) ? body.progress : null
  if (!list || list.length === 0) return jsonResponse({ message: '进度数据不合法' }, { status: 400 })
  if (list.length > MAX_BATCH) return jsonResponse({ message: '进度数据过大' }, { status: 400 })
  const stmts: D1PreparedStatement[] = []
  for (const item of list) {
    const p = item as {
      wordId?: unknown; completed?: { pinyin?: unknown; hanzi?: unknown; english?: unknown }; starsEarned?: unknown
    }
    const wordId = p.wordId
    if (typeof wordId !== 'number' || !Number.isInteger(wordId) || wordId < 1 || wordId > MAX_WORD_ID) {
      return jsonResponse({ message: `非法的 word_id:${String(wordId)}` }, { status: 400 })
    }
    const c = p.completed ?? {}
    const bool = (v: unknown) => (v === true ? 1 : 0)
    const stars = typeof p.starsEarned === 'number' && Number.isFinite(p.starsEarned) ? Math.max(0, Math.floor(p.starsEarned)) : 0
    const stmt = env.DB.prepare(
      `INSERT INTO progress (user_id, word_id, pinyin_completed, hanzi_completed, english_completed, stars_earned, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, word_id) DO UPDATE SET
         pinyin_completed = MAX(progress.pinyin_completed, excluded.pinyin_completed),
         hanzi_completed  = MAX(progress.hanzi_completed, excluded.hanzi_completed),
         english_completed= MAX(progress.english_completed, excluded.english_completed),
         stars_earned     = MAX(progress.stars_earned, excluded.stars_earned),
         updated_at       = excluded.updated_at`,
    ).bind(
      user.id, wordId,
      bool(c.pinyin), bool(c.hanzi), bool(c.english),
      stars, new Date().toISOString(),
    )
    stmts.push(stmt)
  }
  await env.DB.batch(stmts)
  return jsonResponse({ ok: true, updated: stmts.length })
}

export async function handleDeleteProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  await env.DB.prepare('DELETE FROM progress WHERE user_id = ?').bind(user.id).run()
  return jsonResponse({ ok: true })
}
```


- [ ] **Step 3: 创建 worker/settings.ts**

```ts
import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

const DEFAULTS = { enable_pinyin: 1, enable_hanzi: 1, enable_english: 1 }

type SettingsRow = { enable_pinyin: number; enable_hanzi: number; enable_english: number }

export async function handleGetSettings(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const row = (await env.DB.prepare(
    'SELECT enable_pinyin, enable_hanzi, enable_english FROM user_settings WHERE user_id = ?',
  ).bind(user.id).first<SettingsRow>()) ?? DEFAULTS
  return jsonResponse({
    settings: {
      enablePinyin: row.enable_pinyin === 1,
      enableHanzi: row.enable_hanzi === 1,
      enableEnglish: row.enable_english === 1,
    },
  })
}

export async function handlePutSettings(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as {
    settings?: { enablePinyin?: unknown; enableHanzi?: unknown; enableEnglish?: unknown }
  } | null
  const s = body?.settings
  if (!s) return jsonResponse({ message: '设置不合法' }, { status: 400 })
  const b = (v: unknown) => (v === true ? 1 : 0)
  // 至少保留一项为真(默认英语)
  const py = s.enablePinyin === true
  const hz = s.enableHanzi === true
  const en = s.enableEnglish === true
  if (!py && !hz && !en) return jsonResponse({ message: '至少保留一个学习模块' }, { status: 400 })
  await env.DB.prepare(
    `INSERT INTO user_settings (user_id, enable_pinyin, enable_hanzi, enable_english, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       enable_pinyin=excluded.enable_pinyin, enable_hanzi=excluded.enable_hanzi,
       enable_english=excluded.enable_english, updated_at=excluded.updated_at`,
  ).bind(user.id, b(py), b(hz), b(en), new Date().toISOString()).run()
  return jsonResponse({ ok: true })
}
```

- [ ] **Step 4: 改 worker/index.ts 路由**

```ts
import { handleLogin, handleLogout, handleMe } from './auth'
import { jsonResponse } from './_lib/http'
import { handleGetProgress, handlePutProgress, handleDeleteProgress } from './progress'
import { handleGetSettings, handlePutSettings } from './settings'

export interface Env {
  DB: D1Database
  ADMIN_TOKEN?: string
  ASSETS?: Fetcher
}

function methodNotAllowed() {
  return jsonResponse({ message: 'Method Not Allowed' }, { status: 405 })
}
function notFound() {
  return jsonResponse({ message: 'Not Found' }, { status: 404 })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    const method = request.method

    switch (pathname) {
      case '/api/auth/login':
        if (method === 'POST') return handleLogin(request, env)
        if (method === 'GET') return handleMe(request, env)
        return methodNotAllowed()
      case '/api/auth/logout':
        if (method === 'POST') return handleLogout()
        return methodNotAllowed()
      case '/api/me':
        if (method === 'GET') return handleMe(request, env)
        return methodNotAllowed()
      case '/api/progress':
        if (method === 'GET') return handleGetProgress(request, env)
        if (method === 'PUT') return handlePutProgress(request, env)
        if (method === 'DELETE') return handleDeleteProgress(request, env)
        return methodNotAllowed()
      case '/api/settings':
        if (method === 'GET') return handleGetSettings(request, env)
        if (method === 'PUT') return handlePutSettings(request, env)
        return methodNotAllowed()
      default:
        if (pathname.startsWith('/api/')) return notFound()
        if (env.ASSETS) return env.ASSETS.fetch(request)
        return notFound()
    }
  },
}
```

删除 `import { handleGetGame, handlePutGame } from './game'` 及 `/api/game` case;删除 `worker/game.ts`。

- [ ] **Step 5: 类型与构建验证**

Run: `npm run build`
Expected: PASS(app + worker 两工程均编译;`tsc -b` 含 worker reference)。

- [ ] **Step 6: Commit**

```bash
git add worker/index.ts worker/progress.ts worker/settings.ts schema.sql
git rm worker/game.ts
git commit -m "feat: worker 行级 progress/settings 端点,下线 /api/game 整档"
```

---

### Task 9: UI 家长面板 — SettingsPanel 与家长菜单

**Files:**
- Create: `src/components/game/SettingsPanel.tsx`

**Interfaces:**
- Consumes: `UserSettings`, `SkillKey` (types);ui Button。
- Produces:
  ```tsx
  export type SettingsPanelProps = {
    settings: UserSettings
    onChange: (next: UserSettings) => void
    onClose: () => void
  }
  ```
  渲染:顶部标题「学习设置」+ 关闭钮;三项 Switch(拼音/汉字/英语);防全关——取消最后一项时自动拒绝并把该行保持选中;切换即调 `onChange({...settings, [key]: v, updatedAt: new Date().toISOString()})`。底部按钮「完成」= onClose。

- [ ] **Step 1: 实现 SettingsPanel.tsx**

参考现有弹层(如 MapView 家长菜单)风格,用 fixed inset + 居中 card + 遮罩点击关闭。模块行按 `SKILL_ORDER`(Task 4)顺序,文案:拼音/汉字/英语。每行右侧一个拟态开关(button 带 `aria-pressed`,样式 on=emerald / off=surface-3)。

```tsx
import { X } from 'lucide-react'
import { SKILL_ORDER } from '../../game/lesson'
import { cn } from '../../lib/utils'
import type { SkillKey, UserSettings } from '../../types'
import { Button } from '../ui/button'

export type SettingsPanelProps = {
  settings: UserSettings
  onChange: (next: UserSettings) => void
  onClose: () => void
}

const LABELS: Record<SkillKey, string> = { pinyin: '拼音', hanzi: '汉字', english: '英语' }

function keyFor(skill: SkillKey): 'enablePinyin' | 'enableHanzi' | 'enableEnglish' {
  return ('enable' + skill[0].toUpperCase() + skill.slice(1)) as 'enablePinyin' | 'enableHanzi' | 'enableEnglish'
}

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  function toggle(skill: SkillKey) {
    const key = keyFor(skill)
    // 防全关:若正在关闭的项是当前唯一开启项,拒绝(保持选中)。
    if (settings[key] && SKILL_ORDER.every((s) => s === skill || !settings[keyFor(s)])) return
    onChange({ ...settings, [key]: !settings[key], updatedAt: new Date().toISOString() })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-[1.75rem] border border-hairline bg-surface p-5 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">学习设置</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-3">
          {SKILL_ORDER.map((skill) => {
            const on = settings[keyFor(skill)]
            return (
              <button
                key={skill}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(skill)}
                className="flex w-full items-center justify-between rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-left"
              >
                <span className="text-[15px] font-semibold">{LABELS[skill]} 学习</span>
                <span
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    on ? 'bg-emerald' : 'bg-ink/20',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      on ? 'translate-x-[22px]' : 'translate-x-0.5',
                    )}
                  />
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-ink-3">至少保留一个学习模块。设置会同步到本设备。</p>
        <Button size="lg" className="mt-4 w-full" onClick={onClose}>
          完成
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: PASS(组件尚未被引用亦可编译;tsconfig include 全 src)

- [ ] **Step 3: Commit**

```bash
git add src/components/game/SettingsPanel.tsx
git commit -m "feat: 学习设置面板(三模块开关+防全关)"
```

---

### Task 10: UI WordDone 词完成结算卡

**Files:**
- Create: `src/components/game/WordDone.tsx`

**Interfaces:**
- Consumes: `WordUnit`、`titleForStars` 不需要(由父算好传入展示)。
- Produces:
  ```tsx
  export type WordDoneProps = {
    word: WordUnit
    stepReward: number      // 本次技能步首过星尘
    wordBonus: number       // 本次词完成加成
    totalStars: number      // 结算后总星尘
    titleName: string       // 结算后称号名
    nextId: number          // 下一词 id(101 表示已全通)
    isLastWord: boolean
    onNext: () => void
    onMap: () => void
  }
  ```

- [ ] **Step 1: 实现 WordDone.tsx**

沿 LevelResult 视觉(token/shadow-pop/星星动效),但内容为词完成结算。标题按 `wordBonus > 0 ? '太棒了,整词完成!' : '这一步完成啦!'`;展示该词 emoji+hanzi、`+stepReward`、词加成徽章、当前总星尘与称号。按钮:有下一词(非全通)显示「下一词」primary;始终有「回地图」。

```tsx
import { motion } from 'motion/react'
import { ArrowRight, Home } from 'lucide-react'
import { play } from '../../game/sfx'
import { useEffect, useRef } from 'react'
import type { WordUnit } from '../../types'
import { Button } from '../ui/button'

export type WordDoneProps = {
  word: WordUnit
  stepReward: number
  wordBonus: number
  totalStars: number
  titleName: string
  nextId: number
  isLastWord: boolean
  onNext: () => void
  onMap: () => void
}

export function WordDone({
  word, stepReward, wordBonus, totalStars, titleName, nextId, isLastWord, onNext, onMap,
}: WordDoneProps) {
  const playedRef = useRef(false)
  useEffect(() => {
    if (playedRef.current) return
    playedRef.current = true
    play(wordBonus > 0 ? 'victory' : 'correct')
  }, [wordBonus])

  return (
    <div className="min-h-screen text-ink">
      <main className="mx-auto max-w-xl px-4 pb-24 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-hairline bg-surface p-6 text-center shadow-pop sm:p-8"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-ink-3">学习结算</p>
          <div className="mt-3 text-6xl" aria-hidden>{word.emoji}</div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{word.hanzi}</h1>
          <p className="text-sm text-ink-2">{word.pinyin} · {word.english}</p>

          <div className="mt-5 flex items-center justify-center gap-3">
            {stepReward > 0 ? (
              <div className="rounded-2xl border border-hairline bg-amber-100 px-4 py-2">
                <p className="text-xs font-semibold text-ink-3">技能步星尘</p>
                <p className="text-xl font-extrabold text-amber">+{stepReward}</p>
              </div>
            ) : null}
            {wordBonus > 0 ? (
              <div className="rounded-2xl border border-emerald/40 bg-emerald/10 px-4 py-2">
                <p className="text-xs font-semibold text-emerald">整词完成加成</p>
                <p className="text-xl font-extrabold text-emerald">+{wordBonus}</p>
              </div>
            ) : null}
          </div>
          <p className="mt-4 text-sm text-ink-2">星尘 {totalStars} · 称号 🎖 {titleName}</p>

          <div className="mt-6 space-y-2.5">
            {!isLastWord ? (
              <Button size="lg" className="w-full" onClick={() => { void play('tap'); onNext() }}>
                下一词 · {nextId} 号 <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button size="lg" className="w-full" onClick={onMap}>
                🎉 你已学完全部 100 词!
              </Button>
            )}
            <Button variant="outline" size="lg" className="w-full" onClick={onMap}>
              <Home className="mr-2 h-4 w-4" /> 回地图
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/game/WordDone.tsx
git commit -m "feat: 词完成结算卡 WordDone"
```

---

### Task 11: UI WordLesson 词学习答题器(替代 LevelPlay)

**Files:**
- Create: `src/components/game/WordLesson.tsx`

**Interfaces:**
- Consumes: `makeStepQuestions`(Task 3)、`stepsFor`(Task 4)、`play`(sfx)、quiz 三组件、`Question/SkillKey/UserSettings/WordUnit`(types)。
- Produces:
  ```tsx
  export type WordLessonProps = {
    word: WordUnit
    settings: UserSettings
    onStepPass: (skill: SkillKey) => void   // 一步(2题全过)后,由父结算星尘
    onLessonComplete: () => void            // 全部启用技能步完成后
    onExit: () => void
  }
  ```
  渲染语义:进入即作答当前技能步。一个 skill 的 2 题依次作答,都答对 → `onStepPass(skill)`,自动进入下一技能;最后一个技能步通过时先 `onStepPass` 再 `onLessonComplete`。任一题第 2 次答错 → 亮正确答案、整步**失败**并停在该步,点「再练一次」重建该 skill 的 2 题(重出随机题);失败不回调父层(不发星尘、不算完成)。

- [ ] **Step 1: 实现 WordLesson.tsx**

```tsx
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../../lib/utils'
import { makeStepQuestions } from '../../game/engine'
import { play } from '../../game/sfx'
import { stepsFor } from '../../game/lesson'
import type { Question, SkillKey, UserSettings, WordUnit } from '../../types'
import { Button } from '../ui/button'
import { Choice } from './quiz/Choice'
import { ListenChoice } from './quiz/ListenChoice'
import { MatchGame } from './quiz/MatchGame'

export type WordLessonProps = {
  word: WordUnit
  settings: UserSettings
  onStepPass: (skill: SkillKey) => void
  onLessonComplete: () => void
  onExit: () => void
}

const SKILL_LABEL: Record<SkillKey, string> = { pinyin: '拼音', hanzi: '汉字', english: '英语' }

const CORRECT_DELAY_MS = 650

export function WordLesson({ word, settings, onStepPass, onLessonComplete, onExit }: WordLessonProps) {
  const steps = stepsFor(settings)
  const [stepIndex, setStepIndex] = useState(0)
  const [round, setRound] = useState(0) // 失败重建同步
  const [questions, setQuestions] = useState<Question[]>(() => makeStepQuestions(word, steps[0], Math.random))
  const [qIndex, setQIndex] = useState(0)
  const [attempt, setAttempt] = useState<1 | 2>(1)
  const [phase, setPhase] = useState<'answering' | 'feedback' | 'reveal'>('answering')
  const [revealId, setRevealId] = useState<string | null>(null)
  const [wrongId, setWrongId] = useState<string | null>(null)
  const [correctId, setCorrectId] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const skill = steps[stepIndex]
  const q: Question = questions[qIndex]
  const isLastStep = stepIndex === steps.length - 1
  const isLastQuestion = qIndex === questions.length - 1

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  // step/round 变化 → 重新出题并复位
  useEffect(() => {
    setQuestions(makeStepQuestions(word, steps[stepIndex], Math.random))
    setQIndex(0)
    setAttempt(1)
    setPhase('answering')
    setRevealId(null)
    setWrongId(null)
    setCorrectId(null)
  }, [word, stepIndex, round]) // eslint-disable-line react-hooks/exhaustive-deps

  function later(fn: () => void, ms: number) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      fn()
    }, ms)
  }

  function stepPassed() {
    onStepPass(skill)
    if (isLastStep) {
      onLessonComplete()
      return
    }
    setStepIndex((i) => i + 1) // 触发 effect 换题
  }

  function goNextQuestion() {
    if (isLastQuestion) {
      stepPassed()
      return
    }
    setQIndex((i) => i + 1)
    setAttempt(1)
    setPhase('answering')
    setRevealId(null)
    setWrongId(null)
    setCorrectId(null)
  }

  function handleAnswer(selectedId: string) {
    if (!q || phase !== 'answering') return
    if (q.kind === 'match') {
      // MatchGame 只在全部配对成功时 onComplete;整组对 = 该题一次通过
      play('correct')
      setCorrectId(q.left[0]?.id ?? '')
      setPhase('feedback')
      later(goNextQuestion, CORRECT_DELAY_MS)
      return
    }
    const correct = selectedId === q.answerId
    if (correct) {
      play('correct')
      setCorrectId(selectedId)
      setWrongId(null)
      setPhase('feedback')
      later(goNextQuestion, CORRECT_DELAY_MS)
    } else if (attempt === 1) {
      play('wrong')
      setWrongId(selectedId)
      setAttempt(2)
    } else {
      // 两次均错 → 步失败,重做整步
      play('wrong')
      setWrongId(selectedId)
      setRevealId(q.answerId)
      setPhase('reveal')
    }
  }

  function renderQuestion(question: Question) {
    const shared = {
      kingdom: skill,
      disabled: phase !== 'answering',
      revealId,
      correctId,
      wrongId,
      onAnswer: handleAnswer,
    }
    switch (question.kind) {
      case 'listen-choice':
        return (
          <ListenChoice
            prompt={question.prompt}
            promptSpeak={question.promptSpeak}
            options={question.options}
            {...shared}
          />
        )
      case 'choice':
        // 题干大图 = 当前词 emoji(选项不放图)
        return (
          <Choice
            prompt={question.prompt}
            promptEmoji={word.emoji}
            options={question.options}
            {...shared}
          />
        )
      case 'match':
        return (
          <MatchGame
            prompt={question.prompt}
            left={question.left}
            right={question.right}
            answerMap={question.answerMap}
            kingdom={skill}
            onComplete={handleAnswer}
          />
        )
    }
  }

  return (
    <div className="min-h-screen text-ink">
      <header className="glass-strong sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          <Button variant="ghost" size="icon" onClick={onExit} aria-label="返回地图">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="truncate text-[15px] font-bold">
            {word.emoji} {word.hanzi} · {SKILL_LABEL[skill]}
          </span>
          <span className="ml-auto shrink-0 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-ink-2">
            {qIndex + 1}/{questions.length} · 第{stepIndex + 1}/{steps.length}技能
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-24 pt-5">
        {/* 技能步进度点 */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {steps.map((s, i) => (
            <span
              key={s}
              className={cn(
                'h-2 rounded-full transition-all',
                i < stepIndex ? 'w-2 bg-emerald' : i === stepIndex ? 'w-5 bg-accent' : 'w-2 bg-ink-3/25',
              )}
            />
          ))}
        </div>

        <div className="rounded-[1.75rem] border border-hairline bg-surface p-4 shadow-card sm:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${stepIndex}-${round}-${qIndex}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
            >
              {renderQuestion(q)}
            </motion.div>
          </AnimatePresence>

          {/* 反馈徽标 */}
          <div className="flex min-h-[52px] items-center justify-center pt-3">
            <AnimatePresence mode="wait">
              {phase === 'feedback' ? (
                <motion.div
                  key="ok"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 rounded-full bg-emerald/10 px-4 py-1.5 text-sm font-bold text-emerald"
                >
                  ✓ 答对啦
                </motion.div>
              ) : null}
              {phase === 'reveal' ? (
                <motion.div
                  key="reveal"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 rounded-full bg-red-tint px-4 py-1.5 text-sm font-bold text-red"
                >
                  ✗ 这步要再练一次
                </motion.div>
              ) : null}
              {phase === 'answering' && attempt === 2 ? (
                <motion.div
                  key="retry"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 rounded-full bg-accent-tint px-4 py-1.5 text-sm font-bold text-accent"
                >
                  再试一次吧 ✨
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {phase === 'reveal' ? (
            <Button size="lg" className="mt-1 w-full" onClick={() => setRound((r) => r + 1)}>
              再练一次
            </Button>
          ) : null}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: PASS(组件尚未被 App 引用亦可编译;tsconfig include 全 src)

- [ ] **Step 3: Commit**

```bash
git add src/components/game/WordLesson.tsx
git commit -m "feat: 词学习答题器 WordLesson(替换 LevelPlay)"
```

---
### Task 12: UI WordMapView 分类词库地图(替换关卡 MapView)

**Files:**
- Create: `src/components/game/WordMapView.tsx`

**Interfaces:**
- Consumes: `WORDS/CATEGORY_LABELS`(Task 2)、`fullComplete/firstTargetId`(Task 4)、`titleForStars`(Task 5)、`play`(sfx)、types。
- Produces:
  ```tsx
  export type WordMapViewProps = {
    words: Record<number, WordProgress>
    totalStars: number
    settings: UserSettings
    soundOn: boolean
    onToggleSound: () => void
    onPlay: (wordId: number) => void
    onOpenSettings: () => void
    onLogout: () => void
    onReset: () => void
  }
  ```
  渲染:顶部状态条(🏰 魔法语言岛 + ⭐{totalStars} + 🎖{titleName} + 声音开关 + 家长菜单:学习设置/重置进度/退出登录);主区按 `CATEGORY_LABELS` 顺序分区展示词格;分区标题 = `{label} · {区内词数}`,区内完成徽标计数。词格三态:`done`(全完成,绿底 ✓,可点重学)、`target`(首个未完成词,高亮脉冲「开始」)、`partial`(已解锁未完成,可点)、`locked`(id > target,灰显禁点)。地图即主页:无独立主页屏。标题下方副标题显示称号名与称号当前进度。

- [ ] **Step 1: 实现 WordMapView.tsx**

```tsx
import { Fragment, useEffect, useState } from 'react'
import { LogOut, RotateCcw, Volume2, VolumeX, Wrench } from 'lucide-react'
import { motion } from 'motion/react'
import { CATEGORY_LABELS, WORDS } from '../../data/words'
import { firstTargetId, fullComplete } from '../../game/lesson'
import { titleForStars } from '../../game/progress'
import { cn } from '../../lib/utils'
import { play } from '../../game/sfx'
import type { CategoryKey, UserSettings, WordProgress } from '../../types'
import { Button } from '../ui/button'

export type WordMapViewProps = {
  words: Record<number, WordProgress>
  totalStars: number
  settings: UserSettings
  soundOn: boolean
  onToggleSound: () => void
  onPlay: (wordId: number) => void
  onOpenSettings: () => void
  onLogout: () => void
  onReset: () => void
}

const CATEGORY_ORDER: CategoryKey[] = ['shape', 'food', 'animal', 'nature', 'object']

export function WordMapView({
  words,
  totalStars,
  settings,
  soundOn,
  onToggleSound,
  onPlay,
  onOpenSettings,
  onLogout,
  onReset,
}: WordMapViewProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const target = firstTargetId(words, settings)
  const title = titleForStars(totalStars)
  const doneCount = WORDS.filter((w) => fullComplete(words[w.id], settings)).length

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="min-h-screen text-ink">
      {menuOpen ? <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" /> : null}

      <header className="glass-strong sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex max-w-xl items-center gap-1.5 px-4 py-2.5">
          <span className="mr-auto flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <span className="text-xl" aria-hidden>🏰</span>魔法语言岛
          </span>
          <span className="flex items-center gap-1 rounded-full border border-hairline bg-surface/80 px-2.5 py-1 text-sm font-semibold shadow-card">
            <span aria-hidden>⭐</span>{totalStars}
          </span>
          <span className="rounded-full border border-hairline bg-surface/80 px-2.5 py-1 text-sm font-semibold shadow-card">
            🎖{title.name}
          </span>
          <Button variant="ghost" size="icon" aria-label={soundOn ? '关闭声音' : '开启声音'} onClick={onToggleSound}>
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-ink-3" />}
          </Button>
          <div className="relative">
            <Button
              variant="ghost" size="icon" aria-label="家长菜单" aria-haspopup="menu" aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Wrench className="h-5 w-5" />
            </Button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-2xl border border-hairline bg-surface p-1.5 shadow-pop" role="menu">
                <button
                  type="button" role="menuitem"
                  onClick={() => { setMenuOpen(false); onOpenSettings() }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                >
                  ⚙️ 学习设置
                </button>
                <button
                  type="button" role="menuitem"
                  onClick={() => { setMenuOpen(false); onReset() }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                >
                  <RotateCcw className="h-4 w-4 text-ink-3" /> 重置进度
                </button>
                <button
                  type="button" role="menuitem"
                  onClick={() => { setMenuOpen(false); onLogout() }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red transition-colors hover:bg-red-tint"
                >
                  <LogOut className="h-4 w-4" /> 退出登录
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-24 pt-6">
        <section className="mb-6 text-center">
          <p className="text-sm font-semibold text-accent">魔法语言岛 · 词库王国</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">收集 100 个词的星尘</h1>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-2">
            已全完成 {doneCount}/100 · 当前称号 🎖{title.name}
          </p>
        </section>

        {target > WORDS.length ? (
          <div className="mb-6 rounded-2xl border border-emerald/40 bg-emerald/10 px-4 py-3 text-center text-sm font-bold text-emerald">
            🎉 太棒了,100 词全部学完!
          </div>
        ) : null}

        {CATEGORY_ORDER.map((cat) => {
          const items = WORDS.filter((w) => w.category === cat)
          const doneInCat = items.filter((w) => fullComplete(words[w.id], settings)).length
          return (
            <section key={cat} className="mb-7">
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="text-sm font-bold">{CATEGORY_LABELS[cat]}</h2>
                <span className="text-xs font-semibold text-ink-3">{doneInCat}/{items.length}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {items.map((w) => {
                  const isDone = fullComplete(words[w.id], settings)
                  const isTarget = w.id === target
                  const locked = w.id > target
                  return (
                    <motion.button
                      key={w.id}
                      type="button"
                      aria-label={`词 ${w.id} ${w.hanzi}${locked ? ',未解锁' : ''}`}
                      disabled={locked}
                      onClick={() => { if (!locked) { void play('tap'); onPlay(w.id) } }}
                      whileHover={locked ? undefined : { y: -2, scale: 1.04 }}
                      whileTap={locked ? undefined : { scale: 0.94 }}
                      animate={isTarget ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                      transition={isTarget ? { repeat: Infinity, duration: 1.4, ease: 'easeInOut' } : { type: 'spring', bounce: 0, duration: 0.3 }}
                      className={cn(
                        'relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 transition-colors',
                        locked
                          ? 'border-hairline bg-surface-2 opacity-45'
                          : isDone
                            ? 'border-emerald/50 bg-emerald/10'
                            : isTarget
                              ? 'border-accent bg-accent/10 ring-2 ring-accent/25'
                              : 'border-hairline bg-surface hover:border-accent/50',
                      )}
                    >
                      <span className="text-2xl leading-none" aria-hidden>{locked ? '🔒' : w.emoji}</span>
                      <span className={cn('mt-0.5 text-[11px] font-semibold', isDone ? 'text-emerald' : 'text-ink-2')}>
                        {isDone ? '✓' : isTarget ? '开始' : `${w.id}`}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: PASS(组件未被引用亦可编译;oxlint 与 noUnusedLocals 约束已按零冗余写)

- [ ] **Step 3: Commit**

```bash
git add src/components/game/WordMapView.tsx
git commit -m "feat: 分类词库地图 WordMapView(地图即主页)"
```

---
### Task 13: 大切换 — 删关卡制文件、重写 App.tsx

> 本任务是唯一的大幅跳跃:一次性删除全部旧关卡文件、把 state/scoring 换成词库语义、重写 App 接线。完成后全仓只存词库范式,`tsc -b` 恢复全绿。

**Files:**
- Delete: `src/data/levels.ts`、`src/components/game/MapView.tsx`、`src/components/game/LevelPlay.tsx`、`src/components/game/LevelResult.tsx`、`src/game/scoring.ts`、`src/game/scoring.test.ts`、`src/game/state.ts`、`src/game/state.test.ts`、`src/game/levels.test.ts`
- Modify: `src/App.tsx`(重写)、`src/types.ts`(删关卡类型)
- Verify: `src/main.tsx`(不变)、`worker/_lib/auth.ts`(不变)

**Types 变更:**
- 删除: `LevelRecord`、`Level`、`GameState`、`UserProfile`(已无引用)
- 保留: `KingdomKey`、`BaseOption`、三种 Question、`Question` 联合、Task 1 新增类型
- `scoring.ts`/`state.ts` 及其测试整删(scoreAttempt 逻辑已被 WordLesson 内联判对错取代,无其他引用方)

**App 状态机(精确接线,无占位):**
```tsx
type Screen = 'boot' | 'login' | 'map' | 'lesson' | 'done'
// progress: Record<wordId, WordProgress>  ← 服务端每词一行的前端镜像
// settings: UserSettings                  ← 三模块开关
// activeWord: WordUnit | null; lessonKey: number(每题组重建)
// gainRef: { step: number; bonus: number } ← 本次进入该词后累计已发放(用于 WordDone 展示)
```

**结算策略(不重复、可重学):** 每次 `onStepPass(skill)` 都基于服务端镜像做 `settleWord(id, prev, [{skill,passed:true}], settings)`:已完成的技能(prev.completed 已 true)在该次会得 stepReward 0 → 重学不重复发;词首达全完成那次触发 wordBonus 20。每次结算即时 PUT 该词单行。App 进入某词时清零 gainRef,WordLesson 每步成功把该步 stepReward/wordBonus 累加进 gainRef;最后一个步成功后由 onLessonComplete 进 done 屏,展示 gainRef 累计。重学已全完成词 → gainRef 全 0,done 屏仍显示(可回地图)。

- [ ] **Step 1: types.ts 删关卡类型**

`src/types.ts` 中删除 `LevelRecord`、`Level`、`GameState`、`UserProfile` 四个类型定义及其引用(该文件其余全部保留)。`KingdomKey` 保留(quiz/engine/speech 用)。

- [ ] **Step 2: 删除关卡文件**

```bash
git rm src/data/levels.ts src/components/game/MapView.tsx src/components/game/LevelPlay.tsx src/components/game/LevelResult.tsx src/game/scoring.ts src/game/scoring.test.ts src/game/state.ts src/game/state.test.ts src/game/levels.test.ts
```
预期此时 `npm run build` 因旧 App.tsx 引用已删文件而红——下一步立即重写 App。

- [ ] **Step 3: 重写 App.tsx**

```tsx
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { LoginGate } from './components/login/LoginGate'
import { WordMapView } from './components/game/WordMapView'
import { WordLesson } from './components/game/WordLesson'
import { WordDone } from './components/game/WordDone'
import { SettingsPanel } from './components/game/SettingsPanel'
import { WORDS, wordById } from './data/words'
import { emptyProgress, isValidWordProgress, settleWord, titleForStars } from './game/progress'
import { getSoundOn, setSoundOn } from './game/audio'
import type { SkillKey, UserSettings, WordProgress, WordUnit } from './types'

type Screen = 'boot' | 'login' | 'map' | 'lesson' | 'done'

type DoneInfo = {
  word: WordUnit
  stepReward: number // 本次会话(该词)累计技能步首过星尘
  wordBonus: number  // 本次会话触发的整词加成(0 或 20)
}

function defaultSettings(): UserSettings {
  const now = new Date().toISOString()
  return { enablePinyin: true, enableHanzi: true, enableEnglish: true, updatedAt: now }
}

function App() {
  const [screen, setScreen] = useState<Screen>('boot')
  const [progress, setProgress] = useState<Record<number, WordProgress>>({})
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [soundOn, setSound] = useState(() => getSoundOn())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeWord, setActiveWord] = useState<WordUnit | null>(null)
  const [lessonKey, setLessonKey] = useState(0)
  const [doneInfo, setDoneInfo] = useState<DoneInfo | null>(null)
  const progressRef = useRef(progress)
  const settingsRef = useRef(settings)
  const gainRef = useRef({ step: 0, bonus: 0 })
  const activeWordIdRef = useRef<number | null>(null)

  progressRef.current = progress
  settingsRef.current = settings

  const totalStars = Object.values(progress).reduce((sum, p) => sum + p.starsEarned, 0)
  const title = titleForStars(totalStars)

  function syncProgress(next: Record<number, WordProgress>) {
    setProgress(next)
    progressRef.current = next
  }

  async function fetchAll() {
    const [pg, st] = await Promise.all([
      fetch('/api/progress', { credentials: 'include' }),
      fetch('/api/settings', { credentials: 'include' }),
    ])
    const map: Record<number, WordProgress> = {}
    if (pg.ok) {
      const body = (await pg.json().catch(() => null)) as { progress?: unknown[] } | null
      for (const raw of body?.progress ?? []) {
        if (isValidWordProgress(raw)) map[(raw as WordProgress).wordId] = raw as WordProgress
      }
    }
    syncProgress(map)
    if (st.ok) {
      const body = (await st.json().catch(() => null)) as { settings?: UserSettings } | null
      if (body?.settings) {
        const s = { ...defaultSettings(), ...body.settings }
        setSettings(s)
        settingsRef.current = s
      }
    }
  }

  useEffect(() => {
    const boot = async () => {
      try {
        const me = await fetch('/api/me', { credentials: 'include' })
        if (!me.ok) { setScreen('login'); return }
      } catch {
        setScreen('login')
        return
      }
      try { await fetchAll() } catch { /* 保留默认 */ }
      setScreen('map')
    }
    void boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const p = (await res.json().catch(() => ({ message: '登录失败' }))) as { message?: string; user?: unknown }
      if (!res.ok || !p.user) { setError(p.message ?? '登录失败'); return }
    } catch { setError('网络连接异常,请稍后重试'); return }
    setToken('')
    try { await fetchAll() } catch { /* ignore */ }
    setScreen('map')
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }) } catch { /* ignore */ }
    syncProgress({})
    setActiveWord(null)
    setDoneInfo(null)
    setScreen('login')
  }

  async function resetProgress() {
    if (!window.confirm('确定要重置全部学习进度吗?此操作无法撤销。')) return
    try { await fetch('/api/progress', { method: 'DELETE', credentials: 'include' }) } catch { /* ignore */ }
    syncProgress({})
  }

  async function saveSettings(next: UserSettings) {
    setSettings(next)
    settingsRef.current = next
    try {
      await fetch('/api/settings', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { enablePinyin: next.enablePinyin, enableHanzi: next.enableHanzi, enableEnglish: next.enableEnglish },
        }),
      })
    } catch { /* ignore */ }
  }

  /** 进入词:重置本词会话增益 */
  function startWord(id: number) {
    const w = wordById(id)
    if (!w) return
    gainRef.current = { step: 0, bonus: 0 }
    activeWordIdRef.current = id
    setActiveWord(w)
    setLessonKey((k) => k + 1)
    setScreen('lesson')
  }

  /** 一步(2 题)全过:立即结算该技能并即时 PUT 该词单行 */
  function handleStepPass(skill: SkillKey) {
    const id = activeWordIdRef.current
    if (id === null) return
    const prev = progressRef.current[id] ?? emptyProgress(id)
    const r = settleWord(id, prev, [{ skill, passed: true }], settingsRef.current)
    syncProgress({ ...progressRef.current, [id]: r.next })
    gainRef.current = {
      step: gainRef.current.step + r.stepReward,
      bonus: Math.max(gainRef.current.bonus, r.wordBonus),
    }
    void fetch('/api/progress', {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: [r.next] }),
    }).catch(() => {})
  }

  /** 全部技能步完成 → 展示本词结算 */
  function handleLessonComplete() {
    const w = activeWord
    if (!w) return
    setDoneInfo({ word: w, stepReward: gainRef.current.step, wordBonus: gainRef.current.bonus })
    setScreen('done')
  }

  function exitToMap() {
    setActiveWord(null)
    setDoneInfo(null)
    setScreen('map')
  }

  function nextWord() {
    if (!activeWord) return
    const nextId = activeWord.id + 1
    if (nextId > WORDS.length) { exitToMap(); return }
    startWord(nextId)
  }

  let content: ReactNode
  if (screen === 'boot') {
    content = <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-3" /></div>
  } else if (screen === 'login') {
    content = <LoginGate error={error} onTokenChange={setToken} onSubmit={(e) => void login(e)} />
  } else if (screen === 'lesson' && activeWord) {
    content = (
      <WordLesson
        key={lessonKey}
        word={activeWord}
        settings={settings}
        onStepPass={handleStepPass}
        onLessonComplete={handleLessonComplete}
        onExit={exitToMap}
      />
    )
  } else if (screen === 'done' && doneInfo) {
    content = (
      <WordDone
        word={doneInfo.word}
        stepReward={doneInfo.stepReward}
        wordBonus={doneInfo.wordBonus}
        totalStars={totalStars}
        titleName={title.name}
        nextId={doneInfo.word.id + 1}
        isLastWord={doneInfo.word.id >= WORDS.length}
        onNext={nextWord}
        onMap={exitToMap}
      />
    )
  } else {
    content = (
      <>
        <WordMapView
          words={progress}
          totalStars={totalStars}
          settings={settings}
          soundOn={soundOn}
          onToggleSound={() => { setSoundOn(!soundOn); setSound(!soundOn) }}
          onPlay={startWord}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={() => void logout()}
          onReset={() => void resetProgress()}
        />
        {settingsOpen ? (
          <SettingsPanel settings={settings} onChange={(s) => void saveSettings(s)} onClose={() => setSettingsOpen(false)} />
        ) : null}
      </>
    )
  }

  return <MotionConfig reducedMotion="user">{content}</MotionConfig>
}

export default App
```

- [ ] **Step 4: 构建/测试/修复**

Run: `npm run build && npm test`
Expected: PASS。若失败按 tsc/oxlint 报错:删掉 App 中多余 import、补 `titleForStars` 导入与称号传参、对齐 WordLesson/WordDone props。

- [ ] **Step 5: lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: 删关卡制,App 接线词库学习流程(地图/词单元/结算/设置)"
```

---
### Task 14: 清理与收尾 — 手动冒烟 + CLAUDE.md 同步

**Files:**
- Modify: `CLAUDE.md`(架构/数据模型/路由/测试/命令/「二期」描述)
- Verify: `npm run dev` 冒烟。

- [ ] **Step 1: 手动冒烟(关键验收)**

Run: `npm run dev`,浏览器打开 http://localhost:3000:
1. 登录(输入 `.dev.vars` 的 ADMIN_TOKEN)→ 见词库地图,目标词高亮,星尘 0、称号语言初学者。
2. 点词 1「太阳」→ 学拼音 2 题(错一次再对)→ 汉字 → 英语;全部完成 → WordDone 显示 +90/+20;回地图词 1 全绿、解锁词 2。
3. 家长菜单 → 学习设置 → 关拼音 → 返回;再点词 2 应只 2 个技能步。
4. 刷新页面 → 进度仍在(服务端持久化)。
5. 家长菜单 → 重置进度 → 确认 → 地图回零。

Expected: 以上 1-5 全部符合。

- [ ] **Step 2: 更新 CLAUDE.md**

按新现实改写以下小节:项目概述(v1.2 词库学习岛)、数据模型(progress/user_settings + 每词行级)、后端路由列表(/api/progress 三法 + /api/settings + auth)、GameState→词库进度字段、题型(引擎生成 choice/listen/match)、文件清单(新 words/engine/lesson/progress 与已删关卡文件)、发音约定、`npm test` 范围、部署说明不变。「明确不做」改为二期 backlog(绘画/离线/复习/填空)与真正不做(语音识别/多档案等)。

- [ ] **Step 3: 最终全量验证**

Run: `npm run lint && npm run build && npm test`
Expected: 全绿。

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md 同步词库学习岛架构与命令"
```

---

## Self-Review

**Spec coverage:**
- §2 一期范围 → Task 2(词库)/3(引擎)/4-5(步序结算)/6-13(UI+后端)/14(收尾)。
- §3 差异(存储/等级/页面/设置)→ Task 7/8(schema+worker)、5(称号)、12(地图)、9(设置)。
- §5 数据模型两表 → Task 7。
- §6 词库数据修正 + 分类沿用 + 跨类兜底 → Task 2 + Task 3 `distractorsFor`。
- §7 步序/单步 2 题/2 次机会/星尘规则 → Task 4/5/11 + App 结算。
- §8 worker 路由与认证 → Task 8。
- §9 页面与家长菜单 → Task 9/10/11/12/13。
- §10 删除清单 → Task 13 + Task 8(worker/game.ts)。
- §11 测试矩阵 → words/engine/lesson/progress 测试(任务 1-5);scoring/state/levels 旧测试随关卡删除(Task 13)。
- §13 风险(词库笔误/分类乱/朗读约定)→ Task 2 数据修正、Task 3 兜底、speakOf 汉字约定。
- 规范对齐:quiz 复用、`promptEmoji` 仅 Choice;fillBlank/绘画/离线留 backlog 不入任何任务。

**Placeholder scan:** 无 TODO/TBD。所有任务含完整可编译代码;Task 6 的 Choice 改动以「现有文件的具体插入点 + 插入代码」表达,执行时以该文件实际行匹配。

**Type consistency:** `textOf/speakOf/optionCountFor/distractorsFor/makeStepQuestions` 在 Task 3 定义并贯穿 Task 4-13;`settleWord/emptyProgress/mergeProgress/isValidWordProgress/titleForStars/fullComplete/firstTargetId/stepsFor` 命名在 Task 4/5/13 一致;quiz 组件 props(`promptEmoji`)在 Task 6 引入、Task 11 使用;引擎产出直接满足 `src/types.ts` 现有 Question 判别联合(choice 无图、listen 无图),无需改 types。

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-03-word-island-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
