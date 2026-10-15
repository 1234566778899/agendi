# Agendin · Web

Portal público de reservas de Agendin (módulos 07 y 07B del Figma) y página de la marca.

- `/`: página de Agendin (funciones y planes).
- `/:slug`: página del negocio (servicios, paquetes, equipo, horario y contacto; aviso si las reservas están pausadas).
- `/:slug/reservar?s=<ids>[&p=<paquete>]`: reserva en 5 pasos. Incluye varios servicios, paquetes, lista de espera y depósito.
- `/c/:token`: la cita del cliente (confirmación, pago por Yape o transferencia, reprogramar, cancelar, fuera de plazo, agregar al calendario).
- `/:slug/privacidad`, `/privacidad`, `/terminos`.

Usa solo las funciones `public_*` de Supabase con la clave publicable (rol `anon`). La seguridad está en la base de datos.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
```

Variables opcionales (`.env`, ver `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`.

## Despliegue

Es una SPA estática. En **Vercel** o **Netlify**, importa el repositorio y no hace falta configurar nada más
(`vercel.json` y `public/_redirects` envían todas las rutas a `index.html`).
Después, en la app iOS, cambia `Config.portalHost` por el dominio final.
