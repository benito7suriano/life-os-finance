import { ParsedFile } from '../lib'
import { parsePopularCard } from './popular-card'
import { parsePopularChecking } from './popular-checking'
import { parseChase } from './chase'
import { parseBacChecking } from './bac-checking'
import { parseBacCard } from './bac-card'

export interface RawFile {
  name: string
  /** Raw bytes — parsers decide the encoding (BAC files are latin1). */
  buffer: Buffer
}

export function parseStatementFile(file: RawFile): ParsedFile {
  const { name } = file
  if (/Banco Popular Dominicano 4857/.test(name)) return parsePopularCard(file)
  if (/Banco Popular Dominicano (471|652)/.test(name)) return parsePopularChecking(file)
  if (/^Chase/i.test(name)) return parseChase(file)
  if (/Transacciones del mes/.test(name)) return parseBacChecking(file)
  if (/Estado de cuenta/.test(name)) return parseBacCard(file)
  throw new Error(`No parser matched file: ${name}`)
}
