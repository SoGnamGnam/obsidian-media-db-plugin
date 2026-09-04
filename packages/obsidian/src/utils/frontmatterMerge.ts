import type { PropertyMappingData } from 'packages/obsidian/src/settings/PropertyMapping';
import { PropertyMappingOption } from 'packages/obsidian/src/settings/PropertyMapping';
import type { Metadata } from 'packages/obsidian/src/utils/MediaDbFileHelper';

/**
 * A model property together with every frontmatter key it may be stored under.
 */
export interface OwnedProperty {
	/** Name of the property on the model, e.g. `onlineRating`. */
	property: string;
	/** Key the property is written to under the current mapping, or null when it is mapped to `Remove`. */
	targetKey: string | null;
	/**
	 * Every key the property can occupy in a note: the raw name plus the remapped one. A note written
	 * under a different mapping stores the property under one of these, which is what lets the merge
	 * recognise and clean up keys left behind by a mapping change.
	 */
	ownedKeys: string[];
}

export interface MergeSummary {
	updated: string[];
	added: string[];
	removed: string[];
	preserved: string[];
}

export interface MergeResult extends MergeSummary {
	merged: Metadata;
}

/**
 * Derives the owned keys of every property of one media type from the user's property mappings.
 *
 * `PropertyMappingModel.validate()` guarantees that two properties never share a `newProperty`, and
 * that a `newProperty` never collides with the raw name of another property. The owned key sets are
 * therefore disjoint, so a key found in a note can be attributed to exactly one property.
 */
export function getOwnedProperties(properties: PropertyMappingData[]): OwnedProperty[] {
	return properties.map(property => {
		const remapped = property.mapping === PropertyMappingOption.Map ? property.newProperty : undefined;

		return {
			property: property.property,
			targetKey: property.mapping === PropertyMappingOption.Remove ? null : (remapped ?? property.property),
			ownedKeys: remapped && remapped !== property.property ? [property.property, remapped] : [property.property],
		};
	});
}

/**
 * Merges a fresh api payload into the frontmatter of an existing note.
 *
 * Api owned fields are overwritten, keys the user added on their own are left untouched, and keys
 * left behind by an earlier property mapping are migrated to the name the current mapping uses.
 *
 * `userData` fields (`watched`, `personalRating`, …) are seeded by the apis but belong to the user,
 * so they are never overwritten - only added when missing, or carried over to their new name.
 *
 * @param current frontmatter of the note as it is on disk
 * @param incoming api payload, already run through the property mapper
 * @param ownedProperties output of {@link getOwnedProperties} for the note's media type
 * @param userDataKeys raw names of the model's `userData` fields
 */
export function mergeFrontmatter(current: Metadata, incoming: Metadata, ownedProperties: OwnedProperty[], userDataKeys: string[]): MergeResult {
	const merged: Metadata = { ...current };
	const summary: MergeSummary = { updated: [], added: [], removed: [], preserved: [] };

	const userData = new Set(userDataKeys);
	const handledIncomingKeys = new Set<string>();
	const touchedKeys = new Set<string>();

	for (const owned of ownedProperties) {
		const staleKeys = owned.ownedKeys.filter(key => key !== owned.targetKey && key in merged);

		if (owned.targetKey === null) {
			// mapped to Remove: the plugin no longer owns any key for this property
			removeKeys(merged, staleKeys, summary, touchedKeys);
			continue;
		}

		handledIncomingKeys.add(owned.targetKey);

		if (userData.has(owned.property)) {
			carryOverUserValue(merged, owned.targetKey, staleKeys, incoming, summary, touchedKeys);
		} else if (owned.targetKey in incoming) {
			writeValue(merged, owned.targetKey, incoming[owned.targetKey], summary, touchedKeys);
		}

		removeKeys(merged, staleKeys, summary, touchedKeys);
	}

	// keys the api produced that no mapping accounts for; they are api output by definition
	for (const [key, value] of Object.entries(incoming)) {
		if (handledIncomingKeys.has(key) || userData.has(key)) {
			continue;
		}

		writeValue(merged, key, value, summary, touchedKeys);
	}

	summary.preserved = Object.keys(current).filter(key => !touchedKeys.has(key));

	return { merged, ...summary };
}

function writeValue(merged: Metadata, key: string, value: unknown, summary: MergeSummary, touchedKeys: Set<string>): void {
	const isNew = !(key in merged);
	merged[key] = value;
	touchedKeys.add(key);

	if (isNew) {
		summary.added.push(key);
	} else {
		summary.updated.push(key);
	}
}

/**
 * Keeps whatever the user has in the note, only making sure the value ends up under the key the
 * current mapping expects: carried over from a stale key if the note predates a mapping change,
 * or seeded from the api payload if the field is missing entirely.
 */
function carryOverUserValue(merged: Metadata, targetKey: string, staleKeys: string[], incoming: Metadata, summary: MergeSummary, touchedKeys: Set<string>): void {
	if (targetKey in merged) {
		return;
	}

	const staleKey = staleKeys[0];
	if (staleKey !== undefined) {
		writeValue(merged, targetKey, merged[staleKey], summary, touchedKeys);
	} else if (targetKey in incoming) {
		writeValue(merged, targetKey, incoming[targetKey], summary, touchedKeys);
	}
}

function removeKeys(merged: Metadata, keys: string[], summary: MergeSummary, touchedKeys: Set<string>): void {
	for (const key of keys) {
		delete merged[key];
		summary.removed.push(key);
		touchedKeys.add(key);
	}
}
