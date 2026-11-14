import { useEffect, useState } from 'react'

/**
 * Ticking clock. Every live widget (lesson progress, countdowns, duty state)
 * shares this so the whole surface re-renders on one cadence instead of
 * spawning competing intervals.
 *
 * @param {number} intervalMs how often the reference date is refreshed
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}

export default useNow
