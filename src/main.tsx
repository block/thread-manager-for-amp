import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UnreadProvider } from './contexts/UnreadContext'
import { ThreadStatusProvider } from './contexts/ThreadStatusContext'
import { SettingsProvider } from './contexts/SettingsContext'
import './index.css'
import App from './App.tsx'

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- standard React root mounting pattern
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SettingsProvider>
        <ThreadStatusProvider>
          <UnreadProvider>
            <App />
          </UnreadProvider>
        </ThreadStatusProvider>
      </SettingsProvider>
    </ErrorBoundary>
  </StrictMode>,
)
