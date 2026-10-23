// Forecast from Open-Meteo (free, no key). Wind in knots, waves in metres.
// Two endpoints: the weather model for wind/pressure/visibility and the
// marine model for waves and sea temperature.
const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const MARINE = 'https://marine-api.open-meteo.com/v1/marine'
const HOURS_AHEAD = 12

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  return res.json()
}

export async function fetchWeather({ lat, lon }) {
  const common = `latitude=${lat}&longitude=${lon}&timezone=Asia%2FJerusalem&past_days=1&forecast_days=2`
  const [wx, sea] = await Promise.all([
    getJson(
      `${FORECAST}?${common}&wind_speed_unit=kn` +
        '&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,visibility',
    ),
    getJson(
      `${MARINE}?${common}` +
        '&hourly=wave_height,wave_direction,wave_period,sea_surface_temperature',
    ),
  ])

  // Both responses use the same hourly grid; find the current hour in it.
  const times = wx.hourly.time
  const nowKey = currentHourKey()
  let idx = times.indexOf(nowKey)
  if (idx === -1) idx = times.findIndex((t) => t > nowKey) - 1
  if (idx < 0) throw new Error('No forecast for the current hour')
  const seaIdx = sea.hourly.time.indexOf(times[idx])

  const hourAt = (i) => {
    const s = seaIdx === -1 ? -1 : seaIdx + (i - idx)
    return {
      time: times[i],
      wind: wx.hourly.wind_speed_10m[i],
      gust: wx.hourly.wind_gusts_10m[i],
      windDir: wx.hourly.wind_direction_10m[i],
      pressure: wx.hourly.pressure_msl[i],
      visibility: wx.hourly.visibility[i],
      wave: s >= 0 ? sea.hourly.wave_height[s] : null,
      waveDir: s >= 0 ? sea.hourly.wave_direction[s] : null,
      wavePeriod: s >= 0 ? sea.hourly.wave_period[s] : null,
      seaTemp: s >= 0 ? sea.hourly.sea_surface_temperature[s] : null,
    }
  }

  const now = hourAt(idx)
  const threeHoursAgo = idx >= 3 ? wx.hourly.pressure_msl[idx - 3] : null
  const hours = []
  for (let i = idx; i < Math.min(times.length, idx + HOURS_AHEAD + 1); i++) hours.push(hourAt(i))

  return {
    now,
    pressureTrend: threeHoursAgo == null ? null : now.pressure - threeHoursAgo,
    hours,
    fetchedAt: new Date(),
  }
}

// Open-Meteo returns local times as "YYYY-MM-DDTHH:00" in the requested zone.
function currentHourKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t).value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:00`
}

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export const compassPoint = (deg) => (deg == null ? '' : POINTS[Math.round(deg / 22.5) % 16])

// Go / caution / no-go against the skipper's limits. Caution starts at 80%.
const CAUTION_RATIO = 0.8
export function rate(value, limit) {
  if (value == null || limit === '' || limit == null) return null
  if (value > limit) return 'nogo'
  if (value > limit * CAUTION_RATIO) return 'caution'
  return 'go'
}

const ORDER = { go: 0, caution: 1, nogo: 2 }
export const worst = (ratings) =>
  ratings.filter(Boolean).reduce((a, b) => (ORDER[b] > ORDER[a] ? b : a), 'go')

export function rateHour(h, limits) {
  return {
    wind: rate(h.wind, limits.maxWind),
    gust: rate(h.gust, limits.maxGust),
    wave: rate(h.wave, limits.maxWave),
  }
}
