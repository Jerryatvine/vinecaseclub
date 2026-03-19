import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Client, Environment } from "square/legacy";
import { createClient } from "@supabase/supabase-js";

const square = new Client({
  bearerAuthCredentials: {
    accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  },
  environment:
    process.env.SQUARE_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CaseRow = {
  id: string;
  member_email: string | null;
  charged: boolean | null;
};

type MemberRow = {
  id: string;
  email: string | null;
  square_customer_id: string | null;
  square_card_id: string | null;
};

type CaseItemWithWine = {
  quantity: number;
  wines:
    | {
        club_price: number | null;
      }
    | {
        club_price: number | null;
      }[]
    | null;
};

export async function POST(req: Request) {
  try {
    const { caseId } = await req.json();

    if (!caseId) {
      return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
    }

    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("id, member_email, charged")
      .eq("id", caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const typedCase = caseData as CaseRow;

    if (!typedCase.member_email) {
      return NextResponse.json(
        { error: "Cannot charge a template case." },
        { status: 400 }
      );
    }

    if (typedCase.charged) {
      return NextResponse.json(
        { error: "Case already charged." },
        { status: 400 }
      );
    }

    const normalizedEmail = typedCase.member_email.trim().toLowerCase();

    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, email, square_customer_id, square_card_id")
      .eq("email", normalizedEmail)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const typedMember = member as MemberRow;

    if (!typedMember.square_card_id) {
      return NextResponse.json(
        { error: "Member does not have a saved card on file." },
        { status: 400 }
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from("case_items")
      .select(
        `
          quantity,
          wines (
            club_price
          )
        `
      )
      .eq("case_id", caseId);

    if (itemsError) {
      return NextResponse.json(
        { error: "Could not load case items." },
        { status: 500 }
      );
    }

    const typedItems = (items ?? []) as CaseItemWithWine[];

    if (typedItems.length === 0) {
      return NextResponse.json(
        { error: "Case has no items to charge." },
        { status: 400 }
      );
    }

    let total = 0;

    for (const item of typedItems) {
      const wineValue = item.wines;
      const wineRow = Array.isArray(wineValue) ? wineValue[0] : wineValue;
      const clubPrice = Number(wineRow?.club_price ?? 0);
      const quantity = Number(item.quantity ?? 0);

      total += clubPrice * quantity;
    }

    if (total <= 0) {
      return NextResponse.json(
        { error: "Calculated case total is invalid." },
        { status: 400 }
      );
    }

    const paymentResponse = await square.paymentsApi.createPayment({
      idempotencyKey: randomUUID(),
      sourceId: typedMember.square_card_id,
      customerId: typedMember.square_customer_id ?? undefined,
      amountMoney: {
        amount: Math.round(total * 100),
        currency: "USD",
      },
    });

    const paymentId = paymentResponse.result.payment?.id;

    if (!paymentId) {
      return NextResponse.json(
        { error: "Square payment failed." },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("cases")
      .update({
        charged: true,
        charged_at: new Date().toISOString(),
        square_payment_id: paymentId,
      })
      .eq("id", caseId);

    if (updateError) {
      return NextResponse.json(
        {
          error: "Payment succeeded, but case record failed to update.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentId,
      total,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Charge failed",
      },
      { status: 500 }
    );
  }
}