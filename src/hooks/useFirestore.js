import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { backend } from '../app/backend'
import { COLLECTIONS } from '../utils/constants'

/**
 * Centralised Firestore query wrapper.
 *
 * Every read in the app funnels through here so that loading states, error
 * capture and unsubscribe behaviour stay consistent. `options` is serialised
 * before it is used as an effect dependency, which means callers can pass
 * inline object literals without causing resubscribe storms.
 *
 * @param {string} name collection
 * @param {{ filters?: Array<{field: string, op?: string, value: unknown}>, sort?: {field: string, dir?: 'asc'|'desc'}, limit?: number }} options
 * @returns {{ data: Array, loading: boolean, error: Error|null, reload: Function }}
 */
export function useCollection(name, options = null, config = {}) {
  const { enabled = true, initialValue = [] } = config
  const serialised = JSON.stringify(options ?? {})
  const active = Boolean(name) && enabled

  const [nonce, setNonce] = useState(0)
  const queryKey = JSON.stringify([name, serialised, nonce])
  const [data, setData] = useState(initialValue)
  const [settledQuery, setSettledQuery] = useState(null)
  const [queryError, setQueryError] = useState(null)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!active) return undefined

    const unsubscribe = backend.subscribe(
      name,
      JSON.parse(serialised),
      (rows) => {
        if (!mounted.current) return
        setData(rows)
        setQueryError({ key: queryKey, error: null })
        setSettledQuery(queryKey)
      },
      (cause) => {
        if (!mounted.current) return
        setQueryError({
          key: queryKey,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
        setSettledQuery(queryKey)
      },
    )

    return unsubscribe
  }, [name, serialised, active, nonce, queryKey])

  const reload = useCallback(() => setNonce((value) => value + 1), [setNonce])

  return {
    data,
    loading: active && settledQuery !== queryKey,
    error: queryError?.key === queryKey ? queryError.error : null,
    reload,
  }
}

/** Single-document subscription. Returns `null` while the document is absent. */
export function useDocument(name, id, config = {}) {
  const options = useMemo(
    () => (id ? { filters: [{ field: 'id', op: '==', value: id }] } : null),
    [id],
  )

  const { data, loading, error, reload } = useCollection(name, options, {
    ...config,
    enabled: Boolean(name && id),
  })

  return { data: data[0] ?? null, loading, error, reload }
}

/**
 * Write helpers. Every mutation is fire-and-forget at the call site — errors
 * are thrown so the caller can render a contextual message.
 */
export function useFirestore() {
  const create = useCallback(async (name, payload) => backend.create(name, payload), [])
  const update = useCallback(async (name, id, patch) => backend.update(name, id, patch), [])
  const updateDutyRoster = useCallback(
    async (id, isCompleted, checkedByUid) =>
      backend.updateDutyRoster(id, isCompleted, checkedByUid),
    [],
  )
  const remove = useCallback(async (name, id) => backend.remove(name, id), [])
  const fetchOnce = useCallback(async (name, options) => backend.fetch(name, options), [])

  return {
    create,
    update,
    updateDutyRoster,
    remove,
    fetchOnce,
    mode: backend.mode,
  }
}

/**
 * Appends an entry to the `audit_logs` tracking domain. Deliberately a plain
 * function rather than a hook so it can be called inside event handlers.
 */
export async function recordAudit(adminUid, action, targetUid) {
  return backend.create(COLLECTIONS.AUDIT_LOGS, {
    adminUid: adminUid ?? '',
    action,
    targetUid: targetUid ?? '',
    timestamp: new Date().toISOString(),
  })
}

export default useFirestore
