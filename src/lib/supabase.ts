import { createClient } from '@supabase/supabase-js'

// Clave publicable: es segura en el navegador. El portal solo usa funciones public_* (rol anon).
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://hzedixfwxiavrnqxdled.supabase.co'
const key = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_OX4tatWCYXcS5dBO4BqPPw_HaboYeOA'

export const supabase = createClient(url, key, { auth: { persistSession: false } })
export const mediaUrl = (path?: string | null) => (path ? `${url}/storage/v1/object/public/media/${path}` : undefined)

/** Llama una RPC y convierte los códigos de error del servidor en mensajes para la persona */
export async function rpc<T>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params)
  if (error) throw new AppError(error.message)
  return data as T
}

const messages: Record<string, string> = {
  SLOT_TAKEN: 'Este horario acaba de ser reservado. Elige otro.',
  CONSENT_REQUIRED: 'Debes aceptar la Política de privacidad para continuar.',
  INVALID_DATA: 'Revisa tu nombre y tu número de celular.',
  OUT_OF_TIME: 'Ya no es posible hacer cambios en línea. Comunícate con el negocio.',
  RESCHEDULE_LIMIT: 'Ya usaste los cambios permitidos para esta cita.',
  BOOKING_CLOSED: 'Las reservas en línea de este negocio están pausadas.',
  NOT_FOUND: 'No encontramos esta cita.',
  SERVICE_NOT_FOUND: 'Este servicio ya no está disponible.',
  INVALID_STATUS: 'Esta cita ya no se puede modificar.',
}

export class AppError extends Error {
  code: string
  constructor(raw: string) {
    const code = Object.keys(messages).find((k) => raw.includes(k)) ?? 'UNKNOWN'
    super(messages[code] ?? 'Algo salió mal. Inténtalo de nuevo.')
    this.code = code
  }
}
