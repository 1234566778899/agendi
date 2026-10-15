import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppError, rpc } from '../lib/supabase'
import { addDays, dayTime, duration, longDay, money, time, todayIn, toE164 } from '../lib/format'
import type { BookingResult, Business, Service, Slot } from '../lib/types'
import { Avatar, Calendar, Empty, Loading, Modal, SlotGrid, TopBar } from '../components/ui'
import { useBusiness } from './BusinessPage'

type Step = 1 | 2 | 3 | 4 | 5
const stepNames = ['Servicio', 'Profesional', 'Fecha', 'Datos', 'Confirmar']

export default function BookingPage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { biz, state } = useBusiness(slug)

  const serviceIds = (params.get('s') ?? '').split(',').filter(Boolean)
  const packageId = params.get('p')
  const [step, setStep] = useState<Step>(2)
  const [staffId, setStaffId] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [days, setDays] = useState<Set<string> | null>(null)
  const [start, setStart] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', note: '', consent: false, whatsapp: false })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taken, setTaken] = useState<string[] | null>(null)
  const [waitlist, setWaitlist] = useState(false)

  const services = useMemo(() => (biz ? serviceIds.map((id) => biz.services.find((s) => s.id === id)).filter(Boolean) as Service[] : []), [biz, params])
  const pkg = biz?.packages.find((p) => p.id === packageId)
  const eligibleStaff = useMemo(() => biz?.staff.filter((m) => services.every((s) => m.service_ids.includes(s.id))) ?? [], [biz, services])
  const totalMin = services.reduce((a, s) => a + s.duration_min, 0)
  const total = pkg ? Number(pkg.price) : services.reduce((a, s) => a + Number(s.price_today), 0)
  const staff = eligibleStaff.find((m) => m.id === staffId)
  const assignedStaff = start ? biz?.staff.find((m) => m.id === slots?.find((s) => s.starts_at === start)?.staff_id) : undefined
  const needsPayment = services.some((s) => s.payment_mode !== 'on_site')

  // Si solo hay un profesional, se salta el paso
  useEffect(() => {
    if (biz && eligibleStaff.length === 1 && step === 2) { setStaffId(eligibleStaff[0].id); setStep(3) }
  }, [biz, eligibleStaff, step])

  // Días con horarios (para tachar los demás)
  useEffect(() => {
    if (!biz || step < 3 || !services.length) return
    const from = todayIn(biz.timezone)
    rpc<string[]>('public_available_days', { p_services: services.map((s) => s.id), p_from: from, p_to: addDays(from, Math.min(biz.max_advance_days, 60)), p_staff: staffId })
      .then((d) => {
        const set = new Set(d.map((x) => x.slice(0, 10)))
        setDays(set)
        if (!date || !set.has(date)) setDate([...set].sort()[0] ?? null)
      })
      .catch(() => setDays(new Set()))
  }, [biz, step >= 3, staffId, services.length])

  useEffect(() => {
    if (!date || !services.length) return
    setSlots(null); setStart(null)
    rpc<Slot[]>('public_chain_slots', { p_services: services.map((s) => s.id), p_date: date, p_staff: staffId })
      .then(setSlots).catch(() => setSlots([]))
  }, [date, staffId, services.length])

  if (state === 'loading') return <><TopBar /><div className="page" style={{ paddingTop: 24 }}><Loading /></div></>
  if (!biz || !services.length) return <><TopBar /><div className="page"><Empty icon="🔎" title="Servicio no disponible"
    text="Puede que el negocio haya cambiado sus servicios."><Link className="btn" to={`/${slug}`}>Ver servicios</Link></Empty></div></>
  if (!biz.booking_open) return <><TopBar back={{ to: `/${biz.slug}`, label: biz.name }} /><div className="page"><Empty icon="⏸"
    title="Las reservas en línea están pausadas" text={biz.pause_message ?? 'Escríbele al negocio para agendar.'} /></div></>

  const tz = biz.timezone
  const uniqueStarts = slots ? [...new Set(slots.map((s) => s.starts_at))].sort() : []
  const phoneOk = form.phone.replace(/\D/g, '').length >= 9
  const dataOk = form.name.trim().length >= 2 && phoneOk && form.consent && (!form.email || /\S+@\S+\.\S+/.test(form.email))

  async function confirm() {
    if (!biz || !start) return
    setSubmitting(true); setError(null)
    try {
      const res = await rpc<BookingResult>('public_book_multi', {
        p_services: services.map((s) => s.id), p_staff: staffId, p_starts_at: start,
        p_name: form.name.trim(), p_phone: toE164(form.phone), p_email: form.email.trim() || null, p_note: form.note.trim() || null,
        p_consent: form.consent, p_whatsapp_opt_in: form.whatsapp, p_package: packageId,
      })
      nav(`/c/${res.token}?nueva=1${res.payment_required ? `&pagar=${res.amount_due}` : ''}`)
    } catch (e) {
      const err = e as AppError
      if (err.code === 'SLOT_TAKEN') {
        const fresh = await rpc<Slot[]>('public_chain_slots', { p_services: services.map((s) => s.id), p_date: date, p_staff: staffId }).catch(() => [])
        setSlots(fresh)
        const near = [...new Set(fresh.map((s) => s.starts_at))].sort((a, b) =>
          Math.abs(+new Date(a) - +new Date(start)) - Math.abs(+new Date(b) - +new Date(start))).slice(0, 3).sort()
        setTaken(near)
      } else setError(err.message)
    } finally { setSubmitting(false) }
  }

  const summary = (
    <div className="card stack" style={{ gap: 4 }}>
      <h3 style={{ marginBottom: 6 }}>{pkg?.name ?? services.map((s) => s.name).join(' + ')}</h3>
      <div className="summary-row"><span>Duración</span><span>{duration(totalMin)}</span></div>
      <div className="summary-row"><span>Profesional</span><span>{staff?.name ?? assignedStaff?.name ?? 'Cualquiera disponible'}</span></div>
      {start && <div className="summary-row"><span>Fecha</span><span>{dayTime(start, tz)}</span></div>}
      <div className="summary-row" style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 12 }}>
        <span>Total</span><span>{money(total)}</span>
      </div>
      {needsPayment && <p className="hint">Este servicio requiere un pago por Yape o transferencia para confirmar la cita.</p>}
    </div>
  )

  const next = (s: Step) => { setStep(s); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const canGo = (s: number) => s === 1 || (s === 2 && eligibleStaff.length > 1) || (s === 3) || (s === 4 && !!start) || (s === 5 && !!start && dataOk)

  return (
    <>
      <TopBar url={`${location.host}/${biz.slug}`} back={step > 3 || (step === 3 && eligibleStaff.length > 1) ? () => next((step - 1) as Step) : { to: `/${biz.slug}`, label: 'Servicios' }} />
      <div className="page">
        <nav className="steps" aria-label="Pasos de la reserva">
          {stepNames.map((n, i) => {
            const s = (i + 1) as Step
            return (
              <button key={n} className={s < step ? 'done' : s === step ? 'current' : ''} disabled={!(s < step && canGo(s))}
                onClick={() => (s === 1 ? nav(`/${biz.slug}`) : next(s))} aria-current={s === step ? 'step' : undefined}>
                {n}
              </button>
            )
          })}
        </nav>

        <div className="two-col">
          <div className="stack-lg">
            {step === 2 && (
              <section className="stack">
                <h1 style={{ fontSize: 26 }}>¿Con quién quieres tu cita?</h1>
                <button className={`pick ${staffId === null ? 'on' : ''}`} onClick={() => setStaffId(null)}>
                  <div className="avatar" style={{ width: 48, height: 48 }}>?</div>
                  <div className="grow"><h3>Cualquier profesional disponible</h3><p className="muted small">Te asignamos a quien tenga el horario libre.</p></div>
                </button>
                {eligibleStaff.map((m) => (
                  <button key={m.id} className={`pick ${staffId === m.id ? 'on' : ''}`} onClick={() => setStaffId(m.id)}>
                    <Avatar name={m.name} path={m.avatar_path} size={48} />
                    <div className="grow"><h3>{m.name}</h3>{m.specialty && <p className="muted small">{m.specialty}</p>}</div>
                  </button>
                ))}
                <p className="hint">Solo se muestran los profesionales que realizan {services.length > 1 ? 'todos estos servicios' : 'este servicio'}.</p>
                <div className="bar-bottom mobile-only"><button className="btn block" onClick={() => next(3)}>Continuar</button></div>
                <button className="btn desktop-only" style={{ alignSelf: 'flex-start' }} onClick={() => next(3)}>Continuar</button>
              </section>
            )}

            {step === 3 && (
              <section className="stack-lg">
                <h1 style={{ fontSize: 26 }}>Elige fecha y hora</h1>
                <div className="date-layout">
                <div className="card"><Calendar tz={tz} value={date} onChange={setDate} available={days} maxDays={biz.max_advance_days} /></div>
                {date && (
                  <div className="stack">
                    <h3>{longDay(date + 'T12:00:00Z', 'UTC')}{staff ? ` · ${staff.name}` : ''}</h3>
                    {slots === null ? <Loading lines={2} /> : uniqueStarts.length ? (
                      <SlotGrid slots={uniqueStarts} tz={tz} value={start} onChange={setStart} />
                    ) : <p className="muted">No hay horarios libres este día. Prueba con otra fecha.</p>}
                  </div>
                )}
                </div>
                <p className="hint">Hora de {biz.city ?? "Lima"} (GMT-5). Los días tachados no tienen horarios disponibles.</p>
                <button className="link small" style={{ alignSelf: 'flex-start' }} onClick={() => setWaitlist(true)}>¿No hay horario? Únete a la lista de espera</button>
                <div className="bar-bottom mobile-only">
                  <div className="row between">
                    <div className="grow small">{start ? <><strong>{dayTime(start, tz)}</strong><br /><span className="muted">{money(total)}</span></> : <span className="muted">Elige un horario</span>}</div>
                    <button className="btn" disabled={!start} onClick={() => next(4)}>Continuar</button>
                  </div>
                </div>
                <button className="btn desktop-only" style={{ alignSelf: 'flex-start' }} disabled={!start} onClick={() => next(4)}>Continuar</button>
              </section>
            )}

            {step === 4 && (
              <section className="stack-lg">
                <div className="stack" style={{ gap: 4 }}>
                  <h1 style={{ fontSize: 26 }}>Tus datos</h1>
                  <p className="muted">No necesitas crear una cuenta.</p>
                </div>
                <div className="card stack">
                  <div className="field">
                    <label htmlFor="name">Nombre y apellido *</label>
                    <input id="name" className="input" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="phone">Celular *</label>
                    <div className="phone"><span>+51</span><input id="phone" className="input" inputMode="tel" autoComplete="tel-national" placeholder="9XX XXX XXX"
                      value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                    <span className="hint">Lo usamos solo para gestionar tu cita.</span>
                  </div>
                  <div className="field">
                    <label htmlFor="email">Correo electrónico (opcional)</label>
                    <input id="email" className="input" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com"
                      value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="note">Nota para el negocio (opcional)</label>
                    <textarea id="note" className="input" placeholder="Ej.: es mi primera vez" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  </div>
                </div>
                <div className="stack">
                  <label className="check"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                    <span>Acepto la <Link to={`/${biz.slug}/privacidad`} target="_blank">Política de privacidad</Link> y el tratamiento de mis datos para gestionar la reserva. *</span></label>
                  <label className="check"><input type="checkbox" checked={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.checked })} />
                    <span>Quiero recibir recordatorios por WhatsApp</span></label>
                </div>
                <div className="bar-bottom mobile-only"><button className="btn block" disabled={!dataOk} onClick={() => next(5)}>Revisar reserva</button></div>
                <button className="btn desktop-only" style={{ alignSelf: 'flex-start' }} disabled={!dataOk} onClick={() => next(5)}>Revisar reserva</button>
              </section>
            )}

            {step === 5 && start && (
              <section className="stack-lg">
                <h1 style={{ fontSize: 26 }}>Revisa tu reserva</h1>
                <div className="card stack" style={{ gap: 0 }}>
                  <div className="summary-row"><span>Servicio</span><span>{pkg?.name ?? services.map((s) => s.name).join(' + ')}</span></div>
                  <div className="summary-row"><span>Profesional</span><span>{staff?.name ?? assignedStaff?.name ?? 'Cualquiera disponible'}</span></div>
                  <div className="summary-row"><span>Fecha</span><span>{longDay(start, tz)}</span></div>
                  <div className="summary-row"><span>Hora</span><span>{time(start, tz)} – {time(new Date(+new Date(start) + totalMin * 60000), tz)}</span></div>
                  {biz.address && <div className="summary-row"><span>Lugar</span><span>{biz.address}</span></div>}
                  <div className="summary-row"><span>Precio</span><span>{money(total)}{needsPayment ? '' : ' · pago en el local'}</span></div>
                </div>
                <div className="card stack">
                  <div className="row between"><h3>Tus datos</h3><button className="link small" onClick={() => next(4)}>Editar</button></div>
                  <p>{form.name}<br /><span className="muted">+51 {form.phone}</span></p>
                </div>
                {biz.policy_text && <div className="notice"><span aria-hidden>ℹ️</span><div><strong>Política de cancelación</strong><br />{biz.policy_text}</div></div>}
                {biz.confirmation_mode === 'manual' && !needsPayment && (
                  <div className="notice warn"><span aria-hidden>⏳</span><span>Este negocio confirma cada reserva. Recibirás la respuesta en tu enlace en menos de {Math.round(biz.approval_timeout_min / 60)} horas.</span></div>
                )}
                {error && <p className="error" role="alert">{error}</p>}
                <div className="bar-bottom mobile-only"><button className="btn block" disabled={submitting} onClick={confirm}>{submitting ? 'Reservando…' : needsPayment ? 'Continuar al pago' : 'Confirmar reserva'}</button></div>
                <button className="btn desktop-only" style={{ alignSelf: 'flex-start' }} disabled={submitting} onClick={confirm}>{submitting ? 'Reservando…' : needsPayment ? 'Continuar al pago' : 'Confirmar reserva'}</button>
              </section>
            )}
          </div>
          <aside className="sticky desktop-only">{summary}</aside>
        </div>
      </div>

      {taken && (
        <Modal onClose={() => setTaken(null)}>
          <div className="stack">
            <div style={{ fontSize: 32 }} aria-hidden>⚠️</div>
            <h2>Este horario acaba de ser reservado</h2>
            <p className="muted">Otra persona confirmó el {start ? `${longDay(start, tz).toLowerCase()} a las ${time(start, tz)}` : 'horario'} antes que tú. Elige otro:</p>
            {taken.length ? (
              <div className="slots">{taken.map((s) => <button key={s} className="slot" onClick={() => { setStart(s); setTaken(null) }}>{time(s, tz)}</button>)}</div>
            ) : <p className="muted">No quedan horarios este día.</p>}
            <button className="btn secondary block" onClick={() => { setTaken(null); next(3) }}>Ver más horarios</button>
          </div>
        </Modal>
      )}
      {waitlist && date && <WaitlistModal biz={biz} serviceId={services[0].id} staffId={staffId} date={date} onClose={() => setWaitlist(false)} />}
    </>
  )
}

/** Unirse a la lista de espera (RF-064, V2) */
function WaitlistModal({ biz, serviceId, staffId, date, onClose }: { biz: Business; serviceId: string; staffId: string | null; date: string; onClose: () => void }) {
  const [pref, setPref] = useState<'morning' | 'afternoon' | 'any'>('any')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const staff = biz.staff.find((m) => m.id === staffId)

  async function join() {
    setError(null)
    try {
      await rpc('public_join_waitlist', { p_service: serviceId, p_staff: staffId, p_date: date, p_pref: pref, p_name: name.trim(), p_phone: toE164(phone), p_consent: consent })
      setDone(true)
    } catch (e) { setError((e as Error).message) }
  }

  return (
    <Modal onClose={onClose}>
      {done ? (
        <div className="stack center">
          <div className="hero-check badge green" style={{ fontSize: 30 }}>✓</div>
          <h2>Te anotamos en la lista de espera</h2>
          <p className="muted">Si se libera un horario el {longDay(date + 'T12:00:00Z', 'UTC').toLowerCase()}, {biz.name} te escribirá por WhatsApp.</p>
          <button className="btn block" onClick={onClose}>Listo</button>
        </div>
      ) : (
        <div className="stack">
          <h2>Lista de espera</h2>
          <p className="muted">Te avisaremos si se libera un horario el {longDay(date + 'T12:00:00Z', 'UTC').toLowerCase()}{staff ? ` con ${staff.name.split(' ')[0]}` : ''}.</p>
          <div className="field"><label>¿Qué horario te sirve?</label>
            <div className="chips">{([['morning', 'Mañana'], ['afternoon', 'Tarde'], ['any', 'Cualquiera']] as const).map(([v, l]) =>
              <button key={v} className={`chip ${pref === v ? 'on' : ''}`} onClick={() => setPref(v)}>{l}</button>)}</div>
          </div>
          <div className="field"><label htmlFor="wn">Nombre y apellido *</label><input id="wn" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="wp">Celular *</label><div className="phone"><span>+51</span><input id="wp" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div></div>
          <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>Acepto la Política de privacidad y que me contacten por este horario. *</span></label>
          {error && <p className="error">{error}</p>}
          <button className="btn block" disabled={name.trim().length < 2 || phone.replace(/\D/g, '').length < 9 || !consent} onClick={join}>Unirme a la lista de espera</button>
        </div>
      )}
    </Modal>
  )
}
