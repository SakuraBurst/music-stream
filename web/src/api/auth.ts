import type { AuthTokens } from '../types/index.ts';

const BASE_URL = '/api/v1';

interface ErrorBody {
  error: string;
}

export class AuthApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

async function authFetch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data: ErrorBody = await response.json();
      message = data.error;
    } catch {
      // use statusText
    }
    throw new AuthApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

export function apiLogin(
  username: string,
  password: string,
): Promise<AuthTokens> {
  return authFetch<AuthTokens>('/auth/login', { username, password });
}

export function apiRegister(
  username: string,
  password: string,
): Promise<AuthTokens> {
  return authFetch<AuthTokens>('/auth/register', { username, password });
}

export function apiRefreshToken(
  refreshToken: string,
): Promise<AuthTokens> {
  return authFetch<AuthTokens>('/auth/refresh', { refreshToken });
}
