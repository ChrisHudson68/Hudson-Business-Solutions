export interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  logo_path: string | null;
  invoice_prefix: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  default_tax_rate: number;
  default_labor_rate: number;
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
}

export interface Job {
  id: number;
  job_name: string | null;
  job_code: string | null;
  client_name: string | null;
  contract_amount: number | null;
  retainage_percent: number | null;
  start_date: string | null;
  status: string | null;
  tenant_id: number;
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

export interface Employee {
  id: number;
  name: string;
  pay_type: string;
  hourly_rate: number | null;
  annual_salary: number | null;
  active: number;
  tenant_id: number;
}

export interface TimeEntry {
  id: number;
  job_id: number;
  employee_id: number;
  date: string;
  hours: number;
  note: string | null;
  labor_cost: number;
  tenant_id: number;
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
  job_name: string;
}