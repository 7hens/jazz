import { useState, type FormEvent } from 'react'
import { useService } from '@/shared/useService'
import { useServiceSnapshot } from '@/shared/useServiceSnapshot'
import { LoginGate } from './LoginGate'

export function AuthEntry() {
  const auth = useService('auth')
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
