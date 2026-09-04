import { requestUrl } from 'obsidian';
import type MediaDbPlugin from '../../main';
import { BookModel } from '../../models/BookModel';
import type { MediaTypeModel } from '../../models/MediaTypeModel';
import { MediaType } from '../../utils/MediaType';
import { APIModel } from '../APIModel';

interface GoogleBooksSearchResponse {
	kind: string;
	totalItems: number;
	items?: GoogleBooksVolume[];
}

interface GoogleBooksVolume {
	kind: string;
	id: string;
	etag: string;
	selfLink: string;
	volumeInfo: GoogleBooksVolumeInfo;
	saleInfo?: GoogleBooksSaleInfo;
	accessInfo?: GoogleBooksAccessInfo;
}

interface GoogleBooksVolumeInfo {
	title: string;
	subtitle?: string;
	authors?: string[];
	publisher?: string;
	publishedDate?: string;
	description?: string;
	industryIdentifiers?: GoogleBooksIndustryIdentifier[];
	pageCount?: number;
	printType?: string;
	categories?: string[];
	averageRating?: number;
	ratingsCount?: number;
	maturityRating?: string;
	imageLinks?: GoogleBooksImageLinks;
	language?: string;
	previewLink?: string;
	infoLink?: string;
	canonicalVolumeLink?: string;
	mainCategory?: string;
	dimensions?: {
		height?: string;
		width?: string;
		thickness?: string;
	};
	contentVersion?: string;
}

interface GoogleBooksIndustryIdentifier {
	type: 'ISBN_10' | 'ISBN_13' | 'ISSN' | 'OTHER';
	identifier: string;
}

interface GoogleBooksImageLinks {
	smallThumbnail?: string;
	thumbnail?: string;
	small?: string;
	medium?: string;
	large?: string;
	extraLarge?: string;
}

interface GoogleBooksSaleInfo {
	country: string;
	saleability: string;
	isEbook: boolean;
	listPrice?: {
		amount: number;
		currencyCode: string;
	};
	retailPrice?: {
		amount: number;
		currencyCode: string;
	};
	buyLink?: string;
}

interface GoogleBooksAccessInfo {
	country: string;
	viewability: string;
	embeddable: boolean;
	publicDomain: boolean;
	textToSpeechPermission: string;
	epub?: {
		isAvailable: boolean;
		acsTokenLink?: string;
	};
	pdf?: {
		isAvailable: boolean;
		acsTokenLink?: string;
	};
	accessViewStatus: string;
}

export class GoogleBooksAPI extends APIModel {
	plugin: MediaDbPlugin;
	private readonly BASE_URL = 'https://www.googleapis.com/books/v1';

	constructor(plugin: MediaDbPlugin) {
		super();

		this.plugin = plugin;
		this.apiName = 'GoogleBooksAPI';
		this.apiDescription = 'Google Books API - Search and access the world\'s most comprehensive index of full-text books.';
		this.apiUrl = 'https://books.google.com/';
		this.types = [MediaType.Book];
	}

	async searchByTitle(title: string): Promise<MediaTypeModel[]> {
		console.log(`MDB | api "${this.apiName}" queried by Title`);

		if (!this.plugin.settings.GoogleBooksKey) {
			throw new Error(`MDB | API key for ${this.apiName} missing.`);
		}

		const searchUrl = `${this.BASE_URL}/volumes?q=${encodeURIComponent(title)}&maxResults=20&key=${this.plugin.settings.GoogleBooksKey}`;

		const response = await requestUrl({
			url: searchUrl,
			method: 'GET',
		});

		if (response.status === 401 || response.status === 403) {
			throw Error(`MDB | Authentication for ${this.apiName} failed. Check the API key.`);
		}
		if (response.status !== 200) {
			throw Error(`MDB | Received status code ${response.status} from ${this.apiName}.`);
		}

		const data = response.json as GoogleBooksSearchResponse;

		if (!data || data.totalItems === 0 || !data.items) {
			return [];
		}

		const results: MediaTypeModel[] = [];

		for (const item of data.items) {
			const volumeInfo = item.volumeInfo;
			
			const year = this.extractYear(volumeInfo.publishedDate);
			
			let thumbnailUrl = volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail;
			if (thumbnailUrl) {
				thumbnailUrl = thumbnailUrl.replace('http://', 'https://');
			}

			results.push(
				new BookModel({
					title: volumeInfo.title,
					englishTitle: volumeInfo.subtitle ? `${volumeInfo.title}: ${volumeInfo.subtitle}` : volumeInfo.title,
					year: year,
					dataSource: this.apiName,
					id: item.id,
					author: volumeInfo.authors?.join(', ') ?? 'Unknown',
					image: thumbnailUrl,
				}),
			);
		}

		return results;
	}

	async getById(id: string): Promise<MediaTypeModel> {
		console.log(`MDB | api "${this.apiName}" queried by ID`);

		if (!this.plugin.settings.GoogleBooksKey) {
			throw new Error(`MDB | API key for ${this.apiName} missing.`);
		}

		const detailUrl = `${this.BASE_URL}/volumes/${id}?key=${this.plugin.settings.GoogleBooksKey}`;

		const response = await requestUrl({
			url: detailUrl,
			method: 'GET',
		});

		if (response.status === 401 || response.status === 403) {
			throw Error(`MDB | Authentication for ${this.apiName} failed. Check the API key.`);
		}
		if (response.status === 404) {
			throw Error(`MDB | Volume with ID ${id} not found on ${this.apiName}.`);
		}
		if (response.status !== 200) {
			throw Error(`MDB | Received status code ${response.status} from ${this.apiName}.`);
		}

		const data = response.json as GoogleBooksVolume;

		if (!data || !data.volumeInfo) {
			throw Error(`MDB | No data received from ${this.apiName}.`);
		}

		const volumeInfo = data.volumeInfo;
		
		const year = this.extractYear(volumeInfo.publishedDate);
		
		const isbn10 = this.extractIdentifier(volumeInfo.industryIdentifiers, 'ISBN_10');
		const isbn13 = this.extractIdentifier(volumeInfo.industryIdentifiers, 'ISBN_13');

		let imageUrl = volumeInfo.imageLinks?.large 
			|| volumeInfo.imageLinks?.medium 
			|| volumeInfo.imageLinks?.small 
			|| volumeInfo.imageLinks?.thumbnail 
			|| volumeInfo.imageLinks?.smallThumbnail;
		
		if (imageUrl) {
			imageUrl = imageUrl.replace('http://', 'https://');
		}

		const plot = this.cleanHtml(volumeInfo.description);

		return new BookModel({
			title: volumeInfo.title,
			englishTitle: volumeInfo.subtitle ? `${volumeInfo.title}: ${volumeInfo.subtitle}` : volumeInfo.title,
			year: year,
			dataSource: this.apiName,
			url: volumeInfo.canonicalVolumeLink || `https://books.google.com/books?id=${id}`,
			id: id,

			author: volumeInfo.authors?.join(', ') ?? 'Unknown',
			plot: plot,
			pages: volumeInfo.pageCount,
			onlineRating: volumeInfo.averageRating,
			image: imageUrl,
			isbn: isbn10 ? Number(isbn10) : undefined,
			isbn13: isbn13 ? Number(isbn13) : undefined,

			genres: volumeInfo.categories ?? [],
			publisher: volumeInfo.publisher ?? '',
			language: this.formatLanguage(volumeInfo.language),

			released: true,

			userData: {
				read: false,
				lastRead: '',
				personalRating: 0,
			},
		});
	}

	private extractYear(publishedDate?: string): string {
		if (!publishedDate) return 'unknown';

		const year = publishedDate.substring(0, 4);
		return year || 'unknown';
	}

	private extractIdentifier(
		identifiers?: GoogleBooksIndustryIdentifier[],
		type: 'ISBN_10' | 'ISBN_13' | 'ISSN' | 'OTHER' = 'ISBN_10'
	): string | undefined {
		if (!identifiers) return undefined;
		
		const found = identifiers.find(id => id.type === type);
		return found?.identifier;
	}

	private cleanHtml(html?: string): string {
		if (!html) return '';
		
		return html
			.replace(/<[^>]*>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/\r\n/g, '\n')
			.trim();
	}

	private formatLanguage(langCode?: string): string {
		if (!langCode) return '';
		
		const languageMap: Record<string, string> = {
			'en': 'English',
			'it': 'Italian',
			'es': 'Spanish',
			'fr': 'French',
			'de': 'German',
			'pt': 'Portuguese',
			'ru': 'Russian',
			'ja': 'Japanese',
			'zh': 'Chinese',
			'ko': 'Korean',
			'ar': 'Arabic',
			'nl': 'Dutch',
			'pl': 'Polish',
			'sv': 'Swedish',
			'da': 'Danish',
			'no': 'Norwegian',
			'fi': 'Finnish',
			'tr': 'Turkish',
			'el': 'Greek',
			'he': 'Hebrew',
			'hi': 'Hindi',
			'th': 'Thai',
			'vi': 'Vietnamese',
			'id': 'Indonesian',
			'cs': 'Czech',
			'hu': 'Hungarian',
			'ro': 'Romanian',
			'uk': 'Ukrainian',
		};
		
		return languageMap[langCode.toLowerCase()] ?? langCode.toUpperCase();
	}

	getDisabledMediaTypes(): MediaType[] {
		return this.plugin.settings.GoogleBooksAPI_disabledMediaTypes;
	}
}