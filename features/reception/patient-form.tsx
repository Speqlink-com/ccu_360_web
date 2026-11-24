"use client";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { Field, Notice, value } from "@/features/live/shared";
import { buttonClasses } from "@/lib/presentation";
import { patientProfile, type PatientProfile } from "./contracts";
import { useReceptionMutation } from "./queries";
import { WebSelect } from "@/components/ui/web-select";
type Demographics = {
  ip_number: string;
  display_name: string;
  date_of_birth: string | null;
  sex: string;
  phone: string | null;
};
export function PatientForm({
  existing: latest,
  onSaved,
  onCancel,
  onSelect,
}: {
  existing?: PatientProfile;
  onSaved: (p: PatientProfile) => void;
  onCancel: () => void;
  onSelect: (id: string) => void;
}) {
  const [existing] = useState(latest);
  const form = useRef<HTMLFormElement>(null);
  const [clientId] = useState(() => crypto.randomUUID());
  const [review, setReview] = useState<{
    data: Demographics;
    reason: string;
    items: PatientProfile[];
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pendingData, setPendingData] = useState<unknown>(null);
  const save = useReceptionMutation(patientProfile, onSaved);
  const duplicates = useMutation({
    mutationFn: (data: Demographics) =>
      apiRequest(
        "/api/v1/journey/reception/patients/duplicates",
        z.object({ items: z.array(patientProfile) }),
        {
          method: "POST",
          body: {
            display_name: data.display_name,
            date_of_birth: data.date_of_birth,
            phone: data.phone,
            exclude_patient_id: existing?.id ?? null,
          },
        },
      ),
  });
  const write = (data: Demographics, reason: string, reviewed: boolean) => {
    const body = {
      ...data,
      duplicate_reviewed: reviewed,
      ...(existing
        ? { expected_version: existing.version, reason }
        : { client_id: clientId }),
    };
    setPendingData(body);
    save.mutate({
      path: existing ? `patients/${existing.id}` : "patients",
      method: existing ? "PATCH" : "POST",
      body,
    });
  };
  return (
    <form
      ref={form}
      className="live-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          save.error instanceof ApiError &&
          save.error.outcomeUnknown &&
          pendingData
        ) {
          save.mutate({
            path: existing ? `patients/${existing.id}` : "patients",
            method: existing ? "PATCH" : "POST",
            body: pendingData,
          });
          return;
        }
        const fields = new FormData(e.currentTarget);
        const data = {
          ip_number: value(fields, "ip_number"),
          display_name: value(fields, "display_name"),
          date_of_birth: value(fields, "date_of_birth") || null,
          sex: value(fields, "sex"),
          phone: value(fields, "phone") || null,
        };
        const reason = value(fields, "reason");
        setReview(null);
        setConfirmed(false);
        try {
          const result = await duplicates.mutateAsync(data);
          if (result.items.length) {
            setReview({ data, reason, items: result.items });
            return;
          }
          write(data, reason, false);
        } catch {
          /* Notice keeps the form intact. */
        }
      }}
    >
      <Notice error={save.error} formRef={form} />
      <Notice error={duplicates.error} formRef={form} />
      <fieldset
        disabled={
          save.isPending ||
          duplicates.isPending ||
          !!review ||
          !!(save.error instanceof ApiError && save.error.outcomeUnknown)
        }
      >
        <p className="mb-5 rounded-lg bg-[#eef6f6] p-4 text-sm text-teal-dark">
          {existing
            ? "Corrections keep the same CCU360 number. Previous IP numbers and demographic versions stay in history."
            : "CCU360 assigns a unique six-digit number automatically. Search the directory before creating a new patient."}
        </p>
        <div className="grid gap-x-5 sm:grid-cols-2">
          <Field
            name="display_name"
            label="Patient full name"
            defaultValue={existing?.display_name}
            minLength={2}
            maxLength={160}
          />
          <Field
            name="ip_number"
            label="Facility IP number"
            defaultValue={existing?.ip_number}
            maxLength={100}
            pattern="[A-Za-z0-9][A-Za-z0-9 ./_-]*"
          />
          <Field
            name="date_of_birth"
            label="Date of birth"
            type="date"
            required={false}
            defaultValue={existing?.date_of_birth ?? ""}
          />
          <WebSelect name="sex" label="Sex" defaultValue={existing?.sex ?? "unknown"} required options={[
            { value: "unknown", label: "Not recorded" },
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
            { value: "intersex", label: "Intersex" },
          ]} />
          <Field
            name="phone"
            label="Telephone number"
            type="tel"
            required={false}
            defaultValue={existing?.phone ?? ""}
            maxLength={30}
            pattern="\+?[0-9][0-9 ()-]*"
          />
        </div>
        {existing && (
          <Field
            name="reason"
            label="Correction reason"
            minLength={3}
            maxLength={500}
          />
        )}
        <p className="mb-4 text-sm text-muted">
          The IP number identifies this facility’s patient record. It does not
          classify the patient as inpatient.
        </p>
      </fieldset>
      {review && (
        <section
          aria-label="Possible duplicate patients"
          className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-5"
        >
          <h3 className="font-semibold text-navy">Review possible matches</h3>
          <p className="mt-2 mb-4 text-sm">
            A name, date of birth or telephone number matches an existing
            record. Check the identifiers before continuing.
          </p>
          {review.items.map((item) => (
            <div
              key={item.id}
              className="mb-3 flex flex-wrap items-center justify-between gap-3 border-t border-amber-200 py-3"
            >
              <div>
                <strong>{item.display_name}</strong>
                <p className="text-sm">
                  CCU360 {item.ccu360_number} · IP {item.ip_number} ·{" "}
                  {item.date_of_birth ?? "DOB unknown"}
                </p>
              </div>
              <button
                type="button"
                className={buttonClasses.secondary}
                disabled={save.isPending}
                onClick={() => onSelect(item.id)}
              >
                Use existing patient
              </button>
            </div>
          ))}
          <label className="my-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {existing
              ? "I reviewed these matches and confirmed this correction belongs to the selected patient."
              : "I reviewed these matches and confirmed this is a different patient."}
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonClasses.primary}
              disabled={!confirmed || save.isPending}
              onClick={() => write(review.data, review.reason, true)}
            >
              {save.isPending
                ? "Saving…"
                : existing
                  ? "Confirm correction"
                  : "Register distinct patient"}
            </button>
            <button
              type="button"
              className={buttonClasses.secondary}
              onClick={() => setReview(null)}
            >
              Review entered details
            </button>
          </div>
        </section>
      )}
      <div className="flex flex-wrap gap-3">
        {!review && (
          <button
            className={buttonClasses.primary}
            disabled={save.isPending || duplicates.isPending}
          >
            {save.isPending
              ? "Saving…"
              : duplicates.isPending
                ? "Checking matches…"
                : save.error instanceof ApiError && save.error.outcomeUnknown
                  ? "Check / retry same registration"
                  : existing
                    ? "Save profile correction"
                    : "Register patient"}
          </button>
        )}
        <button
          type="button"
          className={buttonClasses.secondary}
          disabled={save.isPending || duplicates.isPending}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
