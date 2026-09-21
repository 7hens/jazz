import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stoneClass, stoneMark, stoneMarkClass, stoneOffset } from './stone'

/** 直接读源文件,不用 `import css from '@/index.css?raw'` —— 实测(@tailwindcss/vite 在场)
 *  那条路返回**空字符串**:模块能解析、断言却恒假,是个沉默的假绿陷阱。 */
const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

const ALL_STATES = ['idle', 'selected', 'correct', 'wrong', 'muted', 'gold', 'slot'] as const

describe('stone 词石纯函数', () => {
  it('对错/炼成各给形状冗余角标(色彩冗余:红绿之外给形状)', () => {
    expect(stoneMark('correct')).toBe('✓')
    expect(stoneMark('wrong')).toBe('✗')
    expect(stoneMark('gold')).toBe('⭐')
  })

  it('无冗余态不挂角标', () => {
    expect(stoneMark('idle')).toBeNull()
    expect(stoneMark('selected')).toBeNull()
    expect(stoneMark('muted')).toBeNull()
    expect(stoneMark('slot')).toBeNull()
  })

  it('角标底色随状态取 token', () => {
    expect(stoneMarkClass('correct')).toContain('bg-emerald')
    expect(stoneMarkClass('wrong')).toContain('bg-red')
    expect(stoneMarkClass('gold')).toContain('bg-gold')
    expect(stoneMarkClass('idle')).toBe('')
  })

  it('七态各自落到普通类 .stone--<态>', () => {
    for (const s of ALL_STATES) {
      expect(stoneClass(s)).toContain('stone')
      expect(stoneClass(s)).toContain(`stone--${s}`)
    }
  })

  it('状态类里不出现透明度工具类(不靠透明度压暗文字)', () => {
    for (const s of ALL_STATES) {
      expect(stoneClass(s)).not.toMatch(/\bopacity-/)
    }
  })

  it('错落:奇数列下移,偶数列不偏移', () => {
    expect(stoneOffset(1)).toContain('translate-y')
    expect(stoneOffset(0)).toBe('')
    expect(stoneOffset(2)).toBe('')
  })

  it('两列圆角半径不同,破等距方阵感', () => {
    expect(stoneClass('idle', 0)).not.toBe(stoneClass('idle', 1))
  })
})

// 材质类失守时 npm test 与 npm run lint 都是绿的,只有 npm run build 才暴露 —— 这组断言把
// 那个「只有构建能发现」的失败提前到测试里(spec §4.2 理由 1 的实测教训)。
describe('index.css 材质类存在性', () => {
  it('七个状态材质类都在产物源里', () => {
    for (const s of ALL_STATES) {
      expect(css).toContain(`.stone--${s}`)
    }
  })

  it('金石第二行用实色 token,不用 opacity 压暗(--color-gold-ink 压到 72% 实测仅 4.01:1,会破 4.5:1 下限)', () => {
    // 与「材质类不写裸 hex」同一纪律:先断言锚点存在再切片 —— 否则 indexOf 返回 -1 时断言静默空转。
    // 切的是第二行自己的规则 `.stone-sub`(用 --color-gold-ink-2),不是主行的 `.stone--gold`。
    // ⚠ 该行**当前恒为 emoji(图)**,color 对彩色字形无可见效果;断言仍保留 —— 它守的是
    // 「第二行一旦再承载文本,不许用 opacity 压暗」这条纪律,只是前提不再是「显示拼音」。
    const anchor = '.stone-sub {'
    expect(css).toContain(anchor)
    const start = css.indexOf(anchor)
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toContain('var(--color-gold-ink-2)')
    expect(rule).not.toMatch(/opacity:/)
  })

  it('材质类不写颜色字面量:hex 与 rgb()/hsl() 一并拦(白色高光除外)', () => {
    // marker 缺失时 indexOf 返回 -1、slice(-1) 只取末字符 → 断言会静默空转,故先显式断言 marker 存在。
    const marker = '/* ===== 题面糖果材质'
    // 终点也要断言存在:本段原先靠「marker 到文件尾」界定,拼音积木段追加在它后面之后,
    // 那个隐式假设就变成了「把下一段也算进本段的检查范围」。加终点 = 把边界写死。
    const until = '/* ===== 拼音积木材质'
    expect(css).toContain(marker)
    expect(css).toContain(until)
    const block = css.slice(css.indexOf(marker), css.indexOf(until))
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)

    // 只查 hex 会放过 rgb() —— `rgb(31 58 95 / 0.35)` 就是 --color-shadow(#1f3a5f) 的字面量写法,
    // 绕过了 token(本轮修掉的两处正是它)。逐条取本段**全部**规则的规则体来查:词石(.stone-*)、
    // 爆点/光效(.quiz-*)、水晶(.crystal*)都在本段内,任一漏抽 = 护栏只堵一半。
    // 这段里唯一合法的颜色函数写法是纯白 rgb(255 255 255 / x)(顶部的 @theme token 定义不在本段)。
    // 先去掉注释,免得注释里提到的类名把「规则」匹配带偏。
    const rules = block.replace(/\/\*[\s\S]*?\*\//g, '')
    const bodies = Array.from(rules.matchAll(/(\.(?:stone|crystal|quiz)[^{}]*)\{([^{}]*)\}/g), (m) => m[2])
    // 护栏自身不许退化成空转,更不许只覆盖一半:用「抽到的规则体数 === 本段规则总数」自洽校验
    // (旧正则只抽 21/27,漏掉 6 条 .quiz-*)。新增规则若前缀不在这三类里,这里立刻红。
    const allRules = Array.from(rules.matchAll(/[^{}]*\{/g))
    expect(bodies.length).toBe(allRules.length)

    const WHITE_HIGHLIGHT = /rgb\(\s*255\s+255\s+255\s*(?:\/\s*[\d.]+%?\s*)?\)/g
    for (const body of bodies) {
      const withoutWhite = body.replace(WHITE_HIGHLIGHT, '')
      expect(withoutWhite).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      // \b 保证不误伤 color-mix(in srgb, …) 里的 "srgb"。
      expect(withoutWhite).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\(/)
    }
  })
})
