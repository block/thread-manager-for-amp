import { Play, Pause, Square, SkipForward } from 'lucide-react';
import type { ReplayState } from '../../hooks/useReplayMode';

interface ReplayControlsProps {
  replayState: ReplayState;
  replaySpeed: number;
  progress: { current: number; total: number };
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkipToEnd: () => void;
  onSetSpeed: (speed: number) => void;
}

const SPEEDS = [1, 2, 4];

export function ReplayControls({
  replayState,
  replaySpeed,
  progress,
  onPause,
  onResume,
  onStop,
  onSkipToEnd,
  onSetSpeed,
}: ReplayControlsProps) {
  const isPlaying = replayState === 'playing';
  const isDone = replayState === 'done';
  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="replay-controls">
      <div className="replay-controls-left">
        <span className="replay-badge">▶ Replay</span>
        <span className="replay-progress-text">
          {progress.current}/{progress.total}
        </span>
      </div>

      <div className="replay-controls-center">
        {isPlaying ? (
          <button className="replay-btn" onClick={onPause} title="Pause" aria-label="Pause replay">
            <Pause size={14} />
          </button>
        ) : (
          <button
            className="replay-btn"
            onClick={onResume}
            disabled={isDone}
            title="Play"
            aria-label="Resume replay"
          >
            <Play size={14} />
          </button>
        )}

        <button className="replay-btn" onClick={onStop} title="Stop" aria-label="Stop replay">
          <Square size={14} />
        </button>

        <button
          className="replay-btn"
          onClick={onSkipToEnd}
          disabled={isDone}
          title="Skip to end"
          aria-label="Skip to end"
        >
          <SkipForward size={14} />
        </button>

        <div className="replay-speed-selector">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              className={`replay-speed-btn ${replaySpeed === speed ? 'active' : ''}`}
              onClick={() => onSetSpeed(speed)}
              aria-label={`${speed}x speed`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      <div className="replay-progress-bar">
        <div className="replay-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}
