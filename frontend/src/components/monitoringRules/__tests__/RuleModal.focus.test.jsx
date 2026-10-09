import React, { useRef, useState } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RuleModal from '../RuleModal';

// Focus management of the UC04 dialog shell: initial focus, Tab / Shift+Tab kept inside the dialog,
// Escape (existing behaviour) and focus returned to the opening control on close.

function TestDialog({ withInitialFocus = true, busy = false, onClose }) {
  const cancelRef = useRef(null);
  return (
    <RuleModal
      titleId="test-dialog-title"
      title="Test Dialog"
      closeLabel="Close dialog"
      closeDisabled={busy}
      initialFocusRef={withInitialFocus ? cancelRef : null}
      onClose={onClose}
      footer={(
        <>
          <button ref={cancelRef} type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" disabled={busy}>Confirm</button>
        </>
      )}
    >
      <label htmlFor="test-notes">Notes</label>
      <input id="test-notes" disabled={busy} />
      <button type="button" disabled>Unavailable</button>
      <div tabIndex={-1}>Not in the tab order</div>
    </RuleModal>
  );
}

// A page with controls before and after the trigger, so an escaping Tab would be visible
function Page({ dialogProps = {}, removeTriggerOnOpen = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button">Before</button>
      {!(removeTriggerOnOpen && open) && (
        <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      )}
      <button type="button">After</button>
      {open && <TestDialog {...dialogProps} onClose={() => setOpen(false)} />}
    </>
  );
}

const renderPage = async (props) => {
  const user = userEvent.setup();
  render(<Page {...props} />);
  await user.click(screen.getByRole('button', { name: 'Open dialog' }));
  return user;
};

const dialog = () => screen.getByRole('dialog', { name: 'Test Dialog' });
const button = (name) => screen.getByRole('button', { name });

describe('RuleModal - focus inside the dialog', () => {
  test('opening moves focus to the initial focus target', async () => {
    await renderPage();
    expect(button('Cancel')).toHaveFocus();
  });

  test('without an initial focus target, the dialog itself receives focus and Tab enters it', async () => {
    const user = await renderPage({ dialogProps: { withInitialFocus: false } });
    expect(dialog()).toHaveFocus();

    await user.tab();
    expect(button('Close dialog')).toHaveFocus();
  });

  test('Tab follows the dialog order, skipping disabled and tabindex="-1" elements, and wraps from last to first', async () => {
    const user = await renderPage();

    await user.tab();
    expect(button('Confirm')).toHaveFocus();
    await user.tab();
    expect(button('Close dialog')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Notes')).toHaveFocus();
    await user.tab();
    expect(button('Cancel')).toHaveFocus();
  });

  test('Shift+Tab wraps from the first control to the last', async () => {
    const user = await renderPage();
    button('Close dialog').focus();

    await user.tab({ shift: true });
    expect(button('Confirm')).toHaveFocus();
    await user.tab({ shift: true });
    expect(button('Cancel')).toHaveFocus();
  });

  test('repeated Tab and Shift+Tab never reach the page behind the dialog', async () => {
    const user = await renderPage();

    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(dialog()).toContainElement(document.activeElement);
    }
    for (let i = 0; i < 8; i += 1) {
      await user.tab({ shift: true });
      expect(dialog()).toContainElement(document.activeElement);
    }
  });

  test('when focus has left the dialog, Tab brings it back to the first control and Shift+Tab to the last', async () => {
    const user = await renderPage();

    document.activeElement.blur();
    expect(document.body).toHaveFocus();
    await user.tab();
    expect(button('Close dialog')).toHaveFocus();

    button('Before').focus();
    await user.tab({ shift: true });
    expect(button('Confirm')).toHaveFocus();
  });

  test('when every control is disabled (busy), Tab keeps focus on the dialog and Escape does not close it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TestDialog busy onClose={onClose} />);

    await user.tab();
    expect(dialog()).toHaveFocus();
    await user.tab({ shift: true });
    expect(dialog()).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('RuleModal - focus returned on close', () => {
  test.each([
    ['Escape', (user) => user.keyboard('{Escape}')],
    ['the header close button', (user) => user.click(button('Close dialog'))],
    ['Cancel', (user) => user.click(button('Cancel'))],
  ])('closing with %s returns focus to the control that opened the dialog', async (_label, close) => {
    const user = await renderPage();

    await close(user);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button('Open dialog')).toHaveFocus();
  });

  test('keyboard-only: open with Enter, close with Escape, focus is back on the trigger', async () => {
    const user = userEvent.setup();
    render(<Page />);
    button('Open dialog').focus();

    await user.keyboard('{Enter}');
    expect(button('Cancel')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(button('Open dialog')).toHaveFocus();
  });

  test('if the trigger is no longer on the page, closing does not move focus to a removed element', async () => {
    const user = await renderPage({ removeTriggerOnOpen: true });
    expect(screen.queryByRole('button', { name: 'Open dialog' })).toBeNull();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body).toHaveFocus();
  });

  test('after closing, Tab is no longer trapped', async () => {
    const user = await renderPage();
    await user.keyboard('{Escape}');

    await user.tab();
    expect(button('After')).toHaveFocus();
  });
});
