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
	playtime: string;
	publishers: string[];
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
		this.playtime = '';
		this.publishers = [];
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
}
