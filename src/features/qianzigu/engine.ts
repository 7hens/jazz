import type { Chapter, Scene, WordLayer } from './chapter'

export type RunnerEffect =
  | { type: 'restore'; wordId: number; layer: WordLayer }      // UI 落 completed.pinyin/hanzi
  | { type: 'mark-boss-failed' }
  | { type: 'settle' }                                          // 结算节点:UI 汇总星尘/连击/成就

export type RunnerState = Readonly<{
  sceneIndex: number
  taskHits: Record<string, number>      // `${wordId}:${layer}` -> 已答对次数(每层独立,推进 task scene)
  restored: ReadonlyArray<{ wordId: number; layer: WordLayer }>
  bossWrong: number
  bossAnswered: number                  // 已答对题数(全对制)
  bossNeeded: number                    // 需全对题数(= 首个 boss scene 的 questionCount)
  bossWon: boolean
  socialDone: boolean
  finished: boolean
}>

export type RunnerAction =
  | { type: 'advance' }                // dialogue/break 确认继续
  | { type: 'task-correct'; wordId: number; layer: WordLayer }
  | { type: 'task-wrong'; wordId: number; layer: WordLayer }
  | { type: 'social-choose'; optionId: string }
  | { type: 'boss-correct' }
  | { type: 'boss-wrong' }

export type Runner = {
  state: RunnerState
  start(): RunnerState
  next(action: RunnerAction): { state: RunnerState; effects: RunnerEffect[] }
}

export function createChapterRunner(chapter: Chapter): Runner {
  let state: RunnerState = initial(chapter)

  const step = (s: RunnerState, action: RunnerAction): { state: RunnerState; effects: RunnerEffect[] } => {
    if (s.finished) return { state: s, effects: [] }
    const scene = chapter.scenes[s.sceneIndex]
    const effects: RunnerEffect[] = []
    const patch = (p: Partial<RunnerState>): RunnerState => ({ ...s, ...p })

    switch (scene.kind) {
      // R1:ending 与 dialogue 同规则推进,finished 仅当越过最后一幕(settle 才是终点)
      case 'dialogue':
      case 'break':
      case 'ending': {
        if (action.type !== 'advance') return { state: s, effects }
        const nextIdx = s.sceneIndex + 1
        const finished = nextIdx >= chapter.scenes.length
        return { state: patch({ sceneIndex: Math.min(nextIdx, chapter.scenes.length - 1), finished }), effects }
      }
      case 'task': {
        if (action.type === 'task-correct' && action.wordId === scene.task.wordId && action.layer === scene.task.layer) {
          const key = taskKey(action.wordId, action.layer)
          const hits = { ...s.taskHits, [key]: (s.taskHits[key] ?? 0) + 1 }
          if (hits[key] >= scene.task.minCorrect) {
            const restored = [...s.restored, { wordId: action.wordId, layer: action.layer }]
            effects.push({ type: 'restore', wordId: action.wordId, layer: action.layer })
            return { state: patch({ sceneIndex: s.sceneIndex + 1, taskHits: hits, restored }), effects }
          }
          return { state: patch({ taskHits: hits }), effects }
        }
        if (action.type === 'task-wrong') return { state: s, effects }
        return { state: s, effects }
      }
      case 'social': {
        // 社交拍可被 advance 放行(测试/UI 快速跳过);真正安慰走 social-choose。
        // 注:plan Task-3 测试 #3 从 start 推进到 boss 时会对非 task 场景发 advance,
        // 而 ch1 的 social 位于 boss 之前 → 引擎若忽略 advance 会死循环,故放行。
        if (action.type === 'advance') {
          const nextIdx = s.sceneIndex + 1
          const finished = nextIdx >= chapter.scenes.length
          return { state: patch({ sceneIndex: Math.min(nextIdx, chapter.scenes.length - 1), finished }), effects }
        }
        if (action.type !== 'social-choose') return { state: s, effects }
        const chosen = scene.options.find((o) => o.id === action.optionId)
        if (!chosen) return { state: s, effects }
        if (chosen.id !== scene.goodOptionId) return { state: s, effects }   // 停留重弹
        return { state: patch({ sceneIndex: s.sceneIndex + 1, socialDone: true }), effects }
      }
      case 'boss': {
        if (action.type === 'boss-wrong') {
          const wrong = s.bossWrong + 1
          if (wrong >= scene.maxWrong) {
            effects.push({ type: 'mark-boss-failed' })
            return { state: patch({ bossWrong: wrong, bossWon: false, finished: true }), effects }
          }
          return { state: patch({ bossWrong: wrong }), effects }
        }
        if (action.type === 'boss-correct') {
          const answered = s.bossAnswered + 1
          if (answered >= s.bossNeeded) {
            return { state: patch({ bossAnswered: answered, bossWon: true, sceneIndex: s.sceneIndex + 1 }), effects }
          }
          return { state: patch({ bossAnswered: answered }), effects }
        }
        return { state: s, effects }
      }
      case 'settle': {
        effects.push({ type: 'settle' })
        return { state: patch({ finished: true }), effects }
      }
      default:
        return { state: s, effects }
    }
  }

  return {
    state,
    start() {
      state = initial(chapter)
      return state
    },
    next(action) {
      const out = step(state, action)
      state = out.state
      return out
    },
  }
}

// 每词每层独立计数:同词 sound 与 shape 不串数(shape 场景需各自再答对 minCorrect 次)。
function taskKey(wordId: number, layer: WordLayer): string {
  return `${wordId}:${layer}`
}

function initial(chapter: Chapter): RunnerState {
  // R3:bossNeeded 取首个 boss scene 的 questionCount,缺省 5
  const boss = chapter.scenes.find((sc): sc is Extract<Scene, { kind: 'boss' }> => sc.kind === 'boss')
  return {
    sceneIndex: 0,
    taskHits: {},
    restored: [],
    bossWrong: 0,
    bossAnswered: 0,
    bossNeeded: boss?.questionCount ?? 5,
    bossWon: false,
    socialDone: false,
    finished: false,
  }
}
