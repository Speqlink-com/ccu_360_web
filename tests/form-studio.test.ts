import assert from "node:assert/strict";
import test from "node:test";
import { definition } from "../features/live/journey-contract";
import {
  createPaper,
  fieldName,
  storedLayout,
} from "../features/document-studio/layout";
import {
  allFields,
  moveField,
  newField,
  normalizeDecorations,
  paperIssues,
  syncPaper,
} from "../features/form-studio/model";
import { createStudioStore } from "../features/form-studio/store";
import { draftIssues } from "../features/form-studio/validation";
import { brandedPaper } from "../features/form-studio/branding";
function sample() {
  return definition.parse({
    design_version: 2,
    access_role_ids: [],
    intake_role_ids: [],
    stages: [
      "admission",
      "clinical",
      "round",
      "connect",
      "action",
      "review",
      "handover",
      "event",
      "output",
    ].map((key, i) => ({
      key,
      label: key,
      sections: i
        ? []
        : [
            {
              key: "intake",
              label: "Intake form",
              kind: "administrative",
              identity_roles: ["receptionist"],
              role_ids: [],
              write_role_ids: [],
              enabled: true,
              attestation_required: false,
              fields: [
                {
                  key: "reason",
                  label: "Reason for visit",
                  type: "textarea",
                  required: true,
                  choices: [],
                },
              ],
            },
          ],
    })),
  });
}
test("field edits preserve custom geometry and unrelated decorative content", () => {
  const form = sample();
  form.document = storedLayout(createPaper(form, "Facility form"));
  const source = form.document.schemas
    .flat()
    .find((s) => s.name === "intake__reason")!;
  source.position = { x: 30, y: 120 };
  source.width = 120;
  form.document.schemas[0].push({
    name: "display_custom",
    type: "text",
    position: { x: 15, y: 270 },
    width: 180,
    height: 6,
    content: "Facility instruction",
    fontName: "Inter",
  });
  form.stages[0].sections[0].fields.push({
    ...newField("number"),
    key: "reading",
    label: "Reading",
  });
  const paper = syncPaper(form, "Facility form"),
    items = paper.schemas.flat();
  assert.deepEqual(items.find((s) => s.name === "intake__reason")!.position, {
    x: 30,
    y: 120,
  });
  assert.equal(items.find((s) => s.name === "intake__reason")!.width, 120);
  assert.equal(
    items.find((s) => s.name === "display_custom")!.content,
    "Facility instruction",
  );
  assert.equal(items.filter((s) => s.name === "intake__reading").length, 1);
  assert.equal(new Set(items.map((s) => s.name)).size, items.length);
});
test("renaming and removing fields synchronizes labels and removes orphan bindings", () => {
  const form = sample();
  form.stages[0].sections[0].fields.push({
    ...newField("text"),
    key: "remove_me",
  });
  form.document = storedLayout(createPaper(form, "Form"));
  form.stages[0].sections[0].fields[0].label = "Visit narrative";
  form.stages[0].sections[0].fields.pop();
  const items = syncPaper(form, "Form").schemas.flat();
  assert.equal(
    items.find((s) => s.name === "display_label_intake__reason")!.content,
    "Visit narrative *",
  );
  assert.ok(!items.some((s) => String(s.name).includes("remove_me")));
});
test("changing a field to a typed table keeps its placement and updates its columns", () => {
  const form = sample();
  form.document = storedLayout(createPaper(form, "Form"));
  const before = form.document.schemas
    .flat()
    .find((s) => s.name === "intake__reason")!.position;
  Object.assign(form.stages[0].sections[0].fields[0], newField("table"), {
    key: "reason",
  });
  const field = syncPaper(form, "Form")
    .schemas.flat()
    .find((s) => s.name === "intake__reason")!;
  assert.equal(field.type, "table");
  assert.deepEqual(field.position, before);
  assert.deepEqual(field.head, ["Description"]);
});
test("layout validation detects missing bindings and duplicates before application", () => {
  const form = sample(),
    paper = createPaper(form, "Form");
  paper.schemas[0] = paper.schemas[0].filter(
    (s) => s.name !== "intake__reason",
  );
  assert.match(paperIssues(paper, form).join(" "), /missing from the PDF/);
  const good = createPaper(form, "Form");
  good.schemas[0].push(structuredClone(good.schemas[0][0]));
  assert.match(paperIssues(good, form).join(" "), /unique name/);
});
test("decorative elements get safe names while clinical bindings remain unchanged", () => {
  const form = sample(),
    paper = createPaper(form, "Form");
  paper.schemas[0].push({
    name: "Text 1",
    type: "text",
    content: "Heading",
    position: { x: 15, y: 250 },
    width: 180,
    height: 7,
  });
  const clean = normalizeDecorations(paper, form);
  assert.match(clean.schemas[0].at(-1)!.name, /^display_/);
  assert.ok(clean.schemas.flat().some((s) => s.name === "intake__reason"));
  assert.equal(paper.schemas[0].at(-1)!.name, "Text 1");
});
test("layout checks reject expressions, remote images and out-of-page elements", () => {
  const form = sample(),
    paper = createPaper(form, "Form");
  paper.schemas[0][0].content = "{malicious_expression}";
  paper.schemas[0][1].position.x = 300;
  paper.schemas[0].push({
    name: "display_remote",
    type: "image",
    content: "https://outside.example/image.png",
    position: { x: 10, y: 10 },
    width: 10,
    height: 10,
  });
  const issues = paperIssues(paper, form).join(" ");
  assert.match(issues, /plain labels/);
  assert.match(issues, /inside the A4/);
  assert.match(issues, /Remote images/);
});
test("landscape reconciliation fits missing fields inside the stored A4 orientation", () => {
  const form = sample();
  form.document = storedLayout(createPaper(form, "Form"));
  form.document.basePdf = {
    width: 297,
    height: 210,
    padding: [10, 10, 10, 10],
  };
  form.stages[0].sections[0].fields.push({
    ...newField("number"),
    key: "new_reading",
  });
  const result = syncPaper(form, "Form");
  assert.equal(result.basePdf.width, 297);
  const field = result.schemas
    .flat()
    .find((s) => s.name === "intake__new_reading")!;
  const position = field.position as { x: number; y: number };
  assert.ok(position.y + Number(field.height) <= 210);
});
test("undo/redo and unsaved state are scoped to one template instance", () => {
  const original = {
      name: "First form",
      brandId: "brand",
      definition: sample(),
    },
    first = createStudioStore(original),
    second = createStudioStore(original);
  first.getState().edit((d) => {
    d.name = "Edited form";
  });
  assert.equal(second.getState().draft.name, "First form");
  assert.equal(original.name, "First form");
  first.getState().undo();
  assert.equal(JSON.stringify(first.getState().draft), first.getState().saved);
  first.getState().redo();
  assert.equal(first.getState().draft.name, "Edited form");
  first.getState().lock(true);
  first.getState().edit((d) => {
    d.name = "Unwanted";
  });
  first.getState().undo();
  assert.equal(first.getState().draft.name, "Edited form");
});
test("new edits after undo clear the abandoned redo branch", () => {
  const store = createStudioStore({
    name: "Form",
    brandId: "brand",
    definition: sample(),
  });
  store.getState().edit((d) => {
    d.name = "First change";
  });
  store.getState().undo();
  store.getState().edit((d) => {
    d.name = "Second change";
  });
  assert.equal(store.getState().future.length, 0);
});
test("selection changes do not enter document history or mark a draft dirty", () => {
  const store = createStudioStore({
    name: "Form",
    brandId: "brand",
    definition: sample(),
  });
  store.getState().select({ stage: "clinical" });
  assert.equal(store.getState().past.length, 0);
  assert.equal(JSON.stringify(store.getState().draft), store.getState().saved);
});
test("field moves preserve valid sections, ordering and unique destination keys", () => {
  const form = sample(),
    source = form.stages[0].sections[0];
  source.fields.push({ ...newField("text"), key: "second" });
  const target = {
    ...structuredClone(source),
    key: "second_section",
    fields: [{ ...newField("text"), key: "reason" }],
  };
  form.stages[0].sections.push(target);
  const moved = moveField(
    form,
    "admission",
    "intake",
    "second_section",
    "reason",
  );
  assert.ok(moved);
  assert.notEqual(moved, "reason");
  assert.equal(source.fields.length, 1);
  assert.equal(new Set(target.fields.map((f) => f.key)).size, 2);
  assert.equal(
    moveField(form, "admission", "intake", "second_section", "second"),
    undefined,
  );
  moveField(
    form,
    "admission",
    "second_section",
    "second_section",
    moved!,
    "reason",
  );
  assert.equal(target.fields[0].key, moved);
  moveField(form, "admission", "second_section", "second_section", moved!);
  assert.equal(target.fields.at(-1)!.key, moved);
});
test("draft validation identifies duplicate choices and incomplete repeating tables", () => {
  const form = sample(),
    fields = form.stages[0].sections[0].fields;
  fields.push({ ...newField("choice"), choices: ["Same", "Same"] });
  fields.push({ ...newField("table"), columns: [], max_rows: 0 });
  const messages = draftIssues(form).join(" ");
  assert.match(messages, /distinct/);
  assert.match(messages, /table columns/);
  assert.match(messages, /40 rows/);
});
test("new branded paper uses the pinned facility identity without modifying the schema", async () => {
  const form = sample(),
    before = JSON.stringify(form),
    paper = await brandedPaper(form, "Care form", {
      id: "brand",
      title: "Test Hospital",
      version: 1,
      revision: 1,
      active: true,
      primary_color: "#123456",
      accent_color: "#789abc",
      logo_id: null,
    });
  assert.equal(paper.schemas[0][0].content, "Test Hospital");
  assert.equal(paper.schemas[0][0].fontColor, "#123456");
  assert.equal(JSON.stringify(form), before);
  assert.equal(allFields(form)[0].name, fieldName("intake", "reason"));
});

test("new PDF pages retain facility headers and generated section titles follow renames", () => {
  const form = sample();
  form.document = storedLayout(createPaper(form, "Care form"));
  const title = form.document.schemas[0].find((s) =>
    String(s.name).startsWith("display_title_"),
  )!;
  title.content = "Branded Test Hospital";
  title.fontColor = "#123456";
  form.stages[0].sections[0].label = "Reception assessment";
  form.stages[0].sections[0].fields.push({
    ...newField("text"),
    key: "new_context",
  });
  const result = syncPaper(form, "Care form"),
    added = result.schemas.at(-1)!;
  assert.ok(
    added.some(
      (s) => s.content === "Branded Test Hospital" && s.fontColor === "#123456",
    ),
  );
  assert.ok(
    result.schemas[0].some(
      (s) =>
        String(s.name).startsWith("display_section_intake_") &&
        s.content === "Reception assessment",
    ),
  );
  assert.ok(added.some((s) => s.name === "intake__new_context"));
  assert.ok(added.some((s) => String(s.name).startsWith("display_title_")));
  assert.equal(
    new Set(result.schemas.flat().map((s) => s.name)).size,
    result.schemas.flat().length,
  );
  form.document = result;
  form.stages[0].sections[0].label = "Updated reception assessment";
  const renamed = syncPaper(form, "Care form")
    .schemas.flat()
    .filter((item) => String(item.name).startsWith("display_section_intake_"));
  assert.equal(renamed.length, 2);
  assert.ok(
    renamed.every((item) => item.content === "Updated reception assessment"),
  );
});

test("hiding or removing a section removes its generated PDF headings and clinical bindings", () => {
  for (const remove of [false, true]) {
    const form = sample();
    form.document = storedLayout(createPaper(form, "Form"));
    if (remove) form.stages[0].sections = [];
    else form.stages[0].sections[0].enabled = false;
    const result = syncPaper(form, "Form").schemas.flat();
    assert.ok(
      !result.some(
        (s) =>
          s.name === "intake__reason" ||
          String(s.name).startsWith("display_section_intake_") ||
          s.name === "display_label_intake__reason",
      ),
    );
  }
});
