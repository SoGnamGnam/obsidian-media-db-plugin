import type { RequestUrlParam, RequestUrlResponse } from 'obsidian';
import { requestUrl } from 'obsidian';
import { Logger } from 'packages/obsidian/src/utils/Logger';

export interface RetryOptions {
	/** How many times to retry after the first attempt. */
	maxRetries?: number;
	/** Base delay for exponential backoff. */
	baseDelayMs?: number;
	/** Upper bound for a single wait, also caps `Retry-After`. */
	maxDelayMs?: number;
	sleep?: (ms: number) => Promise<void>;
}

/** Transient server-side failures that are worth retrying. */
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

const DEFAULT_OPTIONS: Required<RetryOptions> = {
	maxRetries: 3,
	baseDelayMs: 500,
	maxDelayMs: 8000,
	sleep: ms => new Promise(resolve => window.setTimeout(resolve, ms)),
};

function getHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
	if (!headers) {
		return undefined;
	}
	const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
	return key ? headers[key] : undefined;
}

/**
 * Parses a `Retry-After` header (seconds or HTTP date) into milliseconds.
 */
export function parseRetryAfter(value: string | undefined, now: number = Date.now()): number | undefined {
	if (!value) {
		return undefined;
	}
	const seconds = Number(value);
	if (Number.isFinite(seconds)) {
		return Math.max(0, seconds * 1000);
	}
	const date = Date.parse(value);
	if (!Number.isNaN(date)) {
		return Math.max(0, date - now);
	}
	return undefined;
}

/**
 * Decides whether a response should be retried and, if so, how long to wait.
 * 429 is only retried when the server tells us when to come back, since quota errors usually don't recover in seconds.
 */
function getRetryDelay(response: RequestUrlResponse, attempt: number, options: Required<RetryOptions>): number | undefined {
	const retryAfter = parseRetryAfter(getHeader(response.headers, 'retry-after'));

	if (response.status === 429) {
		if (retryAfter === undefined || retryAfter > options.maxDelayMs) {
			return undefined;
		}
		return retryAfter;
	}
	if (!RETRYABLE_STATUSES.has(response.status)) {
		return undefined;
	}
	return retryAfter !== undefined ? Math.min(retryAfter, options.maxDelayMs) : backoffDelay(attempt, options);
}

/** Exponential backoff with full jitter. */
function backoffDelay(attempt: number, options: Required<RetryOptions>): number {
	const exp = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** attempt);
	return Math.round(exp / 2 + Math.random() * (exp / 2));
}

/**
 * Runs `send` and retries on transient HTTP statuses (5xx, 429 with Retry-After) and on network errors.
 * `send` must not throw on HTTP error statuses (use `throw: false`).
 */
export async function withRetry(send: () => Promise<RequestUrlResponse>, label: string, options: RetryOptions = {}): Promise<RequestUrlResponse> {
	const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options };

	for (let attempt = 0; ; attempt++) {
		let response: RequestUrlResponse;
		try {
			response = await send();
		} catch (e) {
			if (attempt >= opts.maxRetries) {
				throw e;
			}
			const delay = backoffDelay(attempt, opts);
			Logger.warn(`MDB | Network error for ${label}, retrying in ${delay}ms (${attempt + 1}/${opts.maxRetries})`, e);
			await opts.sleep(delay);
			continue;
		}

		const delay = attempt < opts.maxRetries ? getRetryDelay(response, attempt, opts) : undefined;
		if (delay === undefined) {
			return response;
		}
		Logger.warn(`MDB | Received status ${response.status} for ${label}, retrying in ${delay}ms (${attempt + 1}/${opts.maxRetries})`);
		await opts.sleep(delay);
	}
}

/**
 * Drop-in replacement for Obsidian's `requestUrl` that retries transient failures.
 * Respects the caller's `throw` option: unless `throw: false` is passed, the final response throws on status >= 400, like `requestUrl`.
 * Only use for idempotent requests (all plugin API calls are read-only lookups, including the POST query endpoints).
 */
export async function requestUrlWithRetry(request: RequestUrlParam, options?: RetryOptions): Promise<RequestUrlResponse> {
	const label = new URL(request.url).host;
	const response = await withRetry(() => requestUrl({ ...request, throw: false }), label, options);

	if (request.throw !== false && response.status >= 400) {
		throw Object.assign(new Error(`Request failed, status ${response.status}`), { status: response.status, headers: response.headers });
	}
	return response;
}
