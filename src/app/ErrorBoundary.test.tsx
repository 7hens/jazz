import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

afterEach(() => vi.restoreAllMocks())

it('shows a recovery alert when a child fails to render', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)

  function BrokenChild(): never {
    throw new Error('render failed')
  }

  render(
    <ErrorBoundary>
      <BrokenChild />
    </ErrorBoundary>,
  )

  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(screen.getByRole('button')).toBeInTheDocument()
})
