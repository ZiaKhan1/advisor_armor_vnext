import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './app.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Renderer root element not found')
}

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (error) {
  console.error('Renderer bootstrap failed', error)
  rootElement.innerHTML = `
    <div style="padding:24px;font-family:Segoe UI,sans-serif">
      <h1>AdvisorArmor failed to render</h1>
      <pre style="white-space:pre-wrap">${String(error)}</pre>
    </div>
  `
}
