import { expect, test } from 'bun:test';
import type { TFile } from 'obsidian';
import { TFolder } from 'obsidian';
import { MovieModel } from 'packages/obsidian/src/models/MovieModel';
import { PropertyMappingOption } from 'packages/obsidian/src/settings/PropertyMapping';
import { MediaDbFileHelper } from 'packages/obsidian/src/utils/MediaDbFileHelper';
import { MediaType } from 'packages/obsidian/src/utils/MediaType';

function createHelper(fileContent = '', frontmatter: Record<string, unknown> = {}): MediaDbFileHelper {
	return new MediaDbFileHelper({
		app: {
			metadataCache: {
				getFileCache: () => ({ frontmatter }),
			},
			vault: {
				read: async () => fileContent,
			},
		},
	} as never);
}

test('getMetaDataFromFileContent parses frontmatter and ignores body-only files', () => {
	const helper = createHelper();

	expect(helper.getMetaDataFromFileContent('---\ntitle: Arrival\nyear: 2016\nwatched: true\n---\nBody')).toEqual({
		title: 'Arrival',
		year: 2016,
		watched: true,
	});
	expect(helper.getMetaDataFromFileContent('Body only')).toEqual({});
});

test('attachTemplate merges template metadata behind existing metadata and appends template body', async () => {
	const helper = createHelper();

	const result = await helper.attachTemplate({ title: 'Arrival', id: '1' }, 'Existing\n', '---\ntitle: Template\nrating: 8\n---\nTemplate body');

	expect(result.fileMetadata).toEqual({ title: 'Arrival', rating: 8, id: '1' });
	expect(result.fileContent).toBe('Existing\n\nTemplate body');
});

test('attachFile merges attached note metadata behind generated metadata and strips frontmatter', async () => {
	const helper = createHelper('---\ntitle: Old title\ncustom: keep\n---\nAttached body', { title: 'Old title', custom: 'keep' });
	const file = { path: 'old.md' } as TFile;

	const result = await helper.attachFile({ title: 'New title', id: '1' }, '', file);

	expect(result.fileMetadata).toEqual({ title: 'New title', custom: 'keep', id: '1' });
	expect(result.fileContent).toBe('Attached body');
});

test('getMetadataFromFileCache returns a clone instead of cache object reference', () => {
	const frontmatter = { title: 'Arrival', nested: { rating: 9 } };
	const helper = createHelper('', frontmatter);
	const metadata = helper.getMetadataFromFileCache({ path: 'movie.md' } as TFile);

	(metadata.nested as { rating: number }).rating = 1;

	expect(frontmatter.nested.rating).toBe(9);
});

test('updateNoteMerging rewrites api fields in place, keeps user fields and never recreates the file', async () => {
	const model = new MovieModel({ id: '550', title: 'Fight Club', year: '1999', dataSource: 'TMDBMovieAPI', onlineRating: 8.4 });
	const frontmatter: Record<string, unknown> = {
		id: '550',
		type: 'movie',
		dataSource: 'TMDBMovieAPI',
		title: 'Fight club',
		onlineRating: 8.1,
		personalRating: 10,
		watched: true,
		myNotes: 'keep me',
	};

	const properties = Object.keys(model.toMetaDataObject()).map(property => ({
		property,
		newProperty: '',
		mapping: PropertyMappingOption.Default,
		locked: false,
		wikilink: false,
	}));

	const helper = new MediaDbFileHelper({
		settings: { imageDownload: false, propertyMappingModels: [{ type: MediaType.Movie, properties }] },
		modelPropertyMapper: { convertObject: (obj: Record<string, unknown>) => obj },
		app: {
			fileManager: {
				processFrontMatter: async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => fn(frontmatter),
			},
		},
	} as never);

	const result = await helper.updateNoteMerging({ path: 'Movies/Fight Club.md' } as TFile, model);

	expect(result.ok).toBe(true);
	expect(frontmatter.title).toBe('Fight Club');
	expect(frontmatter.onlineRating).toBe(8.4);
	// user owned fields survive the refresh, even though the api reseeds them with its defaults
	expect(frontmatter.personalRating).toBe(10);
	expect(frontmatter.watched).toBe(true);
	expect(frontmatter.myNotes).toBe('keep me');
	expect(typeof frontmatter.lastUpdate).toBe('string');
});

test('createNote trashes the existing file without prompting again once the overwrite is confirmed', async () => {
	const trashed: string[] = [];
	const created: string[] = [];
	const folder = Object.assign(new TFolder(), { path: 'Movies' });

	const helper = new MediaDbFileHelper({
		app: {
			vault: {
				getAbstractFileByPath: (path: string) => ({ path }),
				create: async (path: string) => {
					created.push(path);
					return { path };
				},
			},
			fileManager: {
				trashFile: async (file: { path: string }) => {
					trashed.push(file.path);
				},
			},
		},
	} as never);

	// without the flag this would open a modal the mock never closes, and the test would time out
	const result = await helper.createNote('Fight Club', 'content', { folder, overwriteConfirmed: true, openNote: false });

	expect(result.ok).toBe(true);
	expect(trashed).toEqual(['Movies/Fight Club.md']);
	expect(created).toEqual(['Movies/Fight Club.md']);
});
