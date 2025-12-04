import type MediaDbPlugin from '../main';
import type { MediaTypeModel } from '../models/MediaTypeModel';
import type { SelectModalData, SelectModalOptions } from '../utils/ModalHelper';
import { SELECT_MODAL_OPTIONS_DEFAULT } from '../utils/ModalHelper';
import { SelectModal } from './SelectModal';

export class MediaDbSearchResultModal extends SelectModal<MediaTypeModel> {
	plugin: MediaDbPlugin;

	busy: boolean;
	sendCallback: boolean;

	submitCallback?: (res: SelectModalData) => void;
	closeCallback?: (err?: Error) => void;
	skipCallback?: () => void;

	constructor(plugin: MediaDbPlugin, selectModalOptions: SelectModalOptions) {
		selectModalOptions = Object.assign({}, SELECT_MODAL_OPTIONS_DEFAULT, selectModalOptions);
		super(plugin.app, selectModalOptions.elements ?? [], selectModalOptions.multiSelect);
		this.plugin = plugin;

		this.title = selectModalOptions.modalTitle ?? '';
		this.description = 'Select one or multiple search results.';
		this.addSkipButton = selectModalOptions.skipButton ?? false;

		this.busy = false;

		this.sendCallback = false;
	}

	setSubmitCallback(submitCallback: (res: SelectModalData) => void): void {
		this.submitCallback = submitCallback;
	}

	setCustomCloseCallback(closeCallback: (err?: Error) => void): void {
		this.closeCallback = closeCallback;
	}

	setSkipCallback(skipCallback: () => void): void {
		this.skipCallback = skipCallback;
	}

	// Renders each suggestion item with image thumbnail.
	renderElement(item: MediaTypeModel, el: HTMLElement): void {
		// Create a container with flexbox layout for image + text
		el.addClass('media-db-plugin-select-element-with-image');
		
		// Create image container
		const imageContainer = el.createDiv({ cls: 'media-db-plugin-select-element-image-container' });
		
		// Add image if available
		if (item.image && typeof item.image === 'string' && item.image.startsWith('http')) {
			const img = imageContainer.createEl('img', {
				cls: 'media-db-plugin-select-element-image',
				attr: {
					src: item.image,
					alt: item.title || 'Media thumbnail',
					loading: 'lazy',
				},
			});
			// Handle image load errors
			img.onerror = () => {
				img.style.display = 'none';
				imageContainer.createDiv({ 
					cls: 'media-db-plugin-select-element-image-placeholder',
					text: '📷',
				});
			};
		} else {
			// Show placeholder if no image
			imageContainer.createDiv({ 
				cls: 'media-db-plugin-select-element-image-placeholder',
				text: '📷',
			});
		}

		// Create text container
		const textContainer = el.createDiv({ cls: 'media-db-plugin-select-element-text-container' });
		textContainer.createEl('div', { text: this.plugin.mediaTypeManager.getFileName(item) });
		textContainer.createEl('small', { text: `${item.getSummary()}\n` });
		textContainer.createEl('small', { text: `${item.type.toUpperCase() + (item.subType ? ` (${item.subType})` : '')} from ${item.dataSource}` });
	}

	// Perform action on the selected suggestion.
	submit(): void {
		if (!this.busy) {
			this.busy = true;
			this.submitButton?.setButtonText('Creating entry...');
			this.submitCallback?.({ selected: this.selectModalElements.filter(x => x.isActive()).map(x => x.value) });
		}
	}

	skip(): void {
		this.skipButton?.setButtonText('Skipping...');
		this.skipCallback?.();
	}

	onClose(): void {
		this.closeCallback?.();
	}
}