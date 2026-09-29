import { describe, expect, it } from 'vitest'
// 三处存档侧 `LEVEL_ID` 按**文本**取(见「存档侧三处 LEVEL_ID」那条)。
import workerPinyinSource from '../../../worker/pinyin-progress.ts?raw'
import apiSource from '../api/api.ts?raw'
import localStoreSource from '../pinyin-progress/local-store.ts?raw'
import {
  FINAL_BASIC,
  FINAL_COMPOUND,
  HINT_BY_UNIT,
  INITIALS_ALL,
  MEDIALS,
  NASALS,
  TONE_VALUES,
  WELD_INITIALS,
  hintFor,
  speakOf,
} from './blocks'
import {
  UNITS,
  easyLevelsOf,
  hardLevelsOf,
  losesDots,
  spell,
  spellSyllable,
  taughtBlocks,
  type Level,
  type Syllable,
} from './levels'
import { slotsFor } from './rules'
import type { BlockType } from './blocks'

/** 摊平成「所属单元下标 + 关卡」,断言里好定位到具体是哪一题。 */
const allLevels: { unit: number; unitId: string; index: number; level: Level }[] = UNITS.flatMap((u, unit) =>
  u.levels.map((level, index) => ({ unit, unitId: u.id, index, level })),
)

const where = (l: { unitId: string; index: number }): string => `${l.unitId}#${l.index + 1}`

/** 源码里的 `const LEVEL_ID = /.../` 字面量(含斜杠与 flags),供下面那条守卫取用。 */
const STORAGE_LEVEL_ID = /const LEVEL_ID = (\/[^/\n]+\/[a-z]*)/

/** `/^u\d+-\d+h?$/i` 这样的字面量 → 真正则。取自源码,不在测试里再抄一份规则。 */
function regexOf(literal: string): RegExp {
  const end = literal.lastIndexOf('/')
  return new RegExp(literal.slice(1, end), literal.slice(end + 1))
}

/** 全课程的音节摊平 —— 覆盖矩阵那几条守卫共用。 */
const allSyls = allLevels.flatMap((entry) => entry.level.syl.map((syl) => ({ ...entry, syl })))

/** 16 个整体认读的**不带调**写法(汉语拼音方案的固定表)。 */
const WELD_SYLLABLES = [
  'zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si',
  'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying',
] as const

/** 去掉调号 —— 整体认读表按不带调的写法数。 */
const TONE_MARKS: Readonly<Record<string, string>> = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ǖ: 'ü', ǘ: 'ü', ǚ: 'ü', ǜ: 'ü',
}

const stripTone = (s: string): string => [...s].map((c) => TONE_MARKS[c] ?? c).join('')

describe('拼音积木关卡数据', () => {
  it('单元 id 与关卡非空', () => {
    expect(UNITS.length).toBeGreaterThan(0)
    for (const u of UNITS) {
      expect(u.id).toMatch(/^u\d+$/)
      expect(u.levels.length).toBeGreaterThan(0)
    }
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(UNITS.length)
  })

  it('每个音节都摊得出韵腹;声调槽靠它定位', () => {
    for (const entry of allLevels) {
      entry.level.syl.forEach((s: Syllable, i) => {
        expect(s.final, `${where(entry)} syl[${i}] 缺韵腹`).toBeDefined()
      })
    }
  })

  // 焊死标记的语义 = 这个音节拼出来读的不是「块面音相接」。只有那批声母起头才成立。
  it('焊死标记只落在焊接声母起头、且不带介母的音节上', () => {
    for (const entry of allLevels) {
      for (const [i, s] of entry.level.syl.entries()) {
        if (!s.weld) continue
        const label = `${where(entry)} syl[${i}]`
        expect(WELD_INITIALS, label).toContain(s.initial)
        expect(s.medial, `${label} 三拼不该焊`).toBeUndefined()
      }
    }
  })

  // 原来这条是「每个块都在该单元**硬编码的**解锁池里」。池改成从课程数据派生之后,
  // 它变成了同义反复(池就是课程自己),故换成它真正在守的那半条性质:
  // 池只增不减 —— 后面的单元一定收得下前面单元出过的每一个块。
  it('块池只增不减:后一单元一定包含前一单元出过的全部块', () => {
    const keys = (unit: number): string[] => taughtBlocks(unit).map((b) => `${b.type}:${b.value}`)
    for (let unit = 1; unit < UNITS.length; unit++) {
      for (const key of keys(unit - 1)) {
        expect(keys(unit), `u${unit + 1} 的池丢了 ${key}`).toContain(key)
      }
    }
  })

  it('块值都在块目录的定义域内', () => {
    for (const { level, unitId, index } of allLevels) {
      const label = `${unitId}#${index + 1}`
      for (const s of level.syl) {
        if (s.initial !== undefined) expect(INITIALS_ALL, label).toContain(s.initial)
        if (s.medial !== undefined) expect(MEDIALS, label).toContain(s.medial)
        if (s.nasal !== undefined) expect(NASALS, label).toContain(s.nasal)
        if (s.final !== undefined) {
          expect([...FINAL_BASIC, ...FINAL_COMPOUND], label).toContain(s.final)
        }
      }
    }
  })

  it('每关都有图与拼音,且拼音不重复(同一题不该出现两次)', () => {
    const seen = new Map<string, string>()
    for (const entry of allLevels) {
      expect(entry.level.emoji.length, where(entry)).toBeGreaterThan(0)
      expect(entry.level.pinyin.length, where(entry)).toBeGreaterThan(0)
      const key = entry.level.pinyin
      expect(seen.has(key), `${key} 重复出现在 ${seen.get(key)} 与 ${where(entry)}`).toBe(false)
      seen.set(key, where(entry))
    }
  })

  // 点一块就要念出这块的音。表里漏了谁,那块就成了哑巴 —— 且哑得没有任何提示。
  it('每一块都有同音汉字可念,声调块除外', () => {
    const pool = {
      initial: INITIALS_ALL,
      medial: MEDIALS,
      final: [...FINAL_BASIC, ...FINAL_COMPOUND],
      nasal: NASALS,
    }
    for (const [type, values] of Object.entries(pool)) {
      for (const v of values) {
        expect(speakOf(type as keyof typeof pool, v), `${type}:${v} 没有读音`).toMatch(/^[一-龥]$/)
      }
    }
    // 声调本身不是一个能念的音。真按下去会念出「啊」这类给定韵母,反而搅混。
    for (const t of TONE_VALUES) expect(speakOf('tone', t), `声调块 ${t}`).toBeUndefined()
  })

  // 唯一一个「换个身份换个读法」的字母。鼻尾念的是它所代表的鼻韵母,不是字母名。
  it('n 当声母读「讷」,当鼻尾读「恩」;ng 读「鞥」', () => {
    expect(speakOf('initial', 'n')).toBe('讷')
    expect(speakOf('nasal', 'n')).toBe('恩')
    expect(speakOf('nasal', 'ng')).toBe('鞥')
  })

  // 朗读文本必须是汉字:把拼音串喂给系统 TTS 会被逐字母念出来,这是踩过的坑。
  it('朗读文本是汉字,且字数与音节数一致', () => {
    for (const entry of allLevels) {
      const { read } = entry.level
      const label = where(entry)
      expect(read, label).toMatch(/^[一-龥]+$/)
      expect([...read].length, `${label} 朗读「${read}」字数对不上音节数`).toBe(entry.level.syl.length)
    }
  })

  it('双音节关恒为两个音节(分组渲染的前提)', () => {
    for (const u of UNITS) {
      const sizes = u.levels.map((l) => l.syl.length)
      if (u.levels.length === 1) continue
      expect(new Set(sizes).size, `${u.id} 音节数不一致`).toBe(1)
    }
  })

  // 存档只认 id。id 一重复,两个关就共用一份星 —— 而且是静默的,没有任何报错。
  it('每关都有稳定 id,格式合规且全局唯一', () => {
    const seen = new Map<string, string>()
    for (const entry of allLevels) {
      const level = entry.level
      const label = where(entry)
      expect(level.id, `${label} 缺 id`).toMatch(/^u\d+-\d+h?$/)
      const owner = seen.get(level.id)
      expect(owner, `${level.id} 重复出现在 ${owner} 与 ${label}`).toBeUndefined()
      seen.set(level.id, label)
    }
    expect(seen.size, 'id 总数该等于关卡总数').toBe(allLevels.length)
  })

  // **存档侧必须认下这里定下的每一种 id。** 上面那条只管「数据侧允许什么形状」,存档侧另有三处
  // 独立字面量(worker 不跨端 import,`api.ts` / `local-store.ts` 各留一份),谁也没校过它们。
  //
  // 这就是 2026-09-29 那个 bug 的缝:困难部分的 id 全带 `h` 后缀(91 道),而三处 `LEVEL_ID` 只到
  // `u\d+-\d+` —— 孩子在困难部分拿的星一落库就 400(「星级数据不合法」),**每题弹一次红条**,
  // 星当场回滚、一颗也存不下(本地库里 0 个 `h` 键就是实证)。旧锚点 `api.test.ts` 只试了
  // `u1-0` 一个**简单部分**的 id(它的注释还写着「91 个」,却只抽了一个样本),于是两张网各钉一半。
  // 这一条改成**遍历每一道真实关卡 id** 去试三处正则:以后 id 再多一种后缀,这里先红。
  //
  // 三处源码按**文本**读(不 import)—— features 之间不许编译期互引,`api.test.ts` 读 worker 同法。
  it('存档侧三处 LEVEL_ID 认下每一道真实关卡 id(含困难部分)', () => {
    const sources: Record<string, string> = {
      'worker/pinyin-progress.ts': workerPinyinSource,
      'src/features/api/api.ts': apiSource,
      'src/features/pinyin-progress/local-store.ts': localStoreSource,
    }

    for (const [file, source] of Object.entries(sources)) {
      const literal = STORAGE_LEVEL_ID.exec(source)?.[1]
      expect(literal, `${file}: 没搜到 \`const LEVEL_ID = /.../\` 字面量 —— 搜法失效或字面量被改名,请让本测试与它同步`).toBeDefined()

      const re = regexOf(literal as string)
      const rejected = allLevels.filter((entry) => !re.test(entry.level.id))
      expect(
        rejected.map((entry) => `${where(entry)}=${entry.level.id}`).slice(0, 5),
        `${file} 的 LEVEL_ID(${literal})拒了 ${rejected.length}/${allLevels.length} 个真实关卡 id —— 孩子在那些部分拿的星会被 400 挡在库外`,
      ).toEqual([])
    }
  })

  // 地图格子靠名片表意 —— 名片空了,那一格对 4-8 岁的孩子就是一块灰砖。
  it('每个单元都有非空名片,且名片里的块都在块目录定义域内', () => {
    const pool: Record<string, readonly string[]> = {
      initial: INITIALS_ALL,
      medial: MEDIALS,
      final: [...FINAL_BASIC, ...FINAL_COMPOUND],
      nasal: NASALS,
      tone: TONE_VALUES,
    }
    for (const u of UNITS) {
      expect(u.badge.length, `${u.id} 名片为空`).toBeGreaterThan(0)
      for (const block of u.badge) {
        expect(pool[block.type], `${u.id} 名片块类型 ${block.type}`).toBeDefined()
        expect(pool[block.type], `${u.id} 名片块 ${block.type}:${block.value}`).toContain(block.value)
      }
      // 声调块不该出现在名片里:它不是一个「这个单元教什么」的答案
      expect(u.badge.some((b) => b.type === 'tone'), `${u.id} 名片混进了声调块`).toBe(false)
    }
  })

  // 只降不升 = 不回头。**它不保证「真的降过」** —— 一张全 strong 的表照样满足它,
  // 所以别把「随课程递减」的承诺挂在这一条上;那半边由下面钉边界的那条负责。
  it('每个单元都有提示基线,且只降不升(不回头)', () => {
    const order = { strong: 0, mid: 1, weak: 2 } as const
    let previous = -1
    for (const u of UNITS) {
      const hint = HINT_BY_UNIT[u.id]
      expect(hint, `${u.id} 缺提示基线`).toBeDefined()
      const rank = order[hint as keyof typeof order]
      expect(rank, `${u.id} 的提示比上一单元更强 —— 脚手架回头了`).toBeGreaterThanOrEqual(previous)
      previous = rank
    }
  })

  // 撤档的**位置**是产品决策(哪几个单元还看得见颜色),不是实现细节 —— 钉边界,不抄整张表。
  // 到最后一关还全染色,颜色就成了拐杖;这也是唯一挡得住「整张表被改成全 strong」的东西。
  // 每个档位钉住**两格**(首格 + 末格):留一个能自由改的格子,档位边界就会被静默挪走
  // (中档缩成只剩 u5 一关也算「中档」)。末行钉格数,防止偷偷多一格少一格。
  it('脚手架逐部分撤走:强档到 u4,中档到 u8,末四关不许再有颜色', () => {
    for (const id of ['u1', 'u2', 'u3', 'u4']) expect(HINT_BY_UNIT[id], `${id} 该是强档`).toBe('strong')
    for (const id of ['u5', 'u6', 'u7', 'u8']) expect(HINT_BY_UNIT[id], `${id} 该是中档`).toBe('mid')
    for (const id of ['u9', 'u10', 'u11', 'u12']) expect(HINT_BY_UNIT[id], `${id} 该是弱档`).toBe('weak')
    expect(Object.keys(HINT_BY_UNIT), '表的格数').toHaveLength(12)
  })

  // 连错回强是「救急垫脚石」,不是存档:它只该让提示变强,不该让它变弱。
  it('连错 2 次把提示提到强档,且只升不降', () => {
    for (const u of UNITS) {
      const base = hintFor(u.id, 0)
      expect(hintFor(u.id, 1)).toBe(base)
      expect(hintFor(u.id, 2)).toBe('strong')
      expect(hintFor(u.id, 7)).toBe('strong')
    }
  })

  // 表外的单元 id 兜底强档:新单元总得先能玩,漏登记不该让整关变成一块灰砖。
  // 上面那条循环只走 UNITS,兜底那半边没人走过 —— 少了这条,删掉 `?? 'strong'` 全仓仍绿。
  it('表里没有的单元 id 兜底强档', () => {
    expect(hintFor('u99', 0)).toBe('strong')
    expect(hintFor('', 0)).toBe('strong')
  })

  // 复习部分是难度的另一半:提示档不参与单元基线表,恒弱(连错 2 次的救急强档除外)。
  // 漏改 `PinyinBlocksGame.tsx` 的第三参时,复习部分会**静默**用单元基线 —— 这条就是为那一类静默失败设的。
  it('复习部分的提示恒为弱档,除非连错 2 次', () => {
    for (const u of UNITS) {
      expect(hintFor(u.id, 0, 'review'), `${u.id} 复习部分该是弱档`).toBe('weak')
      expect(hintFor(u.id, 1, 'review'), `${u.id} 复习部分错一次仍是弱档`).toBe('weak')
      expect(hintFor(u.id, 2, 'review'), `${u.id} 连错 2 次要回强档`).toBe('strong')
    }
  })

  // 本文件最值钱的一条。`pinyin`(显示串)与 `syl`(孩子拼的块)是两份手写数据,
  // 在此之前**没有任何东西保证一致** —— `pinyin: 'māo'` 配 `syl: [{final:'ao'}]` 会一路全绿,
  // 而孩子看到的拼音和积木拼出来的不是一回事。
  // 它同时也守住了标调位置:`niú` 若被标成 `níu`,spell 产出 `níu` 而 pinyin 写 `niú`,当场红。
  it('每关的 pinyin 与 syl 拼出来的一致', () => {
    for (const entry of allLevels) {
      expect(spell(entry.level), where(entry)).toBe(entry.level.pinyin)
    }
  })

  // 标调位置与 y/w 改写本身是知识点,给纯函数单测(逐条对应 spec §7.2 的规则)。
  it('spellSyllable:零声母改写、y 代劳 i、ü 去点、标调位置', () => {
    const syl = (s: Omit<Syllable, 'tone'> & { tone: Syllable['tone'] }): Syllable => ({ ...s })

    // 零声母:i / u / ü 单独作韵母 → yi / wu / yu;其余照抄
    expect(spellSyllable(syl({ final: 'i', tone: 3 }))).toBe('yǐ')
    expect(spellSyllable(syl({ final: 'u', tone: 3 }))).toBe('wǔ')
    expect(spellSyllable(syl({ final: 'ü', tone: 2 }))).toBe('yú')
    expect(spellSyllable(syl({ final: 'üe', tone: 4 }))).toBe('yuè')
    expect(spellSyllable(syl({ final: 'ai', tone: 4 }))).toBe('ài')
    expect(spellSyllable(syl({ final: 'er', tone: 2 }))).toBe('ér')
    expect(spellSyllable(syl({ final: 'ie', tone: 4 }))).toBe('yè') // i 起头改 y,不写 yie
    expect(spellSyllable(syl({ final: 'iu', tone: 2 }))).toBe('yóu') // 缩写 iu = iou
    expect(spellSyllable(syl({ final: 'ui', tone: 4 }))).toBe('wèi') // 缩写 ui = uei
    expect(spellSyllable(syl({ medial: 'u', final: 'o', tone: 3 }))).toBe('wǒ')
    expect(spellSyllable(syl({ medial: 'i', final: 'a', tone: 1 }))).toBe('yā')

    // y 是零声母的写法:后面的 i 由它代劳,不写成 yie
    expect(spellSyllable(syl({ initial: 'y', final: 'ie', tone: 4 }))).toBe('yè')
    expect(spellSyllable(syl({ initial: 'y', final: 'i', tone: 1 }))).toBe('yī')
    expect(spellSyllable(syl({ initial: 'y', final: 'i', nasal: 'n', tone: 1 }))).toBe('yīn')
    expect(spellSyllable(syl({ initial: 'y', final: 'i', nasal: 'ng', tone: 1 }))).toBe('yīng')

    // j q x y 之后的 ü 去点;n l 之后保留
    expect(spellSyllable(syl({ initial: 'j', final: 'ü', tone: 2 }))).toBe('jú')
    expect(spellSyllable(syl({ initial: 'q', final: 'ü', nasal: 'n', tone: 2 }))).toBe('qún')
    expect(spellSyllable(syl({ initial: 'n', final: 'ü', tone: 3 }))).toBe('nǚ')
    expect(spellSyllable(syl({ initial: 'l', final: 'ü', tone: 4 }))).toBe('lǜ')
    expect(spellSyllable(syl({ initial: 'q', medial: 'ü', final: 'a', nasal: 'n', tone: 1 }))).toBe('quān')

    // 标调位置:有 a 标 a;没 a 而有 o/e 标它;i/u 并列标**后一个**;单个标自己
    expect(spellSyllable(syl({ initial: 'd', medial: 'u', final: 'o', tone: 3 }))).toBe('duǒ')
    expect(spellSyllable(syl({ initial: 'h', final: 'ei', tone: 1 }))).toBe('hēi')
    expect(spellSyllable(syl({ initial: 'n', final: 'iu', tone: 2 }))).toBe('niú')
    expect(spellSyllable(syl({ initial: 'g', final: 'ui', tone: 1 }))).toBe('guī')
    expect(spellSyllable(syl({ initial: 'x', final: 'i', tone: 1 }))).toBe('xī')
  })

  // 去点判据只此一处:渲染层的「两点飞走」与 spell 共用它,不许各写一份。
  it('losesDots:j q x y 之后去掉两点,n l 之后保留', () => {
    for (const head of ['j', 'q', 'x', 'y']) expect(losesDots(head, 'üe'), head).toBe(true)
    for (const head of ['n', 'l']) expect(losesDots(head, 'ü'), head).toBe(false)
    expect(losesDots(undefined, 'ü'), '零声母的 ü 走另一条规则(ü → yu)').toBe(false)
    expect(losesDots('j', 'a'), '不带 ü 的音节没有两点可去').toBe(false)
  })

  /* ------------------------------------------------ 覆盖矩阵(spec §4) */

  it('G2:23 个声母全部教到', () => {
    const taught = new Set(allSyls.map((e) => e.syl.initial).filter((v) => v !== undefined))
    for (const p of INITIALS_ALL) expect(taught, `声母 ${p} 一关都没出现过`).toContain(p)
  })

  it('G3:韵母全表教到(单韵母 / 复韵母 / er / 前鼻 / 后鼻)', () => {
    const finals = new Set(allSyls.map((e) => e.syl.final).filter((v) => v !== undefined))
    for (const v of FINAL_BASIC) expect(finals, `单韵母 ${v}`).toContain(v)
    for (const v of FINAL_COMPOUND) expect(finals, `复韵母 / 特殊韵母 ${v}`).toContain(v)

    // 鼻韵母按「韵腹 + 鼻尾」判:an en in un ün 与 ang eng ing ong 都得有。
    const nasalized = new Set(
      allSyls
        .filter((e) => e.syl.nasal !== undefined)
        .map((e) => `${e.syl.final}${e.syl.nasal}`),
    )
    for (const v of ['an', 'en', 'in', 'un', 'ün', 'ang', 'eng', 'ing', 'ong']) {
      expect(nasalized, `鼻韵母 ${v}`).toContain(v)
    }
  })

  // 四声是知识点,不是配色 —— 每一调都得在课程里出现过,且字母上真的带对了调号
  // (带错调的 `pinyin` 会被 G1 抓住,这里只管「四调齐不齐」)。
  it('G3b:四个声调全部教到', () => {
    const tones = new Set(allLevels.flatMap((e) => e.level.syl.map((s) => s.tone)))
    for (const t of TONE_VALUES) expect(tones, `第 ${t} 声一关都没出现过`).toContain(Number(t))
  })

  it('G4:16 个整体认读全部教到', () => {
    const spelled = new Set(
      allLevels.flatMap((e) => e.level.syl.map((s) => stripTone(spellSyllable(s)))),
    )
    for (const w of WELD_SYLLABLES) expect(spelled, `整体认读 ${w}`).toContain(w)
  })

  it('G5:ü 的三类结构各至少一关(去点 / 不去点 / 作介母)', () => {
    // 介母槽与韵母槽都可能是那个 ü(quān 在介母位、jú 在韵母位),两处都查。
    const drops = (s: Syllable): boolean =>
      losesDots(s.initial, s.medial ?? '') || losesDots(s.initial, s.final ?? '')

    expect(allSyls.filter((e) => drops(e.syl)).length, 'j q x y 之后去点的关').toBeGreaterThan(0)

    const keep = allSyls.filter(
      (e) => (e.syl.final ?? '').startsWith('ü') && !losesDots(e.syl.initial, e.syl.final ?? ''),
    )
    expect(keep.length, 'n l 之后保留两点的关').toBeGreaterThan(0)
    for (const e of keep) {
      expect(['n', 'l'], `${where(e)} 保留两点该只在 n / l 之后`).toContain(e.syl.initial)
    }

    expect(allSyls.filter((e) => e.syl.medial === 'ü').length, 'ü 作介母的三拼关').toBeGreaterThan(0)
  })

  // G8 写在 `rules.test.ts`(它比的是干扰块的数量机制,那里已有 `buildBlocks` / `seenIn` / `seq`)。

  // 部分化后「单元末复习关」这一关**不存在了** —— 原 12 道复习关的题并进简单部分当普通题。
  // 这条钉的是**它们的 id 一字不改**:id 是存档键,改一个就是老存档里一颗星变孤儿。
  it('G6:原复习关的题保留成简单题,id 一字不改', () => {
    const legacy = [
      'u1-52', 'u2-54', 'u3-55', 'u4-58', 'u5-52', 'u6-52',
      'u7-51', 'u8-52', 'u9-57', 'u10-53', 'u11-56', 'u12-50',
    ]
    const ids = new Set(UNITS.flatMap((u) => u.levels.map((level) => level.id)))
    for (const id of legacy) expect(ids.has(id), `原复习关 ${id} 不见了`).toBe(true)
  })

  // 简单题 / 困难题的划分由 `stage` 一个字部分决定,两个派生视图合起来必须正好是全表 ——
  // 派生视图漏掉一类(比如 hardLevelsOf 忘了过滤)在 UI 上就是「有些题永远走不到」。
  it('G6b:简单题与困难题互补,合起来等于全表', () => {
    for (const u of UNITS) {
      const easy = easyLevelsOf(u)
      const hard = hardLevelsOf(u)
      expect(easy.length + hard.length, `${u.id} 两部分题数之和`).toBe(u.levels.length)
      expect(easy.some((level) => level.stage === 'hard'), `${u.id} 简单部分混进了困难题`).toBe(false)
      expect(hard.every((level) => level.stage === 'hard'), `${u.id} 困难部分混进了简单题`).toBe(true)
      // 顺序:简单部分全在前、困难部分全在后(索引必须单调)—— 部分内「逐题往下走」直接吃这个顺序。
      const lastEasy = u.levels.findLastIndex((level) => level.stage !== 'hard')
      const firstHard = u.levels.findIndex((level) => level.stage === 'hard')
      if (firstHard >= 0) expect(lastEasy, `${u.id} 简单题与困难题交错了`).toBeLessThan(firstHard)
    }
  })

  // spec §3.7「总数上限 4」优先:某一类的槽 ≥ 4 时,那道小题只留正解、不加错块
  //(`room = max(0, REVIEW_TRAY_CAP - 空槽数)` 归零)。课程数据保证这句话今天打不到 ——
  // 每关同一类型最多 3 个槽 ⇒ room ≥ 1 恒成立(今天实际的最大值是 2:多音节关的两个韵母槽/两个声调槽)。
  // 这里的 3 是 spec 那条「room ≥ 1」的边界,不是今天的数据快照 —— 故意不收紧到 2:
  // 三音节词(某类型 3 个槽 ⇒ room = 1)仍然合法。
  // 锁的是「打不到」这个事实,让那个兜底保持**防御**而不是悄悄变成常规路径;
  // 扩课程(比如加四音节词)时它会先红,提醒回去把 §3.7 那句话重读一遍。
  it('每关同一类型的槽最多 3 个(复习小题恒有 ≥1 个错解名额)', () => {
    for (const entry of allLevels) {
      const counts = new Map<BlockType, number>()
      for (const slot of slotsFor(entry.level)) {
        counts.set(slot.type, (counts.get(slot.type) ?? 0) + 1)
      }
      for (const [type, n] of counts) {
        expect(n, `${where(entry)} 有 ${n} 个 ${type} 槽(上限 3)`).toBeLessThanOrEqual(3)
      }
    }
  })

  // spec §3.3 的硬约束:课程最前只有 a o e i u 五个韵母可用(复韵母到 u5、鼻尾到 u6/u7 才教)。
  // 派生池兜得住「不出现没教过的块」,兜不住「孩子还没学到那个韵母就先用了它」——
  // 池是按单元**累积**的,累积到哪一单元为止才决定孩子见没见过。
  it('u1–u4 的例字只用单韵母,不带鼻尾', () => {
    for (const unit of UNITS.filter((u) => ['u1', 'u2', 'u3', 'u4'].includes(u.id))) {
      for (const level of unit.levels) {
        for (const syl of level.syl) {
          expect(FINAL_BASIC, `${level.id} 用了 ${syl.final}`).toContain(syl.final)
          expect(syl.nasal, `${level.id} 用了鼻尾 ${syl.nasal}`).toBeUndefined()
        }
      }
    }
  })
})
