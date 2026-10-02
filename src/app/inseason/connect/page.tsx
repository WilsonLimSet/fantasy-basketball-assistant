'use client';

import { useState } from 'react';

export default function ConnectPage() {
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramResult, setTelegramResult] = useState<{ success: boolean; message: string } | null>(null);

  const testTelegram = async () => {
    setTestingTelegram(true);
    setTelegramResult(null);

    try {
      // This would call a test endpoint - for now just show instructions
      setTelegramResult({
        success: true,
        message: 'Telegram test requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to be configured.',
      });
    } catch {
      setTelegramResult({
        success: false,
        message: 'Failed to test Telegram connection',
      });
    } finally {
      setTestingTelegram(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Connect ESPN</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          Configure your ESPN Fantasy Basketball credentials
        </p>
      </div>

      {/* ESPN Cookies Setup */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">ESPN Authentication</h2>
        </div>

        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          Adam uses your ESPN session cookies to access your private league data.
          Your credentials are never logged or stored insecurely.
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>
          How to get your ESPN cookies:
        </h3>

        <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
          <li style={{ marginBottom: '1rem' }}>
            <strong>Log in to ESPN Fantasy</strong>
            <br />
            <span style={{ color: 'var(--muted)' }}>
              Go to{' '}
              <a
                href="https://fantasy.espn.com/basketball"
                target="_blank"
                rel="noopener noreferrer"
              >
                fantasy.espn.com/basketball
              </a>{' '}
              and sign in
            </span>
          </li>

          <li style={{ marginBottom: '1rem' }}>
            <strong>Open Developer Tools</strong>
            <br />
            <span style={{ color: 'var(--muted)' }}>
              Press F12 or right-click → Inspect → Application tab
            </span>
          </li>

          <li style={{ marginBottom: '1rem' }}>
            <strong>Find Cookies</strong>
            <br />
            <span style={{ color: 'var(--muted)' }}>
              In the sidebar: Storage → Cookies → https://fantasy.espn.com
            </span>
          </li>

          <li style={{ marginBottom: '1rem' }}>
            <strong>Copy these values:</strong>
            <br />
            <code
              style={{
                background: 'var(--card-border)',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                display: 'inline-block',
                marginTop: '0.5rem',
              }}
            >
              espn_s2
            </code>{' '}
            - A long string (your session cookie)
            <br />
            <code
              style={{
                background: 'var(--card-border)',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                display: 'inline-block',
                marginTop: '0.5rem',
              }}
            >
              SWID
            </code>{' '}
            - A GUID in braces like{' '}
            <code style={{ color: 'var(--muted)' }}>{'{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}'}</code>
          </li>

          <li style={{ marginBottom: '1rem' }}>
            <strong>Get your League ID</strong>
            <br />
            <span style={{ color: 'var(--muted)' }}>
              From your league URL: fantasy.espn.com/basketball/league?leagueId=
              <strong>12345678</strong>
            </span>
          </li>
        </ol>
      </div>

      {/* Environment Variables */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Environment Variables</h2>
        </div>

        <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
          Add these to your Vercel project settings or .env.local file:
        </p>

        <pre
          style={{
            background: 'var(--background)',
            border: '1px solid var(--card-border)',
            padding: '1rem',
            borderRadius: '0.5rem',
            overflow: 'auto',
            fontSize: '0.875rem',
          }}
        >
          {`# ESPN Fantasy (Required)
ESPN_S2=your_espn_s2_cookie_value
ESPN_SWID={XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}
ESPN_LEAGUE_ID=12345678
ESPN_SEASON=2026
ESPN_MY_TEAM_ID=1

# Telegram Notifications (Optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Vercel KV (Auto-configured on Vercel)
KV_URL=your_kv_url
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token
KV_REST_API_READ_ONLY_TOKEN=your_read_only_token

# Optional
APP_BASE_URL=https://your-app.vercel.app
CRON_SECRET=your_cron_secret`}
        </pre>
      </div>

      {/* Telegram Setup */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Telegram Notifications</h2>
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>
          How to set up Telegram alerts:
        </h3>

        <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
          <li style={{ marginBottom: '1rem' }}>
            <strong>Create a Telegram Bot</strong>
            <br />
            <span style={{ color: 'var(--muted)' }}>
              Message{' '}
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">
                @BotFather
              </a>{' '}
              on Telegram and send <code>/newbot</code>
            </span>
          </li>

          <li style={{ marginBottom: '1rem' }}>
            <strong>Save the Bot Token</strong>
            <br />
            <span style={{ color: 'var(--muted)' }}>
              BotFather will give you a token like <code>123456789:ABCdefGHIjklMNOpqrSTUvwxYZ</code>
            </span>
          </li>

          <li style={{ marginBottom: '1rem' }}>
            <strong>Get Your Chat ID</strong>
            <br />
            <span style={{ color: 'var(--muted)' }}>
              Start a chat with your bot, then visit:
              <br />
              <code>https://api.telegram.org/bot&lt;YOUR_TOKEN&gt;/getUpdates</code>
              <br />
              Find your chat ID in the response
            </span>
          </li>

          <li>
            <strong>Add to Environment Variables</strong>
            <br />
            <span style={{ color: 'var(--muted)' }}>
              Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
            </span>
          </li>
        </ol>

        <div style={{ marginTop: '1rem' }}>
          <button
            className="btn btn-secondary"
            onClick={testTelegram}
            disabled={testingTelegram}
          >
            {testingTelegram ? 'Testing...' : 'Test Telegram Connection'}
          </button>

          {telegramResult && (
            <div
              className={`alert ${telegramResult.success ? 'alert-success' : 'alert-danger'}`}
              style={{ marginTop: '1rem' }}
            >
              {telegramResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Vercel Setup */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Vercel Deployment</h2>
        </div>

        <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
          <li style={{ marginBottom: '1rem' }}>
            <strong>Fork or Clone the Repository</strong>
          </li>

          <li style={{ marginBottom: '1rem' }}>
            <strong>Create a Vercel KV Store</strong>
            <br />
            <span style={{ color: 'var(--muted)' }}>
              In your Vercel project: Storage → Create Database → KV
            </span>
          </li>

          <li style={{ marginBottom: '1rem' }}>
            <strong>Add Environment Variables</strong>
            <br />
            <span style={{ color: 'var(--muted)' }}>
              Project Settings → Environment Variables → Add all variables above
            </span>
          </li>

          <li style={{ marginBottom: '1rem' }}>
            <strong>Deploy</strong>
            <br />
            <span style={{ color: 'var(--muted)' }}>
              Push to your repository or deploy via Vercel CLI
            </span>
          </li>

          <li>
            <strong>Verify Cron Job</strong>
            <br />
            <span style={{ color: 'var(--muted)' }}>
              Check Vercel Dashboard → Settings → Cron Jobs
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}
