import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import ConfigPage from './page';

const mocks = vi.hoisted(() => ({ config: { theme: 'old' }, saveConfig: vi.fn(), translate: (key: string) => key }));
vi.mock('@/components/cli-config-editor', () => ({ CliConfigEditor: () => null }));
vi.mock('next-intl', () => ({ useTranslations: () => mocks.translate }));
vi.mock('@/lib/context', () => ({ useApp: () => ({ config: mocks.config, loading: false, saveConfig: mocks.saveConfig }) }));
vi.mock('@/lib/api', () => ({ getConfigProviders: async () => [] }));
vi.mock('@/components/provider-card', () => ({ ProviderCard: () => null, ProviderCardSkeleton: () => null }));
vi.mock('@/components/provider-detail', () => ({ ProviderDetailPanel: () => null }));
vi.mock('@/components/page-help', () => ({ PageHelp: () => null }));
vi.mock('@nsmr/pixelart-react', () => ({ Save: () => null, Undo: () => null, Alert: () => null, Check: () => null }));
vi.mock('@/components/ui/tabs', () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Tabs: Container, TabsList: Container, TabsTrigger: Container, TabsContent: Container };
});
beforeEach(() => { mocks.config = { theme: 'old' }; mocks.saveConfig.mockReset(); });
afterEach(cleanup);

it('preserves an unsaved config draft across background refresh', async () => {
  const view = render(<ConfigPage />);
  const editor = screen.getByRole('textbox');
  fireEvent.change(editor, { target: { value: '{"theme":"draft"}' } });
  mocks.config = { theme: 'refreshed' };
  view.rerender(<ConfigPage />);
  expect((editor as HTMLTextAreaElement).value).toBe('{"theme":"draft"}');
  await act(async () => {});
});

it('does not clear edits made while an earlier save is pending', async () => {
  let finish!: () => void;
  mocks.saveConfig.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  render(<ConfigPage />);
  const editor = screen.getByRole('textbox');
  fireEvent.change(editor, { target: { value: '{"theme":"first"}' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  fireEvent.change(editor, { target: { value: '{"theme":"second"}' } });
  await act(async () => finish());
  expect((editor as HTMLTextAreaElement).value).toBe('{"theme":"second"}');
});
