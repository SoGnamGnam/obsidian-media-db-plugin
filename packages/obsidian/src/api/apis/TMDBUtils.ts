const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

/**
 * Builds an absolute TMDB image URL from the relative path the API returns.
 * Returns an empty string when the API has no image for the entry, so models
 * never end up with a `.../w780null` URL.
 */
export function tmdbImageUrl(path: string | null | undefined, size: string = 'w780'): string {
	if (!path) {
		return '';
	}
	return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export interface TMDBCreditMember {
	name?: string | null;
	job?: string | null;
}

export interface TMDBCredits {
	cast?: TMDBCreditMember[];
	crew?: TMDBCreditMember[];
}

export interface TMDBCreditsResponse {
	credits?: TMDBCredits;
}

/**
 * Cast size written to a note. TMDB credits well over a hundred names on some titles, most of them
 * uncredited extras at the bottom of the billing order, which makes the frontmatter unreadable.
 */
export const DETAIL_CAST_LIMIT = 25;

/** Jobs TMDB files under its writing department, all of which belong in the `writer` field. */
export const WRITING_JOBS = ['Screenplay', 'Writer', 'Story', 'Teleplay'];

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

/**
 * Cast names in billing order. Pass a limit to keep only the top billed ones; the detail queries
 * use {@link DETAIL_CAST_LIMIT}.
 */
export function getCastNames(credits: TMDBCredits | undefined, limit?: number): string[] {
	const names = unique((credits?.cast ?? []).map(member => member.name).filter(isNonEmptyString));
	return limit === undefined ? names : names.slice(0, limit);
}

/**
 * Crew names for any of the given jobs. A person credited under two of them (a writer who also
 * directed, say) is only listed once.
 */
export function getCrewNamesByJobs(credits: TMDBCredits | undefined, jobs: string[]): string[] {
	const wanted = new Set(jobs);
	return unique(
		(credits?.crew ?? [])
			.filter(member => isNonEmptyString(member.job) && wanted.has(member.job))
			.map(member => member.name)
			.filter(isNonEmptyString),
	);
}

/**
 * Certifications and streaming availability are per country, and TMDB has no notion of a default.
 * The vault's locale is the best guess available, with the US as the fallback because it is the
 * region TMDB is most consistently populated for.
 */
export function getPreferredRegion(locale: string | undefined = typeof navigator === 'undefined' ? undefined : navigator.language): string {
	const region = locale?.split(/[-_]/)[1];
	return region && /^[a-z]{2}$/i.test(region) ? region.toUpperCase() : 'US';
}

/**
 * Resolves a per country list: the preferred region first, then the US, then any region that has
 * a value at all, so the field is only left empty when TMDB genuinely has nothing.
 */
function pickForRegion<TEntry>(entries: TEntry[], region: string, regionOf: (entry: TEntry) => string | undefined | null, valueOf: (entry: TEntry) => boolean): TEntry | undefined {
	const usable = entries.filter(valueOf);
	return usable.find(entry => regionOf(entry) === region) ?? usable.find(entry => regionOf(entry) === 'US') ?? usable[0];
}

export interface TMDBReleaseDatesResponse {
	release_dates?: {
		results?: {
			iso_3166_1?: string;
			release_dates?: { certification?: string | null }[];
		}[];
	};
}

export function getMovieCertification(response: TMDBReleaseDatesResponse, region: string): string {
	const results = response.release_dates?.results ?? [];
	const certificationOf = (entry: (typeof results)[number]): string => (entry.release_dates ?? []).map(release => release.certification).find(isNonEmptyString) ?? '';

	const match = pickForRegion(
		results,
		region,
		entry => entry.iso_3166_1,
		entry => certificationOf(entry) !== '',
	);

	return match ? certificationOf(match) : '';
}

export interface TMDBContentRatingsResponse {
	content_ratings?: {
		results?: { iso_3166_1?: string; rating?: string | null }[];
	};
}

export function getSeriesCertification(response: TMDBContentRatingsResponse, region: string): string {
	const match = pickForRegion(
		response.content_ratings?.results ?? [],
		region,
		entry => entry.iso_3166_1,
		entry => isNonEmptyString(entry.rating),
	);

	return match?.rating ?? '';
}

export interface TMDBWatchProvidersResponse {
	'watch/providers'?: {
		results?: Record<string, { flatrate?: { provider_name?: string | null }[] }>;
	};
}

/** Subscription ("flatrate") providers only: rent and buy options are not where a series is streaming. */
export function getStreamingServices(response: TMDBWatchProvidersResponse, region: string): string[] {
	const results = response['watch/providers']?.results ?? {};
	const entries = Object.entries(results).map(([iso, value]) => ({ iso, providers: getProviderNames(value) }));

	const match = pickForRegion(
		entries,
		region,
		entry => entry.iso,
		entry => entry.providers.length > 0,
	);

	return match?.providers ?? [];
}

function getProviderNames(value: { flatrate?: { provider_name?: string | null }[] }): string[] {
	return unique((value.flatrate ?? []).map(provider => provider.provider_name).filter(isNonEmptyString));
}

/** Formats a TMDB revenue figure the way the box office field is written by the other apis. */
export function formatBoxOffice(revenue: number | undefined): string {
	if (!revenue || revenue <= 0) {
		return '';
	}

	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(revenue);
}
