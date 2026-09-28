// 困难章的题。**与简单章一一对应**:同单元、`id = 对应简单题的完整 id + 'h'`。
//
// 为什么 id 是「照抄简单题的 id 加 h」而不是按位置编序号:现有 id 记的是
// 「这道题出自哪一课的题组」,和它今天落在哪个单元**无关** —— u3 单元里有 u2-4、
// u5 单元里有 u3-0~u3-5 和 u6-5、u12 单元的六道题**全部**是 u7-*。
// 按位置编序号 = 造新存档键 = 老存档的星全断。
//
// 数据与 `levels.ts` 分开放:182 道题的单个数组读不动,而「哪一批是新增的」在 diff 里一眼看得出。
// `Partial`:分批录入,缺哪个单元那个单元的困难章就是空的(空章不进,见 progress-stats)。
// 全部录完后由 `chapters.test.ts` 的总账那条钉住 12 个单元一个不缺。
import type { Level } from './levels'

export const HARD_LEVELS: Readonly<Partial<Record<string, readonly Level[]>>> = {
  u1: [
    { id: 'u1-0h', emoji: '🅰️', pinyin: 'ā', read: '啊', syl: [{ final: 'a', tone: 1 }], stage: 'hard' },
    { id: 'u1-1h', emoji: '🅾️', pinyin: 'ō', read: '噢', syl: [{ final: 'o', tone: 1 }], stage: 'hard' },
    { id: 'u1-2h', emoji: '😐', pinyin: 'ě', read: '恶', syl: [{ final: 'e', tone: 3 }], stage: 'hard' },
    { id: 'u1-50h', emoji: '👚', pinyin: 'yí', read: '姨', syl: [{ final: 'i', tone: 2 }], stage: 'hard' },
    { id: 'u1-51h', emoji: '🌫️', pinyin: 'wù', read: '雾', syl: [{ final: 'u', tone: 4 }], stage: 'hard' },
    { id: 'u1-52h', emoji: '😲', pinyin: 'ò', read: '哦', syl: [{ final: 'o', tone: 4 }], stage: 'hard' },
  ],
  u2: [
    { id: 'u2-0h', emoji: '8️⃣', pinyin: 'bā', read: '八', syl: [{ initial: 'b', final: 'a', tone: 1 }], stage: 'hard' },
    { id: 'u2-1h', emoji: '👩', pinyin: 'mā', read: '妈', syl: [{ initial: 'm', final: 'a', tone: 1 }], stage: 'hard' },
    { id: 'u2-2h', emoji: '⚽', pinyin: 'tī', read: '踢', syl: [{ initial: 't', final: 'i', tone: 1 }], stage: 'hard' },
    { id: 'u2-3h', emoji: '🟤', pinyin: 'ní', read: '泥', syl: [{ initial: 'n', final: 'i', tone: 2 }], stage: 'hard' },
    { id: 'u2-50h', emoji: '🧗', pinyin: 'pá', read: '爬', syl: [{ initial: 'p', final: 'a', tone: 2 }], stage: 'hard' },
    { id: 'u2-51h', emoji: '🙏', pinyin: 'fó', read: '佛', syl: [{ initial: 'f', final: 'o', tone: 2 }], stage: 'hard' },
    { id: 'u2-52h', emoji: '🐘', pinyin: 'dà', read: '大', syl: [{ initial: 'd', final: 'a', tone: 4 }], stage: 'hard' },
    { id: 'u2-53h', emoji: '🛣️', pinyin: 'lù', read: '路', syl: [{ initial: 'l', final: 'u', tone: 4 }], stage: 'hard' },
    { id: 'u2-54h', emoji: '🪵', pinyin: 'mù', read: '木', syl: [{ initial: 'm', final: 'u', tone: 4 }], stage: 'hard' },
  ],
  u3: [
    { id: 'u2-4h', emoji: '😰', pinyin: 'jí', read: '急', syl: [{ initial: 'j', final: 'i', tone: 2 }], stage: 'hard' },
    { id: 'u3-50h', emoji: '👦', pinyin: 'gē', read: '哥', syl: [{ initial: 'g', final: 'e', tone: 1 }], stage: 'hard' },
    { id: 'u3-51h', emoji: '😖', pinyin: 'kǔ', read: '苦', syl: [{ initial: 'k', final: 'u', tone: 3 }], stage: 'hard' },
    { id: 'u3-52h', emoji: '😄', pinyin: 'hā', read: '哈', syl: [{ initial: 'h', final: 'a', tone: 1 }], stage: 'hard' },
    { id: 'u3-53h', emoji: '💨', pinyin: 'qì', read: '汽', syl: [{ initial: 'q', final: 'i', tone: 4 }], stage: 'hard' },
    { id: 'u3-54h', emoji: '⬅️', pinyin: 'xī', read: '西', syl: [{ initial: 'x', final: 'i', tone: 1 }], stage: 'hard' },
    { id: 'u3-55h', emoji: '📚', pinyin: 'kè', read: '课', syl: [{ initial: 'k', final: 'e', tone: 4 }], stage: 'hard' },
  ],
  u4: [
    { id: 'u2-5h', emoji: '🧩', pinyin: 'zá', read: '杂', syl: [{ initial: 'z', final: 'a', tone: 2 }], stage: 'hard' },
    { id: 'u4-50h', emoji: '💥', pinyin: 'zhà', read: '炸', syl: [{ initial: 'zh', final: 'a', tone: 4 }], stage: 'hard' },
    { id: 'u4-51h', emoji: '🍵', pinyin: 'chá', read: '茶', syl: [{ initial: 'ch', final: 'a', tone: 2 }], stage: 'hard' },
    { id: 'u4-52h', emoji: '🐍', pinyin: 'shé', read: '蛇', syl: [{ initial: 'sh', final: 'e', tone: 2 }], stage: 'hard' },
    { id: 'u4-53h', emoji: '📥', pinyin: 'rù', read: '入', syl: [{ initial: 'r', final: 'u', tone: 4 }], stage: 'hard' },
    { id: 'u4-54h', emoji: '🧴', pinyin: 'cù', read: '醋', syl: [{ initial: 'c', final: 'u', tone: 4 }], stage: 'hard' },
    { id: 'u4-55h', emoji: '🚿', pinyin: 'sǎ', read: '洒', syl: [{ initial: 's', final: 'a', tone: 3 }], stage: 'hard' },
    { id: 'u4-56h', emoji: '🐸', pinyin: 'wā', read: '蛙', syl: [{ initial: 'w', final: 'a', tone: 1 }], stage: 'hard' },
    { id: 'u4-57h', emoji: '💡', pinyin: 'yì', read: '意', syl: [{ initial: 'y', final: 'i', tone: 4, weld: true }], stage: 'hard' },
    { id: 'u4-58h', emoji: '👴', pinyin: 'zǔ', read: '祖', syl: [{ initial: 'z', final: 'u', tone: 3 }], stage: 'hard' },
  ],
  u5: [
    { id: 'u3-0h', emoji: '🏃', pinyin: 'pǎo', read: '跑', syl: [{ initial: 'p', final: 'ao', tone: 3 }], stage: 'hard' },
    { id: 'u3-1h', emoji: '🐒', pinyin: 'hóu', read: '猴', syl: [{ initial: 'h', final: 'ou', tone: 2 }], stage: 'hard' },
    { id: 'u3-2h', emoji: '⚪', pinyin: 'bái', read: '白', syl: [{ initial: 'b', final: 'ai', tone: 2 }], stage: 'hard' },
    { id: 'u3-3h', emoji: '🕊️', pinyin: 'fēi', read: '飞', syl: [{ initial: 'f', final: 'ei', tone: 1 }], stage: 'hard' },
    { id: 'u3-4h', emoji: '🤏', pinyin: 'niē', read: '捏', syl: [{ initial: 'n', final: 'ie', tone: 1 }], stage: 'hard' },
    { id: 'u3-5h', emoji: '🍶', pinyin: 'jiǔ', read: '酒', syl: [{ initial: 'j', final: 'iu', tone: 3 }], stage: 'hard' },
    { id: 'u6-5h', emoji: '🔒', pinyin: 'yuē', read: '约', syl: [{ initial: 'y', final: 'üe', tone: 1, weld: true }], stage: 'hard' },
    { id: 'u5-50h', emoji: '🫘', pinyin: 'dòu', read: '豆', syl: [{ initial: 'd', final: 'ou', tone: 4 }], stage: 'hard' },
    { id: 'u5-51h', emoji: '😪', pinyin: 'lèi', read: '累', syl: [{ initial: 'l', final: 'ei', tone: 4 }], stage: 'hard' },
    { id: 'u5-52h', emoji: '👭', pinyin: 'mèi', read: '妹', syl: [{ initial: 'm', final: 'ei', tone: 4 }], stage: 'hard' },
  ],
  u6: [
    { id: 'u4-0h', emoji: '🌱', pinyin: 'gēn', read: '根', syl: [{ initial: 'g', final: 'e', nasal: 'n', tone: 1 }], stage: 'hard' },
    { id: 'u4-1h', emoji: '🏫', pinyin: 'bān', read: '班', syl: [{ initial: 'b', final: 'a', nasal: 'n', tone: 1 }], stage: 'hard' },
    { id: 'u6-50h', emoji: '🥈', pinyin: 'yín', read: '银', syl: [{ initial: 'y', final: 'i', nasal: 'n', tone: 2, weld: true }], stage: 'hard' },
    { id: 'u6-51h', emoji: '🍽️', pinyin: 'pán', read: '盘', syl: [{ initial: 'p', final: 'a', nasal: 'n', tone: 2 }], stage: 'hard' },
    { id: 'u6-52h', emoji: '💧', pinyin: 'hàn', read: '汗', syl: [{ initial: 'h', final: 'a', nasal: 'n', tone: 4 }], stage: 'hard' },
  ],
  u7: [
    { id: 'u4-2h', emoji: '🤝', pinyin: 'bāng', read: '帮', syl: [{ initial: 'b', final: 'a', nasal: 'ng', tone: 1 }], stage: 'hard' },
    { id: 'u4-3h', emoji: '🔩', pinyin: 'gāng', read: '钢', syl: [{ initial: 'g', final: 'a', nasal: 'ng', tone: 1 }], stage: 'hard' },
    { id: 'u4-4h', emoji: '↔️', pinyin: 'héng', read: '横', syl: [{ initial: 'h', final: 'e', nasal: 'ng', tone: 2 }], stage: 'hard' },
    { id: 'u5-4h', emoji: '🍬', pinyin: 'táng', read: '糖', syl: [{ initial: 't', final: 'a', nasal: 'ng', tone: 2 }], stage: 'hard' },
    { id: 'u7-50h', emoji: '🕳️', pinyin: 'kēng', read: '坑', syl: [{ initial: 'k', final: 'e', nasal: 'ng', tone: 1 }], stage: 'hard' },
    { id: 'u7-51h', emoji: '👬', pinyin: 'péng', read: '朋', syl: [{ initial: 'p', final: 'e', nasal: 'ng', tone: 2 }], stage: 'hard' },
  ],
  u8: [
    { id: 'u5-0h', emoji: '🔢', pinyin: 'duō', read: '多', syl: [{ initial: 'd', medial: 'u', final: 'o', tone: 1 }], stage: 'hard' },
    { id: 'u5-1h', emoji: '🌤️', pinyin: 'tiān', read: '天', syl: [{ initial: 't', medial: 'i', final: 'a', nasal: 'n', tone: 1 }], stage: 'hard' },
    { id: 'u5-2h', emoji: '🏘️', pinyin: 'jiā', read: '家', syl: [{ initial: 'j', medial: 'i', final: 'a', tone: 1 }], stage: 'hard' },
    { id: 'u5-3h', emoji: '🏀', pinyin: 'qiú', read: '球', syl: [{ initial: 'q', final: 'iu', tone: 2 }], stage: 'hard' },
    { id: 'u8-50h', emoji: '🖊️', pinyin: 'xiě', read: '写', syl: [{ initial: 'x', final: 'ie', tone: 3 }], stage: 'hard' },
    { id: 'u8-51h', emoji: '🌊', pinyin: 'shuǐ', read: '水', syl: [{ initial: 'sh', final: 'ui', tone: 3 }], stage: 'hard' },
    { id: 'u8-52h', emoji: '⚡', pinyin: 'kuài', read: '快', syl: [{ initial: 'k', medial: 'u', final: 'ai', tone: 4 }], stage: 'hard' },
  ],
}
