import type { FileOrigin } from '../services/file-origin'
import { text } from '../i18n/zh-TW'

export const sourceLabel = (origin?: FileOrigin) => origin?.kind === 'preset' ? origin.label : origin?.kind === 'upload' ? text.uploadedSource : text.unknownSource
