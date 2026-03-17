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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserCases, type CaseRecord } from "@/lib/services/case-service";
import {
  getUserNotifications,
  type NotificationRecord,
} from "@/lib/services/notification-service";

type User = {
  full_name: string;
  email: string;
};

type ProfileRecord = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  membership_tier: string | null;
};

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-stone-200 bg-white shadow-sm ${className}`}
    >
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

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return [
      maybeError.message ? `message: ${maybeError.message}` : null,
      maybeError.details ? `details: ${maybeError.details}` : null,
      maybeError.hint ? `hint: ${maybeError.hint}` : null,
      maybeError.code ? `code: ${maybeError.code}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const authUser = session?.user;
        const email = authUser?.email?.trim().toLowerCase();

        if (!email) {
          setUser(null);
          setCases([]);
          setNotifications([]);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, name, email, role, membership_tier")
          .eq("email", email)
          .maybeSingle<ProfileRecord>();

        if (profileError) {
          console.error("Failed to load profile:", profileError);
        }

        setUser({
          full_name:
            profile?.name ||
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            "Member",
          email: profile?.email || email,
        });

        const [caseData, notificationData] = await Promise.all([
          getUserCases(email),
          getUserNotifications(email),
        ]);

        setCases(caseData);
        setNotifications(notificationData);
      } catch (err) {
        console.error("Dashboard load failed:", err);
        setError(getErrorMessage(err) || "Could not load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [supabase]);

  const currentCase = useMemo(() => {
    return (
      cases.find((c) =>
        ["draft", "customizing", "finalized", "ready_for_pickup"].includes(c.status)
      ) ?? null
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
          ].map((stat) => (
            <Card key={stat.label}>
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
          ))}
        </div>

        {currentCase && (
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Current Quarter</h2>
                  <p className="text-sm text-stone-500">
                    {currentCase.quarter} · {currentCase.case_size ?? 12} bottles
                  </p>
                </div>
                <CaseStatusBadge status={currentCase.status} />
              </div>

              <div className="mt-4">
                <Link
                  href="/my-case"
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm"
                >
                  View My Case
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}