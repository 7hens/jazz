import { cn } from '@/shared/ui/utils'

/** 出题者署名默认值:无角色语境(词课/短教/冷启动)时统一由此位代言。 */
export const DEFAULT_ASKER = '📜 魔法书'

export type QuestionBubbleProps = {
  prompt: string
  /** 出题者署名;传空串则不渲染署名行 */
  asker?: string
  /** 题干大图 emoji(装饰,aria-hidden) */
  emoji?: string
  /** 有 promptSpeak 时传:整块变成「再听一遍」重听区 */
  onReplay?: () => void
}

/**
 * 题面气泡:替代「居中大标题」,给题目一个「谁在问」的说话者感。
 * 造型对齐 DialoguePresenter 的 Bubble(左上小圆角 + 三角尾),但代码不耦合 —— shared 禁引 features。
 */
export function QuestionBubble({ prompt, asker = DEFAULT_ASKER, emoji, onReplay }: QuestionBubbleProps) {
  const content = (
    <>
      {asker ? <span className="text-xs font-bold tracking-widest text-ink-3">{asker}</span> : null}
      {emoji ? (
        <span aria-hidden className="text-6xl leading-none drop-shadow-sm">
          {emoji}
        </span>
      ) : null}
      <span className="text-lg font-bold leading-snug text-ink">{prompt}</span>
    </>
  )

  const boxCls = cn(
    'relative mx-auto flex w-full flex-col items-center gap-1.5 rounded-2xl rounded-tl-sm border-2 border-hairline bg-surface px-4 py-3 text-center shadow-card',
    onReplay && 'transition-colors hover:bg-accent-tint/60 active:scale-[0.99]',
  )

  return (
    <div className="pb-2">
      {onReplay ? (
        <button type="button" aria-label="再听一遍" onClick={onReplay} className={boxCls}>
          {content}
        </button>
      ) : (
        <div className={boxCls}>{content}</div>
      )}
      {/* 尾:指向出题者(左下) */}
      <span
        aria-hidden
        className="ml-6 block h-0 w-0 border-x-8 border-t-[10px] border-x-transparent border-t-surface"
      />
    </div>
  )
}
