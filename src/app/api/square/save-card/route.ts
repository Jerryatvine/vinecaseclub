import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Client, Environment } from "square/legacy";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "save-card route is reachable",
  });
}

const square = new Client({
  bearerAuthCredentials: {
    accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  },
  environment:
    process.env.SQUARE_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
});

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MemberRow = {
  id: string;
  name: string | null;
  email: string | null;
  user_id: string | null;
  square_customer_id: string | null;
  square_card_id: string | null;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Not authenticated", details: "Missing access token." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Not authenticated",
          details: userError?.message ?? "Invalid access token.",
        },
        { status: 401 }
      );
    }

    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    let member: MemberRow | null = null;

    const { data: memberByUserId, error: memberByUserIdError } =
      await supabaseAdmin
        .from("members")
        .select("id, name, email, user_id, square_customer_id, square_card_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (memberByUserIdError) {
      return NextResponse.json(
        {
          error: "Failed to load member",
          details: memberByUserIdError.message,
        },
        { status: 500 }
      );
    }

    if (memberByUserId) {
      member = memberByUserId as MemberRow;
    }

    if (!member && user.email) {
      const { data: memberByEmail, error: memberByEmailError } =
        await supabaseAdmin
          .from("members")
          .select("id, name, email, user_id, square_customer_id, square_card_id")
          .eq("email", user.email)
          .maybeSingle();

      if (memberByEmailError) {
        return NextResponse.json(
          {
            error: "Failed to load member",
            details: memberByEmailError.message,
          },
          { status: 500 }
        );
      }

      if (memberByEmail) {
        member = memberByEmail as MemberRow;
      }
    }

    if (!member) {
      return NextResponse.json(
        {
          error: "Member not found",
          details: "No matching member record was found for this user.",
        },
        { status: 404 }
      );
    }

    let customerId = member.square_customer_id;

    if (!customerId) {
      const customerRes = await square.customersApi.createCustomer({
        emailAddress: member.email ?? user.email ?? undefined,
        givenName: member.name ?? undefined,
      });

      customerId = customerRes.result.customer?.id ?? null;

      if (!customerId) {
        return NextResponse.json(
          { error: "Failed to create Square customer" },
          { status: 500 }
        );
      }

      const { error: updateCustomerError } = await supabaseAdmin
        .from("members")
        .update({ square_customer_id: customerId })
        .eq("id", member.id);

      if (updateCustomerError) {
        return NextResponse.json(
          {
            error: "Failed to save Square customer ID",
            details: updateCustomerError.message,
          },
          { status: 500 }
        );
      }
    }

    const cardRes = await square.cardsApi.createCard({
      idempotencyKey: randomUUID(),
      sourceId: token,
      card: {
        customerId,
      },
    });

    const cardId = cardRes.result.card?.id ?? null;

    if (!cardId) {
      return NextResponse.json(
        { error: "Failed to create card on file" },
        { status: 500 }
      );
    }

    const { error: updateCardError } = await supabaseAdmin
      .from("members")
      .update({ square_card_id: cardId })
      .eq("id", member.id);

    if (updateCardError) {
      return NextResponse.json(
        {
          error: "Failed to save Square card ID",
          details: updateCardError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      customerId,
      cardId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      {
        error: "Failed to save card",
        details: message,
      },
      { status: 500 }
    );
  }
}