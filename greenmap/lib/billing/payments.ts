/** One row of the (simulated) payment history shown on the My Plan page. */
export type PaymentRow = {
  id: string;
  kind: string;
  amount_rm: number;
  method: string;
  created_at: string;
  meta: Record<string, unknown> | null;
};
