import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { mediaUrl } from '../lib/supabase'
import { addDays, hourOf, initials, isoWeekday, monthYear, shortTime, todayIn } from '../lib/format'
import type { Business } from '../lib/types'

export function Avatar({ name, path, size = 44 }: { name: string; path?: string | null; size?: number }) {
  const src = mediaUrl(path)
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {src ? <img src={src} alt="" /> : initials(name)}
    </div>
  )
}

/** "Barbería El Corte" → "EC" (se omite la categoría al inicio) */
export const businessInitials = (name: string, category?: string) => {
  const w = name.split(' ')
  return w.length > 2 && w[0].toLowerCase() === category?.toLowerCase() ? initials(w.slice(1).join(' ')) : initials(name)
}

export function Logo({ biz, size = 56 }: { biz: { name: string; logo_path?: string | null; category?: string }; size?: number }) {
  const src = mediaUrl(biz.logo_path)
  return (
    <div className="logo" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {src ? <img src={src} alt="" /> : businessInitials(biz.name, biz.category)}
    </div>
  )
}

/** Aplica el color y el estilo de botones del negocio (Apariencia del portal) */
export function useBusinessTheme(biz?: Business | null) {
  useEffect(() => {
    if (!biz) return
    const root = document.documentElement
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const color = biz.primary_color || '#1C1C1E'
    // En modo oscuro, un color muy oscuro no se ve: se usa el texto claro por defecto
    const lum = luminance(color)
    if (!(dark && lum < 0.08)) {
      root.style.setProperty('--accent', color)
      root.style.setProperty('--accent-text', lum > 0.6 ? '#000' : '#fff')
    }
    root.style.setProperty('--radius-btn', biz.button_style === 'square' ? '10px' : '999px')
    if (biz.font_style === 'serif') root.style.setProperty('--font', 'ui-serif, Georgia, "Times New Roman", serif')
    if (biz.font_style === 'rounded') root.style.setProperty('--font', 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif')
    document.title = `${biz.name} · Reserva tu cita`
    return () => { root.removeAttribute('style') }
  }, [biz])
}

function luminance(hex: string) {
  const v = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function TopBar({ url, back, right }: { url?: string; back?: { to: string; label: string } | (() => void); right?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        {typeof back === 'function' ? (
          <button className="btn ghost small" onClick={back}>‹ Atrás</button>
        ) : back ? (
          <Link className="btn ghost small" to={back.to}>‹ {back.label}</Link>
        ) : (
          <Link to="/" className="row" style={{ textDecoration: 'none', gap: 8 }}>
            <img src="/logo-horizontal.png" alt="Agendin" height={30} style={{ height: 30, width: 'auto' }} />
          </Link>
        )}
        <div className="grow url center">{url}</div>
        <div style={{ minWidth: 60, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
      </div>
    </header>
  )
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="modal-bg" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}

export function Loading({ lines = 3 }: { lines?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: lines }).map((_, i) => <div key={i} className="skeleton" style={{ height: i === 0 ? 120 : 56 }} />)}
    </div>
  )
}

const mascotFor: Record<string, string> = { '🔎': 'worried', '🔗': 'worried', '📄': 'worried', '⏸': 'sleep', '📅': 'sleep' }

export function Mascot({ kind, size = 160 }: { kind: 'wave' | 'celebrate' | 'sleep' | 'worried'; size?: number }) {
  return <img src={`/mascot-${kind}.png`} alt="" width={size} style={{ height: 'auto', margin: '0 auto' }} />
}

export function Empty({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: ReactNode }) {
  const m = mascotFor[icon]
  return (
    <div className="stack center" style={{ padding: '56px 8px', alignItems: 'center' }}>
      {m ? <Mascot kind={m as 'sleep'} size={150} /> : <div style={{ fontSize: 44 }} aria-hidden>{icon}</div>}
      <h2>{title}</h2>
      {text && <p className="muted" style={{ maxWidth: 420 }}>{text}</p>}
      {children}
    </div>
  )
}

/** Calendario mensual; los días sin horarios aparecen tachados */
export function Calendar({ tz, value, onChange, available, maxDays = 60 }: {
  tz: string; value: string | null; onChange: (d: string) => void; available: Set<string> | null; maxDays?: number
}) {
  const today = todayIn(tz)
  const [month, setMonth] = useState(() => (value ?? today).slice(0, 7))
  const days = useMemo(() => {
    const first = `${month}-01`
    const lead = isoWeekday(first) - 1
    const [y, m] = month.split('-').map(Number)
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => addDays(first, i))]
  }, [month])
  const last = addDays(today, maxDays)
  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 + n, 1))
    setMonth(d.toISOString().slice(0, 7))
  }
  return (
    <div className="cal">
      <div className="cal-head">
        <strong>{monthYear(new Date(`${month}-15T12:00:00Z`), 'UTC')}</strong>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn" onClick={() => shift(-1)} disabled={month <= today.slice(0, 7)} aria-label="Mes anterior">‹</button>
          <button className="icon-btn" onClick={() => shift(1)} disabled={month >= last.slice(0, 7)} aria-label="Mes siguiente">›</button>
        </div>
      </div>
      <div className="cal-grid">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i} className="dow">{d}</div>)}
        {days.map((d, i) => {
          if (!d) return <div key={i} />
          const off = d < today || d > last || (available !== null && !available.has(d))
          return (
            <button key={d} disabled={off} className={[d === value ? 'sel' : '', d === today ? 'today' : ''].join(' ')}
              onClick={() => onChange(d)} aria-label={d} aria-pressed={d === value}>
              {Number(d.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Horarios agrupados en mañana / tarde / noche */
export function SlotGrid({ slots, tz, value, onChange }: { slots: string[]; tz: string; value: string | null; onChange: (s: string) => void }) {
  const groups = [
    ['Mañana', slots.filter((s) => hourOf(s, tz) < 12)],
    ['Tarde', slots.filter((s) => hourOf(s, tz) >= 12 && hourOf(s, tz) < 18)],
    ['Noche', slots.filter((s) => hourOf(s, tz) >= 18)],
  ] as const
  return (
    <div className="stack">
      {groups.filter(([, l]) => l.length).map(([title, list]) => (
        <div key={title} className="stack" style={{ gap: 8 }}>
          <div className="section-title" style={{ margin: 0 }}>{title}</div>
          <div className="slots">
            {list.map((s) => (
              <button key={s} className={`slot ${s === value ? 'on' : ''}`} onClick={() => onChange(s)} aria-pressed={s === value}>
                {shortTime(s, tz)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      Reservas con <a href="/">Agendin</a> · <a href="/privacidad">Privacidad</a> · <a href="/terminos">Términos</a>
    </footer>
  )
}
