export const EXPENSE_CATEGORIES = [
  'Materials',
  'Subcontractor',
  'Equipment Rental',
  'Fuel',
  'Tools & Supplies',
  'Permits & Fees',
  'Dump & Disposal',
  'Travel & Lodging',
  'Insurance',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isValidExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}
