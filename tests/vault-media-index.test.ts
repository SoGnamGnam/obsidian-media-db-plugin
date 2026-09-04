import { expect, test } from 'bun:test';
import type { TFile } from 'obsidian';
import type { MediaTypeModel } from 'packages/obsidian/src/models/MediaTypeModel';
import { VaultMediaIndex } from 'packages/obsidian/src/utils/VaultMediaIndex';

interface FakeNote {
	path: string;
	frontmatter?: Record<string, unknown>;
}

function createIndex(notes: FakeNote[]): VaultMediaIndex {
	const files = notes.map(note => ({ path: note.path }) as TFile);
	const frontmatterByPath = new Map(notes.map(note => [note.path, note.frontmatter]));

	return new VaultMediaIndex({
		app: {
			vault: {
				getMarkdownFiles: () => files,
			},
			metadataCache: {
				getFileCache: (file: TFile) => {
					const frontmatter = frontmatterByPath.get(file.path);
					return frontmatter ? { frontmatter } : undefined;
				},
			},
		},
	} as never);
}

function searchResult(model: Partial<MediaTypeModel>): MediaTypeModel {
	return model as MediaTypeModel;
}

test('find matches on dataSource and id, coercing yaml numbers to strings', () => {
	const index = createIndex([{ path: 'Movies/Fight Club.md', frontmatter: { id: 550, type: 'movie', dataSource: 'TMDBMovieAPI', lastUpdate: '2026-06-04T12:00:00.000Z' } }]);
	index.build();

	const match = index.find(searchResult({ id: '550', type: 'movie', dataSource: 'TMDBMovieAPI' }));

	expect(match?.file.path).toBe('Movies/Fight Club.md');
	expect(match?.lastUpdate).toBe('2026-06-04T12:00:00.000Z');
});

test('find does not confuse identical ids coming from different apis', () => {
	const index = createIndex([{ path: 'Movies/Fight Club.md', frontmatter: { id: 550, type: 'movie', dataSource: 'TMDBMovieAPI' } }]);
	index.build();

	expect(index.find(searchResult({ id: '550', type: 'series', dataSource: 'MALAPI' }))).toBeUndefined();
});

test('find falls back to type and id for legacy notes without a dataSource', () => {
	const index = createIndex([{ path: 'Movies/Arrival.md', frontmatter: { id: '329865', type: 'movie' } }]);
	index.build();

	const match = index.find(searchResult({ id: '329865', type: 'movie', dataSource: 'TMDBMovieAPI' }));

	expect(match?.file.path).toBe('Movies/Arrival.md');
	expect(match?.lastUpdate).toBeUndefined();
});

test('find treats the legacy manga type as comicManga', () => {
	const index = createIndex([{ path: 'Manga/Berserk.md', frontmatter: { id: '2', type: 'manga' } }]);
	index.build();

	expect(index.find(searchResult({ id: '2', type: 'comicManga', dataSource: 'MALAPIManga' }))?.file.path).toBe('Manga/Berserk.md');
});

test('build skips notes without an id and ignores files with no frontmatter', () => {
	const index = createIndex([{ path: 'Notes/Plain.md' }, { path: 'Notes/NoId.md', frontmatter: { type: 'movie', dataSource: 'TMDBMovieAPI' } }]);
	index.build();

	expect(index.find(searchResult({ id: '', type: 'movie', dataSource: 'TMDBMovieAPI' }))).toBeUndefined();
});

test('build is skipped while fresh and redone after invalidate', () => {
	let calls = 0;
	const index = new VaultMediaIndex({
		app: {
			vault: {
				getMarkdownFiles: () => {
					calls += 1;
					return [];
				},
			},
			metadataCache: { getFileCache: () => undefined },
		},
	} as never);

	index.build();
	index.build();
	expect(calls).toBe(1);

	index.invalidate();
	index.build();
	expect(calls).toBe(2);
});
