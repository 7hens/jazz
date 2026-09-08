# 千字谷 ch1 · P2 speech 角色层实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给语音服务加**角色分音色朗读** `speakRole(text, role)`(灵灵/太阳/月亮/静默/旁白/居民,各自 rate/pitch),并保证既有 `speak(text, lang?)` 契约与全部调用点(词课/短教/冷启动/quiz 组件)零破坏。

**Architecture:** 契约类型与 token 落 `src/shared/services/speech.ts`(qianzigu 后续数据/引擎只引 shared,不跨 feature);角色→{rate,pitch} 映射与发音实现落 `src/features/speech/speech.ts`,复用既有 voice 缓存/防掐头/排队/暖机。`speak` 保持 `rate 0.9` 固定路径,新开 `speakRole` 独立携带 rate/pitch,二者共享内部发音原语。

**Tech Stack:** TypeScript + vitest(fake SpeechSynthesis)。

**Spec:** `docs/superpowers/specs/2026-09-08-qianzigu-ch1-design.md` §3.6(语音层/角色配置表、不引入音频资产、静音降级)。executor 读 spec + 本 plan。

## Global Constraints

- 全角色 zh-CN 语音,仅 rate/pitch 不同(数值照 spec §3.6):
  `lingling {rate:.75,pitch:1.2}` / `sun {rate:.65,pitch:.8}` / `moon {rate:.7,pitch:1}` / `jingmo {rate:.6,pitch:.5}` / `narrator {rate:.8,pitch:1}` / `villager {rate:.8,pitch:1}`。
- 不引入 TTS 音频资产;无 Web Speech 时 `speakRole` 返回 `false`,UI 侧降级(加大字/emoji)。
- 不改 `SpeechService.speak(text, lang?)` 语义与签名;既有调用零改动。
- 3 层纪律:shared 文件不得 import feature/app;role 映射属 features/speech(实现),role 联合类型属 shared(契约)。

---

### Task 1: shared 契约加 SpeechRole 与 speakRole

**Files:**
- Modify: `src/shared/services/speech.ts`
- Modify: `src/shared/services/index.ts`

**Interfaces:**
- Consumes: 无。
- Produces(后续 qianzigu 引用):
  - `export type SpeechRole = 'lingling'|'sun'|'moon'|'jingmo'|'narrator'|'villager'`
  - `export type SpeakRoleOptions = { rate?: number; pitch?: number }`
  - `SpeechService` 增加:`speakRole(text: string, role: SpeechRole, opts?: SpeakRoleOptions): boolean`
  - 经 `src/shared/services/index.ts` 导出类型 `SpeechRole`/`SpeakRoleOptions`(barrel 加两行 `export type`)。

- [ ] **Step 1: 写失败测试(契约编译)**

新建 `src/shared/services/speech.contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { SpeechRole } from './speech'

describe('speech 契约', () => {
  it('SpeechRole 六角色字面量合法', () => {
    const roles: SpeechRole[] = ['lingling', 'sun', 'moon', 'jingmo', 'narrator', 'villager']
    expect(roles).toHaveLength(6)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/shared/services/speech.contract.test.ts`
Expected: FAIL(SpeechRole 不存在)。

- [ ] **Step 3: 改 `src/shared/services/speech.ts`**

```ts
import type { ServiceToken } from './core'

/** 千字谷台词角色(各角色有独立语速/音高配置)。 */
export type SpeechRole = 'lingling' | 'sun' | 'moon' | 'jingmo' | 'narrator' | 'villager'

/** speakRole 可选覆盖(rate/pitch 缺省按角色映射表)。 */
export type SpeakRoleOptions = { rate?: number; pitch?: number }

export interface SpeechService {
  speak(text: string, lang?: string): boolean
  speakRole(text: string, role: SpeechRole, opts?: SpeakRoleOptions): boolean
  stop(): void
}

export const SpeechService = Symbol('SpeechService') as unknown as ServiceToken<SpeechService>
```

- [ ] **Step 4: barrel 导出**

`src/shared/services/index.ts` 的 speech 行改为:

```ts
export type { SpeakRoleOptions, SpeechRole } from './speech'
export { SpeechService } from './speech'
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/shared/services/speech.contract.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/speech.ts src/shared/services/speech.contract.test.ts src/shared/services/index.ts
git commit -m "feat(speech): shared 契约加 SpeechRole/speakRole"
```

---

### Task 2: createSpeechService 实现 speakRole(角色配置 + 发音原语复用)

**Files:**
- Modify: `src/features/speech/speech.ts`
- Test: `src/features/speech/speech.test.ts`(追加用例)

**Interfaces:**
- Consumes: `SpeechRole`/`SpeakRoleOptions`(Task 1 shared)。
- Produces: `createSpeechService(...)` 返回对象含 `speakRole(text, role, opts?)`,内部把 rate/pitch 应用到 utterance;角色映射常量 `SPEECH_ROLE_VOICE`(实现文件内,非导出必需)。

- [ ] **Step 1: 写失败测试**

在 `src/features/speech/speech.test.ts` 追加(先确认现文件尾部 `describe` 块可容纳):

```ts
describe('speakRole', () => {
  it('按角色映射应用语速与音高', () => {
    const synthesis = {
      getVoices: () => [voice('cmn', 'Mandarin')],
      speaking: false,
      cancel: vi.fn(),
      speak: vi.fn(),
    } as unknown as SpeechSynthesis
    const utterances: SpeechSynthesisUtterance[] = []
    const service = createSpeechService(
      synthesis,
      () => {
        const u = {} as SpeechSynthesisUtterance
        utterances.push(u)
        return u
      },
      { eventTarget: null },
    )

    expect(service.speakRole('早上好', 'jingmo')).toBe(true)
    expect(utterances[0]).toMatchObject({ rate: 0.6, pitch: 0.5, lang: 'zh-CN' })

    expect(service.speakRole('太棒了', 'lingling')).toBe(true)
    expect(utterances[1]).toMatchObject({ rate: 0.75, pitch: 1.2 })
  })

  it('opts 可覆盖角色默认语速/音高', () => {
    const synthesis = {
      getVoices: () => [voice('cmn', 'Mandarin')],
      speaking: false,
      cancel: vi.fn(),
      speak: vi.fn(),
    } as unknown as SpeechSynthesis
    const utterances: SpeechSynthesisUtterance[] = []
    const service = createSpeechService(
      synthesis,
      () => {
        const u = {} as SpeechSynthesisUtterance
        utterances.push(u)
        return u
      },
      { eventTarget: null },
    )
    service.speakRole('太阳', 'sun', { rate: 1, pitch: 1.1 })
    expect(utterances[0]).toMatchObject({ rate: 1, pitch: 1.1 })
  })

  it('无引擎时返回 false(UI 走降级)', () => {
    const service = createSpeechService(null, null, { eventTarget: null })
    expect(service.speakRole('你好', 'lingling')).toBe(false)
  })

  it('角色未匹配 voice 时并入队列,voice 就绪后带角色配置补播', () => {
    const cancel = vi.fn()
    let voices: SpeechSynthesisVoice[] = []
    const speak = vi.fn()
    const synthesis = {
      getVoices: () => voices,
      speaking: false,
      cancel,
      speak,
      addEventListener: vi.fn((type: string, cb: () => void) => {
        if (type === 'voiceschanged') pendingVoices = cb
      }),
    } as unknown as SpeechSynthesis
    let pendingVoices: (() => void) | null = null
    const utterances: SpeechSynthesisUtterance[] = []
    const service = createSpeechService(
      synthesis,
      () => {
        const u = {} as SpeechSynthesisUtterance
        utterances.push(u)
        return u
      },
      { eventTarget: null },
    )

    expect(service.speakRole('月亮', 'moon')).toBe(true) // 无 voice → 入队
    voices = [voice('cmn', 'Mandarin')]
    pendingVoices?.()
    const last = utterances[utterances.length - 1]
    expect(last).toMatchObject({ rate: 0.7, pitch: 1 })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/speech/speech.test.ts`
Expected: FAIL(`speakRole` is not a function)。

- [ ] **Step 3: 改 `src/features/speech/speech.ts`**

要点:内部 `play`/`attempt`/`flushQueued` 增加 rate/pitch 透传;队列项含 rate/pitch;`speak` 固定 `{rate:0.9, pitch:undefined}` 走原路径;`speakRole` 查映射再进同原语。整文件改后关键片段:

```ts
import type { SpeakRoleOptions, SpeechRole, SpeechService } from '@/shared/services'

// 角色 → {rate,pitch}(spec §3.6 数值)。
const SPEECH_ROLE_VOICE: Record<SpeechRole, { rate: number; pitch: number }> = {
  lingling: { rate: 0.75, pitch: 1.2 },
  sun: { rate: 0.65, pitch: 0.8 },
  moon: { rate: 0.7, pitch: 1 },
  jingmo: { rate: 0.6, pitch: 0.5 },
  narrator: { rate: 0.8, pitch: 1 },
  villager: { rate: 0.8, pitch: 1 },
}
```

内部原语改为携带语速/音高:

```ts
  type QueueItem = { text: string; language: string; rate: number; pitch?: number }
  let queued: QueueItem | null = null

  function play(text: string, language: string, voice: SpeechSynthesisVoice | null, rate: number, pitch?: number): void {
    const s = synthesis!
    const mk = createUtterance!
    const utterance = mk(text)
    utterance.rate = rate
    if (pitch !== undefined) utterance.pitch = pitch
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = normalizedLanguage(language)
    }
    const mine = ++token
    if (s.speaking || deferId !== null) {
      s.cancel()
      if (deferId !== null) clearTimeout(deferId)
      deferId = setTimeout(() => {
        deferId = null
        if (token === mine) s.speak(utterance)
      }, HEAD_PROTECT_MS)
    } else {
      s.speak(utterance)
    }
  }

  function attempt(text: string, language: string, rate: number, pitch?: number): boolean {
    const voices = refresh()
    const voice = findVoice(voices, language)
    if (voice || voices.length > 0) {
      queued = null
      play(text, language, voice, rate, pitch)
      return true
    }
    if (canWaitForVoices) {
      queued = { text, language, rate, pitch }
      return true
    }
    return false
  }

  function flushQueued(): void {
    if (!queued) return
    const { text, language, rate, pitch } = queued
    const voices = refresh()
    const voice = findVoice(voices, language)
    if (voice || voices.length > 0) {
      queued = null
      play(text, language, voice, rate, pitch)
    }
  }
```

`primeEngine` 固定 `utterance.rate = 0.9` 不变。服务对象改为:

```ts
  const service: SpeechService = {
    speak(text, language = 'zh-CN') {
      if (!synthesis || !createUtterance) return false
      return attempt(text, language, 0.9)
    },
    speakRole(text, role, opts) {
      if (!synthesis || !createUtterance) return false
      const base = SPEECH_ROLE_VOICE[role]
      const rate = opts?.rate ?? base.rate
      const pitch = opts?.pitch ?? base.pitch
      return attempt(text, 'zh-CN', rate, pitch)
    },
    stop() {
      token++
      if (deferId !== null) {
        clearTimeout(deferId)
        deferId = null
      }
      queued = null
      synthesis?.cancel()
    },
  }
```

(注意:现文件 `attempt`/`play`/`flushQueued`/`queued` 类型与调用逐一对齐;`voiced` 逻辑不动;`ut()` 既有测试如断言 `rate:0.9` 应保持通过。)

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/speech/speech.test.ts`
Expected: 全 PASS(新 4 用例 + 既有 speak 用例不回归)。

- [ ] **Step 5: 全量回归 + 架构边界**

Run: `npm test`
Expected: 全绿。另确认 `architecture.test.ts` 未被破坏(features/speech 仍只引 shared)。

- [ ] **Step 6: Commit**

```bash
git add src/features/speech/speech.ts src/features/speech/speech.test.ts
git commit -m "feat(speech): 实现 speakRole 角色分音色朗读"
```

---

## Self-Review

**Spec 覆盖:** §3.6 `SpeechRole`/`SPEECH_ROLE_VOICE`/`speakRole` 数值照抄;静音降级→返回 false 路径;不引入音频资产 ✓;共用既有队列/防掐头/暖机(复用 `play`/`attempt`/`flushQueued`/`primeEngine`)✓;`speak(text,lang?)` 语义不变、调用点(LessonEntry/quiz/foundation/ColdStartWizard)零改动 ✓。

**占位扫描:** 无 TBD;角色映射数值与 spec §3.6 逐一一致。

**类型一致性:** Task1 定义的 `SpeechRole`/`SpeakRoleOptions`/`SpeechService.speakRole` 与 Task2 实现/测试签名一致;barrel 导出已加。
