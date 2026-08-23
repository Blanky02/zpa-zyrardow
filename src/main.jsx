import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { CssBaseline } from '@mui/material'
import { registerSW } from 'virtual:pwa-register'

// vite-plugin-pwa – auto update
registerSW({
  onNeedRefresh() {
    // Dispatch event for App.jsx to show banner
    window.dispatchEvent(new Event('pwa-update-available'))
    console.log('[PWA] new version available, ready to update')
  },
  onOfflineReady() {
    console.log('[PWA] offline ready')
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CssBaseline />
    <App />
  </React.StrictMode>,
)
