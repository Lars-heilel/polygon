import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from '../error-boundary';

function Exploding() {
  throw new Error('Exploded');
}

describe('ErrorBoundary', () => {
  it('renders the fallback UI when a child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Exploded')).toBeTruthy();
    consoleError.mockRestore();
  });

  it('resets the error state when trying again', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    let shouldThrow = true;

    function Flaky() {
      if (shouldThrow) throw new Error('Exploded');
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('Recovered')).toBeTruthy();
    consoleError.mockRestore();
  });
});
