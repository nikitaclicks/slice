import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tool, jsonSchema } from 'ai';
import type { Tool } from 'ai';
import { wrapToon } from '../tools/index.js';
import { existsSync } from 'fs';

let mcpClient: Client | null = null;
let mcpTransport: StdioClientTransport | null = null;


async function callMcpTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (!mcpClient) return { error: 'MCP client not initialized' };
  try {
    const res = await mcpClient.callTool({ name, arguments: args });
    if (res.isError) return { error: 'tool error', content: res.content };
    const content = res.content as Array<any> | undefined;
    if (Array.isArray(content)) {
      const allText = content.every((c) => c?.type === 'text');
      if (allText) return content.map((c) => c.text).join('\n');
    }
    return content ?? res;
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

/**
 * Spawn context-cutter-mcp, connect via stdio, and return wrapped tools
 * as a named-key record for the Vercel AI SDK.
 *
 * Returns an empty record on failure (never throws).
 */
export async function loadMcpTools(opts?: { silent?: boolean }): Promise<Record<string, Tool>> {
  const cargoBinPath = process.env.HOME + '/.cargo/bin/context-cutter-mcp';

  const strategyCargo = async () => {
    if (!existsSync(cargoBinPath)) return null;
    return new StdioClientTransport({
      command: cargoBinPath,
      args: [],
      env: { ...process.env, PATH: process.env.HOME + '/.cargo/bin:' + process.env.PATH, RUST_LOG: 'error' } as Record<string, string>,
    });
  };

  const strategySystem = async () => {
    const has = await new Promise<boolean>((resolve) => {
      import('child_process').then(({ exec }) => {
        exec('command -v context-cutter-mcp', { shell: 'bash' }, (err) => {
          resolve(!err);
        });
      });
    });
    if (!has) return null;
    return new StdioClientTransport({
      command: 'context-cutter-mcp',
      args: [],
      env: { ...process.env, RUST_LOG: 'error' } as Record<string, string>,
    });
  };

  const strategyNpx = async () =>
    new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'context-cutter-mcp'],
      env: { ...process.env, RUST_LOG: 'error' } as Record<string, string>,
    });

  const strategies: Array<() => Promise<StdioClientTransport | null>> = existsSync(cargoBinPath)
    ? [strategyCargo, strategySystem, strategyNpx]
    : [strategySystem, strategyNpx, strategyCargo];

  for (let i = 0; i < strategies.length; i++) {
    try {
      mcpTransport = await strategies[i]();
      if (!mcpTransport) continue;

      mcpClient = new Client(
        { name: 'slice', version: '0.1.0' },
        { capabilities: {} },
      );

      await mcpClient.connect(mcpTransport);

      const list = await mcpClient.listTools();
      const wrappedTools: Record<string, Tool> = {};

      for (const t of list.tools) {
        const toolName = t.name;
        const inputSchema = t.inputSchema ?? { type: 'object', properties: {}, required: [] };
        wrappedTools[toolName] = wrapToon(tool({
          description: t.description ?? `MCP tool: ${t.name}`,
          parameters: jsonSchema(inputSchema as any),
          execute: async (input: any) => callMcpTool(toolName, input ?? {}),
        }));
      }

      if (!opts?.silent) {
        const names = list.tools.map((t) => t.name).join(', ');
        process.stdout.write(
          `\x1b[90m[mcp] context-cutter loaded (${list.tools.length} tools: ${names})\x1b[0m\n`,
        );
      }

      return wrappedTools;
    } catch (err: any) {
      const prefix = i === 0 ? '\x1b[90m' : '\x1b[33m';
      if (!opts?.silent) {
        process.stdout.write(
          `${prefix}[mcp] strategy ${i + 1} failed: ${err?.message ?? err}\x1b[0m\n`,
        );
      }
      await shutdownMcp().catch(() => {});
    }
  }

  if (!opts?.silent) {
    process.stdout.write('\x1b[33m[mcp] all strategies exhausted, context-cutter unavailable\x1b[0m\n');
  }
  return {};
}

export async function shutdownMcp(): Promise<void> {
  try {
    if (mcpClient) await mcpClient.close();
  } catch {}
  try {
    if (mcpTransport) await mcpTransport.close();
  } catch {}
  mcpClient = null;
  mcpTransport = null;
}
