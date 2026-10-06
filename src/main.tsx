import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { text } from './i18n/zh-TW'
import './styles.css'

document.title = text.pageTitle
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
