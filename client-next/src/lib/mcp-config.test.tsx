import { describe, expect, it } from 'vitest';
import { changeMcp, mcpServers, mcpEnabled } from './mcp-config';

describe('MCP source-preserving edits', () => {
  it('keeps v2 servers, timeout policy and unknown server fields intact', () => {
    const config = { mcp: { timeout: { startup: 1234 }, servers: {
      local: { type: 'local' as const, command: ['fixture'], disabled: true, codemode: false },
    } } };
    expect(Object.keys(mcpServers(config))).toEqual(['local']);
    expect(mcpEnabled(mcpServers(config).local)).toBe(false);
    const edited = changeMcp(config, 'local', { ...mcpServers(config).local, disabled: false });
    expect(edited.mcp).toEqual({ ...config.mcp, servers: { local: { ...config.mcp.servers.local, disabled: false } } });
    expect(changeMcp(config, 'local', null).mcp).toEqual({ timeout: { startup: 1234 }, servers: {} });
    expect(config.mcp.servers.local.disabled).toBe(true);
  });
  it('translates new legacy-style dialog enabled flag only at the native boundary', () => {
    const edited = changeMcp({ mcp: { servers: {} } }, 'new', { type: 'local', command: ['fixture'], enabled: false });
    expect(mcpServers(edited).new).toEqual({ type: 'local', command: ['fixture'], disabled: true });
  });
  it('preserves legacy servers named servers or timeout', () => {
    const config = { mcp: { servers: { type: 'local' as const, command: ['fixture'], enabled: true } } };
    expect(mcpServers(config)).toEqual(config.mcp);
    expect(changeMcp(config, 'servers', null).mcp).toEqual({});
  });
});
