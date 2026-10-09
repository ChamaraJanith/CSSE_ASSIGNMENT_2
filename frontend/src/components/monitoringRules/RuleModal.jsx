import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useEscapeKey from './useEscapeKey';

/**
 * Shell of the UC04 dialogs (rule details, activate / deactivate confirmation).
 *
 * Rendered into document.body: inside .mr-container (position: relative; z-index: 10) the dialog
 * would be trapped in that stacking context, and the dashboard's sticky .top-header (z-index: 15)
 * would paint over its top. The header (title + close) and the footer (actions) stay in place;
 * only the body between them scrolls, so the title and close button are always visible.
 */
export default function RuleModal({
  titleId, title, wide = false, closeLabel = null, closeDisabled = false, initialFocusRef = null,
  footer = null, onClose, children,
}) {
  useEscapeKey(onClose, !closeDisabled);

  useEffect(() => {
    initialFocusRef?.current?.focus();
  }, [initialFocusRef]);

  return createPortal(
    <div className="mr-modal-backdrop">
      <div
        className={`mr-modal panel-card${wide ? ' mr-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
