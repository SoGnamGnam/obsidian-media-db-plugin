import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';

export type OverwriteAction = 'cancel' | 'overwrite' | 'update';

export interface ConfirmOverwriteModalOptions {
	/**
	 * Offers a third choice that refreshes the existing note instead of replacing it. Only pass this
	 * where the caller can actually run the merge, i.e. where the media model is available.
	 */
	allowUpdate?: boolean;
}

export class ConfirmOverwriteModal extends Modal {
	action: OverwriteAction = 'cancel';
	onSubmit: (action: OverwriteAction) => void;
	fileName: string;
	allowUpdate: boolean;

	constructor(app: App, fileName: string, onSubmit: (action: OverwriteAction) => void, options: ConfirmOverwriteModalOptions = {}) {
		super(app);
		this.fileName = fileName;
		this.onSubmit = onSubmit;
		this.allowUpdate = options.allowUpdate ?? false;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'File already exists' });
		contentEl.createEl('p', { text: `The file "${this.fileName}" already exists. What do you want to do?` });

		if (this.allowUpdate) {
			contentEl.createEl('p', {
				cls: 'media-db-plugin-confirm-overwrite-hint',
				text: 'Updating refreshes the fields that come from the API and keeps the ones you filled in yourself, along with the note body. Overwriting replaces the whole note.',
			});
		}

		contentEl.createDiv({ cls: 'media-db-plugin-spacer' });

		const bottomSettingRow = new Setting(contentEl);
		bottomSettingRow.addButton(btn => {
			btn.setButtonText('Cancel');
			btn.onClick(() => this.close());
			btn.buttonEl.addClass('media-db-plugin-button');
		});
		bottomSettingRow.addButton(btn => {
			btn.setButtonText('Overwrite');
			if (!this.allowUpdate) {
				btn.setCta();
			}
			btn.onClick(() => this.submit('overwrite'));
			btn.buttonEl.addClass('media-db-plugin-button');
		});
		if (this.allowUpdate) {
			bottomSettingRow.addButton(btn => {
				btn.setButtonText('Update note');
				btn.setCta();
				btn.onClick(() => this.submit('update'));
				btn.buttonEl.addClass('media-db-plugin-button');
			});
		}
	}

	private submit(action: OverwriteAction): void {
		this.action = action;
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.onSubmit(this.action);
	}
}
