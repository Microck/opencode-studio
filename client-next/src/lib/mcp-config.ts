import type { MCPConfig, OpencodeConfig } from '@/types';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function nativeMcp(config: OpencodeConfig): boolean {
  const mcp = config.mcp;
  return !!mcp && ((object(mcp.servers) && !('type' in mcp.servers))
    || (object(mcp.timeout) && !('type' in mcp.timeout)));
}

export function mcpServers(config: OpencodeConfig | null): Record<string, MCPConfig> {
  if (!config?.mcp) return {};
  if (!nativeMcp(config)) return config.mcp as Record<string, MCPConfig>;
  return (config.mcp.servers || {}) as Record<string, MCPConfig>;
}

export function mcpEnabled(server: MCPConfig): boolean {
  return Object.hasOwn(server, 'disabled') ? !server.disabled : server.enabled !== false;
}

export function changeMcp(config: OpencodeConfig, key: string, value: MCPConfig | null): OpencodeConfig {
  const servers = { ...mcpServers(config) };
  if (value === null) delete servers[key];
  else {
    const updated = { ...value };
    if (nativeMcp(config)) {
      if (!Object.hasOwn(updated, 'disabled') && Object.hasOwn(updated, 'enabled')) updated.disabled = !updated.enabled;
      delete updated.enabled;
    }
    servers[key] = updated;
  }
  return { ...config, mcp: nativeMcp(config) ? { ...config.mcp, servers } : servers };
}
