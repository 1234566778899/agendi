export type Service = {
  id: string; name: string; description: string | null; duration_min: number; price: number; price_today: number
  category_id: string | null; payment_mode: 'on_site' | 'deposit' | 'prepaid'; deposit_amount: number | null; image_path: string | null
}
export type StaffKind = 'person' | 'space' | 'equipment'
export type StaffMember = { id: string; name: string; kind: StaffKind; specialty: string | null; avatar_path: string | null; service_ids: string[] }
export type Package = { id: string; name: string; description: string | null; price: number; service_ids: string[] }
export type Promotion = { name: string; discount_type: 'percent' | 'fixed'; discount_value: number; service_ids: string[]; weekdays: number[] }
export type Business = {
  id: string; name: string; slug: string; category: string; description: string | null; phone: string | null
  address: string | null; city: string | null; timezone: string; currency: string; logo_path: string | null; cover_path: string | null
  primary_color: string; button_style: 'rounded' | 'square'; font_style: string
  booking_open: boolean; pause_message: string | null; paused_until: string | null; policy_text: string | null
  cancel_limit_min: number; confirmation_mode: 'automatic' | 'manual'; approval_timeout_min: number; max_advance_days: number
  hours: { weekday: number; start: string; end: string }[]
  categories: { id: string; name: string }[]
  services: Service[]; packages: Package[]; promotions: Promotion[]; staff: StaffMember[]
  payments_enabled: boolean
}
export type Slot = { staff_id: string; starts_at: string }
export type BookingResult = {
  reference: string; token: string; status: 'pending' | 'confirmed'; starts_at: string; ends_at: string; staff_id: string
  total: number; payment_required: boolean; amount_due: number
}
export type Booking = {
  reference: string; status: 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled' | 'rejected'
  starts_at: string; ends_at: string; price: number; service: string; service_id: string; staff: string; staff_id: string; staff_kind?: StaffKind
  business: { name: string; slug: string; address: string | null; city: string | null; phone: string | null; timezone: string; logo_path: string | null; category: string; booking_open: boolean }
  can_change: boolean; change_deadline: string; reschedules_left: number; allow_cancel: boolean; allow_reschedule: boolean
  pending_expires_at: string | null; cancel_reason: string | null
  extra: { service: string; starts_at: string; ends_at: string; price: number }[]
}
export type PaymentInfo = {
  yape_enabled: boolean; yape_phone: string | null; yape_holder: string | null; yape_qr_path: string | null
  transfer_enabled: boolean; bank_name: string | null; account_holder: string | null; account_number: string | null; cci: string | null
  instructions: string | null; deadline_min: number
}
