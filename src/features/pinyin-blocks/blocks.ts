// 拼音积木的块目录(纯数据,不依赖任何服务)。
// 拆分口径 = 汉语拼音方案的「韵头-韵腹-韵尾」结构 + 小学教学惯例:
//   - 复韵母 ai/ei/ao/ou/ie/üe 整块不拆(一个发音单元,断开读会走音);
//   - 鼻韵母拆出鼻尾(an → a+n,ang → a+ng),鼻尾是辅音,前后鼻音辨析是教学重点;
//   - i/u/ü 是双身份块:jia 里的 i 是介母(韵头),bin 里的 i 是韵腹。
// 声调用走势线画(SVG path),不印字符 —— ˉˊˇˋ 在 44px 圆里会糊成 - ~ ^,孩子认不出。

import type { Part } from './part'

export type BlockType = 'initial' | 'medial' | 'final' | 'nasal' | 'tone'

/** 一块积木。value 为去调底字母;声调块的 value 是 '1'..'4'。 */
export type Block = { type: BlockType; value: string }

/* ---------------------------------------------------------------- 块池 */

/** 23 声母。含 y/w —— 小学教学把这两个半元音列在声母表里。 */
export const INITIALS_ALL: readonly string[] = 'b p m f d t n l g k h j q x zh ch sh r z c s y w'.split(' ')

export const FINAL_BASIC = ['a', 'o', 'e', 'i', 'u', 'ü'] as const
/**
 * 复韵母整块不拆。iu(← iou)与 ui(← uei)是**独立韵母**,不是介母 + 韵母 ——
 * 拆成 i+ou 会拼出 niou、拆成 u+ei 会拼出 guei,两个都不存在的音。
 */
export const FINAL_COMPOUND = ['er', 'ai', 'ei', 'ao', 'ou', 'iu', 'ui', 'ie', 'üe'] as const
export const MEDIALS = ['i', 'u', 'ü'] as const
export const NASALS = ['n', 'ng'] as const
export const TONE_VALUES = ['1', '2', '3', '4'] as const

/** 双身份块:介母槽与韵母槽都能放,入槽后颜色跟着槽位走。 */
export const DUAL_VALUES: ReadonlySet<string> = new Set(MEDIALS)

/* ------------------------------------------------------------ 块的读音 */

/**
 * 每一块念什么 —— 一律给**同音汉字**,不给字母本身。
 * 系统 TTS 拿到 'b' 会按英文念 "bee"、拿到 'a' 会念 "诶",都不是要教的音。
 *
 * 按**类型**分组,因为同一个字母换个身份就读法不同:
 * n 当声母读「讷」(nè),当鼻尾读「恩」(en)—— 前鼻音的名字本来就是它自己。
 */
export const SPEAK_OF: Readonly<Record<BlockType, Readonly<Record<string, string>>>> = {
  /** 声母 · 小学的**呼读音**(b 读「玻」,不是纯粹的 /p/) */
  initial: {
    b: '玻', p: '坡', m: '摸', f: '佛', d: '得', t: '特', n: '讷', l: '勒',
    g: '哥', k: '科', h: '喝', j: '基', q: '欺', x: '希',
    zh: '知', ch: '吃', sh: '诗', r: '日', z: '资', c: '雌', s: '思',
    y: '衣', w: '乌',
  },
  /** 介母:身份换了音不变 —— i 当介母还是「衣」 */
  medial: { i: '衣', u: '乌', ü: '迂' },
  /** 韵母:单韵母取单字,复韵母整块不拆、给整块的音(ai → 凹) */
  final: {
    a: '啊', o: '哦', e: '鹅', i: '衣', u: '乌', ü: '迂',
    ai: '凹', ei: '诶', ao: '熬', ou: '欧', iu: '优', ui: '威', ie: '耶', üe: '约', er: '儿',
  },
  /** 鼻尾念的是它代表的那个鼻韵母(en / eng),不是字母名。「鞥」是 ēng 唯一的字,生僻但音准。 */
  nasal: { n: '恩', ng: '鞥' },
  /** 声调本身不是一个能念的音 —— 硬找字来念会跟题面打架,故留空。 */
  tone: {},
}

/**
 * 易混伙伴:一块积木在托盘里优先拿谁来当干扰块。
 * 只写「像」,不写「教没教」—— 后者由 taughtBlocks 在运行时过滤(见 rules.ts 的 buildBlocks),
 * 于是**难度曲线是课程曲线自动派生的**:u1 一个伙伴都没教,关卡难度不变;u2 教齐 b/p/d/t/n/l/m
 * 之后开始出对;u4 进来平翘舌整组;u5 进来复韵母对;u7 进来前后鼻尾。
 *
 * 三条口径:
 * 1. 表是**不对称**的(`b: ['p']` 与 `p: ['b']` 各写一遍)—— 有些对本来就不对称
 *    (平翘舌里孩子更常误选 zh 而不是 z),结构上留余地。
 * 2. 表只表达「像」,不表达「教过没有」。
 * 3. 单韵母 a/o/e/i 与 er 不进表 —— u1 面对的是刚认字母的孩子,那里不该有陷阱。
 */
export const CONFUSABLE: Readonly<Record<BlockType, Readonly<Record<string, readonly string[]>>>> = {
  initial: {
    b: ['p'], p: ['b'],
    d: ['t'], t: ['d'],
    g: ['k'], k: ['g'],
    j: ['q'], q: ['j'],
    zh: ['z', 'ch'], z: ['zh', 'c'], ch: ['c', 'zh'], c: ['ch', 'z'],
    sh: ['s'], s: ['sh'],
    n: ['l'], l: ['n'],
    m: ['n'],
    f: ['h'], h: ['f'],
  },
  medial: { u: ['ü'], ü: ['u'] },
  final: {
    u: ['ü'], ü: ['u'],
    ai: ['ei'], ei: ['ai'],
    ao: ['ou'], ou: ['ao'],
    iu: ['ui'], ui: ['iu'],
    ie: ['üe'], üe: ['ie'],
  },
  // 前/后鼻音只差一个鼻尾,所以「对」记在鼻尾上,而不在韵腹上 —— an / ang 的韵腹是同一个 a。
  nasal: { n: ['ng'], ng: ['n'] },
  // 四声恒全出(见 toneBlocks),声调不需要这张表。
  tone: {},
}

/** 这一块念什么;查不到(声调块)返回 undefined,调用方据此静默。 */
export function speakOf(type: BlockType, value: string): string | undefined {
  return SPEAK_OF[type]?.[value]
}

/**
 * 焊死的声母:它们拼上 i/u 之后读音不是「声母 + 衣/乌」,拼合时金箍焊成一体。
 * `y` / `w` 是零声母的写法(半元音),同样属于这一批 —— `yī`、`wū` 都是整体认读。
 */
export const WELD_INITIALS = ['zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'] as const

/**
 * 拼上 ü 之后把两点带走的声母(去点规则)。
 * **全仓唯一判据** —— `levels.ts` 的 `spellSyllable` 与 `BlockChip` 的两点飞走共用它。
 */
export const Ü_DROP_INITIALS: ReadonlySet<string> = new Set(['j', 'q', 'x', 'y'])

/* ------------------------------------------------------------ 声调走势 */

/** 四条走势线,就是课本上压在韵母头上的那个形状 —— 形状本身即语义,零文字。 */
export const TONE_PATH: Readonly<Record<string, string>> = {
  1: 'M4 12 H20', // 一声:平
  2: 'M5 17.5 L19 6.5', // 二声:升
  3: 'M5 8 L12 18 L19 8', // 三声:降再升
  4: 'M5 6.5 L19 17.5', // 四声:降
}

/* ---------------------------------------------------------- 提示强度 */

/**
 * 空槽提示的三档。梯度是**染色深浅**,不是「染不染」——
 * 旧版 mid 与 weak 只差 2% 墨色,肉眼分不出,等于只有两档。
 */
export type Hint = 'strong' | 'mid' | 'weak'

/**
 * 每个单元的提示基线。脚手架随课程推进撤掉(u1-u4 强 → u5-u8 中 → u9-u12 弱),
 * 跟难度曲线同步,而不是孩子一进关就面对满屏颜色。
 * **复习部分不参与这张表** —— 它恒弱(见 `hintFor`)。
 */
export const HINT_BY_UNIT: Readonly<Record<string, Hint>> = {
  u1: 'strong', u2: 'strong', u3: 'strong', u4: 'strong',
  u5: 'mid', u6: 'mid', u7: 'mid', u8: 'mid',
  u9: 'weak', u10: 'weak', u11: 'weak', u12: 'weak',
}

/**
 * 本关此刻的提示档:基线由单元给,连错 2 次临时回强(只升不降)。
 *
 * 第三参是**部分的类别**,不是「这一关是不是复习关」—— 部分化后「复习」是复习部分,
 * 那一部分恒弱是因为它考的是错块,不是因为题的出身。
 */
export function hintFor(unitId: string, missCount: number, part: Part = 'easy'): Hint {
  if (missCount >= 2) return 'strong'
  return part === 'review' ? 'weak' : (HINT_BY_UNIT[unitId] ?? 'strong')
}
