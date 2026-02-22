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
  handleMcpAdd: () => void;
  handleMcpApprove: () => void;
  handlePermissionsTest: () => void;
  handleReplayThread: (id: string) => void;
  handleCodeReview: () => void;
  handleShowAgentsMdList: () => Promise<void>;
  handleSetVisibility: (id: string, visibility: string) => Promise<void>;
  handleShowUsage: () => Promise<void>;
  handleCheckForUpdates: () => Promise<void>;
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

  const handleSkillRemove = useCallback(async () => {
    try {
      const summary = await apiGet<{ skills: { name: string; description: string }[] }>(
        '/api/skills-summary',
      );
      const skillNames = summary.skills.map((s) => s.name);
      if (skillNames.length === 0) {
        showError('No skills installed');
        return;
      }
      modals.setInputModal({
        title: 'Remove Skill',
        label: `Installed skills: ${skillNames.join(', ')}`,
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
    } catch (err) {
      console.error('Failed to load skills:', err);
      showError('Failed to load skills list');
    }
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

  const handleMcpAdd = useCallback(() => {
    modals.setInputModal({
      title: 'Add MCP Server',
      label: 'Server name',
      placeholder: 'e.g. my-server',
      confirmText: 'Next',
      onConfirm: (name: string) => {
        modals.setInputModal(null);
        modals.setInputModal({
          title: 'Add MCP Server',
          label: `Source command for "${name}"`,
          placeholder: 'e.g. npx -y @modelcontextprotocol/server-filesystem',
          confirmText: 'Add',
          onConfirm: async (source: string) => {
            modals.setInputModal(null);
            try {
              const result = await apiPost<{ output: string; success: boolean }>('/api/mcp-add', {
                name,
                source,
              });
              modals.setOutputModal({ title: 'MCP Server Added', content: result.output });
            } catch (err) {
              console.error('Failed to add MCP server:', err);
              showError(`Failed to add MCP server: ${String(err)}`);
            }
          },
        });
      },
    });
  }, [modals, showError]);

  const handleMcpApprove = useCallback(() => {
    modals.setInputModal({
      title: 'Approve MCP Server',
      label: 'Server name',
      placeholder: 'Enter MCP server name to approve',
      confirmText: 'Approve',
      onConfirm: async (name: string) => {
        modals.setInputModal(null);
        try {
          const result = await apiPost<{ output: string; success: boolean }>('/api/mcp-approve', {
            name,
          });
          modals.setOutputModal({ title: 'MCP Server Approved', content: result.output });
        } catch (err) {
          console.error('Failed to approve MCP server:', err);
          showError(`Failed to approve MCP server: ${String(err)}`);
        }
      },
    });
  }, [modals, showError]);

  const handlePermissionsTest = useCallback(() => {
    modals.setInputModal({
      title: 'Test Permission',
      label: 'Tool name',
      placeholder: 'e.g. Bash',
      confirmText: 'Next',
      onConfirm: (tool: string) => {
        modals.setInputModal(null);
        modals.setInputModal({
          title: 'Test Permission',
          label: `Command to test for "${tool}"`,
          placeholder: 'e.g. git push',
          confirmText: 'Test',
          onConfirm: async (cmd: string) => {
            modals.setInputModal(null);
            try {
              const result = await apiPost<{ output: string }>('/api/permissions-test', {
                tool,
                cmd,
              });
              modals.setOutputModal({ title: 'Permission Test Result', content: result.output });
            } catch (err) {
              console.error('Failed to test permission:', err);
              showError(`Failed to test permission: ${String(err)}`);
            }
          },
        });
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

  const handleShowAgentsMdList = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/agents-md-list');
      modals.setOutputModal({ title: 'AGENTS.md Files', content: result.output });
    } catch (err) {
      console.error('Failed to list AGENTS.md files:', err);
      showError('Failed to list AGENTS.md files');
    }
  }, [modals, showError]);

  const handleSetVisibility = useCallback(
    async (id: string, visibility: string) => {
      try {
        const result = await apiPost<{ output: string; success: boolean }>(
          '/api/thread-set-visibility',
          { threadId: id, visibility },
        );
        modals.setOutputModal({ title: 'Visibility Updated', content: result.output });
      } catch (err) {
        console.error('Failed to set visibility:', err);
        showError(`Failed to set visibility: ${String(err)}`);
      }
    },
    [modals, showError],
  );

  const handleShowUsage = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/amp-usage');
      modals.setOutputModal({ title: 'Amp Usage', content: result.output });
    } catch (err) {
      console.error('Failed to get usage:', err);
      showError('Failed to get usage info');
    }
  }, [modals, showError]);

  const handleCheckForUpdates = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/amp-version');
      modals.setOutputModal({ title: 'Amp Version', content: result.output });
    } catch (err) {
      console.error('Failed to check version:', err);
      showError('Failed to check for updates');
    }
  }, [modals, showError]);

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
    handleMcpAdd,
    handleMcpApprove,
    handlePermissionsTest,
    handleReplayThread,
    handleCodeReview,
    handleShowAgentsMdList,
    handleSetVisibility,
    handleShowUsage,
    handleCheckForUpdates,
  };
}
