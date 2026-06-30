import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Client, Environment } from "square/legacy";
import { createClient } from "@supabase/supabase-js";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const squareAccessToken = getRequiredEnv("SQUARE_ACCESS_TOKEN");
const squareEnvironment =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? Environment.Production
    : Environment.Sandbox;

const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseServiceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

const square = new Client({
  bearerAuthCredentials: {
    accessToken: squareAccessToken,
  },
  environment: squareEnvironment,
});

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

type CaseStatus =
  | "draft"
  | "customizing"
  | "finalized"
  | "ready_for_pickup"
  | "picked_up";

type CaseRow = {
  id: string;
  member_email: string | null;
  charged: boolean | null;
  status: CaseStatus;
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

function canChargeFromStatus(status: CaseStatus) {
  return status === "finalized" || status === "ready_for_pickup";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const caseId = body?.caseId;

    if (!caseId || typeof caseId !== "string") {
      return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
    }

    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("id, member_email, charged, status")
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

    if (!canChargeFromStatus(typedCase.status)) {
      return NextResponse.json(
        {
          error:
            "Case cannot be charged until it is finalized or ready for pickup.",
        },
        { status: 400 }
      );
    }

    const { data: existingPayment, error: existingPaymentError } =
      await supabase
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
      autocomplete: true,
    });

    const payment = paymentResponse.result.payment;
    const paymentId = payment?.id;
    const paymentStatus = payment?.status;

    if (!paymentId || paymentStatus !== "COMPLETED") {
      return NextResponse.json(
        {
          error: "Square payment failed.",
          details: paymentStatus ?? "No payment status returned.",
        },
        { status: 500 }
      );
    }

    const { error: insertPaymentError } = await supabase
      .from("payments")
      .insert({
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
          details: insertPaymentError.message,
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
          details: updateCaseError.message,
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
      environment:
        process.env.SQUARE_ENVIRONMENT === "production"
          ? "production"
          : "sandbox",
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