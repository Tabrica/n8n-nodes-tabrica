import type {
	ICredentialType,
	INodeProperties,
	IAuthenticateGeneric,
	ICredentialTestRequest,
} from 'n8n-workflow';

export class TabricaApi implements ICredentialType {
	name = 'tabricaApi';

	displayName = 'Tabrica API';

	icon = 'file:../nodes/Tabrica/tabrica-logo.svg' as const;

	documentationUrl = 'https://tabrica.ru/docs/public-api';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.tabrica.ru',
			placeholder: 'https://api.tabrica.ru',
			description: 'The base URL of your Tabrica Public API instance',
			required: true,
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'Organization API token created in Tabrica settings',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/health',
			method: 'GET',
		},
	};
}
