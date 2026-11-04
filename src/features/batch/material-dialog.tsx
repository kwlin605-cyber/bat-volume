import type { ReactNode } from 'react'
import { text } from '../../i18n/zh-TW'
import { MaterialSettingsForm, type MaterialSettingsFormProps } from './material-settings-form'
import { SettingsDialog } from './settings-dialog'

export function MaterialDialog({ unitPreferences, ...props }: MaterialSettingsFormProps & { unitPreferences?: ReactNode }) {
  return (
    <SettingsDialog title={unitPreferences ? text.settings : text.materialSettings} onDismiss={props.onDismiss}
      secondaryPage={unitPreferences ? { primaryLabel: text.materialSettings, label: text.displayUnits, content: unitPreferences } : undefined}>
      <MaterialSettingsForm {...props} />
    </SettingsDialog>
  )
}
