import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { text } from './i18n/zh-TW'
import { palette } from './config/theme'
import './styles.css'

document.title = text.pageTitle
Object.entries(palette).forEach(([key, value]) => document.documentElement.style.setProperty(`--color-${key}`, value))
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
