import { create } from 'zustand';

interface FilterState {
  projectId: string | null;
  dateRange: '24h' | '7d' | '30d' | '1y' | 'all' | 'custom';
  granularity: 'hourly' | 'daily' | 'weekly' | 'monthly';
  setProjectId: (id: string | null) => void;
  setDateRange: (range: '24h' | '7d' | '30d' | '1y' | 'all' | 'custom') => void;
  setGranularity: (granularity: 'hourly' | 'daily' | 'weekly' | 'monthly') => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  projectId: null,
  dateRange: '30d',
  granularity: 'daily',
  setProjectId: (id: string | null) => set({ projectId: id }),
  setDateRange: (range: '24h' | '7d' | '30d' | '1y' | 'all' | 'custom') => set({ dateRange: range }),
  setGranularity: (granularity: 'hourly' | 'daily' | 'weekly' | 'monthly') => set({ granularity }),
}));
