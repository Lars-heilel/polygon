import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Toggle } from '../toggle';

describe('Toggle', () => {
  it('renders a compact accessible switch with stable track and thumb geometry', () => {
    render(
      <Toggle
        checked
        aria-label="Enable notifications"
        onChange={() => undefined}
      />,
    );

    const toggle = screen.getByRole('switch', { name: /enable notifications/i });
    const thumb = toggle.firstElementChild;

    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.className).toContain('h-5');
    expect(toggle.className).toContain('w-9');
    expect(toggle.className).toContain('p-0.5');
    expect(toggle.className).toContain('border-primary');
    expect(thumb?.className).toContain('h-4');
    expect(thumb?.className).toContain('w-4');
    expect(thumb?.className).toContain('translate-x-4');
  });

  it('calls onChange with the next checked state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Toggle
        checked={false}
        aria-label="Enable sound"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('switch', { name: /enable sound/i }));

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
