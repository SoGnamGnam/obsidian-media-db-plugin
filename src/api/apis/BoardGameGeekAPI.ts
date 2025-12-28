import { requestUrl } from 'obsidian';
import { BoardGameModel } from 'src/models/BoardGameModel';
import type MediaDbPlugin from '../../main';
import type { MediaTypeModel } from '../../models/MediaTypeModel';
import { MediaType } from '../../utils/MediaType';
import { APIModel } from '../APIModel';

// BGG XML API v2 documentation: https://boardgamegeek.com/wiki/page/BGG_XML_API2

export class BoardGameGeekAPI extends APIModel {
	plugin: MediaDbPlugin;

	constructor(plugin: MediaDbPlugin) {
		super();

		this.plugin = plugin;
		this.apiName = 'BoardGameGeekAPI';
		this.apiDescription = 'A free API for BoardGameGeek things.';
		this.apiUrl = 'https://boardgamegeek.com/xmlapi2';
		this.types = [MediaType.BoardGame];
	}

	async searchByTitle(title: string): Promise<MediaTypeModel[]> {
		console.log(`MDB | api "${this.apiName}" queried by Title`);

		const searchUrl = `${this.apiUrl}/search?query=${encodeURIComponent(title)}&type=boardgame`;
		const fetchData = await requestUrl({
			url: searchUrl,
			headers: {
				Authorization: `Bearer ${this.plugin.settings.BoardgameGeekKey}`,
			},
		});

		if (fetchData.status === 401) {
			throw Error(`MDB | Authentication for ${this.apiName} failed. Check the API key.`);
		}

		if (fetchData.status !== 200) {
			throw Error(`MDB | Received status code ${fetchData.status} from ${this.apiName}.`);
		}

		const data = fetchData.text;
		const response = new window.DOMParser().parseFromString(data, 'text/xml');

		// console.debug(response);

		const ret: MediaTypeModel[] = [];

		for (const item of Array.from(response.querySelectorAll('item'))) {
			const id = item.getAttribute('id') ?? undefined;
			const title = item.querySelector('name[type="primary"]')?.getAttribute('value') ?? 
			              item.querySelector('name')?.getAttribute('value') ?? undefined;
			const year = item.querySelector('yearpublished')?.getAttribute('value') ?? '';

			ret.push(
				new BoardGameModel({
					dataSource: this.apiName,
					id,
					title,
					englishTitle: title,
					year,
				}),
			);
		}

		// Fetch thumbnails using XMLApi2 batch request
		if (ret.length > 0) {
			const ids = ret.map(r => r.id).filter(Boolean).join(',');
			try {
				const detailsUrl = `${this.apiUrl}/thing?id=${ids}`;
				const detailsData = await requestUrl({
					url: detailsUrl,
					headers: {
						Authorization: `Bearer ${this.plugin.settings.BoardgameGeekKey}`,
					},
				});
				if (detailsData.status === 200) {
					const detailsResponse = new window.DOMParser().parseFromString(detailsData.text, 'text/xml');
					for (const item of Array.from(detailsResponse.querySelectorAll('item'))) {
						const itemId = item.getAttribute('id');
						const thumbnail = item.querySelector('thumbnail')?.textContent;
						// Find matching model and update image
						const model = ret.find(r => r.id === itemId);
						if (model && thumbnail) {
							(model as BoardGameModel).image = thumbnail;
						}
					}
				}
			} catch (e) {
				// If fetching thumbnails fails, continue without images
				console.debug('MDB | Failed to fetch BGG thumbnails:', e);
			}
		}

		return ret;
	}

	async getById(id: string): Promise<MediaTypeModel> {
		console.log(`MDB | api "${this.apiName}" queried by ID`);

		const searchUrl = `${this.apiUrl}/thing?id=${encodeURIComponent(id)}&stats=1`;
		const fetchData = await requestUrl({
			url: searchUrl,
			headers: {
				Authorization: `Bearer ${this.plugin.settings.BoardgameGeekKey}`,
			},
		});

		if (fetchData.status === 401) {
			throw Error(`MDB | Authentication for ${this.apiName} failed. Check the API key.`);
		}

		if (fetchData.status !== 200) {
			throw Error(`MDB | Received status code ${fetchData.status} from ${this.apiName}.`);
		}

		const data = fetchData.text;
		const response = new window.DOMParser().parseFromString(data, 'text/xml');
		// console.debug(response);

		const item = response.querySelector('item');
		if (!item) {
			throw Error(`MDB | Received invalid data from ${this.apiName}.`);
		}

		const title = item.querySelector('name[type="primary"]')?.getAttribute('value') ?? undefined;
		const year = item.querySelector('yearpublished')?.getAttribute('value') ?? '';
		const image = item.querySelector('image')?.textContent ?? undefined;
		const onlineRating = Number.parseFloat(
			item.querySelector('statistics ratings average')?.getAttribute('value') ?? '0'
		);
		
		// Categories (genres)
		const genres = Array.from(item.querySelectorAll('link[type="boardgamecategory"]'))
			.map(n => n.getAttribute('value'))
			.filter((n): n is string => n !== null);
		
		// Complexity rating (weight)
		const complexityRating = Number.parseFloat(
			item.querySelector('statistics ratings averageweight')?.getAttribute('value') ?? '0'
		);
		
		// Player count
		const minPlayers = Number.parseInt(item.querySelector('minplayers')?.getAttribute('value') ?? '0', 10);
		const maxPlayers = Number.parseInt(item.querySelector('maxplayers')?.getAttribute('value') ?? '0', 10);
		
		// Playtime
		const playtime = (item.querySelector('playingtime')?.getAttribute('value') ?? 'unknown') + ' minutes';
		
		// Publishers
		const publishers = Array.from(item.querySelectorAll('link[type="boardgamepublisher"]'))
			.map(n => n.getAttribute('value'))
			.filter((n): n is string => n !== null);

		// BGG Rank - get the "Board Game Rank" specifically
		const bggRankElement = item.querySelector('statistics ratings ranks rank[name="boardgame"]');
		const bggRankValue = bggRankElement?.getAttribute('value');
		const bggRank = bggRankValue && bggRankValue !== 'Not Ranked' 
			? Number.parseInt(bggRankValue, 10) 
			: null;

		// Mechanics
		const mechanics = Array.from(item.querySelectorAll('link[type="boardgamemechanic"]'))
			.map(n => n.getAttribute('value'))
			.filter((n): n is string => n !== null);

		// Expansions
		const expansions = Array.from(item.querySelectorAll('link[type="boardgameexpansion"]'))
			.map(n => n.getAttribute('value'))
			.filter((n): n is string => n !== null);

		// Designers
		const designers = Array.from(item.querySelectorAll('link[type="boardgamedesigner"]'))
			.map(n => n.getAttribute('value'))
			.filter((n): n is string => n !== null);

		// Artists
		const artists = Array.from(item.querySelectorAll('link[type="boardgameartist"]'))
			.map(n => n.getAttribute('value'))
			.filter((n): n is string => n !== null);

		// Description - decode common HTML entities
		let description = item.querySelector('description')?.textContent ?? '';
		description = description
		.replace(/&#10;/g, '\n')           // newline
		.replace(/&amp;/g, '&')            // ampersand
		.replace(/&lt;/g, '<')             // less than
		.replace(/&gt;/g, '>')             // greater than
		.replace(/&quot;/g, '"')           // quote
		.replace(/&rsquo;/g, "'")          // right single quote
		.replace(/&lsquo;/g, "'")          // left single quote
		.replace(/&rdquo;/g, '"')          // right double quote
		.replace(/&ldquo;/g, '"')          // left double quote
		.replace(/&mdash;/g, '—')          // em dash
		.replace(/&ndash;/g, '–')          // en dash
		.replace(/&hellip;/g, '...')       // ellipsis
		.trim();

		return new BoardGameModel({
			title: title ?? undefined,
			englishTitle: title ?? undefined,
			year: year === '0' ? '' : year,
			dataSource: this.apiName,
			url: `https://boardgamegeek.com/boardgame/${id}`,
			id: id,

			genres: genres,
			onlineRating: onlineRating,
			complexityRating: complexityRating,
			minPlayers: minPlayers,
			maxPlayers: maxPlayers,
			playtime: playtime,
			publishers: publishers,
			image: image,
			description: description,

			// New properties
			bggRank: bggRank,
			mechanics: mechanics,
			expansions: expansions,
			designers: designers,
			artists: artists,

			released: true,

			userData: {
				played: false,
				personalRating: 0,
			},
		});
	}

	getDisabledMediaTypes(): MediaType[] {
		return this.plugin.settings.BoardgameGeekAPI_disabledMediaTypes;
	}
}