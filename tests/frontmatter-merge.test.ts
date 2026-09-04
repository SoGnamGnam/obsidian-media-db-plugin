import { expect, test } from 'bun:test';
import type { PropertyMappingData } from 'packages/obsidian/src/settings/PropertyMapping';
import { PropertyMappingOption } from 'packages/obsidian/src/settings/PropertyMapping';
import { getOwnedProperties, mergeFrontmatter } from 'packages/obsidian/src/utils/frontmatterMerge';

function mapping(property: string, mappingOption: PropertyMappingOption = PropertyMappingOption.Default, newProperty = ''): PropertyMappingData {
	return { property, newProperty, mapping: mappingOption, locked: false, wikilink: false };
}

test('getOwnedProperties collects the raw and the remapped name of every property', () => {
	const owned = getOwnedProperties([mapping('title'), mapping('onlineRating', PropertyMappingOption.Map, 'voto'), mapping('boxOffice', PropertyMappingOption.Remove)]);

	expect(owned).toEqual([
		{ property: 'title', targetKey: 'title', ownedKeys: ['title'] },
		{ property: 'onlineRating', targetKey: 'voto', ownedKeys: ['onlineRating', 'voto'] },
		{ property: 'boxOffice', targetKey: null, ownedKeys: ['boxOffice'] },
	]);
});

test('api fields are overwritten while keys the user added are left alone', () => {
	const owned = getOwnedProperties([mapping('title'), mapping('onlineRating')]);

	const result = mergeFrontmatter({ title: 'Old title', onlineRating: 7, myNotes: 'keep me', 'reading-status': 'done' }, { title: 'New title', onlineRating: 8.3 }, owned, []);

	expect(result.merged).toEqual({ title: 'New title', onlineRating: 8.3, myNotes: 'keep me', 'reading-status': 'done' });
	expect(result.updated.sort()).toEqual(['onlineRating', 'title']);
	expect(result.preserved.sort()).toEqual(['myNotes', 'reading-status']);
});

test('a note written before a remap is migrated to the new key instead of gaining an orphan', () => {
	const owned = getOwnedProperties([mapping('onlineRating', PropertyMappingOption.Map, 'voto')]);

	// note on disk still uses the raw name, the payload already uses the remapped one
	const result = mergeFrontmatter({ onlineRating: 7, myNotes: 'keep me' }, { voto: 8.3 }, owned, []);

	expect(result.merged).toEqual({ voto: 8.3, myNotes: 'keep me' });
	expect(result.added).toEqual(['voto']);
	expect(result.removed).toEqual(['onlineRating']);
});

test('a property mapped to Remove is dropped from notes that still carry it', () => {
	const owned = getOwnedProperties([mapping('boxOffice', PropertyMappingOption.Remove), mapping('title')]);

	const result = mergeFrontmatter({ title: 'Old title', boxOffice: '$100M' }, { title: 'New title' }, owned, []);

	expect(result.merged).toEqual({ title: 'New title' });
	expect(result.removed).toEqual(['boxOffice']);
});

test('userData fields are never overwritten by the api defaults', () => {
	const owned = getOwnedProperties([mapping('title'), mapping('watched'), mapping('personalRating')]);

	const result = mergeFrontmatter({ title: 'Old title', watched: true, personalRating: 9 }, { title: 'New title', watched: false, personalRating: 0 }, owned, [
		'watched',
		'personalRating',
	]);

	expect(result.merged).toEqual({ title: 'New title', watched: true, personalRating: 9 });
	expect(result.updated).toEqual(['title']);
});

test('a missing userData field is seeded from the payload', () => {
	const owned = getOwnedProperties([mapping('watched')]);

	const result = mergeFrontmatter({ title: 'Arrival' }, { watched: false }, owned, ['watched']);

	expect(result.merged.watched).toBe(false);
	expect(result.added).toEqual(['watched']);
});

test('a remapped userData field keeps the value from the note, not the api default', () => {
	const owned = getOwnedProperties([mapping('personalRating', PropertyMappingOption.Map, 'mioVoto')]);

	const result = mergeFrontmatter({ personalRating: 9 }, { mioVoto: 0 }, owned, ['personalRating']);

	expect(result.merged).toEqual({ mioVoto: 9 });
	expect(result.removed).toEqual(['personalRating']);
});

test('payload keys no mapping accounts for are still written', () => {
	const result = mergeFrontmatter({ title: 'Old title' }, { title: 'New title', lastUpdate: '2026-09-04T12:00:00.000Z' }, getOwnedProperties([mapping('title')]), []);

	expect(result.merged).toEqual({ title: 'New title', lastUpdate: '2026-09-04T12:00:00.000Z' });
	expect(result.added).toEqual(['lastUpdate']);
});
