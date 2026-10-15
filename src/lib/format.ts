// Formatos en español de Perú, siempre en la zona horaria del negocio (RN-008)
const locale = 'es-PE'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const fmt = (tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: tz, ...o })

export const time = (iso: string | Date, tz: string) =>
  fmt(tz, { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).replace('a. m.', 'a. m.').replace('p. m.', 'p. m.')
export const shortTime = (iso: string | Date, tz: string) =>
  fmt(tz, { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).replace(/\s?[ap]\.\s?m\./, '')
export const longDay = (iso: string | Date, tz: string) => cap(fmt(tz, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso)).replace(',', ''))
export const shortDay = (iso: string | Date, tz: string) =>
  cap(fmt(tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace(/\./g, '').replace(',', ''))
export const dayTime = (iso: string, tz: string) => `${shortDay(iso, tz)} · ${time(iso, tz)}`
export const monthYear = (d: Date, tz: string) => cap(fmt(tz, { month: 'long', year: 'numeric' }).format(d))
export const hourOf = (iso: string, tz: string) => Number(fmt(tz, { hour: 'numeric', hour12: false }).format(new Date(iso)))

export const money = (v: number) => `S/ ${Number(v).toLocaleString(locale, { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
export const duration = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`)

/** "2026-10-15" del día en la zona dada */
export const sqlDate = (d: Date, tz: string) => fmt(tz, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).split('/').reverse().join('-')
export const todayIn = (tz: string) => sqlDate(new Date(), tz)
export const addDays = (sql: string, n: number) => {
  const [y, m, d] = sql.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}
/** 1 = lunes … 7 = domingo */
export const isoWeekday = (sql: string) => { const d = new Date(sql + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d }

export const weekdayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const weekdayShort = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const hm = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

export const phonePretty = (e164?: string | null) => {
  if (!e164) return ''
  const d = e164.replace(/\D/g, '')
  return d.length === 11 && d.startsWith('51') ? `+51 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : e164
}
export const toE164 = (raw: string) => {
  const d = raw.replace(/\D/g, '')
  return raw.trim().startsWith('+') ? `+${d}` : d.length === 9 ? `+51${d}` : `+${d}`
}
export const whatsapp = (phone?: string | null, text?: string) =>
  `https://wa.me/${(phone ?? '').replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`
export const initials = (s: string) => s.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/** ¿Está abierto ahora? → "Abierto · cierra 8:00 p. m." */
export function openNow(hours: { weekday: number; start: string; end: string }[], tz: string) {
  const now = new Date()
  const wd = isoWeekday(sqlDate(now, tz))
  const hhmm = fmt(tz, { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
  const today = hours.filter((h) => h.weekday === wd)
  const current = today.find((h) => h.start.slice(0, 5) <= hhmm && hhmm < h.end.slice(0, 5))
  if (current) return { open: true, label: `Abierto · cierra ${hm(current.end)}` }
  const next = today.find((h) => h.start.slice(0, 5) > hhmm)
  return { open: false, label: next ? `Cerrado · abre ${hm(next.start)}` : 'Cerrado ahora' }
}

/** "Lun–Sáb · 9:00 a. m. – 8:00 p. m. · Dom cerrado" */
export function hoursSummary(hours: { weekday: number; start: string; end: string }[]) {
  const days = [...new Set(hours.map((h) => h.weekday))].sort()
  if (!days.length) return 'Sin horario publicado'
  const first = hours.find((h) => h.weekday === days[0])!
  const contiguous = days.length === days[days.length - 1] - days[0] + 1
  const range = contiguous ? `${weekdayShort[days[0] - 1]}–${weekdayShort[days[days.length - 1] - 1]}` : days.map((d) => weekdayShort[d - 1]).join(', ')
  const closed = [1, 2, 3, 4, 5, 6, 7].filter((d) => !days.includes(d)).map((d) => `${weekdayShort[d - 1]} cerrado`)
  return [range, `${hm(first.start)} – ${hm(first.end)}`, ...closed].join(' · ')
}

/** Cómo llamar a "quien atiende": profesional, espacio (cancha, sala), equipo, o una mezcla */
export function unitNoun(kinds: ('person' | 'space' | 'equipment' | undefined)[]) {
  const set = new Set(kinds.map((k) => k ?? 'person'))
  const k = set.size === 1 ? [...set][0] : set.size === 0 ? 'person' : 'mixed'
  const n = {
    person: { singular: 'profesional', plural: 'profesionales', question: '¿Con quién quieres tu cita?', any: 'Cualquier profesional disponible', anyHint: 'Te asignamos a quien tenga el horario libre.' },
    space: { singular: 'espacio', plural: 'espacios', question: '¿Qué espacio quieres reservar?', any: 'Cualquier espacio disponible', anyHint: 'Te asignamos el que esté libre en ese horario.' },
    equipment: { singular: 'equipo', plural: 'equipos', question: '¿Qué equipo quieres reservar?', any: 'Cualquier equipo disponible', anyHint: 'Te asignamos el que esté libre en ese horario.' },
    mixed: { singular: 'opción', plural: 'opciones', question: '¿Qué quieres reservar?', any: 'Cualquier opción disponible', anyHint: 'Te asignamos la que esté libre en ese horario.' },
  }[k]
  return { ...n, title: n.singular[0].toUpperCase() + n.singular.slice(1) }
}

/** "con Andrés" para personas, "en Cancha 1" para espacios y equipos */
export const withUnit = (name: string, kind?: string) => (!kind || kind === 'person' ? `con ${name}` : `en ${name}`)
