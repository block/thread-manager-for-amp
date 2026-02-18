export interface DiffLine {
  oldLines: string[];
  newLines: string[];
}

export function parseDiffToLines(diff: string): DiffLine {
  const oldLines: string[] = [];
  const newLines: string[] = [];

  const lines = diff.split('\n');
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      inHunk = true;
      oldLines.push('...');
      newLines.push('...');
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith('-') && !line.startsWith('---')) {
      oldLines.push(line.slice(1));
      newLines.push('');
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      oldLines.push('');
      newLines.push(line.slice(1));
    } else if (line.startsWith(' ') || line === '') {
      oldLines.push(line.slice(1) || '');
      newLines.push(line.slice(1) || '');
    }
  }

  return { oldLines, newLines };
}
