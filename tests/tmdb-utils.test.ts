import { expect, test } from 'bun:test';
import {
	formatBoxOffice,
	getCastNames,
	getCrewNamesByJobs,
	getMovieCertification,
	getPreferredRegion,
	getSeriesCertification,
	getStreamingServices,
	WRITING_JOBS,
} from 'packages/obsidian/src/api/apis/TMDBUtils';

test('getCastNames keeps billing order, dedupes and only truncates when asked', () => {
	const credits = { cast: [{ name: 'Edward Norton' }, { name: 'Brad Pitt' }, { name: 'Brad Pitt' }, { name: '' }, { name: 'Helena Bonham Carter' }] };

	expect(getCastNames(credits)).toEqual(['Edward Norton', 'Brad Pitt', 'Helena Bonham Carter']);
	expect(getCastNames(credits, 2)).toEqual(['Edward Norton', 'Brad Pitt']);
	expect(getCastNames(undefined)).toEqual([]);
});

test('getCrewNamesByJobs collects every writing credit, not just the screenplay', () => {
	const credits = {
		crew: [
			{ name: 'Jim Uhls', job: 'Screenplay' },
			{ name: 'Chuck Palahniuk', job: 'Story' },
			{ name: 'Someone', job: 'Writer' },
			{ name: 'David Fincher', job: 'Director' },
		],
	};

	expect(getCrewNamesByJobs(credits, WRITING_JOBS)).toEqual(['Jim Uhls', 'Chuck Palahniuk', 'Someone']);
	expect(getCrewNamesByJobs(credits, ['Director'])).toEqual(['David Fincher']);
});

test('getPreferredRegion reads the region subtag and falls back to US', () => {
	expect(getPreferredRegion('it-IT')).toBe('IT');
	expect(getPreferredRegion('en_GB')).toBe('GB');
	expect(getPreferredRegion('en')).toBe('US');
	expect(getPreferredRegion(undefined)).toBe('US');
});

test('getMovieCertification prefers the local rating, then the US, then any that exists', () => {
	const response = {
		release_dates: {
			results: [
				{ iso_3166_1: 'FR', release_dates: [{ certification: '12' }] },
				{ iso_3166_1: 'US', release_dates: [{ certification: 'R' }] },
				{ iso_3166_1: 'IT', release_dates: [{ certification: '' }, { certification: 'VM14' }] },
			],
		},
	};

	expect(getMovieCertification(response, 'IT')).toBe('VM14');
	expect(getMovieCertification(response, 'DE')).toBe('R');
	expect(getMovieCertification({ release_dates: { results: [{ iso_3166_1: 'FR', release_dates: [{ certification: '12' }] }] } }, 'DE')).toBe('12');
	expect(getMovieCertification({}, 'IT')).toBe('');
});

test('getSeriesCertification skips regions with an empty rating', () => {
	const response = {
		content_ratings: {
			results: [
				{ iso_3166_1: 'IT', rating: '' },
				{ iso_3166_1: 'US', rating: 'TV-MA' },
			],
		},
	};

	expect(getSeriesCertification(response, 'IT')).toBe('TV-MA');
	expect(getSeriesCertification({}, 'IT')).toBe('');
});

test('getStreamingServices returns subscription providers for the resolved region', () => {
	const response = {
		'watch/providers': {
			results: {
				IT: { flatrate: [{ provider_name: 'Netflix' }, { provider_name: 'Prime Video' }] },
				US: { flatrate: [{ provider_name: 'Hulu' }] },
				DE: {},
			},
		},
	};

	expect(getStreamingServices(response, 'IT')).toEqual(['Netflix', 'Prime Video']);
	expect(getStreamingServices(response, 'DE')).toEqual(['Hulu']);
	expect(getStreamingServices({}, 'IT')).toEqual([]);
});

test('formatBoxOffice renders a revenue figure and stays empty when there is none', () => {
	expect(formatBoxOffice(100853753)).toBe('$100,853,753');
	expect(formatBoxOffice(0)).toBe('');
	expect(formatBoxOffice(undefined)).toBe('');
});
