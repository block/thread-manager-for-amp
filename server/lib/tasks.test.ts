import { describe, it, expect } from 'vitest';
import { parseTasksOutput } from './tasks.js';

describe('parseTasksOutput', () => {
  it('parses checkbox-style tasks', () => {
    const output = `
- [x] Set up project structure (id: T-001)
- [ ] Implement authentication (id: T-002)
- [X] Write tests (id: T-003)
    `;
    const tasks = parseTasksOutput(output);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toEqual({ id: 'T-001', title: 'Set up project structure', status: 'done' });
    expect(tasks[1]).toEqual({ id: 'T-002', title: 'Implement authentication', status: 'pending' });
    expect(tasks[2]).toEqual({ id: 'T-003', title: 'Write tests', status: 'done' });
  });

  it('parses checkbox-style tasks without ids', () => {
    const output = `
- [x] Set up project
- [ ] Deploy to production
    `;
    const tasks = parseTasksOutput(output);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toEqual({ id: 'task-1', title: 'Set up project', status: 'done' });
    expect(tasks[1]).toEqual({ id: 'task-2', title: 'Deploy to production', status: 'pending' });
  });

  it('parses numbered list tasks with status brackets', () => {
    const output = `
1. Build the API [done]
2. Write documentation [pending]
3. Deploy [running]
    `;
    const tasks = parseTasksOutput(output);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toEqual({ id: 'task-1', title: 'Build the API', status: 'done' });
    expect(tasks[1]).toEqual({ id: 'task-2', title: 'Write documentation', status: 'pending' });
    expect(tasks[2]).toEqual({ id: 'task-3', title: 'Deploy', status: 'running' });
  });

  it('parses bullet-style tasks with em-dash status', () => {
    const output = `
• Set up CI — done
• Configure linting — pending
    `;
    const tasks = parseTasksOutput(output);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toEqual({ id: 'task-1', title: 'Set up CI', status: 'done' });
    expect(tasks[1]).toEqual({ id: 'task-2', title: 'Configure linting', status: 'pending' });
  });

  it('returns empty array for empty output', () => {
    expect(parseTasksOutput('')).toEqual([]);
    expect(parseTasksOutput('   \n\n  ')).toEqual([]);
  });

  it('returns empty array for unrecognized format', () => {
    const output = 'Some random output that is not a task list';
    expect(parseTasksOutput(output)).toEqual([]);
  });

  it('handles asterisk bullets', () => {
    const output = '* [x] Task completed';
    const tasks = parseTasksOutput(output);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.status).toBe('done');
  });
});
