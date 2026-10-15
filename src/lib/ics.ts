// Archivo .ics para "Agregar a mi calendario" (RF-057, V2)
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')

export function icsFile(o: { title: string; start: string; end: string; location?: string; description?: string; uid: string }) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agendin//Reservas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${o.uid}@agendin`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(o.start)}`, `DTEND:${stamp(o.end)}`, `SUMMARY:${esc(o.title)}`,
    o.location ? `LOCATION:${esc(o.location)}` : '', o.description ? `DESCRIPTION:${esc(o.description)}` : '',
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(o.title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

export function downloadIcs(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${name}.ics`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const googleCalendarUrl = (o: { title: string; start: string; end: string; location?: string; description?: string }) =>
  `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(o.title)}&dates=${stamp(o.start)}/${stamp(o.end)}` +
  `&location=${encodeURIComponent(o.location ?? '')}&details=${encodeURIComponent(o.description ?? '')}`

export const outlookUrl = (o: { title: string; start: string; end: string; location?: string; description?: string }) =>
  `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(o.title)}&startdt=${encodeURIComponent(o.start)}` +
  `&enddt=${encodeURIComponent(o.end)}&location=${encodeURIComponent(o.location ?? '')}&body=${encodeURIComponent(o.description ?? '')}`
