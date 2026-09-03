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
  const sameCat = shuffle(WORDS.filter((w) => w.category === word.category && w.id !== word.id && !clash(w)), rng)
  const others = shuffle(WORDS.filter((w) => w.category !== word.category && w.id !== word.id && !clash(w)), rng)
  // 同 category 块在前:够则全同分类;不够则按 slice 跨到 others 兜底。
  const pool = [...sameCat, ...others]
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

// 选项 id seed 基串:`{word.id}-{n}-{kind标记}-{skill}`;n 为步内序号(0/1),
// 保证一步内两题即便同 kind 其 option id 串也互不相同。kind 标记沿用题面风格:
// choice→c / listen-choice→l / match→m。
function seedBase(wordId: number, step: number, marker: 'c' | 'l' | 'm', skill: SkillKey): string {
  return `${wordId}-${step}-${marker}-${skill}`
}

// 组合一条目标词 + size-1 干扰词的文字选项;answerId 用词引用对齐,避免同音歧义。
function buildTextQuestion(
  kind: 'choice' | 'listen-choice',
  word: WordUnit,
  skill: SkillKey,
  step: number,
  rng: Rng,
): ChoiceQuestion | ListenChoiceQuestion {
  const size = optionCountFor(word.id)
  const distractors = distractorsFor(word, size - 1, rng)
  const picks = shuffle([word, ...distractors], rng) // 恒 size 项,word 必在
  const seed = seedBase(word.id, step, kind === 'choice' ? 'c' : 'l', skill)
  const options = picks.map((w, i) => textOption(w, skill, `${seed}-${i}`))
  const answerId = options[picks.indexOf(word)].id
  const prompt =
    kind === 'choice' ? SKILL_PROMPT[skill] : '听一听,选出你听到的'
  return kind === 'choice'
    ? { kind: 'choice', prompt, options, answerId }
    : { kind: 'listen-choice', prompt, promptSpeak: speakOf(word, skill), options, answerId }
}

export function makeChoice(word: WordUnit, skill: SkillKey, rng: Rng, step = 0): ChoiceQuestion {
  return buildTextQuestion('choice', word, skill, step, rng) as ChoiceQuestion
}

export function makeListen(word: WordUnit, skill: SkillKey, rng: Rng, step = 0): ListenChoiceQuestion {
  return buildTextQuestion('listen-choice', word, skill, step, rng) as ListenChoiceQuestion
}

export function makeMatch(word: WordUnit, skill: SkillKey, rng: Rng, step = 0): MatchQuestion {
  const size = optionCountFor(word.id)
  const picks = shuffle([word, ...distractorsFor(word, size - 1, rng)], rng) // 恒 size 项,word 必在
  // 两阶段配对:先按词对象给每张图打上"属于哪个词",再做两次独立 shuffle。
  // 左卡 = 每个词的文字;右卡 = 每个词的图;answerMap 经 word 引用关联 ——
  // 左右各自乱序,配对始终指向同一词,不依赖下标与 emoji 文本唯一。
  type Tagged = { opt: BaseOption; word: WordUnit }
  const base = seedBase(word.id, step, 'm', skill)
  const leftRaw = picks.map<{ opt: BaseOption; word: WordUnit }>((w, i) => ({
    opt: textOption(w, skill, `${base}-l${i}`),
    word: w,
  }))
  const rightRaw = picks.map<Tagged>((w, i) => ({
    opt: emojiOption(w, `${base}-r${i}`),
    word: w,
  }))
  const left = shuffle(leftRaw, rng)
  const right = shuffle(rightRaw, rng)
  const rightIdByWord = new Map<WordUnit, string>()
  right.forEach((tag) => rightIdByWord.set(tag.word, tag.opt.id))
  const answerMap: Record<string, string> = {}
  left.forEach((tag) => {
    answerMap[tag.opt.id] = rightIdByWord.get(tag.word)!
  })
  return {
    kind: 'match',
    prompt: `把「${textOf(word, skill)}」和对应的图片连起来吧`,
    left: left.map((t) => t.opt),
    right: right.map((t) => t.opt),
    answerMap,
  }
}

/** 一步 2 题:首题恒 choice;次题按技能概率选变体。step 序号穿入 option id(n=0/1)。 */
export function makeStepQuestions(word: WordUnit, skill: SkillKey, rng: Rng = defaultRng()): Question[] {
  const first: Question = makeChoice(word, skill, rng, 0)
  const roll = rng()
  let second: Question
  if (skill === 'pinyin') {
    second = roll < 0.5 ? makeListen(word, skill, rng, 1) : makeChoice(word, skill, rng, 1)
  } else if (skill === 'hanzi') {
    second = roll < 0.5 ? makeMatch(word, skill, rng, 1) : makeChoice(word, skill, rng, 1)
  } else {
    second = roll < 0.33 ? makeListen(word, skill, rng, 1) : roll < 0.66 ? makeMatch(word, skill, rng, 1) : makeChoice(word, skill, rng, 1)
  }
  return [first, second]
}
