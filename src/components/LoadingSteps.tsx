import { CheckCircle, Circle, Loader2, XCircle } from 'lucide-react';

export type StepStatus = 'pending' | 'running' | 'complete' | 'error';

export interface LoadingStep {
  label: string;
  status: StepStatus;
}

export interface LoadingState {
  title: string;
  steps: LoadingStep[];
  currentStepIndex: number;
}

interface LoadingStepsProps {
  state: LoadingState;
  compact?: boolean;
}

export function LoadingSteps({ state, compact = false }: LoadingStepsProps) {
  if (compact) {
    const currentStep = state.steps[state.currentStepIndex];
    return (
      <div className="loading-steps-compact">
        <Loader2 size={14} className="loading-spinner" />
        <span className="loading-step-label">{currentStep?.label || state.title}</span>
      </div>
    );
  }

  return (
    <div className="loading-steps">
      <div className="loading-steps-header">
        <Loader2 size={18} className="loading-spinner" />
        <span className="loading-steps-title">{state.title}</span>
      </div>
      <div className="loading-steps-list">
        {state.steps.map((step, index) => (
          <div key={index} className={`loading-step loading-step-${step.status}`}>
            <div className="loading-step-icon">
              {step.status === 'complete' && <CheckCircle size={16} />}
              {step.status === 'running' && <Loader2 size={16} className="loading-spinner" />}
              {step.status === 'error' && <XCircle size={16} />}
              {step.status === 'pending' && <Circle size={16} />}
            </div>
            <span className="loading-step-label">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
