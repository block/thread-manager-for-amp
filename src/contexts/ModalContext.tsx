import { createContext, useContext, type ReactNode } from 'react';
import { useModals, type UseModalsReturn } from '../hooks/useModals';

const ModalContext = createContext<UseModalsReturn | null>(null);

export interface ModalProviderProps {
  children: ReactNode;
}

export function ModalProvider({ children }: ModalProviderProps) {
  const modals = useModals();

  return (
    <ModalContext.Provider value={modals}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModalContext(): UseModalsReturn {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return context;
}

export type { OutputModalState, ShellTerminalState, InputModalState, ConfirmModalState, UseModalsReturn } from '../hooks/useModals';
