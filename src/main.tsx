import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { text } from './i18n/zh-TW'
import { themeCssVariables } from './config/theme'
import './styles.css'

document.title = text.pageTitle
Object.entries(themeCssVariables).forEach(([key, value]) => document.documentElement.style.setProperty(key, value))
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
