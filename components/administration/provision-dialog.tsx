"use client";
import { buttonClasses } from "@/lib/presentation";
import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Icon } from "@/components/ui/icon";
import { ButtonHeartbeat } from "@/components/ui/ccu-loader";
import { useProvision } from "@/features/administration/queries";
export function ProvisionDialog({
  kind,
  onClose,
}: {
  kind: "facilities" | "employees";
  onClose: () => void;
}) {
  const mutation = useProvision(kind);
  const [copied, setCopied] = useState(false);
  const facility = kind === "facilities";
  const Surface = facility ? SideDrawer : Dialog;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    mutation.mutate(values);
  }
  return (
    <Surface
      title={
        mutation.isSuccess
          ? "Workspace access is ready"
          : facility
            ? "Onboard a facility"
            : "Add an employee"
      }
      subtitle={
        mutation.isSuccess
          ? "Share these demo credentials directly with the account owner."
          : facility
            ? "Create a separate workspace and appoint its first administrator."
            : "Give a team member the right role within your facility."
      }
      onClose={onClose}
    >
      {mutation.isSuccess ? (
        <div className="provision-result px-7 py-[26px] max-[760px]:p-[22px]">
          <span className="result-icon grid h-[66px] w-[66px] place-items-center rounded-2xl bg-[#edf8f5]">
            <Icon name="shield" size={38} />
          </span>
          <h3>{mutation.data.user.name}</h3>
          <p>
            The account is ready to sign in to its assigned workspace. No email
            has been sent.
          </p>
          <dl>
            <dt>Work email</dt>
            <dd>{mutation.data.user.email}</dd>
            <dt>Demo password</dt>
            <dd>
              <code>{mutation.data.temporaryPassword}</code>
            </dd>
          </dl>
          <div className="info-strip">
            This generated password is shown once here. Demo records reset when
            the server restarts.
          </div>
          <div className="dialog-actions mt-6 flex items-center justify-end gap-3 border-t border-border pt-[25px] max-[760px]:flex-wrap max-[760px]:gap-2.5">
            <button
              className={buttonClasses.secondary}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `Email: ${mutation.data.user.email}\nPassword: ${mutation.data.temporaryPassword}`,
                  );
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy account details"}
            </button>
            <button className={buttonClasses.primary} onClick={onClose}>
              Done <Icon name="actions" />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="provision-form px-7 py-[26px] max-[760px]:p-[22px]">
          {facility ? (
            <>
              <p className="form-section-title mb-[18px] text-[10px] font-semibold tracking-[1.6px] text-[#658478]">FACILITY DETAILS</p>
              <div className="field-grid grid grid-cols-2 gap-x-[22px] gap-y-[19px] max-[760px]:grid-cols-1 max-[760px]:gap-[18px]">
                <Field
                  label="Facility name"
                  name="name"
                  placeholder="e.g. Summit Hospital"
                  required
                />
                <Field
                  label="City / town"
                  name="city"
                  placeholder="e.g. Nairobi"
                  required
                />
                <label>
                  Facility type
                  <select name="type">
                    <option>Hospital</option>
                    <option>Medical centre</option>
                  </select>
                </label>
                <Field
                  label="Facility email"
                  name="contactEmail"
                  type="email"
                  placeholder="office@facility.ccu360.test"
                  required
                />
                <Field
                  label="ICU beds"
                  name="icuBeds"
                  type="number"
                  min="0"
                  max="500"
                  defaultValue="0"
                  required
                />
                <Field
                  label="HDU beds"
                  name="hduBeds"
                  type="number"
                  min="0"
                  max="500"
                  defaultValue="0"
                  required
                />
              </div>
              <p className="form-section-title mb-[18px] text-[10px] font-semibold tracking-[1.6px] text-[#658478]">FIRST FACILITY ADMINISTRATOR</p>
              <div className="field-grid grid grid-cols-2 gap-x-[22px] gap-y-[19px] max-[760px]:grid-cols-1 max-[760px]:gap-[18px]">
                <Field label="Administrator name" name="adminName" required />
                <Field
                  label="Administrator email"
                  name="adminEmail"
                  type="email"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="field-grid grid grid-cols-2 gap-x-[22px] gap-y-[19px] max-[760px]:grid-cols-1 max-[760px]:gap-[18px]">
                <Field
                  label="Full name"
                  name="name"
                  placeholder="Team member’s name"
                  required
                />
                <Field
                  label="Work email"
                  name="email"
                  type="email"
                  placeholder="name@facility.ccu360.test"
                  required
                />
                <label>
                  Role
                  <select name="role">
                    <option value="doctor">Doctor</option>
                    <option value="nurse">Nurse</option>
                    <option value="allied_health">
                      Allied health professional
                    </option>
                    <option value="facility_admin">
                      Facility administrator
                    </option>
                  </select>
                </label>
                <label>
                  Assigned unit
                  <select name="unit">
                    <option>All units</option>
                    <option>ICU</option>
                    <option>HDU</option>
                  </select>
                </label>
              </div>
              <div className="role-note mt-6 flex items-start gap-3 rounded-lg border border-[#e0ece6] bg-[#f0f7f4] px-[17px] py-[15px]">
                <Icon name="shield" />
                <p>
                  Access is limited to your facility. A facility administrator
                  can manage employees; clinical roles work with patient
                  records.
                </p>
              </div>
            </>
          )}
          {mutation.isError && (
            <p className="inline-error" role="alert">
              {mutation.error.message}
            </p>
          )}
          <footer className="dialog-actions mt-6 flex items-center justify-end gap-3 border-t border-border pt-[25px] max-[760px]:flex-wrap max-[760px]:gap-2.5">
            <button
              type="button"
              className={buttonClasses.secondary}
              onClick={onClose}
            >
              Cancel
            </button>
            <button disabled={mutation.isPending} aria-busy={mutation.isPending} className={buttonClasses.primary}>
              <ButtonHeartbeat loading={mutation.isPending}>
                {facility ? "Create facility workspace" : "Create employee account"}
                <Icon name={facility ? "arrow" : "addUser"} />
              </ButtonHeartbeat>
            </button>
          </footer>
        </form>
      )}
    </Surface>
  );
}
function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label>
      {label}
      <input {...props} maxLength={props.type === "number" ? undefined : 160} />
    </label>
  );
}
