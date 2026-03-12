import { createClient } from "@/lib/supabase/client";

export type WineInput = {
  name: string;
  winery?: string | null;
  vintage?: number | null;
  type?: string | null;
  varietal?: string | null;
  region?: string | null;
  image_url?: string | null;
  msrp?: number | null;
  store_price?: number | null;
  club_price?: number | null;
  inventory?: number | null;
  available_for_club?: boolean;
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

export async function getAllWines() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wines")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("Error loading wines:", error);
    throw new Error(getErrorMessage(error));
  }

  return data ?? [];
}

export async function getClubWines() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wines")
    .select("*")
    .eq("available_for_club", true)
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("Error loading club wines:", error);
    throw new Error(getErrorMessage(error));
  }

  return data ?? [];
}

export async function getWineById(id: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wines")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logSupabaseError("Error loading wine:", error);
    throw new Error(getErrorMessage(error));
  }

  return data;
}

export async function createWine(input: WineInput) {
  const supabase = createClient();

  const { error } = await supabase.from("wines").insert([input]);

  if (error) {
    logSupabaseError("Error creating wine:", error);
    throw new Error(getErrorMessage(error));
  }

  return true;
}

export async function updateWine(id: string, input: Partial<WineInput>) {
  const supabase = createClient();

  const { error } = await supabase.from("wines").update(input).eq("id", id);

  if (error) {
    logSupabaseError("Error updating wine:", error);
    throw new Error(getErrorMessage(error));
  }

  return true;
}

export async function deleteWine(id: string) {
  const supabase = createClient();

  const { error } = await supabase.from("wines").delete().eq("id", id);

  if (error) {
    logSupabaseError("Error deleting wine:", error);
    throw new Error(getErrorMessage(error));
  }

  return true;
}