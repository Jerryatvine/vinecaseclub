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

type ExistingPaymentRow = {
  id: string;
  status: string;
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

    const { data: existingPayment, error: existingPaymentError } = await supabase
      .from("payments")
      .select("id, status")
      .eq("case_id", caseId)
      .eq("status", "paid")
      .maybeSingle();

    if (existingPaymentError) {
      return NextResponse.json(
        { error: "Could not verify prior payment history." },
        { status: 500 }
      );
    }

    if (existingPayment) {
      const typedExistingPayment = existingPayment as ExistingPaymentRow;

      return NextResponse.json(
        {
          error: "A paid payment record already exists for this case.",
          paymentId: typedExistingPayment.id,
        },
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

    let totalDollars = 0;

    for (const item of typedItems) {
      const wineValue = item.wines;
      const wineRow = Array.isArray(wineValue) ? wineValue[0] : wineValue;
      const clubPrice = Number(wineRow?.club_price ?? 0);
      const quantity = Number(item.quantity ?? 0);

      totalDollars += clubPrice * quantity;
    }

    if (totalDollars <= 0) {
      return NextResponse.json(
        { error: "Calculated case total is invalid." },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(totalDollars * 100);

    const paymentResponse = await square.paymentsApi.createPayment({
      idempotencyKey: randomUUID(),
      sourceId: typedMember.square_card_id,
      customerId: typedMember.square_customer_id ?? undefined,
      amountMoney: {
        amount: BigInt(amountInCents),
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

    const { error: insertPaymentError } = await supabase.from("payments").insert({
      member_id: typedMember.id,
      case_id: caseId,
      amount: amountInCents,
      square_payment_id: paymentId,
      status: "paid",
    });

    if (insertPaymentError) {
      return NextResponse.json(
        {
          error:
            "Payment succeeded, but payment history failed to save. Please review this case manually.",
          paymentId,
        },
        { status: 500 }
      );
    }

    const chargedAt = new Date().toISOString();

    const { error: updateCaseError } = await supabase
      .from("cases")
      .update({
        charged: true,
        charged_at: chargedAt,
        square_payment_id: paymentId,
      })
      .eq("id", caseId);

    if (updateCaseError) {
      return NextResponse.json(
        {
          error:
            "Payment succeeded and payment history was saved, but the case record failed to update. Please review this case manually.",
          paymentId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentId,
      total: totalDollars,
      amount: amountInCents,
      chargedAt,
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