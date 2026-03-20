import { createClient } from "@/lib/supabase/client";

export type MemberRole = "admin" | "member";
export type MembershipTier = "economy" | "premium";
export type FulfillmentType = "pickup" | "delivery";

export type Member = {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  membership_tier: MembershipTier;
  user_id?: string | null;
  created_at?: string | null;
  fulfillment_type?: FulfillmentType | null;
  zip_code?: string | null;
  delivery_approved?: boolean | null;
  delivery_review_required?: boolean | null;
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

function normalizeDeliveryState(
  fulfillment_type: FulfillmentType,
  zip_code: string
) {
  const trimmedZip = zip_code.trim();

  if (fulfillment_type === "pickup") {
    return {
      fulfillment_type,
      zip_code: trimmedZip || null,
      delivery_approved: false,
      delivery_review_required: false,
    };
  }

  const isAutoApprovedZip = trimmedZip === "83843";

  return {
    fulfillment_type,
    zip_code: trimmedZip || null,
    delivery_approved: isAutoApprovedZip,
    delivery_review_required: !isAutoApprovedZip,
  };
}

export async function findMemberByUserId(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logSupabaseError("Error loading member by user_id:", error);
    throw new Error(getErrorMessage(error));
  }

  return (data ?? null) as Member | null;
}

export async function findMemberByEmail(email: string) {
  const supabase = createClient();

  const cleanEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (error) {
    logSupabaseError("Error loading member by email:", error);
    throw new Error(getErrorMessage(error));
  }

  return (data ?? null) as Member | null;
}

export async function getAllMembers() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    logSupabaseError("Error loading members:", error);
    throw new Error(getErrorMessage(error));
  }

  return (data ?? []) as Member[];
}

export async function updateMemberRole(id: string, role: MemberRole) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("members")
    .update({ role })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    logSupabaseError("Error updating member role:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as Member;
}

export async function updateMemberTier(
  id: string,
  membership_tier: MembershipTier
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("members")
    .update({ membership_tier })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    logSupabaseError("Error updating member tier:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as Member;
}

export async function updateMemberFulfillment(
  id: string,
  fulfillment_type: FulfillmentType,
  zip_code: string
) {
  const supabase = createClient();

  const payload = normalizeDeliveryState(fulfillment_type, zip_code);

  const { data, error } = await supabase
    .from("members")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    logSupabaseError("Error updating member fulfillment:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as Member;
}

export async function approveMemberDelivery(id: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("members")
    .update({
      fulfillment_type: "delivery",
      delivery_approved: true,
      delivery_review_required: false,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    logSupabaseError("Error approving member delivery:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as Member;
}

export async function rejectMemberDelivery(id: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("members")
    .update({
      fulfillment_type: "pickup",
      delivery_approved: false,
      delivery_review_required: false,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    logSupabaseError("Error rejecting member delivery:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as Member;
}