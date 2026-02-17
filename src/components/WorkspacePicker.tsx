import { useState, useEffect, useMemo, useRef } from 'react';
import { Folder, GitBranch, X, FolderOpen, Plus, Search, Clock, Loader2 } from 'lucide-react';
import { BaseModal } from './BaseModal';
import { apiGet } from '../api/client';
import type { KnownWorkspace } from '../types';

interface WorkspacePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (workspacePath: string | null) => Promise<void> | void;
}

export function WorkspacePicker({ isOpen, onClose, onSelect }: WorkspacePickerProps) {
  const [workspaces, setWorkspaces] = useState<KnownWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [customPath, setCustomPath] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredWorkspaces = useMemo(() => {
    if (!search.trim()) return workspaces;
    const query = search.toLowerCase();
    return workspaces.filter(
      (ws) =>
        ws.name.toLowerCase().includes(query) ||
        ws.path.toLowerCase().includes(query) ||
        ws.repo?.toLowerCase().includes(query)
    );
  }, [workspaces, search]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      apiGet<KnownWorkspace[]>('/api/workspaces')
        .then(setWorkspaces)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleSelect = async (path: string | null) => {
    setCreating(true);
    try {
      await onSelect(path);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  const handleCustomSubmit = () => {
    if (customPath.trim()) {
      void handleSelect(customPath.trim());
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Workspace"
      className="workspace-picker"
    >
      <div className="workspace-picker-header">
        <h2>
          <FolderOpen size={20} />
          Select Workspace
        </h2>
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      {/* Search input */}
      <div className="workspace-search">
        <Search size={16} />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search workspaces..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          aria-label="Search workspaces"
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')}>
            <X size={14} />
          </button>
        )}
      </div>

      <div className="workspace-picker-content">
        {creating ? (
          <div className="workspace-loading creating">
            <Loader2 size={20} className="spinning" />
            <span>Creating thread...</span>
          </div>
        ) : loading ? (
          <div className="workspace-loading">Loading workspaces...</div>
        ) : (
          <>
            {/* Default option - no workspace (only when not searching) */}
            {!search && (
              <button
                className="workspace-option default"
                onClick={() => handleSelect(null)}
              >
                <Plus size={18} />
                <div className="workspace-info">
                  <span className="workspace-name">New thread (no workspace)</span>
                  <span className="workspace-path">Start fresh without a specific project context</span>
                </div>
              </button>
            )}

            {/* Known/scanned workspaces */}
            {filteredWorkspaces.map((ws) => (
              <button
                key={ws.path}
                className={`workspace-option ${ws.source === 'thread' ? 'from-thread' : 'from-scan'}`}
                onClick={() => handleSelect(ws.path)}
              >
                <Folder size={18} />
                <div className="workspace-info">
                  <span className="workspace-name">{ws.name}</span>
                  <span className="workspace-path">{ws.path}</span>
                  <div className="workspace-meta">
                    {ws.repo && (
                      <span className="workspace-repo">
                        <GitBranch size={12} />
                        {ws.repo}
                      </span>
                    )}
                    {ws.lastUsed && (
                      <span className="workspace-last-used">
                        <Clock size={10} />
                        {ws.lastUsed}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {filteredWorkspaces.length === 0 && search && (
              <div className="workspace-empty">
                No workspaces matching "{search}"
              </div>
            )}

            {workspaces.length === 0 && !search && (
              <div className="workspace-empty">
                No workspaces found. Scanning ~/Development...
              </div>
            )}

            {/* Custom path input */}
            <div className="workspace-custom">
              {showCustomInput ? (
                <div className="custom-path-input">
                  <input
                    type="text"
                    placeholder="/path/to/your/project"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                    autoFocus
                    aria-label="Custom workspace path"
                  />
                  <button 
                    className="custom-path-btn"
                    onClick={handleCustomSubmit}
                    disabled={!customPath.trim()}
                  >
                    Create
                  </button>
                  <button 
                    className="custom-path-cancel"
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomPath('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="workspace-option custom-trigger"
                  onClick={() => setShowCustomInput(true)}
                >
                  <FolderOpen size={18} />
                  <span>Enter custom path...</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </BaseModal>
  );
}
