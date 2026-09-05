import { describe, expect, it } from 'vitest'
import type { BasicsProgressData } from '@/shared/services'
import { createFoundationService } from './service'
import { createVocabularyService } from '@/features/vocabulary'

const vocab = createVocabularyService()

describe('FoundationService', () => {
  it('unitsFor 经 vocabulary 取词拆解', () => {
    const svc = createFoundationService(vocab)
    const keys = svc.unitsFor(21, 'pinyin')
    expect(keys).toContain('pinyin:p')
  })
  it('needFor 判强制', () => {
    const svc = createFoundationService(vocab)
    const models: BasicsProgressData = {}
    expect(svc.needFor(svc.unitsFor(21, 'pinyin'), models)).toBe('mandatory')
  })
})
