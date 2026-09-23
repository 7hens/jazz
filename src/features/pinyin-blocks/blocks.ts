// 拼音积木的块目录与解锁表(纯数据,不依赖任何服务)。
// 拆分口径 = 汉语拼音方案的「韵头-韵腹-韵尾」结构 + 小学教学惯例:
//   - 复韵母 ai/ei/ao/ou/ie/üe 整块不拆(一个发音单元,断开读会走音);
//   - 鼻韵母拆出鼻尾(an → a+n,ang → a+ng),鼻尾是辅音,前后鼻音辨析是教学重点;
//   - i/u/ü 是双身份块:jia 里的 i 是介母(韵头),bin 里的 i 是韵腹。
// 声调用走势线画(SVG path),不印字符 —— ˉˊˇˋ 在 44px 圆里会糊成 - ~ ^,孩子认不出。

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

/** 这一块念什么;查不到(声调块)返回 undefined,调用方据此静默。 */
export function speakOf(type: BlockType, value: string): string | undefined {
  return SPEAK_OF[type]?.[value]
}

/** 焊死的声母:它们拼上 i 之后读音不是「声母 + 衣」,拼合时金箍焊成一体。 */
export const WELD_INITIALS = ['zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y'] as const

/* ------------------------------------------------------- 单元解锁表 */

/**
 * 某个块类型在第 unit 单元(0 基)时是否已解锁。
 * 干扰块只能取已解锁的块 —— 否则 U5 会冒出 U3 才教的 üe,孩子只能靠猜。
 */
export function poolFor(type: BlockType, unit: number): readonly string[] {
  switch (type) {
    case 'initial':
      return unit >= 1 ? INITIALS_ALL : []
    case 'final':
      return unit >= 2 ? [...FINAL_BASIC, ...FINAL_COMPOUND] : FINAL_BASIC
    case 'nasal':
      return unit >= 3 ? NASALS : []
    case 'medial':
      return unit >= 4 ? MEDIALS : []
    default:
      return [] // tone 恒全出(由 toneBlocks 直接补),不作干扰
  }
}

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
 * 每个单元的提示基线。脚手架随课程推进撤掉(u1-u3 强 → u4-u5 中 → u6-u7 弱),
 * 跟难度曲线同步,而不是孩子一进关就面对满屏颜色。
 */
export const HINT_BY_UNIT: Readonly<Record<string, Hint>> = {
  u1: 'strong', u2: 'strong', u3: 'strong',
  u4: 'mid', u5: 'mid',
  u6: 'weak', u7: 'weak',
}

/**
 * 本关此刻的提示档。连错 2 次临时提到强档 —— 脚手架既要会撤,也要能回来。
 * 只升不降:卡住时把颜色加回来,不会在孩子答对几次后又抽走。
 * 表里没有的单元 id 兜底强档(宁可多给线索,也不要让新单元变成一块灰砖)。
 */
export function hintFor(unitId: string, missCount: number): Hint {
  if (missCount >= 2) return 'strong'
  return HINT_BY_UNIT[unitId] ?? 'strong'
}
