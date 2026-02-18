// Re-export for backward compatibility
export { formatMessageContent } from './threadParsing.js';
export { getRepoFromGitConfig } from './workspaces.js';

// Domain modules
export {
  getThreads,
  getThreadChanges,
  archiveThread,
  deleteThread,
  createThread,
  getKnownWorkspaces,
  renameThread,
  shareThread,
} from './threadCrud.js';
export { searchThreads, getRelatedThreads } from './threadSearch.js';
export { getThreadMarkdown, getThreadImages } from './threadExport.js';
export { getThreadChain, handoffThread } from './threadChain.js';
