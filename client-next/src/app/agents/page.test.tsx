import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AgentsPage from './page';

const mocks = vi.hoisted(() => ({ getAgents: vi.fn(), deleteAgent: vi.fn(), saveAgent: vi.fn(), toggleAgent: vi.fn(), translate: (key: string) => key }));
vi.mock('next-intl', () => ({ useTranslations: () => mocks.translate }));
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('@monaco-editor/react', () => ({ Editor: () => null }));
vi.mock('@/lib/api', () => mocks);
vi.mock('@/lib/error-translate', () => ({ useErrorTranslation: () => (_error: unknown, fallback: string) => fallback }));
vi.mock('@/components/page-help', () => ({ PageHelp: () => null }));
vi.mock('@/components/page-help-dialog', () => ({ PageHelpDialog: () => null }));
vi.mock('@/components/permission-editor', () => ({ PermissionEditor: () => null }));
vi.mock('@nsmr/pixelart-react', () => ({ Plus: () => null, Trash: () => null, Check: () => null, Close: () => null, Code: () => null, ToggleLeft: () => null, ToggleRight: () => null, ChevronDown: () => null, ChevronUp: () => null, Sliders: () => null }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getAgents.mockResolvedValue([{ name: 'synthetic-agent', source: 'markdown', mode: 'subagent' }]);
  mocks.deleteAgent.mockResolvedValue({});
});
afterEach(cleanup);

it('opens delete confirmation and cancellation preserves the agent', async () => {
  render(<AgentsPage />);
  fireEvent.click(await screen.findByRole('button', { name: /^delete$/ }));
  const dialog = await screen.findByRole('alertdialog');
  expect(mocks.deleteAgent).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: /^cancel$/ }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(mocks.deleteAgent).not.toHaveBeenCalled();
});

it('confirmed deletion calls the selected agent endpoint', async () => {
  render(<AgentsPage />);
  fireEvent.click(await screen.findByRole('button', { name: /^delete$/ }));
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/ }));
  await waitFor(() => expect(mocks.deleteAgent).toHaveBeenCalledWith('synthetic-agent'));
});
