import { useEffect, useState } from 'react'
import { rpc } from '../lib/supabase'
import { money } from '../lib/format'
import { Footer, TopBar } from '../components/ui'

type Plan = { code: string; name: string; description: string | null; price_monthly: number; max_staff: number | null; features: Record<string, boolean> }

const features = [
  ['📅', 'Tu agenda en el iPhone', 'Día, semana y mes con columnas por profesional. Crea, mueve y cancela citas en segundos.'],
  ['🔗', 'Tu página de reservas', 'Un enlace para WhatsApp e Instagram. Tus clientes reservan sin descargar nada ni crear cuenta.'],
  ['🛡️', 'Cero dobles reservas', 'Cada horario se valida al confirmar. Si alguien reservó antes, se ofrecen los más cercanos.'],
  ['🔔', 'Avisos al instante', 'Notificaciones cuando reservan, cancelan o cambian una cita. Cada empleado ve solo lo suyo.'],
  ['📲', 'Pagos por Yape', 'Pide depósitos por Yape o transferencia y verifica los pagos desde la app.'],
  ['👥', 'Tu equipo con permisos', 'Propietario, administradores y empleados, cada uno con lo que necesita ver.'],
]

const featureNames: Record<string, string> = {
  reminders: 'Recordatorios automáticos', payments: 'Depósitos por Yape', reports: 'Indicadores e ingresos',
  loyalty: 'Fidelización', branches: 'Varias sucursales', resources: 'Recursos compartidos',
}

export default function LandingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  useEffect(() => { document.title = 'Agendin · Reservas y agenda para tu negocio'; rpc<Plan[]>('public_plans').then(setPlans).catch(() => {}) }, [])
  return (
    <>
      <TopBar right={<a className="btn small" href="#planes">Empezar</a>} />
      <main className="page">
        <section className="hero">
          <img className="mascot" src="/mascot-wave.png" alt="" />
          <h1>Tu agenda llena,<br />sin el desorden.</h1>
          <p>Agendin es la app de reservas para barberías, salones, spas y consultorios. Tus clientes reservan desde un enlace y tú gestionas todo desde el iPhone.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <a className="btn" href="https://apps.apple.com/app/id6823010375"> Descargar en el App Store</a>
            <a className="btn secondary" href="/barberia-el-corte">Ver una página de ejemplo</a>
          </div>
        </section>

        <section className="features" aria-label="Funciones">
          {features.map(([ico, t, d]) => (
            <div key={t} className="card feature"><div className="ico" aria-hidden>{ico}</div><h3>{t}</h3><p className="muted small" style={{ marginTop: 6 }}>{d}</p></div>
          ))}
        </section>

        <section id="planes" className="stack-lg" style={{ marginTop: 64 }}>
          <div className="center stack" style={{ gap: 8 }}><h1>Planes simples</h1><p className="muted">Empieza gratis. 14 días de Pro al crear tu negocio.</p></div>
          <div className="plans">
            {plans.map((p) => (
              <div key={p.code} className={`card stack plan ${p.code === 'pro' ? 'featured' : ''}`}>
                <div className="row between"><h2>{p.name}</h2>{p.code === 'pro' && <span className="badge dark">Popular</span>}</div>
                <div><span className="price">{p.price_monthly > 0 ? money(p.price_monthly) : 'Gratis'}</span>{p.price_monthly > 0 && <span className="muted"> / mes</span>}</div>
                {p.description && <p className="muted small">{p.description}</p>}
                <ul className="small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
                  <li>{p.max_staff ? `Hasta ${p.max_staff} ${p.max_staff === 1 ? 'profesional' : 'profesionales'}` : 'Profesionales ilimitados'}</li>
                  <li>Reservas online ilimitadas</li>
                  {Object.entries(featureNames).filter(([k]) => p.features[k]).map(([k, l]) => <li key={k}>{l}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="hint center">Pagos por Yape o transferencia. Sin tarjeta de crédito.</p>
        </section>
      </main>
      <Footer />
    </>
  )
}
