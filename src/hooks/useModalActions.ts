import { useCallback } from 'react';
import { apiGet, apiPost, apiDelete } from '../api/client';
import type { UseModalsReturn } from './useModals';

export interface UseModalActionsReturn {
  handleShareThread: (id: string) => Promise<void>;
  handleShowSkills: () => Promise<void>;
  handleShowTools: () => Promise<void>;
  handleShowMcpStatus: () => Promise<void>;
  handleShowMcpList: () => Promise<void>;
  handleShowPermissions: () => Promise<void>;
  handleShowHelp: () => Promise<void>;
  handleContextAnalyze: (activeThreadId: string | undefined) => void;
  handleThreadMap: (id: string) => void;
  handleSkillAdd: () => void;
  handleSkillRemove: () => void;
  handleSkillInfo: () => void;
  handleReplayThread: (id: string) => void;
  handleCodeReview: () => void;
}

export function useModalActions(
  modals: UseModalsReturn,
  showError: (message: string) => void,
): UseModalActionsReturn {
  const handleShareThread = useCallback(
    async (id: string) => {
      try {
        const result = await apiPost<{ output: string }>('/api/thread-share', { threadId: id });
        modals.setOutputModal({ title: 'Share Thread', content: result.output });
      } catch (err) {
        console.error('Failed to share:', err);
        showError('Failed to share thread');
      }
    },
    [modals, showError],
  );

  const handleShowSkills = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/skills-list');
      modals.setOutputModal({ title: 'Installed Skills', content: result.output });
    } catch (err) {
      console.error('Failed to list skills:', err);
      showError('Failed to list skills');
    }
  }, [modals, showError]);

  const handleShowTools = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/tools-list');
      modals.setOutputModal({ title: 'Available Tools', content: result.output });
    } catch (err) {
      console.error('Failed to list tools:', err);
      showError('Failed to list tools');
    }
  }, [modals, showError]);

  const handleShowMcpStatus = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/mcp-status');
      modals.setOutputModal({ title: 'MCP Server Status', content: result.output });
    } catch (err) {
      console.error('Failed to get MCP status:', err);
      showError('Failed to get MCP status');
    }
  }, [modals, showError]);

  const handleShowMcpList = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/mcp-list');
      modals.setOutputModal({ title: 'MCP Servers', content: result.output });
    } catch (err) {
      console.error('Failed to list MCP servers:', err);
      showError('Failed to list MCP servers');
    }
  }, [modals, showError]);

  const handleShowPermissions = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/permissions-list');
      modals.setOutputModal({ title: 'Permissions', content: result.output });
    } catch (err) {
      console.error('Failed to list permissions:', err);
      showError('Failed to list permissions');
    }
  }, [modals, showError]);

  const handleShowHelp = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/amp-help');
      modals.setOutputModal({ title: 'Amp Help', content: result.output });
    } catch (err) {
      console.error('Failed to get help:', err);
      showError('Failed to get help');
    }
  }, [modals, showError]);

  const handleContextAnalyze = useCallback(
    (activeThreadId: string | undefined) => {
      if (!activeThreadId) return;
      modals.setContextAnalyzeThreadId(activeThreadId);
    },
    [modals],
  );

  const handleThreadMap = useCallback(
    (id: string) => {
      modals.setThreadMapThreadId(id);
    },
    [modals],
  );

  const handleSkillAdd = useCallback(() => {
    modals.setInputModal({
      title: 'Add Skill',
      label: 'Skill source',
      placeholder: 'github:owner/repo or local path',
      confirmText: 'Add',
      onConfirm: async (source: string) => {
        modals.setInputModal(null);
        try {
          const result = await apiPost<{ output: string; success: boolean }>('/api/skill-add', {
            source,
          });
          modals.setOutputModal({ title: 'Skill Added', content: result.output });
        } catch (err) {
          console.error('Failed to add skill:', err);
          showError(`Failed to add skill: ${String(err)}`);
        }
      },
    });
  }, [modals, showError]);

  const handleSkillRemove = useCallback(() => {
    modals.setInputModal({
      title: 'Remove Skill',
      label: 'Skill name',
      placeholder: 'Enter skill name to remove',
      confirmText: 'Remove',
      onConfirm: async (name: string) => {
        modals.setInputModal(null);
        try {
          const result = await apiDelete<{ output: string; success: boolean }>(
            '/api/skill-remove',
            { name },
          );
          modals.setOutputModal({ title: 'Skill Removed', content: result.output });
        } catch (err) {
          console.error('Failed to remove skill:', err);
          showError(`Failed to remove skill: ${String(err)}`);
        }
      },
    });
  }, [modals, showError]);

  const handleSkillInfo = useCallback(() => {
    modals.setInputModal({
      title: 'Skill Info',
      label: 'Skill name',
      placeholder: 'Enter skill name',
      confirmText: 'View',
      onConfirm: async (name: string) => {
        modals.setInputModal(null);
        try {
          const result = await apiGet<{ output: string }>(
            `/api/skill-info?name=${encodeURIComponent(name)}`,
          );
          modals.setOutputModal({ title: `Skill: ${name}`, content: result.output });
        } catch (err) {
          console.error('Failed to get skill info:', err);
          showError(`Failed to get skill info: ${String(err)}`);
        }
      },
    });
  }, [modals, showError]);

  const handleReplayThread = useCallback(
    (id: string) => {
      modals.setReplayThreadId(id);
    },
    [modals],
  );

  const handleCodeReview = useCallback(() => {
    modals.setCodeReviewModal({});
  }, [modals]);

  return {
    handleShareThread,
    handleShowSkills,
    handleShowTools,
    handleShowMcpStatus,
    handleShowMcpList,
    handleShowPermissions,
    handleShowHelp,
    handleContextAnalyze,
    handleThreadMap,
    handleSkillAdd,
    handleSkillRemove,
    handleSkillInfo,
    handleReplayThread,
    handleCodeReview,
  };
}
