import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { rpc } from '../lib/supabase'
import { Empty, Footer, Loading, TopBar } from '../components/ui'

type Policy = { business_name: string; version: string; controller: string | null; contact_email: string | null; data_collected: string | null
  purposes: string | null; retention: string | null; rights: string | null; published_at: string }

/** Política de privacidad de cada negocio (RF-093) */
export function BusinessPolicyPage() {
  const { slug } = useParams()
  const [p, setP] = useState<Policy | null | undefined>(undefined)
  useEffect(() => { rpc<Policy | null>('public_policy', { p_slug: slug }).then(setP).catch(() => setP(null)) }, [slug])
  if (p === undefined) return <><TopBar /><div className="page narrow" style={{ paddingTop: 24 }}><Loading /></div></>
  if (!p) return <><TopBar /><div className="page narrow"><Empty icon="📄" title="Política no disponible" /></div></>
  const sections: [string, string | null][] = [
    ['Quién trata tus datos', [p.controller, p.contact_email && `Contacto: ${p.contact_email}`].filter(Boolean).join('\n')],
    ['Qué datos recogemos', p.data_collected], ['Para qué los usamos', p.purposes], ['Cuánto tiempo los guardamos', p.retention],
    ['Tus derechos', p.rights], ['Cómo contactarnos', p.contact_email ? `Escríbenos a ${p.contact_email}.` : 'Escríbele al negocio por WhatsApp o teléfono.'],
  ]
  return (
    <>
      <TopBar back={{ to: `/${slug}`, label: 'Volver' }} />
      <article className="page narrow stack-lg" style={{ paddingTop: 24 }}>
        <div className="stack" style={{ gap: 6 }}>
          <h1>Política de privacidad</h1>
          <p className="muted small">{p.business_name} · versión {p.version} · {new Date(p.published_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
        {sections.filter(([, t]) => t).map(([h, t]) => <section key={h} className="stack" style={{ gap: 6 }}><h3>{h}</h3><p style={{ whiteSpace: 'pre-line' }}>{t}</p></section>)}
      </article>
      <Footer />
    </>
  )
}

/** Textos legales de la plataforma */
export function PlatformDocPage({ kind }: { kind: 'privacy' | 'terms' }) {
  useEffect(() => { document.title = kind === 'privacy' ? 'Privacidad · Agendin' : 'Términos · Agendin' }, [kind])
  return (
    <>
      <TopBar />
      <article className="page narrow stack-lg" style={{ paddingTop: 24 }}>
        {kind === 'privacy' ? (
          <>
            <h1>Política de privacidad de Agendin</h1>
            <p>Agendin trata los datos de las cuentas de negocio (nombre, correo y teléfono) para darte acceso a la app, enviarte avisos de tus citas y gestionar tu suscripción.</p>
            <p>Cada negocio es responsable de los datos de sus clientes y publica su propia política en su página de reservas. Agendin actúa como encargado del tratamiento y no usa esos datos para fines propios.</p>
            <p>Los datos se guardan en servidores de Supabase, con acceso restringido por negocio. Puedes pedir acceder, corregir o eliminar tus datos escribiendo a soporte. Tratamos los datos conforme a la Ley N.º 29733 de Protección de Datos Personales del Perú.</p>
          </>
        ) : (
          <>
            <h1>Términos de uso</h1>
            <p>Al crear una cuenta en Agendin aceptas usar el servicio para gestionar reservas de tu negocio de forma legítima y mantener actualizada la información que publicas.</p>
            <p>Los planes de pago se cobran por mes por Yape o transferencia. Puedes cancelar cuando quieras: conservarás tu plan hasta el final del periodo pagado y luego pasarás al plan Gratis.</p>
            <p>Agendin puede suspender cuentas que incumplan estos términos o usen el servicio para fines ilícitos. Texto legal por definir con asesoría.</p>
          </>
        )}
      </article>
      <Footer />
    </>
  )
}
