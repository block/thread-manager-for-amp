import { useEffect, useState, useCallback } from 'react';
import { LoadingSteps, type LoadingState } from './LoadingSteps';
import { completeAllSteps } from '../utils/loadingState';

interface LoadingToastProps {
  state: LoadingState | null;
  onComplete?: () => void;
}

type AnimationPhase = 'completing' | 'exiting' | null;

export function LoadingToast({ state, onComplete }: LoadingToastProps) {
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>(null);
  const [savedState, setSavedState] = useState<LoadingState | null>(null);
  const [prevState, setPrevState] = useState<LoadingState | null>(null);

  const stateJustCleared = prevState !== null && state === null && animationPhase === null;

  useEffect(() => {
    setPrevState(state);
  }, [state]);

  useEffect(() => {
    if (stateJustCleared) {
      setSavedState(prevState);
      setAnimationPhase('completing');
    }
  }, [stateJustCleared, prevState]);

  const handleCompletingDone = useCallback(() => {
    setAnimationPhase('exiting');
  }, []);

  const handleExitingDone = useCallback(() => {
    setAnimationPhase(null);
    setSavedState(null);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (animationPhase === 'completing') {
      const timer = setTimeout(handleCompletingDone, 600);
      return () => clearTimeout(timer);
    }
    if (animationPhase === 'exiting') {
      const timer = setTimeout(handleExitingDone, 200);
      return () => clearTimeout(timer);
    }
  }, [animationPhase, handleCompletingDone, handleExitingDone]);

  if (state) {
    return (
      <div className="loading-toast" aria-live="polite" role="status">
        <LoadingSteps state={state} />
      </div>
    );
  }

  if (animationPhase && savedState) {
    return (
      <div className={`loading-toast ${animationPhase === 'exiting' ? 'exiting' : ''}`} aria-live="polite" role="status">
        <LoadingSteps state={completeAllSteps(savedState)} />
      </div>
    );
  }

  return null;
}
