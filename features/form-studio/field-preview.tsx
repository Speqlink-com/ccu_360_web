"use client";
import type { FormField } from "./model";
import { RepeatingTable } from "@/features/document-studio/clinical-inputs";
export function FieldPreview({
  field,
  interactive = false,
}: {
  field: FormField;
  interactive?: boolean;
}) {
  if (!interactive)
    return (
      <div className="studio-field-ghost" data-field-type={field.type} aria-hidden="true">
        {field.type === "table" ? (
          <>
            <div className="studio-table-head">
              {field.columns?.map((c) => (
                <span key={c.key}>{c.label}</span>
              ))}
            </div>
            <div className="studio-table-head">
              {field.columns?.map((c) => (
                <span key={c.key}>—</span>
              ))}
            </div>
          </>
        ) : field.choices.length ? (
          field.choices.slice(0, 4).join("  ·  ")
        ) : field.type === "attachment" ? (
          "Upload image or document"
        ) : field.type === "boolean" ? (
          "○ Yes     ○ No"
        ) : field.type === "textarea" ? (
          "Write a detailed response…"
        ) : field.type === "observation_refs" ? (
          "Select a recorded observation"
        ) : field.type === "number" ? (
          "0.00"
        ) : field.type.includes("date") ? (
          "Select date"
        ) : field.type === "time" ? (
          "Select time"
        ) : field.type === "link" ? (
          "https://"
        ) : (
          "Enter response…"
        )}
      </div>
    );
  const props = {
    "aria-label": field.label,
    required: field.required,
    name: field.key,
    id: `sample_${field.key}`,
  };
  if (field.type === "table") return <RepeatingTable field={field} old={[]} />;
  if (field.type === "textarea")
    return (
      <textarea
        {...props}
        rows={3}
        maxLength={8000}
        placeholder="Enter a sample response"
      />
    );
  if (["choice", "boolean", "observation_refs"].includes(field.type))
    return (
      <select {...props} defaultValue="">
        <option value="">Select an answer</option>
        {(field.type === "boolean"
          ? ["Yes", "No"]
          : field.type === "observation_refs"
            ? ["Sample observation"]
            : field.choices
        ).map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    );
  if (["radio", "multichoice"].includes(field.type))
    return (
      <div className="studio-preview-options">
        {field.choices.map((c) => (
          <label key={c}>
            <input
              type={field.type === "radio" ? "radio" : "checkbox"}
              name={field.key}
              value={c}
              required={field.required && field.type === "radio"}
            />
            {c}
          </label>
        ))}
      </div>
    );
  if (field.type === "attachment")
    return (
      <div className="studio-upload-placeholder">
        <input
          {...props}
          type="file"
          multiple
          accept="image/png,image/jpeg,application/pdf"
        />
        <p>
          Preview keeps file selections in this browser only. Files are uploaded
          privately when employees document an actual patient journey.
        </p>
      </div>
    );
  return (
    <input
      {...props}
      type={
        field.type === "datetime"
          ? "datetime-local"
          : field.type === "link"
            ? "url"
            : field.type
      }
      maxLength={8000}
      step={field.type === "number" ? "any" : undefined}
    />
  );
}
