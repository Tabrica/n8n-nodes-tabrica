<div align="center">

<img src="nodes/Tabrica/tabrica-logo.svg" alt="Tabrica" width="96" height="96" />

# n8n-nodes-tabrica

**Connect [Tabrica](https://tabrica.ru) to 400+ apps in n8n.**
Read, create, update and sync table records — and start workflows when new rows appear.

[![npm version](https://img.shields.io/npm/v/n8n-nodes-tabrica?color=E5412C)](https://www.npmjs.com/package/n8n-nodes-tabrica)
[![license](https://img.shields.io/npm/l/n8n-nodes-tabrica?color=E5412C)](LICENSE)
[![n8n community node](https://img.shields.io/badge/n8n-community%20node-E5412C)](https://docs.n8n.io/integrations/community-nodes/installation/)

[Tabrica](https://tabrica.ru) · [Public API docs](https://tabrica.ru/docs/public-api) · [Русская версия](README.ru.md)

</div>

---

## What is Tabrica?

[Tabrica](https://tabrica.ru) is a no-code database and table builder: organize data in tables, work on it together with your team, and automate it through a Public API. This package brings that API into [n8n](https://n8n.io), so you can plug your tables into any workflow without writing code.

## Installation

### In the n8n interface (self-hosted)

1. Open **Settings → Community Nodes**.
2. Click **Install** and enter `n8n-nodes-tabrica`.
3. Accept the community node notice and click **Install**.

### From the command line

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-tabrica
```

Restart n8n afterwards. See the n8n guide on [installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/) for Docker and other setups.

> Requires n8n with community nodes enabled and Node.js 18.10 or newer.

## Credentials

1. In Tabrica open your organization settings → **API** tab and create a token.
   - **Read** token: list and get records.
   - **Write** (editor) token: also create, update and delete.
2. In n8n create a **Tabrica API** credential:

| Field | Value |
| --- | --- |
| Base URL | `https://api.tabrica.ru` (or the URL of your own installation) |
| API Token | the token from step 1 |

## Features

### Tabrica node — records

| Operation | What it does |
| --- | --- |
| **Get Many** | List records with pagination, filters, sorting, field selection and rich-text format. *Return All* walks through every page for you. |
| **Get** | Fetch one record by its ID. |
| **Create** | Add a record. Optionally return the full created record. |
| **Update** | Change fields of an existing record (partial update). |
| **Create or Update** | Find a record by a match field (e.g. an email) and update it, or create it if it does not exist. The output tells you which one happened (`_action`). |
| **Delete** | Remove a record. |
| **Count** | Count the records in a table, optionally matching a filter. |

### Made to be pleasant to use

- 🔗 **Paste a table URL.** Copy the address of your table from the browser — database and table IDs are picked up automatically.
- 🧩 **Three ways to provide data:** type fields in a typed key-value list, write JSON, or map the incoming item automatically.
- 🔍 **Visual filters.** Build conditions with *equals, contains, greater than, between, in list, is empty…* combined with AND / OR. Date keywords such as `today`, `daysAgo,7` work too. Raw `where` expressions are still available.
- ↕️ **Sort rules** with ascending / descending direction (including `id` and `created_at`).
- 🎯 **Select only the fields you need** to keep responses small and fast.
- 💬 **Clear error messages.** API errors such as *read-only token* or *record not found* come with hints on how to fix them.
- 🤖 **Works as an AI Agent tool** in n8n.
- ♻️ **Backward compatible** with workflows created in 0.1.x.

### Tabrica Trigger

Starts a workflow whenever a **new record** is added to a table. Optionally limit it with a filter. Records are delivered oldest first, and the first activation only remembers the current state, so you will not get a flood of old rows.

## Example: sync form submissions to Tabrica

```
Webhook  ──►  Tabrica (Create or Update)  ──►  Slack
              Match Field: Email
```

1. Add a **Webhook** trigger for your form.
2. Add the **Tabrica** node, choose **Create or Update**, paste your table URL.
3. Set *Data Mode* to **Map Input Data Automatically** or fill the fields by hand and set *Match Field* to `Email`.
4. Branch on `{{ $json._action }}` to notify only about new customers.

## Good to know

- Every input item makes one API request, which counts towards your plan's monthly Public API limit. Use *Fields* and *Return All* with a large page size to keep usage low.
- IDs are numeric; you can read them from the table URL: `https://tabrica.ru/orgs/<org>/db/<database-id>/table/<table-id>`.
- The Public API currently has no endpoints that list databases, tables and fields, so those are entered by URL or ID rather than picked from dropdowns.

## Development

```bash
git clone https://github.com/Tabrica/n8n-nodes-tabrica.git
cd n8n-nodes-tabrica
npm install
npm run build
```

To try the nodes locally, pack them and install into your n8n:

```bash
npm pack
cd ~/.n8n/nodes
npm install /path/to/n8n-nodes-tabrica-<version>.tgz
```

## Links

- 🌐 Tabrica: <https://tabrica.ru>
- 📘 Public API documentation: <https://tabrica.ru/docs/public-api>
- 🐛 Issues: <https://github.com/Tabrica/n8n-nodes-tabrica/issues>

## License

[MIT](LICENSE) © Tabrica
