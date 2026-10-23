// Home marinas. Coordinates are approximate harbour-entrance positions (WGS84).
// Radio channels and phone numbers are added and verified in step 4.
export const MARINAS = [
  { id: 'herzliya', name: 'מרינה הרצליה', lat: 32.1625, lon: 34.7955 },
  { id: 'telaviv', name: 'מרינה תל אביב', lat: 32.0862, lon: 34.7672 },
  { id: 'ashdod', name: 'מרינה אשדוד', lat: 31.7966, lon: 34.6318 },
  { id: 'haifa', name: 'מרינה חיפה', lat: 32.8085, lon: 35.0207 },
  { id: 'eilat', name: 'מרינה אילת', lat: 29.5533, lon: 34.9576 },
]

export const findMarina = (id) => MARINAS.find((m) => m.id === id) ?? MARINAS[0]
