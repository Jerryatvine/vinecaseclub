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
  template_case_id?: string | null;
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
  template_case_id?: string | null;
};

type CaseItemInput = {
  case_id: string;
  wine_id: string;
  quantity: number;
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
    .is("template_case_id", null)
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

  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .eq("member_email", normalizedEmail)
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
    template_case_id: input.template_case_id ?? null,
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
    template_case_id:
      input.template_case_id === undefined ? undefined : input.template_case_id,
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

  // 🔒 Inventory check on create
  const { data: wine, error: wineError } = await supabase
    .from("wines")
    .select("inventory_count")
    .eq("id", input.wine_id)
    .single();

  if (wineError || !wine) {
    logSupabaseError("Error loading wine inventory:", wineError);
    throw new Error(getErrorMessage(wineError));
  }

  if (input.quantity > wine.inventory_count) {
    throw new Error(
      `Inventory limit reached. Only ${wine.inventory_count} bottles available.`
    );
  }

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

  // Get existing item
  const { data: existingItem, error: existingError } = await supabase
    .from("case_items")
    .select("*")
    .eq("id", id)
    .single();

  if (existingError || !existingItem) {
    logSupabaseError("Error loading existing case item:", existingError);
    throw new Error(getErrorMessage(existingError));
  }

  const wineId = input.wine_id ?? existingItem.wine_id;
  const newQuantity = input.quantity ?? existingItem.quantity;

  // Get inventory
  const { data: wine, error: wineError } = await supabase
    .from("wines")
    .select("inventory_count")
    .eq("id", wineId)
    .single();

  if (wineError || !wine) {
    logSupabaseError("Error loading wine inventory:", wineError);
    throw new Error(getErrorMessage(wineError));
  }

  if (newQuantity > wine.inventory_count) {
    throw new Error(
      `Inventory limit reached. Only ${wine.inventory_count} bottles available.`
    );
  }

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

  // 🔒 Validate ALL items before writing
  for (const item of positiveItems) {
    const { data: wine, error } = await supabase
      .from("wines")
      .select("inventory_count")
      .eq("id", item.wine_id)
      .single();

    if (error || !wine) {
      logSupabaseError("Error loading wine inventory:", error);
      throw new Error(getErrorMessage(error));
    }

    if (item.quantity > wine.inventory_count) {
      throw new Error(
        `Inventory limit reached for wine ${item.wine_id}. Max ${wine.inventory_count}`
      );
    }
  }

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

export async function removeCaseAndRestock(caseId: string) {
  const supabase = createClient();

  const items = await getCaseItems(caseId);

  for (const item of items) {
    const quantityToReturn = Number(item.quantity ?? 0);

    if (quantityToReturn <= 0) {
      continue;
    }

    const { data: wine, error: wineError } = await supabase
      .from("wines")
      .select("inventory_count")
      .eq("id", item.wine_id)
      .single();

    if (wineError || !wine) {
      logSupabaseError("Error loading wine inventory for restock:", wineError);
      throw new Error(getErrorMessage(wineError));
    }

    const currentInventory = Number(wine.inventory_count ?? 0);

    const { error: updateWineError } = await supabase
      .from("wines")
      .update({
        inventory_count: currentInventory + quantityToReturn,
      })
      .eq("id", item.wine_id);

    if (updateWineError) {
      logSupabaseError("Error restocking wine inventory:", updateWineError);
      throw new Error(getErrorMessage(updateWineError));
    }
  }

  const { error: deleteItemsError } = await supabase
    .from("case_items")
    .delete()
    .eq("case_id", caseId);

  if (deleteItemsError) {
    logSupabaseError("Error deleting case items during case removal:", deleteItemsError);
    throw new Error(getErrorMessage(deleteItemsError));
  }

  const { error: deleteCaseError } = await supabase
    .from("cases")
    .delete()
    .eq("id", caseId);

  if (deleteCaseError) {
    logSupabaseError("Error deleting case during case removal:", deleteCaseError);
    throw new Error(getErrorMessage(deleteCaseError));
  }

  return {
    success: true,
    restockedBottleCount: items.reduce(
      (sum, item) => sum + Number(item.quantity ?? 0),
      0
    ),
    removedItemCount: items.length,
  };
}