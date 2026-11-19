import test from "node:test";
import assert from "node:assert/strict";
import { definition } from "../features/live/journey-contract";
import { createPaper, storedLayout } from "../features/document-studio/layout";
import {
  prepareDocument,
  documentInputs,
} from "../features/document-studio/prepare-document";
import type { DocumentSnapshot } from "../features/document-studio/current-document";
import { collectEntryValues } from "../features/live/entry-values";
import {
  allowedGatewayPath,
  validGatewayQuery,
} from "../lib/server/identity-gateway";

const form = definition.parse({
  design_version: 2,
  stages: Array.from({ length: 9 }, (_, i) => ({
    key: `stage_${i}`,
    label: `Stage ${i}`,
    sections: i
      ? []
      : [
          {
            key: "assessment",
            label: "Assessment",
            identity_roles: ["doctor"],
            role_ids: ["team"],
            enabled: true,
            fields: [
              {
                key: "notes",
                label: "Notes",
                type: "textarea",
                required: true,
                choices: [],
              },
              {
                key: "results",
                label: "Results",
                type: "table",
                required: false,
                choices: [],
                columns: [
                  {
                    key: "result",
                    label: "Result",
                    type: "number",
                    required: true,
                    choices: [],
                  },
                  {
                    key: "checked",
                    label: "Verified",
                    type: "boolean",
                    required: false,
                    choices: [],
                  },
                ],
              },
              {
                key: "files",
                label: "Files",
                type: "attachment",
                required: false,
                choices: [],
              },
            ],
          },
        ],
  })),
});
test("paper layouts retain stable field bindings and typed table and file values", () => {
  const paper = createPaper(form, "Facility booklet");
  assert.deepEqual(
    paper.schemas
      .flat()
      .filter((f) => f.name.startsWith("assessment__"))
      .map((f) => f.name),
    ["assessment__notes", "assessment__results", "assessment__files"],
  );
  assert.equal(storedLayout(paper).engine, "pdfme");
  const data = new FormData();
  data.set("notes", "Synthetic note");
  data.set("results", JSON.stringify([{ result: 0, checked: false }]));
  data.set("files", JSON.stringify(["synthetic-file-reference"]));
  const values = collectEntryValues(form.stages[0].sections[0], data);
  assert.deepEqual(values.results.value, [{ result: 0, checked: false }]);
  assert.deepEqual(values.files.value, ["synthetic-file-reference"]);
});
test("patient and clinical text reaches PDF rendering as literal input with provenance", () => {
  const data = {
    case: {
      template: { definition: form, name: "Facility booklet", version: 2 },
      patient: {
        display_name: "Synthetic {1+1} patient",
        ccu360_number: "123456",
        ip_number: "IP-1",
        identifier: "IP-1",
        date_of_birth: null,
      },
      encounter: {
        id: "case-1",
        admitted_at: "2026-11-19T10:00:00Z",
        version: 3,
      },
    },
    entries: [
      {
        id: "entry-1",
        section_key: "assessment",
        revision: 1,
        status: "draft",
        author: { display_name: "Synthetic clinician" },
        recorded_at: "2026-11-19T10:00:00Z",
        values: {
          notes: { status: "present", value: "Keep {1+1} literal" },
          results: {
            status: "present",
            value: [{ result: 0, checked: false }],
          },
        },
      },
    ],
    attachments: [],
    scope: "latest_note_per_section",
    head_hash: "0".repeat(64),
  } as unknown as DocumentSnapshot;
  const paper = prepareDocument(data),
    inputs = documentInputs(paper)[0];
  assert.equal(inputs.patient_name, "Synthetic {1+1} patient");
  assert.match(inputs.assessment__notes, /DRAFT/);
  assert.match(inputs.assessment__notes, /Keep \{1\+1\} literal/);
  assert.ok(
    paper.schemas
      .flat()
      .filter((s) => s.type === "text")
      .every((s) => s.readOnly === false),
  );
  assert.ok(
    String(
      paper.schemas.flat().find((s) => s.name === "assessment__results")
        ?.content,
    ).includes('"No"'),
  );
  assert.match(inputs.display_provenance, /latest note per section/);
});
test("document and queue gateway contracts do not imply unrelated write access", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(
    allowedGatewayPath(`journey/encounters/${id}/attachments/${id}`, "GET"),
    true,
  );
  assert.equal(
    allowedGatewayPath(`journey/encounters/${id}/attachments/${id}`, "DELETE"),
    false,
  );
  assert.equal(
    allowedGatewayPath(
      `journey/encounters/${id}/sections/assessment/work`,
      "POST",
    ),
    true,
  );
  assert.equal(allowedGatewayPath("journey/shift", "PUT"), true);
  assert.equal(allowedGatewayPath("journey/shift", "DELETE"), false);
});

test("queue filters accept only bounded resource-specific values", () => {
  assert.equal(
    validGatewayQuery(
      "journey/queue",
      new URLSearchParams("offset=0&limit=30&mine=false&state=ready"),
    ),
    true,
  );
  assert.equal(
    validGatewayQuery(
      "journey/queue",
      new URLSearchParams("mine=true&mine=false"),
    ),
    false,
  );
  assert.equal(
    validGatewayQuery("journey/queue", new URLSearchParams("state=anything")),
    false,
  );
  assert.equal(
    validGatewayQuery(
      "journey/queue",
      new URLSearchParams("encounter_id=not-a-uuid"),
    ),
    false,
  );
  assert.equal(
    validGatewayQuery("journey/shift", new URLSearchParams("mine=true")),
    false,
  );
});
