export type Service = {
  id: string; name: string; description: string; duration_minutes: number; price_clp: number; active: boolean;
};
export type Booking = {
  id: string; code: string; service_name: string; price_clp: number; starts_at: string; ends_at: string;
  customer_name: string; customer_email: string; customer_phone: string; status: "confirmed" | "cancelled";
};
export type Hours = { weekday: number; opens_at: string; closes_at: string; active: boolean };
export type Block = { id: string; starts_at: string; ends_at: string; reason: string };
export type Confirmed = { status: "confirmed"; code: string; service: string; worker?: string; startsAt: string; duration: number; price: number };
export type BookingState = { error?: string; retrySlots?: boolean; confirmed?: Confirmed };
export type FormState = { error?: string; success?: string; inviteToken?: string };

export type Business = {
  id: string; slug: string; name: string; description: string; category: string;
  location: string; phone: string; email: string; time_zone: string;
};
export type Worker = { id: number; name: string; description: string; photo_url: string; active: boolean };
export type Catalog = { business: Omit<Business, "id">; services: Service[]; workers: (Worker & { services: string[] })[] };
