import { runAmp, stripAnsi } from './utils.js';

export interface Task {
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

export function parseTasksOutput(output: string): Task[] {
  const tasks: Task[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Common patterns from amp tasks list output:
    // "- [x] Task title (id: 123)" or "- [ ] Task title (id: 123)"
    // "1. Task title [done]" or "1. Task title [pending]"
    // "• Task title — status"
    // Also handle: "ID  Title  Status" table-like output

    // Pattern: checkbox-style "- [x] title (id: xxx)"
    const checkboxMatch = trimmed.match(/^[-*]\s*\[([ xX])\]\s+(.+?)(?:\s*\(id:\s*(\S+)\))?$/);
    if (checkboxMatch) {
      const status = checkboxMatch[1] === ' ' ? 'pending' : 'done';
      tasks.push({
        id: checkboxMatch[3] || `task-${tasks.length + 1}`,
        title: checkboxMatch[2]?.trim() || '',
        status,
      });
      continue;
    }

    // Pattern: numbered list "1. title [status]"
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+?)\s*\[(\w+)\]\s*$/);
    if (numberedMatch) {
      tasks.push({
        id: `task-${tasks.length + 1}`,
        title: numberedMatch[1]?.trim() || '',
        status: numberedMatch[2]?.toLowerCase() || 'unknown',
      });
      continue;
    }

    // Pattern: bullet "• title — status"
    const bulletMatch = trimmed.match(/^[•]\s+(.+?)\s*[—-]\s*(\w+)\s*$/);
    if (bulletMatch) {
      tasks.push({
        id: `task-${tasks.length + 1}`,
        title: bulletMatch[1]?.trim() || '',
        status: bulletMatch[2]?.toLowerCase() || 'unknown',
      });
      continue;
    }
  }

  return tasks;
}

export async function listTasks(workspace?: string): Promise<TasksResult> {
  const output = await runAmp(['tasks', 'list'], { cwd: workspace });
  const clean = stripAnsi(output);
  return { tasks: parseTasksOutput(clean), raw: clean };
}

export async function importTasks(source: string, workspace?: string): Promise<ImportResult> {
  const output = await runAmp(['tasks', 'import', source], { cwd: workspace });
  return { output: stripAnsi(output), success: true };
}
