import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UnreadProvider } from './contexts/UnreadContext'
import { ThreadStatusProvider } from './contexts/ThreadStatusContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThreadStatusProvider>
        <UnreadProvider>
          <App />
        </UnreadProvider>
      </ThreadStatusProvider>
    </ErrorBoundary>
  </StrictMode>,
)
