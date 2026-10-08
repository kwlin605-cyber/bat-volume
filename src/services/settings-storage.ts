/** Small storage boundary shared by independent browser preferences. */
export interface SettingsStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
