import { Link } from 'react-router-dom'
import { Empty, TopBar } from '../components/ui'

export default function NotFoundPage() {
  return <><TopBar /><div className="page"><Empty icon="🔎" title="Página no encontrada" text="Revisa el enlace o vuelve al inicio."><Link className="btn" to="/">Ir al inicio</Link></Empty></div></>
}
