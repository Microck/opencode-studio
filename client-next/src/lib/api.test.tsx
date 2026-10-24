import { afterEach, expect, it, vi } from 'vitest';
import api, { getUsageStats, getCommand, saveCommand, deleteCommand } from './api';

afterEach(() => vi.restoreAllMocks());

it('edits native v2 commands without losing metadata or unrelated config', async () => {
  const config = { commands: { review: { template: 'old', description: 'keep', agent: 'reviewer' } }, policies: [{ action: 'provider.use', resource: '*', effect: 'deny' }] };
  vi.spyOn(api, 'get').mockResolvedValue({ data: config });
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { success: true } });
  expect(await getCommand('review')).toEqual(config.commands.review);
  await saveCommand('review', 'new');
  expect(post).toHaveBeenCalledWith('/config', { ...config, commands: { review: { ...config.commands.review, template: 'new' } } });
});

it('deletes native and shadowed legacy command entries without resurrecting one', async () => {
  const config = { command: { review: { template: 'legacy' }, keep: { template: 'keep' } }, commands: { review: { template: 'native' } } };
  vi.spyOn(api, 'get').mockResolvedValue({ data: config });
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { success: true } });
  await deleteCommand('review');
  expect(post).toHaveBeenCalledWith('/config', { command: { keep: { template: 'keep' } }, commands: {} });
  expect(config.command.review.template).toBe('legacy');
});

it('does not report zero usage when the backend request fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('backend unavailable'));
  await expect(getUsageStats()).rejects.toThrow('backend unavailable');
});

it('returns genuine zero usage and preserves epoch range boundaries', async () => {
  const data = { totalCost: 0, totalTokens: 0, byModel: [], byDay: [], byProject: [] };
  const get = vi.spyOn(api, 'get').mockResolvedValueOnce({ data });
  expect(await getUsageStats(null, 'daily', 'custom', 0, 0)).toBe(data);
  expect(get).toHaveBeenCalledWith('/usage?granularity=daily&range=custom&from=0&to=0');
});
