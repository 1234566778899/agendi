import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './styles.css'
const LandingPage = lazy(() => import('./pages/LandingPage'))
const BusinessPage = lazy(() => import('./pages/BusinessPage'))
const BookingPage = lazy(() => import('./pages/BookingPage'))
const ManagePage = lazy(() => import('./pages/ManagePage'))
const BusinessPolicyPage = lazy(() => import('./pages/PolicyPage').then((m) => ({ default: m.BusinessPolicyPage })))
const PlatformDocPage = lazy(() => import('./pages/PolicyPage').then((m) => ({ default: m.PlatformDocPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacidad" element={<PlatformDocPage kind="privacy" />} />
        <Route path="/terminos" element={<PlatformDocPage kind="terms" />} />
        <Route path="/c/:token" element={<ManagePage />} />
        <Route path="/:slug" element={<BusinessPage />} />
        <Route path="/:slug/reservar" element={<BookingPage />} />
        <Route path="/:slug/privacidad" element={<BusinessPolicyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
