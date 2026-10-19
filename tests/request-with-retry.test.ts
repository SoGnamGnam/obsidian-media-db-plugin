import { expect, test } from 'bun:test';
import type { RequestUrlResponse } from 'obsidian';
import { parseRetryAfter, withRetry } from 'packages/obsidian/src/utils/requestWithRetry';

function response(status: number, headers: Record<string, string> = {}): RequestUrlResponse {
	return { status, headers } as RequestUrlResponse;
}

function sequence(...steps: (RequestUrlResponse | Error)[]): { send: () => Promise<RequestUrlResponse>; calls: () => number } {
	let calls = 0;
	return {
		send: async (): Promise<RequestUrlResponse> => {
			const step = steps[Math.min(calls++, steps.length - 1)];
			if (step instanceof Error) {
				throw step;
			}
			return step;
		},
		calls: (): number => calls,
	};
}

function recordSleeps(): { sleep: (ms: number) => Promise<void>; delays: number[] } {
	const delays: number[] = [];
	return { sleep: async (ms: number): Promise<void> => void delays.push(ms), delays };
}

test('withRetry retries 503 until success', async () => {
	const { send, calls } = sequence(response(503), response(503), response(200));
	const { sleep, delays } = recordSleeps();

	const result = await withRetry(send, 'test', { sleep });

	expect(result.status).toBe(200);
	expect(calls()).toBe(3);
	expect(delays).toHaveLength(2);
});

test('withRetry gives up after maxRetries and returns the last response', async () => {
	const { send, calls } = sequence(response(503));
	const { sleep } = recordSleeps();

	const result = await withRetry(send, 'test', { sleep, maxRetries: 2 });

	expect(result.status).toBe(503);
	expect(calls()).toBe(3);
});

test('withRetry does not retry client errors', async () => {
	for (const status of [400, 401, 404]) {
		const { send, calls } = sequence(response(status));
		const result = await withRetry(send, 'test', { sleep: recordSleeps().sleep });
		expect(result.status).toBe(status);
		expect(calls()).toBe(1);
	}
});

test('withRetry retries 429 only when Retry-After is present and short', async () => {
	const withoutHeader = sequence(response(429), response(200));
	expect((await withRetry(withoutHeader.send, 'test', { sleep: recordSleeps().sleep })).status).toBe(429);

	const tooLong = sequence(response(429, { 'Retry-After': '60' }), response(200));
	expect((await withRetry(tooLong.send, 'test', { sleep: recordSleeps().sleep })).status).toBe(429);

	const short = sequence(response(429, { 'retry-after': '2' }), response(200));
	const { sleep, delays } = recordSleeps();
	expect((await withRetry(short.send, 'test', { sleep })).status).toBe(200);
	expect(delays).toEqual([2000]);
});

test('withRetry honors and caps Retry-After on 503', async () => {
	const { send } = sequence(response(503, { 'Retry-After': '120' }), response(200));
	const { sleep, delays } = recordSleeps();

	await withRetry(send, 'test', { sleep, maxDelayMs: 5000 });

	expect(delays).toEqual([5000]);
});

test('withRetry retries network errors and rethrows when exhausted', async () => {
	const recovering = sequence(new Error('offline'), response(200));
	expect((await withRetry(recovering.send, 'test', { sleep: recordSleeps().sleep })).status).toBe(200);

	const failing = sequence(new Error('offline'));
	await expect(withRetry(failing.send, 'test', { sleep: recordSleeps().sleep, maxRetries: 1 })).rejects.toThrow('offline');
});

test('withRetry backoff grows and stays within maxDelayMs', async () => {
	const { send } = sequence(response(503));
	const { sleep, delays } = recordSleeps();

	await withRetry(send, 'test', { sleep, maxRetries: 6, baseDelayMs: 100, maxDelayMs: 1000 });

	expect(delays).toHaveLength(6);
	delays.forEach((delay, attempt) => {
		const exp = Math.min(1000, 100 * 2 ** attempt);
		expect(delay).toBeGreaterThanOrEqual(exp / 2);
		expect(delay).toBeLessThanOrEqual(exp);
	});
});

test('parseRetryAfter handles seconds, dates and garbage', () => {
	expect(parseRetryAfter('3')).toBe(3000);
	expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
	expect(parseRetryAfter('soon')).toBeUndefined();
	expect(parseRetryAfter(undefined)).toBeUndefined();
});
