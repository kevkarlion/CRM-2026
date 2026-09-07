# crm-readonly MCP server

Read-only MCP server for the CRM that exposes `get_lead`, `get_client`, and `get_work_order` over stdio.

## Setup

```bash
npm install
npm run build
```

The server resolves its Mongo URI from the repo-root `.env.local` via `MONGODB_URI_READONLY ?? MONGODB_URI` (the root `.env.local` is authoritative; it is gitignored). An optional `mcp/crm-readonly/.env.local` override is also supported and is gitignored — do not create one unless you need to override the root values locally.

## Tools

All tools require `tenantId` and at least one lookup field. They return a JSON string (via `serializeDoc`: `ObjectId` → hex string, `Date` → ISO string) or `null` when no document matches. Errors are structured results with `isError: true` and a human-readable message.

| Tool | Description | Params | Return |
|------|-------------|--------|--------|
| `get_lead` | Look up a lead by id, phone, or email. | `tenantId` (required); `id`, `phone`, `email` | Lead document (JSON) or `null` |
| `get_client` | Look up a client by id, phone, or taxId. | `tenantId` (required); `id`, `phone`, `taxId` | Client document (JSON) or `null` |
| `get_work_order` | Look up a work order by id, workOrderNumber, or clientId. | `tenantId` (required); `id`, `workOrderNumber`, `clientId` | Work order document (JSON) or `null` |

## Read-only guarantees

- Every query is scoped with `tenantId` and filters `deletedAt: null` (soft-deleted records are never returned).
- The server performs zero write operations: only `findOne` queries against `leads`, `clients`, and `workorders`.

## Read-only database user

Create a dedicated read-only user in the Atlas mongo shell:

```javascript
db.getSiblingDB("admin").createUser({
  user: "crm_readonly",
  pwd: "<password>",
  roles: [
    { role: "read", db: "<dbname>" },
  ],
});
```

`MONGODB_URI_READONLY` should carry this user's credentials and takes precedence over `MONGODB_URI` when both are set.

## Registration

The server is registered in the repo-root `opencode.json` under `mcp.crm-readonly` (`node mcp/crm-readonly/dist/server.js`).