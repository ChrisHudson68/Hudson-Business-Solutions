export type BillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'internal'
  | 'incomplete';

export type AdvancedBillingState =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'suspended'
  | 'canceled'
  | 'internal'
  | 'billing_exempt';

export type EstimateStatus =
  | 'draft'
  | 'ready'
  | 'sent'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'converted';

export interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  logo_path: string | null;
  invoice_prefix: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  company_website?: string | null;
  proposal_license_info?: string | null;
  proposal_default_terms?: string | null;
  proposal_default_acknowledgment?: string | null;
  default_tax_rate: number;
  default_labor_rate: number;
  billing_exempt: number;
  billing_status: BillingStatus;
  billing_plan: string | null;
  billing_trial_ends_at: string | null;
  billing_grace_ends_at: string | null;
  billing_customer_id: string | null;
  billing_subscription_id: string | null;
  billing_subscription_status: string | null;
  billing_updated_at: string | null;
  billing_state?: AdvancedBillingState | null;
  billing_grace_until?: string | null;
  billing_override_reason?: string | null;
  billing_overridden_by_user_id?: number | null;
  billing_overridden_at?: string | null;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  active: number;
  tenant_id: number;
  employee_id: number | null;
}

export interface Job {
  id: number;
  job_name: string | null;
  job_code: string | null;
  job_description: string | null;
  client_name: string | null;
  sold_by?: string | null;
  commission_percent?: number | null;
  contract_amount: number | null;
  retainage_percent: number | null;
  start_date: string | null;
  status: string | null;
  tenant_id: number;
  archived_at?: string | null;
  archived_by_user_id?: number | null;
  source_estimate_id?: number | null;
  source_estimate_number?: string | null;
  source_estimate_customer_name?: string | null;
}

export interface Estimate {
  id: number;
  tenant_id: number;
  estimate_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  site_address: string | null;
  scope_of_work: string | null;
  proposal_title?: string | null;
  payment_schedule?: string | null;
  custom_terms?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  status: EstimateStatus;
  created_by_user_id: number;
  updated_by_user_id: number | null;
  sent_at: string | null;
  responded_at: string | null;
  approval_notes: string | null;
  rejection_reason: string | null;
  converted_job_id: number | null;
  expiration_date: string | null;
  public_token: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  converted_job_name?: string | null;
}

export interface EstimateLineItem {
  id: number;
  estimate_id: number;
  tenant_id: number;
  description: string;
  quantity: number;
  unit: string;
  unit_cost?: number;
  upcharge_percent?: number;
  apply_upcharge?: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EstimateWithLineItems extends Estimate {
  line_items: EstimateLineItem[];
}

export interface Income {
  id: number;
  job_id: number;
  amount: number | null;
  date: string | null;
  description: string | null;
  tenant_id: number;
}

export interface Expense {
  id: number;
  job_id: number;
  category: string | null;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  receipt_filename: string | null;
  tenant_id: number;
}


export interface ParsedReceipt {
  vendorName?: string;
  normalizedVendorName?: string;
  suggestedCategory?: string;
  receiptDate?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  receiptNumber?: string;
  paymentMethod?: string;
  cardLast4?: string;
  rawText: string;
  confidence?: {
    vendorName?: number;
    receiptDate?: number;
    subtotal?: number;
    tax?: number;
    total?: number;
    receiptNumber?: number;
    suggestedCategory?: number;
  };
}

export interface Employee {
  id: number;
  name: string;
  pay_type: string;
  hourly_rate: number | null;
  annual_salary: number | null;
  active: number;
  tenant_id: number;
}

export type TimeEntryApprovalStatus = 'approved' | 'pending_edit';

export interface TimeEntry {
  id: number;
  job_id: number | null;
  employee_id: number;
  date: string;
  hours: number;
  note: string | null;
  labor_cost: number;
  tenant_id: number;
  clock_in_at: string | null;
  clock_out_at: string | null;
  entry_method: 'manual' | 'clock';
  approval_status: TimeEntryApprovalStatus;
  approved_by_user_id: number | null;
  approved_at: string | null;
  last_edited_by_user_id: number | null;
  last_edited_at: string | null;
  edit_reason: string | null;
}

export interface Invoice {
  id: number;
  job_id: number;
  invoice_number: string | null;
  date_issued: string;
  due_date: string;
  amount: number;
  status: string;
  notes: string | null;
  tenant_id: number;
}

export interface Payment {
  id: number;
  invoice_id: number;
  date: string;
  amount: number;
  method: string | null;
  reference: string | null;
  tenant_id: number;
}

export interface JobWithFinancials extends Job {
  total_income: number;
  total_expenses: number;
  total_labor: number;
  total_hours: number;
  total_invoiced: number;
  total_collected: number;
  unpaid_invoices: number;
}

export interface InvoiceWithJob extends Invoice {
  job_name: string | null;
  client_name: string | null;
}

export interface TimeEntryWithNames extends TimeEntry {
  employee_name: string;
  job_name: string | null;
}

export interface TimeEntryEditRequest {
  id: number;
  tenant_id: number;
  time_entry_id: number;
  employee_id: number;
  requested_by_user_id: number;
  proposed_job_id: number | null;
  proposed_date: string;
  proposed_clock_in_at: string;
  proposed_clock_out_at: string;
  proposed_hours: number;
  proposed_note: string | null;
  request_reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_user_id: number | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}