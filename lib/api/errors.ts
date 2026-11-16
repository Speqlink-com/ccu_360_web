import { descriptions } from "./error-messages";
import { safeValidationIssues, type ValidationIssue } from "./problem-contract";
export { safeValidationIssues, type ValidationIssue } from "./problem-contract";

export class ApiError extends Error {
  readonly issues: ValidationIssue[];
  constructor(
    public status: number,
    message: string,
    public requestId?: string,
    public code?: string,
    issues: unknown = [],
    public retryAfterSeconds?: number,
    public outcomeUnknown = false,
    public path?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.issues = safeValidationIssues(issues);
  }
}
const labels: Record<string, string> = {
  display_name: "Full name",
  name: "Name",
  code: "Code",
  email: "Email address",
  admin_email: "Administrator’s email",
  admin_name: "Administrator’s name",
  password: "Password",
  new_password: "New password",
  current_password: "Current password",
  token: "Security link",
  challenge_token: "Verification",
  refresh_token: "Session",
  definition: "Form definition",
  stages: "Stages",
  sections: "Sections",
  fields: "Fields",
  key: "Identifier",
  label: "Label",
  type: "Field type",
  choices: "Choices",
  identity_roles: "Eligible professions",
  capabilities: "Responsibilities",
  role_ids: "Responsible care teams",
  role_id: "Care-team role",
  acting_role_id: "Acting care-team role",
  receiving_role_id: "Receiving team",
  department_id: "Department",
  membership_id: "Employee",
  membership_ids: "Participants",
  brand_id: "Facility branding",
  template_id: "Journey form",
  patient_id: "Patient",
  identifier: "Patient identifier",
  date_of_birth: "Date of birth",
  starts_at: "Start time",
  ends_at: "End time",
  due_at: "Due time",
  admitted_at: "Admission time",
  observed_at: "Observation time",
  expected_version: "Record version",
  expected_revision: "Record revision",
  reason: "Change reason",
  values: "Clinical fields",
  value: "Value",
  body: "Message",
  cidr: "Public WAN address / CIDR",
  radius_meters: "Site radius",
  latitude: "Latitude",
  longitude: "Longitude",
  accuracy_meters: "Location accuracy",
  primary_color: "Primary colour",
  accent_color: "Accent colour",
  title: "Title",
  comment: "Comment",
  availability: "Availability",
  organization_id: "Facility",
  max_accuracy_meters: "Maximum location uncertainty",
  grant_seconds: "Location approval duration",
  attestation: "Attestation",
  approved: "Publication approval",
  source_reference: "Source reference",
  sha256: "Document checksum",
};
export function issueLabel(issue: ValidationIssue) {
  const segments: string[] = [];
  for (const part of issue.path) {
    if (typeof part === "number") {
      const last = segments.pop() ?? "Item";
      const stageNames = [
        "Admission 360",
        "Patient / Clinical 360",
        "Round 360",
        "Connect 360",
        "Action 360",
        "Review 360",
        "Handover 360",
        "Event 360",
        "Output 360",
      ];
      segments.push(
        last === "Stages" && part < stageNames.length
          ? stageNames[part]
          : `${last.replace(/s$/, "")} ${part + 1}`,
      );
    } else if (part !== "definition" || issue.path.length === 1) {
      segments.push(
        labels[part] ??
          part
            .replaceAll("_", " ")
            .replace(/^./, (letter) => letter.toUpperCase()),
      );
    }
  }
  return segments.join(" · ") || "Form";
}
export function issueMessage(issue: ValidationIssue, path = ""): string {
  const key = issue.path.at(-1);
  if (["token", "challenge_token", "refresh_token"].includes(String(key)))
    return "This security link or verification is invalid. Open the complete email link or sign in again.";
  if (["expected_version", "expected_revision"].includes(String(key)))
    return "Reload the latest record before submitting this change again.";
  const min = issue.params?.min,
    max = issue.params?.max;
  switch (issue.code) {
    case "section_team_required":
      return "Assign a responsible care-team role to this enabled section.";
    case "section_team_unavailable":
      return "Choose an active compatible team in an active department.";
    case "section_team_permissions":
      return "Assign a team with read, document and attest permissions.";
    case "stage_section_required":
      return "Enable at least one professional section in this stage.";
    case "required":
      return "Complete this field.";
    case "too_short":
      return min === undefined
        ? "Enter a longer value."
        : `Use at least ${min} characters.`;
    case "too_long":
      return max === undefined
        ? "Shorten this value."
        : `Use no more than ${max} characters.`;
    case "too_few_items":
      return `Choose at least ${min ?? 1} item${min === 1 ? "" : "s"}.`;
    case "too_many_items":
      return max === undefined
        ? "Choose fewer items."
        : `Choose no more than ${max} items.`;
    case "invalid_email":
      return "Enter a valid email address, such as name@hospital.org.";
    case "invalid_selection":
    case "invalid_choice":
      return "Choose an available option.";
    case "invalid_boolean":
      return "Choose yes or no.";
    case "invalid_number":
    case "finite_number":
      return "Enter a valid, finite number.";
    case "minimum":
      return `Enter ${min ?? "the minimum"} or more.`;
    case "maximum":
      return `Enter ${max ?? "the maximum"} or less.`;
    case "greater_than":
      return `Enter a value greater than ${min ?? "the minimum"}.`;
    case "less_than":
      return `Enter a value below ${max ?? "the maximum"}.`;
    case "invalid_date":
      return "Choose a valid calendar date.";
    case "invalid_time":
      return "Choose a valid time.";
    case "invalid_datetime":
      return "Choose a valid date and time.";
    case "timezone_required":
      return "Choose a date and time with a time zone.";
    case "name_invalid":
      return "Enter a readable name of at least two characters.";
    case "assignment_interval":
      return "The assignment end must be later than its start.";
    case "choices_required":
      return "Add at least one choice and remove duplicate choices.";
    case "choices_invalid":
      return "Use distinct, non-empty choices of no more than 120 characters.";
    case "choices_not_allowed":
      return "Only selection fields can contain choices.";
    case "value_required":
      return "Enter the value, or record why it is unavailable.";
    case "unavailable_reason_required":
      return "Explain why the information is unavailable and leave its value empty.";
    case "group_title_required":
      return "Enter a title for the group discussion.";
    case "direct_title_forbidden":
      return "Direct discussions use participant names. Remove the group title.";
    case "unexpected_field":
      return "This form contains an unsupported field. Reload the page before submitting again.";
    case "invalid_format":
      if (key === "code" && path.includes("workforce"))
        return "Use 2–40 lowercase letters, numbers or underscores, starting with a letter.";
      if (key === "code" && path.includes("identity/providers"))
        return "Use 2–40 uppercase letters, numbers, underscores or hyphens.";
      if (key === "code" && path.includes("auth/"))
        return "Enter the six-digit authenticator code.";
      if (key === "key")
        return "Use 2–50 lowercase letters, numbers or underscores, starting with a letter.";
      if (key === "primary_color" || key === "accent_color")
        return "Choose a valid six-digit colour.";
      return "Check this field’s format.";
    default:
      return "Check this field and enter a valid value.";
  }
}
export function describeProblem(
  status: number,
  code: string | undefined,
  issues: ValidationIssue[],
  retryAfter?: number,
) {
  if (status === 429)
    return retryAfter
      ? `Too many requests. Wait ${retryAfter < 60 ? `${retryAfter} seconds` : `${Math.ceil(retryAfter / 60)} minutes`} before trying again.`
      : "Too many requests. Wait a moment before trying again.";
  if (issues.length)
    return code === "template_not_ready_for_publication"
      ? descriptions[code]
      : "Review the fields below, then submit again.";
  if (code && descriptions[code]) return descriptions[code];
  if (code?.startsWith("current_team_role_with_") && code.endsWith("_required"))
    return "Your current care-team role does not include this responsibility. Ask your facility administrator to review your assignment.";
  if (status === 401)
    return "Your session has expired. Sign in again to continue.";
  if (status === 403)
    return "Your current role does not permit this action. Contact your facility administrator.";
  if (status === 404)
    return "This record is unavailable in your current workspace. Refresh the list before continuing.";
  if (status === 409)
    return "This change conflicts with the current record. Reload it and review the latest information before trying again.";
  if (status === 422 || status === 400)
    return "Some information needs attention. Review this form and try again.";
  if (status >= 500)
    return "The service is temporarily unavailable. Try loading the record again or contact support if the problem continues.";
  return "This action could not be completed. Review the information and try again.";
}
export function errorHeading(error: Error) {
  if (!(error instanceof ApiError)) return "This action needs attention";
  if (error.issues.length) return "Check the form details";
  if (error.status === 0) return "Connection interrupted";
  if (error.status === 408 || error.status === 504)
    return "The request timed out";
  if (error.status === 401) return "Sign-in required";
  if (error.status === 403) return "Access required";
  if (error.status === 404) return "Record unavailable";
  if (error.status === 429) return "Please wait before trying again";
  if (error.status >= 500) return "The service could not complete this action";
  return "This change needs attention";
}
