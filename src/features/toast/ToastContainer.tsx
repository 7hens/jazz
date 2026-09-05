import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/shared/utils'
import type { ToastService, ToastType } from '@/shared/services'
import { useServiceSnapshot } from '@/shared/useServiceSnapshot'

const TYPE_STYLE: Record<ToastType, string> = {
  success: 'border-emerald/40 bg-emerald/10 text-emerald',
  error: 'border-red/40 bg-red-tint text-red',
  info: 'border-sky/40 bg-sky/10 text-sky',
}
const TYPE_ICON: Record<ToastType, string> = { success: '✅', error: '❌', info: '📥' }

export function ToastContainer({ service }: { service: ToastService }) {
  const toasts = useServiceSnapshot(service)

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={cn('pointer-events-auto flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold shadow-pop', TYPE_STYLE[toast.type])}
          >
            <span aria-hidden>{TYPE_ICON[toast.type]}</span>{toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
