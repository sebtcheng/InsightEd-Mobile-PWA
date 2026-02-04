import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { ServiceWorkerProvider } from './context/ServiceWorkerContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ServiceWorkerProvider>
        <App />
      </ServiceWorkerProvider>
    </ThemeProvider>
  </StrictMode>,
)