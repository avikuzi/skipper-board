// Sunrise and sunset from the NOAA solar equations (accurate to about a minute
// at Israeli latitudes). Returns Date objects, or null for polar day/night.
const rad = Math.PI / 180

export function sunTimes(date, lat, lon) {
  const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const n = Math.floor((start - Date.UTC(2000, 0, 1, 12)) / 86400000) + 1
  const jStar = n - lon / 360
  const M = (357.5291 + 0.98560028 * jStar) % 360
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad)
  const L = (M + C + 180 + 102.9372) % 360
  const jTransit = 2451545 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad)
  const decl = Math.asin(Math.sin(L * rad) * Math.sin(23.44 * rad))
  const cosH =
    (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) /
    (Math.cos(lat * rad) * Math.cos(decl))
  if (cosH < -1 || cosH > 1) return null
  const H = Math.acos(cosH) / rad / 360
  const toDate = (j) => new Date((j - 2440587.5) * 86400000)
  return { sunrise: toDate(jTransit - H), sunset: toDate(jTransit + H) }
}

export const formatTime = (d) =>
  d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })
