// Chainable Supabase query-builder mock for webhook handler tests.
// Each `.from(table)` call records an Op; the test-provided `respond`
// function decides what data/error the query resolves with.

export interface Op {
  table: string
  action: 'select' | 'insert' | 'update' | 'delete'
  /** Chained method calls, e.g. filters.eq = [['user_id', 'u1']]. */
  filters: Record<string, unknown[][]>
  /** insert/update payload. */
  values?: unknown
}

export type Responder = (op: Op) => { data?: unknown; error?: unknown } | undefined

export function mockSupabase(respond: Responder) {
  const ops: Op[] = []

  function from(table: string) {
    const op: Op = { table, action: 'select', filters: {} }
    ops.push(op)

    const resolveOp = () => {
      const res = respond(op)
      return { data: res?.data ?? null, error: res?.error ?? null }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      then(onFulfilled?: (v: unknown) => unknown) {
        return Promise.resolve(resolveOp()).then(onFulfilled)
      },
      maybeSingle: async () => resolveOp(),
      single: async () => resolveOp(),
    }

    const record =
      (name: string) =>
      (...args: unknown[]) => {
        ;(op.filters[name] ??= []).push(args)
        return builder
      }
    for (const m of ['select', 'eq', 'gt', 'lt', 'is', 'order', 'limit', 'ilike']) {
      builder[m] = record(m)
    }
    builder.insert = (v: unknown) => {
      op.action = 'insert'
      op.values = v
      return builder
    }
    builder.update = (v: unknown) => {
      op.action = 'update'
      op.values = v
      return builder
    }
    builder.delete = () => {
      op.action = 'delete'
      return builder
    }

    return builder
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: { from } as any,
    ops,
  }
}

export function opsFor(ops: Op[], table: string, action?: Op['action']) {
  return ops.filter(o => o.table === table && (!action || o.action === action))
}
