import { createClient } from "@/lib/supabase/client";

export type WineRatingRecord = {
  id: string;
  wine_id: string;
  member_id: string;
  rating: number;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WineRatingInput = {
  wine_id: string;
  member_id: string;
  rating: number;
  notes?: string | null;
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

async function getMemberIdByEmail(email: string) {
  const supabase = createClient();
  const cleanEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (error) {
    logSupabaseError("Error loading member by email:", error);
    throw new Error(getErrorMessage(error));
  }

  return data?.id ?? null;
}

export async function getUserRatings(email: string) {
  const supabase = createClient();

  const memberId = await getMemberIdByEmail(email);
  if (!memberId) {
    return [];
  }

  const { data, error } = await supabase
    .from("wine_ratings")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("Error loading user ratings:", error);
    throw new Error(getErrorMessage(error));
  }

  return (data ?? []) as WineRatingRecord[];
}

export async function getRatingsForWine(wineId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wine_ratings")
    .select("*")
    .eq("wine_id", wineId)
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("Error loading ratings for wine:", error);
    throw new Error(getErrorMessage(error));
  }

  return (data ?? []) as WineRatingRecord[];
}

export async function getUserRatingForWine(email: string, wineId: string) {
  const supabase = createClient();

  const memberId = await getMemberIdByEmail(email);
  if (!memberId) {
    return null;
  }

  const { data, error } = await supabase
    .from("wine_ratings")
    .select("*")
    .eq("member_id", memberId)
    .eq("wine_id", wineId)
    .maybeSingle();

  if (error) {
    logSupabaseError("Error loading user rating for wine:", error);
    throw new Error(getErrorMessage(error));
  }

  return (data ?? null) as WineRatingRecord | null;
}

export async function upsertWineRating(input: WineRatingInput) {
  const supabase = createClient();

  const existing = await getRatingByMemberAndWine(input.member_id, input.wine_id);

  if (existing) {
    const { data, error } = await supabase
      .from("wine_ratings")
      .update({
        rating: input.rating,
        notes: input.notes ?? null,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      logSupabaseError("Error updating wine rating:", error);
      throw new Error(getErrorMessage(error));
    }

    return data as WineRatingRecord;
  }

  const { data, error } = await supabase
    .from("wine_ratings")
    .insert([
      {
        wine_id: input.wine_id,
        member_id: input.member_id,
        rating: input.rating,
        notes: input.notes ?? null,
      },
    ])
    .select("*")
    .single();

  if (error) {
    logSupabaseError("Error creating wine rating:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as WineRatingRecord;
}

export async function saveUserWineRating(input: {
  email: string;
  wine_id: string;
  rating: number;
  notes?: string | null;
}) {
  const memberId = await getMemberIdByEmail(input.email);

  if (!memberId) {
    throw new Error("No matching member found for this email.");
  }

  return upsertWineRating({
    wine_id: input.wine_id,
    member_id: memberId,
    rating: input.rating,
    notes: input.notes ?? null,
  });
}

export async function deleteWineRating(id: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from("wine_ratings")
    .delete()
    .eq("id", id);

  if (error) {
    logSupabaseError("Error deleting wine rating:", error);
    throw new Error(getErrorMessage(error));
  }

  return true;
}

async function getRatingByMemberAndWine(memberId: string, wineId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wine_ratings")
    .select("*")
    .eq("member_id", memberId)
    .eq("wine_id", wineId)
    .maybeSingle();

  if (error) {
    logSupabaseError("Error loading existing wine rating:", error);
    throw new Error(getErrorMessage(error));
  }

  return (data ?? null) as WineRatingRecord | null;
}
