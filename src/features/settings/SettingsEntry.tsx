import { ProgressRulesService, SettingsService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import type { UserSettings } from '@/shared/services'
import { SettingsPanel } from './SettingsPanel'

export type SettingsEntryProps = {
  onClose: () => void
}

export function SettingsEntry({ onClose }: SettingsEntryProps) {
  const settingsService = useService(SettingsService)
  const rules = useService(ProgressRulesService)
  const snapshot = useServiceSnapshot(settingsService)
  const settings = snapshot.data

  function change(next: UserSettings) {
    void settingsService.save(next)
  }

  return (
    <SettingsPanel
      settings={settings}
      skillOrder={rules.skillOrder()}
      onChange={change}
      onClose={onClose}
    />
  )
}
