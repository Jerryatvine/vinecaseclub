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
  tasting_notes?: string | null;
};

export type WineRecord = {
  id: string;
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
  available_for_club?: boolean | null;
  tasting_notes?: string | null;
  created_at?: string | null;
};

type WineRow = {
  id: string;
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
  inventory_count?: number | null;
  available_for_club?: boolean | null;
  tasting_notes?: string | null;
  created_at?: string | null;
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

function mapWineRow(row: WineRow): WineRecord {
  return {
    id: row.id,
    name: row.name,
    winery: row.winery ?? null,
    vintage: row.vintage ?? null,
    type: row.type ?? null,
    varietal: row.varietal ?? null,
    region: row.region ?? null,
    image_url: row.image_url ?? null,
    msrp: row.msrp ?? null,
    store_price: row.store_price ?? null,
    club_price: row.club_price ?? null,
    inventory: row.inventory_count ?? 0,
    available_for_club: row.available_for_club ?? null,
    tasting_notes: row.tasting_notes ?? null,
    created_at: row.created_at ?? null,
  };
}

function mapWineInputToRow(input: Partial<WineInput>) {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.winery !== undefined ? { winery: input.winery } : {}),
    ...(input.vintage !== undefined ? { vintage: input.vintage } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.varietal !== undefined ? { varietal: input.varietal } : {}),
    ...(input.region !== undefined ? { region: input.region } : {}),
    ...(input.image_url !== undefined ? { image_url: input.image_url } : {}),
    ...(input.msrp !== undefined ? { msrp: input.msrp } : {}),
    ...(input.store_price !== undefined ? { store_price: input.store_price } : {}),
    ...(input.club_price !== undefined ? { club_price: input.club_price } : {}),
    ...(input.inventory !== undefined ? { inventory_count: input.inventory } : {}),
    ...(input.available_for_club !== undefined
      ? { available_for_club: input.available_for_club }
      : {}),
    ...(input.tasting_notes !== undefined
      ? { tasting_notes: input.tasting_notes }
      : {}),
  };
}

export async function getAllWines(): Promise<WineRecord[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wines")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("Error loading wines:", error);
    throw new Error(getErrorMessage(error));
  }

  return ((data ?? []) as WineRow[]).map(mapWineRow);
}

export async function getClubWines(): Promise<WineRecord[]> {
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

  return ((data ?? []) as WineRow[]).map(mapWineRow);
}

export async function getWineById(id: string): Promise<WineRecord> {
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

  return mapWineRow(data as WineRow);
}

export async function createWine(input: WineInput) {
  const supabase = createClient();
  const payload = mapWineInputToRow(input);

  const { error } = await supabase.from("wines").insert([payload]);

  if (error) {
    logSupabaseError("Error creating wine:", error);
    throw new Error(getErrorMessage(error));
  }

  return true;
}

export async function updateWine(id: string, input: Partial<WineInput>) {
  const supabase = createClient();
  const payload = mapWineInputToRow(input);

  const { error } = await supabase.from("wines").update(payload).eq("id", id);

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