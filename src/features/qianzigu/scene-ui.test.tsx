import { render, screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { wordById } from '@/features/vocabulary/words'
import type { Question } from '@/shared/services'
import type { TaskScene as TaskSceneData } from './chapter'
import { TaskScene } from './scene-ui'

const scene = {
  id: 't1-sentence',
  kind: 'task',
  title: '用「房子」说句话',
  intro: [],
  task: { wordId: 13, layer: 'sentence', minCorrect: 3 },
  onDone: [],
} as TaskSceneData

// 三档各 1 正 3 错;正确句文本带档号,便于断言「重出后停在同一档」。
function tier(n: number): Question {
  return {
    kind: 'choice',
    prompt: '哪句话说对了?',
    options: [
      { id: `t${n}-ok`, text: `档${n}正确`, speak: `档${n}正确` },
      { id: `t${n}-w1`, text: `档${n}错1`, speak: `档${n}错1` },
      { id: `t${n}-w2`, text: `档${n}错2`, speak: `档${n}错2` },
      { id: `t${n}-w3`, text: `档${n}错3`, speak: `档${n}错3` },
    ],
    answerId: `t${n}-ok`,
  } as Question
}
const questions: Question[] = [tier(1), tier(2), tier(3)]

// Choice 是两步:点卡(顺带朗读)→ 点「就它了!」提交(Choice.tsx:61-71)。
async function answer(user: UserEvent, text: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: text }))
  await user.click(screen.getByRole('button', { name: '就它了!' }))
}

function renderScene() {
  return render(
    <TaskScene
      scene={scene}
      word={wordById(13)!}
      skill="hanzi"
      makeQuestions={() => questions}
      speak={vi.fn()}
      playSound={vi.fn()}
      onCorrect={vi.fn(() => false)}
    />,
  )
}

it('句步答错两次后重出,仍停在同一档(不回到档 1)', async () => {
  const user = userEvent.setup()
  renderScene()

  // 过档 1 → 进入档 2
  await answer(user, '档1正确')
  expect(screen.getByText('档2正确')).toBeDefined()

  // 档 2 连续错两次(第 2 次错 → reveal 出「再练一次」按钮)
  await answer(user, '档2错1')
  await answer(user, '档2错1')
  await user.click(screen.getByRole('button', { name: '再练一次' }))

  // 仍是档 2,不是档 1
  expect(screen.getByText('档2正确')).toBeDefined()
  expect(screen.queryByText('档1正确')).toBeNull()
})
