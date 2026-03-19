import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type MemberRow = {
  id: string;
  square_card_id: string | null;
};

export default async function PostLoginPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let member: MemberRow | null = null;

  const { data: memberByUserId } = await supabase
    .from("members")
    .select("id, square_card_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberByUserId) {
    member = memberByUserId as MemberRow;
  }

  if (!member && user.email) {
    const { data: memberByEmail } = await supabase
      .from("members")
      .select("id, square_card_id")
      .eq("email", user.email)
      .maybeSingle();

    if (memberByEmail) {
      member = memberByEmail as MemberRow;
    }
  }

  if (!member) {
    redirect("/");
  }

  if (!member.square_card_id) {
    redirect("/onboarding/payment-method");
  }

  redirect("/");
}