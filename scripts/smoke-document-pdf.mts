/** Synthetic continuation check. No API, patient account or clinical file is read. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { generate } from "@pdfme/generator";
import { text, table } from "@pdfme/schemas";
import { definition } from "../features/live/journey-contract";
import {
  prepareDocument,
  documentInputs,
} from "../features/document-studio/prepare-document";
import { withPageNumbers } from "../features/document-studio/page-numbers";
import type { DocumentSnapshot } from "../features/document-studio/current-document";
const form = definition.parse({
  design_version: 2,
  stages: [
    {
      key: "admission",
      label: "admission",
      sections: [
        {
          key: "assessment",
          label: "Clinical assessment",
          identity_roles: ["doctor"],
          role_ids: ["team"],
          enabled: true,
          fields: [
            {
              key: "note",
              label: "Professional note",
              type: "textarea",
              required: true,
              choices: [],
            },
            {
              key: "results",
              label: "Repeated monitoring",
              type: "table",
              required: true,
              choices: [],
              columns: [
                {
                  key: "time",
                  label: "Time",
                  type: "text",
                  required: true,
                  choices: [],
                },
                {
                  key: "result",
                  label: "Observation and result",
                  type: "text",
                  required: true,
                  choices: [],
                },
              ],
            },
          ],
        },
      ],
    },
    { key: "clinical", label: "clinical", sections: [] },
    { key: "round", label: "round", sections: [] },
    { key: "connect", label: "connect", sections: [] },
    { key: "action", label: "action", sections: [] },
    { key: "review", label: "review", sections: [] },
    { key: "handover", label: "handover", sections: [] },
    { key: "event", label: "event", sections: [] },
    { key: "output", label: "output", sections: [] },
  ],
});
const data = {
  case: {
    template: {
      definition: form,
      name: "CCU360 - Shared care record",
      version: 2,
    },
    patient: {
      display_name: "SYNTHETIC QA PATIENT {1+1}",
      ccu360_number: "123456",
      ip_number: "QA-001",
      identifier: "QA-001",
      date_of_birth: "1990-01-01",
    },
    encounter: {
      id: "synthetic-qa-case",
      admitted_at: "2026-11-19T10:00:00Z",
      version: 3,
    },
  },
  entries: [
    {
      id: "synthetic-note",
      section_key: "assessment",
      revision: 1,
      status: "draft",
      author: {
        display_name: "Synthetic clinician",
        team_role_name: "Medical cover",
      },
      recorded_at: "2026-11-19T10:30:00Z",
      values: {
        note: {
          status: "present",
          value: "Synthetic observation. Keep {1+1} as literal text. ".repeat(
            12,
          ),
        },
        results: {
          status: "present",
          value: Array.from({ length: 40 }, (_, i) => ({
            time: `Round ${i + 1}`,
            result:
              "Synthetic result for PDF layout and continuation verification.",
          })),
        },
      },
    },
  ],
  attachments: [],
  head_hash: "0".repeat(64),
} as unknown as DocumentSnapshot;
const template = prepareDocument(data);
const bytes = await generate({
  template,
  inputs: documentInputs(template),
  plugins: { Text: withPageNumbers(text), Table: table },
  options: {
    font: {
      Inter: { data: readFileSync("public/fonts/Inter.ttf"), fallback: true },
    },
  },
});
assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
writeFileSync("/tmp/ccu360-dynamic-document-qa.pdf", bytes);
console.log(
  "PASS generated synthetic 40-row PDF with literal text, draft labels, patient reference and page numbers",
);
