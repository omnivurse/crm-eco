export interface CompanionCode {
  code: string;
  label: string;
}

export interface ProcedureFamily {
  id: string;
  label: string;
  code: string;
  /** Lowercased tokens that should surface this family. */
  tokens: string[];
  companions: CompanionCode[];
}

/**
 * Typical bill stacks the client asked for — hospital + anesthesia + visit +
 * imaging / lab where a published CPT is well known. Companion codes are
 * offered, never auto-searched as if they were the same tick.
 */
export const PROCEDURE_FAMILIES: readonly ProcedureFamily[] = [
  {
    id: 'tka',
    label: 'Total knee arthroplasty',
    code: '27447',
    tokens: ['knee', 'tka', 'arthroplasty', '27447', 'replacement'],
    companions: [
      { code: '01402', label: 'Anesthesia, knee' },
      { code: '73721', label: 'MRI, lower extremity' },
      { code: '99213', label: 'Office visit' },
    ],
  },
  {
    id: 'tha',
    label: 'Total hip arthroplasty',
    code: '27130',
    tokens: ['hip', 'tha', '27130', 'replacement'],
    companions: [
      { code: '01214', label: 'Anesthesia, hip' },
      { code: '73721', label: 'MRI, lower extremity' },
      { code: '99213', label: 'Office visit' },
    ],
  },
  {
    id: 'colonoscopy',
    label: 'Colonoscopy, diagnostic',
    code: '45378',
    tokens: ['colon', 'colonoscopy', '45378'],
    companions: [
      { code: '00811', label: 'Anesthesia, lower GI' },
      { code: '99213', label: 'Office visit' },
    ],
  },
  {
    id: 'cataract',
    label: 'Cataract surgery',
    code: '66984',
    tokens: ['cataract', '66984', 'eye', 'lens'],
    companions: [
      { code: '00142', label: 'Anesthesia, lens' },
      { code: '92014', label: 'Eye exam' },
    ],
  },
  {
    id: 'mri-brain',
    label: 'MRI brain without contrast',
    code: '70551',
    tokens: ['mri', 'brain', '70551', 'imaging'],
    companions: [{ code: '99213', label: 'Office visit' }],
  },
  {
    id: 'mri-knee',
    label: 'MRI lower extremity',
    code: '73721',
    tokens: ['mri', 'knee', '73721', 'imaging'],
    companions: [{ code: '99213', label: 'Office visit' }],
  },
  {
    id: 'ct-chest',
    label: 'CT chest without contrast',
    code: '71250',
    tokens: ['ct', 'chest', '71250', 'imaging'],
    companions: [{ code: '99213', label: 'Office visit' }],
  },
  {
    id: 'mole',
    label: 'Excision, benign lesion',
    code: '11400',
    tokens: ['mole', 'lesion', 'excision', '11400', 'skin'],
    companions: [
      { code: '99213', label: 'Office visit' },
      { code: '88305', label: 'Pathology, tissue' },
    ],
  },
  {
    id: 'office',
    label: 'Office / outpatient visit',
    code: '99213',
    tokens: ['office', 'visit', '99213', 'em'],
    companions: [],
  },
  {
    id: 'cbc',
    label: 'Complete blood count',
    code: '85025',
    tokens: ['cbc', 'blood', '85025', 'lab'],
    companions: [{ code: '36415', label: 'Venipuncture' }],
  },
  {
    id: 'cholecystectomy',
    label: 'Laparoscopic cholecystectomy',
    code: '47562',
    tokens: ['gallbladder', 'cholecystectomy', '47562', 'gall'],
    companions: [
      { code: '00790', label: 'Anesthesia, upper abdomen' },
      { code: '76705', label: 'Ultrasound, abdomen' },
    ],
  },
  {
    id: 'hernia',
    label: 'Inguinal hernia repair',
    code: '49505',
    tokens: ['hernia', 'inguinal', '49505'],
    companions: [{ code: '00830', label: 'Anesthesia, lower abdomen' }],
  },
  {
    id: 'appendectomy',
    label: 'Laparoscopic appendectomy',
    code: '44970',
    tokens: ['appendix', 'appendectomy', '44970'],
    companions: [{ code: '00840', label: 'Anesthesia, lower abdomen' }],
  },
  {
    id: 'c-section',
    label: 'Cesarean delivery',
    code: '59510',
    tokens: ['c-section', 'cesarean', 'csection', '59510', 'birth'],
    companions: [{ code: '01961', label: 'Anesthesia, cesarean' }],
  },
  {
    id: 'delivery',
    label: 'Vaginal delivery',
    code: '59400',
    tokens: ['delivery', 'labor', '59400', 'birth', 'ob'],
    companions: [{ code: '01960', label: 'Anesthesia, vaginal delivery' }],
  },
  {
    id: 'acl',
    label: 'ACL reconstruction',
    code: '29888',
    tokens: ['acl', '29888', 'knee', 'ligament'],
    companions: [
      { code: '01382', label: 'Anesthesia, knee arthroscopy' },
      { code: '73721', label: 'MRI, lower extremity' },
    ],
  },
  {
    id: 'rotator',
    label: 'Rotator cuff repair',
    code: '29827',
    tokens: ['rotator', 'cuff', 'shoulder', '29827'],
    companions: [
      { code: '01630', label: 'Anesthesia, shoulder' },
      { code: '73221', label: 'MRI, upper extremity' },
    ],
  },
  {
    id: 'laminectomy',
    label: 'Lumbar laminectomy',
    code: '63047',
    tokens: ['laminectomy', 'spine', 'lumbar', '63047', 'back'],
    companions: [{ code: '00630', label: 'Anesthesia, lumbar spine' }],
  },
  {
    id: 'mammogram',
    label: 'Screening mammogram',
    code: '77067',
    tokens: ['mammogram', 'mammo', '77067', 'breast'],
    companions: [],
  },
  {
    id: 'us-abdomen',
    label: 'Ultrasound, abdomen',
    code: '76700',
    tokens: ['ultrasound', 'abdomen', '76700', 'sono'],
    companions: [],
  },
  {
    id: 'ecg',
    label: 'Electrocardiogram',
    code: '93000',
    tokens: ['ekg', 'ecg', '93000', 'heart'],
    companions: [],
  },
  {
    id: 'carpal',
    label: 'Carpal tunnel release',
    code: '64721',
    tokens: ['carpal', 'tunnel', '64721', 'wrist'],
    companions: [{ code: '01810', label: 'Anesthesia, forearm' }],
  },
  {
    id: 'hysterectomy',
    label: 'Laparoscopic hysterectomy',
    code: '58571',
    tokens: ['hysterectomy', '58571', 'uterus'],
    companions: [{ code: '00840', label: 'Anesthesia, lower abdomen' }],
  },
];

export function searchProcedureFamilies(query: string): ProcedureFamily[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...PROCEDURE_FAMILIES];
  const compact = q.replace(/[^a-z0-9]/g, '');
  return PROCEDURE_FAMILIES.filter((family) => {
    if (family.code === compact) return true;
    if (family.label.toLowerCase().includes(q)) return true;
    return family.tokens.some((token) => token.includes(q) || q.includes(token));
  });
}

export function familyForCode(code: string): ProcedureFamily | null {
  const compact = code.trim().toLowerCase();
  if (!compact) return null;
  return PROCEDURE_FAMILIES.find((family) => family.code.toLowerCase() === compact) ?? null;
}
