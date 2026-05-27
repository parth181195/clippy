import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchBarHandle {
  focus: () => void;
}

export const SearchBar = forwardRef<
  SearchBarHandle,
  {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }
>(({ value, onChange, placeholder = 'Search clipboard…' }, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));
  return (
    <div className={`search ${focused ? 'focused' : ''}`}>
      <span className="icon"><Search size={14} strokeWidth={2} /></span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {!value && !focused && (
        <span className="kbd-hint">/</span>
      )}
      {value && (
        <button className="clear" onClick={() => onChange('')} type="button" aria-label="Clear">
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
      <style>{searchCss}</style>
    </div>
  );
});

const searchCss = `
  .search {
    display: flex; align-items: center; gap: 8px;
    height: 32px; padding: 0 12px;
    background: rgba(0,0,0,.25);
    border-radius: 10px;
    border: 1px solid var(--cm-border-subtle);
    width: 360px;
    transition: border-color 120ms, box-shadow 120ms;
  }
  .search.focused {
    border-color: var(--cm-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--cm-accent) 22%, transparent);
  }
  .search input {
    flex: 1; min-width: 0; background: transparent; border: none; outline: none;
    color: var(--cm-text); font-family: inherit; font-size: 13px;
  }
  .search input::placeholder { color: var(--cm-text-tertiary); }
  .search .icon { color: var(--cm-text-secondary); display: inline-flex; }
  .search .kbd-hint {
    padding: 2px 6px; border-radius: 4px;
    background: color-mix(in srgb, var(--cm-text) 6%, transparent);
    color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 10px; font-weight: 600; line-height: 1;
  }
  .search .clear { background: transparent; border: none; cursor: pointer; color: var(--cm-text-secondary); padding: 2px; display: inline-flex; align-items: center; }
  .search .clear:hover { color: var(--cm-text); }
`;
