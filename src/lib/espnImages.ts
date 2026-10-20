// ESPN's image CDN uses its own team codes for a few teams.
const ESPN_LOGO_CODE: Record<string, string> = { GSW: "gs", NOP: "no", NYK: "ny", SAS: "sa", UTA: "utah", WAS: "wsh" };

/** Player headshot from ESPN (fantasy player ids are ESPN athlete ids). */
export const headshotUrl = (id: number, w: number, h: number) =>
  `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${id}.png&w=${w}&h=${h}`;

export const teamLogoUrl = (team: string, size: number) =>
  `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/${ESPN_LOGO_CODE[team] ?? team.toLowerCase()}.png&w=${size}&h=${size}`;
