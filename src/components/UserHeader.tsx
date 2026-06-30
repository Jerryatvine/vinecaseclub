"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MemberRole = "admin" | "member";
type MembershipTier = "economy" | "premium";

type HeaderUser = {
  name: string;
  email: string;
  role: MemberRole;
  membership_tier: MembershipTier;
};

export default function UserHeader() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<HeaderUser | null>(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const authUser = session?.user;

      if (!authUser) {
        setUser(null);
        return;
      }

      let member: HeaderUser | null = null;

      // try lookup by user_id
      const { data: memberByUserId } = await supabase
        .from("members")
        .select("name, email, role, membership_tier")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (memberByUserId) {
        member = memberByUserId as HeaderUser;
      }

      // fallback lookup by email
      if (!member && authUser.email) {
        const { data: memberByEmail } = await supabase
          .from("members")
          .select("name, email, role, membership_tier")
          .eq("email", authUser.email)
          .maybeSingle();

        if (memberByEmail) {
          member = memberByEmail as HeaderUser;
        }
      }

      setUser(member);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (!user) {
    return (
      <div className="text-right pr-6 pt-4">
        <p className="text-sm text-stone-500">Not signed in</p>
      </div>
    );
  }

  return (
    <div className="text-right pr-6 pt-4">
      <p className="text-sm font-medium text-stone-800">{user.name}</p>
      <p className="text-xs text-stone-500">{user.email}</p>
      <p className="text-xs capitalize text-stone-500">
        {user.role} · {user.membership_tier}
      </p>
    </div>
  );
}
