export type RecordType = 'expense' | 'income' | 'weight'

export type LifeRecord = {
  id: string
  type: RecordType
  date: string
  note?: string
  amount?: number
  category?: string
  weight?: number
  exerciseType?: string
  duration?: number
  calories?: number
  createdAt?: string
}

export type UserProfile = {
  id: string
  email: string
  name: string
}
