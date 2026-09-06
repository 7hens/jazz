// 题型徽章:题卡左上角写明本卡题型,统一主词课/短教/冷启动全部答题面。
// 仅展示标签;听一听的「重听喇叭」由 ListenChoice 标题行另行渲染。
import { cn } from '@/shared/ui/utils'

export type QuizKind = 'choice' | 'listen-choice' | 'match'

const KIND_LABEL: Record<QuizKind, string> = {
  choice: '选一选',
  'listen-choice': '听一听',
  match: '连连看',
}

export function TypeBadge({ kind, className }: { kind: QuizKind; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-bold text-ink-2',
        className,
      )}
    >
      {KIND_LABEL[kind]}
    </span>
  )
}
