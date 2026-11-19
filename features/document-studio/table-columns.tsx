"use client";
import type { Section } from "@/features/live/journey-contract";
import { buttonClasses } from "@/lib/presentation";
type Field = Section["fields"][number];
export function TableColumns({
  field,
  onChange,
}: {
  field: Field;
  onChange: (field: Field) => void;
}) {
  const columns = field.columns ?? [];
  return (
    <fieldset className="my-3 rounded-lg border border-border p-4">
      <legend>Table columns</legend>
      <p className="mb-3 text-sm text-muted">
        Rows repeat when employees complete this section. Column labels and
        input types are controlled by your facility.
      </p>
      {columns.map((column, index) => (
        <div
          className="mb-3 grid gap-2 md:grid-cols-[1fr_140px_1fr_auto]"
          key={column.key}
        >
          <label className="live-field">
            Column label
            <input
              required
              minLength={2}
              maxLength={120}
              value={column.label}
              onChange={(e) =>
                onChange({
                  ...field,
                  columns: columns.map((c, i) =>
                    i === index ? { ...c, label: e.target.value } : c,
                  ),
                })
              }
            />
          </label>
          <label className="live-field">
            Input type
            <select
              aria-label="Input type"
              value={column.type}
              onChange={(e) =>
                onChange({
                  ...field,
                  columns: columns.map((c, i) =>
                    i === index
                      ? {
                          ...c,
                          type: e.target.value as typeof c.type,
                          choices:
                            e.target.value === "choice"
                              ? ["Option one", "Option two"]
                              : [],
                        }
                      : c,
                  ),
                })
              }
            >
              {["text", "number", "boolean", "choice", "date", "time"].map(
                (t) => (
                  <option key={t}>{t}</option>
                ),
              )}
            </select>
          </label>
          {column.type === "choice" ? (
            <label className="live-field">
              Options, one per line
              <textarea
                required
                value={column.choices.join("\n")}
                onChange={(e) =>
                  onChange({
                    ...field,
                    columns: columns.map((c, i) =>
                      i === index
                        ? { ...c, choices: e.target.value.split("\n") }
                        : c,
                    ),
                  })
                }
              />
            </label>
          ) : (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={column.required}
                onChange={(e) =>
                  onChange({
                    ...field,
                    columns: columns.map((c, i) =>
                      i === index ? { ...c, required: e.target.checked } : c,
                    ),
                  })
                }
              />
              Required cell
            </label>
          )}
          <button
            type="button"
            className={buttonClasses.secondary}
            disabled={columns.length <= 1}
            onClick={() =>
              onChange({
                ...field,
                columns: columns.filter((_, i) => i !== index),
              })
            }
          >
            Remove column
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          className={buttonClasses.secondary}
          disabled={columns.length >= 12}
          onClick={() =>
            onChange({
              ...field,
              columns: [
                ...columns,
                {
                  key: `col_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
                  label: "New column",
                  type: "text",
                  required: false,
                  choices: [],
                },
              ],
            })
          }
        >
          Add column
        </button>
        <label className="live-field">
          Maximum rows
          <input
            type="number"
            min={1}
            max={40}
            value={field.max_rows ?? 20}
            onChange={(e) =>
              onChange({ ...field, max_rows: Number(e.target.value) })
            }
          />
        </label>
      </div>
    </fieldset>
  );
}
