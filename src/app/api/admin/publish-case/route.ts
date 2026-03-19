import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CaseStatus =
  | "draft"
  | "customizing"
  | "finalized"
  | "ready_for_pickup"
  | "picked_up";

type CaseTier = "economy" | "premium";

type TemplateCase = {
  id: string;
  title?: string | null;
  quarter: string;
  status: CaseStatus;
  tier: CaseTier;
  case_size?: number | null;
  target_price_cap?: number | null;
  finalize_deadline?: string | null;
  member_email?: string | null;
};

type MemberRecord = {
  id: string;
  email: string | null;
  membership_tier: string | null;
  role: string | null;
};

type CaseItemRecord = {
  wine_id: string;
  quantity: number;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { data: adminMember, error: adminMemberError } = await supabaseAdmin
      .from("members")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (adminMemberError || !adminMember || adminMember.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { caseId } = await req.json();

    if (!caseId) {
      return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
    }

    const { data: templateCase, error: templateError } = await supabaseAdmin
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
          member_email
        `
      )
      .eq("id", caseId)
      .single();

    if (templateError || !templateCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const typedTemplate = templateCase as TemplateCase;

    if (typedTemplate.member_email) {
      return NextResponse.json(
        { error: "Only template cases can be published to all members." },
        { status: 400 }
      );
    }

    const { data: caseItems, error: caseItemsError } = await supabaseAdmin
      .from("case_items")
      .select("wine_id, quantity")
      .eq("case_id", caseId);

    if (caseItemsError) {
      return NextResponse.json(
        { error: "Could not load template case items." },
        { status: 500 }
      );
    }

    const typedItems = (caseItems ?? []) as CaseItemRecord[];

    const { data: members, error: membersError } = await supabaseAdmin
      .from("members")
      .select("id, email, membership_tier, role")
      .eq("membership_tier", typedTemplate.tier)
      .eq("role", "member");

    if (membersError) {
      return NextResponse.json(
        { error: "Could not load members for this tier." },
        { status: 500 }
      );
    }

    const eligibleMembers = ((members ?? []) as MemberRecord[]).filter(
      (member) => member.email
    );

    if (eligibleMembers.length === 0) {
      return NextResponse.json(
        { error: "No eligible members found for this tier." },
        { status: 400 }
      );
    }

    const memberEmails = eligibleMembers
      .map((member) => member.email?.trim().toLowerCase())
      .filter(Boolean) as string[];

    const { data: existingCopies, error: existingCopiesError } = await supabaseAdmin
      .from("cases")
      .select("id, member_email")
      .eq("template_case_id", caseId)
      .in("member_email", memberEmails);

    if (existingCopiesError) {
      return NextResponse.json(
        { error: "Could not check existing published cases." },
        { status: 500 }
      );
    }

    const existingEmailSet = new Set(
      (existingCopies ?? [])
        .map((row) => row.member_email?.trim().toLowerCase())
        .filter(Boolean)
    );

    let createdCount = 0;

    for (const member of eligibleMembers) {
      const normalizedEmail = member.email?.trim().toLowerCase();

      if (!normalizedEmail) continue;
      if (existingEmailSet.has(normalizedEmail)) continue;

      const { data: createdCase, error: createCaseError } = await supabaseAdmin
        .from("cases")
        .insert([
          {
            title: typedTemplate.title ?? typedTemplate.quarter,
            quarter: typedTemplate.quarter,
            status: "customizing",
            tier: typedTemplate.tier,
            case_size: typedTemplate.case_size ?? 12,
            target_price_cap: typedTemplate.target_price_cap ?? null,
            member_email: normalizedEmail,
            finalize_deadline: typedTemplate.finalize_deadline ?? null,
            template_case_id: typedTemplate.id,
          },
        ])
        .select("id")
        .single();

      if (createCaseError || !createdCase) {
        return NextResponse.json(
          { error: `Failed to create case for ${normalizedEmail}.` },
          { status: 500 }
        );
      }

      if (typedItems.length > 0) {
        const copiedItems = typedItems.map((item) => ({
          case_id: createdCase.id,
          wine_id: item.wine_id,
          quantity: item.quantity,
        }));

        const { error: insertItemsError } = await supabaseAdmin
          .from("case_items")
          .insert(copiedItems);

        if (insertItemsError) {
          return NextResponse.json(
            { error: `Failed to copy case items for ${normalizedEmail}.` },
            { status: 500 }
          );
        }
      }

      createdCount += 1;
    }

    const { error: updateTemplateError } = await supabaseAdmin
      .from("cases")
      .update({ status: "customizing" })
      .eq("id", caseId);

    if (updateTemplateError) {
      return NextResponse.json(
        { error: "Published copies were created, but template status was not updated." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      createdCount,
      skippedCount: eligibleMembers.length - createdCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to publish case.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}