'use client';

import { useRef } from 'react';

// Reusable search input for list pages. Renders a magnifier icon on the left
// and a clear (X) button on the right whenever the input has text. Use it in
// any filter bar that needs a controlled text search, e.g. alongside a status
// select on list pages. The wrapper keeps flex-1 so it expands inside the
// page's flex filter row, matching the previous inline inputs.
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder, className }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClear() {
    onChange('');
    inputRef.current?.focus();
  }

  return (
    <div className={`relative flex-1 ${className ?? ''}`}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-8 py-2 rounded-lg border border-gray-200 bg-white text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none placeholder:text-gray-400"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpiar búsqueda"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100"
        >
          <svg
            className="w-4 h-4 text-gray-400 hover:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
