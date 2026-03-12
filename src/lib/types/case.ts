export type WineCase = {
  id: string;
  quarter: string;
  status: "draft" | "customizing" | "finalized" | "ready_for_pickup" | "picked_up";
  case_size?: number;
  finalize_deadline?: string;
  pickup_date?: string;
};

export type CaseItem = {
  id: string;
  case_id: string;
  wine_id: string;
  quantity: number;
  is_original_selection?: boolean;
};