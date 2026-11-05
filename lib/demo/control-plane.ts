import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { demoAccounts } from "./accounts";
import { seed } from "./seed";
import {
  admissionInputSchema,
  employeeInputSchema,
  facilityInputSchema,
  isClinicalRole,
  canWorkAction,
  userSchema,
  type Facility,
  type Directory,
  type User,
} from "../domain/identity";
import {
  transitionAction,
  type ActionStatus,
  type Workspace,
} from "../domain/workspace";

export class DemoError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "DemoError";
  }
}
const fail = (status: number, message: string): never => {
  throw new DemoError(status, message);
};
const publicUser = (user: User) => userSchema.parse(user);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const passwordHash = (password: string, id: string) =>
  scryptSync(password, id, 32);
export function createControlPlane() {
  const facilities: Facility[] = [
    {
      id: "fac-evergreen",
      name: "Evergreen Medical Centre",
      code: "EVG",
      city: "Nairobi",
      type: "Medical centre",
      status: "Active",
      contactEmail: "office@evergreen.ccu360.test",
      adminName: "Grace Mwangi",
      adminEmail: "admin@evergreen.ccu360.test",
      beds: { ICU: 8, HDU: 6 },
      createdAt: "2026-11-01T06:00:00Z",
    },
    {
      id: "fac-cedar",
      name: "Cedar Valley Hospital",
      code: "CDR",
      city: "Nakuru",
      type: "Hospital",
      status: "Active",
      contactEmail: "office@cedar.ccu360.test",
      adminName: "Daniel Otieno",
      adminEmail: "admin@cedar.ccu360.test",
      beds: { ICU: 6, HDU: 4 },
      createdAt: "2026-11-03T06:00:00Z",
    },
  ];
  const users = demoAccounts.map(({ password, ...user }) => ({
    ...user,
    digest: passwordHash(password, user.id),
  }));
  const workspaces = new Map<string, Workspace>();
  workspaces.set("fac-evergreen", structuredClone(seed));
  const cedar = structuredClone(seed);
  cedar.patients = cedar.patients.slice(0, 2).map((p, i) => ({
    ...p,
    id: `cedar-enc-${i + 1}`,
    name: ["Avery Quinn", "Charlie Parker"][i],
    initials: ["AQ", "CP"][i],
    mrn: `CDR-DEMO-00${i + 1}`,
    unit: "HDU",
    bed: String(i + 1).padStart(2, "0"),
    observations: p.observations.map((o) => ({
      ...o,
      id: `cedar-${o.id}-${i}`,
    })),
  }));
  cedar.actions = [];
  cedar.consultations = [];
  cedar.capacity = { ICU: 6, HDU: 4 };
  workspaces.set("fac-cedar", cedar);
  const sessions = new Map<string, { userId: string; expiresAt: number }>();
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const activity: Directory["activity"] = [
    {
      id: "evt-1",
      facilityId: "fac-evergreen",
      title: "Evergreen facility workspace activated",
      detail: "Facility administrator assigned; ICU and HDU configured.",
      actor: "Comphortine",
      at: "2026-11-05T06:00:00Z",
    },
    {
      id: "evt-2",
      facilityId: "fac-cedar",
      title: "Cedar Valley team provisioned",
      detail: "Doctor and nurse accounts are ready for the demo.",
      actor: "Daniel Otieno",
      at: "2026-11-05T06:30:00Z",
    },
  ];
  function audit(
    actor: User,
    title: string,
    detail: string,
    facilityId = actor.facilityId,
  ) {
    activity.unshift({
      id: randomUUID(),
      facilityId,
      title,
      detail,
      actor: actor.name,
      at: new Date().toISOString(),
    });
  }
  function current(user: User) {
    const found = users.find((u) => u.id === user.id && u.status === "Active");
    if (!found)
      return fail(401, "Your session is no longer active. Sign in again.");
    const facility = facilities.find((f) => f.id === found.facilityId);
    if (
      found.role !== "ahs_admin" &&
      (!facility || facility.status === "Suspended")
    )
      return fail(
        403,
        "This facility workspace is not active. Contact your facility administrator.",
      );
    if (isClinicalRole(found.role) && facility?.status !== "Active")
      return fail(
        403,
        "Your facility is being prepared. Clinical access opens when AHS activates the workspace.",
      );
    return publicUser(found);
  }
  function tenant(user: User) {
    const actor = current(user);
    if (!actor.facilityId)
      return fail(403, "A facility-scoped account is required.");
    return actor;
  }
  function clinical(user: User) {
    const actor = tenant(user);
    if (!isClinicalRole(actor.role))
      return fail(403, "Your role does not grant access to patient records.");
    return actor;
  }
  function manage(user: User) {
    const actor = tenant(user);
    if (actor.role !== "facility_admin")
      return fail(403, "Only facility administrators can manage employees.");
    return actor;
  }
  function uniqueEmail(email: string) {
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
      fail(409, "An account already uses this email address.");
  }
  function addUser(input: Omit<User, "id" | "status" | "joinedAt">) {
    const id = randomUUID(),
      password = `Ccu360!${randomBytes(5).toString("hex")}`;
    const user = {
      ...input,
      email: input.email.toLowerCase(),
      id,
      status: "Active" as const,
      joinedAt: new Date().toISOString(),
    };
    users.push({ ...user, digest: passwordHash(password, id) });
    return { user, temporaryPassword: password };
  }
  return {
    login(email: string, password: string, now = Date.now()) {
      const key = email.trim().toLowerCase(),
        attempt = attempts.get(key);
      if (attempt && attempt.resetAt > now && attempt.count >= 5)
        return fail(429, "Too many sign-in attempts. Try again in 15 minutes.");
      const found = users.find((u) => u.email.toLowerCase() === key);
      const digest = passwordHash(password, found?.id ?? "unknown-demo-user");
      if (
        !found ||
        !timingSafeEqual(found.digest, digest) ||
        found.status !== "Active"
      ) {
        attempts.set(key, {
          count: attempt && attempt.resetAt > now ? attempt.count + 1 : 1,
          resetAt:
            attempt && attempt.resetAt > now
              ? attempt.resetAt
              : now + 15 * 60_000,
        });
        return fail(401, "The email or password is incorrect.");
      }
      const user = current(found);
      attempts.delete(key);
      const token = randomBytes(32).toString("base64url");
      sessions.set(hash(token), {
        userId: user.id,
        expiresAt: now + 8 * 60 * 60_000,
      });
      return {
        token,
        session: {
          user,
          facility: structuredClone(
            facilities.find((f) => f.id === user.facilityId) ?? null,
          ),
        },
      };
    },
    session(token: string | undefined, now = Date.now()) {
      if (!token) return null;
      const record = sessions.get(hash(token));
      if (!record || record.expiresAt <= now) {
        sessions.delete(hash(token));
        return null;
      }
      const found = users.find((u) => u.id === record.userId);
      if (!found) return null;
      try {
        const user = current(found);
        return {
          user,
          facility: structuredClone(
            facilities.find((f) => f.id === user.facilityId) ?? null,
          ),
        };
      } catch {
        sessions.delete(hash(token));
        return null;
      }
    },
    logout(token: string | undefined) {
      if (token) sessions.delete(hash(token));
    },
    directory(user: User) {
      const actor = current(user),
        platform = actor.role === "ahs_admin";
      const scoped = facilities.filter(
        (f) => platform || f.id === actor.facilityId,
      );
      return {
        facilities: structuredClone(scoped),
        employees: users
          .filter((u) => platform || u.facilityId === actor.facilityId)
          .map(publicUser),
        activity: structuredClone(
          activity.filter((e) => platform || e.facilityId === actor.facilityId),
        ),
        summaries: scoped.map((f) => ({
          facilityId: f.id,
          patients: workspaces.get(f.id)?.patients.length ?? 0,
          openActions:
            workspaces
              .get(f.id)
              ?.actions.filter((a) => a.status !== "completed").length ?? 0,
        })),
      };
    },
    onboard(user: User, input: unknown) {
      const actor = current(user);
      if (actor.role !== "ahs_admin")
        return fail(403, "Only AHS administrators can onboard facilities.");
      const data = facilityInputSchema.parse(input);
      uniqueEmail(data.adminEmail);
      if (
        facilities.some((f) => f.name.toLowerCase() === data.name.toLowerCase())
      )
        return fail(409, "A facility already uses this name.");
      const id = randomUUID(),
        facility: Facility = {
          id,
          name: data.name,
          code: data.name
            .split(/\s+/)
            .map((x) => x[0])
            .join("")
            .slice(0, 3)
            .toUpperCase(),
          city: data.city,
          type: data.type,
          status: "Onboarding",
          contactEmail: data.contactEmail.toLowerCase(),
          adminName: data.adminName,
          adminEmail: data.adminEmail.toLowerCase(),
          beds: { ICU: data.icuBeds, HDU: data.hduBeds },
          createdAt: new Date().toISOString(),
        };
      facilities.push(facility);
      workspaces.set(id, {
        patients: [],
        actions: [],
        consultations: [],
        capacity: structuredClone(facility.beds),
      });
      const account = addUser({
        name: data.adminName,
        email: data.adminEmail,
        role: "facility_admin",
        facilityId: id,
        unit: "All units",
      });
      audit(
        actor,
        `${facility.name} onboarded`,
        "Facility administrator provisioned; workspace ready for team setup.",
        id,
      );
      return { facility: structuredClone(facility), ...account };
    },
    updateFacility(user: User, id: string, status: Facility["status"]) {
      const actor = current(user);
      if (actor.role !== "ahs_admin")
        return fail(403, "Only AHS administrators can change facility access.");
      const facility = facilities.find((f) => f.id === id);
      if (!facility) return fail(404, "Facility not found.");
      facility.status = status;
      audit(
        actor,
        `${facility.name}: ${status.toLowerCase()}`,
        "Facility workspace access updated.",
        id,
      );
      return structuredClone(facility);
    },
    addEmployee(user: User, input: unknown) {
      const actor = manage(user),
        data = employeeInputSchema.parse(input);
      uniqueEmail(data.email);
      const account = addUser({ ...data, facilityId: actor.facilityId });
      audit(
        actor,
        `${account.user.name} added to the team`,
        "Role and unit access assigned by the facility administrator.",
      );
      return account;
    },
    updateEmployee(user: User, id: string, status: User["status"]) {
      const actor = manage(user);
      if (id === actor.id)
        return fail(409, "You cannot suspend your own account.");
      const employee = users.find(
        (u) => u.id === id && u.facilityId === actor.facilityId,
      );
      if (!employee) return fail(404, "Employee not found in your facility.");
      employee.status = status;
      audit(
        actor,
        `${employee.name}: access ${status.toLowerCase()}`,
        "Employee access updated by the facility administrator.",
      );
      return publicUser(employee);
    },
    workspace(user: User) {
      const actor = clinical(user);
      const workspace = workspaces.get(actor.facilityId!);
      if (!workspace) return fail(404, "Workspace not found.");
      return { ...structuredClone(workspace), facilityId: actor.facilityId };
    },
    transition(user: User, id: string, next: ActionStatus, version: number) {
      const actor = clinical(user),
        workspace = workspaces.get(actor.facilityId!)!;
      const action = workspace.actions.find((a) => a.id === id);
      if (!action) return fail(404, "Action not found in your facility.");
      if (!canWorkAction(actor.role, action.ownerRole))
        return fail(403, "This action belongs to another clinical role.");
      try {
        const updated = transitionAction(
          action,
          next,
          version,
          actor.name,
          new Date().toISOString(),
        );
        workspace.actions = workspace.actions.map((a) =>
          a.id === id ? updated : a,
        );
        audit(
          actor,
          "Clinical action updated",
          "Versioned transition retained in the encounter history.",
        );
        return structuredClone(updated);
      } catch (e) {
        return fail(409, e instanceof Error ? e.message : "Action conflict.");
      }
    },
    admit(user: User, input: unknown) {
      const actor = clinical(user);
      if (actor.role === "allied_health")
        return fail(403, "Admission requires a doctor or nurse account.");
      const data = admissionInputSchema.parse(input),
        workspace = workspaces.get(actor.facilityId!)!;
      const bed = Number(data.bed);
      if (bed < 1 || bed > workspace.capacity[data.unit])
        return fail(422, "Choose a bed configured for this unit.");
      if (
        workspace.patients.some(
          (p) => p.mrn.toLowerCase() === data.mrn.toLowerCase(),
        )
      )
        return fail(409, "An active encounter already uses this identifier.");
      if (
        workspace.patients.some(
          (p) => p.unit === data.unit && Number(p.bed) === bed,
        )
      )
        return fail(409, "That bed already has an active encounter.");
      const patient = {
        ...data,
        bed: String(bed).padStart(2, "0"),
        id: randomUUID(),
        initials: data.name
          .split(/\s+/)
          .slice(0, 2)
          .map((x) => x[0])
          .join("")
          .toUpperCase(),
        day: 1,
        concern: "Admission assessment pending",
        support: "Not recorded",
        review: "Due" as const,
        observations: [],
      };
      workspace.patients.push(patient);
      audit(
        actor,
        "New synthetic encounter admitted",
        "Patient identity and bed association captured in the facility workspace.",
      );
      return structuredClone(patient);
    },
  };
}
