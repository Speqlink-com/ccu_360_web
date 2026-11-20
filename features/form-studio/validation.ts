import type { Definition } from "@/features/live/journey-contract";
export function draftIssues(definition: Definition): string[] {
  const issues: string[] = [];
  for (const stage of definition.stages) {
    if (stage.label.trim().length < 2)
      issues.push(
        "Give every journey stage a title of at least two characters.",
      );
    for (const section of stage.sections) {
      if (section.label.trim().length < 2)
        issues.push("Give every section a title of at least two characters.");
      for (const field of section.fields) {
        if (field.label.trim().length < 2)
          issues.push(
            `${section.label}: give every field a label of at least two characters.`,
          );
        if (
          ["choice", "radio", "multichoice"].includes(field.type) &&
          (!field.choices.length ||
            field.choices.length > 50 ||
            field.choices.some((c) => !c.trim() || c.length > 120) ||
            new Set(field.choices.map((c) => c.trim())).size !==
              field.choices.length)
        )
          issues.push(
            `${field.label}: enter up to 50 distinct, non-empty choices.`,
          );
        if (field.type === "table") {
          if (!field.columns?.length || field.columns.length > 12)
            issues.push(
              `${field.label}: add between one and 12 table columns.`,
            );
          if (
            !Number.isInteger(field.max_rows ?? 20) ||
            (field.max_rows ?? 20) < 1 ||
            (field.max_rows ?? 20) > 40
          )
            issues.push(`${field.label}: use between one and 40 rows.`);
          for (const c of field.columns ?? []) {
            if (c.label.trim().length < 2)
              issues.push(`${field.label}: label every table column.`);
            if (
              c.type === "choice" &&
              (!c.choices.length ||
                c.choices.some((v) => !v.trim()) ||
                new Set(c.choices.map((v) => v.trim())).size !==
                  c.choices.length)
            )
              issues.push(
                `${field.label} / ${c.label}: enter distinct column choices.`,
              );
          }
        }
      }
    }
  }
  if (
    definition.stages.reduce(
      (sum, stage) =>
        sum +
        stage.sections.reduce(
          (total, section) => total + section.fields.length,
          0,
        ),
      0,
    ) > 500
  )
    issues.push("Use at most 500 enabled clinical fields in a form.");
  return [...new Set(issues)];
}
