import type { ReactiveService } from '../useServiceSnapshot'
import type { User } from './api'
import type { ServiceToken } from './token'

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

export const AuthService = Symbol('AuthService') as unknown as ServiceToken<AuthService>
