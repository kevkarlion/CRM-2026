import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { closeDb } from './db.js';
import { getClientInputSchema, handleGetClient } from './tools/get-client.js';
import { getLeadInputSchema, handleGetLead } from './tools/get-lead.js';
import { getWorkOrderInputSchema, handleGetWorkOrder } from './tools/get-work-order.js';

const server = new McpServer(
  {
    name: 'crm-readonly',
    version: '0.1.0',
    description: 'Read-only MCP server for CRM lookups (leads, clients, work orders).',
  },
  {
    capabilities: { tools: {} },
    instructions:
      'Read-only lookup tools: get_lead, get_client, get_work_order. ' +
      'Every tool requires tenantId and at least one lookup field.',
  },
);

server.registerTool(
  'get_lead',
  {
    title: 'Get lead',
    description: 'Look up a lead in the CRM by id, phone, or email.',
    inputSchema: getLeadInputSchema,
  },
  handleGetLead,
);

server.registerTool(
  'get_client',
  {
    title: 'Get client',
    description: 'Look up a client in the CRM by id, phone, or taxId.',
    inputSchema: getClientInputSchema,
  },
  handleGetClient,
);

server.registerTool(
  'get_work_order',
  {
    title: 'Get work order',
    description: 'Look up a work order in the CRM by id, workOrderNumber, or clientId.',
    inputSchema: getWorkOrderInputSchema,
  },
  handleGetWorkOrder,
);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error('[crm-readonly] fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    closeDb()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });
}