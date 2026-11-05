import { test } from "node:test";
import assert from "node:assert/strict";
import { createControlPlane, DemoError } from "../lib/demo/control-plane";
import { demoAccounts } from "../lib/demo/accounts";
const account = (email: string) => demoAccounts.find((u) => u.email === email)!;
const user = (id: string) => {
  const { password, ...u } = demoAccounts.find((u) => u.id === id)!;
  void password;
  return u;
};
const newFacility = {
  name: "Summit Demo Hospital",
  city: "Mombasa",
  type: "Hospital",
  contactEmail: "office@summit.ccu360.test",
  adminName: "Demo Owner",
  adminEmail: "admin@summit.ccu360.test",
  icuBeds: 4,
  hduBeds: 2,
};
const denied = (fn: () => unknown, status: number) =>
  assert.throws(fn, (e) => e instanceof DemoError && e.status === status);

test("demo login returns a sanitized session; logout and expiry revoke access", () => {
  const db = createControlPlane(),
    u = account("comphortine@ayothealthsolutions.ke"),
    now = Date.now();
  const result = db.login(u.email, u.password, now);
  assert.equal(result.session.user.role, "ahs_admin");
  assert.ok(!("password" in result.session.user));
  assert.ok(!("digest" in result.session.user));
  assert.equal(db.session(result.token, now)?.user.id, u.id);
  assert.equal(db.session(result.token, now + 9 * 60 * 60_000), null);
  const again = db.login(u.email, u.password);
  db.logout(again.token);
  assert.equal(db.session(again.token), null);
});
test("invalid credentials use one error and rate-limit repeated failures", () => {
  const db = createControlPlane(),
    email = "admin@evergreen.ccu360.test",
    now = Date.now();
  for (let i = 0; i < 5; i++) denied(() => db.login(email, "wrong", now), 401);
  denied(() => db.login(email, "Evergreen!360", now), 429);
  assert.equal(
    db.login(email, "Evergreen!360", now + 16 * 60_000).session.user.role,
    "facility_admin",
  );
});
test("facility membership comes from the stored identity; patient data does not cross tenants", () => {
  const db = createControlPlane();
  const evergreen = user("usr-evergreen-doctor"),
    cedar = user("usr-cedar-doctor");
  const a = db.workspace(evergreen),
    b = db.workspace(cedar);
  assert.equal(a.facilityId, "fac-evergreen");
  assert.equal(b.facilityId, "fac-cedar");
  assert.ok(!b.patients.some((p) => a.patients.some((q) => p.id === q.id)));
  assert.equal(
    db.workspace({ ...evergreen, facilityId: "fac-cedar" }).facilityId,
    "fac-evergreen",
  );
  denied(() => db.transition(cedar, a.actions[0].id, "in_progress", 1), 404);
});
test("AHS and facility admins cannot read clinical records; clinical roles cannot manage employees", () => {
  const db = createControlPlane();
  denied(() => db.workspace(user("usr-ahs")), 403);
  denied(() => db.workspace(user("usr-evergreen-admin")), 403);
  denied(
    () =>
      db.addEmployee(user("usr-evergreen-nurse"), {
        name: "Demo User",
        email: "new@demo.test",
        role: "doctor",
        unit: "ICU",
      }),
    403,
  );
  denied(() => db.onboard(user("usr-evergreen-admin"), newFacility), 403);
});
test("AHS onboarding creates an isolated workspace and a usable facility administrator account", () => {
  const db = createControlPlane();
  const result = db.onboard(user("usr-ahs"), newFacility);
  const session = db.login(result.user.email, result.temporaryPassword).session;
  assert.equal(session.user.facilityId, result.facility.id);
  assert.equal(db.directory(session.user).facilities.length, 1);
  assert.equal(db.directory(session.user).employees.length, 1);
  assert.equal(db.directory(session.user).summaries[0].patients, 0);
  assert.ok(!("digest" in result.user));
});
test("facility admin provisions staff only in their own facility and cannot grant AHS access", () => {
  const db = createControlPlane(),
    admin = user("usr-evergreen-admin");
  const result = db.addEmployee(admin, {
    name: "Demo Clinician",
    email: "new@evergreen.ccu360.test",
    role: "doctor",
    unit: "ICU",
    facilityId: "fac-cedar",
  });
  assert.equal(result.user.facilityId, "fac-evergreen");
  assert.equal(
    db.login(result.user.email, result.temporaryPassword).session.user.role,
    "doctor",
  );
  assert.throws(() =>
    db.addEmployee(admin, {
      name: "Bad Escalation",
      email: "escalation@demo.test",
      role: "ahs_admin",
      unit: "ICU",
    }),
  );
  denied(() => db.updateEmployee(admin, "usr-cedar-doctor", "Suspended"), 404);
  denied(() => db.updateEmployee(admin, admin.id, "Suspended"), 409);
});
test("employee and facility suspension invalidate existing sessions", () => {
  const db = createControlPlane();
  const nurse = account("nurse@evergreen.ccu360.test");
  const token = db.login(nurse.email, nurse.password).token;
  db.updateEmployee(user("usr-evergreen-admin"), nurse.id, "Suspended");
  assert.equal(db.session(token), null);
  const cedar = account("doctor@cedar.ccu360.test"),
    t = db.login(cedar.email, cedar.password).token;
  db.updateFacility(user("usr-ahs"), "fac-cedar", "Suspended");
  assert.equal(db.session(t), null);
  denied(() => db.login(cedar.email, cedar.password), 403);
});
test("clinical action writes enforce role ownership and preserve the actual actor", () => {
  const db = createControlPlane(),
    nurse = user("usr-evergreen-nurse");
  denied(() => db.transition(nurse, "act-1", "in_progress", 1), 403);
  const completed = db.transition(nurse, "act-2", "completed", 1);
  assert.equal(completed.history.at(-1)?.actor, nurse.name);
  assert.equal(completed.version, 2);
  denied(() => db.transition(nurse, "act-2", "completed", 1), 409);
});
test("admission validates facility bed ownership and duplicate encounters; allied roles cannot admit", () => {
  const db = createControlPlane(),
    doctor = user("usr-evergreen-doctor");
  const input = {
    name: "Synthetic New Patient",
    mrn: "DEMO-099",
    age: 40,
    sex: "Unknown",
    unit: "ICU",
    bed: "03",
  };
  const patient = db.admit(doctor, input);
  assert.equal(patient.observations.length, 0);
  assert.equal(db.workspace(doctor).patients.length, 6);
  assert.equal(db.workspace(user("usr-cedar-doctor")).patients.length, 2);
  denied(() => db.admit(doctor, { ...input, mrn: "DEMO-100" }), 409);
  denied(() => db.admit(doctor, { ...input, mrn: "DEMO-101", bed: "99" }), 422);
  denied(
    () =>
      db.admit(user("usr-evergreen-allied"), {
        ...input,
        mrn: "DEMO-102",
        bed: "05",
      }),
    403,
  );
});
