import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from './context';

const api = vi.hoisted(() => ({
  getConfig: vi.fn(), getSkills: vi.fn(), getPlugins: vi.fn(),
  saveConfig: vi.fn(), toggleSkill: vi.fn(), togglePlugin: vi.fn(),
  checkHealth: vi.fn(), checkVersion: vi.fn(), getPendingAction: vi.fn(),
  clearPendingAction: vi.fn(), syncAuto: vi.fn(), syncPush: vi.fn(), getSyncStatus: vi.fn(),
}));
vi.mock('@/lib/api', () => api);
vi.mock('@/components/update-required-modal', () => ({ UpdateRequiredModal: () => null }));

function Probe() {
  const { config, skills, plugins, loading, error, refreshData, toggleMCP } = useApp();
  return <>
    <button onClick={() => void refreshData()}>refresh</button>
    <button onClick={() => void toggleMCP("fixture")}>toggle MCP</button>
    <output data-testid="state">{JSON.stringify({ config, skills, plugins, loading, error })}</output>
  </>;
}
const state = () => JSON.parse(screen.getByTestId('state').textContent || '{}');
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  api.getConfig.mockResolvedValue({ theme: 'original' });
  api.getSkills.mockResolvedValue([{ name: 'old-skill' }]);
  api.getPlugins.mockResolvedValue([{ name: 'old-plugin' }]);
  api.checkHealth.mockResolvedValue(true);
  api.checkVersion.mockResolvedValue({ connected: true, isCompatible: true });
  api.getPendingAction.mockResolvedValue(null);
  api.syncAuto.mockResolvedValue({ action: 'none' });
});
afterEach(cleanup);

describe('shared configuration refresh', () => {
  it('does not let a slower previous profile response overwrite the latest refresh', async () => {
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(state().loading).toBe(false));
    const old = deferred<{ theme: string }>();
    const latest = deferred<{ theme: string }>();
    api.getConfig.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => latest.promise);
    fireEvent.click(screen.getByText('refresh'));
    fireEvent.click(screen.getByText('refresh'));
    await act(async () => latest.resolve({ theme: 'latest' }));
    expect(state().config.theme).toBe('latest');
    await act(async () => old.resolve({ theme: 'stale' }));
    expect(state().config.theme).toBe('latest');
    expect(state().loading).toBe(false);
  });

  it('clears previous profile resources when the new profile has no configuration', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(state().loading).toBe(false));
    expect(state().skills).toHaveLength(1);
    api.getConfig.mockRejectedValueOnce({ isAxiosError: true, response: { status: 404, data: {} } });
    fireEvent.click(screen.getByText('refresh'));
    await waitFor(() => expect(state().config).toBeNull());
    expect(state().skills).toEqual([]);
    expect(state().plugins).toEqual([]);
    expect(state().error).toContain('configuration not found');
  });
});


it('MCP changes read the latest config instead of overwriting edits from other pages', async () => {
  api.getConfig.mockResolvedValue({ agents: { reviewer: { system: 'old' } }, mcp: { servers: { fixture: { type: 'local', command: ['fixture'], disabled: true } } } });
  render(<AppProvider><Probe /></AppProvider>);
  await waitFor(() => expect(state().loading).toBe(false));
  const latest = { agents: { reviewer: { system: 'changed elsewhere', permissions: [{ action: 'shell', resource: '*', effect: 'deny' }] } }, mcp: { timeout: { startup: 1234 }, servers: { fixture: { type: 'local', command: ['fixture'], disabled: true } } } };
  api.getConfig.mockResolvedValue(latest);
  fireEvent.click(screen.getByText('toggle MCP'));
  await waitFor(() => expect(api.saveConfig).toHaveBeenCalledOnce());
  expect(api.saveConfig.mock.calls[0][0]).toEqual({ ...latest, mcp: { ...latest.mcp, servers: { fixture: { ...latest.mcp.servers.fixture, disabled: false } } } });
});
