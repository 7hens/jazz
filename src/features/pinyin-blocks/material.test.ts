import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** 直接读源文件,不用 `?raw` 导入(那条路在本仓返回空串,是沉默的假绿陷阱)。 */
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
  it('材质段 marker 存在(下面几条「marker 切到文件尾」断言的共同前提)', () => {
    expect(css).toContain(MARKER)
    // 这里**只**钉「marker 还在」:曾经另有一条对向护栏 —— stone.test.ts 反向拿本 marker
    // 当**切片终点**(石材质段整段排在拼音积木段之前),删了 marker 会让那边的切片静默
    // 扩到文件尾。stone.test.ts 已随题面世界整批删除,那条对向护栏一并消失,不再有反证。
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
    // 「取第一处」读一条规则之前,先钉住它**唯一** —— 0-1-0 的规则里后写的赢:追加一条
    // 同选择器规则就能让下面几句继续读着旧规则、而块面实际换了样(本文件另一条用例的注释
    // 实测记过这个坏法:`.pstar` 末尾追加一条即全绿而事实为假)。
    expect(css.split('.pblock--medial {').length - 1, '.pblock--medial { 只该有一条规则').toBe(1)
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
      // 这四条**不取第一处**:`.pblock--tone {` 合法地有两条(变量一条、圆角一条),钉 `toBe(1)`
      // 会当场红。改成扫**全部**同选择器规则体 —— 追加一条带渐变的规则(0-1-0 后写的赢)
      // 照样被抓住,而合法两条不会被误伤。(`.pblock--medial` 不在这一列:它是唯一允许有
      // 双色面的一支,由上面那句单独断。)
      const bodies = css.split(`.${cls} {`).slice(1).map((part) => part.slice(0, part.indexOf('}')))
      expect(bodies.length, `${cls} 一条规则都没有`).toBeGreaterThan(0)
      for (const body of bodies) expect(body, cls).not.toContain('linear-gradient')
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

    // `.pblock--tone {` 是**合法两条**(变量一条、圆角一条)—— 所以这里不能钉「只该有一条」,
    // 但要钉住「就是这两条、且第二条是圆角那条」:上面三句读的是**第一处**,多出或换掉一条
    // (0-1-0 后写的赢)它们照样全绿,而金墨/圆片实际已被推翻。
    const toneBodies = css.split('.pblock--tone {').slice(1).map((part) => part.slice(0, part.indexOf('}')))
    expect(toneBodies, '.pblock--tone { 只该有两条(变量 + 圆角)').toHaveLength(2)
    // 丢掉这条半径只表现为「圆角方块」,没有任何非视觉信号 —— 合并/重排时最容易被顺手丢。
    expect(toneBodies[1], '第二条该是圆角那条').toContain('border-radius: 999px')
  })

  // 槽和块是同一件事的两半:槽在说「该拿哪种块过来」。图案对不上,这条线索就白给了。
  it('介母槽用与介母块同参数的斜切双色,只是化成淡版', () => {
    const ruleOf = (sel: string) => {
      // 先钉唯一,再取第一处 —— 否则追加一条同选择器规则(0-1-0 后写的赢)就能让下面
      // 拿到的「那条规则」不再是生效的那条。
      expect(css.split(sel).length - 1, `${sel} 只该有一条规则`).toBe(1)
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

    // 两个端点色各要一条淡版,且浓度由容器变量给 —— 写死百分比就拿不到三档了
    const stops = [...ruleOf('.pslot--medial {').matchAll(/edge\)\s*var\(--slot-fill\)/g)]
    expect(stops, '两个端点色各要一条淡版').toHaveLength(2)
  })

  // 三档提示只该由容器上的两个变量表达。再冒出一条 .pslot--plain 这类复制规则,
  // 就说明有人又按「一档一套规则」写了 —— 那是这套变量要解决的问题本身。
  it('提示三档只调容器上的两个变量,没有按档复制的槽规则', () => {
    for (const cls of ['.pslots ', '.pslots--mid ', '.pslots--weak ']) {
      // 「取第一处」读一条规则 → 先钉唯一:追加一条 `.pslots { --slot-line: 0%; --slot-fill: 0% }`
      // 排在最后、0-1-0 胜出,三档实际塌成一档,而下面读的还是第一条(注入实测全绿)。
      // 选择器字面量用**读取时用的那个**(带一个尾空格),不是对齐后的 `.pslots        {` ——
      // 这样有人日后重排对齐(多空格 ↔ 少空格)守卫不会失效;只有把空格整个删掉才会红(响亮)。
      expect(css.split(cls).length - 1, `${cls} 只该有一条规则`).toBe(1)
      const start = css.indexOf(cls)
      expect(start, cls).toBeGreaterThan(-1)
      const rule = css.slice(start, css.indexOf('}', start))
      expect(rule, cls).toContain('--slot-line:')
      expect(rule, cls).toContain('--slot-fill:')
    }
    // 弱档把线宽与填充都置 0 → 类型色整条退回中性,不需要另一条规则来「撤掉颜色」。
    // **两个变量都要钉**:只钉 --slot-line 的话,把 --slot-fill 抬到 40% 会让槽在「没有边框」的
    // 同时仍有底色 —— 弱档就不再是「退回中性」,而是一条不留边框的隐蔽染色线索,本文件照旧全绿。
    // 中/强两档的取值不钉:那两个数是可调的浓淡梯度,本用例的名字(「只调容器上的两个变量」)
    // 承诺的是**差异落在哪一层**,不是具体数字;钉死它们只会把调色变成改测试。
    const weak = css.slice(css.indexOf('.pslots--weak '), css.indexOf('}', css.indexOf('.pslots--weak ')))
    expect(weak).toContain('--slot-line: 0%')
    expect(weak).toContain('--slot-fill: 0%')
    // 禁的是**这条规则**,不是这个名字:注释里点名它是解释「为什么它不必存在」。
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('.pslot--plain')

    // 「退回中性」得真有一条中性色可退:弱档下类型色贡献 0,槽只剩这一条虚线。
    // 它一没,弱档的槽就是彻底不可见 —— 那不是「撤掉线索」,是把题目删了。
    expect(css.split('.pslot {').length - 1, '.pslot { 只该有一条规则').toBe(1)
    const base = css.indexOf('.pslot {')
    expect(base, '.pslot {').toBeGreaterThan(-1)
    expect(css.slice(base, css.indexOf('}', base)), '--slot-base-line 的定义').toContain('--slot-base-line:')

    // 五套类型规则一律读**两个**容器变量(--slot-line 描边 / --slot-fill 填充)+ 中性底线,
    // 谁自己写死百分比谁就是漏网的 —— 三句都要断:只断 --slot-line 的话,把 --slot-fill 写死成
    // 40% 照样全绿(本文件第一版就是这样漏的;`--slot-line` 那句断的是「填」这一半的兄弟,
    // 不是它自己)。.pslot--medial 的两个 edge 停点由上面那条用例单独断,这里不重复钉。
    for (const name of ['initial', 'medial', 'final', 'nasal', 'tone']) {
      const i = css.indexOf(`.pslot--${name} {`)
      expect(i, name).toBeGreaterThan(-1)
      const rule = css.slice(i, css.indexOf('}', i))
      expect(rule, name).toContain('var(--slot-line)')
      expect(rule, `${name} 把填充写死了,档位就不再只由容器变量表达`).toContain('var(--slot-fill)')
      expect(rule, `${name} 没留住中性底,弱档会整个消失`).toContain('var(--slot-base-line)')
      // 声调槽是个**圆片**。这条半径原本单独立成一条 .pslot--tone 规则,合并时最容易顺手丢 ——
      // 而丢了只表现为「圆角方块」,没有任何非视觉信号。合并越干净,越要把留下来的东西钉住。
      if (name === 'tone') expect(rule, '声调槽丢了 border-radius,圆片退化成圆角方块').toContain('border-radius: 999px')
      // 一条规则只能有一条:拆成两条时,上面那句「取第一条」就成了假绿(self-asserting)。
      expect(css.split(`.pslot--${name} {`).length - 1, `${name} 只该有一条规则`).toBe(1)
    }
  })

  // 三档的**值**不钉(见上一条:浓淡是可调设计,钉死会变成改色即红),但**序**要钉 ——
  // 「三档」的全部语义就是一层比一层弱。它只读相对顺序,把 55/30/0 调成 50/25/0 照样绿;
  // 而「中档比强档还浓」「相邻两档相等(那一档白设)」才是真回归。
  it('提示三档的浓淡递减:强 > 中 > 弱(两个变量各一遍)', () => {
    const tier = (sel: string) => {
      expect(css.split(sel).length - 1, `${sel} 只该有一条规则`).toBe(1)
      const i = css.indexOf(sel)
      expect(i, sel).toBeGreaterThan(-1)
      const body = css.slice(i, css.indexOf('}', i))
      const num = (name: string) => {
        const m = body.match(new RegExp(`${name}:\\s*(\\d+(?:\\.\\d+)?)%`))
        expect(m, `${sel} 缺 ${name}`).not.toBeNull()
        return Number(m?.[1])
      }
      return { line: num('--slot-line'), fill: num('--slot-fill') }
    }
    const strong = tier('.pslots ')
    const mid = tier('.pslots--mid ')
    const weak = tier('.pslots--weak ')
    expect(strong.line, '描边:强该比中浓').toBeGreaterThan(mid.line)
    expect(mid.line, '描边:中该比弱浓').toBeGreaterThan(weak.line)
    expect(strong.fill, '填充:强该比中浓').toBeGreaterThan(mid.fill)
    expect(mid.fill, '填充:中该比弱浓').toBeGreaterThan(weak.fill)
  })

  it('焊缝定位写死在 CSS 里,不靠 Tailwind 任意值(那边逃不过 v4 扫描器的坑)', () => {
    expect(css.split('.pweld {').length - 1, '.pweld { 只该有一条规则').toBe(1)
    const start = css.indexOf('.pweld {')
    expect(start).toBeGreaterThan(-1)
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toContain('left: -2px')
    expect(rule).toContain('position: absolute')
  })

  // 地图格子上「亮几颗 = 通了几关」是这张地图唯一的信息出口:格子不写汉字,也没有别处说进度。
  // 把 --on 改成中性色、或把暗星调实,格子就再也看不出「过了多少」,而一切都还是绿的。
  it('地图星位:暗星是 --color-ink 的淡版,亮星独占 --color-gold', () => {
    const ruleOf = (sel: string) => {
      const start = css.indexOf(sel)
      expect(start, sel).toBeGreaterThan(-1)
      return css.slice(start, css.indexOf('}', start))
    }
    const off = ruleOf('.pstar {')
    expect(off, '暗星的色必须由 --color-ink 淡出来:换成别的 token 就换了它跟底色的关系').toContain(
      'color-mix(in srgb, var(--color-ink)',
    )
    // 抓浓度上限:暗星调实了就和亮星分不出来,「亮了几颗」这层信息随之消失。
    const dim = Number(off.match(/var\(--color-ink\)\s*(\d+)%/)?.[1])
    expect(dim, '暗星得是淡版,不是把 ink 原色铺上去').toBeGreaterThan(0)
    expect(dim, '暗星太实就压过了亮星').toBeLessThan(50)

    expect(ruleOf('.pstar--on {'), '亮星丢了金色,格子只剩那串数字在说进度').toContain(
      'color: var(--color-gold)',
    )

    // 一条规则只能有一条:拆成两条时,上面那句「取第一条」就成了假绿(self-asserting)。
    // 实测过的坏法 —— 末尾再追加一条 `.pstar { color: var(--color-gold) }`,构建产物里
    // `.pstar--on,.pstar{color:var(--color-gold)}` 排在最后、特异性同为 0-1-0 → 胜出,
    // 连未通关的暗星一起变金,「这格过了几关」这层唯一信息彻底消失,而上面两句依然全绿。
    for (const sel of ['.pstar {', '.pstar--on {']) {
      expect(css.split(sel).length - 1, `${sel} 只该有一条规则`).toBe(1)
    }
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
      // 光「token 在文件里存在」撑不起这个名字:token 定义在 :root、却没被任何块面用,照样全绿。
      // 名字说的是**块面走它**,所以要到对应那条块规则里看接线。
      // (声调块走的是金石 token,不在这四支里 —— 它的接线由上面「声调块独占金石 token」那条守。)
      const type = token.replace('--color-block-', '').replace('-ink', '')
      expect(css.split(`.pblock--${type} {`).length - 1, `${type} 只该有一条规则`).toBe(1)
      const start = css.indexOf(`.pblock--${type} {`)
      expect(start, `.pblock--${type} {`).toBeGreaterThan(-1)
      expect(css.slice(start, css.indexOf('}', start)), `${type} 块面没走 ${token}`).toContain(`var(${token})`)
    }

    // 链子的最后一环:**谁把 `--pb-ink` 涂到字上**。上面只证明「类型类把 --pb-ink 指到某个 token」,
    // 而`.pblock` 的 `color: var(--pb-ink)` 才是唯一消费点(`grep -n "var(--pb-ink)" src/index.css`
    // 全文件只此一处)—— 删掉它,类型类照旧声明、token 照旧存在,整条链断而全量用例全绿。
    // 这一环同样是「取第一处」:追加一条 `.pblock { color: rgb(255 255 255) }` 排在最后、
    // 0-1-0 胜出,白字真的压上去而下面这句读的还是第一条(复审注入,实测 274 全绿)。
    expect(css.split('.pblock {').length - 1, '.pblock { 只该有一条规则').toBe(1)
    const pblock = css.indexOf('.pblock {')
    expect(pblock, '.pblock {').toBeGreaterThan(-1)
    expect(
      css.slice(pblock, css.indexOf('}', pblock)),
      '.pblock 没把 --pb-ink 涂到文字色上,上面那些声明就都白指了',
    ).toContain('color: var(--pb-ink)')
  })
})
