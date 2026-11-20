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
                        if (e.target.checked)
                          f.access_role_ids = [
                            ...new Set([...f.access_role_ids, role.id]),
                          ];
                        else {
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
