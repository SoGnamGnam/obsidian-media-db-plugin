import { requestUrl } from 'obsidian';
import type MediaDbPlugin from '../../main';
import { GameModel } from '../../models/GameModel';
import type { MediaTypeModel } from '../../models/MediaTypeModel';
import { MediaType } from '../../utils/MediaType';
import { APIModel } from '../APIModel';

interface RawgSearchResult {
	id: number;
	slug: string;
	name: string;
	released: string | null;
	tba: boolean;
	background_image: string | null;
	rating: number;
	metacritic: number | null;
	playtime: number;
	platforms: {
		platform: {
			id: number;
			name: string;
			slug: string;
		};
	}[] | null;
	genres: {
		id: number;
		name: string;
		slug: string;
	}[] | null;
}

interface RawgSearchResponse {
	count: number;
	next: string | null;
	previous: string | null;
	results: RawgSearchResult[];
}

interface RawgGameDetails {
	id: number;
	slug: string;
	name: string;
	name_original: string;
	description: string;
	description_raw: string;
	metacritic: number | null;
	released: string | null;
	tba: boolean;
	updated: string;
	background_image: string | null;
	background_image_additional: string | null;
	website: string;
	rating: number;
	playtime: number;
	platforms: {
		platform: {
			id: number;
			name: string;
			slug: string;
		};
		released_at: string | null;
		requirements: {
			minimum?: string;
			recommended?: string;
		};
	}[] | null;
	developers: {
		id: number;
		name: string;
		slug: string;
	}[] | null;
	publishers: {
		id: number;
		name: string;
		slug: string;
	}[] | null;
	genres: {
		id: number;
		name: string;
		slug: string;
	}[] | null;
	esrb_rating: {
		id: number;
		name: string;
		slug: string;
	} | null;
}

export class RawgAPI extends APIModel {
	plugin: MediaDbPlugin;
	apiDateFormat: string = 'YYYY-MM-DD';

	constructor(plugin: MediaDbPlugin) {
		super();

		this.plugin = plugin;
		this.apiName = 'RawgAPI';
		this.apiDescription = 'The largest open video games database with over 350,000 games.';
		this.apiUrl = 'https://api.rawg.io/api';
		this.types = [MediaType.Game];
	}

	async searchByTitle(title: string): Promise<MediaTypeModel[]> {
		console.log(`MDB | api "${this.apiName}" queried by Title`);

		if (!this.plugin.settings.RawgKey) {
			throw new Error(`MDB | API key for ${this.apiName} missing.`);
		}

		const searchUrl = `${this.apiUrl}/games?key=${this.plugin.settings.RawgKey}&search=${encodeURIComponent(title)}&page_size=20`;
		const fetchData = await requestUrl({
			url: searchUrl,
		});

		if (fetchData.status === 401) {
			throw Error(`MDB | Authentication for ${this.apiName} failed. Check the API key.`);
		}

		if (fetchData.status !== 200) {
			throw Error(`MDB | Received status code ${fetchData.status} from ${this.apiName}.`);
		}

		const data = fetchData.json as RawgSearchResponse;

		const ret: MediaTypeModel[] = [];

		for (const result of data.results) {
			const year = result.released ? new Date(result.released).getFullYear().toString() : '';

			ret.push(
				new GameModel({
					type: MediaType.Game,
					title: result.name,
					englishTitle: result.name,
					year: year,
					dataSource: this.apiName,
					id: result.id.toString(),
					url: `https://rawg.io/games/${result.slug}`,

					genres: result.genres?.map(g => g.name) ?? [],
					onlineRating: result.metacritic ?? result.rating,
					image: result.background_image ?? '',
					platforms: result.platforms?.map(p => p.platform.name) ?? [],
					playtime: result.playtime,

					released: !result.tba,
					releaseDate: result.released ?? '',
				}),
			);
		}

		return ret;
	}

	async getById(id: string): Promise<MediaTypeModel> {
		console.log(`MDB | api "${this.apiName}" queried by ID`);

		if (!this.plugin.settings.RawgKey) {
			throw new Error(`MDB | API key for ${this.apiName} missing.`);
		}

		const searchUrl = `${this.apiUrl}/games/${encodeURIComponent(id)}?key=${this.plugin.settings.RawgKey}`;
		const fetchData = await requestUrl({
			url: searchUrl,
		});

		if (fetchData.status === 401) {
			throw Error(`MDB | Authentication for ${this.apiName} failed. Check the API key.`);
		}

		if (fetchData.status === 404) {
			throw Error(`MDB | Game with ID ${id} not found in ${this.apiName}.`);
		}

		if (fetchData.status !== 200) {
			throw Error(`MDB | Received status code ${fetchData.status} from ${this.apiName}.`);
		}

		const result = fetchData.json as RawgGameDetails;

		const year = result.released ? new Date(result.released).getFullYear().toString() : '';

		return new GameModel({
			type: MediaType.Game,
			title: result.name,
			englishTitle: result.name_original || result.name,
			year: year,
			dataSource: this.apiName,
			url: `https://rawg.io/games/${result.slug}`,
			id: result.id.toString(),

			developers: result.developers?.map(d => d.name) ?? [],
			publishers: result.publishers?.map(p => p.name) ?? [],
			genres: result.genres?.map(g => g.name) ?? [],
			onlineRating: result.metacritic ?? result.rating,
			image: result.background_image ?? '',
			platforms: result.platforms?.map(p => p.platform.name) ?? [],
			playtime: result.playtime,

			released: !result.tba,
			releaseDate: this.plugin.dateFormatter.format(result.released, this.apiDateFormat),

			userData: {
				played: false,
				personalRating: 0,
			},
		});
	}

	getDisabledMediaTypes(): MediaType[] {
		return this.plugin.settings.RawgAPI_disabledMediaTypes;
	}
}