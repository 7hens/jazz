import type { ReactNode } from 'react'
import { registry } from '@/shared/services/manager'
import { ToastService } from '@/shared/services'
import { ToastContainer } from './ToastContainer'
import { ToastContext } from './toast-context'

// Compatibility for the current monolithic App; Task 12 composes ToastContainer directly.
export function ToastProvider({ children }: { children: ReactNode }) {
  const service = registry.get(ToastService)
  return (
    <ToastContext.Provider value={{ showToast: service.show }}>
      {children}
      <ToastContainer service={service} />
    </ToastContext.Provider>
  )
}
