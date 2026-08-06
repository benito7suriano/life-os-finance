// Telegram Bot API client. Thin wrapper around the JSON HTTP endpoints.
// Docs: https://core.telegram.org/bots/api

const API_BASE = 'https://api.telegram.org'

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  return t
}

async function callBot<T = unknown>(method: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string }
  if (!json.ok) {
    throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`)
  }
  return json.result as T
}

// ---------------------------------------------------------------------------
// Outbound

export interface InlineKeyboardButton {
  text: string
  callback_data: string
}

export async function sendMessage(
  chatId: number,
  text: string,
  opts?: {
    parseMode?: 'MarkdownV2' | 'HTML'
    replyToMessageId?: number
    keyboard?: InlineKeyboardButton[][]
  }
) {
  return callBot('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: opts?.parseMode,
    reply_to_message_id: opts?.replyToMessageId,
    reply_markup: opts?.keyboard
      ? { inline_keyboard: opts.keyboard }
      : undefined,
  })
}

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  opts?: {
    parseMode?: 'MarkdownV2' | 'HTML'
    keyboard?: InlineKeyboardButton[][]
  }
) {
  return callBot('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: opts?.parseMode,
    reply_markup: opts?.keyboard
      ? { inline_keyboard: opts.keyboard }
      : undefined,
  })
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return callBot('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
  })
}

// ---------------------------------------------------------------------------
// File downloads (voice notes, photos, etc.)

interface FileInfo {
  file_id: string
  file_path: string
  file_size?: number
}

export async function getFile(fileId: string): Promise<FileInfo> {
  return callBot<FileInfo>('getFile', { file_id: fileId })
}

/** Downloads a Telegram file by ID, returns the raw bytes and MIME type guess. */
export async function downloadFile(fileId: string): Promise<{
  bytes: ArrayBuffer
  mimeType: string
  filename: string
}> {
  const info = await getFile(fileId)
  const url = `${API_BASE}/file/bot${token()}/${info.file_path}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download Telegram file: ${res.status}`)
  }
  const bytes = await res.arrayBuffer()
  const mimeType = res.headers.get('content-type') ?? 'application/octet-stream'
  const filename = info.file_path.split('/').pop() ?? info.file_id
  return { bytes, mimeType, filename }
}

// ---------------------------------------------------------------------------
// Webhook management (called from setup script or a one-off route)

export async function setWebhook(url: string, secretToken: string) {
  return callBot('setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message', 'callback_query'],
  })
}

export async function deleteWebhook() {
  return callBot('deleteWebhook', {})
}

export interface WebhookInfo {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
  last_error_date?: number
  last_error_message?: string
  max_connections?: number
  allowed_updates?: string[]
}

export async function getWebhookInfo(): Promise<WebhookInfo> {
  return callBot<WebhookInfo>('getWebhookInfo', {})
}

// ---------------------------------------------------------------------------
// Inbound payload types (subset we care about)

export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramChat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  username?: string
}

export interface TelegramPhotoSize {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  file_size?: number
}

export interface TelegramVoice {
  file_id: string
  file_unique_id: string
  duration: number
  mime_type?: string
  file_size?: number
}

export interface TelegramAudio {
  file_id: string
  file_unique_id: string
  duration: number
  mime_type?: string
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  caption?: string
  photo?: TelegramPhotoSize[]
  voice?: TelegramVoice
  audio?: TelegramAudio
}

export interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}
