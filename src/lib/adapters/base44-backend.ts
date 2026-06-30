import type { BackendAdapter } from "./backend";
import type { Wine } from "@/lib/types/wine";
import type { NotificationItem } from "@/lib/types/notification";
import type { WineCase, CaseItem } from "@/lib/types/case";

// Temporary demo adapter.
// Later, replace internals with real Base44 calls.
export const base44Backend: BackendAdapter = {
  async getClubWines(): Promise<Wine[]> {
    return [
      {
        id: "wine-1",
        name: "Pinot Noir Reserve",
        winery: "Stag Hollow",
        vintage: 2022,
        type: "red",
        varietal: "Pinot Noir",
        region: "Willamette Valley",
        msrp: 34,
        store_price: 29,
        club_price: 24,
        available_for_club: true,
      },
    ];
  },

  async getNotifications(): Promise<NotificationItem[]> {
    return [
      {
        id: "n1",
        title: "Your case is ready for pickup",
        message: "Stop by the shop whenever you’re ready.",
        type: "pickup_ready",
        is_read: false,
        created_date: new Date().toISOString(),
      },
    ];
  },

  async getCases(): Promise<WineCase[]> {
    return [
      {
        id: "case-1",
        quarter: "Q2 2026",
        status: "customizing",
        case_size: 12,
      },
    ];
  },

  async getCaseItems(caseId: string): Promise<CaseItem[]> {
    return [
      {
        id: "item-1",
        case_id: caseId,
        wine_id: "wine-1",
        quantity: 3,
      },
    ];
  },
};