import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import {
	addOptionalQueryParameter,
	assertTableRef,
	getTableRef,
	listRecords,
} from './GenericFunctions';
import { tableProperties } from './RecordDescription';

const PAGE_SIZE = 100;
const MAX_NEW_RECORDS_PER_POLL = 1000;

export class TabricaTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tabrica Trigger',
		name: 'tabricaTrigger',
		icon: 'file:tabrica-logo.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{"On new record"}}',
		description: 'Starts the workflow when a new record is added to a Tabrica table',
		defaults: {
			name: 'Tabrica Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'tabricaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName:
					'The trigger checks the table on every poll and emits records added since the previous check. Each poll uses at least one Public API request.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			...tableProperties(),
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Fields',
						name: 'fields',
						type: 'string',
						default: '',
						description: 'Comma-separated field names or IDs to include',
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						type: 'options',
						options: [
							{ name: 'Field IDs', value: 'ids' },
							{ name: 'Field Names', value: 'names' },
						],
						default: 'names',
						description: 'Whether returned record data uses field IDs or field names',
					},
					{
						displayName: 'Rich Text Format',
						name: 'richText',
						type: 'options',
						options: [
							{ name: 'Markdown', value: 'markdown' },
							{ name: 'HTML', value: 'html' },
							{ name: 'Raw Text', value: 'raw' },
						],
						default: 'markdown',
						description: 'How formatted long text fields are returned',
					},
					{
						displayName: 'Where',
						name: 'where',
						type: 'string',
						default: '',
						placeholder: '(Status,eq,New)',
						description: 'Only emit records that match this where expression',
					},
				],
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const ref = getTableRef(this);
		assertTableRef(this, ref);

		const options = this.getNodeParameter('options', {}) as IDataObject;
		const staticData = this.getWorkflowStaticData('node') as { lastRecordId?: number };
		const isManualRun = this.getMode() === 'manual';

		const qs: IDataObject = { sort: '-id' };
		addOptionalQueryParameter(qs, 'where', options.where as string | undefined);
		addOptionalQueryParameter(qs, 'fields', options.fields as string | undefined);
		addOptionalQueryParameter(qs, 'response_format', options.responseFormat as string | undefined);
		addOptionalQueryParameter(qs, 'rich_text', options.richText as string | undefined);

		// Manual test run: show the latest record so fields can be mapped in the editor.
		if (isManualRun) {
			const { records } = await listRecords(this, ref, qs, false, 1);
			return records.length > 0 ? [records.map((json) => ({ json }))] : null;
		}

		const lastRecordId = staticData.lastRecordId;

		// Newest first: walk pages until we reach a record we have already seen.
		const fresh: IDataObject[] = [];
		let offset = 0;
		let reachedKnown = false;

		while (!reachedKnown && fresh.length < MAX_NEW_RECORDS_PER_POLL) {
			const { records, total } = await listRecords(this, ref, qs, false, PAGE_SIZE, offset);

			if (records.length === 0) break;

			// The first poll only remembers the newest record id; nothing is emitted.
			if (lastRecordId === undefined) {
				staticData.lastRecordId = Number(records[0].id);
				return null;
			}

			for (const record of records) {
				if (Number(record.id) <= lastRecordId) {
					reachedKnown = true;
					break;
				}
				fresh.push(record);
			}

			offset += records.length;
			if (offset >= total) break;
		}

		if (lastRecordId === undefined) {
			// Empty table on the first poll: start from zero so every new record is emitted.
			staticData.lastRecordId = 0;
			return null;
		}

		if (fresh.length === 0) {
			return null;
		}

		staticData.lastRecordId = Math.max(...fresh.map((record) => Number(record.id)));

		// Emit oldest first so downstream nodes see records in creation order.
		return [fresh.reverse().map((json) => ({ json }))];
	}
}
