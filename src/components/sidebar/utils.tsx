import { Circle, CheckCircle2, PauseCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { ThreadStatus, RunningStatus } from './types';

export function getStatusIcon(status: ThreadStatus | undefined, runningStatus: RunningStatus | null, size: number = 12) {
  if (runningStatus === 'running') {
    return <Loader2 size={size} className="sidebar-status-icon running" />;
  }
  if (runningStatus === 'connected') {
    return <Circle size={size} className="sidebar-status-icon connected" />;
  }
  switch (status) {
    case 'done':
      return <CheckCircle2 size={size} className="sidebar-status-icon done" />;
    case 'parked':
      return <PauseCircle size={size} className="sidebar-status-icon parked" />;
    case 'blocked':
      return <AlertCircle size={size} className="sidebar-status-icon blocked" />;
    default:
      return <Circle size={size} className="sidebar-status-icon active" />;
  }
}
