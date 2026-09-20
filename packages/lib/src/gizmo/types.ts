/** App-bound Gizmo brains. Same orb; catalogs never cross this id. */
export type GizmoAppId = 'crm' | 'admin' | 'member_portal' | 'advisor_portal';

export type GizmoCardKind = 'record' | 'place' | 'howto';

export interface RecordAsk {
  key: string;
  label: string;
}

export type RecordAskField = RecordAsk | null;

export interface GizmoPlace {
  id: string;
  title: string;
  href: string;
  aliases: string[];
  group?: string;
}

export interface GizmoHowto {
  id: string;
  title: string;
  href: string;
  aliases: string[];
  steps: string[];
}

export interface GizmoRecordHit {
  title: string;
  subtitle?: string;
  href: string;
  module: string;
  phone?: string | null;
  email?: string | null;
  fields?: Record<string, string>;
}

export interface GizmoCard {
  kind: GizmoCardKind;
  title: string;
  subtitle?: string;
  href: string;
  module?: string;
  steps?: string[];
}

export interface GizmoPageTip {
  id: string;
  title: string;
  body: string;
}

export const GIZMO_TOOL_NAMES = [
  'search_records',
  'find_place',
  'find_howto',
  'page_context',
] as const;

export type GizmoToolName = (typeof GIZMO_TOOL_NAMES)[number];

export const GIZMO_TOOL_SCHEMAS = {
  search_records: {
    name: 'search_records',
    description:
      'Find records the signed-in user may see in THIS app only. Cap 8. Never invent hrefs.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Name, phone, email, or member number' },
        module: { type: 'string', description: 'Optional module filter' },
      },
      required: ['q'],
    },
  },
  find_place: {
    name: 'find_place',
    description: 'Find a page or setting in THIS app catalog only.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string' },
      },
      required: ['q'],
    },
  },
  find_howto: {
    name: 'find_howto',
    description: 'Find a how-to from THIS app Learn / tips only.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string' },
      },
      required: ['q'],
    },
  },
  page_context: {
    name: 'page_context',
    description: 'Return the current pathname and undismissed page tips.',
    parameters: { type: 'object', properties: {} },
  },
} as const;

export interface RunGizmoTurnInput {
  app: GizmoAppId;
  query: string;
  places: GizmoPlace[];
  howto: GizmoHowto[];
  records?: GizmoRecordHit[];
  pathname?: string;
  pageTitle?: string;
  pageTips?: GizmoPageTip[];
  role?: string | null;
}

export interface GizmoTurnResult {
  reply: string;
  cards: GizmoCard[];
  refused: boolean;
  usedTools: GizmoToolName[];
  allowedHrefs: string[];
  voice: { system: string; user: string };
  askedField: RecordAskField;
}
