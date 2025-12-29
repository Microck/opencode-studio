import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from './Sidebar';
import React from 'react';

describe('Sidebar', () => {
  it('renders navigation items', () => {
    render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    );
    expect(screen.getByText('MCP Servers')).toBeInTheDocument();
  });
});
