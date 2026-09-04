import { expect, test } from 'bun:test';
import { andThen, cancelled, err, failure, fromPromise, isErr, isOk, mapError, mapResult, ok, OutcomeStatus, skipped, success, tapError } from 'packages/obsidian/src/utils/result';
import type { Result } from 'packages/obsidian/src/utils/result';

test('Result helpers construct and narrow ok and error values', () => {
	const good = ok(2);
	const bad = err('failed');

	expect(isOk(good)).toBe(true);
	expect(isErr(good)).toBe(false);
	expect(isOk(bad)).toBe(false);
	expect(isErr(bad)).toBe(true);
});

test('Result combinators map only the matching branch', () => {
	const good: Result<number, string> = ok(2);
	const bad: Result<number, string> = err('failed');
	let tappedError = '';

	expect(mapResult(good, value => value * 2)).toEqual(ok(4));
	expect(mapResult<number, string, number>(bad, value => value * 2)).toBe(bad);
	expect(mapError<number, string, string>(good, error => error.toUpperCase())).toBe(good);
	expect(mapError(bad, error => error.toUpperCase())).toEqual(err('FAILED'));
	expect(andThen(good, value => ok(String(value)))).toEqual(ok('2'));
	expect(andThen(bad, value => ok(String(value)))).toBe(bad);
	expect(tapError(bad, error => (tappedError = error))).toBe(bad);
	expect(tappedError).toBe('failed');
});

test('fromPromise captures resolved values and maps rejection causes', async () => {
	await expect(fromPromise(Promise.resolve('done'), String)).resolves.toEqual(ok('done'));
	await expect(fromPromise(Promise.reject(new Error('boom')), cause => (cause as Error).message)).resolves.toEqual(err('boom'));
});

test('Outcome helpers construct the expected statuses', () => {
	expect(success('done')).toEqual({ status: OutcomeStatus.Ok, data: 'done' });
	expect(failure('bad')).toEqual({ status: OutcomeStatus.Error, error: 'bad' });
	expect(cancelled()).toEqual({ status: OutcomeStatus.Cancelled });
	expect(skipped()).toEqual({ status: OutcomeStatus.Skipped });
});
