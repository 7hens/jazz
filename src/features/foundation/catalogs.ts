// 基础单元目录(纯数据,不依赖词库/服务)。
// 拼音按两拼口径拆:声母 23 + 韵母 + 声调;英语拆 26 字母。
// 锚点为每单元独立单字整音节锚(声母∪韵母内汉字/emoji 全唯一,可超出词库,取常见儿童单字)。
// 声母锚 = 以该声母开头的单字整音节;韵母锚 = 零声母整音节优先(整音节 = 该韵母,读感纯),无则回退含该韵母带声母单字(自拆只归口本韵母)。
// 韵母 symbol 用汉语拼音方案全形(iou/uei/uen…):拆解时把写法缩写 iu/ui/un 归口回全形。
// 声母含 y/w(两拼教学惯例列 23 声母),但拆解算法把 y/w 起头音节当零声母整音节处理,永不产出 pinyin:y / pinyin:w 键。

export type TrackKey = 'pinyin' | 'english'

/** 韵母目录条目。 */
export type PinyinAnchor = { symbol: string; anchorPinyin: string; anchorHanzi: string; anchorEmoji: string }
/** 声母目录条目。 */
export type InitialUnit = { symbol: string; anchorPinyin: string; anchorHanzi: string; anchorEmoji: string }
/** 声调目录条目。 */
export type ToneUnit = { symbol: string; label: string; anchorPinyin: string; anchorHanzi: string; anchorEmoji: string }
/** 英语字母目录条目。 */
export type EnglishLetter = { symbol: string; anchorWord: string; anchorEmoji: string }

export function unitKey(track: TrackKey, sym: string): string {
  return `${track}:${sym}`
}

/** 声母 23(b p m f d t n l g k h j q x zh ch sh r z c s y w)。 */
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

/** 韵母目录(symbol 为方案全形;锚点 = 含该韵母的单字整音节,可超出词库)。 */
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
  { symbol: 'ie', anchorPinyin: 'yè', anchorHanzi: '叶', anchorEmoji: '🍃' },
  { symbol: 'iao', anchorPinyin: 'niǎo', anchorHanzi: '鸟', anchorEmoji: '🐦' },
  { symbol: 'iou', anchorPinyin: 'yóu', anchorHanzi: '游', anchorEmoji: '🏊' },
  { symbol: 'ian', anchorPinyin: 'yǎn', anchorHanzi: '眼', anchorEmoji: '👀' },
  { symbol: 'in', anchorPinyin: 'xīn', anchorHanzi: '心', anchorEmoji: '💗' },
  { symbol: 'iang', anchorPinyin: 'yáng', anchorHanzi: '阳', anchorEmoji: '☀️' },
  { symbol: 'ing', anchorPinyin: 'yīng', anchorHanzi: '鹰', anchorEmoji: '🦅' },
  { symbol: 'iong', anchorPinyin: 'xióng', anchorHanzi: '熊', anchorEmoji: '🐻' },
  { symbol: 'ua', anchorPinyin: 'wā', anchorHanzi: '蛙', anchorEmoji: '🐸' },
  { symbol: 'uo', anchorPinyin: 'guǒ', anchorHanzi: '果', anchorEmoji: '🍎' },
  { symbol: 'uei', anchorPinyin: 'guī', anchorHanzi: '龟', anchorEmoji: '🐢' },
  { symbol: 'uan', anchorPinyin: 'wǎn', anchorHanzi: '碗', anchorEmoji: '🥣' },
  { symbol: 'uen', anchorPinyin: 'wén', anchorHanzi: '蚊', anchorEmoji: '🦟' },
  { symbol: 'uang', anchorPinyin: 'wáng', anchorHanzi: '王', anchorEmoji: '👑' },
  { symbol: 'üe', anchorPinyin: 'yuè', anchorHanzi: '月', anchorEmoji: '🌙' },
  { symbol: 'üan', anchorPinyin: 'yuán', anchorHanzi: '圆', anchorEmoji: '⭕' },
  { symbol: 'ün', anchorPinyin: 'yún', anchorHanzi: '云', anchorEmoji: '☁️' },
  { symbol: 'ueng', anchorPinyin: 'wēng', anchorHanzi: '翁', anchorEmoji: '👴' },
]

/** 声调 4:ton1..ton4(锚统一 qi 音节;轻声退役:本不出题,轻声音节也不再产声调单元键)。 */
export const PINYIN_TONES: ToneUnit[] = [
  { symbol: 'ton1', label: '一声', anchorPinyin: 'qī', anchorHanzi: '七', anchorEmoji: '7️⃣' },
  { symbol: 'ton2', label: '二声', anchorPinyin: 'qí', anchorHanzi: '旗', anchorEmoji: '🚩' },
  { symbol: 'ton3', label: '三声', anchorPinyin: 'qǐ', anchorHanzi: '企', anchorEmoji: '🐧' },
  { symbol: 'ton4', label: '四声', anchorPinyin: 'qì', anchorHanzi: '气', anchorEmoji: '🎈' },
]

/** 英语 26 字母(anchorWord 尽量取词库词;n/q/v/x/y/z 无词库词用常见儿童词)。 */
export const ENGLISH_LETTERS: EnglishLetter[] = [
  { symbol: 'a', anchorWord: 'apple', anchorEmoji: '🍎' },
  { symbol: 'b', anchorWord: 'banana', anchorEmoji: '🍌' },
  { symbol: 'c', anchorWord: 'cat', anchorEmoji: '🐱' },
  { symbol: 'd', anchorWord: 'dog', anchorEmoji: '🐶' },
  { symbol: 'e', anchorWord: 'egg', anchorEmoji: '🥚' },
  { symbol: 'f', anchorWord: 'fish', anchorEmoji: '🐟' },
  { symbol: 'g', anchorWord: 'gift', anchorEmoji: '🎁' },
  { symbol: 'h', anchorWord: 'hat', anchorEmoji: '🎩' },
  { symbol: 'i', anchorWord: 'ice cream', anchorEmoji: '🍦' },
  { symbol: 'j', anchorWord: 'juice', anchorEmoji: '🧃' },
  { symbol: 'k', anchorWord: 'kite', anchorEmoji: '🪁' },
  { symbol: 'l', anchorWord: 'lion', anchorEmoji: '🦁' },
  { symbol: 'm', anchorWord: 'moon', anchorEmoji: '🌙' },
  { symbol: 'n', anchorWord: 'nose', anchorEmoji: '👃' },
  { symbol: 'o', anchorWord: 'orange', anchorEmoji: '🍊' },
  { symbol: 'p', anchorWord: 'panda', anchorEmoji: '🐼' },
  { symbol: 'q', anchorWord: 'queen', anchorEmoji: '👑' },
  { symbol: 'r', anchorWord: 'rabbit', anchorEmoji: '🐰' },
  { symbol: 's', anchorWord: 'sun', anchorEmoji: '☀️' },
  { symbol: 't', anchorWord: 'tree', anchorEmoji: '🌳' },
  { symbol: 'u', anchorWord: 'umbrella', anchorEmoji: '☂️' },
  { symbol: 'v', anchorWord: 'violin', anchorEmoji: '🎻' },
  { symbol: 'w', anchorWord: 'watermelon', anchorEmoji: '🍉' },
  { symbol: 'x', anchorWord: 'xylophone', anchorEmoji: '🎵' },
  { symbol: 'y', anchorWord: 'yo-yo', anchorEmoji: '🪀' },
  { symbol: 'z', anchorWord: 'zebra', anchorEmoji: '🦓' },
]
