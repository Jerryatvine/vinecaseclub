export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: "pickup_ready" | "case_finalized" | "new_case" | "reminder" | "general";
  is_read: boolean;
  created_date: string;
};