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
  is_archived: boolean;
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
  is_archived?: boolean;
};

type CaseItemInput = {
  case_id: string;
  wine_id: string;
  quantity: number;
};

export type CaseItemRecord = {
  id: string;
  case_id: string;
  wine_id: string;
  quantity: number;
  created_at?: string;
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

export async function getAllCases(includeArchived = false) {
  const supabase = createClient();

  let query = supabase
    .from("cases")
    .select("*")
    .is("template_case_id", null)
    .order("created_at", { ascending: false });

  if (!includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;

  if (error) {
    logSupabaseError("Error loading cases:", error);
    throw new Error(getErrorMessage(error));
  }

  return (data ?? []) as CaseRecord[];
}

export async function getUserCases(email: string, includeArchived = false) {
  const supabase = createClient();
  const normalizedEmail = email.trim().toLowerCase();

  let query = supabase
    .from("cases")
    .select("*")
    .eq("member_email", normalizedEmail)
    .order("created_at", { ascending: false });

  if (!includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;

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
    is_archived: input.is_archived ?? false,
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
    is_archived:
      input.is_archived === undefined ? undefined : input.is_archived,
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

export async function archiveCase(id: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cases")
    .update({ is_archived: true })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logSupabaseError("Error archiving case:", error);
    throw new Error(getErrorMessage(error));
  }

  return data as CaseRecord;
}

export async function unarchiveCase(id: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cases")
    .update({ is_archived: false })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logSupabaseError("Error unarchiving case:", error);
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

  const { error: inventoryError } = await supabase.rpc(
    "decrement_wine_inventory",
    { p_wine_id: input.wine_id, p_quantity: input.quantity }
  );

  if (inventoryError) {
    logSupabaseError("Error decrementing wine inventory:", inventoryError);
    throw new Error(
      inventoryError.message.includes("Insufficient inventory")
        ? inventoryError.message
        : "Failed to reserve inventory. Please try again."
    );
  }

  const { data, error } = await supabase
    .from("case_items")
    .insert([input])
    .select()
    .single();

  if (error) {
    logSupabaseError("Error creating case item:", error);
    // Roll back the inventory decrement
    await supabase.rpc("increment_wine_inventory", {
      p_wine_id: input.wine_id,
      p_quantity: input.quantity,
    });
    throw new Error(getErrorMessage(error));
  }

  return data as CaseItemRecord;
}

export async function updateCaseItem(
  id: string,
  input: Partial<Pick<CaseItemRecord, "quantity" | "wine_id">>
) {
  const supabase = createClient();

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
  const oldQuantity = existingItem.quantity;
  const delta = newQuantity - oldQuantity;

  if (delta > 0) {
    const { error: inventoryError } = await supabase.rpc(
      "decrement_wine_inventory",
      { p_wine_id: wineId, p_quantity: delta }
    );

    if (inventoryError) {
      logSupabaseError("Error decrementing wine inventory:", inventoryError);
      throw new Error(
        inventoryError.message.includes("Insufficient inventory")
          ? inventoryError.message
          : "Failed to reserve inventory. Please try again."
      );
    }
  } else if (delta < 0) {
    await supabase.rpc("increment_wine_inventory", {
      p_wine_id: wineId,
      p_quantity: -delta,
    });
  }

  const { data, error } = await supabase
    .from("case_items")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logSupabaseError("Error updating case item:", error);
    // Roll back inventory change
    if (delta > 0) {
      await supabase.rpc("increment_wine_inventory", {
        p_wine_id: wineId,
        p_quantity: delta,
      });
    } else if (delta < 0) {
      await supabase.rpc("decrement_wine_inventory", {
        p_wine_id: wineId,
        p_quantity: -delta,
      });
    }
    throw new Error(getErrorMessage(error));
  }

  return data as CaseItemRecord;
}

export async function deleteCaseItem(id: string) {
  const supabase = createClient();

  const { data: existingItem, error: fetchError } = await supabase
    .from("case_items")
    .select("wine_id, quantity")
    .eq("id", id)
    .single();

  if (fetchError || !existingItem) {
    logSupabaseError("Error loading case item before delete:", fetchError);
    throw new Error(getErrorMessage(fetchError));
  }

  const { error } = await supabase.from("case_items").delete().eq("id", id);

  if (error) {
    logSupabaseError("Error deleting case item:", error);
    throw new Error(getErrorMessage(error));
  }

  const { error: inventoryError } = await supabase.rpc(
    "increment_wine_inventory",
    { p_wine_id: existingItem.wine_id, p_quantity: existingItem.quantity }
  );

  if (inventoryError) {
    logSupabaseError("Error restocking wine inventory:", inventoryError);
  }

  return true;
}

export async function replaceCaseItems(
  caseId: string,
  items: Array<{ wine_id: string; quantity: number }>
) {
  const supabase = createClient();

  const positiveItems = items.filter((item) => item.quantity > 0);

  // Fetch existing items so we can compute per-wine deltas and restock removed wines
  const { data: existingItems, error: existingError } = await supabase
    .from("case_items")
    .select("wine_id, quantity")
    .eq("case_id", caseId);

  if (existingError) {
    logSupabaseError("Error loading existing case items:", existingError);
    throw new Error(getErrorMessage(existingError));
  }

  // Build maps: existing quantities and new quantities keyed by wine_id
  const existingMap = new Map<string, number>();
  for (const item of existingItems ?? []) {
    existingMap.set(item.wine_id, (existingMap.get(item.wine_id) ?? 0) + item.quantity);
  }
  const newMap = new Map<string, number>();
  for (const item of positiveItems) {
    newMap.set(item.wine_id, (newMap.get(item.wine_id) ?? 0) + item.quantity);
  }

  // Collect all wine_ids involved
  const allWineIds = new Set([...existingMap.keys(), ...newMap.keys()]);

  // Compute deltas; restock wines being removed/reduced, reserve for wines being added/increased
  const decrements: Array<{ wine_id: string; quantity: number }> = [];
  const increments: Array<{ wine_id: string; quantity: number }> = [];

  for (const wineId of allWineIds) {
    const oldQty = existingMap.get(wineId) ?? 0;
    const newQty = newMap.get(wineId) ?? 0;
    const delta = newQty - oldQty;
    if (delta > 0) decrements.push({ wine_id: wineId, quantity: delta });
    else if (delta < 0) increments.push({ wine_id: wineId, quantity: -delta });
  }

  // Apply inventory changes atomically per wine; check availability before proceeding
  for (const { wine_id, quantity } of decrements) {
    const { error: inventoryError } = await supabase.rpc(
      "decrement_wine_inventory",
      { p_wine_id: wine_id, p_quantity: quantity }
    );
    if (inventoryError) {
      logSupabaseError("Error decrementing wine inventory:", inventoryError);
      // Roll back any decrements already applied
      for (const applied of decrements.slice(0, decrements.indexOf({ wine_id, quantity }))) {
        await supabase.rpc("increment_wine_inventory", {
          p_wine_id: applied.wine_id,
          p_quantity: applied.quantity,
        });
      }
      throw new Error(
        inventoryError.message.includes("Insufficient inventory")
          ? inventoryError.message
          : "Failed to reserve inventory. Please try again."
      );
    }
  }

  for (const { wine_id, quantity } of increments) {
    await supabase.rpc("increment_wine_inventory", {
      p_wine_id: wine_id,
      p_quantity: quantity,
    });
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

    const { error: inventoryError } = await supabase.rpc(
      "increment_wine_inventory",
      { p_wine_id: item.wine_id, p_quantity: quantityToReturn }
    );

    if (inventoryError) {
      logSupabaseError("Error restocking wine inventory:", inventoryError);
      throw new Error(getErrorMessage(inventoryError));
    }
  }

  const { error: deleteItemsError } = await supabase
    .from("case_items")
    .delete()
    .eq("case_id", caseId);

  if (deleteItemsError) {
    logSupabaseError(
      "Error deleting case items during case removal:",
      deleteItemsError
    );
    throw new Error(getErrorMessage(deleteItemsError));
  }

  const { error: deleteCaseError } = await supabase
    .from("cases")
    .delete()
    .eq("id", caseId);

  if (deleteCaseError) {
    logSupabaseError(
      "Error deleting case during case removal:",
      deleteCaseError
    );
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