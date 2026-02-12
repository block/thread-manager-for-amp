import { useState, useCallback } from 'react';
import { apiGet, apiPost, apiDelete } from '../api/client';

export interface OutputModalState {
  title: string;
  content: string;
}

export interface ShellTerminalState {
  cwd?: string;
  minimized?: boolean;
}

export interface UseModalsReturn {
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  outputModal: OutputModalState | null;
  setOutputModal: (modal: OutputModalState | null) => void;

  workspacePickerOpen: boolean;
  setWorkspacePickerOpen: (open: boolean) => void;

  blockerThreadId: string | null;
  setBlockerThreadId: (id: string | null) => void;

  shellTerminal: ShellTerminalState | null;
  setShellTerminal: (state: ShellTerminalState | null) => void;
  openShellTerminal: (cwd?: string) => void;
  closeShellTerminal: () => void;
  minimizeShellTerminal: () => void;
  restoreShellTerminal: () => void;

  handleShareThread: (id: string) => Promise<void>;
  handleShowSkills: () => Promise<void>;
  handleShowTools: () => Promise<void>;
  handleShowMcpStatus: () => Promise<void>;
  handleShowMcpList: () => Promise<void>;
  handleShowPermissions: () => Promise<void>;
  handleShowHelp: () => Promise<void>;
  handleContextAnalyze: (activeThreadId: string | undefined) => Promise<void>;
  handleIdeConnect: () => void;
  handleShowToolbox: () => Promise<void>;
  handleSkillAdd: () => Promise<void>;
  handleSkillRemove: () => Promise<void>;
  handleSkillInvoke: () => Promise<void>;
}

export function useModals(): UseModalsReturn {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [outputModal, setOutputModal] = useState<OutputModalState | null>(null);
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [blockerThreadId, setBlockerThreadId] = useState<string | null>(null);
  const [shellTerminal, setShellTerminal] = useState<ShellTerminalState | null>(null);

  const openShellTerminal = useCallback((cwd?: string) => {
    setShellTerminal((prev) => prev ? { ...prev, minimized: false } : { cwd });
  }, []);

  const closeShellTerminal = useCallback(() => {
    setShellTerminal(null);
  }, []);

  const minimizeShellTerminal = useCallback(() => {
    setShellTerminal((prev) => prev ? { ...prev, minimized: true } : null);
  }, []);

  const restoreShellTerminal = useCallback(() => {
    setShellTerminal((prev) => prev ? { ...prev, minimized: false } : null);
  }, []);

  const handleShareThread = useCallback(async (id: string) => {
    try {
      const result = await apiPost<{ output: string }>('/api/thread-share', { threadId: id });
      setOutputModal({ title: 'Share Thread', content: result.output });
    } catch (err) {
      console.error('Failed to share:', err);
    }
  }, []);

  const handleShowSkills = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/skills-list');
      setOutputModal({ title: 'Installed Skills', content: result.output });
    } catch (err) {
      console.error('Failed to list skills:', err);
    }
  }, []);

  const handleShowTools = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/tools-list');
      setOutputModal({ title: 'Available Tools', content: result.output });
    } catch (err) {
      console.error('Failed to list tools:', err);
    }
  }, []);

  const handleShowMcpStatus = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/mcp-status');
      setOutputModal({ title: 'MCP Server Status', content: result.output });
    } catch (err) {
      console.error('Failed to get MCP status:', err);
    }
  }, []);

  const handleShowMcpList = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/mcp-list');
      setOutputModal({ title: 'MCP Servers', content: result.output });
    } catch (err) {
      console.error('Failed to list MCP servers:', err);
    }
  }, []);

  const handleShowPermissions = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/permissions-list');
      setOutputModal({ title: 'Permissions', content: result.output });
    } catch (err) {
      console.error('Failed to list permissions:', err);
    }
  }, []);

  const handleShowHelp = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/amp-help');
      setOutputModal({ title: 'Amp Help', content: result.output });
    } catch (err) {
      console.error('Failed to get help:', err);
    }
  }, []);

  const handleContextAnalyze = useCallback(async (activeThreadId: string | undefined) => {
    if (!activeThreadId) return;
    setOutputModal({ 
      title: 'Context Analysis', 
      content: 'Context analysis would show token usage breakdown for the current thread.\nThis feature requires integration with thread metadata.' 
    });
  }, []);

  const handleIdeConnect = useCallback(() => {
    setOutputModal({ 
      title: 'IDE Connection', 
      content: 'IDE connection is managed automatically by the Amp CLI when running in a terminal.\nThis web interface operates independently.' 
    });
  }, []);

  const handleShowToolbox = useCallback(async () => {
    try {
      const result = await apiGet<{ output: string }>('/api/tools-list');
      setOutputModal({ title: 'Toolbox', content: result.output });
    } catch (err) {
      console.error('Failed to list toolbox:', err);
    }
  }, []);

  const handleSkillAdd = useCallback(async () => {
    const source = window.prompt('Enter skill source (e.g., github:owner/repo or local path):');
    if (source) {
      try {
        const result = await apiPost<{ output: string; success: boolean }>('/api/skill-add', { source });
        setOutputModal({ title: 'Skill Added', content: result.output });
      } catch (err) {
        console.error('Failed to add skill:', err);
        setOutputModal({ title: 'Error', content: `Failed to add skill: ${err}` });
      }
    }
  }, []);

  const handleSkillRemove = useCallback(async () => {
    const name = window.prompt('Enter skill name to remove:');
    if (name) {
      try {
        const result = await apiDelete<{ output: string; success: boolean }>('/api/skill-remove', { name });
        setOutputModal({ title: 'Skill Removed', content: result.output });
      } catch (err) {
        console.error('Failed to remove skill:', err);
        setOutputModal({ title: 'Error', content: `Failed to remove skill: ${err}` });
      }
    }
  }, []);

  const handleSkillInvoke = useCallback(async () => {
    const name = window.prompt('Enter skill name to invoke:');
    if (name) {
      try {
        const result = await apiGet<{ output: string }>(`/api/skill-info?name=${encodeURIComponent(name)}`);
        setOutputModal({ title: `Skill: ${name}`, content: result.output });
      } catch (err) {
        console.error('Failed to get skill info:', err);
        setOutputModal({ title: 'Error', content: `Failed to invoke skill: ${err}` });
      }
    }
  }, []);

  return {
    commandPaletteOpen,
    setCommandPaletteOpen,
    outputModal,
    setOutputModal,
    workspacePickerOpen,
    setWorkspacePickerOpen,
    blockerThreadId,
    setBlockerThreadId,
    shellTerminal,
    setShellTerminal,
    openShellTerminal,
    closeShellTerminal,
    minimizeShellTerminal,
    restoreShellTerminal,
    handleShareThread,
    handleShowSkills,
    handleShowTools,
    handleShowMcpStatus,
    handleShowMcpList,
    handleShowPermissions,
    handleShowHelp,
    handleContextAnalyze,
    handleIdeConnect,
    handleShowToolbox,
    handleSkillAdd,
    handleSkillRemove,
    handleSkillInvoke,
  };
}
