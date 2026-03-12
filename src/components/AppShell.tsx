"use client";

import { usePathname } from "next/navigation";
import SidebarNav from "@/components/SidebarNav";
import AuthProvider from "@/components/AuthProvider";
import UserHeader from "@/components/UserHeader";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const hideSidebar =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

  if (hideSidebar) {
    return (
      <AuthProvider>
        <main>{children}</main>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <div className="min-h-screen bg-[#f4f2ef] text-stone-900 lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="flex min-h-screen flex-col bg-[#263330] text-white">
          <div className="border-b border-white/10 px-6 py-6">
            <h1 className="text-2xl font-bold">Vine and Table Case Club</h1>
            <p className="mt-1 text-sm text-stone-300">Member Portal</p>
          </div>

          <SidebarNav />
        </aside>

        <div className="min-w-0">
          <UserHeader />
          <main>{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}