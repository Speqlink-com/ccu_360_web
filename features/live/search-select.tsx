"use client";

import { useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

export type SearchOption = {
  value: string;
  label: string;
  detail?: string;
};

export function SearchSelect({
  name,
  label,
  options,
  placeholder,
  defaultValue = "",
}: {
  name: string;
  label: string;
  options: SearchOption[];
  placeholder: string;
  defaultValue?: string;
}) {
  const id = useId();
  const listId = `${id}-results`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(defaultValue);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedOption = options.find((option) => option.value === selected);
  const matches = options
    .filter((option) =>
      `${option.label} ${option.detail ?? ""}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    )
    .slice(0, 3);

  const choose = (option: SearchOption) => {
    setSelected(option.value);
    setSearch("");
    setOpen(false);
    inputRef.current?.setCustomValidity("");
    inputRef.current?.blur();
  };

  return (
    <div
      className="live-field workforce-search-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="workforce-search-control">
        <Icon name="search" size={17} outline />
        <input
          ref={inputRef}
          id={id}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          required={!selected}
          autoComplete="off"
          placeholder={placeholder}
          value={open ? search : selectedOption?.label ?? ""}
          onFocus={() => {
            setSearch("");
            setActiveIndex(0);
            setOpen(true);
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            setSelected("");
            setActiveIndex(0);
            event.target.setCustomValidity("Choose a result from the list.");
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, Math.max(0, matches.length - 1)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(0, index - 1));
            } else if (event.key === "Enter" && open && matches[activeIndex]) {
              event.preventDefault();
              choose(matches[activeIndex]);
            }
          }}
        />
        <input type="hidden" name={name} value={selected} />
        {open && (
          <div id={listId} className="workforce-search-results" role="listbox" aria-label={`${label} results`}>
            {matches.length ? matches.map((option, index) => (
              <button
                key={option.value}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={selected === option.value}
                className={index === activeIndex ? "is-active" : ""}
                onPointerDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.detail && <small>{option.detail}</small>}
              </button>
            )) : <p>No matches. Try another name.</p>}
          </div>
        )}
      </div>
      <small className="workforce-search-hint">Search by name. Up to three matches appear at a time.</small>
    </div>
  );
}
