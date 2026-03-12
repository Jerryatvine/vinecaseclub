import { createClient } from "@/lib/supabase/client";
import { getAllMembers } from "@/lib/services/member-service";

type MembershipTier = "economy" | "premium";

export async function getAllCaseTemplates() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("case_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading case templates:", error);
    throw error;
  }

  return data ?? [];
}

export async function getCaseTemplateById(id: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("case_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error loading case template:", error);
    throw error;
  }

  return data;
}

export async function createCaseTemplate(input: {
  quarter: string;
  title: string;
  case_size?: number;
  finalize_deadline?: string | null;
  membership_tier?: MembershipTier;
}) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("case_templates")
    .insert([
      {
        quarter: input.quarter,
        title: input.title,
        case_size: input.case_size ?? 12,
        finalize_deadline: input.finalize_deadline ?? null,
        membership_tier: input.membership_tier ?? "economy",
        status: "draft",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating case template:", error);
    throw error;
  }

  return data;
}

export async function updateCaseTemplate(
  id: string,
  input: {
    quarter?: string;
    title?: string;
    case_size?: number;
    finalize_deadline?: string | null;
    membership_tier?: MembershipTier;
    status?: "draft" | "published";
  }
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("case_templates")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating case template:", error);
    throw error;
  }

  return data;
}

export async function deleteCaseTemplate(id: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from("case_templates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting case template:", error);
    throw error;
  }

  return true;
}

export async function getTemplateItems(templateId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("case_template_items")
    .select("*")
    .eq("template_id", templateId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading template items:", error);
    throw error;
  }

  return data ?? [];
}

export async function addTemplateItem(input: {
  template_id: string;
  wine_id: string;
  quantity?: number;
}) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("case_template_items")
    .insert([
      {
        template_id: input.template_id,
        wine_id: input.wine_id,
        quantity: input.quantity ?? 1,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error adding template item:", error);
    throw error;
  }

  return data;
}

export async function updateTemplateItem(
  id: string,
  input: { quantity: number }
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("case_template_items")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating template item:", error);
    throw error;
  }

  return data;
}

export async function deleteTemplateItem(id: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from("case_template_items")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting template item:", error);
    throw error;
  }

  return true;
}

export async function publishTemplateToAllMembers(templateId: string) {
  const supabase = createClient();

  const { data: template, error: templateError } = await supabase
    .from("case_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (templateError) {
    console.error("Error loading template:", templateError);
    throw templateError;
  }

  const { data: templateItems, error: itemsError } = await supabase
    .from("case_template_items")
    .select("*")
    .eq("template_id", templateId);

  if (itemsError) {
    console.error("Error loading template items:", itemsError);
    throw itemsError;
  }

  const members = await getAllMembers();
  const clubMembers = members.filter(
    (m) =>
      m.role === "member" &&
      m.membership_tier === template.membership_tier
  );

  const eligibleMembers = [];
  for (const member of clubMembers) {
    const { data: existingCase, error: existingCaseError } = await supabase
      .from("wine_cases")
      .select("id")
      .eq("member_email", member.email)
      .eq("quarter", template.quarter)
      .eq("membership_tier", template.membership_tier)
      .maybeSingle();

    if (existingCaseError) {
      console.error("Error checking existing member case:", existingCaseError);
      throw existingCaseError;
    }

    if (!existingCase) {
      eligibleMembers.push(member);
    }
  }

  if (eligibleMembers.length === 0) {
    const { error: updateTemplateError } = await supabase
      .from("case_templates")
      .update({ status: "published" })
      .eq("id", templateId);

    if (updateTemplateError) {
      console.error("Error marking template published:", updateTemplateError);
      throw updateTemplateError;
    }

    return true;
  }

  const wineIds = [...new Set(templateItems.map((item) => item.wine_id))];

  const { data: wines, error: winesError } = await supabase
    .from("wines")
    .select("id, name, inventory")
    .in("id", wineIds);

  if (winesError) {
    console.error("Error loading wines for inventory check:", winesError);
    throw winesError;
  }

  const requiredByWine = new Map<string, number>();
  for (const item of templateItems) {
    const current = requiredByWine.get(item.wine_id) ?? 0;
    requiredByWine.set(
      item.wine_id,
      current + item.quantity * eligibleMembers.length
    );
  }

  for (const wine of wines ?? []) {
    const needed = requiredByWine.get(wine.id) ?? 0;
    const available = Number(wine.inventory ?? 0);

    if (needed > available) {
      throw new Error(
        `Not enough inventory for ${wine.name}. Need ${needed}, but only ${available} available.`
      );
    }
  }

  for (const member of eligibleMembers) {
    const { data: createdCase, error: caseError } = await supabase
      .from("wine_cases")
      .insert([
        {
          member_email: member.email,
          quarter: template.quarter,
          status: "customizing",
          case_size: template.case_size,
          finalize_deadline: template.finalize_deadline ?? null,
          published: true,
          membership_tier: template.membership_tier,
        },
      ])
      .select()
      .single();

    if (caseError) {
      console.error("Error creating member case:", caseError);
      throw caseError;
    }

    if (templateItems.length > 0) {
      const caseItemsPayload = templateItems.map((item) => ({
        case_id: createdCase.id,
        wine_id: item.wine_id,
        quantity: item.quantity,
        is_original_selection: true,
      }));

      const { error: caseItemsError } = await supabase
        .from("case_items")
        .insert(caseItemsPayload);

      if (caseItemsError) {
        console.error("Error creating case items:", caseItemsError);
        throw caseItemsError;
      }
    }

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          member_email: member.email,
          title: `${template.quarter} case is ready`,
          message: `Your ${template.title} (${template.membership_tier}) has been published and is now available in your account.`,
          type: "new_case",
          is_read: false,
        },
      ]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError);
      throw notificationError;
    }
  }

  for (const wine of wines ?? []) {
    const needed = requiredByWine.get(wine.id) ?? 0;
    const available = Number(wine.inventory ?? 0);
    const newInventory = available - needed;

    const { error: inventoryUpdateError } = await supabase
      .from("wines")
      .update({ inventory: newInventory })
      .eq("id", wine.id);

    if (inventoryUpdateError) {
      console.error("Error updating wine inventory:", inventoryUpdateError);
      throw inventoryUpdateError;
    }
  }

  const { error: updateTemplateError } = await supabase
    .from("case_templates")
    .update({ status: "published" })
    .eq("id", templateId);

  if (updateTemplateError) {
    console.error("Error marking template published:", updateTemplateError);
    throw updateTemplateError;
  }

  return true;
}