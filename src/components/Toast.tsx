import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '../lib/utils'

export type ToastType = 'success' | 'error' | 'info'
export type ToastData = { id: number; type: ToastType; message: string }

const ToastCtx = createContext<{ showToast: (type: ToastType, message: string) => void } | null>(null)

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast 需在 <ToastProvider> 内使用')
  return ctx
}

const TYPE_STYLE: Record<ToastType, string> = {
  success: 'border-emerald/40 bg-emerald/10 text-emerald',
  error: 'border-red/40 bg-red-tint text-red',
  info: 'border-sky/40 bg-sky/10 text-sky',
}
const TYPE_ICON: Record<ToastType, string> = { success: '✅', error: '❌', info: '📥' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const seq = useRef(0)
  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])
  const showToast = useCallback((type: ToastType, message: string) => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, type, message }]) // 保留最近 2 条 + 新 = ≤3
    window.setTimeout(() => remove(id), 3000)
  }, [remove])

  return (
    <ToastCtx.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={cn('pointer-events-auto flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold shadow-pop', TYPE_STYLE[t.type])}
            >
              <span aria-hidden>{TYPE_ICON[t.type]}</span>{t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
