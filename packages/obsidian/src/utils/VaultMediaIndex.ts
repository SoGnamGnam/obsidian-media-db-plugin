import type { TFile } from 'obsidian';
import type MediaDbPlugin from 'packages/obsidian/src/main';
import type { MediaTypeModel } from 'packages/obsidian/src/models/MediaTypeModel';
import { Logger } from 'packages/obsidian/src/utils/Logger';

/**
 * How long a built index is considered fresh. A rebuild only reads the metadata cache,
 * so it is cheap, but there is no point in redoing it on every rendered search result.
 */
const INDEX_TTL_MS = 5000;

export interface VaultMediaEntry {
	file: TFile;
	/** ISO 8601 timestamp, only present on notes written by a version that stamps it. */
	lastUpdate?: string;
}

/**
 * Index of the media entries already present in the vault, keyed by the identity properties
 * of a note (`id`, `dataSource`, `type`).
 *
 * Those three are in `lockedPropertyMappings`, and `PropertyMapping.validate()` rejects both
 * remapping and removal of locked properties, so they never pass through the property mapper.
 * That makes the index immune to the user's property mapping, current or past, and lets it
 * recognise notes created by any earlier version of the plugin.
 */
export class VaultMediaIndex {
	readonly plugin: MediaDbPlugin;

	private readonly bySourceAndId = new Map<string, VaultMediaEntry>();
	private readonly byTypeAndId = new Map<string, VaultMediaEntry>();
	private builtAt = 0;

	constructor(plugin: MediaDbPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Invalidates the index whenever the vault changes, so a note created during this session is
	 * picked up by the next search instead of waiting out the ttl.
	 */
	registerVaultEvents(): void {
		this.plugin.registerEvent(this.plugin.app.metadataCache.on('changed', () => this.invalidate()));
		this.plugin.registerEvent(this.plugin.app.vault.on('delete', () => this.invalidate()));
		this.plugin.registerEvent(this.plugin.app.vault.on('rename', () => this.invalidate()));
	}

	/**
	 * Rebuilds the index if the current one is stale. Pass `force` to rebuild unconditionally.
	 */
	build(force: boolean = false): void {
		if (!force && this.builtAt > 0 && Date.now() - this.builtAt < INDEX_TTL_MS) {
			return;
		}

		this.bySourceAndId.clear();
		this.byTypeAndId.clear();

		for (const file of this.plugin.app.vault.getMarkdownFiles()) {
			const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!frontmatter) {
				continue;
			}

			const id = normalizeIdentityValue(frontmatter.id);
			if (!id) {
				continue;
			}

			const entry: VaultMediaEntry = {
				file,
				lastUpdate: typeof frontmatter.lastUpdate === 'string' ? frontmatter.lastUpdate : undefined,
			};

			const dataSource = normalizeIdentityValue(frontmatter.dataSource);
			if (dataSource) {
				addIfAbsent(this.bySourceAndId, `${dataSource}:${id}`, entry);
			}

			const type = normalizeType(frontmatter.type);
			if (type) {
				addIfAbsent(this.byTypeAndId, `${type}:${id}`, entry);
			}
		}

		this.builtAt = Date.now();
		Logger.debug(`MDB | vault media index built, ${this.bySourceAndId.size} entries by data source, ${this.byTypeAndId.size} by type`);
	}

	/**
	 * Returns the note already holding this search result, if any.
	 *
	 * Matching prefers `dataSource:id`, because an id is only unique within one api. The
	 * `type:id` lookup is a fallback for notes that predate `dataSource` being written.
	 */
	find(model: MediaTypeModel): VaultMediaEntry | undefined {
		const id = normalizeIdentityValue(model.id);
		if (!id) {
			return undefined;
		}

		const dataSource = normalizeIdentityValue(model.dataSource);
		if (dataSource) {
			const match = this.bySourceAndId.get(`${dataSource}:${id}`);
			if (match) {
				return match;
			}
		}

		const type = normalizeType(model.type);
		return type ? this.byTypeAndId.get(`${type}:${id}`) : undefined;
	}

	/** Marks the index as stale, so the next `build()` rebuilds it. */
	invalidate(): void {
		this.builtAt = 0;
	}
}

/**
 * Frontmatter is parsed from yaml, so a numeric id such as `550` comes back as a number while
 * the model always carries a string. Both sides go through this before being compared.
 */
function normalizeIdentityValue(value: unknown): string | undefined {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed ? trimmed.toLowerCase() : undefined;
	}

	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(value);
	}

	return undefined;
}

/** Mirrors the `manga` -> `comicManga` migration that `PropertyMapper.convertObjectBack` applies. */
function normalizeType(value: unknown): string | undefined {
	const type = normalizeIdentityValue(value);
	return type === 'manga' ? 'comicmanga' : type;
}

function addIfAbsent(map: Map<string, VaultMediaEntry>, key: string, entry: VaultMediaEntry): void {
	if (!map.has(key)) {
		map.set(key, entry);
	}
}
