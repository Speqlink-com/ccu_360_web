"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { buttonClasses } from "@/lib/presentation";
import { Notice } from "@/features/live/shared";
import type { Section } from "@/features/live/journey-contract";
type Field = Section["fields"][number];

export function RepeatingTable({ field, old }: { field: Field; old: unknown }) {
  const columns = field.columns ?? [];
  const [rows, setRows] = useState<Record<string, unknown>[]>(() =>
    Array.isArray(old) ? (old as Record<string, unknown>[]) : [],
  );
  const set = (index: number, key: string, value: unknown) =>
    setRows(rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  return (
    <div>
      <input type="hidden" name={field.key} value={JSON.stringify(rows)} />
      <div className="relative overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[580px] text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <th className="p-3 text-left" key={c.key}>
                  {c.label}
                  {c.required ? " *" : ""}
                </th>
              ))}
              <th>
                <span className="sr-only">Row actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                {columns.map((c) => (
                  <td key={c.key} className="min-w-36 p-2">
                    {c.type === "choice" || c.type === "boolean" ? (
                      <select
                        aria-label={`${c.label}, row ${index + 1}`}
                        value={
                          row[c.key] === undefined ? "" : String(row[c.key])
                        }
                        required={c.required}
                        onChange={(e) =>
                          set(
                            index,
                            c.key,
                            e.target.value === ""
                              ? null
                              : c.type === "boolean"
                                ? e.target.value === "true"
                                : e.target.value,
                          )
                        }
                      >
                        <option value="">Choose</option>
                        {(c.type === "boolean"
                          ? ["true", "false"]
                          : c.choices
                        ).map((v) => (
                          <option key={v} value={v}>
                            {c.type === "boolean"
                              ? v === "true"
                                ? "Yes"
                                : "No"
                              : v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        aria-label={`${c.label}, row ${index + 1}`}
                        type={c.type === "text" ? "text" : c.type}
                        maxLength={1000}
                        step={c.type === "number" ? "any" : undefined}
                        required={c.required}
                        value={
                          row[c.key] === undefined || row[c.key] === null
                            ? ""
                            : String(row[c.key])
                        }
                        onChange={(e) =>
                          set(
                            index,
                            c.key,
                            c.type === "number"
                              ? e.target.value === ""
                                ? null
                                : Number(e.target.value)
                              : e.target.value,
                          )
                        }
                      />
                    )}
                  </td>
                ))}
                <td className="p-2">
                  <button
                    type="button"
                    className="text-sm text-red-800 underline"
                    aria-label={`Remove row ${index + 1}`}
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          className={buttonClasses.secondary}
          disabled={rows.length >= (field.max_rows ?? 20)}
          onClick={() => setRows([...rows, {}])}
        >
          Add row
        </button>
        <span className="text-sm text-muted">
          {rows.length} / {field.max_rows ?? 20} rows
        </span>
      </div>
    </div>
  );
}
const fileSchema = z.object({
  attachment: z.object({
    id: z.string(),
    filename: z.string(),
    sha256: z.string(),
  }),
  version: z.number(),
});
export function AttachmentInput({
  field,
  old,
  encounterId,
  sectionKey,
  org,
  version,
  onVersion,
  onPending,
}: {
  field: Field;
  old: unknown;
  encounterId: string;
  sectionKey: string;
  org: string;
  version: number;
  onVersion: (version: number) => void;
  onPending: (pending: boolean) => void;
}) {
  const client = useQueryClient();
  const [files, setFiles] = useState<{ id: string; filename: string }[]>(() =>
    Array.isArray(old)
      ? old.map((id) => ({
          id: String(id),
          filename: "Recorded file · " + String(id).slice(0, 8),
        }))
      : [],
  );
  const upload = useMutation({
    onMutate: () => onPending(true),
    onSettled: () => onPending(false),
    mutationFn: async (file: File) => {
      if (file.size > 2_097_152 || !file.size)
        throw new Error("Choose a file up to 2 MB.");
      if (!["image/png", "image/jpeg", "application/pdf"].includes(file.type))
        throw new Error("Choose a PNG, JPEG or PDF file.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return apiRequest(
        `/api/v1/journey/encounters/${encounterId}/attachments`,
        fileSchema,
        {
          method: "POST",
          body: {
            section_key: sectionKey,
            field_key: field.key,
            filename: file.name,
            media_type: file.type,
            content_base64: btoa(binary),
            expected_version: version,
          },
        },
      );
    },
    onSuccess: async (result) => {
      setFiles((old) => [...old, result.attachment]);
      onVersion(result.version);
      await client.invalidateQueries({ queryKey: ["live", org] });
    },
  });
  return (
    <div>
      <input
        type="hidden"
        name={field.key}
        value={JSON.stringify(files.map((f) => f.id))}
      />
      <ul className="mb-3 space-y-2">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3"
          >
            <a
              className="text-teal-dark underline"
              href={`/api/v1/journey/encounters/${encounterId}/attachments/${file.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {file.filename}
            </a>
            <button
              type="button"
              onClick={() => setFiles(files.filter((f) => f.id !== file.id))}
              className="text-sm underline"
            >
              Unlink from this note
            </button>
          </li>
        ))}
      </ul>
      <label className="live-field">
        Attach a clinical image or document
        <input
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          disabled={upload.isPending || files.length >= 8}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-2 text-sm text-muted">
        PNG, JPEG or non-interactive PDF · up to 2 MB each · 8 files per field.
        Files remain private to the linked care team. Unlinking preserves
        earlier evidence.
      </p>
      {upload.isPending && <p role="status">Verifying and securing file…</p>}
      <Notice error={upload.error} />
    </div>
  );
}
export function StructuredValue({
  field,
  value,
  encounterId,
}: {
  field: Field;
  value: unknown;
  encounterId: string;
}) {
  if (field.type === "table" && Array.isArray(value))
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {field.columns?.map((c) => (
                <th className="border border-border p-2 text-left" key={c.key}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {value.map((row, i) => (
              <tr key={i}>
                {field.columns?.map((c) => (
                  <td className="border border-border p-2" key={c.key}>
                    {row && typeof row === "object"
                      ? typeof row[c.key] === "boolean"
                        ? row[c.key]
                          ? "Yes"
                          : "No"
                        : String(row[c.key] ?? "")
                      : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if (field.type === "attachment" && Array.isArray(value))
    return (
      <ul>
        {value.map((id) => (
          <li key={String(id)}>
            <a
              className="text-teal-dark underline"
              target="_blank"
              rel="noreferrer"
              href={`/api/v1/journey/encounters/${encounterId}/attachments/${encodeURIComponent(String(id))}`}
            >
              Open clinical file · {String(id).slice(0, 8)}
            </a>
          </li>
        ))}
      </ul>
    );
  if (
    field.type === "link" &&
    typeof value === "string" &&
    value.startsWith("https://")
  )
    return (
      <a
        className="break-all text-teal-dark underline"
        href={value}
        target="_blank"
        rel="noreferrer"
      >
        {value}
      </a>
    );
  return null;
}
