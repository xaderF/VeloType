import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface ForfeitConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ForfeitConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
}: ForfeitConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Focus cancel button on open
    const cancelBtn = dialog.querySelector<HTMLButtonElement>('button');
    cancelBtn?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dialogRef}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-lobby-bg/70 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirm forfeit"
          aria-describedby="forfeit-dialog-desc"
        >
          <motion.div
            className="w-full max-w-xl rounded-md border border-lobby-text-muted/25 bg-lobby-bg/95 shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
          >
            <div className="px-8 py-7 border-b border-lobby-text-muted/15 text-center space-y-3">
              <h2 className="text-xl md:text-2xl font-bold tracking-[0.22em] uppercase text-destructive">
                Exit Match?
              </h2>
              <p id="forfeit-dialog-desc" className="text-sm text-lobby-text-muted">
                Are you sure you want to forfeit and leave this match?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 bg-lobby-bg/60">
              <button
                onClick={onCancel}
                className="h-12 rounded-sm border border-lobby-text-muted/30 bg-lobby-bg/60 text-lobby-text font-semibold tracking-[0.12em] uppercase text-sm hover:bg-lobby-text-muted/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="h-12 rounded-sm border border-destructive/40 bg-destructive/15 text-destructive font-semibold tracking-[0.12em] uppercase text-sm hover:bg-destructive/25 transition-colors"
              >
                Forfeit
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
