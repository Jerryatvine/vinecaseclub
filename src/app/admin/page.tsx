import Link from "next/link";
import { Bell, Package, Shield, Wine, Star } from "lucide-react";

const adminCards = [
  {
    title: "Manage Wines",
    description: "Add wines, edit pricing, and update inventory.",
    href: "/admin/wines",
    icon: Wine,
  },
  {
    title: "Wine Ratings",
    description: "See what each member rated for each wine.",
    href: "/admin/ratings",
    icon: Star,
  },
  {
    title: "Manage Cases",
    description: "Create quarterly cases and assign bottles.",
    href: "/admin/cases",
    icon: Package,
  },
  {
    title: "Members",
    description: "View club members and their case activity.",
    href: "/admin/members",
    icon: Shield,
  },
  {
    title: "Notifications",
    description: "Send pickup or case update notifications.",
    href: "/admin/notifications",
    icon: Bell,
  },
];

export default function AdminDashboardPage() {
  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-10">
        <div>
          <h1 className="text-3xl font-bold text-stone-800">Admin Dashboard</h1>
          <p className="mt-2 text-sm text-stone-500">
            Manage wines, ratings, cases, members, and notifications.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {adminCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                className="block rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                    <Icon className="h-6 w-6" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-stone-800">
                      {card.title}
                    </h2>
                    <p className="mt-2 text-sm text-stone-500">
                      {card.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}