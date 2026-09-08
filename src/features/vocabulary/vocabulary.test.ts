import { expect, it } from 'vitest'
import { createVocabularyService } from './vocabulary'

it('finds a word by id', () => {
  const service = createVocabularyService()

  expect(service.wordById(1)?.id).toBe(1)
  expect(service.wordById(101)?.hanzi).toBe('升起')
  expect(service.wordById(104)).toBeUndefined()
})

it('getAllWords 过滤 story(letter-forest 仍 100 词)', () => {
  const service = createVocabularyService()
  const all = service.getAllWords()
  expect(all).toHaveLength(100)
  expect(all.every((w) => w.category !== 'story')).toBe(true)
  expect(all[0]?.id).toBe(1)
})
