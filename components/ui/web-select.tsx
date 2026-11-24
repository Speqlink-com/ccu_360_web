"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icon";

export type WebSelectOption = { value: string; label: string };

export function WebSelect({
  label,
  name,
  options,
  value,
  defaultValue = "",
  onChange,
  required = false,
  searchable = false,
  className = "",
}: {
  label: string;
  name?: string;
  options: WebSelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  searchable?: boolean;
  className?: string;
}) {
  const id = useId();
  const listId = `${id}-options`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [internal, setInternal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = value ?? internal;
  const matches = searchable && query.trim()
    ? options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    : options;
  const current = options.find((option) => option.value === selected);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && root.current?.contains(event.target as Node)) {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form || value !== undefined) return;
    const reset = () => {
      setInternal(defaultValue);
      setQuery("");
      setOpen(false);
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue, value]);

  const show = () => {
    setQuery("");
    setActive(Math.max(0, options.findIndex((option) => option.value === selected)));
    setOpen(true);
    if (searchable) requestAnimationFrame(() => searchInput.current?.focus());
  };
  const choose = (option: WebSelectOption) => {
    if (value === undefined) setInternal(option.value);
    onChange?.(option.value);
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  };
  const move = (step: number) => {
    if (!open) show();
    else setActive((index) => Math.max(0, Math.min(matches.length - 1, index + step)));
  };

  return (
    <div className={`web-select ${className}`} ref={root} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <span className="web-select-label" id={`${id}-label`}>{label}</span>
      <button
        ref={trigger}
        type="button"
        className="web-select-trigger"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        aria-required={required}
        onClick={() => open ? setOpen(false) : show()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            move(event.key === "ArrowDown" ? 1 : -1);
          } else if (event.key === "Home" && open) {
            event.preventDefault();
            setActive(0);
          } else if (event.key === "End" && open) {
            event.preventDefault();
            setActive(matches.length - 1);
          } else if (event.key === "Enter" && open && matches[active]) {
            event.preventDefault();
            choose(matches[active]);
          }
        }}
      >
        <span>{current?.label ?? options[0]?.label ?? "Select"}</span>
        <Icon name="down" size={16} outline />
      </button>
      {name && (
        <input
          className="web-select-value"
          type="text"
          name={name}
          value={selected}
          readOnly
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          onInvalid={() => trigger.current?.focus()}
        />
      )}
      {open && (
        <div className="web-select-menu" id={listId} role="listbox" aria-labelledby={`${id}-label`}>
          {searchable && (
            <div className="web-select-search">
              <Icon name="search" size={16} outline />
              <input
                ref={searchInput}
                type="search"
                aria-label={`Search ${label.toLowerCase()}`}
                placeholder="Search options"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setActive(0); }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    move(event.key === "ArrowDown" ? 1 : -1);
                  } else if (event.key === "Enter" && matches[active]) {
                    event.preventDefault();
                    choose(matches[active]);
                  }
                }}
              />
            </div>
          )}
          {matches.length ? matches.map((option, index) => (
            <button
              key={option.value}
              id={`${listId}-${index}`}
              type="button"
              role="option"
              aria-selected={selected === option.value}
              className={`web-select-option ${index === active ? "is-active" : ""}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
            >
              <span>{option.label}</span>
              {selected === option.value && <Icon name="check" size={15} outline />}
            </button>
          )) : <p className="web-select-empty">No matching options</p>}
        </div>
      )}
    </div>
  );
}
