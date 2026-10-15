import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { mediaUrl, rpc } from '../lib/supabase'
import { addDays, dayTime, longDay, money, phonePretty, time, todayIn, whatsapp, unitNoun, withUnit } from '../lib/format'
import { downloadIcs, googleCalendarUrl, icsFile, outlookUrl } from '../lib/ics'
import type { Booking, PaymentInfo } from '../lib/types'
import { Calendar, Empty, Loading, Logo, Modal, SlotGrid, TopBar } from '../components/ui'

type View = 'detail' | 'reschedule'
type Payment = { amount: number; method: string; status: 'pending_verification' | 'verified' | 'rejected'; paid_at: string }

const statusInfo: Record<Booking['status'], [string, string]> = {
  pending: ['Pendiente', 'orange'], confirmed: ['Confirmada', 'dark'], completed: ['Completada', 'green'],
  no_show: ['No asistió', 'red'], cancelled: ['Cancelada', ''], rejected: ['No aceptada', 'red'],
}

export default function ManagePage() {
  const { token } = useParams()
  const [params, setParams] = useSearchParams()
  const [b, setB] = useState<Booking | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'invalid'>('loading')
  const [view, setView] = useState<View>('detail')
  const [payments, setPayments] = useState<Payment[]>([])
  const [cancelling, setCancelling] = useState(false)
  const [calendar, setCalendar] = useState(false)
  const [copied, setCopied] = useState(false)
  const isNew = params.get('nueva') === '1'
  const amountDue = Number(params.get('pagar') ?? 0)

  const load = useCallback(async () => {
    try {
      const data = await rpc<Booking | null>('public_booking', { p_token: token })
      if (!data) { setState('invalid'); return }
      setB(data); setState('ok')
      setPayments(await rpc<Payment[]>('public_booking_payments', { p_token: token }).catch(() => []))
    } catch { setState('invalid') }
  }, [token])
  useEffect(() => { load() }, [load])

  if (state === 'loading') return <><TopBar /><div className="page narrow" style={{ paddingTop: 24 }}><Loading /></div></>
  if (state === 'invalid' || !b) return (
    <><TopBar /><div className="page narrow"><Empty icon="🔗" title="Enlace no válido"
      text="Este enlace no existe o ya no está disponible. Revisa el mensaje que recibiste o escríbele al negocio." /></div></>
  )

  const tz = b.business.timezone
  const end = b.extra.length ? b.extra[b.extra.length - 1].ends_at : b.ends_at
  const total = Number(b.price) + b.extra.reduce((a, x) => a + Number(x.price), 0)
  const serviceName = [b.service, ...b.extra.map((x) => x.service)].join(' + ')
  const active = b.status === 'pending' || b.status === 'confirmed'
  const pendingPayment = payments.some((p) => p.status === 'pending_verification')
  const needsPayment = b.status === 'pending' && (amountDue > 0 || pendingPayment)
  const link = `${location.origin}/c/${token}`
  const calEvent = {
    title: `${serviceName} · ${b.business.name}`, start: b.starts_at, end,
    location: [b.business.address, b.business.city].filter(Boolean).join(', '),
    description: `Reserva ${b.reference} ${withUnit(b.staff, b.staff_kind)}. Gestiona tu cita: ${link}`,
  }

  if (view === 'reschedule') return <Reschedule b={b} token={token!} onDone={() => { setView('detail'); load() }} onBack={() => setView('detail')} />

  return (
    <>
      <TopBar url={`${location.host}/c/${token}`} />
      <div className="page narrow stack-lg" style={{ paddingTop: 24 }}>
        {isNew && active && (
          <div className="stack center">
            <img src={b.status === 'confirmed' ? '/mascot-celebrate.png' : '/mascot-wave.png'} alt="" width={150} style={{ margin: '0 auto', height: 'auto' }} />
            <h1>{b.status === 'confirmed' ? '¡Reserva confirmada!' : needsPayment ? 'Falta tu pago' : 'Solicitud enviada'}</h1>
            <p className="muted">
              {b.status === 'confirmed' ? `Te esperamos el ${longDay(b.starts_at, tz).toLowerCase()} a las ${time(b.starts_at, tz)}`
                : needsPayment ? 'Paga el depósito para asegurar tu horario.'
                : `${b.business.name} confirmará tu cita pronto. Aún no está confirmada.`}
            </p>
          </div>
        )}

        <div className="row">
          <Logo biz={b.business} size={52} />
          <div className="grow">
            <h3>{b.business.name}</h3>
            <p className="muted small">{[b.business.category, b.business.city].filter(Boolean).join(' · ')}</p>
          </div>
        </div>

        <div className="card stack" style={{ gap: 0 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <h2>Tu cita</h2>
            <span className={`badge ${statusInfo[b.status][1]}`}>{statusInfo[b.status][0]}</span>
          </div>
          <div className="summary-row"><span>Reserva</span><span className="ref" style={{ fontSize: 16 }}>{b.reference}</span></div>
          <div className="summary-row"><span>Servicio</span><span>{serviceName}</span></div>
          <div className="summary-row"><span>{unitNoun([b.staff_kind]).title}</span><span>{b.staff}</span></div>
          <div className="summary-row"><span>Fecha</span><span>{longDay(b.starts_at, tz)}</span></div>
          <div className="summary-row"><span>Hora</span><span>{time(b.starts_at, tz)} – {time(end, tz)}</span></div>
          <div className="summary-row"><span>Precio</span><span>{money(total)}</span></div>
          {b.business.address && <div className="summary-row"><span>Lugar</span><span>{b.business.address}</span></div>}
          {b.status === 'cancelled' && b.cancel_reason && <div className="summary-row"><span>Motivo</span><span>{b.cancel_reason}</span></div>}
        </div>

        {(needsPayment || payments.length > 0) && b.status !== 'cancelled' && (
          <PaymentSection token={token!} slug={b.business.slug} amount={amountDue || total} payments={payments}
            expires={b.pending_expires_at} tz={tz} onReported={load} />
        )}

        {b.status === 'cancelled' && (
          <div className="stack center">
            <p className="muted">Esta cita fue cancelada y el negocio ya fue notificado.</p>
            <Link className="btn" to={`/${b.business.slug}`}>Reservar otra cita</Link>
          </div>
        )}
        {b.status === 'rejected' && (
          <div className="stack center">
            <p className="muted">El negocio no pudo aceptar esta solicitud. Puedes elegir otro horario.</p>
            <Link className="btn" to={`/${b.business.slug}`}>Ver horarios</Link>
          </div>
        )}

        {active && (b.can_change ? (
          <div className="stack">
            <div className="row" style={{ gap: 10 }}>
              {b.allow_reschedule && b.reschedules_left > 0 && b.extra.length === 0 &&
                <button className="btn secondary grow" onClick={() => setView('reschedule')}>Reprogramar</button>}
              {b.allow_cancel && <button className="btn secondary grow" style={{ color: 'var(--red)' }} onClick={() => setCancelling(true)}>Cancelar cita</button>}
            </div>
            <p className="hint center">Puedes hacer cambios hasta el {dayTime(b.change_deadline, tz).toLowerCase()}.</p>
          </div>
        ) : (
          <div className="notice warn">
            <span aria-hidden>⚠️</span>
            <div className="stack" style={{ gap: 6 }}>
              <strong>Ya no es posible hacer cambios en línea</strong>
              <span>Tu cita es pronto. Para cambiarla o cancelarla, comunícate con el negocio.</span>
            </div>
          </div>
        ))}

        {active && (
          <div className="card flush list">
            <button className="list-row link" style={{ textDecoration: 'none', width: '100%', border: 0, background: 'none', cursor: 'pointer' }} onClick={() => setCalendar(true)}>
              <span aria-hidden>📅</span><span className="grow" style={{ textAlign: 'left' }}>Agregar a mi calendario</span><span className="muted">›</span>
            </button>
            {b.business.phone && (
              <a className="list-row" style={{ textDecoration: 'none' }} target="_blank" rel="noreferrer"
                href={whatsapp(b.business.phone, `Hola, tengo la reserva ${b.reference} (${dayTime(b.starts_at, tz)}).`)}>
                <span aria-hidden>💬</span><span className="grow">Escribir al negocio por WhatsApp</span><span className="muted">›</span>
              </a>
            )}
            {b.business.phone && (
              <a className="list-row" style={{ textDecoration: 'none' }} href={`tel:${b.business.phone}`}>
                <span aria-hidden>📞</span><span className="grow">Llamar · {phonePretty(b.business.phone)}</span><span className="muted">›</span>
              </a>
            )}
          </div>
        )}

        {active && (
          <div className="card stack">
            <strong>Tu enlace para gestionar la cita</strong>
            <p className="muted small">Guárdalo para consultar, cambiar o cancelar tu cita.</p>
            <div className="row">
              <code className="grow small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.replace(/^https?:\/\//, '')}</code>
              <button className="btn small secondary" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true) }}>{copied ? 'Copiado' : 'Copiar'}</button>
            </div>
            {'share' in navigator && <button className="btn small ghost" onClick={() => navigator.share({ title: 'Mi cita', url: link })}>Compartir</button>}
          </div>
        )}

        {isNew && <button className="link small center" onClick={() => { params.delete('nueva'); params.delete('pagar'); setParams(params) }}>Ver solo los detalles</button>}
      </div>

      {cancelling && <CancelModal b={b} token={token!} onClose={() => setCancelling(false)} onDone={() => { setCancelling(false); load() }} />}
      {calendar && (
        <Modal onClose={() => setCalendar(false)}>
          <div className="stack">
            <h2>Agregar a mi calendario</h2>
            <p className="muted small">{serviceName} · {dayTime(b.starts_at, tz)}</p>
            <a className="pick" href={googleCalendarUrl(calEvent)} target="_blank" rel="noreferrer"><strong className="grow">Google Calendar</strong><span className="muted">›</span></a>
            <button className="pick" onClick={() => downloadIcs(`cita-${b.reference}`, icsFile({ ...calEvent, uid: b.reference }))}>
              <div className="grow"><strong>Calendario de Apple</strong><p className="muted small">Descarga el evento para iPhone o Mac</p></div><span className="muted">›</span></button>
            <a className="pick" href={outlookUrl(calEvent)} target="_blank" rel="noreferrer"><strong className="grow">Outlook</strong><span className="muted">›</span></a>
            <button className="pick" onClick={() => downloadIcs(`cita-${b.reference}`, icsFile({ ...calEvent, uid: b.reference }))}>
              <div className="grow"><strong>Descargar archivo .ics</strong><p className="muted small">Funciona con cualquier calendario</p></div><span className="muted">›</span></button>
            <p className="hint">El evento incluye la dirección y el enlace para gestionar tu cita.</p>
          </div>
        </Modal>
      )}
    </>
  )
}

function CancelModal({ b, token, onClose, onDone }: { b: Booking; token: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal onClose={onClose}>
      <div className="stack">
        <h2>¿Cancelar tu cita?</h2>
        <p className="muted">{dayTime(b.starts_at, b.business.timezone)} {withUnit(b.staff, b.staff_kind)}. El horario quedará libre para otra persona.</p>
        <div className="field"><label htmlFor="r">Motivo (opcional)</label>
          <input id="r" className="input" placeholder="Ej.: tuve un imprevisto" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {error && <p className="error">{error}</p>}
        <button className="btn danger block" disabled={busy} onClick={async () => {
          setBusy(true); setError(null)
          try { await rpc('public_cancel', { p_token: token, p_reason: reason.trim() || null }); onDone() }
          catch (e) { setError((e as Error).message) } finally { setBusy(false) }
        }}>{busy ? 'Cancelando…' : 'Sí, cancelar'}</button>
        <button className="btn secondary block" onClick={onClose}>No, mantener mi cita</button>
      </div>
    </Modal>
  )
}

function Reschedule({ b, token, onDone, onBack }: { b: Booking; token: string; onDone: () => void; onBack: () => void }) {
  const tz = b.business.timezone
  const [date, setDate] = useState<string>(todayIn(tz))
  const [slots, setSlots] = useState<string[] | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSlots(null); setPick(null)
    rpc<{ starts_at: string }[]>('public_reschedule_slots', { p_token: token, p_date: date })
      .then((r) => setSlots([...new Set(r.map((x) => x.starts_at))].sort())).catch(() => setSlots([]))
  }, [date, token])

  return (
    <>
      <TopBar back={onBack} url="Reprogramar" />
      <div className="page narrow stack-lg" style={{ paddingTop: 24 }}>
        <h1 style={{ fontSize: 26 }}>Elige una nueva fecha</h1>
        <div className="notice"><span className="badge">Actual</span><span>{dayTime(b.starts_at, tz)} · {b.service}</span></div>
        <div className="card"><Calendar tz={tz} value={date} onChange={setDate} available={null} maxDays={60} /></div>
        <div className="stack">
          <h3>{longDay(date + 'T12:00:00Z', 'UTC')} · {b.staff}</h3>
          {slots === null ? <Loading lines={2} /> : slots.length ? <SlotGrid slots={slots} tz={tz} value={pick} onChange={setPick} />
            : <p className="muted">No hay horarios libres este día.</p>}
        </div>
        <p className="hint">{b.reschedules_left === 1 ? 'Te queda 1 cambio para esta cita.' : `Te quedan ${b.reschedules_left} cambios para esta cita.`}</p>
        {error && <p className="error">{error}</p>}
        <div className="bar-bottom">
          <div className="row between">
            <div className="grow small">{pick ? <strong>{dayTime(pick, tz)}</strong> : <span className="muted">Elige un horario</span>}</div>
            <button className="btn" disabled={!pick || busy} onClick={async () => {
              setBusy(true); setError(null)
              try { await rpc('public_reschedule', { p_token: token, p_starts_at: pick }); onDone() }
              catch (e) { setError((e as Error).message) } finally { setBusy(false) }
            }}>{busy ? 'Guardando…' : 'Confirmar nuevo horario'}</button>
          </div>
        </div>
      </div>
    </>
  )
}

/** Pago del depósito por Yape o transferencia y su verificación (V2) */
function PaymentSection({ token, slug, amount, payments, expires, tz, onReported }: {
  token: string; slug: string; amount: number; payments: Payment[]; expires: string | null; tz: string; onReported: () => void
}) {
  const [info, setInfo] = useState<PaymentInfo | null>(null)
  const [method, setMethod] = useState<'yape' | 'transfer'>('yape')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    rpc<PaymentInfo | null>('public_payment_info', { p_slug: slug }).then((i) => {
      setInfo(i)
      if (i && !i.yape_enabled && i.transfer_enabled) setMethod('transfer')
    })
  }, [slug])

  const pending = payments.find((p) => p.status === 'pending_verification')
  const verified = payments.filter((p) => p.status === 'verified')
  if (verified.length) return <div className="notice ok"><span aria-hidden>✓</span><span>Pago verificado: {money(verified.reduce((a, p) => a + Number(p.amount), 0))}.</span></div>
  if (pending) return (
    <div className="notice warn"><span aria-hidden>⏳</span>
      <div className="stack" style={{ gap: 4 }}><strong>Pago en verificación</strong>
        <span>Reportaste {money(Number(pending.amount))} por {pending.method === 'yape' ? 'Yape' : 'transferencia'}. El negocio lo revisará y confirmará tu cita.</span></div>
    </div>
  )
  if (!info) return null

  return (
    <div className="card stack">
      <div className="row between"><h2>Paga tu depósito</h2><strong>{money(amount)}</strong></div>
      {expires && <p className="hint">Paga antes de las {time(expires, tz)} del {addDays(todayIn(tz), 0) === expires.slice(0, 10) ? 'hoy' : longDay(expires, tz).toLowerCase()} para mantener tu horario.</p>}
      <div className="chips">
        {info.yape_enabled && <button className={`chip ${method === 'yape' ? 'on' : ''}`} onClick={() => setMethod('yape')}>Yape</button>}
        {info.transfer_enabled && <button className={`chip ${method === 'transfer' ? 'on' : ''}`} onClick={() => setMethod('transfer')}>Transferencia</button>}
      </div>
      {method === 'yape' ? (
        <div className="stack" style={{ gap: 6 }}>
          {info.yape_qr_path && <img src={mediaUrl(info.yape_qr_path)} alt="QR de Yape" style={{ width: 180, borderRadius: 12 }} />}
          <div className="summary-row"><span>Yape al</span><span>{phonePretty(info.yape_phone)}</span></div>
          <div className="summary-row"><span>A nombre de</span><span>{info.yape_holder}</span></div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 0 }}>
          <div className="summary-row"><span>Banco</span><span>{info.bank_name}</span></div>
          <div className="summary-row"><span>Titular</span><span>{info.account_holder}</span></div>
          <div className="summary-row"><span>Cuenta</span><span>{info.account_number}</span></div>
          <div className="summary-row"><span>CCI</span><span>{info.cci}</span></div>
        </div>
      )}
      {info.instructions && <p className="hint">{info.instructions}</p>}
      <div className="field"><label htmlFor="op">Número de operación *</label>
        <input id="op" className="input" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Lo encuentras en la constancia" /></div>
      {error && <p className="error">{error}</p>}
      <button className="btn block" disabled={code.trim().length < 4 || busy} onClick={async () => {
        setBusy(true); setError(null)
        try { await rpc('public_report_payment', { p_token: token, p_method: method, p_operation_code: code.trim(), p_amount: amount }); onReported() }
        catch (e) { setError((e as Error).message) } finally { setBusy(false) }
      }}>{busy ? 'Enviando…' : 'Ya pagué'}</button>
    </div>
  )
}
