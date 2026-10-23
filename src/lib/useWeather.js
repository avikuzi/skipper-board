import { useCallback, useEffect, useState } from 'react'
import { fetchWeather } from './weather.js'

const REFRESH_MS = 30 * 60 * 1000

export function useWeather(marina) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  const load = useCallback(() => {
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading' }))
    fetchWeather(marina)
      .then((data) => !cancelled && setState({ status: 'ready', data, error: null }))
      .catch((error) => !cancelled && setState((s) => ({ status: 'error', data: s.data, error })))
    return () => {
      cancelled = true
    }
  }, [marina])

  useEffect(() => {
    const cancel = load()
    const t = setInterval(load, REFRESH_MS)
    return () => {
      cancel()
      clearInterval(t)
    }
  }, [load])

  return { ...state, reload: load }
}
