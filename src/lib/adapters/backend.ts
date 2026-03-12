import type { Wine } from "@/lib/types/wine";
import type { NotificationItem } from "@/lib/types/notification";
import type { WineCase, CaseItem } from "@/lib/types/case";

export interface BackendAdapter {
  getClubWines(): Promise<Wine[]>;
  getNotifications(): Promise<NotificationItem[]>;
  getCases(): Promise<WineCase[]>;
  getCaseItems(caseId: string): Promise<CaseItem[]>;
}