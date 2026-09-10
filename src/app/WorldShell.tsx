import { motion } from 'motion/react'
import { Sparkles } from 'lucide-react'

export type WorldShellProps = {
  onQianzigu(): void
  onLetterForest(): void
}

/** 双世界壳(登录后首页):千字谷(汉语·章节) / 字母林(英语·单词岛)。 */
export function WorldShell({ onQianzigu, onLetterForest }: WorldShellProps) {
  return (
    <div className="min-h-screen text-ink">
      <header className="glass-strong sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          <Sparkles className="h-5 w-5 text-accent" aria-hidden />
          <span className="truncate text-[15px] font-bold">魔法语言岛</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-24 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-3xl font-extrabold tracking-tight">选择你的世界</h1>
          <p className="mt-2 text-sm text-ink-2">小魔法师,今天想去哪里冒险?</p>
        </motion.div>

        <div className="mt-8 space-y-5">
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={onQianzigu}
            className="group flex w-full items-center gap-5 rounded-[2rem] border-2 border-hairline bg-surface p-6 text-left shadow-card transition-colors hover:border-accent/60 active:scale-[0.99]"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-amber-100 text-4xl" aria-hidden>
              🌅
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-extrabold tracking-tight">千字谷</span>
              <span className="mt-1 block text-sm font-medium text-ink-2">汉语 · 章节冒险</span>
              <span className="mt-2 block text-xs text-ink-3">跟着苏灵灵，帮千字谷镇的伙伴找回名字…收集汉字!</span>
            </span>
          </motion.button>

          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={onLetterForest}
            className="group flex w-full items-center gap-5 rounded-[2rem] border-2 border-hairline bg-surface p-6 text-left shadow-card transition-colors hover:border-accent/60 active:scale-[0.99]"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-sky-100 text-4xl" aria-hidden>
              🐱
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-extrabold tracking-tight">字母林</span>
              <span className="mt-1 block text-sm font-medium text-ink-2">英语 · 单词岛</span>
              <span className="mt-2 block text-xs text-ink-3">收集 100 个词的星尘,从语言初学者到语言大法师!</span>
            </span>
          </motion.button>
        </div>
      </main>
    </div>
  )
}
