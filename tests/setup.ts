import { mock } from 'bun:test';

function parseScalar(value: string): unknown {
	if (value === 'true') return true;
	if (value === 'false') return false;
	if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
	return value.replace(/^['"]|['"]$/g, '');
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const line of yaml.split('\n')) {
		const match = /^([^:#][^:]*):\s*(.*)$/.exec(line.trim());
		if (!match) continue;

		const [, key, value] = match;
		result[key] =
			value.startsWith('[') && value.endsWith(']')
				? value
						.slice(1, -1)
						.split(',')
						.map(item => parseScalar(item.trim()))
				: parseScalar(value);
	}

	return result;
}

function stringifySimpleYaml(value: unknown): string {
	if (!value || typeof value !== 'object') return String(value);

	return Object.entries(value as Record<string, unknown>)
		.map(([key, entry]) => `${key}: ${Array.isArray(entry) ? `[${entry.join(', ')}]` : String(entry)}`)
		.join('\n')
		.concat('\n');
}

mock.module('obsidian', () => ({
	AbstractInputSuggest: class {},
	Component: class {
		load(): void {}
		unload(): void {}
	},
	DropdownComponent: class {},
	MarkdownRenderer: { render: async (): Promise<void> => {} },
	MarkdownView: class {},
	Modal: class {
		app: unknown;

		constructor(app: unknown) {
			this.app = app;
		}

		open(): void {}
		close(): void {}
	},
	Notice: class {},
	normalizePath: (path: string): string => path,
	moment: Object.assign((value?: unknown): unknown => value, { locale: (): void => {} }),
	parseYaml: parseSimpleYaml,
	Plugin: class {},
	PluginSettingTab: class {},
	requestUrl: async (): Promise<unknown> => ({}),
	SecretComponent: class {},
	Setting: class {},
	SettingGroup: class {},
	stringifyYaml: stringifySimpleYaml,
	TFile: class {},
	TFolder: class {},
	TextComponent: class {},
	ToggleComponent: class {},
}));
