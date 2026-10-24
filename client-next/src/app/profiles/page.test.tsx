import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProfilesPage from './page';

const mocks = vi.hoisted(() => ({
  translate: (key: string) => key,
  getProfiles: vi.fn(), createProfile: vi.fn(), deleteProfile: vi.fn(), activateProfile: vi.fn(), refreshData: vi.fn(),
}));
vi.mock('next-intl', () => ({ useTranslations: () => mocks.translate }));
vi.mock('@/lib/api', () => mocks);
vi.mock('@/lib/context', () => ({ useApp: () => ({ refreshData: mocks.refreshData }) }));
vi.mock('@/components/page-help', () => ({ PageHelp: () => null }));
vi.mock('@nsmr/pixelart-react', () => ({ Plus: () => null, Trash: () => null, Check: () => null, User: () => null, CardStack: () => null, Play: () => null, Close: () => null }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getProfiles.mockResolvedValue({ active: 'default', profiles: ['default', 'one', 'two'] });
  mocks.refreshData.mockResolvedValue(undefined);
});
afterEach(cleanup);

it('serializes profile switching and refreshes shared data before unlocking controls', async () => {
  let finish!: () => void;
  mocks.activateProfile.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  render(<ProfilesPage />);
  const switches = await screen.findAllByRole('button', { name: /^switch$/ });
  fireEvent.click(switches[0]);
  expect(switches.every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  fireEvent.click(switches[1]);
  expect(mocks.activateProfile).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(mocks.refreshData).toHaveBeenCalledTimes(1);
  await waitFor(() => expect((switches[1] as HTMLButtonElement).disabled).toBe(false));
});

it('cancelling profile creation does not mutate profiles', async () => {
  render(<ProfilesPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'newProfile' }));
  fireEvent.change(screen.getByPlaceholderText('namePlaceholder'), { target: { value: 'draft' } });
  fireEvent.click(screen.getByRole('button', { name: /^cancel$/ }));
  expect(mocks.createProfile).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('repeated Enter submits a new profile only once', async () => {
  let finish!: () => void;
  mocks.createProfile.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  render(<ProfilesPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'newProfile' }));
  const input = screen.getByPlaceholderText('namePlaceholder');
  fireEvent.change(input, { target: { value: 'new-profile' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(mocks.createProfile).toHaveBeenCalledTimes(1);
  await act(async () => finish());
});
