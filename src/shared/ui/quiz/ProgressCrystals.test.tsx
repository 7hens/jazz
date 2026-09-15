import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ProgressCrystals } from './ProgressCrystals'

/** 与 stone.test.ts 同法:直接读源文件,不用 `import css from '@/index.css?raw'` ——
 *  实测(@tailwindcss/vite 在场)那条路返回**空字符串**:模块能解析、断言却恒假,是个沉默的假绿陷阱。 */
const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

/** 取某条规则的块内文本。先显式断言锚点存在 —— 否则 indexOf 返回 -1、slice(-1) 只取末字符,
 *  后面的断言会**静默空转**(stone.test.ts 的同款踩坑记录)。 */
function ruleBlock(selector: string): string {
  const anchor = `${selector} {`
  expect(css, `index.css 缺规则 ${selector}`).toContain(anchor)
  const start = css.indexOf(anchor)
  return css.slice(start, css.indexOf('}', start))
}

describe('ProgressCrystals 水晶进度条', () => {
  afterEach(cleanup)

  it('按 total 渲染格数,按 current 标记已过/当前/未到', () => {
    const { container } = render(<ProgressCrystals total={4} current={2} />)
    const cells = Array.from(container.querySelectorAll('[data-crystal]'))
    expect(cells.map((c) => c.getAttribute('data-crystal'))).toEqual(['done', 'done', 'active', 'todo'])
  })

  it('current=0 时首格是 active、其余未到', () => {
    const { container } = render(<ProgressCrystals total={3} current={0} />)
    const cells = Array.from(container.querySelectorAll('[data-crystal]'))
    expect(cells.map((c) => c.getAttribute('data-crystal'))).toEqual(['active', 'todo', 'todo'])
  })

  it('纯装饰:整行不进 a11y 树(进度语义由既有文本承载)', () => {
    const { container } = render(<ProgressCrystals total={2} current={1} />)
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
  })
})

// 材质类失守时 npm test 与 npm run lint 都是绿的,只有 npm run build 才暴露(css 不进 JS 图,
// 删掉规则不会让任何 import 报错)—— 这组断言把那个「只有构建能发现」的失败提前到测试里。
// 同 stone.test.ts 的存在性护栏一脉:本仓库的头号老坑是「CSS 静默没上屏而测试全绿」。
describe('index.css 水晶材质类存在性', () => {
  const MATERIALS = ['done', 'active', 'todo'] as const

  it('三个水晶状态材质类都在产物源里', () => {
    for (const s of MATERIALS) {
      expect(css).toContain(`.crystal--${s}`)
    }
  })

  it('材质类用 token / color-mix,不写裸 hex', () => {
    for (const s of MATERIALS) {
      expect(ruleBlock(`.crystal--${s}`)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })

  it('已过取翠玉 token、当前取琥珀 token(发光色随主题 token 走,不写死)', () => {
    expect(ruleBlock('.crystal--done')).toContain('var(--color-emerald)')
    expect(ruleBlock('.crystal--active')).toContain('var(--color-accent)')
  })

  it('未到是内凹(inset)而非外发光 —— 丢掉 inset 就退化成一颗亮球,与已过/当前混淆', () => {
    expect(ruleBlock('.crystal--todo')).toContain('inset')
  })

  it('已过/当前有外发光(偏移 0 的 box-shadow);只钉「有辉光」,不钉具体模糊半径以免卡死观感调参', () => {
    expect(ruleBlock('.crystal--done')).toMatch(/box-shadow:\s*0 0 \d+px/)
    expect(ruleBlock('.crystal--active')).toMatch(/box-shadow:\s*0 0 \d+px/)
  })
})
