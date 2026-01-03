import { MediaType } from '../utils/MediaType';
import type { ModelToData } from '../utils/Utils';
import { mediaDbTag, migrateObject } from '../utils/Utils';
import { MediaTypeModel } from './MediaTypeModel';

export type BoardGameData = ModelToData<BoardGameModel>;

export class BoardGameModel extends MediaTypeModel {
	genres: string[];
	onlineRating: number;
	complexityRating: number;
	minPlayers: number;
	maxPlayers: number;
	minAge: number;
	playtime: string;
	publishers: string[];
	description: string;
	image?: string;
	cover?: string;

	bggRank: number | null;
	mechanics: string[];
	expansions: string[];
	designers: string[];
	artists: string[];

	released: boolean;

	userData: {
		played: boolean;
		personalRating: number;
	};

	constructor(obj: BoardGameData) {
		super();

		this.genres = [];
		this.onlineRating = 0;
		this.complexityRating = 0;
		this.minPlayers = 0;
		this.maxPlayers = 0;
		this.minAge = obj.minAge ?? 0;
		this.playtime = '';
		this.publishers = [];
		this.description = '';
		this.image = '';
		this.cover = '';

		this.bggRank = null;
		this.mechanics = [];
		this.expansions = [];
		this.designers = [];
		this.artists = [];

		this.released = false;

		this.userData = {
			played: false,
			personalRating: 0,
		};

		migrateObject(this, obj, this);

		if (!Object.hasOwn(obj, 'userData')) {
			migrateObject(this.userData, obj, this.userData);
		}

		this.type = this.getMediaType();
	}

	getTags(): string[] {
		return [mediaDbTag, 'boardgame'];
	}

	getMediaType(): MediaType {
		return MediaType.BoardGame;
	}

	getSummary(): string {
		return this.englishTitle + ' (' + this.year + ')';
	}
	
	override getWithOutUserData(): Record<string, unknown> {
		const copy = structuredClone(this) as Record<string, unknown>;
		delete copy.userData;
		delete copy.description;
		return copy;
	}
	
	override getBodyContent(): string {
	if (this.description) {
		return `## Description\n\n${this.description}\n`;
	}
	return '';
}
}
