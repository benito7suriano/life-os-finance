import { describe, it, expect } from 'vitest'
import { mimeFromFilename } from '../client'

describe('mimeFromFilename', () => {
  it('maps Telegram photo paths to image/jpeg', () => {
    expect(mimeFromFilename('file_123.jpg')).toBe('image/jpeg')
  })

  it('maps common extensions', () => {
    expect(mimeFromFilename('receipt.pdf')).toBe('application/pdf')
    expect(mimeFromFilename('shot.PNG')).toBe('image/png')
    expect(mimeFromFilename('note.oga')).toBe('audio/ogg')
  })

  it('returns null for unknown or missing extensions', () => {
    expect(mimeFromFilename('archive.docx')).toBeNull()
    expect(mimeFromFilename('noextension')).toBeNull()
  })
})
