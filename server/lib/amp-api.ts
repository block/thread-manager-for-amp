import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

interface AmpConfig {
  url: string;
}

interface AmpAPIResponse<T = unknown> {
  ok?: boolean;
  result?: T;
  error?: {
    message?: string;
    code?: string;
  };
}

async function getAmpConfig(): Promise<AmpConfig> {
  const configPath = join(homedir(), '.config', 'amp', 'settings.json');

  try {
    const content = await readFile(configPath, 'utf-8');
    // Remove comments from JSON (Amp config has // comments)
    const cleanJson = content.replace(/^\s*\/\/.*$/gm, '');
    const config = JSON.parse(cleanJson) as Record<string, unknown>;
    return {
      url: (config['amp.url'] as string) || 'https://ampcode.com',
    };
  } catch {
    return { url: 'https://ampcode.com' };
  }
}

async function getAmpToken(ampUrl = 'https://ampcode.com'): Promise<string | null> {
  const secretsPath = join(homedir(), '.local', 'share', 'amp', 'secrets.json');

  try {
    const content = await readFile(secretsPath, 'utf-8');
    const secrets = JSON.parse(content) as Record<string, string>;

    // Token is stored as "apiKey@{url}/"
    const key = `apiKey@${ampUrl}/`;
    return secrets[key] || null;
  } catch {
    return null;
  }
}

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message;
    if (
      msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('fetch failed') ||
      msg.includes('UND_ERR_SOCKET')
    ) {
      return true;
    }
    const cause = (err as Error & { cause?: Error }).cause;
    if (cause instanceof Error) {
      return isRetryableError(cause);
    }
  }
  return false;
}

export async function callAmpInternalAPI<T = unknown>(
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const config = await getAmpConfig();
  const token = await getAmpToken(config.url);

  if (!token) {
    throw new Error('Not authenticated with Amp. Please run "amp" to log in.');
  }

  const url = `${config.url}/api/internal?${encodeURIComponent(method)}`;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          method,
          params,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Amp API error (${response.status}): ${text}`);
      }

      const result = (await response.json()) as AmpAPIResponse<T>;

      if (result.ok === false) {
        throw new Error(result.error?.message || result.error?.code || 'Unknown error');
      }

      return (result.result ?? result) as T;
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES - 1 && isRetryableError(err)) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt) + Math.random() * 200;
        console.warn(
          `Amp API call "${method}" failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${Math.round(delay)}ms:`,
          lastError.message,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }

  // eslint-disable-next-line @typescript-eslint/only-throw-error -- TODO: wrap lastError in a proper Error
  throw lastError;
}
