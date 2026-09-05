import { useContext } from 'react'
import { ToastContext } from './toast-context'

// Compatibility for the current monolithic App; Task 12 removes this adapter.
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast 需在 <ToastProvider> 内使用')
  return context
}
