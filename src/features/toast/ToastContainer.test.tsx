import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { ToastType } from '@/shared/services'
import { ToastContainer } from './ToastContainer'
import { createToastService } from './toast'

it.each([
  ['success', '✅'],
  ['error', '❌'],
  ['info', '📥'],
] as const)('preserves the %s toast icon and message copy', (type: ToastType, icon: string) => {
  const service = createToastService({
    setTimeout: () => 1,
    clearTimeout: () => undefined,
  })
  service.show(type, '保留文案')

  const { container } = render(<ToastContainer service={service} />)

  expect(screen.getByText(icon)).toBeInTheDocument()
  expect(screen.getByText('保留文案')).toBeInTheDocument()
  expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument()
})
