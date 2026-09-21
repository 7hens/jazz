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
