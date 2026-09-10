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
    { role: 'xuwannian', text: '救救我…' },
  ])
  expect(screen.getByText('千字谷到了!')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(screen.getByText('救救我…')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(onDone).toHaveBeenCalledTimes(1)
})

it('同框:cast=[lingling,xuwannian],台词轮换时名字牌都在,说者随句切换', () => {
  const { container } = renderLines(
    [
      { role: 'lingling', text: '你好' },
      { role: 'xuwannian', text: '救救我' },
    ],
    { cast: ['lingling', 'xuwannian'] },
  )
  const badge = (name: string) =>
    Array.from(container.querySelectorAll('span')).find((el) => el.textContent === name)
  expect(screen.getByText('你好')).toBeInTheDocument()
  expect(badge('苏灵灵')?.className).toContain('bg-accent') // 首句说者=苏灵灵
  expect(badge('徐万年')?.className).not.toContain('bg-accent')

  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(screen.getByText('救救我')).toBeInTheDocument()
  expect(badge('徐万年')?.className).toContain('bg-accent') // 次句说者=徐万年
  expect(badge('苏灵灵')?.className).not.toContain('bg-accent')
})

it('sky 透传:天空体不入地面行;xuwannian 说者泡/名牌锚天幕(无第二头像)', () => {
  const { container } = renderLines(
    [
      { role: 'lingling', text: '你好' },
      { role: 'xuwannian', text: '救救我' },
    ],
    { cast: ['lingling', 'xuwannian'], sky: ['xuwannian'] },
  )
  const ground = () => container.querySelector('[data-stage-ground]')!
  // 首句=苏灵灵(地面):地面有苏灵灵名牌、徐万年不在;布景太阳本体恒在天幕;顶栏槽不存在
  expect(ground().textContent).toContain('苏灵灵')
  expect(ground().textContent).not.toContain('徐万年')
  expect(container.querySelector('[data-sun]')).not.toBeNull()
  expect(container.querySelector('[data-stage-sky]')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  // 次句=徐万年(sky 角色):文本可见、地面仍无徐万年、天空说者区含泡 + 名牌、无第二 ☀️ 头像
  expect(screen.getByText('救救我')).toBeInTheDocument()
  expect(ground().textContent).not.toContain('徐万年')
  const skySpeaker = container.querySelector('[data-stage-sky-speaker]')!
  expect(skySpeaker).not.toBeNull()
  expect(skySpeaker.textContent).toContain('救救我')
  expect(skySpeaker.textContent).toContain('徐万年')
  expect(container.querySelectorAll('[data-stage-bubble]').length).toBe(1)
  // 天幕说者区只锚泡 + 名牌,不含第二颗太阳头像(本体仍在布景层)
  expect(skySpeaker.textContent).not.toContain('☀️')
})

it('narrator 台词走旁白叙述框,不占站队', () => {
  const { container } = renderLines([{ role: 'narrator', text: '千字谷,很久很久以前…' }])
  expect(screen.getByText('千字谷,很久很久以前…')).toBeInTheDocument()
  // 无任何角色名牌:narrator 不入 cast → 查无角色名、无 bg-accent/bg-ink/60 名字牌
  expect(screen.queryByText('苏灵灵')).not.toBeInTheDocument()
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
      { role: 'xuwannian', text: '第二句' },
    ],
    { cast: ['lingling', 'xuwannian'] },
  )
  expect(speak).toHaveBeenCalledTimes(1)
  expect(speak).toHaveBeenLastCalledWith('第一句', 'lingling')
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(speak).toHaveBeenCalledTimes(2)
  expect(speak).toHaveBeenLastCalledWith('第二句', 'xuwannian')
})
