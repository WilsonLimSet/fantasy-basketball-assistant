'use client';

import type { MatchupGamesComparison, MatchupWeekSchedule, NBATeamSchedule } from '@/types';
import { TeamLogo } from '@/components/ui';
import { MatchupGamesPanel } from '../MovesPanel';
import { Gate, Loading, Panel, useCached } from '../useMe';

interface WeeklyResponse {
  success: boolean;
  scheduleIndex?: Record<number, NBATeamSchedule>;
  matchupGames?: MatchupGamesComparison;
  matchupWeek?: MatchupWeekSchedule;
  today?: number;
  error?: string;
  needs?: 'signin' | 'pro' | 'connect';
}

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

export default function SchedulePage() {
  const { data } = useCached<WeeklyResponse>('/api/inseason/weekly-plan');

  if (!data) return <Loading what="the schedule" />;
  if (data.needs) return <Gate needs={data.needs} />;
  const week = data.matchupWeek;
  if (!data.success || !week) {
    return <Panel title="Schedule"><p className="text-sm text-muted">{data.error ?? 'No schedule yet. Refresh on This week.'}</p></Panel>;
  }

  const today = data.today ?? 0;
  const days = week.days;
  const teams = Object.values(data.scheduleIndex ?? {})
    .filter((t) => t.teamId > 0 && t.teamAbbrev !== 'FA')
    .map((t) => {
      const games = new Set(week.teamGames[t.teamId] ?? []);
      return { ...t, games, left: [...games].filter((d) => d >= today).length };
    })
    .sort((a, b) => b.left - a.left || b.games.size - a.games.size || a.teamAbbrev.localeCompare(b.teamAbbrev));

  return (
    <div className="space-y-5">
      {data.matchupGames && <MatchupGamesPanel data={data.matchupGames} />}
      <Panel title="NBA schedule this week" sub="Teams with the most games left are where streamers come from.">
        <div className="max-w-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="pb-2 font-medium">Team</th>
                <th className="pb-2 text-right font-medium">Left</th>
                {days.map((d) => (
                  <th key={d.scoringPeriodId} className={`w-10 pb-2 text-center font-medium ${d.scoringPeriodId < today ? 'opacity-40' : ''}`}>
                    {dayLabel(d.date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.teamId} className="border-t border-line">
                  <td className="py-1.5">
                    <span className="flex items-center gap-2"><TeamLogo team={t.teamAbbrev} size={16} />{t.teamAbbrev}</span>
                  </td>
                  <td className={`py-1.5 text-right tabular-nums font-medium ${t.left >= 4 ? 'text-accent' : t.left <= 1 ? 'text-muted' : ''}`}>{t.left}</td>
                  {days.map((d) => (
                    <td key={d.scoringPeriodId} className={`py-1.5 text-center ${d.scoringPeriodId < today ? 'opacity-40' : ''}`}>
                      {t.games.has(d.scoringPeriodId) ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-fg" /> : <span className="text-line">·</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
