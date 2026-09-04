import type { ReactiveService } from '../useServiceSnapshot'
import type { User } from './api'

export type AuthSnapshot =
  | { status: 'checking' }
  | { status: 'authenticated'; user: User }
  | { status: 'anonymous' }
  | { status: 'error'; error: Error }

export interface AuthService extends ReactiveService<AuthSnapshot> {
  check(): Promise<void>
  login(token: string): Promise<void>
  logout(): Promise<void>
  markAnonymous(): void
}
