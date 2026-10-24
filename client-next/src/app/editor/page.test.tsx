import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EditorPage from './page';

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams('type=commands&name=old'),
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  translate: (key: string) => key,
  getCommand: vi.fn(), saveCommand: vi.fn(), deleteCommand: vi.fn(),
  getSkill: vi.fn(), saveSkill: vi.fn(), deleteSkill: vi.fn(), getPlugin: vi.fn(), savePlugin: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router, useSearchParams: () => mocks.params }));
vi.mock('next-intl', () => ({ useTranslations: () => mocks.translate }));
vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@nsmr/pixelart-react', () => ({ Save: () => null, ArrowLeft: () => null }));
vi.mock('@/lib/api', () => mocks);
vi.mock('@/components/page-help', () => ({ PageHelp: () => null }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.params = new URLSearchParams('type=commands&name=old');
  mocks.saveCommand.mockResolvedValue({});
});
afterEach(cleanup);

it('navigation ignores the older file response and saves the displayed file', async () => {
  const old = deferred<{ template: string }>();
  mocks.getCommand.mockImplementationOnce(() => old.promise).mockResolvedValueOnce({ template: 'latest content' });
  const view = render(<EditorPage />);
  mocks.params = new URLSearchParams('type=commands&name=new');
  view.rerender(<EditorPage />);
  await screen.findByDisplayValue('latest content');
  await act(async () => old.resolve({ template: 'stale content' }));
  expect(screen.queryByDisplayValue('stale content')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^save$/ }));
  await waitFor(() => expect(mocks.saveCommand).toHaveBeenCalledWith('new', 'latest content'));
});

it('a rejected stale file request does not navigate away from the new file', async () => {
  const old = deferred<{ template: string }>();
  mocks.getCommand.mockImplementationOnce(() => old.promise).mockResolvedValueOnce({ template: 'new content' });
  const view = render(<EditorPage />);
  mocks.params = new URLSearchParams('type=commands&name=new');
  view.rerender(<EditorPage />);
  await screen.findByDisplayValue('new content');
  await act(async () => old.reject(new Error('old file missing')));
  expect(mocks.router.back).not.toHaveBeenCalled();
  expect(mocks.toast.error).not.toHaveBeenCalled();
});
