// Register / inspect / remove the Telegram bot webhook. This is the ONLY
// supported way to point the bot at a deployment — keep it versioned so the
// webhook URL is never a mystery again.
//
// Usage:
//   npm run telegram:webhook -- --url https://<app-domain>/api/automation/telegram/webhook
//   npm run telegram:webhook -- --info
//   npm run telegram:webhook -- --delete

import { promises as fs } from 'fs'
import path from 'path'
import { setWebhook, deleteWebhook, getWebhookInfo } from '../../lib/telegram/client'

// Same zero-dep loader pattern as scripts/import/money-pro/lib.ts, but reading
// .env first (TELEGRAM_* live there) and letting .env.local override.
async function loadEnvFile(envPath: string) {
  try {
    const text = await fs.readFile(envPath, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
}

async function main() {
  const root = path.resolve(__dirname, '..', '..')
  await loadEnvFile(path.join(root, '.env'))
  await loadEnvFile(path.join(root, '.env.local'))

  const args = process.argv.slice(2)
  const urlIdx = args.indexOf('--url')

  if (args.includes('--delete')) {
    await deleteWebhook()
    console.log('Webhook deleted.')
  } else if (urlIdx >= 0) {
    const url = args[urlIdx + 1]
    if (!url || !url.startsWith('https://')) {
      console.error('Usage: npm run telegram:webhook -- --url https://<domain>/api/automation/telegram/webhook')
      process.exit(1)
    }
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!secret) {
      console.error('TELEGRAM_WEBHOOK_SECRET is not set (expected in .env)')
      process.exit(1)
    }
    await setWebhook(url, secret)
    console.log(`Webhook set to ${url}`)
  } else if (!args.includes('--info')) {
    console.log('Usage: npm run telegram:webhook -- [--url <https url> | --info | --delete]')
    process.exit(1)
  }

  const info = await getWebhookInfo()
  console.log('\nCurrent webhook info:')
  console.log(JSON.stringify(info, null, 2))
  if (info.last_error_message) {
    console.warn(`\n⚠️  Telegram reports a delivery error: ${info.last_error_message}`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
