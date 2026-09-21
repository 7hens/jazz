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

  // 介母 = 从声母滑向韵母的那个过渡音,所以它的面就是那两色的**斜切**。
  // 双色是「介母这个位置」的语义,不是装饰 —— 别的块类有渐变就说明有人又按「值」着色了。
  it('介母块面是斜切的「声母 → 韵母」双色,且只有介母有双色面', () => {
    const start = css.indexOf('.pblock--medial {')
    expect(start).toBeGreaterThan(-1)
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toContain('var(--color-block-initial-edge)')
    expect(rule).toContain('var(--color-block-final-edge)')

    // 分界线要斜 —— 90deg 的竖切读不出「从声母滑向韵母」这层意思。
    // 取最后一个角:第一个是那层 180deg 的白色高光。
    const angles = [...rule.matchAll(/(\d+(?:\.\d+)?)deg/g)].map((m) => Number(m[1]))
    const angle = angles[angles.length - 1]
    expect(angle, '缺角度').toBeDefined()
    expect(angle, '竖直平切读不出「滑过去」').toBeGreaterThan(95)
    expect(angle, '斜过头就快成横切了').toBeLessThan(160)

    // 两端各写死一个停点:过渡带窄才叫分界线,宽了就是糊成一片的第三色。
    const band = rule.match(/initial-edge\)\s*0\s*(\d+)%[\s\S]*?final-edge\)\s*(\d+)%/)
    expect(band, '要写死两端停点才谈得上分界线').not.toBeNull()
    expect(Number(band?.[2]) - Number(band?.[1]), '过渡带超过 8% 就糊了').toBeLessThanOrEqual(8)

    for (const cls of ['pblock--initial', 'pblock--final', 'pblock--nasal', 'pblock--tone']) {
      const i = css.indexOf(`.${cls} {`)
      expect(i, cls).toBeGreaterThan(-1)
      expect(css.slice(i, css.indexOf('}', i)), cls).not.toContain('linear-gradient')
    }
    // 双身份块那套「一块画两种色」的类是删掉的:颜色跟位置走,不跟块走。
    expect(css).not.toContain('.pblock--dual')
  })

  it('声调块独占金石 token(金 = 声调,与四类字母块都不撞色)', () => {
    const start = css.indexOf('.pblock--tone {')
    expect(start).toBeGreaterThan(-1)
    const tone = css.slice(start, css.indexOf('}', start))
    expect(tone).toContain('var(--color-gold)')
    expect(tone).toContain('var(--color-gold-edge)')
    expect(tone).toContain('var(--color-gold-ink)')
  })

  // 槽和块是同一件事的两半:槽在说「该拿哪种块过来」。图案对不上,这条线索就白给了。
  it('介母槽用与介母块同参数的斜切双色,只是化成淡版', () => {
    const ruleOf = (sel: string) => {
      const start = css.indexOf(sel)
      expect(start, sel).toBeGreaterThan(-1)
      return css.slice(start, css.indexOf('}', start))
    }
    /** 斜切双色的三要素。角度取最后一个 —— 块面第一层是 180deg 的白色高光。 */
    const cut = (rule: string) => {
      const degs = [...rule.matchAll(/(\d+)deg/g)].map((m) => Number(m[1]))
      return {
        deg: degs[degs.length - 1],
        from: Number(rule.match(/\)\s*0\s*(\d+)%/)?.[1]),
        to: Number(rule.match(/\)\s*(\d+)%\s*100%/)?.[1]),
      }
    }
    const block = cut(ruleOf('.pblock--medial {'))
    const slot = cut(ruleOf('.pslot--medial {'))
    expect(block).toEqual(slot)
    expect(block.from).toBeLessThan(block.to)

    // 槽色必须淡 —— 浓了就像个已经填好的槽,孩子会以为不用放块。
    const alphas = [...ruleOf('.pslot--medial {').matchAll(/edge\)\s*(\d+)%,\s*transparent/g)].map((m) => Number(m[1]))
    expect(alphas, '两个端点色各要一条淡版').toHaveLength(2)
    for (const a of alphas) expect(a, '太浓就像填好的槽').toBeLessThanOrEqual(25)
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
