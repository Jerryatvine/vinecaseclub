import { NextResponse } from "next/server";
import { Client, Environment } from "square/legacy";
import { createClient } from "@/lib/supabase/server";

const square = new Client({
  bearerAuthCredentials: {
    accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  },
  environment:
    process.env.SQUARE_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
});

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: userError?.message ?? "Not authenticated." },
        { status: 401 }
      );
    }

    let squareCardId: string | null = null;

    const { data: memberByUserId, error: memberByUserIdError } = await supabase
      .from("members")
      .select("square_card_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberByUserIdError) {
      return NextResponse.json(
        { error: memberByUserIdError.message },
        { status: 500 }
      );
    }

    if (memberByUserId?.square_card_id) {
      squareCardId = memberByUserId.square_card_id;
    }

    if (!squareCardId && user.email) {
      const { data: memberByEmail, error: memberByEmailError } = await supabase
        .from("members")
        .select("square_card_id")
        .eq("email", user.email)
        .maybeSingle();

      if (memberByEmailError) {
        return NextResponse.json(
          { error: memberByEmailError.message },
          { status: 500 }
        );
      }

      if (memberByEmail?.square_card_id) {
        squareCardId = memberByEmail.square_card_id;
      }
    }

    if (!squareCardId) {
      return NextResponse.json({ card: null });
    }

    const cardRes = await square.cardsApi.retrieveCard(squareCardId);
    const card = cardRes.result.card;

    return NextResponse.json({
      card: {
        last4: card?.last4 ?? null,
        brand: card?.cardBrand ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to fetch card:", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch card",
      },
      { status: 500 }
    );
  }
}