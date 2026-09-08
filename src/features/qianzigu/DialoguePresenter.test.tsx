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
  renderLines(
    [
      { role: 'lingling', text: '你好' },
      { role: 'sun', text: '救救我' },
    ],
    { cast: ['lingling', 'sun'] },
  )
  expect(screen.getByText('灵灵')).toBeInTheDocument()
  expect(screen.getByText('太阳')).toBeInTheDocument()
})

it('narrator 台词走旁白叙述框,不占站队', () => {
  const { container } = renderLines([{ role: 'narrator', text: '千字谷,很久很久以前…' }])
  expect(screen.getByText('千字谷,很久很久以前…')).toBeInTheDocument()
  // 站队无任何名字牌(narrator 不入 cast)
  expect(container.querySelectorAll('span')).not.toHaveLength(0)
})
