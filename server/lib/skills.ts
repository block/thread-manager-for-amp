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
