import type { Level } from '../types'

/**
 * 魔法语言岛 · 新手村 10 关题库
 *
 * 素材来源:docs/superpowers/specs/2026-09-02-magic-language-island-design.md §五。
 * 发音约定:拼音卡卡面显示拼音,`speak` 用同音汉字(zh-CN 朗读);汉字卡直读汉字;英语卡 en-US 朗读词/字母。
 * 所有 id(题选项/左右列)全局唯一,前缀为 `{关}-{关内题号}-{内容}`。
 * 第 10 关为独立新建题对象,不复用 L1–L9 的对象引用。
 */
export const LEVELS: Level[] = [
  // ─────────────────────────── L1 韵母小镇 ───────────────────────────
  {
    id: 1,
    kingdom: 'pinyin',
    title: '韵母小镇',
    questions: [
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的韵母',
        promptSpeak: '啊',
        options: [
          { id: '1-1-a', text: 'a', speak: '啊' },
          { id: '1-1-o', text: 'o', speak: '喔' },
          { id: '1-1-e', text: 'e', speak: '鹅' },
          { id: '1-1-i', text: 'i', speak: '衣' },
        ],
        answerId: '1-1-a',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的韵母',
        promptSpeak: '喔',
        options: [
          { id: '1-2-o', text: 'o', speak: '喔' },
          { id: '1-2-a', text: 'a', speak: '啊' },
          { id: '1-2-u', text: 'u', speak: '乌' },
          { id: '1-2-v', text: 'ü', speak: '迂' },
        ],
        answerId: '1-2-o',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的韵母',
        promptSpeak: '鹅',
        options: [
          { id: '1-3-e', text: 'e', speak: '鹅' },
          { id: '1-3-i', text: 'i', speak: '衣' },
          { id: '1-3-u', text: 'u', speak: '乌' },
          { id: '1-3-v', text: 'ü', speak: '迂' },
        ],
        answerId: '1-3-e',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的韵母',
        promptSpeak: '衣',
        options: [
          { id: '1-4-i', text: 'i', speak: '衣' },
          { id: '1-4-a', text: 'a', speak: '啊' },
          { id: '1-4-o', text: 'o', speak: '喔' },
          { id: '1-4-v', text: 'ü', speak: '迂' },
        ],
        answerId: '1-4-i',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的韵母',
        promptSpeak: '乌',
        options: [
          { id: '1-5-u', text: 'u', speak: '乌' },
          { id: '1-5-o', text: 'o', speak: '喔' },
          { id: '1-5-e', text: 'e', speak: '鹅' },
          { id: '1-5-i', text: 'i', speak: '衣' },
        ],
        answerId: '1-5-u',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的韵母',
        promptSpeak: '迂',
        options: [
          { id: '1-6-v', text: 'ü', speak: '迂' },
          { id: '1-6-u', text: 'u', speak: '乌' },
          { id: '1-6-i', text: 'i', speak: '衣' },
          { id: '1-6-a', text: 'a', speak: '啊' },
        ],
        answerId: '1-6-v',
      },
    ],
  },

  // ─────────────────────────── L2 声母城堡 ───────────────────────────
  {
    id: 2,
    kingdom: 'pinyin',
    title: '声母城堡',
    questions: [
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的声母',
        promptSpeak: '玻',
        options: [
          { id: '2-1-b', text: 'b', speak: '玻' },
          { id: '2-1-p', text: 'p', speak: '坡' },
          { id: '2-1-d', text: 'd', speak: '得' },
          { id: '2-1-t', text: 't', speak: '特' },
        ],
        answerId: '2-1-b',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的声母',
        promptSpeak: '坡',
        options: [
          { id: '2-2-p', text: 'p', speak: '坡' },
          { id: '2-2-b', text: 'b', speak: '玻' },
          { id: '2-2-m', text: 'm', speak: '摸' },
          { id: '2-2-f', text: 'f', speak: '佛' },
        ],
        answerId: '2-2-p',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的声母',
        promptSpeak: '摸',
        options: [
          { id: '2-3-m', text: 'm', speak: '摸' },
          { id: '2-3-n', text: 'n', speak: '讷' },
          { id: '2-3-l', text: 'l', speak: '勒' },
          { id: '2-3-p', text: 'p', speak: '坡' },
        ],
        answerId: '2-3-m',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的声母',
        promptSpeak: '佛',
        options: [
          { id: '2-4-f', text: 'f', speak: '佛' },
          { id: '2-4-t', text: 't', speak: '特' },
          { id: '2-4-m', text: 'm', speak: '摸' },
          { id: '2-4-b', text: 'b', speak: '玻' },
        ],
        answerId: '2-4-f',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的声母',
        promptSpeak: '得',
        options: [
          { id: '2-5-d', text: 'd', speak: '得' },
          { id: '2-5-t', text: 't', speak: '特' },
          { id: '2-5-n', text: 'n', speak: '讷' },
          { id: '2-5-l', text: 'l', speak: '勒' },
        ],
        answerId: '2-5-d',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的声母',
        promptSpeak: '特',
        options: [
          { id: '2-6-t', text: 't', speak: '特' },
          { id: '2-6-d', text: 'd', speak: '得' },
          { id: '2-6-p', text: 'p', speak: '坡' },
          { id: '2-6-f', text: 'f', speak: '佛' },
        ],
        answerId: '2-6-t',
      },
    ],
  },

  // ─────────────────────────── L3 声调小山 ───────────────────────────
  {
    id: 3,
    kingdom: 'pinyin',
    title: '声调小山',
    questions: [
      {
        kind: 'listen-choice',
        prompt: '听一听,选出正确的带调拼音',
        promptSpeak: '妈',
        options: [
          { id: '3-1-ma1', text: 'mā', speak: '妈' },
          { id: '3-1-ma2', text: 'má', speak: '麻' },
          { id: '3-1-ma3', text: 'mǎ', speak: '马' },
          { id: '3-1-ma4', text: 'mà', speak: '骂' },
        ],
        answerId: '3-1-ma1',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出正确的带调拼音',
        promptSpeak: '骂',
        options: [
          { id: '3-2-ma1', text: 'mā', speak: '妈' },
          { id: '3-2-ma2', text: 'má', speak: '麻' },
          { id: '3-2-ma3', text: 'mǎ', speak: '马' },
          { id: '3-2-ma4', text: 'mà', speak: '骂' },
        ],
        answerId: '3-2-ma4',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出正确的带调拼音',
        promptSpeak: '拔',
        options: [
          { id: '3-3-ba1', text: 'bā', speak: '八' },
          { id: '3-3-ba2', text: 'bá', speak: '拔' },
          { id: '3-3-ba3', text: 'bǎ', speak: '把' },
          { id: '3-3-ba4', text: 'bà', speak: '爸' },
        ],
        answerId: '3-3-ba2',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出正确的带调拼音',
        promptSpeak: '爸',
        options: [
          { id: '3-4-ba1', text: 'bā', speak: '八' },
          { id: '3-4-ba2', text: 'bá', speak: '拔' },
          { id: '3-4-ba3', text: 'bǎ', speak: '把' },
          { id: '3-4-ba4', text: 'bà', speak: '爸' },
        ],
        answerId: '3-4-ba4',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出正确的带调拼音',
        promptSpeak: '衣',
        options: [
          { id: '3-5-yi1', text: 'yī', speak: '衣' },
          { id: '3-5-yi2', text: 'yí', speak: '姨' },
          { id: '3-5-yi3', text: 'yǐ', speak: '椅' },
          { id: '3-5-yi4', text: 'yì', speak: '亿' },
        ],
        answerId: '3-5-yi1',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出正确的带调拼音',
        promptSpeak: '椅',
        options: [
          { id: '3-6-yi1', text: 'yī', speak: '衣' },
          { id: '3-6-yi2', text: 'yí', speak: '姨' },
          { id: '3-6-yi3', text: 'yǐ', speak: '椅' },
          { id: '3-6-yi4', text: 'yì', speak: '亿' },
        ],
        answerId: '3-6-yi3',
      },
    ],
  },

  // ─────────────────────────── L4 拼读魔法阵 ─────────────────────────
  {
    id: 4,
    kingdom: 'pinyin',
    title: '拼读魔法阵',
    questions: [
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的拼音',
        promptSpeak: '妈',
        options: [
          { id: '4-1-ma', text: 'mā', speak: '妈' },
          { id: '4-1-ba', text: 'bā' },
          { id: '4-1-pa', text: 'pā' },
          { id: '4-1-da', text: 'dā' },
        ],
        answerId: '4-1-ma',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的拼音',
        promptSpeak: '爸',
        options: [
          { id: '4-2-ba', text: 'bà', speak: '爸' },
          { id: '4-2-da', text: 'dà' },
          { id: '4-2-ma', text: 'mà' },
          { id: '4-2-ta', text: 'tà' },
        ],
        answerId: '4-2-ba',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的拼音',
        promptSpeak: '大',
        options: [
          { id: '4-3-da', text: 'dà', speak: '大' },
          { id: '4-3-ba', text: 'bà' },
          { id: '4-3-na', text: 'nà' },
          { id: '4-3-ta', text: 'tà' },
        ],
        answerId: '4-3-da',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的拼音',
        promptSpeak: '米',
        options: [
          { id: '4-4-mi', text: 'mǐ', speak: '米' },
          { id: '4-4-ni', text: 'nǐ' },
          { id: '4-4-bi', text: 'bǐ' },
          { id: '4-4-pi', text: 'pǐ' },
        ],
        answerId: '4-4-mi',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的拼音',
        promptSpeak: '地',
        options: [
          { id: '4-5-di', text: 'dì', speak: '地' },
          { id: '4-5-ti', text: 'tì' },
          { id: '4-5-li', text: 'lì' },
          { id: '4-5-bi', text: 'bì' },
        ],
        answerId: '4-5-di',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的拼音',
        promptSpeak: '兔',
        options: [
          { id: '4-6-tu', text: 'tù', speak: '兔' },
          { id: '4-6-du', text: 'dù' },
          { id: '4-6-nu', text: 'nù' },
          { id: '4-6-lu', text: 'lù' },
        ],
        answerId: '4-6-tu',
      },
    ],
  },

  // ─────────────────────────── L5 象形字林 ───────────────────────────
  {
    id: 5,
    kingdom: 'hanzi',
    title: '象形字林',
    questions: [
      {
        kind: 'match',
        prompt: '把字和它对应的图连起来',
        left: [
          { id: '5-1-left-ri', text: '日', speak: '日' },
          { id: '5-1-left-yue', text: '月', speak: '月' },
          { id: '5-1-left-shan', text: '山', speak: '山' },
          { id: '5-1-left-shui', text: '水', speak: '水' },
        ],
        right: [
          { id: '5-1-right-water', text: '💧' },
          { id: '5-1-right-mountain', text: '⛰️' },
          { id: '5-1-right-moon', text: '🌙' },
          { id: '5-1-right-sun', text: '☀️' },
        ],
        answerMap: {
          '5-1-left-ri': '5-1-right-sun',
          '5-1-left-yue': '5-1-right-moon',
          '5-1-left-shan': '5-1-right-mountain',
          '5-1-left-shui': '5-1-right-water',
        },
      },
      {
        kind: 'match',
        prompt: '把字和它对应的图连起来',
        left: [
          { id: '5-2-left-huo', text: '火', speak: '火' },
          { id: '5-2-left-wood', text: '木', speak: '木' },
          { id: '5-2-left-tian', text: '田', speak: '田' },
          { id: '5-2-left-eye', text: '目', speak: '目' },
        ],
        right: [
          { id: '5-2-right-grain', text: '🌾' },
          { id: '5-2-right-eye', text: '👁' },
          { id: '5-2-right-wood', text: '🌳' },
          { id: '5-2-right-fire', text: '🔥' },
        ],
        answerMap: {
          '5-2-left-huo': '5-2-right-fire',
          '5-2-left-wood': '5-2-right-wood',
          '5-2-left-tian': '5-2-right-grain',
          '5-2-left-eye': '5-2-right-eye',
        },
      },
      {
        kind: 'choice',
        prompt: '☀️ 是哪个字?点一点',
        options: [
          { id: '5-3-yue', text: '月', speak: '月' },
          { id: '5-3-mu', text: '目', speak: '目' },
          { id: '5-3-tian', text: '田', speak: '田' },
          { id: '5-3-ri', text: '日', speak: '日' },
        ],
        answerId: '5-3-ri',
      },
      {
        kind: 'choice',
        prompt: '🌙 是哪个字?点一点',
        options: [
          { id: '5-4-ri', text: '日', speak: '日' },
          { id: '5-4-shan', text: '山', speak: '山' },
          { id: '5-4-yue', text: '月', speak: '月' },
          { id: '5-4-mu', text: '目', speak: '目' },
        ],
        answerId: '5-4-yue',
      },
      {
        kind: 'choice',
        prompt: '🔥 是哪个字?点一点',
        options: [
          { id: '5-5-shui', text: '水', speak: '水' },
          { id: '5-5-wood', text: '木', speak: '木' },
          { id: '5-5-shan', text: '山', speak: '山' },
          { id: '5-5-huo', text: '火', speak: '火' },
        ],
        answerId: '5-5-huo',
      },
      {
        kind: 'choice',
        prompt: '💧 是哪个字?点一点',
        options: [
          { id: '5-6-huo', text: '火', speak: '火' },
          { id: '5-6-tian', text: '田', speak: '田' },
          { id: '5-6-shui', text: '水', speak: '水' },
          { id: '5-6-mu', text: '目', speak: '目' },
        ],
        answerId: '5-6-shui',
      },
    ],
  },

  // ─────────────────────────── L6 笔画山谷 ───────────────────────────
  {
    id: 6,
    kingdom: 'hanzi',
    title: '笔画山谷',
    questions: [
      {
        kind: 'choice',
        prompt: '「一」有几笔?数一数',
        speak: '一',
        options: [
          { id: '6-1-1', text: '1' },
          { id: '6-1-2', text: '2' },
          { id: '6-1-3', text: '3' },
          { id: '6-1-4', text: '4' },
        ],
        answerId: '6-1-1',
      },
      {
        kind: 'choice',
        prompt: '「二」有几笔?数一数',
        speak: '二',
        options: [
          { id: '6-2-2', text: '2' },
          { id: '6-2-1', text: '1' },
          { id: '6-2-4', text: '4' },
          { id: '6-2-5', text: '5' },
        ],
        answerId: '6-2-2',
      },
      {
        kind: 'choice',
        prompt: '「三」有几笔?数一数',
        speak: '三',
        options: [
          { id: '6-3-3', text: '3' },
          { id: '6-3-2', text: '2' },
          { id: '6-3-4', text: '4' },
          { id: '6-3-5', text: '5' },
        ],
        answerId: '6-3-3',
      },
      {
        kind: 'choice',
        prompt: '「十」有几笔?数一数',
        speak: '十',
        options: [
          { id: '6-4-3', text: '3' },
          { id: '6-4-1', text: '1' },
          { id: '6-4-5', text: '5' },
          { id: '6-4-2', text: '2' },
        ],
        answerId: '6-4-2',
      },
      {
        kind: 'choice',
        prompt: '「大」有几笔?数一数',
        speak: '大',
        options: [
          { id: '6-5-3', text: '3' },
          { id: '6-5-1', text: '1' },
          { id: '6-5-2', text: '2' },
          { id: '6-5-4', text: '4' },
        ],
        answerId: '6-5-3',
      },
      {
        kind: 'choice',
        prompt: '「天」有几笔?数一数',
        speak: '天',
        options: [
          { id: '6-6-4', text: '4' },
          { id: '6-6-3', text: '3' },
          { id: '6-6-2', text: '2' },
          { id: '6-6-5', text: '5' },
        ],
        answerId: '6-6-4',
      },
    ],
  },

  // ─────────────────────────── L7 认字花园 ───────────────────────────
  {
    id: 7,
    kingdom: 'hanzi',
    title: '认字花园',
    questions: [
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的字',
        promptSpeak: '人',
        options: [
          { id: '7-1-ren', text: '人', speak: '人' },
          { id: '7-1-ru', text: '入', speak: '入' },
          { id: '7-1-ba', text: '八', speak: '八' },
          { id: '7-1-da', text: '大', speak: '大' },
        ],
        answerId: '7-1-ren',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的字',
        promptSpeak: '入',
        options: [
          { id: '7-2-ru', text: '入', speak: '入' },
          { id: '7-2-ren', text: '人', speak: '人' },
          { id: '7-2-da', text: '大', speak: '大' },
          { id: '7-2-tian', text: '天', speak: '天' },
        ],
        answerId: '7-2-ru',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的字',
        promptSpeak: '大',
        options: [
          { id: '7-3-da', text: '大', speak: '大' },
          { id: '7-3-tian', text: '天', speak: '天' },
          { id: '7-3-shang', text: '上', speak: '上' },
          { id: '7-3-xia', text: '下', speak: '下' },
        ],
        answerId: '7-3-da',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的字',
        promptSpeak: '天',
        options: [
          { id: '7-4-tian', text: '天', speak: '天' },
          { id: '7-4-da', text: '大', speak: '大' },
          { id: '7-4-wo', text: '我', speak: '我' },
          { id: '7-4-hao', text: '好', speak: '好' },
        ],
        answerId: '7-4-tian',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的字',
        promptSpeak: '上',
        options: [
          { id: '7-5-shang', text: '上', speak: '上' },
          { id: '7-5-xia', text: '下', speak: '下' },
          { id: '7-5-shan', text: '山', speak: '山' },
          { id: '7-5-da', text: '大', speak: '大' },
        ],
        answerId: '7-5-shang',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的字',
        promptSpeak: '好',
        options: [
          { id: '7-6-hao', text: '好', speak: '好' },
          { id: '7-6-wo', text: '我', speak: '我' },
          { id: '7-6-shan', text: '山', speak: '山' },
          { id: '7-6-xia', text: '下', speak: '下' },
        ],
        answerId: '7-6-hao',
      },
    ],
  },

  // ─────────────────────────── L8 字母乐园 ───────────────────────────
  {
    id: 8,
    kingdom: 'english',
    title: '字母乐园',
    questions: [
      {
        kind: 'match',
        prompt: '把大写字母和对应的小写连起来',
        left: [
          { id: '8-1-left-A', text: 'A', speak: 'A' },
          { id: '8-1-left-B', text: 'B', speak: 'B' },
          { id: '8-1-left-C', text: 'C', speak: 'C' },
          { id: '8-1-left-D', text: 'D', speak: 'D' },
        ],
        right: [
          { id: '8-1-right-c', text: 'c' },
          { id: '8-1-right-a', text: 'a' },
          { id: '8-1-right-d', text: 'd' },
          { id: '8-1-right-b', text: 'b' },
        ],
        answerMap: {
          '8-1-left-A': '8-1-right-a',
          '8-1-left-B': '8-1-right-b',
          '8-1-left-C': '8-1-right-c',
          '8-1-left-D': '8-1-right-d',
        },
      },
      {
        kind: 'match',
        prompt: '把大写字母和对应的小写连起来',
        left: [
          { id: '8-2-left-E', text: 'E', speak: 'E' },
          { id: '8-2-left-F', text: 'F', speak: 'F' },
        ],
        right: [
          { id: '8-2-right-f', text: 'f' },
          { id: '8-2-right-e', text: 'e' },
        ],
        answerMap: {
          '8-2-left-E': '8-2-right-e',
          '8-2-left-F': '8-2-right-f',
        },
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的字母',
        promptSpeak: 'B',
        options: [
          { id: '8-3-B', text: 'B', speak: 'B' },
          { id: '8-3-A', text: 'A', speak: 'A' },
          { id: '8-3-D', text: 'D', speak: 'D' },
          { id: '8-3-C', text: 'C', speak: 'C' },
        ],
        answerId: '8-3-B',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的字母',
        promptSpeak: 'D',
        options: [
          { id: '8-4-D', text: 'D', speak: 'D' },
          { id: '8-4-C', text: 'C', speak: 'C' },
          { id: '8-4-E', text: 'E', speak: 'E' },
          { id: '8-4-F', text: 'F', speak: 'F' },
        ],
        answerId: '8-4-D',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的字母',
        promptSpeak: 'E',
        options: [
          { id: '8-5-E', text: 'E', speak: 'E' },
          { id: '8-5-F', text: 'F', speak: 'F' },
          { id: '8-5-A', text: 'A', speak: 'A' },
          { id: '8-5-C', text: 'C', speak: 'C' },
        ],
        answerId: '8-5-E',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的字母',
        promptSpeak: 'F',
        options: [
          { id: '8-6-F', text: 'F', speak: 'F' },
          { id: '8-6-E', text: 'E', speak: 'E' },
          { id: '8-6-B', text: 'B', speak: 'B' },
          { id: '8-6-D', text: 'D', speak: 'D' },
        ],
        answerId: '8-6-F',
      },
    ],
  },

  // ─────────────────────────── L9 单词农场 ───────────────────────────
  {
    id: 9,
    kingdom: 'english',
    title: '单词农场',
    questions: [
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的单词',
        promptSpeak: 'cat',
        options: [
          { id: '9-1-cat', text: 'cat', emoji: '🐱', speak: 'cat' },
          { id: '9-1-dog', text: 'dog', emoji: '🐶', speak: 'dog' },
          { id: '9-1-sun', text: 'sun', emoji: '☀️', speak: 'sun' },
          { id: '9-1-fish', text: 'fish', emoji: '🐟', speak: 'fish' },
        ],
        answerId: '9-1-cat',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的单词',
        promptSpeak: 'dog',
        options: [
          { id: '9-2-dog', text: 'dog', emoji: '🐶', speak: 'dog' },
          { id: '9-2-cat', text: 'cat', emoji: '🐱', speak: 'cat' },
          { id: '9-2-apple', text: 'apple', emoji: '🍎', speak: 'apple' },
          { id: '9-2-fish', text: 'fish', emoji: '🐟', speak: 'fish' },
        ],
        answerId: '9-2-dog',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的单词',
        promptSpeak: 'sun',
        options: [
          { id: '9-3-sun', text: 'sun', emoji: '☀️', speak: 'sun' },
          { id: '9-3-egg', text: 'egg', emoji: '🥚', speak: 'egg' },
          { id: '9-3-dog', text: 'dog', emoji: '🐶', speak: 'dog' },
          { id: '9-3-fish', text: 'fish', emoji: '🐟', speak: 'fish' },
        ],
        answerId: '9-3-sun',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的单词',
        promptSpeak: 'apple',
        options: [
          { id: '9-4-apple', text: 'apple', emoji: '🍎', speak: 'apple' },
          { id: '9-4-cat', text: 'cat', emoji: '🐱', speak: 'cat' },
          { id: '9-4-egg', text: 'egg', emoji: '🥚', speak: 'egg' },
          { id: '9-4-sun', text: 'sun', emoji: '☀️', speak: 'sun' },
        ],
        answerId: '9-4-apple',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的单词',
        promptSpeak: 'egg',
        options: [
          { id: '9-5-egg', text: 'egg', emoji: '🥚', speak: 'egg' },
          { id: '9-5-fish', text: 'fish', emoji: '🐟', speak: 'fish' },
          { id: '9-5-apple', text: 'apple', emoji: '🍎', speak: 'apple' },
          { id: '9-5-dog', text: 'dog', emoji: '🐶', speak: 'dog' },
        ],
        answerId: '9-5-egg',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的单词',
        promptSpeak: 'fish',
        options: [
          { id: '9-6-fish', text: 'fish', emoji: '🐟', speak: 'fish' },
          { id: '9-6-sun', text: 'sun', emoji: '☀️', speak: 'sun' },
          { id: '9-6-cat', text: 'cat', emoji: '🐱', speak: 'cat' },
          { id: '9-6-apple', text: 'apple', emoji: '🍎', speak: 'apple' },
        ],
        answerId: '9-6-fish',
      },
    ],
  },

  // ─────────────────────── L10 新手魔法师考核 ────────────────────────
  {
    id: 10,
    kingdom: 'mixed',
    title: '新手魔法师考核',
    questions: [
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的韵母',
        promptSpeak: '啊',
        options: [
          { id: '10-1-a', text: 'a', speak: '啊' },
          { id: '10-1-o', text: 'o', speak: '喔' },
          { id: '10-1-e', text: 'e', speak: '鹅' },
          { id: '10-1-i', text: 'i', speak: '衣' },
        ],
        answerId: '10-1-a',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的声母',
        promptSpeak: '坡',
        options: [
          { id: '10-2-p', text: 'p', speak: '坡' },
          { id: '10-2-b', text: 'b', speak: '玻' },
          { id: '10-2-m', text: 'm', speak: '摸' },
          { id: '10-2-f', text: 'f', speak: '佛' },
        ],
        answerId: '10-2-p',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出正确的带调拼音',
        promptSpeak: '马',
        options: [
          { id: '10-3-ma1', text: 'mā', speak: '妈' },
          { id: '10-3-ma2', text: 'má', speak: '麻' },
          { id: '10-3-ma3', text: 'mǎ', speak: '马' },
          { id: '10-3-ma4', text: 'mà', speak: '骂' },
        ],
        answerId: '10-3-ma3',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的拼音',
        promptSpeak: '兔',
        options: [
          { id: '10-4-tu', text: 'tù', speak: '兔' },
          { id: '10-4-du', text: 'dù' },
          { id: '10-4-nu', text: 'nù' },
          { id: '10-4-lu', text: 'lù' },
        ],
        answerId: '10-4-tu',
      },
      {
        kind: 'match',
        prompt: '把字和它对应的图连起来',
        left: [
          { id: '10-5-left-ri', text: '日', speak: '日' },
          { id: '10-5-left-yue', text: '月', speak: '月' },
          { id: '10-5-left-huo', text: '火', speak: '火' },
          { id: '10-5-left-wood', text: '木', speak: '木' },
        ],
        right: [
          { id: '10-5-right-fire', text: '🔥' },
          { id: '10-5-right-sun', text: '☀️' },
          { id: '10-5-right-wood', text: '🌳' },
          { id: '10-5-right-moon', text: '🌙' },
        ],
        answerMap: {
          '10-5-left-ri': '10-5-right-sun',
          '10-5-left-yue': '10-5-right-moon',
          '10-5-left-huo': '10-5-right-fire',
          '10-5-left-wood': '10-5-right-wood',
        },
      },
      {
        kind: 'choice',
        prompt: '「口」有几笔?数一数',
        speak: '口',
        options: [
          { id: '10-6-2', text: '2' },
          { id: '10-6-3', text: '3' },
          { id: '10-6-4', text: '4' },
          { id: '10-6-5', text: '5' },
        ],
        answerId: '10-6-3',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的字母',
        promptSpeak: 'C',
        options: [
          { id: '10-7-A', text: 'A', speak: 'A' },
          { id: '10-7-B', text: 'B', speak: 'B' },
          { id: '10-7-C', text: 'C', speak: 'C' },
          { id: '10-7-D', text: 'D', speak: 'D' },
        ],
        answerId: '10-7-C',
      },
      {
        kind: 'listen-choice',
        prompt: '听一听,选出你听到的单词',
        promptSpeak: 'apple',
        options: [
          { id: '10-8-apple', text: 'apple', emoji: '🍎', speak: 'apple' },
          { id: '10-8-egg', text: 'egg', emoji: '🥚', speak: 'egg' },
          { id: '10-8-cat', text: 'cat', emoji: '🐱', speak: 'cat' },
          { id: '10-8-dog', text: 'dog', emoji: '🐶', speak: 'dog' },
        ],
        answerId: '10-8-apple',
      },
    ],
  },
]
