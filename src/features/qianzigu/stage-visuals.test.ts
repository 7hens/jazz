import { describe, expect, it } from 'vitest'
import { atmosphereToClass, moodBorder, roleScale } from './stage-visuals'

describe('stage-visuals', () => {
  it('roleScale: changmo 放大,其余 1', () => {
    expect(roleScale('changmo')).toBe(1.5)
    expect(roleScale('lingling')).toBe(1)
    expect(roleScale('lingling')).toBe(1)
  })
  it('atmosphereToClass: 映射唯一 stage-sky 类', () => {
    expect(atmosphereToClass('night')).toBe('stage-sky stage-sky--night')
    expect(atmosphereToClass('day')).toBe('stage-sky stage-sky--day')
  })
  it('moodBorder: sad→sky/happy→emerald/scary→red/calm→hairline-strong', () => {
    expect(moodBorder('sad')).toBe('border-sky')
    expect(moodBorder('happy')).toBe('border-emerald')
    expect(moodBorder('scary')).toBe('border-red')
    expect(moodBorder('calm')).toBe('border-hairline-strong')
  })
})
