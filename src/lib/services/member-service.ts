import { createClient } from "@/lib/supabase/client";
import type { Member, MemberRole, MembershipTier } from "@/lib/types/member";

export async function findMemberByUserId(
  userId: string
): Promise<Member | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("findMemberByUserId error:", error);
    return null;
  }

  return data as Member | null;
}

export async function findMemberByEmail(email: string): Promise<Member | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("findMemberByEmail error:", error);
    return null;
  }

  return data as Member | null;
}

export async function getAllMembers(): Promise<Member[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAllMembers error:", error);
    return [];
  }

  return (data ?? []) as Member[];
}

export async function createMember(input: {
  user_id: string;
  name: string;
  email: string;
  membership_tier: MembershipTier;
  role?: MemberRole;
}): Promise<Member | null> {
  const supabase = createClient();

  const existing = await findMemberByEmail(input.email);
  if (existing) {
    throw new Error("An account with that email already exists.");
  }

  const { data, error } = await supabase
    .from("members")
    .insert([
      {
        user_id: input.user_id,
        name: input.name,
        email: input.email.toLowerCase(),
        membership_tier: input.membership_tier,
        role: input.role ?? "member",
      },
    ])
    .select()
    .maybeSingle();

  if (error) {
    console.error("createMember error:", error);
    throw error;
  }

  return data as Member | null;
}

export async function updateMemberRole(
  memberId: string,
  role: MemberRole
): Promise<Member | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("members")
    .update({ role })
    .eq("id", memberId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("updateMemberRole error:", error);
    return null;
  }

  return data as Member | null;
}

export async function updateMemberTier(
  memberId: string,
  membership_tier: MembershipTier
): Promise<Member | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("members")
    .update({ membership_tier })
    .eq("id", memberId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("updateMemberTier error:", error);
    return null;
  }

  return data as Member | null;
}