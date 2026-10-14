import { NextResponse } from 'next/server';
import { leagueContext, type LeagueContext } from './profile';

/** The caller's league, or the response to send back (sign in, upgrade, or connect a league). */
export async function requireLeague(): Promise<{ ctx: LeagueContext; error?: never } | { ctx?: never; error: NextResponse }> {
  const c = await leagueContext();
  if (c.ok) return { ctx: c.ctx };
  const needs = c.status === 401 ? 'signin' : c.status === 402 ? 'pro' : 'connect';
  return { error: NextResponse.json({ success: false, error: c.error, needs }, { status: c.status }) };
}
