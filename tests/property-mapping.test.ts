import { expect, test } from 'bun:test';
import { PropertyMapper } from 'packages/obsidian/src/settings/PropertyMapper';
import { PropertyMapping, PropertyMappingModel, PropertyMappingOption } from 'packages/obsidian/src/settings/PropertyMapping';
import { MediaType } from 'packages/obsidian/src/utils/MediaType';
import { PropertyMappingNameConflictError, PropertyMappingValidationError } from 'packages/obsidian/src/utils/Utils';

test('PropertyMapping validates locked and remapped property constraints', () => {
	expect(new PropertyMapping('title', 'title', PropertyMappingOption.Default, true).validate()).toEqual({ res: true });

	const lockedRemoval = new PropertyMapping('title', 'title', PropertyMappingOption.Remove, true).validate();
	expect(lockedRemoval.res).toBe(false);
	expect(lockedRemoval.err).toBeInstanceOf(PropertyMappingValidationError);

	const invalidSource = new PropertyMapping('bad property', 'name', PropertyMappingOption.Map).validate();
	expect(invalidSource.res).toBe(false);
	expect(invalidSource.err).toBeInstanceOf(PropertyMappingValidationError);

	const invalidTarget = new PropertyMapping('title', 'bad-property', PropertyMappingOption.Map).validate();
	expect(invalidTarget.res).toBe(false);
	expect(invalidTarget.err).toBeInstanceOf(PropertyMappingValidationError);
});

test('PropertyMappingModel detects conflicting mapped property names', () => {
	const duplicateTarget = new PropertyMappingModel(MediaType.Movie, [
		new PropertyMapping('title', 'name', PropertyMappingOption.Map),
		new PropertyMapping('englishTitle', 'name', PropertyMappingOption.Map),
	]).validate();

	expect(duplicateTarget.res).toBe(false);
	expect(duplicateTarget.err).toBeInstanceOf(PropertyMappingNameConflictError);

	const targetMatchesOriginal = new PropertyMappingModel(MediaType.Movie, [
		new PropertyMapping('title', 'year', PropertyMappingOption.Map),
		new PropertyMapping('year', 'year', PropertyMappingOption.Default),
	]).validate();

	expect(targetMatchesOriginal.res).toBe(false);
	expect(targetMatchesOriginal.err).toBeInstanceOf(PropertyMappingNameConflictError);
});

test('PropertyMappingModel serializes, copies, and migrates without sharing mutable property objects', () => {
	const model = new PropertyMappingModel(MediaType.Movie, [new PropertyMapping('title', 'name', PropertyMappingOption.Map, false, true)]);
	const copy = model.copy();

	copy.properties[0].newProperty = 'label';

	expect(model.properties[0].newProperty).toBe('name');
	expect(PropertyMappingModel.fromJSON(model.toJSON())).toEqual(model);

	const migrated = PropertyMappingModel.migrateModels(
		[
			{
				type: MediaType.Movie,
				properties: [{ property: 'title', newProperty: 'customTitle', mapping: PropertyMappingOption.Map, locked: false, wikilink: true }],
			},
		],
		[
			new PropertyMappingModel(MediaType.Movie, [
				new PropertyMapping('title', 'title', PropertyMappingOption.Default, true),
				new PropertyMapping('year', 'year', PropertyMappingOption.Default, false),
			]),
			new PropertyMappingModel(MediaType.Book, [new PropertyMapping('author', 'author', PropertyMappingOption.Default)]),
		],
	);

	expect(migrated).toEqual([
		new PropertyMappingModel(MediaType.Movie, [
			new PropertyMapping('title', 'customTitle', PropertyMappingOption.Map, true, true),
			new PropertyMapping('year', 'year', PropertyMappingOption.Default, false),
		]),
		new PropertyMappingModel(MediaType.Book, [new PropertyMapping('author', 'author', PropertyMappingOption.Default)]),
	]);
});

test('PropertyMapper converts objects according to mapping and wikilink rules', () => {
	const mapper = new PropertyMapper({
		settings: {
			propertyMappingModels: [
				new PropertyMappingModel(MediaType.Movie, [
					new PropertyMapping('title', 'name', PropertyMappingOption.Map, false, true),
					new PropertyMapping('genres', 'genres', PropertyMappingOption.Default, false, true),
					new PropertyMapping('year', 'year', PropertyMappingOption.Remove),
				]),
			],
		},
	} as never);

	expect(
		mapper.convertObject({
			type: MediaType.Movie,
			title: 'Arrival',
			genres: ['Drama', 2016],
			year: '2016',
			rating: 8,
		}),
	).toEqual({
		type: MediaType.Movie,
		name: '[[Arrival]]',
		genres: ['[[Drama]]', 2016],
		rating: 8,
	});
});

test('PropertyMapper restores mapped properties and migrates legacy manga type', () => {
	const mapper = new PropertyMapper({
		settings: {
			propertyMappingModels: [new PropertyMappingModel(MediaType.ComicManga, [new PropertyMapping('title', 'name', PropertyMappingOption.Map)])],
		},
	} as never);

	expect(mapper.convertObjectBack({ type: 'manga', name: 'Berserk', year: '1989' })).toEqual({
		type: MediaType.ComicManga,
		title: 'Berserk',
		year: '1989',
	});
});
