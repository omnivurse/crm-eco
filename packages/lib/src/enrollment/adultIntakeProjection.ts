/**
 * Adult Intake write projection — one interface for mapping AdultIntake-shaped
 * data onto members columns, enrollment snapshot, and custom_fields.
 */

export interface AdultIntakeProjectionInput {
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth?: string | null;
  phone?: string | null;
  phone_cell?: string | null;
  phone_home?: string | null;
  phone_work?: string | null;
  leave_message_home?: boolean | null;
  leave_message_work?: boolean | null;
  leave_message_cell?: boolean | null;
  preferred_contact?: string | null;
  may_contact_email?: boolean | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  relationship_status?: string | null;
  referral_source?: string | null;
  emergency_contact?: {
    name: string;
    relationship: string;
    phone: string;
    address?: string;
  } | null;
}

export interface MemberInsertProjection {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  phone2: string | null;
  date_of_birth: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
}

export interface AdultIntakeSnapshotFields {
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth?: string;
  phone?: string;
  phone_cell?: string;
  phone_home?: string;
  phone_work?: string;
  leave_message_home?: boolean;
  leave_message_work?: boolean;
  leave_message_cell?: boolean;
  preferred_contact?: string;
  may_contact_email?: boolean;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  relationship_status?: string;
  referral_source?: string;
  emergency_contact?: AdultIntakeProjectionInput['emergency_contact'];
}

function trimOrNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/** Primary phone for members.phone (cell → home → work → phone). */
export function resolvePrimaryPhone(input: AdultIntakeProjectionInput): string | null {
  return (
    trimOrNull(input.phone_cell) ||
    trimOrNull(input.phone) ||
    trimOrNull(input.phone_home) ||
    trimOrNull(input.phone_work)
  );
}

/** Project Adult Intake onto a members insert/update patch. */
export function projectAdultIntakeToMember(
  input: AdultIntakeProjectionInput
): MemberInsertProjection {
  const primary = resolvePrimaryPhone(input);
  const secondary =
    trimOrNull(input.phone_home) && trimOrNull(input.phone_home) !== primary
      ? trimOrNull(input.phone_home)
      : trimOrNull(input.phone_work) !== primary
        ? trimOrNull(input.phone_work)
        : null;

  return {
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.toLowerCase().trim(),
    phone: primary,
    phone2: secondary,
    date_of_birth: trimOrNull(input.date_of_birth ?? undefined),
    address_line1: trimOrNull(input.address_line1 ?? undefined),
    address_line2: trimOrNull(input.address_line2 ?? undefined),
    city: trimOrNull(input.city ?? undefined),
    state: trimOrNull(input.state ?? undefined),
    postal_code: trimOrNull(input.zip_code ?? undefined),
  };
}

/** Snapshot.intake shape (denormalized wizard copy). */
export function projectAdultIntakeToSnapshot(
  input: AdultIntakeProjectionInput
): AdultIntakeSnapshotFields {
  const phone = resolvePrimaryPhone(input) ?? undefined;
  return {
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.toLowerCase().trim(),
    date_of_birth: trimOrNull(input.date_of_birth ?? undefined) ?? undefined,
    phone,
    phone_cell: trimOrNull(input.phone_cell ?? undefined) ?? undefined,
    phone_home: trimOrNull(input.phone_home ?? undefined) ?? undefined,
    phone_work: trimOrNull(input.phone_work ?? undefined) ?? undefined,
    leave_message_home: input.leave_message_home ?? undefined,
    leave_message_work: input.leave_message_work ?? undefined,
    leave_message_cell: input.leave_message_cell ?? undefined,
    preferred_contact: input.preferred_contact ?? undefined,
    may_contact_email: input.may_contact_email ?? undefined,
    address_line1: (input.address_line1 ?? '').trim(),
    address_line2: trimOrNull(input.address_line2 ?? undefined) ?? undefined,
    city: (input.city ?? '').trim(),
    state: (input.state ?? '').trim(),
    zip_code: (input.zip_code ?? '').trim(),
    relationship_status: trimOrNull(input.relationship_status ?? undefined) ?? undefined,
    referral_source: trimOrNull(input.referral_source ?? undefined) ?? undefined,
    emergency_contact: input.emergency_contact ?? undefined,
  };
}

/** Contact / emergency metadata for enrollments.custom_fields. */
export function projectAdultIntakeToCustomFields(
  input: AdultIntakeProjectionInput
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.preferred_contact) out.preferred_contact = input.preferred_contact;
  if (input.may_contact_email != null) out.may_contact_email = input.may_contact_email;
  if (input.leave_message_home != null) out.leave_message_home = input.leave_message_home;
  if (input.leave_message_work != null) out.leave_message_work = input.leave_message_work;
  if (input.leave_message_cell != null) out.leave_message_cell = input.leave_message_cell;
  if (input.relationship_status) out.relationship_status = input.relationship_status;
  if (input.referral_source) out.referral_source = input.referral_source;
  if (input.emergency_contact?.name) {
    out.emergency_contact = {
      name: input.emergency_contact.name,
      relationship: input.emergency_contact.relationship,
      phone: input.emergency_contact.phone,
      ...(input.emergency_contact.address
        ? { address: input.emergency_contact.address }
        : {}),
    };
  }
  return out;
}

export interface HouseholdDependentInput {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  relationship: string;
  lives_at_home?: boolean;
  ssn_last4?: string;
}

const DEPENDENT_RELATIONSHIP_LABELS = {
  spouse: 'Spouse',
  child: 'Child',
  dependent: 'Dependent',
} as const;

/**
 * Convert wizard relationship values to the title-case labels enforced by the
 * live dependents table while leaving unknown values unchanged for DB validation.
 */
function normalizeDependentRelationship(relationship: string): string {
  const trimmed = relationship.trim();
  const key = trimmed.toLowerCase() as keyof typeof DEPENDENT_RELATIONSHIP_LABELS;
  return DEPENDENT_RELATIONSHIP_LABELS[key] ?? trimmed;
}

/** Map wizard household rows to dependents table inserts (before enrollment_dependents). */
export function projectHouseholdToDependentRows(
  organizationId: string,
  memberId: string,
  household: HouseholdDependentInput[]
): Array<Record<string, unknown>> {
  return household.map((h) => ({
    organization_id: organizationId,
    member_id: memberId,
    first_name: h.first_name.trim(),
    last_name: h.last_name.trim(),
    date_of_birth: h.date_of_birth,
    relationship: normalizeDependentRelationship(h.relationship),
    same_address_as_member: h.lives_at_home !== false,
    ssn_last4: h.ssn_last4 ?? null,
    status: 'active',
  }));
}
