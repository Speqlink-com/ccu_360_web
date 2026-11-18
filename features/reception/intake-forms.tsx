"use client";
import { useRef, useState } from "react";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import { useIdentity } from "@/features/identity/queries";
import { useChoices, ChoiceLoader } from "@/features/live/choices";
import { Field, Notice, value } from "@/features/live/shared";
import { buttonClasses } from "@/lib/presentation";
import {
  publishedForm,
  visitResult,
  type PatientProfile,
  type Visit,
} from "./contracts";
import { useReceptionMutation } from "./queries";
import { localTime, VisitCard } from "./shared";
export function ArrivalForm({
  patient,
  canStart,
  onSaved,
}: {
  patient: PatientProfile;
  canStart: boolean;
  onSaved: (v: z.infer<typeof visitResult>) => void;
}) {
  const org = useIdentity().data!.organization_id!;
  const form = useRef<HTMLFormElement>(null);
  const [clientId] = useState(() => crypto.randomUUID());
  const [arrivedAt] = useState(localTime);
  const [source, setSource] = useState("walk_in");
  const [submitted, setSubmitted] = useState<unknown>();
  const forms = useChoices(
    org,
    "journey/published-templates",
    publishedForm,
    canStart,
  );
  const available =
    forms.data?.pages
      .flatMap((p) => p.items)
      .filter((item) => item.can_initiate) ?? [];
  const mutation = useReceptionMutation(visitResult, onSaved);
  const uncertain =
    mutation.error instanceof ApiError && mutation.error.outcomeUnknown;
  return (
    <form
      ref={form}
      className="live-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (uncertain && submitted) {
          mutation.mutate({ path: "arrivals", body: submitted });
          return;
        }
        const data = new FormData(e.currentTarget);
        const body = {
          client_id: clientId,
          patient_id: patient.id,
          expected_profile_version: patient.version,
          arrival_source: source,
          arrived_at: new Date(value(data, "arrived_at")).toISOString(),
          referring_facility:
            source === "referral" ? value(data, "referring_facility") : null,
          referral_reference:
            source === "referral"
              ? value(data, "referral_reference") || null
              : null,
          intake_note: value(data, "intake_note") || null,
          template_id: value(data, "template_id") || null,
        };
        setSubmitted(body);
        mutation.mutate({ path: "arrivals", body });
      }}
    >
      <Notice error={mutation.error} formRef={form} />
      <fieldset disabled={mutation.isPending || uncertain}>
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <label
            className={`cursor-pointer rounded-xl border p-4 ${source === "walk_in" ? "border-teal bg-mint" : "border-border"}`}
          >
            <input
              type="radio"
              className="mr-3"
              name="arrival_source"
              value="walk_in"
              checked={source === "walk_in"}
              onChange={() => setSource("walk_in")}
            />
            <strong>Walk-in</strong>
            <span className="mt-2 block text-sm text-muted">
              Arrived directly at this facility
            </span>
          </label>
          <label
            className={`cursor-pointer rounded-xl border p-4 ${source === "referral" ? "border-teal bg-mint" : "border-border"}`}
          >
            <input
              type="radio"
              className="mr-3"
              name="arrival_source"
              value="referral"
              checked={source === "referral"}
              onChange={() => setSource("referral")}
            />
            <strong>Referred</strong>
            <span className="mt-2 block text-sm text-muted">
              Arrived from another facility
            </span>
          </label>
        </div>
        <p className="mb-4 text-sm text-muted">
          New or returning is determined from this patient’s existing visit
          history. A referral can be either.
        </p>
        <Field
          name="arrived_at"
          label="Arrival date & time (local time)"
          type="datetime-local"
          defaultValue={arrivedAt}
        />
        {source === "referral" && (
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field
              name="referring_facility"
              label="Referring facility"
              minLength={2}
              maxLength={160}
            />
            <Field
              name="referral_reference"
              label="Referral reference"
              required={false}
              maxLength={100}
            />
          </div>
        )}
        <Field
          name="intake_note"
          label="Reception note"
          type="textarea"
          required={false}
          maxLength={1000}
        />
        <Field
          name="template_id"
          label="Journey form to start"
          required={false}
        >
          <option value="">Record arrival · choose form later</option>
          {available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · v{item.version}
            </option>
          ))}
        </Field>
        {canStart && <ChoiceLoader query={forms} />}
        <p className="mb-5 rounded-xl border border-border bg-[#f5f8fa] p-4 text-sm text-muted">
          The clinician decides whether this visit needs inpatient admission,
          outpatient care or release. Reception records arrival and initiates
          forms; no admission category or bed is assigned here.
        </p>
        {!canStart && (
          <p className="mb-4 text-sm text-amber-800">
            You can record this arrival. To start a form, your administrator
            must give you an active intake-team assignment on a published
            template.
          </p>
        )}
      </fieldset>
      <button className={buttonClasses.primary} disabled={mutation.isPending}>
        {mutation.isPending
          ? "Recording arrival…"
          : uncertain
            ? "Check / retry same arrival"
            : "Record arrival & continue"}
      </button>
    </form>
  );
}
export function ArrivalActions({
  visit,
  canStart,
  onChanged,
}: {
  visit: Visit;
  canStart: boolean;
  onChanged: () => void;
}) {
  const org = useIdentity().data!.organization_id!;
  const form = useRef<HTMLFormElement>(null);
  const cancelForm = useRef<HTMLFormElement>(null);
  const [formClientId] = useState(() => crypto.randomUUID());
  const [cancelClientId] = useState(() => crypto.randomUUID());
  const options = useChoices(
    org,
    "journey/published-templates",
    publishedForm,
    canStart && visit.status !== "cancelled",
  );
  const attach = useReceptionMutation(visitResult, onChanged);
  const cancel = useReceptionMutation(visitResult, onChanged);
  return (
    <>
      {visit.status !== "cancelled" && canStart && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-teal-dark">
            Start another journey form
          </summary>
          <form
            ref={form}
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              attach.mutate({
                path: `arrivals/${visit.id}/forms`,
                body: {
                  client_id: formClientId,
                  template_id: value(
                    new FormData(e.currentTarget),
                    "template_id",
                  ),
                },
              });
            }}
          >
            <Notice error={attach.error} formRef={form} />
            <Field name="template_id" label="Published form">
              <option value="">Select form</option>
              {options.data?.pages
                .flatMap((p) => p.items)
                .filter(
                  (item) =>
                    item.can_initiate &&
                    !visit.journeys.some(
                      (j) =>
                        j.name === item.name &&
                        j.template_version === item.version,
                    ),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · v{item.version}
                  </option>
                ))}
            </Field>
            <ChoiceLoader query={options} />
            <button
              className={buttonClasses.secondary}
              disabled={attach.isPending}
            >
              {attach.isPending
                ? "Starting form…"
                : "Start form for this arrival"}
            </button>
          </form>
        </details>
      )}
      {visit.status === "waiting_form" && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted">
            Cancel arrival recorded in error
          </summary>
          <form
            ref={cancelForm}
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              cancel.mutate({
                path: `arrivals/${visit.id}/cancel`,
                body: {
                  client_id: cancelClientId,
                  reason: value(new FormData(e.currentTarget), "reason"),
                },
              });
            }}
          >
            <Notice error={cancel.error} formRef={cancelForm} />
            <p className="mb-3 text-sm text-muted">
              Retains the arrival and its cancellation reason. Arrivals with
              clinical journeys must be reviewed by the clinical team.
            </p>
            <Field
              name="reason"
              label="Cancellation reason"
              minLength={3}
              maxLength={500}
            />
            <button
              className={buttonClasses.secondary}
              disabled={cancel.isPending}
            >
              Cancel arrival
            </button>
          </form>
        </details>
      )}
    </>
  );
}
export function SavedArrival({
  result,
  canStart,
  onNew,
}: {
  result: z.infer<typeof visitResult>;
  canStart: boolean;
  onNew: () => void;
}) {
  return (
    <section aria-label="Recorded arrival">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-teal-dark">
          Arrival recorded
        </h3>
        <button className={buttonClasses.secondary} onClick={onNew}>
          Record a later visit
        </button>
      </div>
      <VisitCard visit={result.visit}>
        <ArrivalActions
          key={result.visit.journeys.length + result.visit.status}
          visit={result.visit}
          canStart={canStart}
          onChanged={onNew}
        />
      </VisitCard>
    </section>
  );
}
