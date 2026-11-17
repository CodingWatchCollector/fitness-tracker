import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button rendering', () => {
  it('renders a focusable aria-disabled native button when disabled', async () => {
    const ref = createRef<HTMLButtonElement>();
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="before" />
        <Button disabled className="button x" aria-label="L" ref={ref}>
          text
        </Button>
      </>,
    );
    const button = screen.getByRole('button', { name: 'L' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toHaveAttribute('disabled');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('button', 'x');
    expect(ref.current).toBe(button);

    ref.current?.focus();
    expect(button).toHaveFocus();

    screen.getByLabelText('before').focus();
    await user.tab();
    expect(button).toHaveFocus();
  });

  it('has no aria-disabled when not disabled', () => {
    render(
      <>
        <Button>a</Button>
        <Button disabled={false}>b</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'a' })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('button', { name: 'b' })).not.toHaveAttribute('aria-disabled');
  });
});

describe('Button click guard', () => {
  it('does not call onClick when disabled', async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={spy}>
        go
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'go' });
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not submit a form when disabled', async () => {
    const submitSpy = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={submitSpy}>
        <Button type="submit" disabled>
          send
        </Button>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'send' }));
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('calls onClick once when enabled', async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={spy}>go</Button>);
    await user.click(screen.getByRole('button', { name: 'go' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('submits a form once when enabled', async () => {
    const submitSpy = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={submitSpy}>
        <Button type="submit">send</Button>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'send' }));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });
});
