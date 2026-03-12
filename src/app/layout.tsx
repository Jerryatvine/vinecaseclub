"use client";

import { usePathname } from "next/navigation";
import SidebarNav from "@/components/sidebar-nav";

export default function RootLayout({
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

  return (
    <html lang="en">
      <body>
        {!hideSidebar && <SidebarNav />}
        {children}
      </body>
    </html>
  );
}