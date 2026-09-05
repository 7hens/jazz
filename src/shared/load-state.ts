export type LoadState<T> =
  | { status: 'idle' | 'loading'; data: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; data: T; error: string }
