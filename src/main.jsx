import React from 'react' // <--- ADD THIS LINE
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext' // Import Provider

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Dynamically use the base path from Vite config
    const basePath = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${basePath}sw.js`, { scope: basePath })
      .then(reg => console.log('InsightEd PWA Registered at:', reg.scope))
      .catch(err => console.error('PWA Registration Failed:', err));
  });
}