import { createClient } from "@/lib/supabase/client";

export type CaseStatus =
  | "draft"
  | "customizing"
  | "finalized"
  | "ready_for_pickup"
  | "picked_up";

export type CaseTier = "economy" | "premium";

export type CaseRecord = {
  id: string;
  title?: string | null;
  quarter: string;
  year?: number | null;
  status: CaseStatus;
  tier: CaseTier;
  case_size?: number | null;
  target_price_cap?: number | null;
  member_email?: string | null;
  finalize_deadline?: string | null;
  created_at?: string;
};

export type CaseItemRecord = {
  id: string;
  case_id: string;
  wine_id: string;
  quantity: number;
  created_at?: string;
};

type CaseInput = {
  title: string;
  quarter: string;
  status: CaseStatus;
  tier: CaseTier;
  case_size?: number | null;
  target_price_cap?: number | null;
  member_email?: string | null;
  finalize_deadline?: string | null;
};

type CaseItemInput = {
  case_id: string;
  wine_id: string;
  quantity: number;
};

type MemberRecord = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  membership_tier?: string | null;
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

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function logSupabaseError(label: string, error: unknown) {
  console.error(label, getErrorMessage(error), error);
}

export async function getAllCases() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("Error loading cases:", error);
    throw new Error(getErrorMessage(error));
  }

  return (data ?? []) as CaseRecord[];
}

export async function getUserCases(email: string) {
  const supabase = createClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, name, email, role, membership_tier")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (memberError) {
    logSupabaseError("Error loading member for cases:", memberError);
    throw new Error(getErrorMessage(memberError));
  }

  const membershipTier: CaseTier =
    member?.membership_tier === "economy" ? "economy" : "premium";

  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .or(
      [
        `member_email.eq.${normalizedEmail}`,
        `and(member_email.is.null,tier.eq.${membershipTier},status.neq.draft)`,
      ].join(",")
    )
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("Error loading user cases:", error);
    throw new Error(getErrorMessage(error));
  }

  return (data ?? []) as CaseRecord[];
}

export async function getCaseById(id: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logSupabaseError("Error loading case:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as CaseRecord;
}

export async function createCase(input: CaseInput) {
  const supabase = createClient();

  const payload = {
    ...input,
    member_email: input.member_email?.trim().toLowerCase() || null,
  };

  const { data, error } = await supabase
    .from("cases")
    .insert([payload])
    .select()
    .single();

  if (error) {
    logSupabaseError("Error creating case:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as CaseRecord;
}

export async function updateCase(id: string, input: Partial<CaseInput>) {
  const supabase = createClient();

  const payload = {
    ...input,
    member_email:
      input.member_email === undefined
        ? undefined
        : input.member_email?.trim().toLowerCase() || null,
  };

  const { data, error } = await supabase
    .from("cases")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logSupabaseError("Error updating case:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as CaseRecord;
}

export async function deleteCase(id: string) {
  const supabase = createClient();

  const { error } = await supabase.from("cases").delete().eq("id", id);

  if (error) {
    logSupabaseError("Error deleting case:", error);
    throw new Error(getErrorMessage(error));
  }

  return true;
}

export async function getCaseItems(caseId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("case_items")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error) {
    logSupabaseError("Error loading case items:", error);
    throw new Error(getErrorMessage(error));
  }

  return (data ?? []) as CaseItemRecord[];
}

export async function createCaseItem(input: CaseItemInput) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("case_items")
    .insert([input])
    .select()
    .single();

  if (error) {
    logSupabaseError("Error creating case item:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as CaseItemRecord;
}

export async function updateCaseItem(
  id: string,
  input: Partial<Pick<CaseItemRecord, "quantity" | "wine_id">>
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("case_items")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logSupabaseError("Error updating case item:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as CaseItemRecord;
}

export async function deleteCaseItem(id: string) {
  const supabase = createClient();

  const { error } = await supabase.from("case_items").delete().eq("id", id);

  if (error) {
    logSupabaseError("Error deleting case item:", error);
    throw new Error(getErrorMessage(error));
  }

  return true;
}

export async function replaceCaseItems(
  caseId: string,
  items: Array<{ wine_id: string; quantity: number }>
) {
  const supabase = createClient();

  const positiveItems = items.filter((item) => item.quantity > 0);

  const { error: deleteError } = await supabase
    .from("case_items")
    .delete()
    .eq("case_id", caseId);

  if (deleteError) {
    logSupabaseError("Error clearing case items:", deleteError);
    throw new Error(getErrorMessage(deleteError));
  }

  if (positiveItems.length === 0) {
    return [];
  }

  const payload = positiveItems.map((item) => ({
    case_id: caseId,
    wine_id: item.wine_id,
    quantity: item.quantity,
  }));

  const { data, error } = await supabase
    .from("case_items")
    .insert(payload)
    .select();

  if (error) {
    logSupabaseError("Error saving case items:", error);
    throw new Error(getErrorMessage(error));
  }

  return (data ?? []) as CaseItemRecord[];
}