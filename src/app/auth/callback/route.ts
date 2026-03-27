import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Get the authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  let hasCardOnFile = false;

  // Check by user_id
  const { data: memberByUserId, error: userIdError } = await supabase
    .from("members")
    .select("square_card_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (userIdError) {
    console.error("Callback lookup by user_id failed:", userIdError);
  }

  if (memberByUserId?.square_card_id) {
    hasCardOnFile = true;
  }

  // Fallback check by email
  if (!hasCardOnFile && user.email) {
    const { data: memberByEmail, error: emailError } = await supabase
      .from("members")
      .select("square_card_id")
      .eq("email", user.email)
      .maybeSingle();

    if (emailError) {
      console.error("Callback lookup by email failed:", emailError);
    }

    if (memberByEmail?.square_card_id) {
      hasCardOnFile = true;
    }
  }

  // 🚀 Routing logic
  if (!hasCardOnFile) {
    return NextResponse.redirect(
      `${origin}/onboarding/payment-method`
    );
  }

  return NextResponse.redirect(`${origin}/`);
}