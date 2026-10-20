/**
 * API Route: /api/inseason/subscription
 * The signed-in user's weekly subscription.
 *   GET                       -> { subscription: { until, renews } | null }
 *   POST {action:"cancel"}    -> stop renewing at the end of the paid week
 *   POST {action:"resume"}    -> renew again
 */

import { NextResponse } from 'next/server';
import { currentAccount, forgetPaid } from '@/lib/auth';
import { setRenewal, weeklySubscriptions } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

const view = (s: { until: number; renews: boolean } | undefined) => (s ? { until: s.until, renews: s.renews } : null);

export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ success: false, error: 'Sign in first.' }, { status: 401 });
  try {
    return NextResponse.json({ success: true, subscription: view((await weeklySubscriptions(account.email))[0]) });
  } catch (e) {
    console.error('[subscription]', e);
    return NextResponse.json({ success: false, error: 'Could not reach Stripe. Try again in a minute.' }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ success: false, error: 'Sign in first.' }, { status: 401 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== 'cancel' && action !== 'resume') return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
  try {
    const subs = await weeklySubscriptions(account.email);
    // Cancel stops every renewing subscription on the account; resume restarts the newest.
    const targets = action === 'cancel' ? subs.filter((s) => s.renews) : subs.slice(0, 1);
    if (!targets.length) return NextResponse.json({ success: false, error: 'No weekly subscription to change.' }, { status: 404 });
    const updated = await Promise.all(targets.map((s) => setRenewal(s.id, action === 'resume')));
    forgetPaid(account.email);
    return NextResponse.json({ success: true, subscription: view(updated[0]) });
  } catch (e) {
    console.error('[subscription]', e);
    return NextResponse.json({ success: false, error: 'Could not reach Stripe. Try again in a minute.' }, { status: 502 });
  }
}
