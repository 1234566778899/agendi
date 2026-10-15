import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { mediaUrl, rpc } from '../lib/supabase'
import { duration, hoursSummary, money, openNow, phonePretty, whatsapp, longDay, unitNoun } from '../lib/format'
import type { Business, Service } from '../lib/types'
import { Avatar, Empty, Footer, Loading, Logo, TopBar, useBusinessTheme } from '../components/ui'

export function useBusiness(slug?: string) {
  const [biz, setBiz] = useState<Business | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  useEffect(() => {
    if (!slug) return
    rpc<Business | null>('public_business', { p_slug: slug })
      .then((b) => { setBiz(b); setState(b ? 'ok' : 'missing') })
      .catch(() => setState('error'))
  }, [slug])
  useBusinessTheme(biz)
  return { biz, state }
}

export function PriceTag({ s }: { s: Service }) {
  return s.price_today < s.price
    ? <span><strong>{money(s.price_today)}</strong> <span className="strike small">{money(s.price)}</span></span>
    : <span>{money(s.price)}</span>
}

export default function BusinessPage() {
  const { slug } = useParams()
  const nav = useNavigate()
  const { biz, state } = useBusiness(slug)
  const [cat, setCat] = useState<string | null>(null)
  const [multi, setMulti] = useState(false)
  const [picked, setPicked] = useState<string[]>([])

  const grouped = useMemo(() => {
    if (!biz) return []
    const list = biz.services.filter((s) => !cat || s.category_id === cat)
    const groups = biz.categories.map((c) => ({ name: c.name, items: list.filter((s) => s.category_id === c.id) })).filter((g) => g.items.length)
    const orphans = list.filter((s) => !biz.categories.some((c) => c.id === s.category_id))
    return orphans.length ? [...groups, { name: 'Otros', items: orphans }] : groups
  }, [biz, cat])

  if (state === 'loading') return <><TopBar /><div className="page" style={{ paddingTop: 24 }}><Loading lines={5} /></div></>
  if (state !== 'ok' || !biz) return (
    <><TopBar /><div className="page"><Empty icon="🔎" title="Página no encontrada"
      text="Revisa el enlace que te compartieron. Puede que el negocio haya cambiado su dirección.">
      <Link className="btn" to="/">Ir a Agendin</Link></Empty></div></>
  )

  const status = openNow(biz.hours, biz.timezone)
  const book = (ids: string[], pkg?: string) =>
    nav(`/${biz.slug}/reservar?s=${ids.join(',')}${pkg ? `&p=${pkg}` : ''}`)
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const pickedServices = biz.services.filter((s) => picked.includes(s.id))

  return (
    <>
      <TopBar url={`${location.host}/${biz.slug}`} />
      <div className="page">
        <div className={`cover ${biz.cover_path ? '' : 'empty'}`} style={{ backgroundImage: biz.cover_path ? `url(${mediaUrl(biz.cover_path)})` : undefined }} />
        <div className="biz-head">
          <Logo biz={biz} size={84} />
          <div className="stack" style={{ gap: 2, paddingBottom: 4 }}>
            <h1 style={{ fontSize: 28 }}>{biz.name}</h1>
            <p className="muted">{[biz.category, biz.city].filter(Boolean).join(' · ')}</p>
          </div>
        </div>

        <div className="two-col" style={{ marginTop: 20 }}>
          <div className="stack-lg">
            {!biz.booking_open && (
              <div className="notice warn" role="status">
                <span aria-hidden>⏸</span>
                <div className="stack" style={{ gap: 4 }}>
                  <strong>Las reservas en línea están pausadas</strong>
                  {biz.pause_message && <span>{biz.pause_message}</span>}
                  {biz.paused_until && <span className="muted">Vuelven el {longDay(biz.paused_until + 'T12:00:00Z', 'UTC').toLowerCase()}.</span>}
                  <span className="muted">Si ya tienes una cita, puedes gestionarla desde el enlace que recibiste.</span>
                </div>
              </div>
            )}

            {biz.description && <p>{biz.description}</p>}

            <div className="row wrap" style={{ gap: 8 }}>
              <span className={`badge ${status.open ? 'green' : ''}`}>{status.label}</span>
            </div>

            {biz.packages.length > 0 && biz.booking_open && (
              <section className="stack">
                <h2>Paquetes</h2>
                <div className="card flush list">
                  {biz.packages.map((p) => {
                    const items = biz.services.filter((s) => p.service_ids.includes(s.id))
                    const regular = items.reduce((a, s) => a + Number(s.price), 0)
                    return (
                      <div key={p.id} className="service">
                        <div className="grow">
                          <h3>{p.name}</h3>
                          <p className="muted small">{items.map((s) => s.name).join(' + ')} · {duration(items.reduce((a, s) => a + s.duration_min, 0))}</p>
                          <p className="small"><strong>{money(p.price)}</strong> {regular > p.price && <span className="strike">{money(regular)}</span>}</p>
                        </div>
                        <button className="btn small" onClick={() => book(items.map((s) => s.id), p.id)}>Reservar</button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            <section className="stack">
              <div className="row between">
                <h2>Servicios</h2>
                {biz.booking_open && biz.services.length > 1 && (
                  <button className={`chip ${multi ? 'on' : ''}`} onClick={() => { setMulti(!multi); setPicked([]) }}>
                    {multi ? 'Listo' : 'Varios servicios'}
                  </button>
                )}
              </div>
              {biz.categories.length > 1 && (
                <div className="chips" role="tablist">
                  <button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat(null)}>Todos</button>
                  {biz.categories.map((c) => <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.name}</button>)}
                </div>
              )}
              {multi && <p className="hint">Elige los servicios que quieres en la misma visita. Se agendan seguidos, uno tras otro.</p>}
              {grouped.length === 0 && <p className="muted">Este negocio aún no publica servicios.</p>}
              {grouped.map((g) => (
                <div key={g.name} className="stack" style={{ gap: 8 }}>
                  <div className="section-title">{g.name}</div>
                  <div className="card flush list">
                    {g.items.map((s) => (
                      <div key={s.id} className="service">
                        {s.image_path && <div className="thumb" style={{ backgroundImage: `url(${mediaUrl(s.image_path)})` }} />}
                        <div className="grow">
                          <h3>{s.name}</h3>
                          <p className="muted small">{duration(s.duration_min)} · <PriceTag s={s} />
                            {s.payment_mode !== 'on_site' && <> · <span className="badge orange">{s.payment_mode === 'deposit' ? 'Requiere depósito' : 'Pago anticipado'}</span></>}
                          </p>
                          {s.description && <p className="muted small">{s.description}</p>}
                        </div>
                        {biz.booking_open && (multi ? (
                          <input type="checkbox" className="check" style={{ width: 22, height: 22 }} checked={picked.includes(s.id)}
                            onChange={() => toggle(s.id)} aria-label={`Elegir ${s.name}`} />
                        ) : (
                          <button className="btn small" onClick={() => book([s.id])}>Reservar</button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {biz.staff.some((m) => m.kind === 'person') && (
              <section className="stack">
                <h2>Nuestro equipo</h2>
                <div className="team">
                  {biz.staff.filter((m) => m.kind === 'person').map((m) => (
                    <div key={m.id} className="member">
                      <Avatar name={m.name} path={m.avatar_path} size={60} />
                      <span>{m.name.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {biz.staff.some((m) => m.kind !== 'person') && (
              <section className="stack">
                <h2>{unitNoun(biz.staff.filter((m) => m.kind !== 'person').map((m) => m.kind)).plural.replace(/^./, (c) => c.toUpperCase())}</h2>
                <div className="team">
                  {biz.staff.filter((m) => m.kind !== 'person').map((m) => (
                    <div key={m.id} className="member">
                      <Avatar name={m.name} path={m.avatar_path} size={60} kind={m.kind} />
                      <span>{m.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="sticky stack">
            <div className="card stack">
              {biz.address && <div className="row" style={{ alignItems: 'flex-start' }}><span aria-hidden>📍</span><span>{biz.address}</span></div>}
              {biz.phone && <div className="row"><span aria-hidden>📞</span><span>{phonePretty(biz.phone)}</span></div>}
              <div className="row" style={{ alignItems: 'flex-start' }}><span aria-hidden>🕘</span><span className="small">{hoursSummary(biz.hours)}</span></div>
              <div className="row wrap" style={{ gap: 8 }}>
                {biz.phone && <a className="btn secondary small" href={`tel:${biz.phone}`}>Llamar</a>}
                {biz.phone && <a className="btn secondary small" href={whatsapp(biz.phone)} target="_blank" rel="noreferrer">WhatsApp</a>}
                {biz.address && <a className="btn secondary small" target="_blank" rel="noreferrer"
                  href={`https://maps.google.com/?q=${encodeURIComponent(biz.address)}`}>Cómo llegar</a>}
              </div>
            </div>
            <Link to={`/${biz.slug}/privacidad`} className="small muted center">Política de privacidad</Link>
          </aside>
        </div>

        {multi && picked.length > 0 && (
          <div className="bar-bottom">
            <div className="row between" style={{ maxWidth: 1120, margin: '0 auto' }}>
              <div className="grow">
                <strong>{picked.length} servicios</strong>
                <p className="muted small">{duration(pickedServices.reduce((a, s) => a + s.duration_min, 0))} · {money(pickedServices.reduce((a, s) => a + Number(s.price_today), 0))}</p>
              </div>
              <button className="btn" onClick={() => book(picked)}>Continuar</button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  )
}
