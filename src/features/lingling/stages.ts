// 灵灵陪伴:档位判定 + 各档展示元数据。纯函数,时间无依赖,可单测。

export type LingLingStage = 0 | 1 | 2 | 3 | 4

export type LingLingStageMeta = Readonly<{
  emoji: string
  label: string
  className: string
}>

// 档位索引即阶段号,升序 0..4。
export const LINGLING_STAGES: readonly LingLingStageMeta[] = [
  { emoji: '😴', label: '灵灵在睡觉…快醒醒!', className: 'animate-[ll-sleep_2.4s_ease-in-out_infinite]' },
  { emoji: '🦊', label: '好耶!继续加油!', className: 'animate-[ll-bounce_1.4s_ease-in-out_infinite]' },
  { emoji: '🦊✨', label: '你太厉害了!', className: 'animate-[ll-wiggle_1.6s_ease-in-out_infinite]' },
  { emoji: '🌟', label: '魔法快恢复了!', className: 'animate-[ll-glow_1.8s_ease-in-out_infinite]' },
  { emoji: '🦊👑', label: '你是我的英雄!', className: 'animate-[ll-fly_2s_ease-in-out_infinite]' },
]

export function lingLingStage(completedWords: number, totalWords = 100): LingLingStage {
  const pct = completedWords / totalWords
  if (pct < 0.1) return 0
  if (pct < 0.3) return 1
  if (pct < 0.5) return 2
  if (pct < 0.8) return 3
  return 4
}
