import { NextRequest, NextResponse } from 'next/server';
import { REPORT_TEMPLATES, TEMPLATE_CATEGORIES, getTemplatesByCategory, type TemplateCategory } from '@/lib/reports';

// GET /api/reports/templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') as TemplateCategory | null;

    const templates = category ? getTemplatesByCategory(category) : REPORT_TEMPLATES;

    return NextResponse.json({
      templates,
      categories: TEMPLATE_CATEGORIES,
      total: templates.length,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}
