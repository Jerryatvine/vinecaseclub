"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  Shield,
  Star,
  Wine,
} from "lucide-react";

type MemberRole = "admin" | "member";

const baseNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-case", label: "My Case", icon: Package },
  { href: "/account/billing", label: "Billing", icon: CreditCard },
  { href: "/wine-catalog", label: "Wine Catalog", icon: Wine },
  { href: "/rate-wines", label: "Rate Wines", icon: Star },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [role, setRole] = useState<MemberRole>("member");

  useEffect(() => {
    async function loadMemberRole() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const authUser = session?.user;
      if (!authUser) {
        setRole("member");
        return;
      }

      let memberRole: MemberRole | null = null;

      const { data: memberByUserId, error: userIdError } = await supabase
        .from("members")
        .select("role")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (userIdError) {
        console.error("Failed to load member role by user_id:", userIdError);
      }

      if (
        memberByUserId?.role === "admin" ||
        memberByUserId?.role === "member"
      ) {
        memberRole = memberByUserId.role;
      }

      if (!memberRole && authUser.email) {
        const { data: memberByEmail, error: emailError } = await supabase
          .from("members")
          .select("role")
          .eq("email", authUser.email)
          .maybeSingle();

        if (emailError) {
          console.error("Failed to load member role by email:", emailError);
        }

        if (
          memberByEmail?.role === "admin" ||
          memberByEmail?.role === "member"
        ) {
          memberRole = memberByEmail.role;
        }
      }

      setRole(memberRole ?? "member");
    }

    loadMemberRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadMemberRole();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const navItems =
    role === "admin"
      ? [...baseNavItems, { href: "/admin", label: "Admin", icon: Shield }]
      : baseNavItems;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex flex-col gap-2 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                isActive
                  ? "bg-white/15 text-white"
                  : "text-stone-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-stone-200 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}