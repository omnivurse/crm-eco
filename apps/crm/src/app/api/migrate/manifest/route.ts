import { NextResponse } from 'next/server';
import { migrateManifestSchema } from '@olyron/migrate-contract';

export async function GET() {
  const manifest = migrateManifestSchema.parse({
    contractVersion: '1',
    appKey: process.env.OLYRON_MIGRATE_APP_KEY ?? 'crm-eco',
    manifestVersion: '2026-04-23',
    generatedAt: new Date().toISOString(),
    allowCustomFields: true,
    rollbackWindowHours: 72,
    entities: [
      {
        key: 'contact',
        label: 'Contact',
        fields: [
          { key: 'first_name', label: 'First name', type: 'string' },
          { key: 'last_name', label: 'Last name', type: 'string' },
          { key: 'email', type: 'email', unique: true },
          { key: 'phone', type: 'phone' },
          { key: 'title', label: 'Job title', type: 'string' },
          { key: 'notes', type: 'text' },
        ],
      },
    ],
  });

  return NextResponse.json(manifest);
}
