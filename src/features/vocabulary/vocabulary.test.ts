import { expect, it } from 'vitest'
import { createVocabularyService } from './vocabulary'

it('finds a word by id', () => {
  const service = createVocabularyService()

  expect(service.wordById(1)?.id).toBe(1)
  expect(service.wordById(101)).toBeUndefined()
})
