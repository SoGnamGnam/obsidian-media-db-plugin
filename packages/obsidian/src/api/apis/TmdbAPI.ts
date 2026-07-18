import { requestUrl } from 'obsidian';
import type MediaDbPlugin from '../../main';
import type { MediaTypeModel } from '../../models/MediaTypeModel';
import { MovieModel } from '../../models/MovieModel';
import { SeriesModel } from '../../models/SeriesModel';
import { MediaType } from '../../utils/MediaType';
import { APIModel } from '../APIModel';

// TMDB API Types
interface TMDBSearchMovieResult {
	id: number;
	title: string;
	original_title: string;
	overview: string;
	release_date: string;
	poster_path: string | null;
	backdrop_path: string | null;
	genre_ids: number[];
	adult: boolean;
	popularity: number;
	vote_average: number;
	vote_count: number;
	original_language: string;
}

interface TMDBSearchTVResult {
	id: number;
	name: string;
	original_name: string;
	overview: string;
	first_air_date: string;
	poster_path: string | null;
	backdrop_path: string | null;
	genre_ids: number[];
	popularity: number;
	vote_average: number;
	vote_count: number;
	origin_country: string[];
	original_language: string;
}

interface TMDBSearchResponse<T> {
	page: number;
	results: T[];
	total_pages: number;
	total_results: number;
}

interface TMDBMovieDetails {
	id: number;
	imdb_id: string | null;
	title: string;
	original_title: string;
	overview: string;
	release_date: string;
	runtime: number | null;
	budget: number;
	revenue: number;
	tagline: string;
	homepage: string;
	status: string;
	adult: boolean;
	poster_path: string | null;
	backdrop_path: string | null;
	popularity: number;
	vote_average: number;
	vote_count: number;
	original_language: string;
	spoken_languages: { english_name: string; iso_639_1: string; name: string }[];
	production_companies: { id: number; name: string; logo_path: string | null; origin_country: string }[];
	production_countries: { iso_3166_1: string; name: string }[];
	genres: { id: number; name: string }[];
	belongs_to_collection: { id: number; name: string; poster_path: string | null; backdrop_path: string | null } | null;
}

interface TMDBMovieCredits {
	id: number;
	cast: {
		id: number;
		name: string;
		character: string;
		order: number;
		profile_path: string | null;
	}[];
	crew: {
		id: number;
		name: string;
		job: string;
		department: string;
		profile_path: string | null;
	}[];
}

interface TMDBMovieWatchProviders {
	id: number;
	results: {
		[countryCode: string]: {
			link: string;
			flatrate?: { provider_name: string; logo_path: string; provider_id: number }[];
			rent?: { provider_name: string; logo_path: string; provider_id: number }[];
			buy?: { provider_name: string; logo_path: string; provider_id: number }[];
		};
	};
}

interface TMDBMovieReleaseDates {
	id: number;
	results: {
		iso_3166_1: string;
		release_dates: {
			certification: string;
			release_date: string;
			type: number;
		}[];
	}[];
}

interface TMDBTVDetails {
	id: number;
	name: string;
	original_name: string;
	overview: string;
	first_air_date: string;
	last_air_date: string | null;
	status: string;
	type: string;
	tagline: string;
	homepage: string;
	in_production: boolean;
	number_of_seasons: number;
	number_of_episodes: number;
	episode_run_time: number[];
	poster_path: string | null;
	backdrop_path: string | null;
	popularity: number;
	vote_average: number;
	vote_count: number;
	original_language: string;
	origin_country: string[];
	spoken_languages: { english_name: string; iso_639_1: string; name: string }[];
	production_companies: { id: number; name: string; logo_path: string | null; origin_country: string }[];
	production_countries: { iso_3166_1: string; name: string }[];
	genres: { id: number; name: string }[];
	networks: { id: number; name: string; logo_path: string | null; origin_country: string }[];
	created_by: { id: number; name: string; profile_path: string | null }[];
	seasons: {
		id: number;
		name: string;
		season_number: number;
		episode_count: number;
		air_date: string | null;
		poster_path: string | null;
		overview: string;
	}[];
	last_episode_to_air: {
		id: number;
		name: string;
		episode_number: number;
		season_number: number;
		air_date: string;
	} | null;
	next_episode_to_air: {
		id: number;
		name: string;
		episode_number: number;
		season_number: number;
		air_date: string;
	} | null;
}

interface TMDBTVCredits {
	id: number;
	cast: {
		id: number;
		name: string;
		character: string;
		order: number;
		profile_path: string | null;
	}[];
	crew: {
		id: number;
		name: string;
		job: string;
		department: string;
		profile_path: string | null;
	}[];
}

interface TMDBTVContentRatings {
	id: number;
	results: {
		iso_3166_1: string;
		rating: string;
	}[];
}

interface TMDBTVWatchProviders {
	id: number;
	results: {
		[countryCode: string]: {
			link: string;
			flatrate?: { provider_name: string; logo_path: string; provider_id: number }[];
			rent?: { provider_name: string; logo_path: string; provider_id: number }[];
			buy?: { provider_name: string; logo_path: string; provider_id: number }[];
		};
	};
}

interface TMDBTVExternalIds {
	id: number;
	imdb_id: string | null;
	tvdb_id: number | null;
	facebook_id: string | null;
	instagram_id: string | null;
	twitter_id: string | null;
}

export class TMDBAPI extends APIModel {
	plugin: MediaDbPlugin;
	apiDateFormat: string = 'YYYY-MM-DD';
	imageBaseUrl: string = 'https://image.tmdb.org/t/p/';

	constructor(plugin: MediaDbPlugin) {
		super();

		this.plugin = plugin;
		this.apiName = 'TMDBAPI';
		this.apiDescription = 'The Movie Database (TMDB) - A comprehensive API for movies and TV shows with rich metadata, images, and streaming provider info.';
		this.apiUrl = 'https://www.themoviedb.org/';
		this.types = [MediaType.Movie, MediaType.Series];
	}

	/**
	 * Build full image URL from TMDB poster_path
	 * @param posterPath - The poster path from TMDB 
	 * @param size - Image size (w92, w154, w185, w342, w500, w780, original)
	 */
	private buildImageUrl(posterPath: string | null, size: string = 'w500'): string {
		if (!posterPath) return '';
		return `${this.imageBaseUrl}${size}${posterPath}`;
	}

	/**
	 * Get streaming services for a given country from watch providers response
	 */
	private getStreamingServices(
		watchProviders: TMDBMovieWatchProviders | TMDBTVWatchProviders | undefined,
		countryCode: string = 'US'
	): string[] {
		if (!watchProviders?.results?.[countryCode]) return [];
		
		const providers = watchProviders.results[countryCode];
		const services: string[] = [];
		
		// Prioritize flatrate (subscription) services
		if (providers.flatrate) {
			services.push(...providers.flatrate.map(p => p.provider_name));
		}
		
		return [...new Set(services)]; // Remove duplicates
	}

	/**
	 * Get age rating/certification for a specific country
	 */
	private getAgeRating(
		releaseDates: TMDBMovieReleaseDates | undefined,
		contentRatings: TMDBTVContentRatings | undefined,
		countryCode: string = 'US'
	): string {
		// For movies
		if (releaseDates?.results) {
			const countryRelease = releaseDates.results.find(r => r.iso_3166_1 === countryCode);
			if (countryRelease?.release_dates) {
				// Find theatrical release (type 3) or any with certification
				const withCert = countryRelease.release_dates.find(rd => rd.certification) 
					|| countryRelease.release_dates[0];
				if (withCert?.certification) return withCert.certification;
			}
		}
		
		// For TV shows
		if (contentRatings?.results) {
			const countryRating = contentRatings.results.find(r => r.iso_3166_1 === countryCode);
			if (countryRating?.rating) return countryRating.rating;
		}
		
		return '';
	}

	async searchByTitle(title: string): Promise<MediaTypeModel[]> {
		console.log(`MDB | api "${this.apiName}" queried by Title`);

		if (!this.plugin.settings.TMDBKey) {
			throw new Error(`MDB | API key for ${this.apiName} missing.`);
		}

		const ret: MediaTypeModel[] = [];

		// Search for movies
		if (this.hasType(MediaType.Movie)) {
			try {
				const movieResponse = await requestUrl({
					url: `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&include_adult=false&language=en-US&page=1`,
					method: 'GET',
					headers: {
						'Authorization': `Bearer ${this.plugin.settings.TMDBKey}`,
						'Accept': 'application/json',
					},
				});

				if (movieResponse.status === 200) {
					const movieData = movieResponse.json as TMDBSearchResponse<TMDBSearchMovieResult>;
					
					for (const result of movieData.results.slice(0, 10)) {
						const year = result.release_date ? result.release_date.substring(0, 4) : '';
						ret.push(
							new MovieModel({
								type: 'movie',
								title: result.title,
								englishTitle: result.title,
								year: year,
								dataSource: this.apiName,
								id: result.id.toString(),
								image: this.buildImageUrl(result.poster_path, 'w342'),
							}),
						);
					}
				}
			} catch (e) {
				console.warn(`MDB | Error searching movies from ${this.apiName}:`, e);
			}
		}

		// Search for TV shows
		if (this.hasType(MediaType.Series)) {
			try {
				const tvResponse = await requestUrl({
					url: `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(title)}&include_adult=false&language=en-US&page=1`,
					method: 'GET',
					headers: {
						'Authorization': `Bearer ${this.plugin.settings.TMDBKey}`,
						'Accept': 'application/json',
					},
				});

				if (tvResponse.status === 200) {
					const tvData = tvResponse.json as TMDBSearchResponse<TMDBSearchTVResult>;
					
					for (const result of tvData.results.slice(0, 10)) {
						const year = result.first_air_date ? result.first_air_date.substring(0, 4) : '';
						ret.push(
							new SeriesModel({
								type: 'series',
								title: result.name,
								englishTitle: result.name,
								year: year,
								dataSource: this.apiName,
								id: `tv-${result.id}`,
								image: this.buildImageUrl(result.poster_path, 'w342'),
							}),
						);
					}
				}
			} catch (e) {
				console.warn(`MDB | Error searching TV shows from ${this.apiName}:`, e);
			}
		}

		return ret;
	}

	async getById(id: string): Promise<MediaTypeModel> {
		console.log(`MDB | api "${this.apiName}" queried by ID: ${id}`);

		if (!this.plugin.settings.TMDBKey) {
			throw Error(`MDB | API key for ${this.apiName} missing.`);
		}

		// Determine if this is a TV show or movie based on ID prefix
		const isTVShow = id.startsWith('tv-');
		const actualId = isTVShow ? id.replace('tv-', '') : id;

		if (isTVShow) {
			return this.getTVShowById(actualId);
		} else {
			return this.getMovieById(actualId);
		}
	}

	private async getMovieById(id: string): Promise<MovieModel> {
		const response = await requestUrl({
			url: `https://api.themoviedb.org/3/movie/${id}?append_to_response=credits,release_dates,watch/providers&language=en-US`,
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${this.plugin.settings.TMDBKey}`,
				'Accept': 'application/json',
			},
		});

		if (response.status === 401) {
			throw Error(`MDB | Authentication for ${this.apiName} failed. Check the API key.`);
		}
		if (response.status !== 200) {
			throw Error(`MDB | Received status code ${response.status} from ${this.apiName}.`);
		}

		const movie = response.json as TMDBMovieDetails & {
			credits?: TMDBMovieCredits;
			release_dates?: TMDBMovieReleaseDates;
			'watch/providers'?: TMDBMovieWatchProviders;
		};

		// Extract directors and writers from crew
		const directors: string[] = [];
		const writers: string[] = [];
		const studios: string[] = [];

		if (movie.credits?.crew) {
			for (const crew of movie.credits.crew) {
				if (crew.job === 'Director') {
					directors.push(crew.name);
				}
				if (crew.department === 'Writing' || crew.job === 'Screenplay' || crew.job === 'Writer') {
					if (!writers.includes(crew.name)) {
						writers.push(crew.name);
					}
				}
			}
		}

		// Extract production companies as studios
		if (movie.production_companies) {
			studios.push(...movie.production_companies.map(c => c.name));
		}

		// Extract top actors (first 10)
		const actors: string[] = [];
		if (movie.credits?.cast) {
			actors.push(...movie.credits.cast.slice(0, 10).map(c => c.name));
		}

		// Get streaming services
		const streamingServices = this.getStreamingServices(movie['watch/providers']);

		// Get age rating
		const ageRating = this.getAgeRating(movie.release_dates, undefined);

		// Format runtime
		const duration = movie.runtime ? `${movie.runtime} min` : '';

		// Get production countries
		const countries = movie.production_countries?.map(c => c.name) || [];

		return new MovieModel({
			type: 'movie',
			title: movie.title,
			englishTitle: movie.title,
			year: movie.release_date ? movie.release_date.substring(0, 4) : '',
			dataSource: this.apiName,
			url: `https://www.themoviedb.org/movie/${movie.id}`,
			id: movie.id.toString(),

			plot: movie.overview,
			genres: movie.genres?.map(g => g.name) || [],
			director: directors,
			writer: writers,
			studio: studios,
			duration: duration,
			onlineRating: movie.vote_average,
			actors: actors,
			image: this.buildImageUrl(movie.poster_path, 'w500'),

			released: movie.status === 'Released',
			country: countries,
			boxOffice: movie.revenue ? `$${movie.revenue.toLocaleString()}` : '',
			ageRating: ageRating,
			streamingServices: streamingServices,
			premiere: this.plugin.dateFormatter.format(movie.release_date, this.apiDateFormat),

			budget: movie.budget || 0,
			revenue: movie.revenue || 0,

			userData: {
				watched: false,
				lastWatched: '',
				personalRating: 0,
			},
		});
	}

	private async getTVShowById(id: string): Promise<SeriesModel> {
		// Fetch TV show details with credits, content ratings, watch providers, and external IDs
		const response = await requestUrl({
			url: `https://api.themoviedb.org/3/tv/${id}?append_to_response=credits,content_ratings,watch/providers,external_ids&language=en-US`,
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${this.plugin.settings.TMDBKey}`,
				'Accept': 'application/json',
			},
		});

		if (response.status === 401) {
			throw Error(`MDB | Authentication for ${this.apiName} failed. Check the API key.`);
		}
		if (response.status !== 200) {
			throw Error(`MDB | Received status code ${response.status} from ${this.apiName}.`);
		}

		const tv = response.json as TMDBTVDetails & {
			credits?: TMDBTVCredits;
			content_ratings?: TMDBTVContentRatings;
			'watch/providers'?: TMDBTVWatchProviders;
			external_ids?: TMDBTVExternalIds;
		};

		// Extract creators
		const createdBy: string[] = [];
		if (tv.created_by) {
			createdBy.push(...tv.created_by.map(c => c.name));
		}

		// Extract writers from crew (as fallback/addition to createdBy)
		const writers: string[] = [...createdBy];

		// Extract networks
		const networks: string[] = [];
		if (tv.networks) {
			networks.push(...tv.networks.map(n => n.name));
		}

		// Extract production companies as studios
		const studios: string[] = [];
		if (tv.production_companies) {
			studios.push(...tv.production_companies.map(c => c.name));
		}

		// Extract top actors (first 10)
		const actors: string[] = [];
		if (tv.credits?.cast) {
			actors.push(...tv.credits.cast.slice(0, 10).map(c => c.name));
		}

		// Get streaming services
		const streamingServices = this.getStreamingServices(tv['watch/providers']);

		// Get age rating
		const ageRating = this.getAgeRating(undefined, tv.content_ratings);

		// Calculate total episodes
		const totalEpisodes = tv.number_of_episodes || 0;

		// Format duration (average episode runtime)
		const avgRuntime = tv.episode_run_time?.length > 0 
			? Math.round(tv.episode_run_time.reduce((a, b) => a + b, 0) / tv.episode_run_time.length)
			: 0;
		const duration = avgRuntime > 0 ? `${avgRuntime} min` : '';

		// Get production countries
		const countries = tv.production_countries?.map(c => c.name) || tv.origin_country || [];

		// Determine if currently airing
		const isAiring = tv.in_production || tv.status === 'Returning Series';

		return new SeriesModel({
			type: 'series',
			title: tv.name,
			englishTitle: tv.name,
			year: tv.first_air_date ? tv.first_air_date.substring(0, 4) : '',
			dataSource: this.apiName,
			url: `https://www.themoviedb.org/tv/${tv.id}`,
			id: `tv-${tv.id}`,

			plot: tv.overview,
			genres: tv.genres?.map(g => g.name) || [],
			writer: writers,
			studio: studios,
			episodes: totalEpisodes,
			duration: duration,
			onlineRating: tv.vote_average,
			actors: actors,
			image: this.buildImageUrl(tv.poster_path, 'w500'),

			released: tv.status !== 'In Production' && tv.status !== 'Planned',
			country: countries,
			ageRating: ageRating,
			streamingServices: streamingServices,
			airing: isAiring,
			airedFrom: this.plugin.dateFormatter.format(tv.first_air_date, this.apiDateFormat),
			airedTo: tv.last_air_date ? this.plugin.dateFormatter.format(tv.last_air_date, this.apiDateFormat) : '',

			createdBy: createdBy,
			networks: networks,
			numberOfSeasons: tv.number_of_seasons || 0,
			status: tv.status || '',

			userData: {
				watched: false,
				lastWatched: '',
				personalRating: 0,
			},
		});
	}

	getDisabledMediaTypes(): MediaType[] {
		return this.plugin.settings.TMDBAPI_disabledMediaTypes || [];
	}
}