import { createContext } from 'react'
import type { ToastType } from '@/shared/services'

export const ToastContext = createContext<{ showToast(type: ToastType, message: string): void } | null>(null)
