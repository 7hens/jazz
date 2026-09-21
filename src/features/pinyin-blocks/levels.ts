// 课程路径与关卡数据(纯数据)。
// 7 个单元由易到难:单韵母 → 二拼 → 复韵母 → 鼻韵母 → 三拼介母 → 焊接音 → 双音节词。
// 每题的块**显式写死**,不由拼音串反推 —— 数据即答案,反推逻辑藏在解析器里出错更难查。

/** 一个音节的结构。weld = 拼合后读音 ≠ 逐块拼读,拼对时被金箍焊成一体(整体认读音节)。 */
export type Syllable = {
  readonly initial?: string
  readonly medial?: string
  readonly final?: string
  readonly nasal?: string
  readonly tone: 1 | 2 | 3 | 4
  readonly weld?: boolean
}

/** 一关:一张图 + 一个(或两个)音节。双音节词给两组槽位。 */
export type Level = {
  readonly emoji: string
  /** 完成后展示的拼音(带调号)。这是全屏唯一的文字,且内容本身就是要学的东西。 */
  readonly pinyin: string
  /**
   * 朗读文本 —— **同音汉字**,不是拼音串。
   * 系统 TTS 拿到 'bà' 这种拉丁字母会逐个念字母(或按英文规则念),必须给汉字它才发得对音。
   */
  readonly read: string
  readonly syl: readonly Syllable[]
}

export type Unit = {
  readonly id: string
  /** 仅用于家长/试玩者的关卡选择器,游戏内不出现。 */
  readonly name: string
  readonly levels: readonly Level[]
}

export const UNITS: readonly Unit[] = [
  {
    id: 'u1',
    name: '单韵母',
    levels: [
      { emoji: '🪿', pinyin: 'é', read: '鹅', syl: [{ final: 'e', tone: 2 }] },
      { emoji: '😮', pinyin: 'ó', read: '哦', syl: [{ final: 'o', tone: 2 }] },
      { emoji: '🗣️', pinyin: 'à', read: '啊', syl: [{ final: 'a', tone: 4 }] },
    ],
  },
  {
    id: 'u2',
    name: '二拼',
    levels: [
      { emoji: '👨', pinyin: 'bà', read: '爸', syl: [{ initial: 'b', final: 'a', tone: 4 }] },
      { emoji: '🐴', pinyin: 'mǎ', read: '马', syl: [{ initial: 'm', final: 'a', tone: 3 }] },
      { emoji: '🐰', pinyin: 'tù', read: '兔', syl: [{ initial: 't', final: 'u', tone: 4 }] },
      { emoji: '🍐', pinyin: 'lí', read: '梨', syl: [{ initial: 'l', final: 'i', tone: 2 }] },
      { emoji: '🐔', pinyin: 'jī', read: '鸡', syl: [{ initial: 'j', final: 'i', tone: 1 }] },
      { emoji: '🦶', pinyin: 'zú', read: '足', syl: [{ initial: 'z', final: 'u', tone: 2 }] },
    ],
  },
  {
    id: 'u3',
    name: '复韵母',
    levels: [
      { emoji: '🐱', pinyin: 'māo', read: '猫', syl: [{ initial: 'm', final: 'ao', tone: 1 }] },
      { emoji: '🐶', pinyin: 'gǒu', read: '狗', syl: [{ initial: 'g', final: 'ou', tone: 3 }] },
      { emoji: '❤️', pinyin: 'ài', read: '爱', syl: [{ final: 'ai', tone: 4 }] },
      { emoji: '⚫', pinyin: 'hēi', read: '黑', syl: [{ initial: 'h', final: 'ei', tone: 1 }] },
      { emoji: '👟', pinyin: 'xié', read: '鞋', syl: [{ initial: 'x', final: 'ie', tone: 2 }] },
      { emoji: '🐢', pinyin: 'guī', read: '龟', syl: [{ initial: 'g', final: 'ui', tone: 1 }] },
    ],
  },
  {
    id: 'u4',
    name: '鼻韵母',
    levels: [
      { emoji: '🚪', pinyin: 'mén', read: '门', syl: [{ initial: 'm', final: 'e', nasal: 'n', tone: 2 }] },
      { emoji: '⛰️', pinyin: 'shān', read: '山', syl: [{ initial: 'sh', final: 'a', nasal: 'n', tone: 1 }] },
      { emoji: '🏡', pinyin: 'fáng', read: '房', syl: [{ initial: 'f', final: 'a', nasal: 'ng', tone: 2 }] },
      { emoji: '🐉', pinyin: 'lóng', read: '龙', syl: [{ initial: 'l', final: 'o', nasal: 'ng', tone: 2 }] },
      { emoji: '🌬️', pinyin: 'fēng', read: '风', syl: [{ initial: 'f', final: 'e', nasal: 'ng', tone: 1 }] },
    ],
  },
  {
    id: 'u5',
    name: '三拼 · 介母',
    levels: [
      { emoji: '🍉', pinyin: 'guā', read: '瓜', syl: [{ initial: 'g', medial: 'u', final: 'a', tone: 1 }] },
      { emoji: '🐦', pinyin: 'niǎo', read: '鸟', syl: [{ initial: 'n', medial: 'i', final: 'ao', tone: 3 }] },
      { emoji: '🐻', pinyin: 'xióng', read: '熊', syl: [{ initial: 'x', medial: 'i', final: 'o', nasal: 'ng', tone: 2 }] },
      { emoji: '🍎', pinyin: 'guǒ', read: '果', syl: [{ initial: 'g', medial: 'u', final: 'o', tone: 3 }] },
      { emoji: '👑', pinyin: 'wáng', read: '王', syl: [{ initial: 'w', final: 'a', nasal: 'ng', tone: 2 }] },
    ],
  },
  {
    id: 'u6',
    name: '焊接音',
    levels: [
      { emoji: '🕷️', pinyin: 'zhī', read: '蜘', syl: [{ initial: 'zh', final: 'i', tone: 1, weld: true }] },
      { emoji: '📏', pinyin: 'chǐ', read: '尺', syl: [{ initial: 'ch', final: 'i', tone: 3, weld: true }] },
      { emoji: '🦁', pinyin: 'shī', read: '狮', syl: [{ initial: 'sh', final: 'i', tone: 1, weld: true }] },
      { emoji: '🦔', pinyin: 'cì', read: '刺', syl: [{ initial: 'c', final: 'i', tone: 4, weld: true }] },
      // y + ü 拼出 yu(ü 去两点)、y + üe 拼出 yue —— 规则本身就在块的拼合里显形
      { emoji: '🐟', pinyin: 'yú', read: '鱼', syl: [{ initial: 'y', final: 'ü', tone: 2, weld: true }] },
      { emoji: '🌙', pinyin: 'yuè', read: '月', syl: [{ initial: 'y', final: 'üe', tone: 4, weld: true }] },
      { emoji: '🦅', pinyin: 'yīng', read: '鹰', syl: [{ initial: 'y', final: 'i', nasal: 'ng', tone: 1, weld: true }] },
    ],
  },
  {
    id: 'u7',
    name: '双音节词',
    levels: [
      {
        emoji: '🍉',
        pinyin: 'xī guā',
        read: '西瓜',
        syl: [
          { initial: 'x', final: 'i', tone: 1 },
          { initial: 'g', medial: 'u', final: 'a', tone: 1 },
        ],
      },
      {
        emoji: '🐼',
        pinyin: 'xióng māo',
        read: '熊猫',
        syl: [
          { initial: 'x', medial: 'i', final: 'o', nasal: 'ng', tone: 2 },
          { initial: 'm', final: 'ao', tone: 1 },
        ],
      },
      {
        emoji: '🥛',
        pinyin: 'niú nǎi',
        read: '牛奶',
        syl: [
          { initial: 'n', final: 'iu', tone: 2 },
          { initial: 'n', final: 'ai', tone: 3 },
        ],
      },
      {
        emoji: '🦋',
        pinyin: 'hú dié',
        read: '蝴蝶',
        syl: [
          { initial: 'h', final: 'u', tone: 2 },
          { initial: 'd', final: 'ie', tone: 2 },
        ],
      },
      {
        emoji: '🌸',
        pinyin: 'huā duǒ',
        read: '花朵',
        syl: [
          { initial: 'h', medial: 'u', final: 'a', tone: 1 },
          { initial: 'd', medial: 'u', final: 'o', tone: 3 },
        ],
      },
    ],
  },
]
