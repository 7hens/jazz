import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { LessonAmbience } from './LessonAmbience'

describe('LessonAmbience 词课景深层', () => {
  afterEach(cleanup)

  it('纯装饰:整层 aria-hidden 且不吃点击', () => {
    const { container } = render(<LessonAmbience />)
    const layer = container.querySelector('[data-lesson-ambience]')
    expect(layer).not.toBeNull()
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer!.className).toContain('pointer-events-none')
  })
})
