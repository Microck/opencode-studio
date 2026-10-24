import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CliConfigEditor } from './cli-config-editor';
const api = vi.hoisted(() => ({ getCliConfig: vi.fn(), saveCliConfig: vi.fn() }));
vi.mock('@/lib/api', () => api);
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('shows a stale-write error without discarding the draft', async () => {
  api.getCliConfig.mockResolvedValue({ content: '{}', exists: true, revision: 'original' });
  api.saveCliConfig.mockRejectedValue(new Error('CLI configuration changed on disk. Reload before saving.'));
  render(<CliConfigEditor />);
  const editor = await screen.findByRole('textbox', { name: 'cli.json' });
  fireEvent.change(editor, { target: { value: '{"theme":"custom"}' } });
  fireEvent.click(screen.getByText('Save cli.json'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('changed on disk'));
  expect(api.saveCliConfig).toHaveBeenCalledWith({ content: '{"theme":"custom"}', revision: 'original' });
  expect((editor as HTMLTextAreaElement).value).toBe('{"theme":"custom"}');
});
