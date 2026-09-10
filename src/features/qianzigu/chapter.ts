import type { SpeechRole } from '@/shared/services'

export type SceneKind = 'dialogue' | 'task' | 'social' | 'break' | 'boss' | 'ending' | 'settle'
export type WordLayer = 'sound' | 'shape'          // sound=拼音恢复,shape=汉字恢复

export type AtmosphereKey = 'dawn' | 'day' | 'dusk' | 'night' | 'dark'
export type SpeechMood = 'calm' | 'sad' | 'happy' | 'scary'
/** 舞台元数据(全可选;引擎零读)。cast 顺序即站位偏好,自动分槽;narrator 永不出现在 cast。 */
export type StageMeta = Readonly<{
  cast?: readonly SpeechRole[]
  atmosphere?: AtmosphereKey
  /** 当幕作「天空体」的角色(缺省 = 全员地面):不入 StageCast 地面行,其台词就地由布景对应天体出泡。 */
  sky?: readonly SpeechRole[]
}>

export type ChapterLine = Readonly<{ role: SpeechRole; text: string; mood?: SpeechMood }>

export type SceneOption = Readonly<{
  id: string
  text: string                       // 选项文案(朗读文本即 text)
  emoji?: string
  consequence: 'good' | 'bad' | 'neutral'
  response: string                   // 选择后角色回应台词
  responder?: SpeechRole             // 谁说 response(缺省 narrator)
}>

export type TaskSpec = Readonly<{
  wordId: number
  layer: WordLayer                   // 该任务恢复哪一层
  minCorrect: number                 // 需答对次数才算恢复(默认 1,可留)
}>

export type TaskScene = Readonly<{
  id: string
  kind: 'task'
  title: string                      // 任务名(如 徐爷爷忘掉的名字)
  intro: ChapterLine[]
  task: TaskSpec
  onDone: ChapterLine[]              // 恢复成功后的台词
  stage?: StageMeta
}>

export type DialogueScene = Readonly<{
  id: string
  kind: 'dialogue'
  lines: ChapterLine[]
  choices?: never
  stage?: StageMeta
}>

export type SocialScene = Readonly<{
  id: string
  kind: 'social'
  lines: ChapterLine[]               // 情境引入(如 皮小闹冒失撞人)
  options: SceneOption[]
  goodOptionId: string               // 正向后果选项(命中则 good 后果推进)
  loop: ChapterLine[]                // 非 good 选择后 苏灵灵 引导词(重新弹选项)
  onGood: ChapterLine[]              // 选中 good 的收尾台词
  stage?: StageMeta
}>

export type BreakScene = Readonly<{ id: string; kind: 'break'; stage?: StageMeta }>

export type BossScene = Readonly<{
  id: string
  kind: 'boss'
  intro: ChapterLine[]
  maxWrong: number                   // 失败阈值(默认 3)
  questionCount: number              // 题目数(全对制,默认 5)
  win: ChapterLine[]
  lose: ChapterLine[]
  stage?: StageMeta
}>

export type EndingScene = Readonly<{ id: string; kind: 'ending'; lines: ChapterLine[]; stage?: StageMeta }>
export type SettleScene = Readonly<{ id: string; kind: 'settle'; summary: ChapterLine[]; stage?: StageMeta }>

export type Scene =
  | TaskScene | DialogueScene | SocialScene | BreakScene | BossScene | EndingScene | SettleScene

export type Chapter = Readonly<{
  id: number
  title: string
  subtitle: string
  emoji: string
  wordIds: readonly number[]          // 有序 5 词
  restoreOrder: readonly number[]     // 恢复点亮顺序的 wordId(可含重复元素,每词两层)
  scenes: readonly Scene[]
}>
