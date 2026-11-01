/**
 * @file BrickLabMenuBar.tsx
 * @description Classic software menubar for brick-lab structures (Fichier…).
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { FilePlus, FolderOpen, Save } from 'lucide-react';

const I = { size: 16, strokeWidth: 2, 'aria-hidden': true as const };

export type BrickLabMenuBarProps = {
  onNew: () => void;
  onSave: () => void;
  onLoad: () => void;
  disabled?: boolean;
};

export function BrickLabMenuBar(props: BrickLabMenuBarProps): ReactElement {
  const { onNew, onSave, onLoad, disabled = false } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="br-menubar" ref={rootRef} role="menubar" aria-label="Brick lab">
      <div className="br-menubar__item">
        <button
          type="button"
          className={open ? 'br-menubar__btn is-open' : 'br-menubar__btn'}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          Fichier
        </button>
        {open ? (
          <ul className="br-menubar__menu" role="menu" aria-label="Fichier">
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="br-menubar__option"
                onClick={() => {
                  setOpen(false);
                  onNew();
                }}
              >
                <FilePlus {...I} /> Nouvelle structure
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="br-menubar__option"
                onClick={() => {
                  setOpen(false);
                  onSave();
                }}
              >
                <Save {...I} /> Sauvegarder la structure
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="br-menubar__option"
                onClick={() => {
                  setOpen(false);
                  onLoad();
                }}
              >
                <FolderOpen {...I} /> Charger la structure…
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}
