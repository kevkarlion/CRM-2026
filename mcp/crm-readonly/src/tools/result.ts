import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}