// 基础单元目录(纯数据,不依赖词库/服务)。
// 拼音按两拼口径拆:声母 23 + 韵母 + 声调;英语拆 26 字母。
// 锚点尽量取自 100 词词库;无则用常见儿童词。
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
  { symbol: 'b', anchorPinyin: 'bāo', anchorHanzi: '包', anchorEmoji: '🎒' },
  { symbol: 'p', anchorPinyin: 'píng guǒ', anchorHanzi: '苹果', anchorEmoji: '🍎' },
  { symbol: 'm', anchorPinyin: 'māo', anchorHanzi: '猫', anchorEmoji: '🐱' },
  { symbol: 'f', anchorPinyin: 'fēi jī', anchorHanzi: '飞机', anchorEmoji: '✈️' },
  { symbol: 'd', anchorPinyin: 'dà xiàng', anchorHanzi: '大象', anchorEmoji: '🐘' },
  { symbol: 't', anchorPinyin: 'tài yáng', anchorHanzi: '太阳', anchorEmoji: '☀️' },
  { symbol: 'n', anchorPinyin: 'niú nǎi', anchorHanzi: '牛奶', anchorEmoji: '🥛' },
  { symbol: 'l', anchorPinyin: 'lóng', anchorHanzi: '龙', anchorEmoji: '🐉' },
  { symbol: 'g', anchorPinyin: 'gǒu', anchorHanzi: '狗', anchorEmoji: '🐶' },
  { symbol: 'k', anchorPinyin: 'kǎ chē', anchorHanzi: '卡车', anchorEmoji: '🚚' },
  { symbol: 'h', anchorPinyin: 'huā', anchorHanzi: '花', anchorEmoji: '🌸' },
  { symbol: 'j', anchorPinyin: 'jī dàn', anchorHanzi: '鸡蛋', anchorEmoji: '🥚' },
  { symbol: 'q', anchorPinyin: 'qì qiú', anchorHanzi: '气球', anchorEmoji: '🎈' },
  { symbol: 'x', anchorPinyin: 'xī guā', anchorHanzi: '西瓜', anchorEmoji: '🍉' },
  { symbol: 'zh', anchorPinyin: 'zhī zhū', anchorHanzi: '蜘蛛', anchorEmoji: '🕷️' },
  { symbol: 'ch', anchorPinyin: 'chē', anchorHanzi: '车', anchorEmoji: '🚗' },
  { symbol: 'sh', anchorPinyin: 'shū', anchorHanzi: '书', anchorEmoji: '📖' },
  { symbol: 'r', anchorPinyin: 'rì', anchorHanzi: '日', anchorEmoji: '☀️' },
  { symbol: 'z', anchorPinyin: 'zì xíng chē', anchorHanzi: '自行车', anchorEmoji: '🚲' },
  { symbol: 'c', anchorPinyin: 'cǎi hóng', anchorHanzi: '彩虹', anchorEmoji: '🌈' },
  { symbol: 's', anchorPinyin: 'sǎn', anchorHanzi: '伞', anchorEmoji: '☂️' },
  { symbol: 'y', anchorPinyin: 'yā zi', anchorHanzi: '鸭子', anchorEmoji: '🦆' },
  { symbol: 'w', anchorPinyin: 'wū guī', anchorHanzi: '乌龟', anchorEmoji: '🐢' },
]

/** 韵母目录(symbol 为方案全形;锚点取自词库词)。 */
export const PINYIN_FINALS: PinyinAnchor[] = [
  { symbol: 'a', anchorPinyin: 'mǎ', anchorHanzi: '马', anchorEmoji: '🐴' },
  { symbol: 'o', anchorPinyin: 'mó gu', anchorHanzi: '蘑菇', anchorEmoji: '🍄' },
  { symbol: 'e', anchorPinyin: 'qì chē', anchorHanzi: '汽车', anchorEmoji: '🚗' },
  { symbol: 'i', anchorPinyin: 'jī dàn', anchorHanzi: '鸡蛋', anchorEmoji: '🥚' },
  { symbol: 'u', anchorPinyin: 'zhū', anchorHanzi: '猪', anchorEmoji: '🐷' },
  { symbol: 'ü', anchorPinyin: 'yú', anchorHanzi: '鱼', anchorEmoji: '🐟' },
  { symbol: 'ai', anchorPinyin: 'tài yáng', anchorHanzi: '太阳', anchorEmoji: '☀️' },
  { symbol: 'ei', anchorPinyin: 'bēi zi', anchorHanzi: '杯子', anchorEmoji: '☕' },
  { symbol: 'ao', anchorPinyin: 'māo', anchorHanzi: '猫', anchorEmoji: '🐱' },
  { symbol: 'ou', anchorPinyin: 'gǒu', anchorHanzi: '狗', anchorEmoji: '🐶' },
  { symbol: 'an', anchorPinyin: 'shān', anchorHanzi: '山', anchorEmoji: '⛰️' },
  { symbol: 'en', anchorPinyin: 'mén', anchorHanzi: '门', anchorEmoji: '🚪' },
  { symbol: 'ang', anchorPinyin: 'fáng zi', anchorHanzi: '房子', anchorEmoji: '🏠' },
  { symbol: 'eng', anchorPinyin: 'fēng zheng', anchorHanzi: '风筝', anchorEmoji: '🪁' },
  { symbol: 'ong', anchorPinyin: 'lóng', anchorHanzi: '龙', anchorEmoji: '🐉' },
  { symbol: 'ia', anchorPinyin: 'yā zi', anchorHanzi: '鸭子', anchorEmoji: '🦆' },
  { symbol: 'ie', anchorPinyin: 'hú dié', anchorHanzi: '蝴蝶', anchorEmoji: '🦋' },
  { symbol: 'iao', anchorPinyin: 'niǎo', anchorHanzi: '鸟', anchorEmoji: '🐦' },
  { symbol: 'iou', anchorPinyin: 'qiú', anchorHanzi: '球', anchorEmoji: '⚽' },
  { symbol: 'ian', anchorPinyin: 'miàn bāo', anchorHanzi: '面包', anchorEmoji: '🍞' },
  { symbol: 'in', anchorPinyin: 'ài xīn', anchorHanzi: '爱心', anchorEmoji: '❤️' },
  { symbol: 'iang', anchorPinyin: 'dà xiàng', anchorHanzi: '大象', anchorEmoji: '🐘' },
  { symbol: 'ing', anchorPinyin: 'xīng xing', anchorHanzi: '星星', anchorEmoji: '⭐' },
  { symbol: 'iong', anchorPinyin: 'xióng', anchorHanzi: '熊', anchorEmoji: '🐻' },
  { symbol: 'ua', anchorPinyin: 'huā', anchorHanzi: '花', anchorEmoji: '🌸' },
  { symbol: 'uo', anchorPinyin: 'píng guǒ', anchorHanzi: '苹果', anchorEmoji: '🍎' },
  { symbol: 'uei', anchorPinyin: 'wū guī', anchorHanzi: '乌龟', anchorEmoji: '🐢' },
  { symbol: 'uan', anchorPinyin: 'xiǎo chuán', anchorHanzi: '小船', anchorEmoji: '⛵' },
  { symbol: 'uen', anchorPinyin: 'hǎi tún', anchorHanzi: '海豚', anchorEmoji: '🐬' },
  { symbol: 'uang', anchorPinyin: 'chuāng hu', anchorHanzi: '窗户', anchorEmoji: '🪟' },
  { symbol: 'üe', anchorPinyin: 'xuě huā', anchorHanzi: '雪花', anchorEmoji: '❄️' },
  { symbol: 'üan', anchorPinyin: 'tián tián quān', anchorHanzi: '甜甜圈', anchorEmoji: '🍩' },
  { symbol: 'ün', anchorPinyin: 'yún', anchorHanzi: '云', anchorEmoji: '☁️' },
  { symbol: 'ueng', anchorPinyin: 'wēng', anchorHanzi: '嗡', anchorEmoji: '🐝' },
]

/** 声调 5:ton1..ton4 + 轻声 ton0(锚点取标调音节/轻声词)。 */
export const PINYIN_TONES: ToneUnit[] = [
  { symbol: 'ton1', label: '一声', anchorPinyin: 'māo', anchorHanzi: '猫', anchorEmoji: '🐱' },
  { symbol: 'ton2', label: '二声', anchorPinyin: 'lí', anchorHanzi: '梨', anchorEmoji: '🍐' },
  { symbol: 'ton3', label: '三声', anchorPinyin: 'mǎ', anchorHanzi: '马', anchorEmoji: '🐴' },
  { symbol: 'ton4', label: '四声', anchorPinyin: 'shù', anchorHanzi: '树', anchorEmoji: '🌳' },
  { symbol: 'ton0', label: '轻声', anchorPinyin: 'mào zi', anchorHanzi: '帽子', anchorEmoji: '🎩' },
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
