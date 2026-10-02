// 课程路径与关卡数据,外加从块结构拼出显示串的拼音规则引擎(spellSyllable / writeSyllable /
// toneIndex / TONED / losesDots)。
// 12 个单元由易到难:单韵母 → 声母·双唇舌尖 → 声母·舌根舌面 → 声母·翘舌平舌 → 复韵母
// → 前鼻韵母 → 后鼻韵母 → 三拼·介母 → ü 行韵母 → 整体认读·一 → 整体认读·二 → 双音节词。
// 每题的块**显式写死**,不由拼音串反推 —— 数据即答案,反推逻辑藏在解析器里出错更难查。
//
// ⚠ `id` 是存档键,**前缀不等于所属单元**:旧关沿用建关时的 0–6 部分序号(如 `u2-4` 今天住在 u3),
// 新关一律从 50 起(`u5-50`、…)—— 两代键永不可能相撞。挪关不改 id。

import { Ü_DROP_INITIALS, type Block } from './blocks'
import { HARD_LEVELS } from './hard-levels'

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
  /**
   * 存档键。与显示顺序**解耦** —— 顺序可调、可插入,已存的星不受影响。
   * 形如 'u2-3'(单元 id + 建关时的序号);序号只在创建时取一次,之后该关怎么挪都不改。
   */
  readonly id: string
  readonly emoji: string
  /** 完成后展示的拼音(带调号)。这是全屏唯一的文字,且内容本身就是要学的东西。 */
  readonly pinyin: string
  /**
   * 朗读文本 —— **同音汉字**,不是拼音串。
   * 系统 TTS 拿到 'bà' 这种拉丁字母会逐个念字母(或按英文规则念),必须给汉字它才发得对音。
   */
  readonly read: string
  readonly syl: readonly Syllable[]
  /**
   * 困难节。**不写 = 简单题**。
   *
   * 「简单 / 困难」的划分只有这一个字部分说了算:`easyLevelsOf` / `hardLevelsOf`
   * 两个派生视图都从它取,别在别处按单元序号或题数猜。
   * 练习不进这个口径 —— 它的题由星级表现算(`practiceLevelsOf`)。
   */
  readonly stage?: 'hard'
  /**
   * 题面自动念一遍(= 听音拼块)。**只给「图给不出这个词」的关卡**,2026-09-29 加。
   *
   * 默认玩法是**看图猜音再拼**,声音刻意压暗在角落当兜底(`PinyinBlocksGame` 里 🔊 的注释),
   * 因为自动念会把拼读练成听写。但有一批题的图**根本命名不出目标词**:
   *   - u1 的 a / o / e 零声母音节几乎全是语气词(啊/哦/噢),图只能画一张脸,连调都画不出来;
   *   - 抽象词没有画法:意 / 志 / 序 / 引 / 军 / 运 / 野 / 院 / 迟 / 词 / 班 / 入 / 取 / 句 …
   *   - 图会指向**另一个词**:🦶(孩子说「脚」)要 zú 足、🔭(「望远镜」)要 yuǎn 远、🐯(「老虎」)要 hǔ 虎。
   * 这些题不念就是纯猜(两三次重试用尽才演示正解,星已经丢了),故单独放行。**其余关卡一律不念。**
   *
   * 三条纪律:
   *   1. **`read` 必须是该音的 TTS 单字默认读音** —— 自动念时声音就是题面,念成别的调等于题出错了。
   *      u1-2 原来是「啊 à」,TTS 只会念 ā;u1-52h 原来是「哦 ò」,TTS 只会念 ó —— 孩子听到的和
   *      要拼的对不上,必错。守卫见 `levels.test.ts` 的「朗读汉字的默认读音 = 目标音」。
   *   2. **能靠换图/换词救活的不要加它**(快→筷 kuài 🥢、翅 chì→船 chuán 🚢 就是换词救的)。
   *   3. 加了它不等于图可以乱选:图仍是语境线索,不能指向另一个词(那会让孩子怀疑自己听到的音)。
   */
  readonly listen?: true
}

export type Unit = {
  readonly id: string
  /** 仅用于家长/试玩者的关卡选择器,游戏内不出现。 */
  readonly name: string
  /**
   * 地图格子里的图案 —— 孩子认得出的一枚 emoji。
   *
   * 跟 `badge` 分工不同：`badge` 是**教学数据**（本单元新教的块，要进音素池校验），
   * 地图上不直接画 —— u12 有五块，横向排不下。`emoji` 是**地图标识**，
   * 一枚就够，尺寸与块数无关。
   *
   * 选图规则：取该单元第一个关卡的 emoji —— 孩子已经在题面见过这张图，
   * 地图上再见到是「认得出来」的同一个东西。
   */
  readonly emoji: string
  /** 本单元新教的块。跟 levels 一样**显式写死**,不靠反推。 */
  readonly badge: readonly Block[]
  readonly levels: readonly Level[]
}

/**
 * 本单元的简单部分 / 困难部分。**只分组、不排序** —— 顺序沿用 `Unit.levels` 里已有的那个。
 *
 * `Unit.levels` 保持**扁平单数组**(简单题全在前、困难题全在后),而不是 `levels: { easy, hard }`:
 * `progress-stats` / `achievements` / 后端 / 存档格式遍历的都是 `unit.levels`,
 * 换个形状就要同时改五处,而这里只需要两个取值函数。
 */
export function easyLevelsOf(unit: Unit): readonly Level[] {
  return unit.levels.filter((level) => level.stage !== 'hard')
}

export function hardLevelsOf(unit: Unit): readonly Level[] {
  return unit.levels.filter((level) => level.stage === 'hard')
}

export const UNITS: readonly Unit[] = [
  {
    id: 'u1',
    name: '单韵母',
    emoji: '🦢',
    badge: [{ type: 'final', value: 'a' }],
    levels: [
      // 本单元只出零声母单韵母(块池 = a o e i u,见 `hard-levels.test.ts` 的池子那条),
      // 而汉语里能被 6 岁孩子一眼命名的零声母单韵母**只有 8 个**:鹅é 饿è 衣yī 椅yǐ 姨yí 五wǔ 屋wū 雾wù。
      // a / o / e 剩下的全是语气词与抽象字(啊 哦 噢 恶 意 无),**没有图**。所以 u1 的 a/o 题靠
      // `listen`(自动念)出题,而不是靠图;`read` 一律取 TTS 单字默认调,否则听到的和答案对不上。
      { id: 'u1-0', emoji: '🦢', pinyin: 'é', read: '鹅', syl: [{ final: 'e', tone: 2 }] },
      { id: 'u1-1', emoji: '😮', pinyin: 'ó', read: '哦', syl: [{ final: 'o', tone: 2 }], listen: true },
      { id: 'u1-2', emoji: '🗣️', pinyin: 'ā', read: '啊', syl: [{ final: 'a', tone: 1 }], listen: true },
      // i / u 不能单独作音节:零声母时写成 yi / wu。块面仍是 i / u,显示串是它们的改写。
      { id: 'u1-50', emoji: '🪑', pinyin: 'yǐ', read: '椅', syl: [{ final: 'i', tone: 3 }] },
      { id: 'u1-51', emoji: '✋', pinyin: 'wǔ', read: '五', syl: [{ final: 'u', tone: 3 }] },
      // 原单元末那组复习题(并入简单节后当普通题):一轮 a o e i u 走完
      { id: 'u1-52', emoji: '😋', pinyin: 'è', read: '饿', syl: [{ final: 'e', tone: 4 }], listen: true },
      // 困难节:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u1 ?? []),
    ],
  },
  {
    id: 'u2',
    name: '声母 · 双唇舌尖',
    emoji: '👨',
    badge: [{ type: 'initial', value: 'b' }, { type: 'final', value: 'a' }],
    levels: [
      { id: 'u2-0', emoji: '👨', pinyin: 'bà', read: '爸', syl: [{ initial: 'b', final: 'a', tone: 4 }] },
      { id: 'u2-1', emoji: '🐴', pinyin: 'mǎ', read: '马', syl: [{ initial: 'm', final: 'a', tone: 3 }] },
      { id: 'u2-2', emoji: '🐰', pinyin: 'tù', read: '兔', syl: [{ initial: 't', final: 'u', tone: 4 }] },
      { id: 'u2-3', emoji: '🍐', pinyin: 'lí', read: '梨', syl: [{ initial: 'l', final: 'i', tone: 2 }] },
      { id: 'u2-50', emoji: '👵', pinyin: 'pó', read: '婆', syl: [{ initial: 'p', final: 'o', tone: 2 }], listen: true },
      { id: 'u2-51', emoji: '🪓', pinyin: 'fǔ', read: '斧', syl: [{ initial: 'f', final: 'u', tone: 3 }] },
      { id: 'u2-52', emoji: '🌍', pinyin: 'dì', read: '地', syl: [{ initial: 'd', final: 'i', tone: 4 }] },
      { id: 'u2-53', emoji: '😠', pinyin: 'nù', read: '怒', syl: [{ initial: 'n', final: 'u', tone: 4 }], listen: true },
      { id: 'u2-54', emoji: '✏️', pinyin: 'bǐ', read: '笔', syl: [{ initial: 'b', final: 'i', tone: 3 }] },
      // 困难节:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u2 ?? []),
    ],
  },
  {
    id: 'u3',
    name: '声母 · 舌根舌面',
    emoji: '🐔',
    badge: [{ type: 'initial', value: 'g' }, { type: 'final', value: 'a' }],
    levels: [
      { id: 'u2-4', emoji: '🐔', pinyin: 'jī', read: '鸡', syl: [{ initial: 'j', final: 'i', tone: 1 }] },
      { id: 'u3-50', emoji: '🥁', pinyin: 'gǔ', read: '鼓', syl: [{ initial: 'g', final: 'u', tone: 3 }] },
      { id: 'u3-51', emoji: '😭', pinyin: 'kū', read: '哭', syl: [{ initial: 'k', final: 'u', tone: 1 }] },
      { id: 'u3-52', emoji: '🐯', pinyin: 'hǔ', read: '虎', syl: [{ initial: 'h', final: 'u', tone: 3 }], listen: true },
      { id: 'u3-53', emoji: '7️⃣', pinyin: 'qī', read: '七', syl: [{ initial: 'q', final: 'i', tone: 1 }] },
      { id: 'u3-54', emoji: '🛁', pinyin: 'xǐ', read: '洗', syl: [{ initial: 'x', final: 'i', tone: 3 }] },
      { id: 'u3-55', emoji: '🥤', pinyin: 'hē', read: '喝', syl: [{ initial: 'h', final: 'e', tone: 1 }] },
      // 困难节:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u3 ?? []),
    ],
  },
  {
    id: 'u4',
    name: '声母 · 翘舌平舌',
    emoji: '🦶',
    badge: [{ type: 'initial', value: 'zh' }, { type: 'final', value: 'a' }],
    levels: [
      { id: 'u2-5', emoji: '🦶', pinyin: 'zú', read: '足', syl: [{ initial: 'z', final: 'u', tone: 2 }], listen: true },
      { id: 'u4-50', emoji: '🐷', pinyin: 'zhū', read: '猪', syl: [{ initial: 'zh', final: 'u', tone: 1 }] },
      { id: 'u4-51', emoji: '🚗', pinyin: 'chē', read: '车', syl: [{ initial: 'ch', final: 'e', tone: 1 }] },
      { id: 'u4-52', emoji: '📕', pinyin: 'shū', read: '书', syl: [{ initial: 'sh', final: 'u', tone: 1 }] },
      { id: 'u4-53', emoji: '🔥', pinyin: 'rè', read: '热', syl: [{ initial: 'r', final: 'e', tone: 4 }] },
      { id: 'u4-54', emoji: '🧽', pinyin: 'cā', read: '擦', syl: [{ initial: 'c', final: 'a', tone: 1 }] },
      { id: 'u4-55', emoji: '🎨', pinyin: 'sè', read: '色', syl: [{ initial: 's', final: 'e', tone: 4 }], listen: true },
      { id: 'u4-56', emoji: '🦆', pinyin: 'yā', read: '鸭', syl: [{ initial: 'y', final: 'a', tone: 1 }] },
      { id: 'u4-57', emoji: '🙋', pinyin: 'wǒ', read: '我', syl: [{ initial: 'w', final: 'o', tone: 3 }] },
      { id: 'u4-58', emoji: '📄', pinyin: 'zhǐ', read: '纸', syl: [{ initial: 'zh', final: 'i', tone: 3 }] },
      // 困难节:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u4 ?? []),
    ],
  },
  {
    id: 'u5',
    name: '复韵母',
    emoji: '🐱',
    badge: [{ type: 'final', value: 'ai' }],
    levels: [
      { id: 'u3-0', emoji: '🐱', pinyin: 'māo', read: '猫', syl: [{ initial: 'm', final: 'ao', tone: 1 }] },
      { id: 'u3-1', emoji: '🐶', pinyin: 'gǒu', read: '狗', syl: [{ initial: 'g', final: 'ou', tone: 3 }] },
      { id: 'u3-2', emoji: '❤️', pinyin: 'ài', read: '爱', syl: [{ final: 'ai', tone: 4 }] },
      { id: 'u3-3', emoji: '⚫', pinyin: 'hēi', read: '黑', syl: [{ initial: 'h', final: 'ei', tone: 1 }] },
      { id: 'u3-4', emoji: '👟', pinyin: 'xié', read: '鞋', syl: [{ initial: 'x', final: 'ie', tone: 2 }] },
      { id: 'u3-5', emoji: '🐢', pinyin: 'guī', read: '龟', syl: [{ initial: 'g', final: 'ui', tone: 1 }] },
      // y + üe 拼出 yue(ü 去两点)—— 「两点飞走」动画的首演关,规则本身在块的拼合里显形
      { id: 'u6-5', emoji: '🌙', pinyin: 'yuè', read: '月', syl: [{ initial: 'y', final: 'üe', tone: 4, weld: true }] },
      // iu(← iou)是**独立韵母**,不是介母 + 韵母:拆成 i+ou 会拼出 niou
      { id: 'u5-50', emoji: '🐮', pinyin: 'niú', read: '牛', syl: [{ initial: 'n', final: 'iu', tone: 2 }] },
      // er 是特殊韵母:自成音节,永远不跟声母拼
      { id: 'u5-51', emoji: '👶', pinyin: 'ér', read: '儿', syl: [{ final: 'er', tone: 2 }] },
      { id: 'u5-52', emoji: '👍', pinyin: 'hǎo', read: '好', syl: [{ initial: 'h', final: 'ao', tone: 3 }] },
      // 困难节:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u5 ?? []),
    ],
  },
  {
    id: 'u6',
    name: '前鼻韵母',
    emoji: '🚪',
    badge: [{ type: 'final', value: 'a' }, { type: 'nasal', value: 'n' }],
    levels: [
      { id: 'u4-0', emoji: '🚪', pinyin: 'mén', read: '门', syl: [{ initial: 'm', final: 'e', nasal: 'n', tone: 2 }] },
      { id: 'u4-1', emoji: '⛰️', pinyin: 'shān', read: '山', syl: [{ initial: 'sh', final: 'a', nasal: 'n', tone: 1 }] },
      { id: 'u6-50', emoji: '✉️', pinyin: 'xìn', read: '信', syl: [{ initial: 'x', final: 'i', nasal: 'n', tone: 4 }] },
      { id: 'u6-51', emoji: '🛞', pinyin: 'lún', read: '轮', syl: [{ initial: 'l', final: 'u', nasal: 'n', tone: 2 }] },
      { id: 'u6-52', emoji: '🍚', pinyin: 'fàn', read: '饭', syl: [{ initial: 'f', final: 'a', nasal: 'n', tone: 4 }] },
      // 困难节:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u6 ?? []),
    ],
  },
  {
    id: 'u7',
    name: '后鼻韵母',
    emoji: '🏡',
    badge: [{ type: 'final', value: 'a' }, { type: 'nasal', value: 'ng' }],
    levels: [
      { id: 'u4-2', emoji: '🏡', pinyin: 'fáng', read: '房', syl: [{ initial: 'f', final: 'a', nasal: 'ng', tone: 2 }] },
      { id: 'u4-3', emoji: '🐉', pinyin: 'lóng', read: '龙', syl: [{ initial: 'l', final: 'o', nasal: 'ng', tone: 2 }] },
      { id: 'u4-4', emoji: '🌬️', pinyin: 'fēng', read: '风', syl: [{ initial: 'f', final: 'e', nasal: 'ng', tone: 1 }] },
      { id: 'u5-4', emoji: '👑', pinyin: 'wáng', read: '王', syl: [{ initial: 'w', final: 'a', nasal: 'ng', tone: 2 }] },
      { id: 'u7-50', emoji: '⭐', pinyin: 'xīng', read: '星', syl: [{ initial: 'x', final: 'i', nasal: 'ng', tone: 1 }] },
      { id: 'u7-51', emoji: '🐑', pinyin: 'yáng', read: '羊', syl: [{ initial: 'y', final: 'a', nasal: 'ng', tone: 2 }] },
      // 困难节:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u7 ?? []),
    ],
  },
  {
    id: 'u8',
    name: '三拼 · 介母',
    emoji: '🍉',
    badge: [{ type: 'initial', value: 'g' }, { type: 'medial', value: 'u' }, { type: 'final', value: 'a' }],
    levels: [
      { id: 'u5-0', emoji: '🍉', pinyin: 'guā', read: '瓜', syl: [{ initial: 'g', medial: 'u', final: 'a', tone: 1 }] },
      { id: 'u5-1', emoji: '🐦', pinyin: 'niǎo', read: '鸟', syl: [{ initial: 'n', medial: 'i', final: 'ao', tone: 3 }] },
      { id: 'u5-2', emoji: '🐻', pinyin: 'xióng', read: '熊', syl: [{ initial: 'x', medial: 'i', final: 'o', nasal: 'ng', tone: 2 }] },
      { id: 'u5-3', emoji: '🍎', pinyin: 'guǒ', read: '果', syl: [{ initial: 'g', medial: 'u', final: 'o', tone: 3 }] },
      { id: 'u8-50', emoji: '⬇️', pinyin: 'xià', read: '下', syl: [{ initial: 'x', medial: 'i', final: 'a', tone: 4 }] },
      { id: 'u8-51', emoji: '💰', pinyin: 'qián', read: '钱', syl: [{ initial: 'q', medial: 'i', final: 'a', nasal: 'n', tone: 2 }] },
      { id: 'u8-52', emoji: '🪥', pinyin: 'shuā', read: '刷', syl: [{ initial: 'sh', medial: 'u', final: 'a', tone: 1 }] },
      // 困难节:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u8 ?? []),
    ],
  },
  {
    id: 'u9',
    name: 'ü 行韵母 · 两点去留',
    emoji: '🍊',
    badge: [{ type: 'initial', value: 'j' }, { type: 'final', value: 'ü' }],
    levels: [
      // ü 行四个韵母(ü / üe / ün / üan)加两点去留两面:j q x 之后去点,n l 之后保留。
      { id: 'u9-50', emoji: '🍊', pinyin: 'jú', read: '橘', syl: [{ initial: 'j', final: 'ü', tone: 2 }] },
      { id: 'u9-51', emoji: '🚶', pinyin: 'qù', read: '去', syl: [{ initial: 'q', final: 'ü', tone: 4 }] },
      { id: 'u9-52', emoji: '❄️', pinyin: 'xuě', read: '雪', syl: [{ initial: 'x', final: 'üe', tone: 3 }] },
      // ün 只与 j q x y 相拼 → 永远是去点形态,故不放在 u6(前鼻),放在这里讲
      { id: 'u9-53', emoji: '👗', pinyin: 'qún', read: '裙', syl: [{ initial: 'q', final: 'ü', nasal: 'n', tone: 2 }] },
      // ü 作介母的三拼 —— 顺带兑现「三拼 ü 介母」这条覆盖缺口,不必另开单元
      { id: 'u9-54', emoji: '⭕', pinyin: 'quān', read: '圈', syl: [{ initial: 'q', medial: 'ü', final: 'a', nasal: 'n', tone: 1 }] },
      { id: 'u9-55', emoji: '👧', pinyin: 'nǚ', read: '女', syl: [{ initial: 'n', final: 'ü', tone: 3 }] },
      { id: 'u9-56', emoji: '🟩', pinyin: 'lǜ', read: '绿', syl: [{ initial: 'l', final: 'ü', tone: 4 }] },
      { id: 'u9-57', emoji: '🙌', pinyin: 'jǔ', read: '举', syl: [{ initial: 'j', final: 'ü', tone: 3 }] },
      // 困难节:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u9 ?? []),
    ],
  },
  {
    id: 'u10',
    name: '整体认读 · 一',
    emoji: '🕷️',
    badge: [{ type: 'initial', value: 'zh' }, { type: 'final', value: 'i' }],
    levels: [
      { id: 'u6-0', emoji: '🕷️', pinyin: 'zhī', read: '蜘', syl: [{ initial: 'zh', final: 'i', tone: 1, weld: true }] },
      { id: 'u6-1', emoji: '📏', pinyin: 'chǐ', read: '尺', syl: [{ initial: 'ch', final: 'i', tone: 3, weld: true }] },
      { id: 'u6-2', emoji: '🦁', pinyin: 'shī', read: '狮', syl: [{ initial: 'sh', final: 'i', tone: 1, weld: true }] },
      { id: 'u6-3', emoji: '🦔', pinyin: 'cì', read: '刺', syl: [{ initial: 'c', final: 'i', tone: 4, weld: true }] },
      { id: 'u10-50', emoji: '☀️', pinyin: 'rì', read: '日', syl: [{ initial: 'r', final: 'i', tone: 4, weld: true }] },
      { id: 'u10-51', emoji: '📝', pinyin: 'zì', read: '字', syl: [{ initial: 'z', final: 'i', tone: 4, weld: true }] },
      { id: 'u10-52', emoji: '4️⃣', pinyin: 'sì', read: '四', syl: [{ initial: 's', final: 'i', tone: 4, weld: true }] },
      { id: 'u10-53', emoji: '🔟', pinyin: 'shí', read: '十', syl: [{ initial: 'sh', final: 'i', tone: 2, weld: true }] },
      // 困难节:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u10 ?? []),
    ],
  },
  {
    id: 'u11',
    name: '整体认读 · 二',
    emoji: '🐟',
    badge: [{ type: 'initial', value: 'y' }, { type: 'final', value: 'ü' }, { type: 'nasal', value: 'n' }],
    levels: [
      { id: 'u6-4', emoji: '🐟', pinyin: 'yú', read: '鱼', syl: [{ initial: 'y', final: 'ü', tone: 2, weld: true }] },
      { id: 'u6-6', emoji: '🦅', pinyin: 'yīng', read: '鹰', syl: [{ initial: 'y', final: 'i', nasal: 'ng', tone: 1, weld: true }] },
      { id: 'u11-50', emoji: '💡', pinyin: 'dēng', read: '灯', syl: [{ initial: 'd', final: 'e', nasal: 'ng', tone: 1 }] },
      { id: 'u11-51', emoji: '🏠', pinyin: 'wū', read: '屋', syl: [{ initial: 'w', final: 'u', tone: 1, weld: true }] },
      // y + ie 写成 ye:i 由 y 代劳,不写 yie
      { id: 'u11-52', emoji: '🍃', pinyin: 'yè', read: '叶', syl: [{ initial: 'y', final: 'ie', tone: 4, weld: true }] },
      // yuan 带介母 → **不焊**:焊接语义是「逐块拼读 ≠ 整体读音」,三拼另有介母槽要走过
      { id: 'u11-53', emoji: '🔵', pinyin: 'yuán', read: '圆', syl: [{ initial: 'y', medial: 'ü', final: 'a', nasal: 'n', tone: 2 }] },
      { id: 'u11-54', emoji: '🎵', pinyin: 'yīn', read: '音', syl: [{ initial: 'y', final: 'i', nasal: 'n', tone: 1, weld: true }] },
      { id: 'u11-55', emoji: '☁️', pinyin: 'yún', read: '云', syl: [{ initial: 'y', final: 'ü', nasal: 'n', tone: 2, weld: true }] },
      { id: 'u11-56', emoji: '🌧️', pinyin: 'yǔ', read: '雨', syl: [{ initial: 'y', final: 'ü', tone: 3, weld: true }] },
      // 困难节:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u11 ?? []),
    ],
  },
  {
    id: 'u12',
    name: '双音节词',
    emoji: '🍉',
    // 五个块 = 两组音节(零宽间隔由渲染层表意),比别的单元宽 —— 一眼看出「这一格是两部分」。
    badge: [
      { type: 'initial', value: 'x' },
      { type: 'final', value: 'i' },
      { type: 'initial', value: 'g' },
      { type: 'medial', value: 'u' },
      { type: 'final', value: 'a' },
    ],
    levels: [
      {
        id: 'u7-0',
        emoji: '🍉',
        pinyin: 'xī guā',
        read: '西瓜',
        syl: [
          { initial: 'x', final: 'i', tone: 1 },
          { initial: 'g', medial: 'u', final: 'a', tone: 1 },
        ],
      },
      {
        id: 'u7-1',
        emoji: '🐼',
        pinyin: 'xióng māo',
        read: '熊猫',
        syl: [
          { initial: 'x', medial: 'i', final: 'o', nasal: 'ng', tone: 2 },
          { initial: 'm', final: 'ao', tone: 1 },
        ],
      },
      {
        id: 'u7-2',
        emoji: '🥛',
        pinyin: 'niú nǎi',
        read: '牛奶',
        syl: [
          { initial: 'n', final: 'iu', tone: 2 },
          { initial: 'n', final: 'ai', tone: 3 },
        ],
      },
      {
        id: 'u7-3',
        emoji: '🦋',
        pinyin: 'hú dié',
        read: '蝴蝶',
        syl: [
          { initial: 'h', final: 'u', tone: 2 },
          { initial: 'd', final: 'ie', tone: 2 },
        ],
      },
      {
        id: 'u7-4',
        emoji: '🌸',
        pinyin: 'huā duǒ',
        read: '花朵',
        syl: [
          { initial: 'h', medial: 'u', final: 'a', tone: 1 },
          { initial: 'd', medial: 'u', final: 'o', tone: 3 },
        ],
      },
      {
        id: 'u12-50',
        emoji: '🌳',
        pinyin: 'dà shù',
        read: '大树',
        syl: [
          { initial: 'd', final: 'a', tone: 4 },
          { initial: 'sh', final: 'u', tone: 4 },
        ],
      },
      // 困难节:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u12 ?? []),
    ],
  },
]

/* ------------------------------------------------------------ 解锁池(派生) */

/** 一个音节用到的块(不含声调块),顺序 = 块面顺序。 */
function syllableBlocks(syl: Syllable): Block[] {
  const out: Block[] = []
  if (syl.initial !== undefined) out.push({ type: 'initial', value: syl.initial })
  if (syl.medial !== undefined) out.push({ type: 'medial', value: syl.medial })
  if (syl.final !== undefined) out.push({ type: 'final', value: syl.final })
  if (syl.nasal !== undefined) out.push({ type: 'nasal', value: syl.nasal })
  return out
}

/**
 * 到第 unitIndex 单元(含)为止,课程里出现过的全部块。**干扰块的唯一来源**。
 *
 * 从课程数据派生,不按单元序号硬编码阈值:「哪个单元教什么」只有本文件知道,
 * 池子在 `blocks.ts` 再写一份必然漂移。语义正好是「只出孩子见过的块」。
 */
export function taughtBlocks(unitIndex: number): readonly Block[] {
  const seen = new Map<string, Block>()
  for (const unit of UNITS.slice(0, unitIndex + 1)) {
    for (const level of unit.levels) {
      for (const syl of level.syl) {
        for (const block of syllableBlocks(syl)) seen.set(`${block.type}:${block.value}`, block)
      }
    }
  }
  return [...seen.values()]
}

/* ------------------------------------------------------------ 拼写(显示串) */

/**
 * j q x y 之后的 ü 去两点。
 *
 * **`j q x y` 后去点这条规则的唯一判据** —— `spellSyllable` 与 BlockChip 的「两点飞走」动画共用,
 * 渲染层不许再写一份(判据分家 = 屏幕上飞走的两点和答案行对不上)。
 * 零声母的 `ü` → `yu` 是**另一条**规则(去点只是它的副产品),不走这里。
 */
export function losesDots(initial: string | undefined, value: string): boolean {
  return value.startsWith('ü') && initial !== undefined && Ü_DROP_INITIALS.has(initial)
}

/**
 * 块面串 → 拼音串。三条规则,**每条都是知识点本身**:
 *   1. 零声母:韵母以 i 起头 → i 改 y(`ie` 写 `ye`)、独自成韵 → `yi`;
 *      以 u 起头 → u 改 w(`uo` 写 `wo`)、独自成韵 → `wu`;以 ü 起头 → 前加 y 且去点(`üe` → `yue`)。
 *      唯一例外是缩写韵母 `iu`(← iou)/ `ui`(← uei):照缩写改会得到 `yu` / `wi`,不是拼音,
 *      故零声母写作 `you` / `wei`。
 *   2. y / w 是零声母的**写法**,不是真声母:y 后面的 i 由它代劳(`{y, ie}` 写 ye,不写 yie)
 *   3. j q x y 之后的 ü 去两点(与渲染层的「两点飞走」同一个判据)
 */
function writeSyllable(head: string, body: string): string {
  if (head === '') {
    // iu / ui 是 iou / uei 的缩写:零声母照缩写改会得到 yu / wi,不是拼音。
    if (body === 'iu') return 'you'
    if (body === 'ui') return 'wei'
    if (body.startsWith('ü')) return `y${body.replace('ü', 'u')}`
    if (body === 'i') return 'yi'
    if (body === 'u') return 'wu'
    if (body.startsWith('i')) return `y${body.slice(1)}`
    if (body.startsWith('u')) return `w${body.slice(1)}`
    return body
  }
  const spelled = losesDots(head, body) ? body.replace('ü', 'u') : body
  if (head === 'y' && spelled.startsWith('i') && spelled.length > 1) return `y${spelled.slice(1)}`
  return `${head}${spelled}`
}

/** ü 带调时两点保留(ǖ ǘ ǚ ǜ)—— 去点只由声母决定,与声调无关。 */
const TONED: Readonly<Record<string, readonly string[]>> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

/**
 * 标调位置 —— 这条本身就是知识点:有 `a` 标 `a`;没 `a` 而有 `o`/`e` 就标它;
 * 都没有时 `i`/`u` 并列标**后一个**(`niú`、`guī`),单个韵母标自己。
 */
function toneIndex(plain: string): number {
  const a = plain.indexOf('a')
  if (a >= 0) return a
  const oe = plain.search(/[oe]/)
  if (oe >= 0) return oe
  const pair = plain.search(/[iuü][iuü]/)
  return pair >= 0 ? pair + 1 : plain.search(/[iuü]/)
}

/** 一个音节拼出来的带调拼音串。 */
export function spellSyllable(syl: Syllable): string {
  const plain = writeSyllable(syl.initial ?? '', `${syl.medial ?? ''}${syl.final ?? ''}`) + (syl.nasal ?? '')
  const at = toneIndex(plain)
  const marked = at >= 0 ? TONED[plain[at] as string]?.[syl.tone - 1] : undefined
  return marked === undefined ? plain : plain.slice(0, at) + marked + plain.slice(at + 1)
}

/** 一关的完整显示串:各音节空格分隔,与 `Level.pinyin` 同形。 */
export function spell(level: Level): string {
  return level.syl.map(spellSyllable).join(' ')
}

/* ------------------------------------------------- 学习路径:Section / Lesson */

/** 一节的题数上限。一节 3~5 题是产品口径(spec §3)。 */
export const LESSON_MAX = 5

/** 一个 Section:按教学点分段。**只有分组,没有新数据** —— 段头要展示的东西全部从段内单元派生。 */
export type Section = {
  readonly id: string
  /** 仅用于家长 / 试玩者的选择器,游戏内不出现(与 `Unit.name` 同一口径)。 */
  readonly name: string
  readonly unitIds: readonly string[]
}

/** 7 段。段内 `unitIds` 的顺序即路径顺序。 */
export const SECTIONS: readonly Section[] = [
  { id: 's1', name: '单韵母', unitIds: ['u1'] },
  { id: 's2', name: '声母', unitIds: ['u2', 'u3', 'u4'] },
  { id: 's3', name: '复韵母', unitIds: ['u5'] },
  { id: 's4', name: '鼻韵母', unitIds: ['u6', 'u7'] },
  { id: 's5', name: '三拼与 ü', unitIds: ['u8', 'u9'] },
  { id: 's6', name: '整体认读', unitIds: ['u10', 'u11'] },
  { id: 's7', name: '双音节词', unitIds: ['u12'] },
]

/**
 * 学习路径上的一个节点。**不是存档键** —— 切分线挪动不碰任何已存的星(spec §3.1)。
 * 节是**派生视图**,不写进课程数据:换形状要同时改 `progress-stats` / `achievements` /
 * worker / 存档格式五处(见上面 `easyLevelsOf` 的注释),`lessonsOf` 走同一条路躲开它。
 */
export type Lesson = {
  /** 形如 'u2#easy-1'。 */
  readonly id: string
  readonly unitId: string
  readonly part: 'easy' | 'hard'
  readonly levelIds: readonly string[]
}

/**
 * 把一个部分的题**均分**成 k 节(k = ceil(n / LESSON_MAX))。
 *
 * 为什么是均分而不是「每 5 题一刀」:n = 6 时后者切出 5 + 1,末节一道题不成课;均分给 3 + 3。
 * 实测各档:`10→5+5`、`9→5+4`、`8→4+4`、`7→4+3`、`6→3+3`、`5→5`(单节)。
 * **空部分切出 0 节** —— 不产空节(进一个空节就是一块白屏)。
 */
function splitEven(levels: readonly Level[], unitId: string, part: 'easy' | 'hard'): Lesson[] {
  const n = levels.length
  if (n === 0) return []
  const k = Math.ceil(n / LESSON_MAX)
  const base = Math.floor(n / k)
  const rem = n % k
  const out: Lesson[] = []
  let at = 0
  for (let i = 0; i < k; i++) {
    const size = base + (i < rem ? 1 : 0)
    out.push({
      id: `${unitId}#${part}-${i}`,
      unitId,
      part,
      levelIds: levels.slice(at, at + size).map((l) => l.id),
    })
    at += size
  }
  return out
}

/** 一个单元的全部节,顺序 = 简单各节 → 困难各节。 */
export function lessonsOf(unit: Unit): readonly Lesson[] {
  return [
    ...splitEven(easyLevelsOf(unit), unit.id, 'easy'),
    ...splitEven(hardLevelsOf(unit), unit.id, 'hard'),
  ]
}

/** 全路径的节,按单元顺序展平 —— 地图顺序与「下一个该走哪一节」的唯一事实源。 */
export function pathLessons(units: readonly Unit[] = UNITS): readonly Lesson[] {
  return units.flatMap(lessonsOf)
}
