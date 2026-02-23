import React from 'react';
import type { Thread, ThreadMetadata, ThreadStatus, ThreadStackTopology } from '../../types';
import { ThreadRow } from './ThreadRow';

interface StackTreeProps {
  topology: ThreadStackTopology;
  threadMap: Map<string, Thread>;
  metadata: Record<string, ThreadMetadata>;
  threadLabelObjects?: Record<string, { name: string }[]>;
  selectedIds: Set<string>;
  focusedThreadId?: string;
  onContinue: (thread: Thread) => void;
  onArchive: (thread: Thread) => void;
  onDelete: (thread: Thread) => void;
  onStatusChange?: (threadId: string, status: ThreadStatus) => void;
  onSelect: (threadId: string, shiftKey: boolean) => void;
}

function StackTreeNodes({
  parentId,
  depth,
  topology,
  threadMap,
  ...passthrough
}: {
  parentId: string;
  depth: number;
  topology: ThreadStackTopology;
  threadMap: Map<string, Thread>;
  metadata: Record<string, ThreadMetadata>;
  threadLabelObjects?: Record<string, { name: string }[]>;
  selectedIds: Set<string>;
  focusedThreadId?: string;
  onContinue: (thread: Thread) => void;
  onArchive: (thread: Thread) => void;
  onDelete: (thread: Thread) => void;
  onStatusChange?: (threadId: string, status: ThreadStatus) => void;
  onSelect: (threadId: string, shiftKey: boolean) => void;
}) {
  const childIds = topology.parentToChildren[parentId];
  if (!childIds) return null;

  // Sort children by lastUpdatedDate desc for deterministic ordering
  const sorted = [...childIds].sort((a, b) => {
    const ta = threadMap.get(a);
    const tb = threadMap.get(b);
    const dateA = ta?.lastUpdatedDate ? Date.parse(ta.lastUpdatedDate) : 0;
    const dateB = tb?.lastUpdatedDate ? Date.parse(tb.lastUpdatedDate) : 0;
    return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
  });

  return (
    <>
      {sorted.map((childId) => {
        const thread = threadMap.get(childId);
        if (!thread) return null;

        return (
          <React.Fragment key={childId}>
            <ThreadRow
              thread={thread}
              metadata={passthrough.metadata[childId]}
              initialLabels={passthrough.threadLabelObjects?.[childId]}
              selected={passthrough.selectedIds.has(childId)}
              focused={passthrough.focusedThreadId === childId}
              onContinue={passthrough.onContinue}
              onArchive={passthrough.onArchive}
              onDelete={passthrough.onDelete}
              onStatusChange={passthrough.onStatusChange}
              onSelect={passthrough.onSelect}
              isStackChild
              stackDepth={depth}
            />
            <StackTreeNodes
              parentId={childId}
              depth={depth + 1}
              topology={topology}
              threadMap={threadMap}
              {...passthrough}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}

export function StackTree(props: StackTreeProps) {
  return (
    <StackTreeNodes
      parentId={props.topology.rootId}
      depth={1}
      topology={props.topology}
      threadMap={props.threadMap}
      metadata={props.metadata}
      threadLabelObjects={props.threadLabelObjects}
      selectedIds={props.selectedIds}
      focusedThreadId={props.focusedThreadId}
      onContinue={props.onContinue}
      onArchive={props.onArchive}
      onDelete={props.onDelete}
      onStatusChange={props.onStatusChange}
      onSelect={props.onSelect}
    />
  );
}
