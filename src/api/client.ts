const DEFAULT_TIMEOUT_MS = 30000;

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;

  constructor(message: string, status: number, statusText: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
  }
}

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}

async function handleResponse<T>(response: Response, parser: (res: Response) => Promise<T>): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(
      text || `Request failed: ${response.statusText}`,
      response.status,
      response.statusText
    );
  }
  return parser(response);
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(url);
  return handleResponse(response, (res) => res.json() as Promise<T>);
}

export async function apiGetText(url: string): Promise<string> {
  const response = await fetchWithTimeout(url);
  return handleResponse(response, (res) => res.text());
}

export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const response = await fetchWithTimeout(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(response, (res) => res.json() as Promise<T>);
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(response, (res) => res.json() as Promise<T>);
}

export async function apiDelete<T>(url: string, body: unknown): Promise<T> {
  const response = await fetchWithTimeout(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(response, (res) => res.json() as Promise<T>);
}

export async function apiPut<T>(url: string, body: unknown): Promise<T> {
  const response = await fetchWithTimeout(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(response, (res) => res.json() as Promise<T>);
}
