import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** 与 stone.test.ts 同理:直接读源文件,不用 `?raw` 导入(那条路在本仓返回空串,是沉默的假绿陷阱)。 */
const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

const MARKER = '/* ===== 拼音积木材质'

/** 取顶层 `{…}` 规则体(含嵌套:keyframes 的每一帧都在外层体内,故一并受检)。 */
function topLevelBodies(source: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = -1
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') {
      if (depth === 0) start = i + 1
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        out.push(source.slice(start, i))
        start = -1
      }
    }
  }
  return out
}

describe('index.css 拼音积木材质段', () => {
  it('材质段存在,且被 stone 的护栏以终点界定(不是「marker 到文件尾」)', () => {
    expect(css).toContain(MARKER)
    // 反向锚点:stone.test.ts 用本 marker 当切片终点,删了它那边会静默扩权。
    const section = css.slice(css.indexOf(MARKER))
    expect(section.length).toBeGreaterThan(0)
  })

  it('五类块各有一个颜色类,块面由 --pb 一族变量驱动', () => {
    for (const cls of ['pblock--initial', 'pblock--medial', 'pblock--final', 'pblock--nasal', 'pblock--tone']) {
      expect(css).toContain(`.${cls}`)
    }
    expect(css).toMatch(/\.pblock\s*\{[^}]*--pb:/)
  })

  it('声调块独占金石 token(金 = 声调,与四类字母块都不撞色)', () => {
    const start = css.indexOf('.pblock--tone {')
    expect(start).toBeGreaterThan(-1)
    const tone = css.slice(start, css.indexOf('}', start))
    expect(tone).toContain('var(--color-gold)')
    expect(tone).toContain('var(--color-gold-edge)')
    expect(tone).toContain('var(--color-gold-ink)')
  })

  it('槽位有强/弱两档提示类(试玩的难度旋钮靠它落地)', () => {
    for (const cls of ['pslot--initial', 'pslot--medial', 'pslot--final', 'pslot--nasal']) {
      expect(css).toContain(`.${cls}`)
    }
    expect(css).toContain('.pslot--plain')
  })

  it('焊缝定位写死在 CSS 里,不靠 Tailwind 任意值(那边逃不过 v4 扫描器的坑)', () => {
    const start = css.indexOf('.pweld {')
    expect(start).toBeGreaterThan(-1)
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toContain('left: -2px')
    expect(rule).toContain('position: absolute')
  })

  it('材质段不写颜色字面量:hex 与 rgb()/hsl() 一并拦(白色高光除外)', () => {
    const start = css.indexOf(MARKER)
    expect(start).toBeGreaterThan(-1)
    const section = css.slice(start).replace(/\/\*[\s\S]*?\*\//g, '')
    expect(section).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)

    const bodies = topLevelBodies(section)
    // 护栏不许退化成空转:抽到的规则体数要与段内顶层规则数自洽。
    const opened = (section.match(/\{/g) ?? []).length
    expect(bodies.length).toBeGreaterThan(10)
    expect(bodies.length).toBeLessThanOrEqual(opened)

    const WHITE_HIGHLIGHT = /rgb\(\s*255\s+255\s+255\s*(?:\/\s*[\d.]+%?\s*)?\)/g
    for (const body of bodies) {
      const withoutWhite = body.replace(WHITE_HIGHLIGHT, '')
      expect(withoutWhite).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      // \b 保证不误伤 color-mix(in srgb, …) 里的 "srgb"。
      expect(withoutWhite).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\(/)
    }
  })

  it('块面文字色走 --color-block-*-ink,不是一律白字压橙底', () => {
    for (const token of [
      '--color-block-initial-ink',
      '--color-block-medial-ink',
      '--color-block-final-ink',
      '--color-block-nasal-ink',
    ]) {
      expect(css).toContain(token)
    }
  })
})
