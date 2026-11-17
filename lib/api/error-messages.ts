export const descriptions: Record<string, string> = {
  patient_registration_permission_required:
    "Your team cannot register patients. Reception or a team with Register patients can create the patient record.",
  journey_initialization_permission_required:
    "You need a current intake team assignment to start a journey. Ask your administrator to assign you to a team on the published form.",
  template_intake_role_required:
    "This form has a different intake team. Select a form your team can start, or ask your administrator to review its intake teams.",
  template_requires_intake_team_and_sections:
    "Link a team, enable Can start journey for an intake team, and add at least one section before publishing.",
  intake_teams_must_be_linked:
    "Link each intake team to the form before allowing it to start journeys.",
  intake_team_requires_registration_or_admission:
    "An intake team needs Register patients for reception, or Open journeys for clinical intake.",
  active_template_team_required:
    "A linked team or its department is inactive. Restore it or remove it from this draft before publishing.",
  section_writers_must_be_linked_teams:
    "Link each section writer to its section before saving.",
  profession_required:
    "Choose a protected identity category or a facility profession for this team.",
  responsibility_required: "Choose at least one responsibility for this team.",
  profession_requires_a_protected_identity_category:
    "Choose the protected identity category for this profession. Set actions on responsibilities and teams.",
  responsibility_requires_platform_actions:
    "Choose at least one system action for this responsibility.",
  active_profession_required: "Choose an active facility profession.",
  active_responsibility_required: "Choose an active facility responsibility.",
  profession_must_match_employee_identity_category:
    "Choose a profession matching the employee’s identity category. Change the employee’s identity role first if their job has changed.",
  audit_roles_are_read_only:
    "Audit teams may read and export covered records. Choose a clinical or reception category for writing responsibilities.",
  staff_unavailable:
    "Your availability or profession is inactive. Ask your facility administrator to review Staff availability and your profession designation.",
  only_another_authors_current_draft_can_be_taken_over:
    "Only another employee’s current unsigned draft can be taken over. Refresh the ledger to review its latest version.",
  worksite_location_required:
    "Verify your location at the facility to continue.",
  outside_facility_geofence:
    "Your location is outside the facility boundary. Move inside and try again.",
  more_accurate_location_required:
    "A more accurate location is needed. Enable precise location and try again.",
  fresh_location_required:
    "That location reading is too old. Please check again.",
  location_challenge_invalid_or_expired:
    "The location check expired. Please try again.",
  worksite_configuration_changed:
    "Your facility’s access settings changed. Reload them and try again.",
  cannot_remove_last_enabled_geofence:
    "Add another active site or disable enforcement before deactivating this site.",
  specific_public_facility_network_required:
    "Enter a specific public WAN range, such as your facility’s public IP followed by /32.",
  invalid_network_forwarding_proof:
    "The connection could not be verified. Contact your administrator.",
  active_authorized_participants_required:
    "Choose active colleagues who are authorized for this discussion.",
  conversation_not_found: "This conversation is no longer available to you.",
  message_revision_changed:
    "The message changed. Review its latest version before trying again.",
  message_edit_not_permitted:
    "You can only edit your own messages within the editing window.",
  last_conversation_owner_required:
    "Promote another active owner before removing the last owner.",
  active_conversation_owner_exists:
    "This group still has an active owner. Ask them to manage the group.",
  websocket_origin_not_allowed:
    "Realtime messaging is unavailable on this web address. Use your approved facility portal.",
  invalid_credentials:
    "The email or password is incorrect, or this account is unavailable.",
  invalid_mfa_code:
    "That code could not be verified. Use a fresh authenticator code or an unused recovery code.",
  invalid_or_expired_token:
    "This link is invalid or has expired. Request a new invitation or recovery email.",
  password_too_common:
    "Choose a less common password with at least 12 characters.",
  password_contains_email_name:
    "Choose a password that does not contain your email name.",
  password_recently_used: "Choose a password you have not used recently.",
  password_must_be_12_to_128_characters:
    "Use a password between 12 and 128 characters.",
  invalid_current_password: "Your current password is incorrect.",
  provider_code_exists: "That facility code is already in use.",
  membership_exists: "This person already belongs to the facility.",
  use_a_separate_ahs_administrator_account:
    "Use a separate email for an AHS administrator account.",
  ahs_account_cannot_be_a_clinical_member:
    "AHS administrators need a separate account for clinical work.",
  cannot_remove_last_provider_administrator:
    "Add another active facility administrator before removing the last one.",
  cannot_disable_last_provider_administrator:
    "This person is the facility’s last active administrator.",
  cannot_disable_last_ahs_administrator:
    "The platform must retain an active AHS administrator.",
  cannot_change_own_account_status:
    "Ask another AHS administrator to change your account status.",
  invitation_must_be_accepted:
    "This invitation must be accepted before access can be changed.",
  current_admitting_or_reading_team_role_required:
    "Your facility administrator needs to assign you to an active care team.",
  current_team_role_required:
    "Your facility administrator needs to assign you to an active care team.",
  mfa_enrollment_expired: "MFA setup expired. Sign in again to restart.",
  ledger_version_conflict:
    "Another team member updated this journey. Refresh it and review the latest information before saving again.",
  encounter_version_conflict:
    "The journey changed. Review the latest information and try again.",
  field_value_type_or_option_invalid:
    "Check the field values and selected options.",
  required_field_or_explicit_unavailable_reason_missing:
    "Complete required fields or record why the information is unavailable.",
  section_responsibility_required: "This section belongs to another care team.",
  service_unavailable:
    "The service is temporarily unavailable. Please try again.",
  same_origin_required: "Reload this page before continuing.",
};

Object.assign(descriptions, {
  template_not_ready_for_publication:
    "This form needs changes before it can be published. Open the draft and review the listed stages and sections.",
  invalid_request:
    "Some information needs attention. Review this form and try again.",
  invalid_or_ambiguous_json:
    "This form could not be read. Reload the page, then enter your changes again.",
  department_code_exists:
    "A department already uses this code. Choose another code or edit the existing department.",
  team_role_code_exists:
    "A care-team role already uses this code. Choose another code or edit the existing role.",
  configuration_version_conflict:
    "Another administrator changed these settings. Reload the latest version and review it before saving your changes again.",
  authorization_changed_retry_request:
    "Your access changed while this request was being processed. Refresh your workspace before continuing.",
  department_inactive:
    "This department is archived. Restore it or choose an active department.",
  overlapping_assignment_for_same_employee_and_role:
    "This employee already has an active assignment to this role during those dates. Edit that assignment or choose a non-overlapping period.",
  assignment_end_must_follow_start:
    "The assignment must end after its start time. Check both dates and times.",
  assignment_requires_active_compatible_member_and_role:
    "Choose an active employee and role with compatible professions. Suspended employees and archived roles cannot receive assignments.",
  clinical_capabilities_require_a_clinical_profession:
    "Clinical documentation and signing responsibilities can only be assigned to doctors, nurses or allied health staff. Separate reception and audit duties into their own roles.",
  clinical_read_capabilities_require_clinical_or_audit_profession:
    "Patient-record access is available to clinical staff and clinical auditors. Remove reception staff from this role or remove its clinical reading permissions.",
  each_stage_requires_an_enabled_section:
    "Every journey stage needs at least one enabled section. Enable a section in each stage before publishing.",
  enabled_section_requires_a_responsible_team_role:
    "Assign at least one responsible care-team role to every enabled section before publishing.",
  enabled_section_requires_a_role_that_can_write_and_attest:
    "Each enabled section needs an authorized writing team. If attestation is enabled, every writing team also needs Attest notes.",
  section_role_profession_mismatch_or_inactive:
    "An assigned team is archived, belongs to an archived department or has incompatible professions. Remove its mapping and choose an active compatible team.",
  active_brand_required:
    "This branding version is archived. Choose active branding or restore the version before saving or publishing.",
  active_template_required:
    "This form version is archived or retired. Restore it before publishing.",
  active_template_and_brand_required:
    "The form or its branding is archived. Restore both, or select active branding before validating the form.",
  only_active_drafts_can_be_edited:
    "Only active drafts can be edited. Clone a published version, or restore an archived draft first.",
  template_already_published:
    "This form has already been published. Clone it to make changes in a new draft.",
  published_template_required:
    "Choose an active published form. Draft, archived and retired forms cannot be used to open new journeys.",
  canonical_journey_stages_must_be_preserved:
    "Keep all nine standard journey stages in their original order.",
  canonical_fields_must_be_preserved:
    "Standard clinical fields must retain their original keys and types. Add a custom field for additional information.",
  canonical_required_fields_must_be_preserved:
    "Standard required fields cannot be made optional.",
  canonical_professional_ownership_must_be_preserved:
    "Standard professional sections must keep their original professions. Add a custom section for another professional team.",
  section_keys_must_be_unique:
    "Two sections use the same identifier. Give each section a distinct key.",
  field_keys_must_be_unique:
    "Two fields in a section use the same identifier. Give each field a distinct key.",
  template_field_limit_exceeded:
    "This form exceeds the 500-field limit. Remove unused custom fields before saving.",
  profession_required:
    "Choose at least one eligible profession for every enabled section.",
  select_an_explicit_acting_role:
    "Choose the care-team role you are acting in before submitting this entry.",
  acting_role_is_not_authorized_for_this_operation:
    "The selected acting role cannot perform this action. Choose an authorized care-team role.",
  acting_role_must_match_receiving_team_role:
    "Choose the same acting role as the receiving team for this handover.",
  section_owned_by_another_profession_or_team:
    "This section belongs to another professional team. Choose a section assigned to your current care-team role.",
  creator_must_have_an_admitting_care_team_role:
    "Include your current admitting care-team role when opening the journey.",
  active_care_role_with_read_permission_required:
    "Choose active care-team roles with patient-record reading permissions.",
  active_care_team_task_role_required:
    "Choose an active care-team role that can manage actions.",
  active_task_capable_care_team_role_required:
    "The selected team cannot receive this action. Choose an active team with action-management permission.",
  encounter_closed:
    "This journey is closed. Its records remain available, but new documentation and changes cannot be added.",
  entry_revision_conflict:
    "A newer version of this entry exists. Refresh the journey and work from the latest revision.",
  only_the_author_can_attest_their_current_draft:
    "Only the original author can attest the latest draft of their note. Refresh the journey to review its current version.",
  attestation_reauthentication_failed:
    "Your password could not be confirmed. Re-enter your current sign-in password to attest this record.",
  cannot_edit_another_authors_draft_or_correct_without_permission:
    "You cannot amend this draft. Ask its author to update it, or use an authorized correction workflow.",
  correction_must_preserve_section_and_record_kind:
    "An amendment must stay in the original section and keep the same documentation type.",
  correction_reason_required:
    "Enter a reason for the amendment so the original record and its correction remain traceable.",
  field_not_in_pinned_section_definition:
    "A submitted field is not part of this journey’s approved form. Refresh the journey before documenting again.",
  date_of_birth_cannot_be_in_future:
    "Date of birth cannot be in the future. Check the selected date.",
  invalid_observation_reference:
    "Choose a valid shared observation from this journey.",
  observation_belongs_to_another_encounter:
    "This observation belongs to a different journey. Choose an observation recorded in the current encounter.",
  observation_already_superseded:
    "This observation already has a newer revision. Refresh the observations and amend the latest one.",
  observation_correction_scope_mismatch:
    "Correct an observation within its original encounter and measurement type.",
  observation_requires_a_bounded_scalar_value:
    "Enter a single measurement, yes/no value or short text for this observation.",
  entry_values_maximum_32_kib:
    "This entry is too large. Shorten the documentation or split it into separate attributed entries.",
  attested_handover_entry_required:
    "Choose an attested handover note before acknowledging receipt.",
  handover_entry_has_newer_attested_revision:
    "This handover has a newer attested revision. Refresh the journey and acknowledge the latest one.",
  outgoing_author_cannot_acknowledge_own_handover:
    "The receiving professional must acknowledge this handover using their own account.",
  task_belongs_to_another_team:
    "This action belongs to another care team. Ask the responsible team or an authorized coordinator to update it.",
  task_owner_must_be_a_care_team_role:
    "Assign this action to a care-team role included in the patient’s journey.",
  task_source_must_belong_to_encounter:
    "Link this action to documentation from the same patient journey.",
  invalid_task_transition:
    "This status change is not allowed from the action’s current state. Refresh the action and choose an available next status.",
  terminal_task_cannot_be_reassigned:
    "Completed, cancelled and unable-to-complete actions cannot be reassigned. Create a new action if further work is needed.",
  case_export_permission_required:
    "Your current care-team role does not allow ledger exports. Ask your facility administrator for the appropriate responsibility.",
  care_management_permission_required:
    "Your current care-team role does not allow changes to patient care coverage.",
  encounter_closure_permission_required:
    "Your current care-team role does not allow closing journeys.",
  observation_permission_required:
    "Your current care-team role does not allow recording observations.",
  observation_correction_permission_required:
    "Your current care-team role does not allow correcting observations.",
  observation_verification_permission_required:
    "Your current care-team role does not allow verifying observations.",
  task_permission_required:
    "Your current care-team role does not allow creating or updating actions.",
  task_reassignment_permission_required:
    "Your current care-team role does not allow reassigning actions.",
  receiving_team_attestation_permission_required:
    "Choose a receiving care-team role authorized to attest handovers.",
  select_provider_first: "Choose a facility workspace before continuing.",
  provider_administrator_required:
    "A facility administrator must perform this action.",
  provider_administrator_mfa_required:
    "Sign in as a facility administrator and complete two-step verification to manage these settings.",
  ahs_administrator_mfa_required:
    "Sign in as an AHS administrator and complete two-step verification to continue.",
  administrators_must_keep_mfa_enabled:
    "Administrator accounts must keep two-step verification enabled.",
  mfa_sign_in_required: "Complete two-step verification before continuing.",
  mfa_already_enrolled:
    "Two-step verification is already enabled. Refresh your security settings.",
  current_password_required:
    "Enter your current password to continue with this security change.",
  only_pending_invitations_can_be_revoked:
    "Only pending invitations can be revoked. Manage the person’s facility access if they have already accepted.",
  only_pending_ahs_invitations_can_be_revoked:
    "Only pending administrator invitations can be revoked. Manage an active administrator from their account record.",
  provider_suspended:
    "This facility is suspended. Contact AHS to restore access.",
  active_provider_membership_required:
    "Your access to this facility is no longer active. Contact your facility administrator.",
  group_conversation_required:
    "This action is available for group discussions only.",
  conversation_owner_required: "Only a group owner can manage this discussion.",
  conversation_participant_limit:
    "This discussion has reached its participant limit. Remove inactive members before adding another colleague.",
  conversation_participants_invalid:
    "Choose valid, distinct participants from your current facility.",
  participant_not_found:
    "This colleague is no longer a participant. Refresh the discussion.",
  message_not_found:
    "This message is unavailable or is no longer visible to you.",
  message_already_redacted:
    "This message has already been redacted. Refresh the discussion.",
  message_redaction_not_permitted:
    "Only an authorized message author or group owner can redact this message.",
  invalid_communication_cursor:
    "The discussion history changed. Reload it to continue from the latest available messages.",
  visible_message_sequence_required:
    "Choose a message visible in your current discussion before marking it as read.",
  communication_connection_limit:
    "Too many messaging connections are open. Close unused CCU360 tabs and reconnect.",
  communication_connection_expired:
    "The messaging connection expired. Reconnect to receive new updates.",
  communication_session_changed:
    "Your messaging access changed. Refresh your workspace to reconnect.",
  communication_session_expired:
    "Your messaging session expired. Sign in again to reconnect.",
  communication_ticket_invalid:
    "The messaging connection could not be authorized. Refresh the workspace to reconnect.",
  worksite_site_limit_reached:
    "This facility has reached its site limit. Edit or deactivate an existing site before adding another.",
  trusted_network_limit_reached:
    "This facility has reached its trusted-connection limit. Edit or deactivate an existing connection.",
  valid_network_cidr_required:
    "Enter your facility’s public WAN IP followed by /32, or a valid public CIDR range.",
  active_geofence_required:
    "Add and activate a facility site before enabling employee location enforcement.",
  employee_location_check_not_required:
    "Your account does not need an employee location check. Return to your workspace.",
  idempotency_key_conflict:
    "A different change already used this request reference. Refresh the record before starting a new action.",
  request_body_too_large:
    "This submission is too large. Reduce the attachment size or shorten the form content.",
  body_too_large:
    "This submission is too large. Reduce the attachment size or shorten the form content.",
  logo_maximum_2_mib: "Choose a PNG, JPEG or WebP logo no larger than 2 MiB.",
  invalid_logo:
    "This image could not be used as a logo. Choose a valid PNG, JPEG or WebP image.",
  snapshot_requires_archive_export_use_paginated_records:
    "This journey is too large for a standard export. Use its paginated records and contact your administrator for an archive export.",
  evidence_bundle_requires_archive_export:
    "This journey needs an archive export because its evidence history exceeds the standard export limit.",
  ledger_integrity_verification_failed:
    "The journey’s integrity could not be confirmed. Export and attestation were not completed. Contact your administrator with the support reference.",
  output_integrity_verification_failed:
    "This document’s integrity could not be confirmed. Contact your administrator before using the export.",
  message_integrity_verification_failed:
    "This message could not be verified. Contact your administrator before relying on its contents.",
});
for (const code of [
  "authentication_required",
  "invalid_access_token",
  "invalid_enrollment_token",
  "invalid_refresh_token",
  "session_expired_or_revoked",
  "refresh_token_reuse_detected",
])
  descriptions[code] =
    "Your session has expired or changed. Sign in again to continue.";
for (const code of [
  "record_not_found",
  "entry_not_found",
  "section_not_found",
  "task_not_found",
  "output_not_found",
  "membership_not_found",
  "provider_not_found",
  "session_not_found",
  "record_collection_not_found",
  "trusted_network_not_found",
  "worksite_site_not_found",
])
  descriptions[code] =
    "This record is no longer available in your current workspace. Refresh the list or contact your facility administrator.";
for (const code of [
  "database_unavailable_retry_request",
  "schema_migration_required",
  "restricted_runtime_database_role_required",
  "rate_limit_service_unavailable",
  "configuration_lifecycle_missing",
  "verified_provider_authority_scope_required",
  "internal_error",
  "invalid_response",
])
  descriptions[code] =
    "The service could not complete this request. Please try loading the record again or contact support if the problem continues.";

descriptions.valid_png_jpeg_or_webp_logo_required =
  "Choose a valid PNG, JPEG or WebP image with no more than four million pixels.";
descriptions.upstream_timeout =
  "The service took too long to respond. Try loading the record again.";
