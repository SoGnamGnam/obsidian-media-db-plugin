import { expect, test } from 'bun:test';
import { APIModel, isSeasonListAPIModel } from 'packages/obsidian/src/api/APIModel';
import type { MediaTypeModel } from 'packages/obsidian/src/models/MediaTypeModel';
import type { MDBError } from 'packages/obsidian/src/utils/MDBError';
import { MediaType } from 'packages/obsidian/src/utils/MediaType';
import type { Result } from 'packages/obsidian/src/utils/result';
import { ok } from 'packages/obsidian/src/utils/result';

class FakeAPI extends APIModel {
	apiName = 'fake';
	apiUrl = 'https://example.test';
	apiDescription = 'Fake API';
	types = [MediaType.Movie, MediaType.Series];
	disabledTypes: MediaType[] = [];

	async searchByTitle(): Promise<Result<MediaTypeModel[], MDBError>> {
		return ok([]);
	}

	async getById(): Promise<Result<MediaTypeModel, MDBError>> {
		throw new Error('not needed');
	}

	getDisabledMediaTypes(): MediaType[] {
		return this.disabledTypes;
	}
}

test('APIModel respects configured and disabled media types', () => {
	const api = new FakeAPI();

	expect(api.hasType(MediaType.Movie)).toBe(true);
	expect(api.hasType(MediaType.Book)).toBe(false);
	expect(api.hasTypeOverlap([MediaType.Book, MediaType.Series])).toBe(true);

	api.disabledTypes = [MediaType.Series];

	expect(api.hasType(MediaType.Series)).toBe(false);
	expect(api.hasTypeOverlap([MediaType.Book, MediaType.Series])).toBe(false);
});

test('isSeasonListAPIModel detects season-capable APIs', () => {
	const api = new FakeAPI();

	expect(isSeasonListAPIModel(undefined)).toBe(false);
	expect(isSeasonListAPIModel(api)).toBe(false);

	api.getSeasonsForSeries = async () => ok([]);

	expect(isSeasonListAPIModel(api)).toBe(true);
});
