import type { INodeProperties } from 'n8n-workflow';

const showFor = (...operations: string[]) => ({
	show: { resource: ['record'], operation: operations },
});

const OPERATOR_OPTIONS: INodeProperties['options'] = [
	{ name: 'Between', value: 'btw', description: 'Inside a range, inclusive. Value: min,max' },
	{ name: 'Contains', value: 'like', description: 'Text contains the value' },
	{ name: 'Does Not Contain', value: 'nlike' },
	{ name: 'Equals', value: 'eq' },
	{ name: 'Greater Than', value: 'gt' },
	{ name: 'Greater Than or Equal', value: 'ge' },
	{ name: 'In List', value: 'in', description: 'Equals one of the values. Value: a,b,c' },
	{ name: 'Is Empty', value: 'null' },
	{ name: 'Is Not Empty', value: 'notnull' },
	{ name: 'Less Than', value: 'lt' },
	{ name: 'Less Than or Equal', value: 'le' },
	{ name: 'Not Equals', value: 'neq' },
];

const responseFormatOption: INodeProperties = {
	displayName: 'Response Format',
	name: 'responseFormat',
	type: 'options',
	options: [
		{ name: 'Field IDs', value: 'ids' },
		{ name: 'Field Names', value: 'names' },
	],
	default: 'names',
	description: 'Whether returned record data uses field IDs or field names',
};

const richTextOption: INodeProperties = {
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
};

/** Table selector shared by the Tabrica node and the Tabrica Trigger. */
export const tableProperties = (displayOptions: INodeProperties['displayOptions'] = {}): INodeProperties[] => [
	{
		displayName: 'Table Source',
		name: 'tableSource',
		type: 'options',
		options: [
			{ name: 'IDs', value: 'ids' },
			{ name: 'Table URL', value: 'url', description: 'Paste the address of the table from your browser' },
		],
		default: 'ids',
		description: 'How to identify the table',
		displayOptions,
	},
	{
		displayName: 'Table URL',
		name: 'tableUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'https://tabrica.ru/orgs/my-org/db/82/table/142',
		description: 'Address of the table in your browser. Database and table IDs are taken from it.',
		displayOptions: {
			show: { ...displayOptions.show, tableSource: ['url'] },
		},
	},
	{
		displayName: 'Database ID',
		name: 'databaseId',
		type: 'number',
		default: 0,
		required: true,
		description: 'Numeric database ID. It is the number after /db/ in the table URL.',
		displayOptions: {
			show: { ...displayOptions.show, tableSource: ['ids'] },
		},
	},
	{
		displayName: 'Table ID',
		name: 'tableId',
		type: 'number',
		default: 0,
		required: true,
		description: 'Numeric table ID. It is the number after /table/ in the table URL.',
		displayOptions: {
			show: { ...displayOptions.show, tableSource: ['ids'] },
		},
	},
];

export const recordProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [{ name: 'Record', value: 'record' }],
		default: 'record',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['record'] } },
		options: [
			{
				name: 'Count',
				value: 'count',
				description: 'Count records, optionally matching a filter',
				action: 'Count records',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a record',
				action: 'Create a record',
			},
			{
				name: 'Create or Update',
				value: 'upsert',
				description: 'Update the record matching a field value, or create it if none exists',
				action: 'Create or update a record',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a record',
				action: 'Delete a record',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a record by ID',
				action: 'Get a record',
			},
			{
				name: 'Get Many',
				value: 'list',
				description: 'Get many records, with filtering and sorting',
				action: 'Get many records',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a record',
				action: 'Update a record',
			},
		],
		default: 'list',
	},

	...tableProperties({ show: { resource: ['record'] } }),

	{
		displayName: 'Row ID',
		name: 'rowId',
		type: 'number',
		default: 0,
		required: true,
		description: 'Numeric record ID (the "id" key of every returned record)',
		displayOptions: showFor('get', 'update', 'delete'),
	},

	// ---- Data input (create / update / upsert) ----------------------------
	{
		displayName: 'Match Field',
		name: 'matchField',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'Email',
		description:
			'Name of the field used to find an existing record. Its value is taken from the record data below. Avoid values with commas or parentheses.',
		displayOptions: showFor('upsert'),
	},
	{
		displayName: 'Data Mode',
		name: 'dataMode',
		type: 'options',
		options: [
			{ name: 'Define Below', value: 'fields', description: 'Add field names and values one by one' },
			{ name: 'JSON', value: 'json', description: 'Provide the record as a JSON object' },
			{
				name: 'Map Input Data Automatically',
				value: 'autoMap',
				description: 'Use the incoming item as the record; keys must match field names or IDs',
			},
		],
		default: 'json',
		displayOptions: showFor('create', 'update', 'upsert'),
	},
	{
		displayName: 'Data',
		name: 'data',
		type: 'json',
		default: '{}',
		required: true,
		description: 'Record data. Keys can be field names or field IDs.',
		displayOptions: {
			show: { resource: ['record'], operation: ['create', 'update', 'upsert'], dataMode: ['json'] },
		},
	},
	{
		displayName: 'Fields',
		name: 'fieldsUi',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Field',
		default: {},
		description: 'Field values to write',
		displayOptions: {
			show: { resource: ['record'], operation: ['create', 'update', 'upsert'], dataMode: ['fields'] },
		},
		options: [
			{
				displayName: 'Field',
				name: 'values',
				values: [
					{
						displayName: 'Field Name or ID',
						name: 'name',
						type: 'string',
						default: '',
						placeholder: 'Status',
					},
					{
						displayName: 'Value Type',
						name: 'type',
						type: 'options',
						options: [
							{ name: 'Auto', value: 'auto', description: 'Send as is (expressions keep their type)' },
							{ name: 'Boolean', value: 'boolean' },
							{ name: 'JSON', value: 'json', description: 'Arrays, objects, or JSON values' },
							{ name: 'Number', value: 'number' },
							{ name: 'String', value: 'string' },
						],
						default: 'auto',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
					},
				],
			},
		],
	},
	{
		displayName: 'Fields to Ignore',
		name: 'ignoreFields',
		type: 'string',
		default: 'id',
		description: 'Comma-separated keys of the input item that should not be sent to Tabrica',
		displayOptions: {
			show: { resource: ['record'], operation: ['create', 'update', 'upsert'], dataMode: ['autoMap'] },
		},
	},

	// ---- Get Many ---------------------------------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: showFor('list'),
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 1000 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['record'], operation: ['list'], returnAll: [false] } },
	},
	{
		displayName: 'Page Size',
		name: 'pageSize',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 1000 },
		default: 1000,
		description: 'Number of records to request per API call when Return All is enabled',
		displayOptions: { show: { resource: ['record'], operation: ['list'], returnAll: [true] } },
	},
	{
		displayName: 'Offset',
		name: 'offset',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		description: 'Number of records to skip',
		displayOptions: showFor('list'),
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'fixedCollection',
		typeOptions: { multipleValues: false },
		placeholder: 'Add Condition',
		default: {},
		description: 'Only return records matching these conditions',
		displayOptions: showFor('list', 'count'),
		options: [
			{
				displayName: 'Filter',
				name: 'filter',
				values: [
					{
						displayName: 'Match',
						name: 'combinator',
						type: 'options',
						options: [
							{ name: 'All Conditions (AND)', value: 'and' },
							{ name: 'Any Condition (OR)', value: 'or' },
						],
						default: 'and',
					},
					{
						displayName: 'Conditions',
						name: 'conditions',
						type: 'fixedCollection',
						typeOptions: { multipleValues: true },
						placeholder: 'Add Condition',
						default: {},
						options: [
							{
								displayName: 'Condition',
								name: 'condition',
								values: [
									{
										displayName: 'Field Name or ID',
										name: 'field',
										type: 'string',
										default: '',
										placeholder: 'Status',
									},
									{
										displayName: 'Operator',
										name: 'operator',
										type: 'options',
										options: OPERATOR_OPTIONS,
										default: 'eq',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description:
											'Value to compare with. Dates also accept today, yesterday, tomorrow, daysAgo,N, daysFromNow,N, exactDate,YYYY-MM-DD.',
										displayOptions: { hide: { operator: ['null', 'notnull'] } },
									},
								],
							},
						],
					},
				],
			},
		],
	},
	{
		displayName: 'Sort',
		name: 'sortRules',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Sort Rule',
		default: {},
		displayOptions: showFor('list'),
		options: [
			{
				displayName: 'Rule',
				name: 'rules',
				values: [
					{
						displayName: 'Field Name or ID',
						name: 'field',
						type: 'string',
						default: '',
						placeholder: 'id',
						description: 'Field name or ID. You can also use id, created_at, updated_at, or position.',
					},
					{
						displayName: 'Direction',
						name: 'direction',
						type: 'options',
						options: [
							{ name: 'Ascending', value: 'asc' },
							{ name: 'Descending', value: 'desc' },
						],
						default: 'asc',
					},
				],
			},
		],
	},
	{
		displayName: 'Split List Result',
		name: 'splitListResult',
		type: 'boolean',
		default: true,
		description: 'Whether each returned record should become a separate n8n item',
		displayOptions: showFor('list'),
	},

	// ---- Options ----------------------------------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor('list', 'get', 'update'),
		options: [
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'string',
				default: '',
				placeholder: 'Name,Status',
				description:
					'Comma-separated field names or IDs to include in the result. Selecting only what you need keeps responses small (Get and Get Many).',
			},
			responseFormatOption,
			{
				...richTextOption,
				description: 'How formatted long text fields are returned (Get and Get Many)',
			},
			{
				displayName: 'Sort (Raw)',
				name: 'sort',
				type: 'string',
				default: '',
				description: 'Raw sort string, added to the Sort rules. Comma-separated; prefix with - for descending. Get Many only.',
			},
			{
				displayName: 'Where (Raw)',
				name: 'where',
				type: 'string',
				default: '',
				placeholder: '(Status,eq,Active)~and(Priority,gt,2)',
				description:
					'Raw where expression (Get Many only). Joined with the Filters using AND. Supports ~and, ~or, ~not and nested groups.',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'upsertOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor('upsert'),
		options: [responseFormatOption],
	},
	{
		displayName: 'Options',
		name: 'createOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor('create'),
		options: [
			{
				displayName: 'Return Full Record',
				name: 'returnFullRecord',
				type: 'boolean',
				default: false,
				description:
					'Whether to fetch the created record afterwards so the output has the same shape as Get. Uses one additional API request.',
			},
			responseFormatOption,
			richTextOption,
		],
	},
	{
		displayName: 'Options',
		name: 'countOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor('count'),
		options: [
			{
				displayName: 'Where (Raw)',
				name: 'where',
				type: 'string',
				default: '',
				placeholder: '(Status,eq,Active)',
				description: 'Raw where expression, joined with the Filters using AND',
			},
		],
	},
];
