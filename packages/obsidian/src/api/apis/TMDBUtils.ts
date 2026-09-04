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
