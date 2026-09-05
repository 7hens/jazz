import { describe, expect, it } from 'vitest'

// 生产源码快照(src 下全部 .ts/.tsx,惰性读原文,不执行)。仅扫描 3 层目录内文件。
const rawFiles = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as unknown as Record<string, string>

/**
 * 3 层架构铁律:
 *  - shared(类型/契约/纯逻辑/中性基础件 ui)不得 import features|app;
 *  - features 内部互相独立:不得 import 其它 feature 或 app;
 *  - 跨 feature 纯规则一律放 shared,组件跨 feature 只在 app 组装;
 *  - useService 仅限页面入口(features/<f>/<Name>Entry.tsx)与 app 组装层;
 *  - 生产注册唯一入口 = app/bootstrap.ts(测试用 fake 自行 register + clear)。
 */

function resolveSpecifier(spec: string, fromFile: string): string[] | null {
  if (spec.startsWith('@/')) return spec.slice(2).split('/')
  if (!spec.startsWith('.')) return null // 外部 npm 包,不参与边界
  const segs = [...fromFile.split('/').slice(0, -1), ...spec.split('/')]
  const out: string[] = []
  for (const s of segs) {
    if (s === '' || s === '.') continue
    if (s === '..') out.pop()
    else out.push(s)
  }
  return out
}

function layerOf(segs: string[] | null): string {
  if (!segs) return ''
  const [root, child] = segs
  if (root === 'shared' || root === 'app') return root
  if (root === 'features') return `features/${child ?? ''}`
  return '' // 解析出 src 边界外,按外部忽略
}

describe('architecture 边界', () => {
  it('features 不得 import 其它 feature', () => {
    const cross: string[] = []
    for (const [key, content] of Object.entries(rawFiles)) {
      const file = key.replace(/^\.\//, '')
      if (!file.startsWith('features/') || file.includes('.test.')) continue
      const layer = layerOf(file.split('/'))
      for (const spec of collectSpecifiers(content)) {
        const target = layerOf(resolveSpecifier(spec, file))
        if (target.startsWith('features/') && target !== layer) cross.push(`${file} → ${spec} (${target})`)
      }
    }
    expect(cross).toEqual([])
  })

  it('features 不得 import app', () => {
    const toApp: string[] = []
    for (const [key, content] of Object.entries(rawFiles)) {
      const file = key.replace(/^\.\//, '')
      if (!file.startsWith('features/') || file.includes('.test.')) continue
      for (const spec of collectSpecifiers(content)) {
        const target = layerOf(resolveSpecifier(spec, file))
        if (target === 'app') toApp.push(`${file} → ${spec} (app)`)
      }
    }
    expect(toApp).toEqual([])
  })

  it('shared 不得 import 上层(features|app)', () => {
    const bad: string[] = []
    for (const [key, content] of Object.entries(rawFiles)) {
      const file = key.replace(/^\.\//, '')
      if (!file.startsWith('shared/') || file.includes('.test.')) continue
      for (const spec of collectSpecifiers(content)) {
        const target = layerOf(resolveSpecifier(spec, file))
        if (target.startsWith('features/') || target === 'app') bad.push(`${file} → ${spec} (${target})`)
      }
    }
    expect(bad).toEqual([])
  })

  it('features 内 useService 只允许出现在页面入口 <Name>Entry.tsx', () => {
    const bad: string[] = []
    for (const [key, content] of Object.entries(rawFiles)) {
      const file = key.replace(/^\.\//, '')
      if (!file.startsWith('features/') || file.includes('.test.')) continue
      if (/Entry\.tsx$/.test(file)) continue
      if (/\buseService\(/.test(content)) bad.push(file)
    }
    expect(bad).toEqual([])
  })

  it('registry.register 唯一生产注册点 = app/bootstrap.ts', () => {
    const bad: string[] = []
    for (const [key, content] of Object.entries(rawFiles)) {
      const file = key.replace(/^\.\//, '')
      if (file.includes('.test.')) continue
      if (file === 'app/bootstrap.ts') continue
      if (/\bregistry\.register\(/.test(content)) bad.push(file)
    }
    expect(bad).toEqual([])
  })
})

function collectSpecifiers(content: string): string[] {
  const specs = new Set<string>()
  for (const m of content.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) specs.add(m[1])
  for (const m of content.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) specs.add(m[1])
  return [...specs]
}
