import { useState, useCallback } from 'react';
import type { ErrorToastMessage } from '../components/ErrorToast';

let nextId = 0;

export function useErrorToast() {
  const [errors, setErrors] = useState<ErrorToastMessage[]>([]);

  const showError = useCallback((message: string) => {
    const id = `error-${++nextId}`;
    setErrors(prev => [...prev, { id, message }]);
  }, []);

  const dismissError = useCallback((id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  }, []);

  return { errors, showError, dismissError };
}
