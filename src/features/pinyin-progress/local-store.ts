import type { LevelStars, PinyinProgressData } from '@/shared/services'

/**
 * 进度在浏览器侧的兜底副本。用途只有一个:**服务端那份丢了也能自己长回来**。
 *
 * 键带版本号:形状变了就换键,老键自然失配被忽略,不需要为它写迁移。
 */
export const LOCAL_PROGRESS_KEY = 'jazz.pinyin-progress.v1'

/**
 * 浏览器那份 localStorage,不可用就是 null。
 *
 * 取不到有三种情形,都当「没有副本」处理:没有 window(非浏览器)、隐私模式下连取这个属性
 * 都会抛、以及**属性本身就是 undefined** —— 后者不是假想:本仓的 Vitest 环境里 jsdom 裸用
 * 是有 localStorage 的,但跑在 vitest 下 `window.localStorage` 实测是 undefined
 * (Node 26 自带同名全局,与 jsdom 的属性打架被盖掉)。测试因此一律走 storage 注入,
 * 不靠环境。
 */
export function localProgressStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : (window.localStorage ?? null)
  } catch {
    return null
  }
}

/**
 * 与 worker `readStars` / `levels.test.ts` 同一套关 id(各端各留字面量,不跨端 import)。
 *
 * 这条**必须**一起严格:副本里多留一个服务端会拒的键,之后每一次 PUT(通关、通关失败后的
 * 重试、载入自愈)都会被 400 打回来 —— 副本自己变成了毒药,而且坏在很远的地方。
 * 星级上界 3 同理,是玩法事实(见 rules.ts);口径变了就换键版本。
 *
 * 末尾 `h?` = 困难部分的题(91 道,id = 简单题 id + 'h');漏了它这一条会**静默**把副本判废
 * (整个 parseLocalProgress 返 null),兜底副本就再也不写了 —— 与 worker 那次 400 是同一个根因。
 */
const LEVEL_ID = /^u\d+-\d+h?$/

/** 同 worker `MAX_TOTAL_STARS`(纯防呆)。漏掉这条,副本里的天文数字会把每一次 PUT 打成 400。 */
const MAX_TOTAL_STARS = 1_000_000

function isLevelStars(value: unknown): value is LevelStars {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.entries(value).every(
    ([levelId, stars]) =>
      LEVEL_ID.test(levelId) && typeof stars === 'number' && Number.isInteger(stars) && stars >= 1 && stars <= 3,
  )
}

/**
 * 解析本地副本。存的东西一律当**不可信输入**看待:坏了、被别的版本写过、被人手改过,
 * 都只该退化成 null(当没这份副本),绝不该把脏数据带进游戏。
 */
export function parseLocalProgress(raw: string | null): PinyinProgressData | null {
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const { stars, totalStars } = parsed as { stars?: unknown; totalStars?: unknown }
  if (!isLevelStars(stars)) return null
  // 整数 + 非负 + 上限,与 worker `handlePutPinyinProgress` 的入参校验一字不差:副本必须
  // **处处**是服务端肯收的形状,否则它会把之后每一次 PUT 都变成 400。
  if (
    typeof totalStars !== 'number'
    || !Number.isInteger(totalStars)
    || totalStars < 0
    || totalStars > MAX_TOTAL_STARS
  ) return null

  // 显式只取这两个字段:副本里多出来的东西不进游戏。
  return { stars, totalStars }
}

export function readLocalProgress(storage: Storage | null = localProgressStorage()): PinyinProgressData | null {
  try {
    return parseLocalProgress(storage?.getItem(LOCAL_PROGRESS_KEY) ?? null)
  } catch {
    return null
  }
}

export function writeLocalProgress(data: PinyinProgressData, storage: Storage | null = localProgressStorage()): void {
  try {
    const payload = JSON.stringify({ stars: data.stars, totalStars: data.totalStars })
    // 只写「自己读得回来」的东西。类型上 data 已经是 PinyinProgressData,但它的来源里有
    // 一份我们控制不了的服务端响应 —— 服务端那条记录被手改成天文数字时,写下去就是留毒。
    // 宁可这次不写(留着旧副本),也不留一份会把之后每一次 PUT 变成 400 的副本。
    if (parseLocalProgress(payload) === null) return
    storage?.setItem(LOCAL_PROGRESS_KEY, payload)
  } catch {
    // 配额满 / 被禁用:兜底副本是加分项,写不进去不该影响游戏本身。
  }
}

export function clearLocalProgress(storage: Storage | null = localProgressStorage()): void {
  try {
    storage?.removeItem(LOCAL_PROGRESS_KEY)
  } catch {
    // 同上:清不掉也不能把重置这件事变成失败。
  }
}
