/**
 * API Route: /api/inseason/stash
 * Injured free agents worth holding for when they're back, with ESPN's return estimates.
 */

import { NextResponse } from 'next/server';
import { requireLeague } from '@/lib/inseason/routeContext';
import { freshSnapshot } from '@/lib/inseason/refreshLeague';
import { buildStash } from '@/lib/inseason/stash';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const { ctx, error } = await requireLeague();
  if (error) return error;
  try {
    const snapshot = await freshSnapshot(ctx);
    return NextResponse.json({ success: true, ...(await buildStash(ctx, snapshot)) });
  } catch (e) {
    console.error('[stash]', e);
    return NextResponse.json({ success: false, error: 'Could not reach ESPN. Try again in a minute.' }, { status: 502 });
  }
}
