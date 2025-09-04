import { NextResponse } from 'next/server';
import { generateAndSetCSRFToken } from '@/lib/security/csrf';

export async function GET() {
  try {
    const token = await generateAndSetCSRFToken();
    return NextResponse.json({ token });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
