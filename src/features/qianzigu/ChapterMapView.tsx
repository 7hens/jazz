import { motion } from 'motion/react'
import { ArrowLeft, Lock } from 'lucide-react'
import { cn } from '@/shared/ui/utils'
import type { WordUnit } from '@/shared/services'
import { Button } from '@/shared/ui/button'
import type { Chapter } from './chapter'
import { chapterWordDone } from './word-progress'
import type { ProgressData } from '@/shared/services'

/** 千字谷总章数(纵切片仅 ch1 有内容,ch2-20 锁定占位)。 */
const TOTAL_CHAPTERS = 20

export type ChapterMapViewProps = {
  chapters: readonly Chapter[]
  progress: ProgressData
  wordById(id: number): WordUnit | undefined
  onPlay(chapterId: number): void
  onBack(): void
}

export function ChapterMapView({ chapters, progress, wordById, onPlay, onBack }: ChapterMapViewProps) {
  const maxChapterId = Math.max(0, ...chapters.map((c) => c.id))
  const locked = Array.from({ length: Math.max(0, TOTAL_CHAPTERS - maxChapterId) }, (_, i) => maxChapterId + i + 1)

  return (
    <div className="min-h-screen text-ink">
      <header className="glass-strong sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="返回世界">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="truncate text-[15px] font-bold">千字谷</span>
          <span className="ml-auto shrink-0 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-ink-2">
            汉语 · 章节冒险
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-24 pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight">千字谷 · 章节地图</h1>
        <p className="mt-1 text-sm text-ink-2">拯救每一章的天空,收集故事里的汉字!</p>

        <div className="mt-5 space-y-4">
          {chapters.map((chapter) => {
            const words = chapter.wordIds
              .map((id) => wordById(id))
              .filter((w): w is WordUnit => w !== undefined)
            const complete = words.every((w) => chapterWordDone(progress[w.id]))
            return (
              <motion.section
                key={chapter.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'relative overflow-hidden rounded-[2rem] border-2 p-5 shadow-card transition-colors',
                  complete ? 'border-emerald/60 bg-emerald/5' : 'border-hairline bg-surface',
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="text-5xl leading-none" aria-hidden>{chapter.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-extrabold tracking-tight">第{chapter.id}章 · {chapter.title}</h2>
                    <p className="mt-0.5 text-sm font-medium text-ink-2">{chapter.subtitle}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {words.map((w) => (
                        <span
                          key={w.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink"
                        >
                          <span aria-hidden>{w.emoji}</span>
                          <span>{w.hanzi}</span>
                          <span className="font-normal text-ink-2">{w.pinyin}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  {complete ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald/10 px-3.5 py-1.5 text-sm font-bold text-emerald">
                      ✓ 已学会
                    </span>
                  ) : null}
                  <Button size="lg" className="min-w-32" onClick={() => onPlay(chapter.id)}>
                    {complete ? '再学一次' : '开始'}
                  </Button>
                </div>
              </motion.section>
            )
          })}
        </div>

        {locked.length > 0 ? (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">更多章节 · 即将开放</p>
            <div className="mt-3 grid grid-cols-4 gap-2.5">
              {locked.map((id) => (
                <div
                  key={id}
                  aria-disabled
                  className="flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-hairline bg-surface-2/60 text-ink-3"
                >
                  <Lock className="h-4 w-4" aria-hidden />
                  <span className="text-xs font-semibold">第{id}章</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
