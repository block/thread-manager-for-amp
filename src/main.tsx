import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UnreadProvider } from './contexts/UnreadContext';
import { ThreadStatusProvider } from './contexts/ThreadStatusContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ModalProvider, useModalContext } from './contexts/ModalContext';
import { ThreadProvider } from './contexts/ThreadContext';
import { useThreads } from './hooks/useThreads';
import { useThreadMetadata } from './hooks/useThreadMetadata';
import { useErrorToast } from './hooks/useErrorToast';
import { ErrorToast } from './components/ErrorToast';
import './index.css';
import App from './App.tsx';

// eslint-disable-next-line react-refresh/only-export-components -- internal wrapper component for provider composition
function DataLayer({ children }: { children: ReactNode }) {
  const { threads, loading, error, refetch, removeThread } = useThreads();
  const { metadata, updateStatus, addBlocker, removeBlocker } = useThreadMetadata();
  const modals = useModalContext();
  const { errors, showError, dismissError } = useErrorToast();

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
      showError={showError}
      showInputModal={modals.setInputModal}
      showConfirmModal={modals.setConfirmModal}
    >
      {children}
      <ErrorToast errors={errors} onDismiss={dismissError} />
    </ThreadProvider>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- standard React root mounting pattern
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SettingsProvider>
        <ModalProvider>
          <DataLayer>
            <ThreadStatusProvider>
              <UnreadProvider>
                <App />
              </UnreadProvider>
            </ThreadStatusProvider>
          </DataLayer>
        </ModalProvider>
      </SettingsProvider>
    </ErrorBoundary>
  </StrictMode>,
);
