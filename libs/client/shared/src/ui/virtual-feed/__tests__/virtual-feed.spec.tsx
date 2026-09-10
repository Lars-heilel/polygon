import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { VirtualFeed } from '../virtual-feed';

const frontendLog = vi.fn();

vi.mock('../../../lib/hooks/use-logger', () => ({
  frontendLog: (...args: unknown[]) => frontendLog(...args),
}));

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: Array<{ id: string; label: string }>;
    itemContent: (index: number, item: { id: string; label: string }) => React.ReactNode;
  }) => (
    <div data-testid="mock-virtuoso">
      {data.map((item, index) => (
        <div key={item.id}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
}));

interface Item {
  id: string;
  label: string;
}

describe('VirtualFeed', () => {
  const items: Item[] = [
    { id: '1', label: 'one' },
    { id: '2', label: 'two' },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders items through the provided renderer', () => {
    render(
      <VirtualFeed
        items={items}
        mode="forward"
        getKey={(item) => item.id}
        renderItem={(item) => <div>{item.label}</div>}
      />,
    );

    expect(screen.getByText('one')).toBeTruthy();
    expect(screen.getByText('two')).toBeTruthy();
  });

  it('renders an empty slot when no items exist', () => {
    render(
      <VirtualFeed
        items={[]}
        mode="reverse"
        getKey={(item: { id: string }) => item.id}
        renderItem={() => null}
        empty={<div>No items</div>}
      />,
    );

    expect(screen.getByText('No items')).toBeTruthy();
  });

  it('uses stable reverse feed data attributes for first item index debugging', () => {
    render(
      <VirtualFeed
        items={items}
        mode="reverse"
        getKey={(item) => item.id}
        renderItem={(item) => <div>{item.label}</div>}
        baseIndex={100}
      />,
    );

    expect(screen.getByTestId('virtual-feed').getAttribute('data-mode')).toBe('reverse');
    expect(screen.getByTestId('virtual-feed').getAttribute('data-first-item-index')).toBe('98');
    expect(screen.getByTestId('virtual-feed').getAttribute('data-item-count')).toBe('2');
    expect(screen.getByTestId('virtual-feed').getAttribute('data-first-key')).toBe('1');
    expect(screen.getByTestId('virtual-feed').getAttribute('data-last-key')).toBe('2');
  });

  it('adds diagnostic context to virtual feed logs when diagnostics are forced', async () => {
    render(
      <VirtualFeed
        items={items}
        mode="reverse"
        getKey={(item) => item.id}
        renderItem={(item) => <div>{item.label}</div>}
        diagnosticName="messages"
        diagnostics="always"
        diagnosticContext={{ chatKey: 'chat#1' }}
      />,
    );

    await waitFor(() => {
      expect(frontendLog).toHaveBeenCalledWith(
        'debug',
        'VirtualFeed',
        'items_committed',
        expect.objectContaining({
          name: 'messages',
          context: { chatKey: 'chat#1' },
          scroll: null,
        }),
      );
    });
  });
});
