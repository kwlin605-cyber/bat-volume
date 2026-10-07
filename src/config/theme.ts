/** Shared grayscale palette for the screen and printable reports. */
export const palette = {
  ink: '#262626', text: '#404040', muted: '#666666', subtle: '#858585',
  border: '#c8c8c8', line: '#e5e5e5', surface: '#fafafa', header: '#f5f5f5',
  emphasis: '#f1f1f1', emphasisAlt: '#ececec', hover: '#f3f3f3', emphasisHover: '#e4e4e4',
  accent: '#333333', accentHover: '#1f1f1f', white: '#ffffff',
} as const
export const excelColor = (color: string) => `FF${color.slice(1).toUpperCase()}`
