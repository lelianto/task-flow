import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type SelectOption<T extends string> = { value: T; label: string };

export function SelectMenu<T extends string>({ value, options, onChange, ariaLabel, disabled = false, compact = false }: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find(option => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return <div ref={root} className={`select-menu${compact ? ' compact' : ''}${open ? ' open' : ''}`}>
    <button type="button" className="select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} disabled={disabled} onClick={() => setOpen(current => !current)}>
      <span>{selected?.label}</span><ChevronDown size={15}/>
    </button>
    {open && <div id={listId} className="select-options" role="listbox" aria-label={ariaLabel}>
      {options.map(option => <button type="button" key={option.value} role="option" aria-selected={option.value === value} className={option.value === value ? 'selected' : ''} onClick={() => { setOpen(false); onChange(option.value); }}>
        <span>{option.label}</span>{option.value === value && <Check size={15}/>} 
      </button>)}
    </div>}
  </div>;
}
