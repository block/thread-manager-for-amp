import { readdir, readFile, stat } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { AMP_HOME } from './constants.js';
import { runAmp, stripAnsi } from './utils.js';

interface SkillOutput {
  output: string;
}

interface SkillMutationResult {
  output: string;
  success: boolean;
}

export interface SkillInfo {
  name: string;
  description: string;
  source: string;
}

export interface SkillsSummary {
  count: number;
  skills: SkillInfo[];
}

export async function listSkills(): Promise<SkillOutput> {
  const stdout = await runAmp(['skill', 'list']);
  return { output: stripAnsi(stdout) };
}

export async function getSkillsSummary(): Promise<SkillsSummary> {
  const stdout = await runAmp(['skill', 'list']);
  const output = stripAnsi(stdout);

  // Parse the output to extract skill info
  // Format: "Available skills (42):" followed by bullet items
  const skills: SkillInfo[] = [];

  // Extract count from header
  const countMatch = output.match(/Available skills \((\d+)\)/);
  const count = countMatch?.[1] ? parseInt(countMatch[1], 10) : 0;

  // Parse each skill entry
  // Format: "  • skill-name\n    Description...\n    source-path"
  const lines = output.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }
    const skillMatch = line.match(/^\s*[•]\s+(.+)$/);

    if (skillMatch?.[1]) {
      const name = skillMatch[1].trim();
      let description = '';
      let source = '';

      // Next line should be description
      const nextLine = lines[i + 1];
      if (nextLine && !nextLine.match(/^\s*[•]/)) {
        description = nextLine.trim();
        i++;
      }

      // Next line should be source
      const sourceLine = lines[i + 1];
      if (sourceLine && !sourceLine.match(/^\s*[•]/)) {
        source = sourceLine.trim();
        i++;
      }

      skills.push({ name, description, source });
    }
    i++;
  }

  return { count: count || skills.length, skills };
}

export async function addSkill(source: string): Promise<SkillMutationResult> {
  const stdout = await runAmp(['skill', 'add', source]);
  return { output: stripAnsi(stdout), success: true };
}

export async function removeSkill(name: string): Promise<SkillMutationResult> {
  const stdout = await runAmp(['skill', 'remove', name]);
  return { output: stripAnsi(stdout), success: true };
}

export async function getSkillInfo(name: string): Promise<SkillOutput> {
  const stdout = await runAmp(['skill', 'info', name]);
  return { output: stripAnsi(stdout) };
}

export async function listTools(): Promise<SkillOutput> {
  const stdout = await runAmp(['tools', 'list']);
  return { output: stripAnsi(stdout) };
}

export async function getMcpStatus(): Promise<SkillOutput> {
  const stdout = await runAmp(['mcp', 'doctor']);
  return { output: stripAnsi(stdout) };
}

export async function listMcp(): Promise<SkillOutput> {
  const stdout = await runAmp(['mcp', 'list']);
  return { output: stripAnsi(stdout) };
}

export async function listPermissions(): Promise<SkillOutput> {
  const stdout = await runAmp(['permissions', 'list']);
  return { output: stripAnsi(stdout) };
}

export function getSettingsPath(): string {
  return join(AMP_HOME, '.config', 'amp', 'settings.json');
}

export async function getAmpHelp(): Promise<SkillOutput> {
  const stdout = await runAmp(['--help']);
  return { output: stripAnsi(stdout) };
}

export async function listAgentsMd(workspacePath?: string): Promise<SkillOutput> {
  const files: string[] = [];

  // Scan common locations for AGENTS.md files
  const searchDirs: string[] = [];
  if (workspacePath) {
    searchDirs.push(workspacePath);
    searchDirs.push(join(workspacePath, '.agents'));
    searchDirs.push(join(workspacePath, '.config', 'amp'));
  }
  const homeConfig = join(AMP_HOME, '.config', 'amp');
  searchDirs.push(homeConfig);

  for (const dir of searchDirs) {
    try {
      const entries = await readdir(dir);
      for (const entry of entries) {
        if (/^agents\.md$/i.test(entry)) {
          files.push(join(dir, entry));
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  // Also check workspace root for nested .agents/ directories
  if (workspacePath) {
    try {
      const entries = await readdir(workspacePath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const nested = join(workspacePath, entry.name, 'AGENTS.md');
          try {
            await stat(nested);
            files.push(nested);
          } catch {
            // Not found
          }
        }
      }
    } catch {
      // Skip
    }
  }

  if (files.length === 0) {
    return { output: 'No AGENTS.md files found.' };
  }

  const output = `Found ${files.length} AGENTS.md file(s):\n\n${files.map((f) => `  • ${f}`).join('\n')}`;
  return { output };
}

export async function getUsage(): Promise<SkillOutput> {
  const stdout = await runAmp(['usage']);
  return { output: stripAnsi(stdout) };
}

export async function getAmpVersion(): Promise<SkillOutput> {
  const stdout = await runAmp(['--version']);
  return { output: stripAnsi(stdout) };
}

export async function setThreadVisibility(
  threadId: string,
  visibility: string,
): Promise<SkillMutationResult> {
  const stdout = await runAmp([
    'threads',
    'share',
    threadId,
    '--visibility',
    visibility.toLowerCase(),
  ]);
  return { output: stripAnsi(stdout), success: true };
}

export interface CustomTheme {
  name: string;
  bg: string;
  fg: string;
  accent: string;
}

export async function getCustomThemes(): Promise<CustomTheme[]> {
  const themesDir = join(homedir(), '.config', 'amp', 'themes');
  let entries: string[];
  try {
    entries = await readdir(themesDir);
  } catch {
    return [];
  }

  const themes: CustomTheme[] = [];
  for (const entry of entries) {
    const colorsPath = join(themesDir, entry, 'colors.toml');
    try {
      const content = await readFile(colorsPath, 'utf-8');
      const theme = parseColorsToml(content, entry);
      if (theme) themes.push(theme);
    } catch {
      // Skip directories without colors.toml
    }
  }
  return themes;
}

function parseColorsToml(content: string, name: string): CustomTheme | null {
  const get = (key: string): string | undefined => {
    const m = content.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm'));
    return m?.[1];
  };

  const bg = get('background') || get('bg');
  const fg = get('foreground') || get('fg');
  const accent = get('accent') || get('primary');

  if (!bg || !fg || !accent) return null;
  return { name, bg, fg, accent };
}
