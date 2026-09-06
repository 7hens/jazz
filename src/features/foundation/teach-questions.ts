// 单元教学轻测/诊断题微引擎(纯函数)。非词向:考单个基础单元识别。
// 题形 shape 对齐 shared/ui/quiz 组件 props;渲染由 TeachOverlay / ColdStartWizard 承担。
// 三类拼音单元(声母/韵母/声调)考识别锚点;英文字母 listen-choice 听字母名选大写。
import type { BaseOption, Rng } from '@/shared/services'
import { ENGLISH_LETTERS, PINYIN_FINALS, PINYIN_INITIALS, PINYIN_TONES } from './catalogs'

export type TeachQuestion =
  | { kind: 'choice'; prompt: string; promptSpeak?: string; promptEmoji: string; options: BaseOption[]; answerId: string }
  | { kind: 'listen-choice'; prompt: string; promptSpeak: string; options: BaseOption[]; answerId: string }

function defaultRng(): Rng { return Math.random }
function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// —— 干扰分组(同类优先,不足跨类)——
const INIT_GROUP: Record<string, string> = {
  b: '唇', p: '唇', m: '唇', f: '唇', d: '舌尖', t: '舌尖', n: '舌尖', l: '舌尖',
  g: '舌根', k: '舌根', h: '舌根', j: '舌面', q: '舌面', x: '舌面',
  zh: '翘舌', ch: '翘舌', sh: '翘舌', r: '翘舌', z: '平舌', c: '平舌', s: '平舌', y: '零', w: '零',
}
const isNasal = (sym: string): boolean => /[nm]$/.test(sym)
const LETTER_CONFUSABLES: readonly string[][] = [
  ['b', 'd', 'p', 'q'], ['m', 'n'], ['u', 'v', 'w'], ['c', 'e', 'o'], ['i', 'l', 'j'],
  ['a', 'd', 'g'], ['f', 't'], ['s', 'z'], ['h', 'k'], ['g', 'y'],
]

// —— 目录素材(单元 → 选项文本/点读/锚点 emoji)——
type OptRef = { text: string; speak: string; emoji: string }
function letterRefOf(ch: string): OptRef {
  const u = ENGLISH_LETTERS.find((e) => e.symbol === ch)
  return { text: ch.toUpperCase(), speak: ch, emoji: u?.anchorEmoji ?? '' }
}
function pinyinRefOf(sym: string, isTone: boolean): OptRef {
  if (isTone) {
    const u = PINYIN_TONES.find((t) => t.symbol === sym)
    return { text: u?.label ?? sym, speak: u?.anchorHanzi ?? '', emoji: u?.anchorEmoji ?? '' }
  }
  const ini = PINYIN_INITIALS.find((i) => i.symbol === sym)
  const fin = PINYIN_FINALS.find((f) => f.symbol === sym)
  const src = ini ?? fin
  return { text: sym, speak: src?.anchorHanzi ?? '', emoji: src?.anchorEmoji ?? '' }
}

/** 取 size 个不含 target 的候选单元符号(同类优先;返回无序,由调用方 shuffle)。 */
function candidatesFor(unitKey: string, size: number): string[] {
  const isEnglish = unitKey.startsWith('english:')
  const isTone = unitKey.startsWith('pinyin:ton')
  const target = isEnglish ? unitKey.slice(8) : unitKey.slice('pinyin:'.length)
  let group: string[]
  if (isEnglish) {
    const g = LETTER_CONFUSABLES.find((list) => list.includes(target))
    group = [...(g?.filter((c) => c !== target) ?? [])]
    const rest = ENGLISH_LETTERS.map((e) => e.symbol).filter((c) => c !== target && !group.includes(c))
    group = [...group, ...rest]
  } else if (isTone) {
    group = PINYIN_TONES.map((t) => t.symbol).filter((s) => s !== target)
  } else if (INIT_GROUP[target] !== undefined) {
    const same = PINYIN_INITIALS.map((i) => i.symbol).filter((s) => s !== target && INIT_GROUP[s] === INIT_GROUP[target])
    const rest = PINYIN_INITIALS.map((i) => i.symbol).filter((s) => s !== target && !same.includes(s))
    group = [...same, ...rest]
  } else {
    const same = PINYIN_FINALS.map((f) => f.symbol).filter((s) => s !== target && isNasal(s) === isNasal(target))
    const rest = PINYIN_FINALS.map((f) => f.symbol).filter((s) => s !== target && !same.includes(s))
    group = [...same, ...rest]
  }
  return group.slice(0, size)
}

function refOf(unitKey: string, sym: string): OptRef {
  return unitKey.startsWith('english:') ? letterRefOf(sym) : pinyinRefOf(sym, unitKey.startsWith('pinyin:ton'))
}

function optionId(unitKey: string, marker: 'c' | 'l', i: number): string {
  return `teach-${unitKey.replace(':', '-')}-${marker}-${i}`
}

export function questionForUnit(unitKey: string, rng: Rng = defaultRng()): TeachQuestion | null {
  const isEnglish = unitKey.startsWith('english:')
  const isTone = unitKey.startsWith('pinyin:ton')
  const targetSym = isEnglish ? unitKey.slice(8) : unitKey.slice('pinyin:'.length)
  const toneUnit = isTone ? PINYIN_TONES.find((t) => t.symbol === targetSym) : undefined
  // 多音节声调锚点(如轻声「mào zi」)不指向唯一声调,不出题,避免歧义。
  const toneUsable = toneUnit !== undefined && !toneUnit.anchorPinyin.includes(' ')
  const isInitial = !isTone && !isEnglish && PINYIN_INITIALS.some((i) => i.symbol === targetSym)
  const valid = isEnglish
    ? /^[a-z]$/.test(targetSym) && ENGLISH_LETTERS.some((e) => e.symbol === targetSym)
    : isTone
      ? toneUsable
      : isInitial || PINYIN_FINALS.some((f) => f.symbol === targetSym)
  if (!valid) return null

  const pick = shuffle([targetSym, ...candidatesFor(unitKey, 2)], rng)
  const marker: 'c' | 'l' = isEnglish ? 'l' : 'c'
  const options: BaseOption[] = pick.map((sym, i) => {
    const r = refOf(unitKey, sym)
    return { id: optionId(unitKey, marker, i), text: r.text, speak: r.speak || undefined, emoji: r.emoji || undefined }
  })
  const answerId = options[pick.indexOf(targetSym)].id

  if (isEnglish) {
    return { kind: 'listen-choice', prompt: '听一听,选出你听到的字母', promptSpeak: targetSym, options, answerId }
  }
  const anchor = pinyinRefOf(targetSym, isTone)
  const label = anchor.speak // 锚点汉字(读「包」等)
  const hanziDisplay = label || targetSym
  const prompt = isTone
    ? `「${toneUnit?.anchorPinyin ?? targetSym}」是第几声?`
    : isInitial
      ? `「${hanziDisplay}」开头的声母是哪个?`
      : `「${hanziDisplay}」里的韵母是哪个?`
  return { kind: 'choice', prompt, promptSpeak: label || undefined, promptEmoji: anchor.emoji, options, answerId }
}
