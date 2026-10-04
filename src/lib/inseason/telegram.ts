/**
 * Telegram Bot Integration
 * Sends alerts and notifications via Telegram Bot API
 */

import type { SnapshotDiff, TelegramAlert, StatusChange, FreeAgentEntry, SmartAlert } from '@/types';

const TELEGRAM_API = 'https://api.telegram.org';

interface TelegramConfig {
  botToken: string;
  chatId: string;
  appBaseUrl?: string;
}

function getConfig(): TelegramConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const appBaseUrl = process.env.APP_BASE_URL || process.env.VERCEL_URL;

  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
  }
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID environment variable is required');
  }

  return { botToken, chatId, appBaseUrl };
}

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const config = getConfig();

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
}

/**
 * Format status for display
 */
function formatStatus(status: string): string {
  const statusEmoji: Record<string, string> = {
    'ACTIVE': '✅',
    'DAY_TO_DAY': '⚠️',
    'OUT': '❌',
    'INJURY_RESERVE': '🏥',
    'QUESTIONABLE': '❓',
    'DOUBTFUL': '⁉️',
    'PROBABLE': '🟡',
    'SUSPENSION': '🚫',
  };
  return `${statusEmoji[status] || '•'} ${status.replace('_', ' ')}`;
}

/**
 * Build status change message
 */
function buildStatusChangeMessage(changes: StatusChange[]): string {
  if (changes.length === 0) return '';

  const myChanges = changes.filter((c) => c.isMyPlayer);
  const otherChanges = changes.filter((c) => !c.isMyPlayer);

  let message = '';

  if (myChanges.length > 0) {
    message += '\n\n<b>🔴 YOUR ROSTER ALERTS:</b>\n';
    for (const change of myChanges) {
      message += `• <b>${change.playerName}</b>\n`;
      message += `  ${formatStatus(change.previousStatus)} → ${formatStatus(change.currentStatus)}\n`;
    }
  }

  if (otherChanges.length > 0) {
    message += '\n<b>📋 Other Status Changes:</b>\n';
    for (const change of otherChanges.slice(0, 5)) {
      message += `• ${change.playerName}: ${formatStatus(change.currentStatus)}\n`;
    }
    if (otherChanges.length > 5) {
      message += `  ...and ${otherChanges.length - 5} more\n`;
    }
  }

  return message;
}

/**
 * Build waiver alert message
 */
function buildWaiverMessage(newCandidates: FreeAgentEntry[]): string {
  if (newCandidates.length === 0) return '';

  let message = '\n\n<b>🌟 NEW TOP WAIVER ADDS:</b>\n';

  for (const candidate of newCandidates.slice(0, 3)) {
    const { player, score, gamesNext7, reasonCodes } = candidate;
    message += `• <b>${player.name}</b> (${player.nbaTeamAbbrev || 'FA'})\n`;
    message += `  Score: ${score.toFixed(1)} | Games: ${gamesNext7}\n`;
    if (reasonCodes.length > 0) {
      message += `  ${reasonCodes.join(', ')}\n`;
    }
  }

  if (newCandidates.length > 3) {
    message += `  ...and ${newCandidates.length - 3} more\n`;
  }

  return message;
}

/**
 * Send alert based on snapshot diff
 */
export async function sendDiffAlert(diff: SnapshotDiff): Promise<boolean> {
  if (!diff.significantChanges) {
    return true; // No alert needed
  }

  const config = getConfig();
  let message = '<b>🏀 Fantasy GM Alert</b>\n';
  message += `<i>${new Date().toLocaleString()}</i>`;

  // Add status changes
  message += buildStatusChangeMessage(diff.statusChanges);

  // Add new waiver candidates
  message += buildWaiverMessage(diff.newTopWaiverCandidates);

  // Add week change notice
  if (diff.weekChanged) {
    message += '\n\n<b>📅 NEW MATCHUP WEEK STARTED</b>';
  }

  // Add dashboard link
  if (config.appBaseUrl) {
    const baseUrl = config.appBaseUrl.startsWith('http')
      ? config.appBaseUrl
      : `https://${config.appBaseUrl}`;
    message += `\n\n<a href="${baseUrl}/inseason">View Dashboard →</a>`;
  }

  return sendTelegramMessage(message);
}

/**
 * Send a generic alert
 */
export async function sendAlert(alert: TelegramAlert): Promise<boolean> {
  const priorityEmoji: Record<string, string> = {
    HIGH: '🔴',
    MEDIUM: '🟡',
    LOW: '🟢',
  };

  let message = `<b>${priorityEmoji[alert.priority]} ${alert.title}</b>\n\n`;
  message += alert.message;
  message += `\n\n<i>${new Date(alert.timestamp).toLocaleString()}</i>`;

  return sendTelegramMessage(message);
}

/**
 * Send daily briefing summary
 */
export async function sendDailyBriefing(summary: {
  week: number;
  teamStatus: string;
  topAction?: string;
  dashboardUrl?: string;
}): Promise<boolean> {
  let message = '<b>🏀 Daily Briefing</b>\n\n';
  message += `<b>Week ${summary.week}</b>\n`;
  message += summary.teamStatus;

  if (summary.topAction) {
    message += `\n\n<b>⚡ Top Action:</b>\n${summary.topAction}`;
  }

  if (summary.dashboardUrl) {
    message += `\n\n<a href="${summary.dashboardUrl}">View Full Briefing →</a>`;
  }

  return sendTelegramMessage(message);
}

/**
 * Test Telegram connection
 */
export async function testTelegramConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getConfig();
    const response = await fetch(`${TELEGRAM_API}/bot${config.botToken}/getMe`);

    if (!response.ok) {
      return { success: false, error: 'Invalid bot token' };
    }

    const sent = await sendTelegramMessage('🏀 Adam Fantasy GM connected successfully!');
    return { success: sent };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Format a smart alert for Telegram - compact, no fluff
 */
function formatSmartAlert(alert: SmartAlert): string {
  const priorityEmoji = {
    HIGH: '🔴',
    MEDIUM: '🟡',
    LOW: '🟢',
  };

  if (alert.details) {
    return `${priorityEmoji[alert.priority]} <b>${alert.title}</b>\n${alert.details}`;
  }
  return `${priorityEmoji[alert.priority]} <b>${alert.title}</b>`;
}

/**
 * Send smart alerts via Telegram - compact format
 */
export async function sendSmartAlerts(
  alerts: SmartAlert[],
  _week: number
): Promise<boolean> {
  if (alerts.length === 0) {
    return true; // Nothing to send
  }

  let message = '';

  // Separate schedule alerts from other alerts
  const scheduleAlerts = alerts.filter(a => a.type === 'WEEKLY_SUMMARY');
  const otherAlerts = alerts.filter(a => a.type !== 'WEEKLY_SUMMARY');

  // Add non-schedule alerts first (injuries, drops, etc)
  for (let i = 0; i < otherAlerts.length; i++) {
    if (i > 0) message += '\n';
    message += formatSmartAlert(otherAlerts[i]);
  }

  // Add schedule section
  if (scheduleAlerts.length > 0) {
    const scheduleAlert = scheduleAlerts[0];
    if (message.length > 0) message += '\n\n';
    message += scheduleAlert.details;
  }

  return sendTelegramMessage(message);
}

/**
 * Send a quiet summary (no urgent alerts)
 */
export async function sendQuietSummary(
  _week: number,
  topWaiverName: string,
  topWaiverGames: number
): Promise<boolean> {
  const config = getConfig();

  let message = '<b>🏀 Adam - All Clear</b>\n\n';
  message += '✅ No urgent roster changes needed\n\n';
  message += `<b>Top streaming option:</b>\n`;
  message += `${topWaiverName} (${topWaiverGames} games this week)\n`;

  if (config.appBaseUrl) {
    const baseUrl = config.appBaseUrl.startsWith('http')
      ? config.appBaseUrl
      : `https://${config.appBaseUrl}`;
    message += `\n<a href="${baseUrl}/inseason/waivers">View All Waivers →</a>`;
  }

  return sendTelegramMessage(message);
}

