const fs = require('node:fs');
const path = require('node:path');

const assets = [
	{
		from: path.join(__dirname, '..', 'nodes', 'Tabrica', 'tabrica-logo.svg'),
		to: path.join(__dirname, '..', 'dist', 'nodes', 'Tabrica', 'tabrica-logo.svg'),
	},
];

for (const asset of assets) {
	fs.mkdirSync(path.dirname(asset.to), { recursive: true });
	fs.copyFileSync(asset.from, asset.to);
}
