import { lazy, Suspense } from 'react';
import { useAppModalHandlers } from '../hooks/useAppModalHandlers';
import { ShellTerminal } from './ShellTerminal';
import { InputModal } from './InputModal';
import { ConfirmModal } from './ConfirmModal';
import { ErrorToast } from './ErrorToast';

const CommandPalette = lazy(() =>
  import('./CommandPalette').then((m) => ({ default: m.CommandPalette })),
);
const WorkspacePicker = lazy(() =>
  import('./WorkspacePicker').then((m) => ({ default: m.WorkspacePicker })),
);
const HandoffModal = lazy(() =>
  import('./HandoffModal').then((m) => ({ default: m.HandoffModal })),
);
const BlockerModal = lazy(() =>
  import('./BlockerModal').then((m) => ({ default: m.BlockerModal })),
);
const OutputModal = lazy(() => import('./OutputModal').then((m) => ({ default: m.OutputModal })));
const CodeReviewModal = lazy(() =>
  import('./CodeReviewModal').then((m) => ({ default: m.CodeReviewModal })),
);
const PromptHistoryModal = lazy(() =>
  import('./PromptHistoryModal').then((m) => ({ default: m.PromptHistoryModal })),
);

export interface AppModalsProps {
  onRefresh: () => void;
  onNewThread: () => void;
  setThreadLabels: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}

export function AppModals({ onRefresh, onNewThread, setThreadLabels }: AppModalsProps) {
  const {
    modals,
    threadActions,
    commands,
    errors,
    dismissError,
    handleContinueWithTracking,
    handleAddBlocker,
    handleRemoveBlocker,
  } = useAppModalHandlers({ onRefresh, onNewThread, setThreadLabels });

  const { threads, metadata, activeThreadId } = threadActions;
  const activeThreadTitle = threads.find((t) => t.id === activeThreadId)?.title;

  return (
    <>
      <Suspense fallback={null}>
        <CommandPalette
          commands={commands}
          isOpen={modals.commandPaletteOpen}
          onClose={() => modals.setCommandPaletteOpen(false)}
          activeThreadTitle={activeThreadTitle}
        />

        <OutputModal
          title={modals.outputModal?.title || ''}
          content={modals.outputModal?.content || ''}
          isOpen={!!modals.outputModal}
          onClose={() => modals.setOutputModal(null)}
        />

        <WorkspacePicker
          isOpen={modals.workspacePickerOpen}
          onClose={() => modals.setWorkspacePickerOpen(false)}
          onSelect={threadActions.handleCreateThreadInWorkspace}
        />

        <HandoffModal
          isOpen={!!threadActions.handoffThreadId}
          threadId={threadActions.handoffThreadId || ''}
          threadTitle={threads.find((t) => t.id === threadActions.handoffThreadId)?.title}
          onConfirm={threadActions.handleHandoffConfirm}
          onCancel={() => threadActions.setHandoffThreadId(null)}
        />

        <CodeReviewModal
          isOpen={!!modals.codeReviewModal}
          onClose={() => modals.setCodeReviewModal(null)}
          workspace={
            modals.codeReviewModal?.workspace ??
            threads.find((t) => t.id === activeThreadId)?.workspacePath ??
            undefined
          }
        />

        <PromptHistoryModal
          isOpen={modals.promptHistoryOpen}
          onClose={() => modals.setPromptHistoryOpen(false)}
          onSelect={(text) => {
            modals.setPendingPromptInsert(text);
            modals.setPromptHistoryOpen(false);
          }}
        />

        <BlockerModal
          isOpen={!!modals.blockerThreadId}
          threadId={modals.blockerThreadId || ''}
          threadTitle={threads.find((t) => t.id === modals.blockerThreadId)?.title || ''}
          blockers={metadata[modals.blockerThreadId ?? '']?.blockers || []}
          threads={threads}
          onAddBlocker={handleAddBlocker}
          onRemoveBlocker={handleRemoveBlocker}
          onClose={() => modals.setBlockerThreadId(null)}
          onOpenThread={handleContinueWithTracking}
        />
      </Suspense>

      <InputModal
        isOpen={!!modals.inputModal}
        title={modals.inputModal?.title ?? ''}
        label={modals.inputModal?.label ?? ''}
        placeholder={modals.inputModal?.placeholder}
        confirmText={modals.inputModal?.confirmText}
        validate={modals.inputModal?.validate}
        onConfirm={(value) => modals.inputModal?.onConfirm(value)}
        onCancel={() => modals.setInputModal(null)}
      />

      {modals.confirmModal && (
        <ConfirmModal
          title={modals.confirmModal.title}
          message={modals.confirmModal.message}
          confirmText={modals.confirmModal.confirmText}
          isDestructive={modals.confirmModal.isDestructive}
          onConfirm={modals.confirmModal.onConfirm}
          onCancel={() => modals.setConfirmModal(null)}
        />
      )}

      {modals.shellTerminal && (
        <ShellTerminal
          cwd={modals.shellTerminal.cwd}
          onClose={modals.closeShellTerminal}
          onMinimize={modals.minimizeShellTerminal}
          minimized={modals.shellTerminal.minimized}
        />
      )}

      <ErrorToast errors={errors} onDismiss={dismissError} />
    </>
  );
}
