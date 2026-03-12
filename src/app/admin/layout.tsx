import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let role: "admin" | "member" | null = null;

  const { data: memberByUserId, error: userIdError } = await supabase
    .from("members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (userIdError) {
    console.error("Admin layout lookup by user_id failed:", userIdError);
  }

  if (
    memberByUserId?.role === "admin" ||
    memberByUserId?.role === "member"
  ) {
    role = memberByUserId.role;
  }

  if (!role && user.email) {
    const { data: memberByEmail, error: emailError } = await supabase
      .from("members")
      .select("role")
      .eq("email", user.email)
      .maybeSingle();

    if (emailError) {
      console.error("Admin layout lookup by email failed:", emailError);
    }

    if (
      memberByEmail?.role === "admin" ||
      memberByEmail?.role === "member"
    ) {
      role = memberByEmail.role;
    }
  }

  if (role !== "admin") {
    redirect("/");
  }

  return <>{children}</>;
}