export type Role = 'client' | 'partner' | 'admin';
export type Group = 'fitness' | 'sport' | 'wellness' | 'glow' | 'kids-family';
export type Status = 'BOOKED' | 'CHECKED_IN' | 'CANCELLED';
export type ClientSection = 'overview' | 'discover' | 'bookings' | 'wallet' | 'shop' | 'orders' | 'notifications';
export type EmployeeSection = ClientSection;
export type PartnerSection = 'overview' | 'calendar' | 'reservations' | 'services' | 'settlements' | 'feedback' | 'notifications';
export type AdminSection = 'clients' | 'overview' | 'companies' | 'partners' | 'employees' | 'plans' | 'products' | 'orders' | 'invoices' | 'settlements' | 'audit' | 'analytics' | 'notifications';
export type Section = EmployeeSection | PartnerSection | AdminSection;
export interface User { id:number; full_name:string; email:string; role:Role; company_id:number|null; partner_id:number|null; plan_id:number|null; status:string; }
export interface LoginResult { token:string; user:User; }
export interface AppInfo { app:string; preview:boolean; seeded:boolean; demo_mode:boolean; groups:Group[]; zones:string[]; subcategories:Record<Group,string[]>; tagline:string; bank_transfer?:{demo_enabled:boolean;configured:boolean;bank_name:string;beneficiary:string;iban:string}; }
export interface Slot {id:number; start_at:string; capacity:number; available:number; reserved?:number; }
export interface Service {id:number; name:string; group:Group; subcategory:string; description:string; credits:number; duration_minutes:number; partner:string; partner_id:number; zone:string; slots:Slot[]; }
export interface Booking {id:number; reference:string; service:string; partner:string; partner_id:number; user:string; email:string; start_at:string; credits:number; payout_cents:number; status:Status; created_at:string; checked_in_at:string|null; zone:string; reviewed?:boolean; }
export interface EmployeeSummary {company:string; plan:string; monthly_credits:number; balance:number; active_bookings:number; visits:number; personal_account:boolean; }
export interface LedgerRow {id:number; kind:string; amount:number; period:string; created_at:string; reason:string; booking_id:number|null; }
export interface PartnerSummary {partner:string; zone:string; services:number; bookings:number; checkins:number; pending:number; earnings_cents:number; }
export interface PartnerReview {id:number;service_id:number;service:string;rating:number;comment:string;created_at:string;}
export interface PartnerReviewSummary {id:number;name:string;count:number;average_rating:number|null;}
export interface PartnerFeedbackData {count:number;average_rating:number|null;has_more:boolean;services:PartnerReviewSummary[];reviews:PartnerReview[];}
export interface PartnerService {id:number; name:string; group:Group; subcategory:string; credits:number; payout_cents:number; active:boolean; slots:Slot[]; }
export interface AdminSummary {companies:number; employees:number; clients:number; orders_pending:number; partners:number; services:number; bookings:number; visits:number; credits_issued:number; partner_payables_cents:number; }
export interface Company {id:number; name:string; hr_email:string; status:string; employees:number; }
export interface CreditProduct {id:number;name:string;credits:number;price_cents:number;currency:string;active:boolean;}
export interface ClientOrder {id:number;product:string;product_id:number;client_id:number;email?:string;credits:number;amount_cents:number;currency:string;status:string;created_at:string;payment_reference:string;bank_reference?:string;payment_method?:string;simulated?:boolean;}
export interface ClientRecord {id:number;name:string;email:string;status:string;balance:number;orders:number;legacy:boolean;}
export interface PartnerAccount {id:number;email:string;status:string;}
export interface AdminPartner {id:number;name:string;zone:string;status:string;accounts:PartnerAccount[];}
export interface Employee {id:number; full_name:string; email:string; company:string; company_id:number; plan:string; status:string; balance:number; }
export interface Plan {id:number; name:string; credits:number; monthly_price:number; currency:string; }
export interface Invoice {id:number; company:string; company_id:number; period:string; reference:string; amount_cents:number; currency:string; status:string; due_date:string; payment_reference:string; }
export interface Settlement {id:number; partner:string; partner_id:number; period:string; status:string; bookings:number; amount_cents:number; invoice_reference:string; payment_reference:string; }
export interface AuditRow {id:number; action:string; detail:string; actor_id:number|null; at:string; }
export interface NotificationRow {id:number;kind:string;title:string;message:string;created_at:string;read_at:string|null;}
export interface AdminAnalytics {monthly:Array<{period:string;bookings:number;visits:number;orders:number}>;categories:Array<{name:string;bookings:number}>;partners:Array<{name:string;visits:number}>;}
export type FormAction = 'company'|'partner-invite'|'plan-create'|'product-create'|'employee'|'invoice'|'invoice-status'|'service'|'slot'|'slot-bulk'|'adjust'|'settlement-status';
export interface FormDialog {kind:FormAction; id?:number; }
