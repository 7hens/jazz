import { DOMAIN_ORDER, SettingsService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import type { UserSettings } from '@/shared/services'
import { SettingsPanel } from './SettingsPanel'

export type SettingsEntryProps = { onClose: () => void }

export function SettingsEntry({ onClose }: SettingsEntryProps) {
  const settingsService = useService(SettingsService)
  const snapshot = useServiceSnapshot(settingsService)
  const settings = snapshot.data

  function change(next: UserSettings) {
    void settingsService.save(next)
  }

  return (
    <SettingsPanel
      settings={settings}
      domainOrder={DOMAIN_ORDER}
      onChange={change}
      onClose={onClose}
    />
  )
}
