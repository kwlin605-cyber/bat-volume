export type FileOrigin = { kind: 'upload' } | { kind: 'preset'; id: string; label: string }
export type PresetOrigin = Extract<FileOrigin, { kind: 'preset' }>
