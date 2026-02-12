import { memo, useMemo } from 'react';
import { GitBranch, Folder, Tag, Circle, X } from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';
import { STATUS_OPTIONS } from './types';
import type { ToolbarFiltersProps, ThreadStatus } from './types';
import styles from './Toolbar.module.css';

export const ToolbarFilters = memo(function ToolbarFilters({
  threads,
  selectedRepo,
  selectedWorkspace,
  selectedLabel,
  selectedStatus,
  labels,
  onRepoChange,
  onWorkspaceChange,
  onLabelChange,
  onStatusChange,
}: ToolbarFiltersProps) {
  const { repos, workspaces, hasNoWorkspace } = useMemo(() => {
    const repoSet = new Set<string>();
    const workspaceSet = new Set<string>();
    let noWorkspace = false;
    for (const thread of threads) {
      if (thread.repo) repoSet.add(thread.repo);
      if (thread.workspace) {
        workspaceSet.add(thread.workspace);
      } else {
        noWorkspace = true;
      }
    }
    return {
      repos: [...repoSet].sort(),
      workspaces: [...workspaceSet].sort(),
      hasNoWorkspace: noWorkspace,
    };
  }, [threads]);

  const activeFilterCount = [selectedRepo, selectedWorkspace, selectedLabel, selectedStatus].filter(Boolean).length;

  const clearFilters = () => {
    onRepoChange(null);
    onWorkspaceChange(null);
    onLabelChange(null);
    onStatusChange(null);
  };

  return (
    <div className={styles.viewsLeft}>
      <SearchableSelect
        options={repos.map(r => ({ value: r, label: r }))}
        value={selectedRepo}
        onChange={onRepoChange}
        allLabel="All repos"
        icon={<GitBranch size={13} />}
        colorClass="filter-repo"
        searchPlaceholder="Search repos..."
      />

      <SearchableSelect
        options={[
          ...(hasNoWorkspace ? [{ value: '__NO_WORKSPACE__', label: 'No workspace' }] : []),
          ...workspaces.map(ws => ({ value: ws, label: ws })),
        ]}
        value={selectedWorkspace}
        onChange={onWorkspaceChange}
        allLabel="All workspaces"
        icon={<Folder size={13} />}
        colorClass="filter-workspace"
        searchPlaceholder="Search workspaces..."
      />

      <SearchableSelect
        options={labels.map(l => ({ value: l, label: l }))}
        value={selectedLabel}
        onChange={onLabelChange}
        allLabel="All labels"
        icon={<Tag size={13} />}
        colorClass="filter-label"
        searchPlaceholder="Search labels..."
      />

      <SearchableSelect
        options={STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))}
        value={selectedStatus}
        onChange={(v) => onStatusChange(v as ThreadStatus | null)}
        allLabel="All statuses"
        icon={<Circle size={13} />}
        colorClass="filter-status"
        searchPlaceholder="Search statuses..."
      />

      {activeFilterCount > 0 && (
        <button className={styles.clearFilters} onClick={clearFilters}>
          <X size={14} />
        </button>
      )}
    </div>
  );
});
