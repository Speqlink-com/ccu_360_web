import type { Section } from "./journey-contract";
export function collectEntryValues(section: Section, data: FormData) {
  const result: Record<
    string,
    { status: string; value?: unknown; reason?: string }
  > = {};
  for (const field of section.fields) {
    const status = String(data.get(field.key + "__status") ?? "present");
    if (
      !["present", "unknown", "not_assessed", "unobtainable"].includes(status)
    )
      throw new Error("Choose a valid availability status.");
    if (status !== "present") {
      const reason = String(data.get(field.key + "__reason") ?? "").trim();
      if (!reason) throw new Error(`Record why ${field.label} is unavailable.`);
      result[field.key] = { status, reason };
      continue;
    }
    const raw = String(data.get(field.key) ?? "").trim();
    if (field.type === "table" || field.type === "attachment") {
      const raw = String(data.get(field.key) ?? "[]");
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value))
        throw new Error(`${field.label} has invalid data.`);
      if (value.length) result[field.key] = { status, value };
      else if (field.required) throw new Error(`${field.label} is required.`);
      continue;
    }
    if (field.type === "observation_refs" || field.type === "multichoice") {
      const refs = data.getAll(field.key).map(String);
      if (
        field.type === "multichoice" &&
        refs.some((ref) => !field.choices.includes(ref))
      )
        throw new Error(`Choose available options for ${field.label}.`);
      if (refs.length) result[field.key] = { status, value: refs };
      else if (field.required) throw new Error(`${field.label} is required.`);
      continue;
    }
    if (!raw) {
      if (field.required) throw new Error(`${field.label} is required.`);
      continue;
    }
    let value: unknown = raw;
    if (field.type === "number") {
      value = Number(raw);
      if (
        !Number.isFinite(value) ||
        Math.abs(Number(value)) > Number.MAX_SAFE_INTEGER
      )
        throw new Error(`${field.label} must be a finite number.`);
    }
    if (field.type === "boolean") {
      if (!["true", "false"].includes(raw))
        throw new Error(`Choose yes or no for ${field.label}.`);
      value = raw === "true";
    }
    if (field.type === "datetime") value = new Date(raw).toISOString();
    if (
      ["choice", "radio"].includes(field.type) &&
      !field.choices.includes(raw)
    )
      throw new Error(`Choose an available option for ${field.label}.`);
    result[field.key] = { status, value };
  }
  return result;
}
