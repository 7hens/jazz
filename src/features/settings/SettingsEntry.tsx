import { useService } from '@/shared/useService'
import { useServiceSnapshot } from '@/shared/useServiceSnapshot'
import type { UserSettings } from '@/shared/types'
import { SettingsPanel } from './SettingsPanel'

export type SettingsEntryProps = {
  onClose: () => void
}

export function SettingsEntry({ onClose }: SettingsEntryProps) {
  const settingsService = useService('settings-state')
  const snapshot = useServiceSnapshot(settingsService)
  const settings = snapshot.data

  function change(next: UserSettings) {
    void settingsService.save(next)
  }

  return <SettingsPanel settings={settings} onChange={change} onClose={onClose} />
}
