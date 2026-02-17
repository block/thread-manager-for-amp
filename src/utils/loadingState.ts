import type { LoadingState, StepStatus } from '../components/LoadingSteps';

export type { LoadingState, StepStatus } from '../components/LoadingSteps';

export function createLoadingState(title: string, stepLabels: string[]): LoadingState {
  return {
    title,
    steps: stepLabels.map((label, i) => ({
      label,
      status: i === 0 ? 'running' : 'pending',
    })),
    currentStepIndex: 0,
  };
}

export function advanceStep(state: LoadingState): LoadingState {
  const newSteps = [...state.steps];
  const currentStep = newSteps[state.currentStepIndex];
  if (currentStep) {
    newSteps[state.currentStepIndex] = { label: currentStep.label, status: 'complete' };
  }
  const nextIndex = state.currentStepIndex + 1;
  const nextStep = newSteps[nextIndex];
  if (nextStep) {
    newSteps[nextIndex] = { label: nextStep.label, status: 'running' };
  }
  return {
    ...state,
    steps: newSteps,
    currentStepIndex: nextIndex,
  };
}

export function completeAllSteps(state: LoadingState): LoadingState {
  return {
    ...state,
    steps: state.steps.map(s => ({ ...s, status: 'complete' as StepStatus })),
    currentStepIndex: state.steps.length,
  };
}

export function setStepError(state: LoadingState, errorIndex?: number): LoadingState {
  const idx = errorIndex ?? state.currentStepIndex;
  const newSteps = [...state.steps];
  const step = newSteps[idx];
  if (step) {
    newSteps[idx] = { label: step.label, status: 'error' };
  }
  return { ...state, steps: newSteps };
}
