import { useState, type FormEvent } from 'react'
import { AuthService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { LoginGate } from './LoginGate'

export function AuthEntry() {
  const auth = useService(AuthService)
  const snapshot = useServiceSnapshot(auth)
  const [token, setToken] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void auth.login(token)
  }

  return (
    <LoginGate
      error={snapshot.status === 'error' ? snapshot.error.message : ''}
      onTokenChange={setToken}
      onSubmit={handleSubmit}
    />
  )
}
