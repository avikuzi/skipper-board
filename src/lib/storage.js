import { useEffect, useState } from 'react'

// Settings live on this device only. Reads and writes are guarded because
// storage can be unavailable (private browsing, blocked site data).
export function useStoredState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : { ...initial, ...JSON.parse(raw) }
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable: keep the value in memory */
    }
  }, [key, value])
  return [value, setValue]
}
