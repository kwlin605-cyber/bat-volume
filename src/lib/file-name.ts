/** Presentation only: retain the source filename for storage, identity and sorting. */
export const displayFileName = (name: string) => name.replace(/\.anc$/i, '') || name

export const displayFileLabel = (name: string, source?: string) => `${displayFileName(name)}${source ? ` ${source}` : ''}`
