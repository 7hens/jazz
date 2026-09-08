import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { SpeechRole } from '@/shared/services'
import { DialoguePresenter } from './DialoguePresenter'

const speak = vi.fn((_t: string, _r: SpeechRole) => true)

function renderLines(lines: DialoguePresenterProps['lines'], extra: Partial<DialoguePresenterProps> = {}) {
  const onDone = vi.fn()
  const utils = render(
    <DialoguePresenter lines={lines} atmosphere="dawn" speakRole={speak} onDone={onDone} {...extra} />,
  )
  return { onDone, ...utils }
}

import type { DialoguePresenterProps } from './DialoguePresenter'

it('逐句推进:首句泡 → 点继续 → 末句泡 → 再点触发 onDone', () => {
  const { onDone } = renderLines([
    { role: 'lingling', text: '千字谷到了!' },
    { role: 'sun', text: '救救我…' },
  ])
  expect(screen.getByText('千字谷到了!')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(screen.getByText('救救我…')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(onDone).toHaveBeenCalledTimes(1)
})

it('同框:cast=[lingling,sun],台词轮换时名字牌都在,说者随句切换', () => {
  const { container } = renderLines(
    [
      { role: 'lingling', text: '你好' },
      { role: 'sun', text: '救救我' },
    ],
    { cast: ['lingling', 'sun'] },
  )
  const badge = (name: string) =>
    Array.from(container.querySelectorAll('span')).find((el) => el.textContent === name)
  expect(screen.getByText('你好')).toBeInTheDocument()
  expect(badge('灵灵')?.className).toContain('bg-accent') // 首句说者=灵灵
  expect(badge('太阳')?.className).not.toContain('bg-accent')

  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(screen.getByText('救救我')).toBeInTheDocument()
  expect(badge('太阳')?.className).toContain('bg-accent') // 次句说者=太阳
  expect(badge('灵灵')?.className).not.toContain('bg-accent')
})

it('narrator 台词走旁白叙述框,不占站队', () => {
  const { container } = renderLines([{ role: 'narrator', text: '千字谷,很久很久以前…' }])
  expect(screen.getByText('千字谷,很久很久以前…')).toBeInTheDocument()
  // 无任何角色名牌:narrator 不入 cast → 查无角色名、无 bg-accent/bg-ink/60 名字牌
  expect(screen.queryByText('灵灵')).not.toBeInTheDocument()
  const badges = Array.from(container.querySelectorAll('span')).filter((el) =>
    /rounded-full/.test(el.className) && /(?:bg-accent|bg-ink\/60)/.test(el.className),
  )
  expect(badges).toHaveLength(0)
})

it('speakRole 每新句触发一次(saidRef 守卫不重复)', () => {
  speak.mockClear()
  renderLines(
    [
      { role: 'lingling', text: '第一句' },
      { role: 'sun', text: '第二句' },
    ],
    { cast: ['lingling', 'sun'] },
  )
  expect(speak).toHaveBeenCalledTimes(1)
  expect(speak).toHaveBeenLastCalledWith('第一句', 'lingling')
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(speak).toHaveBeenCalledTimes(2)
  expect(speak).toHaveBeenLastCalledWith('第二句', 'sun')
})
