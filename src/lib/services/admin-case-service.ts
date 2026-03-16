import { createClient } from "@/lib/supabase/client";

export type CaseStatus =
  | "draft"
  | "customizing"
  | "finalized"
  | "ready_for_pickup"
  | "picked_up";

export type MemberCaseSummary = {
  id: string;
  member_email: string | null;
  quarter: string | null;
  year: number | null;
  tier: string | null;
  status: CaseStatus;
  created_at: string;
  pickup_date: string | null;
  picked_up_at: string | null;
};

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return [
      maybeError.message ? `message: ${maybeError.message}` : null,
      maybeError.details ? `details: ${maybeError.details}` : null,
      maybeError.hint ? `hint: ${maybeError.hint}` : null,
      maybeError.code ? `code: ${maybeError.code}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (typeof error === "string") return error;
  return "Unknown error";
}

function logSupabaseError(label: string, error: unknown) {
  console.error(label, getErrorMessage(error), error);
}

/**
 * Returns the latest case (by created_at) for each member email.
 */
export async function getLatestCasesForMemberEmails(emails: string[]) {
  const supabase = createClient();

  const cleanEmails = Array.from(
    new Set(
      emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0)
    )
  );

  if (cleanEmails.length === 0) {
    return new Map<string, MemberCaseSummary>();
  }

  const { data, error } = await supabase
    .from("cases")
    .select(
      `
        id,
        member_email,
        quarter,
        year,
        tier,
        status,
        created_at,
        pickup_date,
        picked_up_at
      `
    )
    .in("member_email", cleanEmails)
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("Error loading cases:", error);
    throw new Error(getErrorMessage(error));
  }

  const map = new Map<string, MemberCaseSummary>();

  for (const row of (data ?? []) as MemberCaseSummary[]) {
    const email = row.member_email?.toLowerCase();
    if (!email) continue;

    // Because we ordered desc, first one we see per email is the latest.
    if (!map.has(email)) {
      map.set(email, row);
    }
  }

  return map;
}

export async function markCasePickedUp(caseId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cases")
    .update({
      status: "picked_up",
      picked_up_at: new Date().toISOString(),
    })
    .eq("id", caseId)
    .select(
      `
        id,
        member_email,
        quarter,
        year,
        tier,
        status,
        created_at,
        pickup_date,
        picked_up_at
      `
    )
    .single();

  if (error) {
    logSupabaseError("Error marking case picked up:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as MemberCaseSummary;
}

export async function undoCasePickedUp(caseId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cases")
    .update({
      status: "ready_for_pickup",
      picked_up_at: null,
    })
    .eq("id", caseId)
    .select(
      `
        id,
        member_email,
        quarter,
        year,
        tier,
        status,
        created_at,
        pickup_date,
        picked_up_at
      `
    )
    .single();

  if (error) {
    logSupabaseError("Error undoing picked up:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as MemberCaseSummary;
}