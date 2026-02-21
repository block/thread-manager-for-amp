import { useState, useEffect, useCallback } from 'react';
import {
  X,
  ClipboardList,
  Import,
  RefreshCw,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { BaseModal } from './BaseModal';
import { apiGet, apiPost } from '../api/client';

interface Task {
  id: string;
  title: string;
  status: string;
  description?: string;
}

interface TasksResult {
  tasks: Task[];
  raw: string;
}

interface ImportResult {
  output: string;
  success: boolean;
}

interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace?: string | null;
  initialTab?: 'list' | 'import';
}

function getStatusIcon(status: string) {
  switch (status.toLowerCase()) {
    case 'done':
    case 'completed':
    case 'complete':
      return <CheckCircle2 size={14} className="task-status-icon status-done" />;
    case 'pending':
    case 'todo':
    case 'open':
      return <Circle size={14} className="task-status-icon status-pending" />;
    case 'in_progress':
    case 'in-progress':
    case 'running':
      return <Clock size={14} className="task-status-icon status-progress" />;
    default:
      return <AlertCircle size={14} className="task-status-icon status-unknown" />;
  }
}

export function TasksModal({ isOpen, onClose, workspace, initialTab = 'list' }: TasksModalProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'import'>(initialTab);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rawOutput, setRawOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importSource, setImportSource] = useState('');
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = workspace ? `?workspace=${encodeURIComponent(workspace)}` : '';
      const result = await apiGet<TasksResult>(`/api/tasks${params}`);
      setTasks(result.tasks);
      setRawOutput(result.raw);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    if (isOpen && activeTab === 'list') {
      void fetchTasks();
    }
  }, [isOpen, activeTab, fetchTasks]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const handleImport = useCallback(async () => {
    if (!importSource.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await apiPost<ImportResult>('/api/tasks-import', {
        source: importSource.trim(),
        workspace: workspace || undefined,
      });
      setImportResult(result.output);
      setImportSource('');
    } catch (err) {
      setImportResult(`Error: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  }, [importSource, workspace]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && activeTab === 'import' && !importing) {
        e.preventDefault();
        void handleImport();
      }
    },
    [activeTab, importing, handleImport],
  );

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Tasks" className="tasks-modal">
      <div className="tasks-modal-content" onKeyDown={handleKeyDown}>
        <div className="tasks-modal-header">
          <div className="tasks-modal-tabs">
            <button
              className={`tasks-tab ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              <ClipboardList size={14} />
              List
            </button>
            <button
              className={`tasks-tab ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => setActiveTab('import')}
            >
              <Import size={14} />
              Import
            </button>
          </div>
          <button className="tasks-modal-close" onClick={onClose} aria-label="Close tasks modal">
            <X size={18} />
          </button>
        </div>

        {activeTab === 'list' && (
          <div className="tasks-list-tab">
            <div className="tasks-toolbar">
              <button
                className="tasks-refresh-btn"
                onClick={() => void fetchTasks()}
                disabled={loading}
                aria-label="Refresh tasks"
              >
                <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                Refresh
              </button>
            </div>

            {loading && <div className="tasks-loading">Loading tasks...</div>}

            {error && <div className="tasks-error">{error}</div>}

            {!loading && !error && tasks.length === 0 && (
              <div className="tasks-empty">
                {rawOutput ? (
                  <pre className="tasks-raw-output">{rawOutput}</pre>
                ) : (
                  'No tasks found. Import tasks to get started.'
                )}
              </div>
            )}

            {!loading && tasks.length > 0 && (
              <div className="tasks-list" role="list">
                {tasks.map((task) => (
                  <div key={task.id} className="tasks-item" role="listitem">
                    {getStatusIcon(task.status)}
                    <div className="tasks-item-content">
                      <span className="tasks-item-title">{task.title}</span>
                      {task.description && (
                        <span className="tasks-item-description">{task.description}</span>
                      )}
                    </div>
                    <span className={`tasks-item-status status-${task.status.toLowerCase()}`}>
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'import' && (
          <div className="tasks-import-tab">
            <div className="tasks-import-form">
              <label className="tasks-import-label" htmlFor="tasks-import-source">
                Task source (file path or URL)
              </label>
              <input
                id="tasks-import-source"
                type="text"
                className="tasks-import-input"
                value={importSource}
                onChange={(e) => setImportSource(e.target.value)}
                placeholder="path/to/tasks.md or https://..."
                disabled={importing}
                aria-label="Task source"
              />
              <button
                className="tasks-import-btn"
                onClick={() => void handleImport()}
                disabled={importing || !importSource.trim()}
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>

            {importResult && (
              <div className="tasks-import-result">
                <pre>{importResult}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
