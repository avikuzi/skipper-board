import { useEffect, useState } from 'react'
import { MARINAS, findMarina } from './data/marinas.js'
import { CHECKLIST_SECTIONS } from './data/checklists.js'
import { sunTimes, formatTime } from './lib/sun.js'
import { useStoredState } from './lib/storage.js'
import { useWeather } from './lib/useWeather.js'
import { compassPoint, rateHour, worst } from './lib/weather.js'

const DEFAULT_SETTINGS = {
  marina: 'herzliya',
  theme: 'auto',
  maxWind: 20,
  maxGust: 25,
  maxWave: 1.5,
}

const THEMES = [
  { id: 'auto', label: 'אוטומטי' },
  { id: 'light', label: 'יום' },
  { id: 'dark', label: 'לילה' },
]

function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function formatDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

export default function App() {
  const [settings, setSettings] = useStoredState('skipper-board.settings', DEFAULT_SETTINGS)
  const marina = findMarina(settings.marina)
  const now = useNow()
  const weather = useWeather(marina)
  const update = (patch) => setSettings((s) => ({ ...s, ...patch }))

  useEffect(() => {
    // Only clear a theme this app set, so a host page's own theme stays intact.
    const root = document.documentElement
    if (settings.theme !== 'auto') {
      root.setAttribute('data-theme', settings.theme)
      root.dataset.themeOwner = 'skipper-board'
    } else if (root.dataset.themeOwner) {
      root.removeAttribute('data-theme')
      delete root.dataset.themeOwner
    }
  }, [settings.theme])

  const today = now.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Jerusalem',
  })

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <h1>סקיפר-בורד</h1>
          <p className="muted">{today}</p>
        </div>
        <div className="controls">
          <label className="field">
            <span className="label">מרינת בית</span>
            <select
              id="marina"
              value={marina.id}
              onChange={(e) => update({ marina: e.target.value })}
            >
              {MARINAS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented" role="group" aria-label="מצב תצוגה">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                id={`theme-${t.id}`}
                aria-pressed={settings.theme === t.id}
                onClick={() => update({ theme: t.id })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="grid">
        <GoNoGoCard settings={settings} weather={weather} />
        <DaylightCard marina={marina} now={now} />
        <ChecklistCard />
        <AlertsCard />
        <ThresholdsCard settings={settings} update={update} />
        <WindyCard marina={marina} />
      </main>

      <footer className="muted foot">
        תחזית: Open-Meteo ו-Windy. ההגדרות נשמרות במכשיר הזה בלבד. התחזית היא כלי עזר, וההחלטה היא של הסקיפר.
      </footer>
    </div>
  )
}

const STATUS_TEXT = { go: 'GO · אפשר לצאת', caution: 'זהירות', nogo: 'NO-GO · לא לצאת' }

function GoNoGoCard({ settings, weather }) {
  const { status, data, reload } = weather
  const limits = settings
  const now = data?.now
  const ratingsNow = now ? rateHour(now, limits) : {}
  const ahead = data ? data.hours.map((h) => ({ ...h, rating: rateHour(h, limits) })) : []
  const overall = data ? worst(ahead.flatMap((h) => Object.values(h.rating))) : null
  const trend = data?.pressureTrend

  const rows = now
    ? [
        { label: 'רוח', value: fmt(now.wind, 0), unit: 'kn', extra: dirLabel(now.windDir), limit: limits.maxWind, rating: ratingsNow.wind },
        { label: 'משבים', value: fmt(now.gust, 0), unit: 'kn', limit: limits.maxGust, rating: ratingsNow.gust },
        { label: 'גובה גל', value: fmt(now.wave, 1), unit: 'm', extra: dirLabel(now.waveDir), limit: limits.maxWave, rating: ratingsNow.wave },
        { label: 'מחזור גל', value: fmt(now.wavePeriod, 0), unit: 's' },
        { label: 'ברומטר', value: fmt(now.pressure, 0), unit: 'hPa', extra: trendLabel(trend) },
        { label: 'ראות', value: fmt(now.visibility == null ? null : now.visibility / 1000, 0), unit: 'km' },
        { label: 'טמפ׳ מים', value: fmt(now.seaTemp, 0), unit: '°C' },
      ]
    : []

  let badge = <span className="status status-pending">טוען תחזית…</span>
  if (overall) badge = <span className={`status status-${overall}`}>{STATUS_TEXT[overall]}</span>
  else if (status === 'error') badge = <span className="status status-pending">אין תחזית</span>

  return (
    <section className="card card-hero" aria-labelledby="gonogo-title">
      <div className="card-head">
        <h2 id="gonogo-title">החלטת יציאה</h2>
        {badge}
      </div>
      {overall && (
        <p className="muted small">
          לפי הספים שלך, על פני 12 השעות הקרובות. {data.fetchedAt && `עודכן ${formatTime(data.fetchedAt)}`}
        </p>
      )}
      {status === 'error' && (
        <p className="error">
          לא הצלחתי למשוך תחזית מ-Open-Meteo. בדוק חיבור לאינטרנט ו
          <button type="button" className="linkish" id="weather-retry" onClick={reload}>
            נסה שוב
          </button>
          .
        </p>
      )}
      {now && (
        <dl className="readouts">
          {rows.map((r) => (
            <div key={r.label} className={`readout ${r.rating ? `rated rated-${r.rating}` : ''}`}>
              <dt>{r.label}</dt>
              <dd>
                <span className="num">{r.value}</span> <span className="unit">{r.unit}</span>
              </dd>
              {(r.extra || r.limit !== undefined) && (
                <span className="limit">
                  {r.extra}
                  {r.extra && r.limit !== undefined && ' · '}
                  {r.limit !== undefined && (
                    <>
                      סף <span className="num">{r.limit}</span>
                    </>
                  )}
                </span>
              )}
            </div>
          ))}
        </dl>
      )}
      {ahead.length > 1 && <HourlyStrip hours={ahead} />}
    </section>
  )
}

function HourlyStrip({ hours }) {
  return (
    <div className="hourly" role="region" aria-label="תחזית לפי שעה" tabIndex={0}>
      <table>
        <thead>
          <tr>
            <th scope="row">שעה</th>
            {hours.map((h) => (
              <th key={h.time} scope="col" className="num">
                {h.time.slice(11, 16)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">רוח kn</th>
            {hours.map((h) => (
              <td key={h.time} className={`num cell-${h.rating.wind ?? 'none'}`}>
                {fmt(h.wind, 0)}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">משבים kn</th>
            {hours.map((h) => (
              <td key={h.time} className={`num cell-${h.rating.gust ?? 'none'}`}>
                {fmt(h.gust, 0)}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">כיוון</th>
            {hours.map((h) => (
              <td key={h.time} className="num">
                <WindArrow deg={h.windDir} />
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">גל m</th>
            {hours.map((h) => (
              <td key={h.time} className={`num cell-${h.rating.wave ?? 'none'}`}>
                {fmt(h.wave, 1)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// Compass point the wind comes from, with degrees on hover.
function WindArrow({ deg }) {
  if (deg == null) return '—'
  return <span title={`${Math.round(deg)}°`}>{compassPoint(deg)}</span>
}

const fmt = (v, digits) => (v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(digits))
const dirLabel = (deg) =>
  deg == null ? '' : <span className="num">{`${compassPoint(deg)} ${Math.round(deg)}°`}</span>
function trendLabel(t) {
  if (t == null) return ''
  if (t <= -3) return `יורד מהר ${t.toFixed(1)}`
  if (t < -0.5) return 'יורד'
  if (t > 0.5) return 'עולה'
  return 'יציב'
}

function WindyCard({ marina }) {
  const [overlay, setOverlay] = useState('wind')
  const src =
    'https://embed.windy.com/embed2.html?' +
    new URLSearchParams({
      lat: marina.lat.toFixed(3),
      lon: marina.lon.toFixed(3),
      detailLat: marina.lat.toFixed(3),
      detailLon: marina.lon.toFixed(3),
      zoom: '9',
      level: 'surface',
      overlay,
      product: overlay === 'waves' ? 'ecmwfWaves' : 'ecmwf',
      menu: '',
      message: 'true',
      marker: 'true',
      calendar: 'now',
      type: 'map',
      location: 'coordinates',
      metricWind: 'kt',
      metricTemp: '°C',
    })
  return (
    <section className="card card-wide" aria-labelledby="windy-title">
      <div className="card-head">
        <h2 id="windy-title">מפת Windy</h2>
        <div className="segmented" role="group" aria-label="שכבת מפה">
          {[
            ['wind', 'רוח'],
            ['waves', 'גלים'],
            ['gust', 'משבים'],
          ].map(([id, label]) => (
            <button key={id} type="button" id={`windy-${id}`} aria-pressed={overlay === id} onClick={() => setOverlay(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="windy">
        <iframe title={`Windy ${marina.name}`} src={src} loading="lazy" />
      </div>
    </section>
  )
}

function DaylightCard({ marina, now }) {
  const sun = sunTimes(now, marina.lat, marina.lon)
  if (!sun) return null
  const { sunrise, sunset } = sun
  const beforeSunrise = now < sunrise
  const afterSunset = now > sunset
  const span = sunset - sunrise
  const progress = Math.min(1, Math.max(0, (now - sunrise) / span))

  let headline
  if (beforeSunrise) headline = `זריחה בעוד ${formatDuration(sunrise - now)}`
  else if (afterSunset) headline = 'אחרי השקיעה'
  else headline = `${formatDuration(sunset - now)} שעות אור נותרו`

  return (
    <section className="card" aria-labelledby="daylight-title">
      <div className="card-head">
        <h2 id="daylight-title">שעות אור</h2>
        <span className="muted small">{marina.name}</span>
      </div>
      <p className="big">{headline}</p>
      <div className="daybar" aria-hidden="true">
        <span style={{ insetInlineStart: `${progress * 100}%` }} />
      </div>
      <dl className="pair">
        <div>
          <dt>זריחה</dt>
          <dd className="num">{formatTime(sunrise)}</dd>
        </div>
        <div>
          <dt>שקיעה</dt>
          <dd className="num">{formatTime(sunset)}</dd>
        </div>
      </dl>
      <p className="muted small">תכנן כניסה למרינה לפני השקיעה.</p>
    </section>
  )
}

function ChecklistCard() {
  const total = CHECKLIST_SECTIONS.reduce((n, s) => n + s.items, 0)
  return (
    <section className="card" aria-labelledby="check-title">
      <div className="card-head">
        <h2 id="check-title">צ'ק-ליסט לפני יציאה</h2>
        <span className="num badge">0/{total}</span>
      </div>
      <ul className="sections">
        {CHECKLIST_SECTIONS.map((s) => (
          <li key={s.id}>
            <span>{s.title}</span>
            <span className="num muted">0/{s.items}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">הסימון עצמו נפתח בשלב 3.</p>
    </section>
  )
}

function AlertsCard() {
  return (
    <section className="card" aria-labelledby="alerts-title">
      <div className="card-head">
        <h2 id="alerts-title">אזהרות ניווט</h2>
        <span className="status status-pending">לא מחובר</span>
      </div>
      <p className="muted">אזהרות משיטים (NOTMAR) ופרטי המרינה יתווספו בשלב 4.</p>
      <div className="vhf">
        <span className="label">חירום</span>
        <span className="num">VHF 16</span>
      </div>
    </section>
  )
}

function ThresholdsCard({ settings, update }) {
  const fields = [
    { key: 'maxWind', label: 'רוח מקסימלית', unit: 'kn', step: 1 },
    { key: 'maxGust', label: 'משבים מקסימליים', unit: 'kn', step: 1 },
    { key: 'maxWave', label: 'גובה גל מקסימלי', unit: 'm', step: 0.1 },
  ]
  return (
    <section className="card" aria-labelledby="limits-title">
      <div className="card-head">
        <h2 id="limits-title">ספי בטיחות</h2>
      </div>
      <p className="muted small">מעל הסף: אדום. עד 80% ממנו: ירוק. ביניהם: צהוב.</p>
      <div className="limits">
        {fields.map((f) => (
          <label key={f.key} className="field">
            <span className="label">{f.label}</span>
            <span className="input-unit">
              <input
                id={`limit-${f.key}`}
                type="number"
                inputMode="decimal"
                min="0"
                step={f.step}
                value={settings[f.key]}
                onChange={(e) => update({ [f.key]: e.target.value === '' ? '' : Number(e.target.value) })}
              />
              <span className="unit">{f.unit}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  )
}
