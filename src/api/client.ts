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
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;

  return fetch(url, { ...options, signal })
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

export async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetchWithTimeout(url, { signal });
  return handleResponse(response, (res) => res.json() as Promise<T>);
}

export async function apiGetText(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetchWithTimeout(url, { signal });
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
