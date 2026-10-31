/**
 * @file LegoColorPicker.tsx
 * @description One-line LEGO palette color picker (catalog / build UI).
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import { BRICK_CATALOG } from '../../racer/hub/brick/catalog';

export type LegoColorPickerProps = {
  value: string;
  onChange: (colorId: string) => void;
  label?: string;
  disabled?: boolean;
};

function rgbCss(rgb: readonly [number, number, number]): string {
  return `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`;
}

export function LegoColorPicker(props: LegoColorPickerProps): ReactElement {
  const { value, onChange, label = 'Couleur', disabled = false } = props;
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => BRICK_CATALOG.colors.find((c) => c.id === value) ?? BRICK_CATALOG.colors[0]!,
    [value]
  );

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
    <div className="br-color-picker" ref={rootRef}>
      <span className="br-atelier-label">{label}</span>
      <button
        type="button"
        className="br-color-picker__trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        title={selected.name}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="br-color-picker__chip"
          style={{ background: rgbCss(selected.rgb) }}
          data-translucent={selected.translucent ? '1' : undefined}
        />
        <span className="br-color-picker__name">{selected.name}</span>
        <span className="br-color-picker__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="br-color-picker__pop" role="listbox" id={listId} aria-label="Palette LEGO">
          <p className="br-color-picker__pop-title">Palette LEGO</p>
          <div className="br-color-picker__grid">
            {BRICK_CATALOG.colors.map((c) => {
              const active = c.id === value;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  title={c.translucent ? `${c.name} (trans)` : c.name}
                  className={
                    active
                      ? 'br-color-picker__swatch is-active'
                      : 'br-color-picker__swatch'
                  }
                  style={{ background: rgbCss(c.rgb) }}
                  data-translucent={c.translucent ? '1' : undefined}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
