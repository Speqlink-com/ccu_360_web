"use client";
import { useStore } from "zustand";
import type { StudioStore } from "./store";
import type { TeamRole } from "./inspector";
export function TeamAccess({
  store,
  roles,
}: {
  store: StudioStore;
  roles: TeamRole[];
}) {
  const { draft, edit } = useStore(store),
    form = draft.definition;
  const linked = new Set([
    ...form.access_role_ids,
    ...form.stages.flatMap((s) =>
      s.sections.filter((s) => s.enabled).flatMap((s) => s.role_ids),
    ),
  ]);
  return (
    <section
      className="studio-settings"
      aria-label="Form access and permissions"
    >
      <p className="studio-kicker">SHARED PATIENT JOURNEY</p>
      <h2>One record. Clear responsibilities.</h2>
      <p>
        Link the teams that need the complete ledger. Reception or a qualified
        intake team starts each patient journey; section permissions control who
        can write.
      </p>
      <p className="studio-info">
        A profession-wide role applies to every available matching employee,
        including future hires. Individual roles require dated staff
        assignments. Registration teams are selected as intake teams when
        linked; review the intake checkbox before publishing.
      </p>
      <div
        className="flex flex-wrap gap-2 my-5"
        aria-label="Add teams by profession"
      >
        {[
          ["receptionist", "Reception"],
          ["doctor", "Doctor / clinician"],
          ["nurse", "Nurse"],
          ["allied", "Allied health"],
          ["auditor", "Clinical auditor"],
        ].map(([category, label]) => (
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-sm"
            key={category}
            disabled={
              !roles.some(
                (r) => r.active && r.identity_roles.includes(category),
              )
            }
            onClick={() =>
              edit((d) => {
                const ids = roles
                  .filter(
                    (r) => r.active && r.identity_roles.includes(category),
                  )
                  .map((r) => r.id);
                d.definition.access_role_ids = [
                  ...new Set([...d.definition.access_role_ids, ...ids]),
                ];
                if (category === "receptionist")
                  d.definition.intake_role_ids = [
                    ...new Set([
                      ...d.definition.intake_role_ids,
                      ...roles
                        .filter(
                          (r) =>
                            ids.includes(r.id) &&
                            r.capabilities.includes("register"),
                        )
                        .map((r) => r.id),
                    ]),
                  ];
              })
            }
          >
            Add all visible {label} teams
          </button>
        ))}
      </div>
      <div className="studio-access-grid">
        {roles
          .filter((r) => r.active || linked.has(r.id))
          .map((role) => {
            const intake =
              role.capabilities.includes("admit") ||
              (role.identity_roles.includes("receptionist") &&
                role.capabilities.includes("register"));
            return (
              <article
                className={`studio-access-card ${linked.has(role.id) ? "is-active" : ""}`}
                key={role.id}
              >
                <label className="studio-check">
                  <input
                    type="checkbox"
                    aria-label={`Link ${role.name}`}
                    checked={linked.has(role.id)}
                    onChange={(e) =>
                      edit((d) => {
                        const f = d.definition;
                        if (e.target.checked) {
                          f.access_role_ids = [
                            ...new Set([...f.access_role_ids, role.id]),
                          ];
                          if (
                            role.identity_roles.includes("receptionist") &&
                            role.capabilities.includes("register")
                          )
                            f.intake_role_ids = [
                              ...new Set([...f.intake_role_ids, role.id]),
                            ];
                        } else {
                          f.access_role_ids = f.access_role_ids.filter(
                            (id) => id !== role.id,
                          );
                          f.intake_role_ids = f.intake_role_ids.filter(
                            (id) => id !== role.id,
                          );
                          for (const st of f.stages)
                            for (const s of st.sections) {
                              s.role_ids = s.role_ids.filter(
                                (id) => id !== role.id,
                              );
                              if (s.write_role_ids)
                                s.write_role_ids = s.write_role_ids.filter(
                                  (id) => id !== role.id,
                                );
                            }
                        }
                      })
                    }
                  />
                  <span>
                    <strong>{role.name}</strong>
                    <small>
                      {role.identity_roles.join(" · ")}
                      {!role.active ? " · Archived role" : ""}
                    </small>
                  </span>
                </label>
                <p className="text-xs">
                  {role.membership_mode === "profession"
                    ? "All matching employees inherit this role"
                    : "Requires individual staff assignments"}
                </p>
                <p>
                  {linked.has(role.id)
                    ? "Reads the complete patient journey"
                    : "No access through this form"}
                </p>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    aria-label={`Intake ${role.name}`}
                    checked={form.intake_role_ids.includes(role.id)}
                    disabled={!linked.has(role.id) || !intake || !role.active}
                    onChange={(e) =>
                      edit((d) => {
                        d.definition.intake_role_ids = e.target.checked
                          ? [
                              ...new Set([
                                ...d.definition.intake_role_ids,
                                role.id,
                              ]),
                            ]
                          : d.definition.intake_role_ids.filter(
                              (id) => id !== role.id,
                            );
                      })
                    }
                  />
                  Can start patient journeys
                </label>
                {!intake && (
                  <small>
                    Requires Register patients for reception, or Open journeys
                    for clinical intake.
                  </small>
                )}
              </article>
            );
          })}
      </div>
      {!roles.length && (
        <p className="studio-info">
          Create roles in Departments & care teams before publishing.
        </p>
      )}
      <h3>Section ownership</h3>
      <div className="studio-permission-table">
        <table>
          <thead>
            <tr>
              <th>Stage / section</th>
              <th>Writing teams</th>
              <th>Sign-off</th>
            </tr>
          </thead>
          <tbody>
            {form.stages.flatMap((st) =>
              st.sections
                .filter((s) => s.enabled)
                .map((s) => (
                  <tr key={s.key}>
                    <td>
                      <strong>{s.label}</strong>
                      <small>{st.label}</small>
                    </td>
                    <td>
                      {(s.write_role_ids ?? s.role_ids)
                        .map(
                          (id) =>
                            roles.find((r) => r.id === id)?.name ??
                            "Unavailable role",
                        )
                        .join(", ") || "Choose a writing team in Build form"}
                    </td>
                    <td>
                      {s.attestation_required
                        ? "Authenticated attestation"
                        : "Recorded contribution"}
                    </td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
