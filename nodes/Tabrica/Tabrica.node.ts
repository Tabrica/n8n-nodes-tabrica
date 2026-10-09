import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	addOptionalQueryParameter,
	assertNotEmpty,
	assertTableRef,
	buildSort,
	buildWhere,
	getRecordData,
	getTableRef,
	listRecords,
	recordsPath,
	tabricaApiRequest,
} from './GenericFunctions';
import type { TabricaTableRef } from './GenericFunctions';
import { recordProperties } from './RecordDescription';

type RecordResult = { record: IDataObject };
type CreateResult = { id: number; data: IDataObject };

function requireDatabaseId(context: IExecuteFunctions, ref: TabricaTableRef, itemIndex: number): void {
	if (!ref.databaseId) {
		throw new NodeOperationError(context.getNode(), 'Database ID is required', { itemIndex });
	}
}

export class Tabrica implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tabrica',
		name: 'tabrica',
		icon: 'file:tabrica-logo.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and write records in Tabrica tables',
		defaults: {
			name: 'Tabrica',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'tabricaApi',
				required: true,
			},
		],
		properties: recordProperties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		if (resource !== 'record') {
			throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`);
		}

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const pairedItem = { item: itemIndex };

			try {
				const ref = getTableRef(this, itemIndex);
				assertTableRef(this, ref, itemIndex);

				if (operation === 'list') {
					requireDatabaseId(this, ref, itemIndex);

					const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
					const splitListResult = this.getNodeParameter('splitListResult', itemIndex) as boolean;
					const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
					const offset = this.getNodeParameter('offset', itemIndex, 0) as number;
					const limit = returnAll
						? (this.getNodeParameter('pageSize', itemIndex) as number)
						: (this.getNodeParameter('limit', itemIndex) as number);

					const qs: IDataObject = {};
					addOptionalQueryParameter(qs, 'where', buildWhere(this, itemIndex, options.where as string | undefined));
					addOptionalQueryParameter(qs, 'sort', buildSort(this, itemIndex, options.sort as string | undefined));
					addOptionalQueryParameter(qs, 'fields', options.fields as string | undefined);
					addOptionalQueryParameter(qs, 'response_format', options.responseFormat as string | undefined);
					addOptionalQueryParameter(qs, 'rich_text', options.richText as string | undefined);

					const { records, total } = await listRecords(this, ref, qs, returnAll, limit, offset);

					if (splitListResult) {
						for (const record of records) {
							returnData.push({ json: record, pairedItem });
						}
					} else {
						returnData.push({ json: { records, total, limit, offset }, pairedItem });
					}

					continue;
				}

				if (operation === 'count') {
					requireDatabaseId(this, ref, itemIndex);

					const options = this.getNodeParameter('countOptions', itemIndex, {}) as IDataObject;
					const qs: IDataObject = { limit: 1, offset: 0 };
					addOptionalQueryParameter(qs, 'where', buildWhere(this, itemIndex, options.where as string | undefined));

					const page = await tabricaApiRequest<{ total: number }>(this, 'GET', recordsPath(ref), qs);
					returnData.push({ json: { total: page.total ?? 0 }, pairedItem });

					continue;
				}

				if (operation === 'get') {
					requireDatabaseId(this, ref, itemIndex);

					const rowId = this.getNodeParameter('rowId', itemIndex) as number;
					const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
					const qs: IDataObject = {};
					addOptionalQueryParameter(qs, 'fields', options.fields as string | undefined);
					addOptionalQueryParameter(qs, 'response_format', options.responseFormat as string | undefined);
					addOptionalQueryParameter(qs, 'rich_text', options.richText as string | undefined);

					const result = await tabricaApiRequest<RecordResult>(this, 'GET', recordsPath(ref, rowId), qs);
					returnData.push({ json: result.record, pairedItem });

					continue;
				}

				if (operation === 'create') {
					const data = getRecordData(this, itemIndex);
					const options = this.getNodeParameter('createOptions', itemIndex, {}) as IDataObject;

					// Workflows created before the v1 API only stored the table ID: keep them working.
					const result = ref.databaseId
						? await tabricaApiRequest<CreateResult>(this, 'POST', recordsPath(ref), {}, { data })
						: await tabricaApiRequest<CreateResult>(
								this,
								'POST',
								'/public/record/create',
								{ table_id: ref.tableId },
								{ data },
							);

					if (options.returnFullRecord === true && ref.databaseId) {
						const qs: IDataObject = {};
						addOptionalQueryParameter(qs, 'response_format', options.responseFormat as string | undefined);
						addOptionalQueryParameter(qs, 'rich_text', options.richText as string | undefined);

						const full = await tabricaApiRequest<RecordResult>(this, 'GET', recordsPath(ref, result.id), qs);
						returnData.push({ json: full.record, pairedItem });
					} else {
						returnData.push({ json: result as unknown as IDataObject, pairedItem });
					}

					continue;
				}

				if (operation === 'update') {
					const rowId = this.getNodeParameter('rowId', itemIndex) as number;
					const data = getRecordData(this, itemIndex);
					assertNotEmpty(this, data, itemIndex);

					const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
					const qs: IDataObject = {};
					addOptionalQueryParameter(qs, 'response_format', options.responseFormat as string | undefined);

					const result = ref.databaseId
						? await tabricaApiRequest<RecordResult>(this, 'PATCH', recordsPath(ref, rowId), qs, { data })
						: await tabricaApiRequest<RecordResult>(
								this,
								'POST',
								'/public/record/update',
								{ ...qs, table_id: ref.tableId, row_id: rowId },
								{ data },
							);

					returnData.push({ json: result.record, pairedItem });

					continue;
				}

				if (operation === 'upsert') {
					requireDatabaseId(this, ref, itemIndex);

					const matchField = (this.getNodeParameter('matchField', itemIndex) as string).trim();
					const data = getRecordData(this, itemIndex);
					const options = this.getNodeParameter('upsertOptions', itemIndex, {}) as IDataObject;
					const responseFormat = (options.responseFormat as string | undefined) ?? 'names';
					const matchValue = data[matchField];

					if (!matchField) {
						throw new NodeOperationError(this.getNode(), 'Match Field is required', { itemIndex });
					}

					if (matchValue === undefined || matchValue === null || matchValue === '') {
						throw new NodeOperationError(
							this.getNode(),
							`The record data has no value for the match field "${matchField}"`,
							{ itemIndex, description: 'Add the match field to the record data so existing records can be found.' },
						);
					}

					const matchText = String(matchValue);
					if (/[,()~]/.test(matchText)) {
						throw new NodeOperationError(
							this.getNode(),
							'The match value contains characters that cannot be used in a lookup: , ( ) ~',
							{ itemIndex, description: 'Use a different match field, such as an email, an external ID, or a slug.' },
						);
					}

					const found = await tabricaApiRequest<{ records: IDataObject[] }>(this, 'GET', recordsPath(ref), {
						where: `(${matchField},eq,${matchText})`,
						sort: 'id',
						limit: 1,
						fields: 'id',
					});
					const existingId = found.records?.[0]?.id as number | undefined;

					if (existingId !== undefined) {
						const updated = await tabricaApiRequest<RecordResult>(
							this,
							'PATCH',
							recordsPath(ref, existingId),
							{ response_format: responseFormat },
							{ data },
						);
						returnData.push({ json: { ...updated.record, _action: 'updated' }, pairedItem });
					} else {
						const created = await tabricaApiRequest<CreateResult>(this, 'POST', recordsPath(ref), {}, { data });
						const full = await tabricaApiRequest<RecordResult>(this, 'GET', recordsPath(ref, created.id), {
							response_format: responseFormat,
						});
						returnData.push({ json: { ...full.record, _action: 'created' }, pairedItem });
					}

					continue;
				}

				if (operation === 'delete') {
					const rowId = this.getNodeParameter('rowId', itemIndex) as number;

					const result = ref.databaseId
						? await tabricaApiRequest<IDataObject>(this, 'DELETE', recordsPath(ref, rowId))
						: await tabricaApiRequest<IDataObject>(this, 'POST', '/public/record/delete', {
								table_id: ref.tableId,
								row_id: rowId,
							});

					returnData.push({ json: { ...result, id: rowId }, pairedItem });

					continue;
				}

				throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, {
					itemIndex,
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem,
					});
					continue;
				}

				throw error;
			}
		}

		return [returnData];
	}
}
