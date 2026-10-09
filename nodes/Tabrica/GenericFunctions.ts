import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export type TabricaContext = IExecuteFunctions | IPollFunctions;

type TabricaCredentials = {
	baseUrl: string;
	apiToken: string;
};

type TabricaApiResponse<T> = {
	message?: string;
	data?: T;
};

export type TabricaListData = {
	records: IDataObject[];
	total: number;
	limit: number;
	offset: number;
};

export type TabricaTableRef = {
	databaseId: number;
	tableId: number;
};

const ERROR_HINTS: Record<string, { message: string; description: string }> = {
	public_unauthorized: {
		message: 'Invalid or missing Tabrica API token',
		description: 'Check the API token in your Tabrica API credential. Tokens are created in the organization settings (API tab).',
	},
	public_read_only: {
		message: 'This API token is read-only',
		description: 'Create an API token with write access (editor role) to create, update or delete records.',
	},
	public_invalid_where: {
		message: 'Invalid filter',
		description:
			'The filter was rejected. Check that field names are spelled correctly and that the operator is compatible with the field type.',
	},
	public_invalid_data: {
		message: 'Invalid record data',
		description: 'Check that the field names exist in the table, are not read-only, and that the values match the field types.',
	},
	row_not_found: {
		message: 'Record not found',
		description: 'Check the Row ID and make sure it belongs to the selected table.',
	},
	table_not_found: {
		message: 'Table not found',
		description: 'Check the Database ID and Table ID, and that the token belongs to the organization that owns the table.',
	},
	database_not_found: {
		message: 'Database not found',
		description: 'Check the Database ID, and that the token belongs to the organization that owns the database.',
	},
	api_request_limit: {
		message: 'Monthly Tabrica API request limit reached',
		description: 'Wait for the limit to reset or upgrade the plan. You can also reduce calls with the Fields option and larger page sizes.',
	},
};

export function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.trim().replace(/\/+$/, '');
}

function extractErrorBody(error: unknown): { status?: number; message?: string; data?: unknown } {
	const err = error as {
		httpCode?: string | number;
		statusCode?: number;
		response?: { status?: number; body?: unknown; data?: unknown };
		cause?: { response?: { status?: number; data?: unknown; body?: unknown } };
	};

	const response = err.response ?? err.cause?.response;
	const rawBody = response?.body ?? response?.data;
	let body: unknown = rawBody;

	if (typeof rawBody === 'string') {
		try {
			body = JSON.parse(rawBody);
		} catch {
			body = undefined;
		}
	}

	const status = Number(err.httpCode ?? err.statusCode ?? response?.status) || undefined;
	const parsed = (body ?? {}) as { message?: unknown; data?: unknown };

	return {
		status,
		message: typeof parsed.message === 'string' ? parsed.message : undefined,
		data: parsed.data,
	};
}

function toNodeApiError(context: TabricaContext, error: unknown): NodeApiError {
	if (error instanceof NodeApiError) {
		return error;
	}

	const { status, message: code, data } = extractErrorBody(error);
	const hint = code ? ERROR_HINTS[code] : undefined;
	const details: string[] = [];

	if (code) {
		details.push(`Tabrica error code: ${code}`);
	}

	if (data && typeof data === 'object' && Object.keys(data).length > 0) {
		details.push(`Details: ${JSON.stringify(data)}`);
	}

	if (!hint && status === 429) {
		details.push('Rate/usage limit reached. Enable "Retry On Fail" in the node settings or slow the workflow down.');
	}

	return new NodeApiError(context.getNode(), error as JsonObject, {
		message: hint?.message,
		description: [hint?.description, ...details].filter(Boolean).join('\n') || undefined,
		httpCode: status ? String(status) : undefined,
	});
}

export async function tabricaApiRequest<T>(
	context: TabricaContext,
	method: IHttpRequestMethods,
	path: string,
	qs: IDataObject = {},
	body?: IDataObject,
): Promise<T> {
	const credentials = (await context.getCredentials('tabricaApi')) as TabricaCredentials;

	const options: IHttpRequestOptions = {
		method,
		url: `${normalizeBaseUrl(credentials.baseUrl)}${path}`,
		qs,
		json: true,
		headers: {
			Authorization: `Bearer ${credentials.apiToken}`,
			Accept: 'application/json',
		},
	};

	if (body !== undefined) {
		options.body = body;
		options.headers = {
			...options.headers,
			'Content-Type': 'application/json',
		};
	}

	try {
		const response = await context.helpers.httpRequest(options);
		const wrapped = response as TabricaApiResponse<T>;

		if (wrapped && typeof wrapped === 'object' && 'data' in wrapped) {
			return wrapped.data as T;
		}

		return response as T;
	} catch (error) {
		throw toNodeApiError(context, error);
	}
}

/** Public API v1 path: /public/v1/databases/{db}/tables/{table}/records[/{row}] */
export function recordsPath(ref: TabricaTableRef, rowId?: number): string {
	const base = `/public/v1/databases/${ref.databaseId}/tables/${ref.tableId}/records`;
	return rowId === undefined ? base : `${base}/${rowId}`;
}

const TABLE_URL_PATTERN = /\/db\/(\d+)\/table\/(\d+)/;

/**
 * Resolves database/table IDs from either the numeric parameters or a
 * pasted Tabrica table URL (https://tabrica.ru/orgs/<slug>/db/<id>/table/<id>).
 */
export function getTableRef(context: TabricaContext, itemIndex?: number): TabricaTableRef {
	const index = itemIndex ?? 0;
	const mode = context.getNodeParameter('tableSource', index, 'ids') as string;

	if (mode === 'url') {
		const url = (context.getNodeParameter('tableUrl', index, '') as string).trim();
		const match = TABLE_URL_PATTERN.exec(url);

		if (!match) {
			throw new NodeOperationError(
				context.getNode(),
				'Could not find database and table IDs in the URL',
				{
					itemIndex,
					description:
						'Open the table in Tabrica and copy the address from the browser. It looks like https://tabrica.ru/orgs/my-org/db/82/table/142',
				},
			);
		}

		return { databaseId: Number(match[1]), tableId: Number(match[2]) };
	}

	return {
		databaseId: Number(context.getNodeParameter('databaseId', index, 0)),
		tableId: Number(context.getNodeParameter('tableId', index, 0)),
	};
}

export function assertTableRef(context: TabricaContext, ref: TabricaTableRef, itemIndex?: number): void {
	if (!ref.tableId) {
		throw new NodeOperationError(context.getNode(), 'Table ID is required', { itemIndex });
	}
}

export function addOptionalQueryParameter(
	qs: IDataObject,
	name: string,
	value: string | number | boolean | undefined | null,
): void {
	if (value === undefined || value === null || value === '') {
		return;
	}

	qs[name] = value;
}

// ---------------------------------------------------------------------------
// Filters, sorting
// ---------------------------------------------------------------------------

const NO_VALUE_OPERATORS = new Set(['null', 'notnull']);

type FilterCondition = {
	field?: string;
	operator?: string;
	value?: string | number | boolean;
};

/**
 * Builds the `where` query parameter from the "Filters" fixedCollection and an
 * optional raw expression. In Tabrica's grammar AND binds tighter than OR, so a
 * raw expression is only joined with ANDed conditions.
 */
export function buildWhere(
	context: TabricaContext,
	itemIndex: number,
	rawWhere: string | undefined,
): string | undefined {
	const filters = context.getNodeParameter('filters', itemIndex, {}) as {
		filter?: {
			combinator?: string;
			conditions?: { condition?: FilterCondition[] };
		};
	};
	const conditions = (filters.filter?.conditions?.condition ?? []).filter((c) => c.field && c.operator);
	const combinator = filters.filter?.combinator === 'or' ? 'or' : 'and';
	const raw = rawWhere?.trim();

	const parts = conditions.map((c) => {
		const field = String(c.field).trim();

		if (NO_VALUE_OPERATORS.has(String(c.operator))) {
			return `(${field},${c.operator})`;
		}

		return `(${field},${c.operator},${c.value ?? ''})`;
	});

	if (parts.length === 0) {
		return raw || undefined;
	}

	if (raw && combinator === 'or') {
		throw new NodeOperationError(
			context.getNode(),
			'Cannot combine "Where" with OR filters',
			{
				itemIndex,
				description:
					'Put the whole expression either into the Filters list or into the Where option. Use ~or(...) in Where if you need a raw expression.',
			},
		);
	}

	const built = parts.join(`~${combinator}`);
	return raw ? `${raw}~and${built}` : built;
}

export function buildSort(context: TabricaContext, itemIndex: number, rawSort: string | undefined): string | undefined {
	const sortRules = context.getNodeParameter('sortRules', itemIndex, {}) as {
		rules?: Array<{ field?: string; direction?: string }>;
	};

	const parts = (sortRules.rules ?? [])
		.filter((r) => r.field)
		.map((r) => `${r.direction === 'desc' ? '-' : ''}${String(r.field).trim()}`);

	if (rawSort?.trim()) {
		parts.push(rawSort.trim());
	}

	return parts.length > 0 ? parts.join(',') : undefined;
}

// ---------------------------------------------------------------------------
// Record data
// ---------------------------------------------------------------------------

export function parseJsonObject(context: TabricaContext, value: unknown, parameterName: string, itemIndex: number): IDataObject {
	if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
		return value as IDataObject;
	}

	if (typeof value !== 'string' || value.trim() === '') {
		return {};
	}

	try {
		const parsed = JSON.parse(value) as unknown;
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			throw new Error('JSON must be an object');
		}

		return parsed as IDataObject;
	} catch (error) {
		throw new NodeOperationError(
			context.getNode(),
			`Parameter "${parameterName}" must contain a valid JSON object.`,
			{ itemIndex, description: error instanceof Error ? error.message : undefined },
		);
	}
}

type FieldValueRow = {
	name?: string;
	type?: 'auto' | 'string' | 'number' | 'boolean' | 'json';
	value?: unknown;
};

function coerceFieldValue(context: IExecuteFunctions, row: FieldValueRow, itemIndex: number): unknown {
	const { value } = row;

	switch (row.type) {
		case 'string':
			return value === undefined || value === null ? '' : String(value);
		case 'number': {
			if (value === '' || value === null || value === undefined) return null;
			const num = Number(value);
			if (Number.isNaN(num)) {
				throw new NodeOperationError(context.getNode(), `Value of "${row.name}" is not a number: ${String(value)}`, {
					itemIndex,
				});
			}
			return num;
		}
		case 'boolean':
			if (typeof value === 'boolean') return value;
			return String(value).trim().toLowerCase() === 'true';
		case 'json': {
			if (typeof value !== 'string') return value;
			try {
				return JSON.parse(value);
			} catch (error) {
				throw new NodeOperationError(context.getNode(), `Value of "${row.name}" is not valid JSON`, {
					itemIndex,
					description: error instanceof Error ? error.message : undefined,
				});
			}
		}
		default:
			return value;
	}
}

/**
 * Collects the `data` object for create/update/upsert from the selected input mode:
 * JSON, "Define below" key/value rows, or auto-mapped input item.
 */
export function getRecordData(context: IExecuteFunctions, itemIndex: number): IDataObject {
	const mode = context.getNodeParameter('dataMode', itemIndex, 'json') as string;

	if (mode === 'fields') {
		const ui = context.getNodeParameter('fieldsUi', itemIndex, {}) as { values?: FieldValueRow[] };
		const data: IDataObject = {};

		for (const row of ui.values ?? []) {
			const name = row.name?.trim();
			if (!name) continue;
			data[name] = coerceFieldValue(context, row, itemIndex) as IDataObject[string];
		}

		return data;
	}

	if (mode === 'autoMap') {
		const ignore = String(context.getNodeParameter('ignoreFields', itemIndex, 'id'))
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		const input = context.getInputData()[itemIndex].json;

		return Object.fromEntries(Object.entries(input).filter(([key]) => !ignore.includes(key))) as IDataObject;
	}

	return parseJsonObject(context, context.getNodeParameter('data', itemIndex, '{}'), 'data', itemIndex);
}

export function assertNotEmpty(context: IExecuteFunctions, data: IDataObject, itemIndex: number): void {
	if (Object.keys(data).length === 0) {
		throw new NodeOperationError(context.getNode(), 'No record data to send', {
			itemIndex,
			description: 'Add at least one field to the record data.',
		});
	}
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export async function listRecords(
	context: TabricaContext,
	ref: TabricaTableRef,
	qs: IDataObject,
	returnAll: boolean,
	pageSize: number,
	startOffset = 0,
	maxRecords?: number,
): Promise<{ records: IDataObject[]; total: number }> {
	const records: IDataObject[] = [];
	let offset = startOffset;
	let total = 0;

	for (;;) {
		const remaining = maxRecords === undefined ? undefined : maxRecords - records.length;
		const page = await tabricaApiRequest<TabricaListData>(context, 'GET', recordsPath(ref), {
			...qs,
			limit: returnAll ? Math.min(pageSize, remaining ?? pageSize) : pageSize,
			offset,
		});

		const pageRecords = page.records ?? [];
		records.push(...pageRecords);
		total = page.total ?? records.length;
		offset += pageRecords.length;

		if (
			!returnAll ||
			pageRecords.length === 0 ||
			offset >= total ||
			(maxRecords !== undefined && records.length >= maxRecords)
		) {
			break;
		}
	}

	return { records, total };
}
