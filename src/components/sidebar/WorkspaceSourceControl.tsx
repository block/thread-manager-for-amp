import { useState, useEffect, memo, useCallback } from 'react';
import { GitBranch, Plus, Pencil, Trash2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { apiGet } from '../../api/client';
import { WorkspaceSourceControlModal } from './WorkspaceSourceControlModal';

interface WorkspaceGitStatus {
  isGitRepo: boolean;
  workspace: string;
  branch?: string;
  files: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    staged: boolean;
  }>;
  totalCount: number;
  addedCount: number;
  modifiedCount: number;
  deletedCount: number;
  error?: string;
}

interface WorkspaceSourceControlProps {
  workspacePath: string;
  expanded: boolean;
  onToggle: () => void;
  refreshKey?: number;
}

export const WorkspaceSourceControl = memo(function WorkspaceSourceControl({
  workspacePath,
  expanded,
  onToggle,
  refreshKey = 0,
}: WorkspaceSourceControlProps) {
  const [status, setStatus] = useState<WorkspaceGitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!workspacePath) return;
    setLoading(true);
    try {
      const data = await apiGet<WorkspaceGitStatus>(
        `/api/workspace-git-status?workspace=${encodeURIComponent(workspacePath)}`
      );
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch workspace git status:', err);
      setStatus(null);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [workspacePath]);

  useEffect(() => {
    if (workspacePath && !hasFetched) {
      void fetchStatus();
    }
  }, [workspacePath, hasFetched, fetchStatus]);

  useEffect(() => {
    setHasFetched(false);
    setStatus(null);
  }, [workspacePath]);

  useEffect(() => {
    if (refreshKey > 0 && workspacePath) {
      void fetchStatus();
    }
  }, [refreshKey, workspacePath, fetchStatus]);

  const openModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const totalChanges = status?.totalCount || 0;
  const workspaceName = workspacePath.split('/').pop() || workspacePath;

  if (!workspacePath) return null;
  if (hasFetched && !status?.isGitRepo) return null;
  if (hasFetched && totalChanges === 0) return null;
  if (!hasFetched || loading) return null;

  return (
    <>
      <div className="workspace-source-control">
        <button className="workspace-scm-header" onClick={onToggle}>
          <span className="sidebar-chevron">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <GitBranch size={14} />
          <span className="workspace-scm-badge">{totalChanges}</span>
          {status?.branch && (
            <span className="workspace-scm-branch">{status.branch}</span>
          )}
        </button>

        {expanded && (
          <div className="workspace-scm-content">
            <div className="workspace-scm-toolbar">
              <div className="workspace-scm-stats">
                {(status?.addedCount ?? 0) > 0 && <span className="stat-added"><Plus size={10} /> {status?.addedCount}</span>}
                {(status?.modifiedCount ?? 0) > 0 && <span className="stat-modified"><Pencil size={10} /> {status?.modifiedCount}</span>}
                {(status?.deletedCount ?? 0) > 0 && <span className="stat-deleted"><Trash2 size={10} /> {status?.deletedCount}</span>}
              </div>
              <button className="workspace-scm-refresh" onClick={fetchStatus} title="Refresh">
                <RefreshCw size={12} />
              </button>
            </div>
            
            <div className="workspace-scm-files">
              {status?.files.map((file) => (
                <button
                  key={file.path}
                  className={`workspace-scm-file ${file.status}`}
                  onClick={openModal}
                  title={file.path}
                >
                  <span className={`file-status-icon ${file.status}`}>
                    {file.status === 'added' && <Plus size={10} />}
                    {file.status === 'modified' && <Pencil size={10} />}
                    {file.status === 'deleted' && <Trash2 size={10} />}
                  </span>
                  <span className="file-name">{file.path.split('/').pop()}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <WorkspaceSourceControlModal
        workspacePath={workspacePath}
        workspaceName={workspaceName}
        isOpen={modalOpen}
        onClose={closeModal}
      />
    </>
  );
});
