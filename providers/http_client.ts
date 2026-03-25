export interface HttpRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
}

const DEFAULT_OPTIONS: Required<
  Pick<HttpRetryOptions, "maxRetries" | "baseDelayMs" | "maxDelayMs">
> = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const shouldRetryStatus = (status: number): boolean => {
  return status === 429 || status >= 500;
};

const parseRetryAfterMs = (headerValue: string | null): number | undefined => {
  if (!headerValue) return undefined;

  const seconds = Number(headerValue);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
};

const computeDelayMs = (
  attempt: number,
  retryAfterMs: number | undefined,
  baseDelayMs: number,
  maxDelayMs: number,
): number => {
  if (retryAfterMs !== undefined) {
    return Math.min(retryAfterMs, maxDelayMs);
  }

  return Math.min(baseDelayMs * (2 ** attempt), maxDelayMs);
};

export const requestJsonWithRetry = async <T>(
  url: string,
  init: RequestInit,
  requestLabel: string,
  options: HttpRetryOptions = {},
): Promise<T> => {
  const maxRetries = options.maxRetries ?? DEFAULT_OPTIONS.maxRetries;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_OPTIONS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_OPTIONS.maxDelayMs;
  const fetchFn = options.fetchFn ?? fetch;
  const sleepFn = options.sleepFn ?? sleep;

  let attempt = 0;
  while (true) {
    let response: Response;
    try {
      response = await fetchFn(url, init);
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }

      const delayMs = computeDelayMs(
        attempt,
        undefined,
        baseDelayMs,
        maxDelayMs,
      );
      await sleepFn(delayMs);
      attempt++;
      continue;
    }

    if (response.ok) {
      return await response.json() as T;
    }

    if (!shouldRetryStatus(response.status) || attempt >= maxRetries) {
      throw new Error(
        `${requestLabel} request failed: ${response.status} ${response.statusText}`,
      );
    }

    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    const delayMs = computeDelayMs(
      attempt,
      retryAfterMs,
      baseDelayMs,
      maxDelayMs,
    );
    await sleepFn(delayMs);
    attempt++;
  }
};
