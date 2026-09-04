import { expect, test } from 'bun:test';
import { BoardGameModel } from 'packages/obsidian/src/models/BoardGameModel';
import { BookModel } from 'packages/obsidian/src/models/BookModel';
import { ComicMangaModel } from 'packages/obsidian/src/models/ComicMangaModel';
import { GameModel } from 'packages/obsidian/src/models/GameModel';
import { MovieModel } from 'packages/obsidian/src/models/MovieModel';
import { MusicReleaseModel } from 'packages/obsidian/src/models/MusicReleaseModel';
import { SeasonModel } from 'packages/obsidian/src/models/SeasonModel';
import { SeasonSearchResultModel } from 'packages/obsidian/src/models/SeasonSearchResultModel';
import { SeriesModel } from 'packages/obsidian/src/models/SeriesModel';
import { MediaType } from 'packages/obsidian/src/utils/MediaType';
import { MediaTypeManager } from 'packages/obsidian/src/utils/MediaTypeManager';

test('MediaTypeManager creates the expected model for every supported media type', () => {
	const manager = new MediaTypeManager();

	const cases = [
		[MediaType.BoardGame, BoardGameModel],
		[MediaType.Book, BookModel],
		[MediaType.ComicManga, ComicMangaModel],
		[MediaType.Game, GameModel],
		[MediaType.Movie, MovieModel],
		[MediaType.MusicRelease, MusicReleaseModel],
		[MediaType.Season, SeasonModel],
		[MediaType.Series, SeriesModel],
	] as const;

	for (const [mediaType, Model] of cases) {
		const model = manager.createMediaTypeModelFromMediaType({ title: 'Example' }, mediaType);

		expect(model).toBeInstanceOf(Model);
		expect(model.type).toBe(mediaType);
		expect(model.getMediaType()).toBe(mediaType);
	}

	expect(() => manager.createMediaTypeModelFromMediaType({}, 'unknown' as MediaType)).toThrow('Unknown media type: unknown');
});

test('MediaTypeModel metadata flattens user data and adds slash-separated tags', () => {
	const movie = new MovieModel({
		title: 'Arrival',
		englishTitle: 'Arrival',
		year: '2016',
		userData: { watched: true, lastWatched: '2026-01-02', personalRating: 9 },
	});

	expect(movie.toMetaDataObject()).toMatchObject({
		title: 'Arrival',
		watched: true,
		lastWatched: '2026-01-02',
		personalRating: 9,
		tags: 'mediaDB/tv/movie',
	});
	expect(movie.toMetaDataObject()).not.toHaveProperty('userData');
});

test('legacy flat user data is migrated into model userData defaults', () => {
	const book = new BookModel({ title: 'Dune', read: true, personalRating: 8 } as never);

	expect(book.userData).toEqual({ read: true, lastRead: '', personalRating: 8 });
	expect(book.type).toBe(MediaType.Book);
});

test('models with custom tag and metadata behavior preserve their special cases', () => {
	const manga = new ComicMangaModel({ title: 'Berserk', subType: 'manga' });
	const music = new MusicReleaseModel({ title: 'Kind of Blue', year: '1959', artists: ['Miles Davis'], subType: 'album' });
	const seasonSearchResult = new SeasonSearchResultModel({ seasonCount: 1 });

	expect(manga.getTags()).toEqual(['mediaDB', 'manga']);
	expect(music.getSummary()).toBe('Kind of Blue (1959) - Miles Davis');
	expect(seasonSearchResult.getSummary()).toBe('1 season');
});
