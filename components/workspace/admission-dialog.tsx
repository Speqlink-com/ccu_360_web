"use client";
import { type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/dialog";
import { demoRequest } from "@/lib/api/demo-client";
import { patientSchema } from "@/lib/domain/workspace";
import { Icon } from "@/components/ui/icon";
export function AdmissionDialog({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: unknown) =>
      demoRequest("patients", patientSchema, { method: "POST", body }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["workspace"] });
      client.invalidateQueries({ queryKey: ["directory"] });
      onClose();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate(Object.fromEntries(new FormData(e.currentTarget)));
  }
  return (
    <Dialog
      title="New admission"
      subtitle="Create a synthetic encounter in your facility’s configured unit and bed."
      onClose={onClose}
    >
      <form className="provision-form" onSubmit={submit}>
        <div className="field-grid">
          <label>
            Patient name
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              placeholder="Synthetic patient only"
            />
          </label>
          <label>
            Facility patient ID
            <input
              name="mrn"
              required
              minLength={2}
              maxLength={50}
              placeholder="DEMO-006"
            />
          </label>
          <label>
            Age (years)
            <input name="age" type="number" min="0" max="130" required />
          </label>
          <label>
            Recorded sex
            <select name="sex">
              <option>Unknown</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </select>
          </label>
          <label>
            Unit
            <select name="unit">
              <option>ICU</option>
              <option>HDU</option>
            </select>
          </label>
          <label>
            Bed number
            <input name="bed" type="number" min="1" max="500" required />
          </label>
        </div>
        <div className="role-note">
          <Icon name="shield" />
          <p>
            No observations or clinical findings are inferred. A bed already
            occupied by another encounter cannot be selected.
          </p>
        </div>
        {mutation.isError && (
          <p className="inline-error" role="alert">
            {mutation.error.message}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating encounter…" : "Create encounter"}
            <Icon name="arrow" />
          </button>
        </div>
      </form>
    </Dialog>
  );
}
