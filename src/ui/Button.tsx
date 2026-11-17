import type { ComponentProps } from 'react';

// aria-disabled blocks nothing by itself, so the click is stopped here. The native
// disabled attribute is avoided because it drops the button from the focus order.
export function Button({ disabled, onClick, type = 'button', ...rest }: ComponentProps<'button'>) {
  return (
    <button
      {...rest}
      type={type}
      aria-disabled={disabled || undefined}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
