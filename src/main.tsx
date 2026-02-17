import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UnreadProvider } from './contexts/UnreadContext'
import { ThreadStatusProvider } from './contexts/ThreadStatusContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { ModalProvider } from './contexts/ModalContext'
import { ThreadProvider } from './contexts/ThreadContext'
import { useThreads } from './hooks/useThreads'
import { useThreadMetadata } from './hooks/useThreadMetadata'
import './index.css'
import App from './App.tsx'

// eslint-disable-next-line react-refresh/only-export-components -- internal wrapper component for provider composition
function DataLayer({ children }: { children: ReactNode }) {
  const { threads, loading, error, refetch, removeThread } = useThreads();
  const { metadata, updateStatus, addBlocker, removeBlocker } = useThreadMetadata();

  return (
    <ThreadProvider
      threads={threads}
      refetch={refetch}
      removeThread={removeThread}
      updateStatus={updateStatus}
      addBlocker={addBlocker}
      removeBlocker={removeBlocker}
      metadata={metadata}
      loading={loading}
      error={error}
    >
      {children}
    </ThreadProvider>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- standard React root mounting pattern
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SettingsProvider>
        <DataLayer>
          <ModalProvider>
            <ThreadStatusProvider>
              <UnreadProvider>
                <App />
              </UnreadProvider>
            </ThreadStatusProvider>
          </ModalProvider>
        </DataLayer>
      </SettingsProvider>
    </ErrorBoundary>
  </StrictMode>,
)
