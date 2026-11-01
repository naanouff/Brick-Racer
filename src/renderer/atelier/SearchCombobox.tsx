/**
 * @file SearchCombobox.tsx
 * @description Searchable single-select list with autocomplete (catalog / build UI).
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';

export type SearchComboboxOption = {
  value: string;
  label: string;
  /** Optional secondary line (id, count, …). */
  hint?: string;
};

export type SearchComboboxProps = {
  label: string;
  value: string;
  options: readonly SearchComboboxOption[];
  /** Shown when value is empty. */
  emptyLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Max suggestions in the open list. */
  maxVisible?: number;
  onChange: (value: string) => void;
};

export function SearchCombobox(props: SearchComboboxProps): ReactElement {
  const {
    label,
    value,
    options,
    emptyLabel = 'Toutes',
    placeholder = 'Rechercher…',
    disabled = false,
    maxVisible = 40,
    onChange,
  } = props;

  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    if (!open) setText(selected?.label ?? (value ? value : ''));
  }, [selected, value, open]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    const all: SearchComboboxOption[] = [{ value: '', label: emptyLabel }, ...options];
    if (!q) return all.slice(0, maxVisible + 1);
    return all
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q) ||
          (o.hint?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, maxVisible + 1);
  }, [options, text, emptyLabel, maxVisible]);

  useEffect(() => {
    setActive(0);
  }, [text, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (next: string): void => {
    onChange(next);
    setOpen(false);
    const hit = options.find((o) => o.value === next);
    setText(hit?.label ?? (next ? next : ''));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = filtered[active];
      if (hit) pick(hit.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setText(selected?.label ?? '');
    }
  };

  return (
    <div className="br-combo" ref={rootRef}>
      <label className="br-atelier-field">
        <span className="br-atelier-label">{label}</span>
        <div className="br-combo__control">
          <input
            className="br-atelier-input br-combo__input"
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open ? `${listId}-${active}` : undefined}
            disabled={disabled}
            placeholder={placeholder}
            value={open ? text : selected?.label ?? (value ? value : emptyLabel)}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              setText('');
            }}
            onKeyDown={onKey}
          />
          {value ? (
            <button
              type="button"
              className="br-combo__clear"
              aria-label={`Effacer ${label}`}
              disabled={disabled}
              onClick={() => pick('')}
            >
              ×
            </button>
          ) : null}
        </div>
      </label>
      {open ? (
        <ul className="br-combo__list" id={listId} role="listbox">
          {filtered.length === 0 ? (
            <li className="br-combo__empty">Aucun résultat</li>
          ) : (
            filtered.map((o, i) => (
              <li key={`${o.value || '__all'}|${o.label}`} role="presentation">
                <button
                  type="button"
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  className={
                    i === active
                      ? 'br-combo__option is-active'
                      : o.value === value
                        ? 'br-combo__option is-selected'
                        : 'br-combo__option'
                  }
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o.value)}
                >
                  <span className="br-combo__option-label">{o.label}</span>
                  {o.hint ? <span className="br-combo__option-hint">{o.hint}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
