import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { registry } from '@/shared/registry'
import type { AuthService } from '@/shared/services'
import { AuthEntry } from './AuthEntry'

beforeEach(() => registry.clear())

it('submits the typed token through the registered auth service', async () => {
  const login = vi.fn(async () => undefined)
  const anonymous = { status: 'anonymous' } as const
  const auth: AuthService = {
    getSnapshot: () => anonymous,
    subscribe: () => () => undefined,
    check: async () => undefined,
    login,
    logout: async () => undefined,
    markAnonymous: () => undefined,
  }
  registry.register('auth', auth)

  const { container } = render(<AuthEntry />)
  const token = container.querySelector<HTMLInputElement>('#token')
  const form = container.querySelector('form')

  expect(token).not.toBeNull()
  expect(form).not.toBeNull()
  fireEvent.change(token!, { target: { value: 'secret' } })
  fireEvent.submit(form!)

  await waitFor(() => expect(login).toHaveBeenCalledExactlyOnceWith('secret'))
})
