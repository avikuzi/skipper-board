import { useEffect, useState } from 'react'
import { MARINAS, findMarina } from './data/marinas.js'
import { CHECKLIST_SECTIONS } from './data/checklists.js'
import { sunTimes, formatTime } from './lib/sun.js'
import { useStoredState } from './lib/storage.js'

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
        <GoNoGoCard settings={settings} />
        <DaylightCard marina={marina} now={now} />
        <ChecklistCard />
        <AlertsCard />
        <ThresholdsCard settings={settings} update={update} />
      </main>

      <footer className="muted foot">
        ההגדרות נשמרות במכשיר הזה בלבד. בכל מקרה של ספק, ההחלטה היא של הסקיפר.
      </footer>
    </div>
  )
}

function GoNoGoCard({ settings }) {
  const rows = [
    { label: 'רוח', unit: 'kn', limit: settings.maxWind },
    { label: 'משבים', unit: 'kn', limit: settings.maxGust },
    { label: 'גובה גל', unit: 'm', limit: settings.maxWave },
    { label: 'מחזור גל', unit: 's' },
    { label: 'ברומטר', unit: 'hPa' },
    { label: 'ראות', unit: 'km' },
  ]
  return (
    <section className="card card-hero" aria-labelledby="gonogo-title">
      <div className="card-head">
        <h2 id="gonogo-title">החלטת יציאה</h2>
        <span className="status status-pending">ממתין לתחזית</span>
      </div>
      <p className="muted">
        התחזית מתחברת בשלב הבא (Open-Meteo ו-Windy). עד אז לא מוצגים מספרים, כדי שלא תסתמך על נתון שאינו אמיתי.
      </p>
      <dl className="readouts">
        {rows.map((r) => (
          <div key={r.label} className="readout">
            <dt>{r.label}</dt>
            <dd>
              <span className="num">—</span> <span className="unit">{r.unit}</span>
            </dd>
            {r.limit !== undefined && (
              <span className="limit">
                סף <span className="num">{r.limit}</span>
              </span>
            )}
          </div>
        ))}
      </dl>
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
