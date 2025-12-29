import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar';
import React from 'react';
import { Terminal } from 'lucide-react';

describe('Sidebar', () => {
  it('renders navigation items', () => {
    const activeTab = 'mcp';
    const setActiveTab = vi.fn();
    
    render(<Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />);
    expect(screen.getByText('MCP Servers')).toBeInTheDocument();
  });
});
