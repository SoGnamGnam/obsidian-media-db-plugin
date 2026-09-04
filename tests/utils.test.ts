import { expect, test } from 'bun:test';
import { MovieModel } from 'packages/obsidian/src/models/MovieModel';
import { markdownTable, migrateObject, replaceTags, wrapAround } from 'packages/obsidian/src/utils/Utils';

test('replaceTags substitutes nested values and array operators', () => {
	const movie = new MovieModel({
		title: 'Alien',
		year: '1979',
		genres: ['Horror', 'Sci-Fi'],
		userData: { watched: true, lastWatched: '2026-01-02', personalRating: 9 },
	});

	expect(replaceTags('{{ title }} ({{ year }}) - {{ userData.personalRating }}', movie)).toBe('Alien (1979) - 9');
	expect(replaceTags('{{ ENUM:genres }}', movie)).toBe('Horror, Sci-Fi');
	expect(replaceTags('{{ LIST:genres }}', movie)).toBe('- Horror\n- Sci-Fi');
	expect(replaceTags('{{ FIRST:genres }} / {{ LAST:genres }}', movie)).toBe('Horror / Sci-Fi');
});

test('replaceTags reports invalid tags unless undefined values are ignored', () => {
	const movie = new MovieModel({ title: 'Alien' });

	expect(replaceTags('{{ missing }}', movie)).toBe('{{ INVALID TEMPLATE TAG - object undefined }}');
	expect(replaceTags('{{ missing }}', movie, true)).toBe('');
	expect(replaceTags('{{ ENUM:title }}', movie)).toBe('{{ INVALID TEMPLATE TAG - operator ENUM is only applicable on an array }}');
	expect(replaceTags('{{ UNKNOWN:genres }}', movie)).toBe('{{ INVALID TEMPLATE TAG - unknown operator UNKNOWN }}');
	expect(replaceTags('{{ TOO:MANY:PARTS }}', movie)).toBe('{{ INVALID TEMPLATE TAG }}');
});

test('markdownTable aligns columns and rejects jagged input', () => {
	expect(
		markdownTable([
			['Name', 'Year'],
			['Alien', '1979'],
			['Arrival', '2016'],
		]),
	).toBe('| Name    | Year |\n| ------- | ---- |\n| Alien   | 1979 |\n| Arrival | 2016 |\n');

	expect(markdownTable([])).toBe('');
	expect(markdownTable([[]])).toBe('');
	expect(markdownTable([['Name'], ['Alien', '1979']])).toBe('');
});

test('migrateObject keeps existing defined values and fills missing values from defaults', () => {
	const target = { title: '', year: '', rating: 0 };
	const defaults = { title: 'Untitled', year: '1900', rating: 1 };

	migrateObject(target, { title: 'Arrival', year: null, rating: undefined }, defaults);

	expect(target).toEqual({ title: 'Arrival', year: '1900', rating: 1 });
});

test('wrapAround uses positive modulo and rejects invalid sizes', () => {
	expect(wrapAround(5, 3)).toBe(2);
	expect(wrapAround(-1, 3)).toBe(2);
	expect(() => wrapAround(1, 0)).toThrow('size may not be zero or negative');
});
