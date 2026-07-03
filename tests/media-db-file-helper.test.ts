import { expect, test } from 'bun:test';
import type { TFile } from 'obsidian';
import { MediaDbFileHelper } from 'packages/obsidian/src/utils/MediaDbFileHelper';

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
