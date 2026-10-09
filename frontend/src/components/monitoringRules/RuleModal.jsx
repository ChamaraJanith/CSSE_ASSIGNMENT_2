import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useEscapeKey from './useEscapeKey';

const FOCUSABLE_SELECTOR = [
  'a[href]', 'area[href]', 'button', 'input', 'select', 'textarea', 'iframe', '[contenteditable="true"]', '[tabindex]',
].join(',');

// Keyboard-focusable elements inside the dialog, in DOM (tab) order. Layout is not checked, so this
// also works in jsdom; disabled, hidden and tabindex="-1" elements are skipped.
const getFocusableElements = (container) => [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => (
  !element.disabled
  && element.getAttribute('tabindex') !== '-1'
  && element.getAttribute('aria-hidden') !== 'true'
  && !element.closest('[hidden], [inert]')
));

/**
 * Shell of the UC04 dialogs (rule details, activate / deactivate confirmation).
 *
 * Rendered into document.body: inside .mr-container (position: relative; z-index: 10) the dialog
 * would be trapped in that stacking context, and the dashboard's sticky .top-header (z-index: 15)
 * would paint over its top. The header (title + close) and the footer (actions) stay in place;
 * only the body between them scrolls, so the title and close button are always visible.
 *
 * Focus: on open, focus moves to initialFocusRef (or the dialog itself); Tab / Shift+Tab cycle
 * within the dialog; on close, focus returns to the element that had it when the dialog opened
 * (normally the button that opened it), if that element is still on the page.
 */
export default function RuleModal({
  titleId, title, wide = false, closeLabel = null, closeDisabled = false, initialFocusRef = null,
  footer = null, onClose, children,
}) {
  const dialogRef = useRef(null);
  useEscapeKey(onClose, !closeDisabled);

  // Runs once per dialog (initialFocusRef is a stable ref). React runs the cleanup of a closing
  // dialog before the effect of a dialog opened in the same update, so when one dialog replaces
  // another the new one records the original trigger (already restored by the old one) as its own
  // return target.
  useEffect(() => {
    const returnTarget = document.activeElement;
    const initialTarget = initialFocusRef?.current || dialogRef.current;
    initialTarget?.focus();

    return () => {
      if (returnTarget instanceof HTMLElement && returnTarget !== document.body && returnTarget.isConnected) {
        returnTarget.focus();
      }
    };
  }, [initialFocusRef]);

  // Focus trap. Listening on the document also catches Tab when focus has left the dialog
  // (e.g. after a click on non-focusable content or when the focused button became disabled).
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const dialog = dialogRef.current;
      const focusable = getFocusableElements(dialog);
      const active = document.activeElement;

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const insideDialog = dialog.contains(active);

      if (event.shiftKey && (!insideDialog || active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!insideDialog || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return createPortal(
    <div className="mr-modal-backdrop">
      <div
        ref={dialogRef}
        className={`mr-modal panel-card${wide ? ' mr-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="panel-header mr-modal-header">
          <div className="panel-title" id={titleId}>{title}</div>
          {closeLabel && (
            <button type="button" className="mr-icon-button" onClick={onClose} aria-label={closeLabel} disabled={closeDisabled}>
              <X size={18} />
            </button>
          )}
        </div>
        <div className="mr-modal-body">{children}</div>
        {footer && <div className="mr-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
