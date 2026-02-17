import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UnreadProvider } from './contexts/UnreadContext'
import { ThreadStatusProvider } from './contexts/ThreadStatusContext'
import './index.css'
import App from './App.tsx'

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- standard React root mounting pattern
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
