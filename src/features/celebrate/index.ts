import { registry } from '@/shared/registry'
import type { CelebrateLevel } from '@/shared/services'

export { createCelebrateService } from './celebrate'

// Compatibility for current lesson/reward components; Tasks 9 and 10 replace it with composition callbacks.
export function celebrate(level: CelebrateLevel): void {
  registry.get('celebrate').play(level)
}
