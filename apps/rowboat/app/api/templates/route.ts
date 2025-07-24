import { NextResponse } from 'next/server';
import { templates } from '@/app/lib/project_templates';

export async function GET() {
  return NextResponse.json(templates);
}
