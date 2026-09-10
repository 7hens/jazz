import type { QuestionContext, QuestionEngineService, Rng, SentenceTextSet } from '@/shared/services/question-engine'
import type { VocabularyService } from '@/shared/services/vocabulary'
import type {
  BaseOption,
  ChoiceQuestion,
  ListenChoiceQuestion,
  MatchQuestion,
  Question,
  SkillKey,
  WordUnit,
} from '@/shared/services'

export type { Rng } from '@/shared/services/question-engine'

/** 选项恒 4(0.2.0 起统一:选一选/听一听/短教/连连看全部 4 项);wordId 仅留参数签名兼容旧调用。 */
export function optionCountFor(_wordId: number): number {
  return 4
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

/** 干扰项池序:场景词 → 已学复习词 → 同 category → 跨类补齐;各段独立 shuffle,按序拼接取前 count。 */
function distractorsFor(
  vocabulary: VocabularyService,
  word: WordUnit,
  count: number,
  rng: Rng = defaultRng(),
  context?: QuestionContext,
): WordUnit[] {
  const words = vocabulary.getAllWords()
  const clash = (w: WordUnit) =>
    w.hanzi === word.hanzi || w.english.toLowerCase() === word.english.toLowerCase() || w.pinyin === word.pinyin
  const usable = (w: WordUnit) => w.id !== word.id && !clash(w)
  const byIds = (ids: readonly number[] | undefined) => {
    if (!ids || ids.length === 0) return []
    const set = new Set(ids)
    return words.filter((w) => set.has(w.id) && usable(w))
  }
  const scene = shuffle(byIds(context?.sceneWordIds), rng)
  const learned = shuffle(byIds(context?.learnedWordIds), rng)
  const seen = new Set([...scene, ...learned].map((w) => w.id))
  const rest = words.filter((w) => usable(w) && !seen.has(w.id))
  const sameCat = shuffle(rest.filter((w) => w.category === word.category), rng)
  const others = shuffle(rest.filter((w) => w.category !== word.category), rng)
  const pool = [...scene, ...learned, ...sameCat, ...others]
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
  vocabulary: VocabularyService,
  kind: 'choice' | 'listen-choice',
  word: WordUnit,
  skill: SkillKey,
  step: number,
  rng: Rng,
  context?: QuestionContext,
): ChoiceQuestion | ListenChoiceQuestion {
  const size = optionCountFor(word.id)
  const distractors = distractorsFor(vocabulary, word, size - 1, rng, context)
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

function makeChoice(
  vocabulary: VocabularyService,
  word: WordUnit,
  skill: SkillKey,
  rng: Rng,
  step = 0,
  context?: QuestionContext,
): ChoiceQuestion {
  return buildTextQuestion(vocabulary, 'choice', word, skill, step, rng, context) as ChoiceQuestion
}

function makeListen(
  vocabulary: VocabularyService,
  word: WordUnit,
  skill: SkillKey,
  rng: Rng,
  step = 0,
  context?: QuestionContext,
): ListenChoiceQuestion {
  return buildTextQuestion(vocabulary, 'listen-choice', word, skill, step, rng, context) as ListenChoiceQuestion
}

function makeMatch(
  vocabulary: VocabularyService,
  word: WordUnit,
  skill: SkillKey,
  rng: Rng,
  step = 0,
  context?: QuestionContext,
): MatchQuestion {
  const size = optionCountFor(word.id)
  const picks = shuffle([word, ...distractorsFor(vocabulary, word, size - 1, rng, context)], rng) // 恒 size 项,word 必在
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
function makeStepQuestions(
  vocabulary: VocabularyService,
  word: WordUnit,
  skill: SkillKey,
  rng: Rng = defaultRng(),
  context?: QuestionContext,
): Question[] {
  const first: Question = makeChoice(vocabulary, word, skill, rng, 0, context)
  const roll = rng()
  let second: Question
  if (skill === 'pinyin') {
    second = roll < 0.5
      ? makeListen(vocabulary, word, skill, rng, 1, context)
      : makeChoice(vocabulary, word, skill, rng, 1, context)
  } else if (skill === 'hanzi') {
    second = roll < 0.5
      ? makeMatch(vocabulary, word, skill, rng, 1, context)
      : makeChoice(vocabulary, word, skill, rng, 1, context)
  } else {
    second = roll < 0.33
      ? makeListen(vocabulary, word, skill, rng, 1, context)
      : roll < 0.66
        ? makeMatch(vocabulary, word, skill, rng, 1, context)
        : makeChoice(vocabulary, word, skill, rng, 1, context)
  }
  return [first, second]
}

/** 句型题文案(题干用图 + 一句话;选项是完整句子)。 */
const SENTENCE_PROMPT = '哪句话说对了?'

/**
 * 句型步:把每档的 1 正确句 + 3 错句 shuffle 成 4 选项的 choice 题。
 * 恒 3 题,顺序即档 1 → 档 3(由易到难);选项 speak = 句子本身,TTS 可整句朗读。
 */
function makeSentenceQuestions(
  word: WordUnit,
  set: SentenceTextSet,
  rng: Rng = defaultRng(),
): ChoiceQuestion[] {
  return set.tiers.map((tier, i) => {
    const tierNo = i + 1
    const seed = `${word.id}-${tierNo}-s-sentence`
    const texts = shuffle([tier.correct, ...tier.wrong], rng)
    const options = texts.map((text, n) => ({ id: `${seed}-${n}`, text, speak: text }))
    const answerId = options.find((o) => o.text === tier.correct)!.id
    return { kind: 'choice', prompt: SENTENCE_PROMPT, options, answerId }
  })
}

export function createQuestionEngineService(vocabulary: VocabularyService): QuestionEngineService {
  return {
    optionCountFor,
    textOf,
    speakOf,
    distractorsFor: (word, count, rng, context) => distractorsFor(vocabulary, word, count, rng, context),
    makeChoice: (word, skill, rng, step, context) => makeChoice(vocabulary, word, skill, rng, step, context),
    makeListen: (word, skill, rng, step, context) => makeListen(vocabulary, word, skill, rng, step, context),
    makeMatch: (word, skill, rng, step, context) => makeMatch(vocabulary, word, skill, rng, step, context),
    makeStepQuestions: (word, skill, rng, context) => makeStepQuestions(vocabulary, word, skill, rng, context),
    makeSentenceQuestions: (word, set, rng) => makeSentenceQuestions(word, set, rng),
  }
}
