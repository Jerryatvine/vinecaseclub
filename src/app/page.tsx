"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wine,
  Package,
  Star,
  Bell,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserCases, type CaseRecord } from "@/lib/services/case-service";
import { getUserNotifications } from "@/lib/services/notification-service";

type User = {
  full_name: string;
  email: string;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
};

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-stone-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-stone-200/80 ${className}`} />;
}

function CaseStatusBadge({ status }: { status: CaseRecord["status"] }) {
  const labelMap: Record<CaseRecord["status"], string> = {
    draft: "Draft",
    customizing: "Customizing",
    finalized: "Finalized",
    ready_for_pickup: "Ready for Pickup",
    picked_up: "Picked Up",
  };

  const colorMap: Record<CaseRecord["status"], string> = {
    draft: "bg-stone-100 text-stone-700",
    customizing: "bg-amber-100 text-amber-800",
    finalized: "bg-blue-100 text-blue-800",
    ready_for_pickup: "bg-green-100 text-green-800",
    picked_up: "bg-stone-200 text-stone-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${colorMap[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}

export default function DashboardPage() {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const authUser = session?.user;
        const email = authUser?.email;

        if (!email) {
          setUser(null);
          setCases([]);
          setNotifications([]);
          return;
        }

        const { data: member, error: memberError } = await supabase
          .from("members")
          .select("name, email")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (memberError) {
          console.error("Failed to load member profile:", memberError);
        }

        setUser({
          full_name: member?.name || authUser.user_metadata?.full_name || "Member",
          email: member?.email || email,
        });

        const [caseData, notificationData] = await Promise.all([
          getUserCases(email),
          getUserNotifications(email),
        ]);

        setCases(caseData);
        setNotifications(notificationData);
      } catch (err) {
        console.error(err);
        setError("Could not load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [supabase]);

  const currentCase = useMemo(() => {
    return cases.find((c) =>
      ["draft", "customizing", "finalized", "ready_for_pickup"].includes(c.status)
    );
  }, [cases]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f2ef] p-6 lg:p-10">
        <div className="mx-auto max-w-6xl space-y-8">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-3xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f4f2ef] p-6 lg:p-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-red-600">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-sm text-stone-500">Welcome back,</p>
          <h1 className="text-3xl font-bold tracking-tight text-stone-800 lg:text-5xl">
            {user?.full_name || "Member"}
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Package,
              label: "Total Cases",
              value: cases.length,
              color: "bg-stone-100 text-stone-700",
            },
            {
              icon: Wine,
              label: "Active Case",
              value: currentCase ? "Yes" : "None",
              color: "bg-emerald-100 text-emerald-700",
            },
            {
              icon: Bell,
              label: "Unread",
              value: notifications.filter((n) => !n.is_read).length,
              color: "bg-green-100 text-green-700",
            },
            {
              icon: Star,
              label: "Cases Picked Up",
              value: cases.filter((c) => c.status === "picked_up").length,
              color: "bg-rose-100 text-rose-700",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Card>
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.color}`}
                  >
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-stone-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-stone-800">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {currentCase && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="overflow-hidden bg-gradient-to-br from-white to-stone-50">
              <CardContent className="p-6 lg:p-8">
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-emerald-700" />
                      <h2 className="text-xl font-semibold text-stone-800">
                        Current Quarter
                      </h2>
                    </div>
                    <p className="text-sm text-stone-500">
                      {currentCase.quarter} · {(currentCase.case_size ?? 12)}-bottle case
                    </p>
                  </div>
                  <CaseStatusBadge status={currentCase.status} />
                </div>

                {currentCase.status === "customizing" && currentCase.finalize_deadline && (
                  <p className="mb-4 text-sm text-emerald-700">
                    Customize before{" "}
                    {new Date(currentCase.finalize_deadline).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}

                {currentCase.status === "ready_for_pickup" && (
                  <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-700">
                      Your case is ready! Pick it up at the shop.
                    </p>
                  </div>
                )}

                <div className="pt-2">
                  <Link
                    href="/my-case"
                    className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                  >
                    View My Case
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {notifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-800">
                Recent Notifications
              </h2>
              <Link
                href="/notifications"
                className="text-sm font-medium text-emerald-700 hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="space-y-3">
              {notifications.slice(0, 3).map((notif) => (
                <Card key={notif.id}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100">
                      <Bell className="h-4 w-4 text-stone-700" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-800">{notif.title}</p>
                      <p className="mt-0.5 text-xs text-stone-500">{notif.message}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link href="/wine-catalog">
            <Card className="group transition hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 transition group-hover:scale-105">
                  <Wine className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-stone-800">Browse Wine Catalog</p>
                  <p className="text-xs text-stone-500">Explore all available wines</p>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 text-stone-400" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/rate-wines">
            <Card className="group transition hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 transition group-hover:scale-105">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-stone-800">Rate Your Wines</p>
                  <p className="text-xs text-stone-500">Share your tasting notes</p>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 text-stone-400" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
}
