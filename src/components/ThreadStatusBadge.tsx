import { useState, useRef, useEffect, memo } from 'react';
import { Circle, PauseCircle, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { apiPatch } from '../api/client';
import type { ThreadStatus, ThreadMetadata } from '../types';

interface ThreadStatusBadgeProps {
  threadId: string;
  status: ThreadStatus;
  onStatusChange?: (newStatus: ThreadStatus) => void;
  compact?: boolean;
}

const STATUS_CONFIG: Record<ThreadStatus, { 
  icon: typeof Circle; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  active: { 
    icon: Circle, 
    label: 'Active', 
    color: 'var(--accent-cyan)',
    bgColor: 'rgba(14, 243, 255, 0.15)',
  },
  parked: { 
    icon: PauseCircle, 
    label: 'Paused', 
    color: 'var(--accent-yellow)',
    bgColor: 'rgba(255, 212, 0, 0.15)',
  },
  done: { 
    icon: CheckCircle, 
    label: 'Done', 
    color: 'var(--success, #00ff88)',
    bgColor: 'rgba(0, 255, 136, 0.15)',
  },
  blocked: { 
    icon: AlertCircle, 
    label: 'Blocked', 
    color: 'var(--error, #ff5555)',
    bgColor: 'rgba(255, 85, 85, 0.15)',
  },
};

export const ThreadStatusBadge = memo(function ThreadStatusBadge({ threadId, status, onStatusChange, compact = false }: ThreadStatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [updating, setUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusChange = async (newStatus: ThreadStatus) => {
    if (newStatus === currentStatus) {
      setIsOpen(false);
      return;
    }

    setUpdating(true);
    try {
      await apiPatch<ThreadMetadata>('/api/thread-status', {
        threadId,
        status: newStatus,
      });
      setCurrentStatus(newStatus);
      onStatusChange?.(newStatus);
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdating(false);
      setIsOpen(false);
    }
  };

  const config = STATUS_CONFIG[currentStatus];
  const Icon = config.icon;

  return (
    <div className="thread-status-badge" ref={dropdownRef}>
      <button
        className={`status-badge-btn ${compact ? 'compact' : ''}`}
        style={{ 
          color: config.color, 
          backgroundColor: config.bgColor,
          borderColor: config.color,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={updating}
      >
        <Icon size={compact ? 10 : 12} />
        {!compact && <span>{config.label}</span>}
        <ChevronDown size={10} />
      </button>

      {isOpen && (
        <div className="status-dropdown">
          {(Object.keys(STATUS_CONFIG) as ThreadStatus[]).map((s) => {
            const cfg = STATUS_CONFIG[s];
            const StatusIcon = cfg.icon;
            return (
              <button
                key={s}
                className={`status-option ${s === currentStatus ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleStatusChange(s);
                }}
              >
                <StatusIcon size={12} style={{ color: cfg.color }} />
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
