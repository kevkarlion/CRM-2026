import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const PKG_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST_SERVER = fileURLToPath(new URL('../dist/server.js', import.meta.url));

function contentText(result: CallToolResult): string {
  return result.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');
}

let client: Client | undefined;
let transport: StdioClientTransport | undefined;

beforeAll(() => {
  if (!existsSync(DIST_SERVER)) {
    execSync('npm run build', { cwd: PKG_ROOT, stdio: 'inherit' });
  }
});

describe('crm-readonly stdio e2e', () => {
  beforeEach(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [DIST_SERVER],
      cwd: PKG_ROOT,
    });
    client = new Client({ name: 'crm-readonly-e2e', version: '0.0.1' });
    await client.connect(transport);
  });

  afterEach(async () => {
    if (client) {
      try {
        await client.close();
      } catch {
        // transport may already be closed
      }
    }
  });

  it('announces exactly the three read-only tools', async () => {
    const { tools } = await client!.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get_client',
      'get_lead',
      'get_work_order',
    ]);
  });

  it('get_lead with no args returns a structured missing-lookup error', async () => {
    const result = (await client!.callTool({ name: 'get_lead', arguments: {} })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(contentText(result)).toContain('At least one of id, phone, or email is required');
  });

  it('get_lead with a bad tenantId and no lookup returns a structured error, not a crash', async () => {
    const result = (await client!.callTool({
      name: 'get_lead',
      arguments: { tenantId: 'bad' },
    })) as CallToolResult;
    expect(result.isError).toBe(true);
    const text = contentText(result);
    const acceptable = [
      'At least one of id, phone, or email is required',
      'Invalid tenantId format',
    ];
    expect(acceptable.some((message) => text.includes(message))).toBe(true);
  });

  it('get_client with an invalid id returns a structured error', async () => {
    const result = (await client!.callTool({
      name: 'get_client',
      arguments: { tenantId: 'x', id: 'not-a-valid-objectid' },
    })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(contentText(result)).toContain('Invalid id format');
  });
});