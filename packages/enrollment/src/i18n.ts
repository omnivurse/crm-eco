export type EnrollmentLocale = 'en' | 'es';

export function detectEnrollmentLocale(input?: {
  stored?: string | null;
  acceptLanguage?: string | null;
  navigatorLanguage?: string | null;
}): EnrollmentLocale {
  const stored = input?.stored?.toLowerCase();
  if (stored === 'es' || stored === 'en') return stored;
  const hint = `${input?.acceptLanguage ?? ''} ${input?.navigatorLanguage ?? ''}`.toLowerCase();
  return hint.includes('es') ? 'es' : 'en';
}

const COPY: Record<EnrollmentLocale, Record<string, string>> = {
  en: {
    continue: 'Continue',
    previous: 'Previous',
    payment: 'Payment',
    confirm: 'Confirm',
    sponsorPaid: 'Your employer pays this membership. No card is required.',
    intake: 'Your Information',
    intakeDesc: 'Tell us about yourself',
    household: 'Household',
    householdDesc: 'Add family members',
    questionnaire: 'Questionnaire',
    questionnaireDesc: 'Answer a few eligibility questions',
    plan: 'Choose a Plan',
    planDesc: 'Select your coverage',
    acknowledgments: 'Acknowledgments',
    acknowledgmentsDesc: 'Review and sign',
    paymentDesc: 'Set up billing',
    confirmDesc: 'Submit enrollment',
    leadTitle: 'Tell us about yourself',
    leadSubtitle: 'Start your enrollment — no account needed.',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    phone: 'Phone',
    dob: 'Date of birth',
    relationship: 'Relationship',
    spousePartner: 'Spouse / partner',
    child: 'Child',
    otherDependent: 'Other dependent',
    livesAtHome: 'Lives at the same address',
    docsHeading: 'Plan documents',
    complianceIntro:
      'Before proceeding, you must understand and acknowledge the following about health sharing programs.',
    stepOf: 'Step {current} of {total}',
  },
  es: {
    continue: 'Continuar',
    previous: 'Anterior',
    payment: 'Pago',
    confirm: 'Confirmar',
    sponsorPaid: 'Su empleador paga esta membresía. No se requiere tarjeta.',
    intake: 'Su información',
    intakeDesc: 'Cuéntenos sobre usted',
    household: 'Hogar',
    householdDesc: 'Agregue familiares',
    questionnaire: 'Cuestionario',
    questionnaireDesc: 'Responda unas preguntas de elegibilidad',
    plan: 'Elija un plan',
    planDesc: 'Seleccione su cobertura',
    acknowledgments: 'Reconocimientos',
    acknowledgmentsDesc: 'Revise y firme',
    paymentDesc: 'Configure la facturación',
    confirmDesc: 'Enviar inscripción',
    leadTitle: 'Cuéntenos sobre usted',
    leadSubtitle: 'Comience su inscripción — no necesita una cuenta.',
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    dob: 'Fecha de nacimiento',
    relationship: 'Parentesco',
    spousePartner: 'Cónyuge / pareja',
    child: 'Hijo/a',
    otherDependent: 'Otro dependiente',
    livesAtHome: 'Vive en la misma dirección',
    docsHeading: 'Documentos del plan',
    complianceIntro:
      'Antes de continuar, debe comprender y aceptar lo siguiente sobre los programas de compartir costos de salud.',
    stepOf: 'Paso {current} de {total}',
  },
};

export function enrollmentCopy(locale: EnrollmentLocale, key: string): string {
  return COPY[locale][key] ?? COPY.en[key] ?? key;
}

export function formatEnrollmentCopy(
  locale: EnrollmentLocale,
  key: string,
  vars: Record<string, string | number>,
): string {
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    enrollmentCopy(locale, key),
  );
}

export function localizedEnrollmentSteps(locale: EnrollmentLocale) {
  return [
    { key: 'intake', title: enrollmentCopy(locale, 'intake'), description: enrollmentCopy(locale, 'intakeDesc') },
    { key: 'household', title: enrollmentCopy(locale, 'household'), description: enrollmentCopy(locale, 'householdDesc') },
    {
      key: 'questionnaire',
      title: enrollmentCopy(locale, 'questionnaire'),
      description: enrollmentCopy(locale, 'questionnaireDesc'),
    },
    { key: 'plan_selection', title: enrollmentCopy(locale, 'plan'), description: enrollmentCopy(locale, 'planDesc') },
    {
      key: 'compliance',
      title: enrollmentCopy(locale, 'acknowledgments'),
      description: enrollmentCopy(locale, 'acknowledgmentsDesc'),
    },
    { key: 'payment', title: enrollmentCopy(locale, 'payment'), description: enrollmentCopy(locale, 'paymentDesc') },
    { key: 'confirmation', title: enrollmentCopy(locale, 'confirm'), description: enrollmentCopy(locale, 'confirmDesc') },
  ] as const;
}
