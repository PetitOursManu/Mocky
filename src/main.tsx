import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { applyTheme, loadTheme } from './lib/theme'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initLang } from './i18n'

// Apply the saved theme before first paint to avoid a flash. (index.html also
// does this inline, earlier still — this keeps the React state in agreement.)
applyTheme(loadTheme())

// Sets <html lang> too, which drives screen-reader pronunciation and hyphenation.
initLang()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Last resort: without a boundary here, any render error unmounted the whole
        tree and left a blank page with no way back. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
