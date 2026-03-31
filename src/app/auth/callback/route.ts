import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CaseStatus =
  | "draft"
  | "customizing"
  | "finalized"
  | "ready_for_pickup"
  | "picked_up";

type CaseTier = "economy" | "premium";

type MemberRecord = {
  id: string;
  email: string | null;
  user_id: string | null;
  membership_tier: CaseTier | null;
  square_card_id: string | null;
};

type TemplateCase = {
  id: string;
  title: string | null;
  quarter: string;
  status: CaseStatus;
  tier: CaseTier;
  case_size: number | null;
  target_price_cap: number | null;
  finalize_deadline: string | null;
  created_at: string | null;
  member_email: string | null;
};

type CaseItemRecord = {
  wine_id: string;
  quantity: number;
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Auth code exchange failed:", exchangeError);
      return NextResponse.redirect(`${origin}/login`);
    }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    if (userError) {
      console.error("Failed to load authenticated user:", userError);
    }
    return NextResponse.redirect(`${origin}/login`);
  }

  const normalizedEmail = user.email?.trim().toLowerCase() ?? null;

  let member: MemberRecord | null = null;

  const { data: memberByUserId, error: userIdError } = await supabase
    .from("members")
    .select("id, email, user_id, membership_tier, square_card_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (userIdError) {
    console.error("Callback lookup by user_id failed:", userIdError);
  }

  if (memberByUserId) {
    member = memberByUserId as MemberRecord;
  }

  if (!member && normalizedEmail) {
    const { data: memberByEmail, error: emailError } = await supabase
      .from("members")
      .select("id, email, user_id, membership_tier, square_card_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (emailError) {
      console.error("Callback lookup by email failed:", emailError);
    }

    if (memberByEmail) {
      member = memberByEmail as MemberRecord;
    }
  }

  if (member) {
    const needsUserIdLink = !member.user_id;

    if (needsUserIdLink) {
      const { error: linkError } = await supabase
        .from("members")
        .update({ user_id: user.id })
        .eq("id", member.id);

      if (linkError) {
        console.error("Failed to link member to auth user:", linkError);
      } else {
        member = {
          ...member,
          user_id: user.id,
        };
      }
    }
  }

  if (member && member.membership_tier && normalizedEmail) {
    const { data: latestTemplate, error: templateError } = await supabase
      .from("cases")
      .select(
        `
          id,
          title,
          quarter,
          status,
          tier,
          case_size,
          target_price_cap,
          finalize_deadline,
          created_at,
          member_email
        `
      )
      .eq("tier", member.membership_tier)
      .eq("status", "customizing")
      .is("member_email", null)
      .is("template_case_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (templateError) {
      console.error("Failed to load latest published template case:", templateError);
    }

    const template = latestTemplate as TemplateCase | null;

    if (template) {
      const { data: existingClone, error: existingCloneError } = await supabase
        .from("cases")
        .select("id")
        .eq("template_case_id", template.id)
        .eq("member_email", normalizedEmail)
        .maybeSingle();

      if (existingCloneError) {
        console.error("Failed to check for existing member case clone:", existingCloneError);
      }

      if (!existingClone) {
        const { data: templateItems, error: templateItemsError } = await supabase
          .from("case_items")
          .select("wine_id, quantity")
          .eq("case_id", template.id);

        if (templateItemsError) {
          console.error("Failed to load template case items:", templateItemsError);
        } else {
          const { data: createdCase, error: createCaseError } = await supabase
            .from("cases")
            .insert([
              {
                title: template.title ?? template.quarter,
                quarter: template.quarter,
                status: "customizing",
                tier: template.tier,
                case_size: template.case_size ?? 12,
                target_price_cap: template.target_price_cap ?? null,
                member_email: normalizedEmail,
                finalize_deadline: template.finalize_deadline ?? null,
                template_case_id: template.id,
              },
            ])
            .select("id")
            .single();

          if (createCaseError || !createdCase) {
            console.error("Failed to create member case clone:", createCaseError);
          } else {
            const copiedItems = ((templateItems ?? []) as CaseItemRecord[]).map((item) => ({
              case_id: createdCase.id,
              wine_id: item.wine_id,
              quantity: item.quantity,
            }));

            if (copiedItems.length > 0) {
              const { error: insertItemsError } = await supabase
                .from("case_items")
                .insert(copiedItems);

              if (insertItemsError) {
                console.error("Failed to copy template case items:", insertItemsError);
              }
            }
          }
        }
      }
    }
  }

  const hasCardOnFile = !!member?.square_card_id;

  if (!hasCardOnFile) {
    return NextResponse.redirect(`${origin}/onboarding/payment-method`);
  }

  return NextResponse.redirect(`${origin}/`);
}