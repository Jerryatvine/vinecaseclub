"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, Wine, Search, Users, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type RatingRow = {
  id: string;
  rating: number;
  notes: string | null;
  created_at: string;
  wine: {
    id: string;
    name: string;
    winery: string | null;
    vintage: number | null;
    image_url: string | null;
    type: string | null;
    region: string | null;
  } | null;
  member: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
};

type WineAnalyticsRow = {
  wineId: string;
  wineName: string;
  winery: string | null;
  vintage: number | null;
  avgRating: number;
  ratingCount: number;
};

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`h-4 w-4 ${
            value <= rating ? "fill-amber-400 text-amber-400" : "text-stone-300"
          }`}
        />
      ))}
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-stone-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-stone-800">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-stone-500">{subtitle}</p>}
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function AnalyticsList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: WineAnalyticsRow[];
  emptyText: string;
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-stone-800">{title}</h2>

      {items.length === 0 ? (
        <div className="py-10 text-center text-sm text-stone-500">{emptyText}</div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.wineId}
              className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-800">{item.wineName}</p>
                <p className="text-xs text-stone-500">
                  {[item.winery, item.vintage].filter(Boolean).join(" • ") || "—"}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="font-semibold text-stone-800">
                  {item.avgRating.toFixed(2)} / 5
                </p>
                <p className="text-xs text-stone-500">
                  {item.ratingCount} rating{item.ratingCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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

export default function AdminRatingsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedWine, setSelectedWine] = useState("all");
  const [selectedMember, setSelectedMember] = useState("all");

  useEffect(() => {
    async function loadRatings() {
      try {
        setLoading(true);
        setError("");

        const { data, error } = await supabase
          .from("wine_ratings")
          .select(
            `
              id,
              rating,
              notes,
              created_at,
              wine:wines (
                id,
                name,
                winery,
                vintage,
                image_url,
                type,
                region
              ),
              member:members (
                id,
                name,
                email,
                role
              )
            `
          )
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        setRatings((data ?? []) as unknown as RatingRow[]);
      } catch (err) {
        console.error("Failed to load ratings:", err);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    loadRatings();
  }, [supabase]);

  const wineOptions = useMemo(() => {
    const map = new Map<string, string>();

    ratings.forEach((row) => {
      if (row.wine?.id && row.wine?.name) {
        map.set(row.wine.id, row.wine.name);
      }
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ratings]);

  const memberOptions = useMemo(() => {
    const map = new Map<string, string>();

    ratings.forEach((row) => {
      if (row.member?.id) {
        map.set(row.member.id, row.member.name || row.member.email);
      }
    });

    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ratings]);

  const filteredRatings = useMemo(() => {
    const q = search.trim().toLowerCase();

    return ratings.filter((row) => {
      const wineName = row.wine?.name?.toLowerCase() ?? "";
      const winery = row.wine?.winery?.toLowerCase() ?? "";
      const memberName = row.member?.name?.toLowerCase() ?? "";
      const memberEmail = row.member?.email?.toLowerCase() ?? "";
      const notes = row.notes?.toLowerCase() ?? "";

      const matchesSearch =
        !q ||
        wineName.includes(q) ||
        winery.includes(q) ||
        memberName.includes(q) ||
        memberEmail.includes(q) ||
        notes.includes(q);

      const matchesWine =
        selectedWine === "all" || row.wine?.id === selectedWine;

      const matchesMember =
        selectedMember === "all" || row.member?.id === selectedMember;

      return matchesSearch && matchesWine && matchesMember;
    });
  }, [ratings, search, selectedWine, selectedMember]);

  const analytics = useMemo(() => {
    const totalRatings = ratings.length;

    const averageRating =
      totalRatings > 0
        ? ratings.reduce((sum, row) => sum + row.rating, 0) / totalRatings
        : 0;

    const uniqueWineIds = new Set(
      ratings.map((row) => row.wine?.id).filter(Boolean)
    ).size;

    const uniqueMemberIds = new Set(
      ratings.map((row) => row.member?.id).filter(Boolean)
    ).size;

    const wineMap = new Map<string, WineAnalyticsRow>();

    ratings.forEach((row) => {
      if (!row.wine?.id || !row.wine?.name) return;

      const existing = wineMap.get(row.wine.id);

      if (existing) {
        const nextCount = existing.ratingCount + 1;
        const nextTotal = existing.avgRating * existing.ratingCount + row.rating;

        wineMap.set(row.wine.id, {
          ...existing,
          ratingCount: nextCount,
          avgRating: nextTotal / nextCount,
        });
      } else {
        wineMap.set(row.wine.id, {
          wineId: row.wine.id,
          wineName: row.wine.name,
          winery: row.wine.winery,
          vintage: row.wine.vintage,
          avgRating: row.rating,
          ratingCount: 1,
        });
      }
    });

    const rankedWines = Array.from(wineMap.values())
      .filter((row) => row.ratingCount > 0)
      .sort((a, b) => {
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
        return b.ratingCount - a.ratingCount;
      });

    const lowestRatedWines = [...rankedWines].sort((a, b) => {
      if (a.avgRating !== b.avgRating) return a.avgRating - b.avgRating;
      return b.ratingCount - a.ratingCount;
    });

    return {
      totalRatings,
      averageRating,
      uniqueWineIds,
      uniqueMemberIds,
      topRatedWines: rankedWines.slice(0, 5),
      lowestRatedWines: lowestRatedWines.slice(0, 5),
    };
  }, [ratings]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f2ef]">
        <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-10">
          <div className="h-10 w-64 animate-pulse rounded-2xl bg-stone-200" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-3xl bg-stone-200" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="h-80 animate-pulse rounded-3xl bg-stone-200" />
            <div className="h-80 animate-pulse rounded-3xl bg-stone-200" />
          </div>
          <div className="h-24 animate-pulse rounded-3xl bg-stone-200" />
          <div className="h-96 animate-pulse rounded-3xl bg-stone-200" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f4f2ef]">
        <div className="mx-auto max-w-7xl p-6 lg:p-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
        <div>
          <h1 className="text-3xl font-bold text-stone-800">Wine Ratings</h1>
          <p className="mt-2 text-sm text-stone-500">
            View what each member rated for each wine.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total Ratings"
            value={String(analytics.totalRatings)}
            icon={BarChart3}
            subtitle="All submitted wine ratings"
          />
          <MetricCard
            title="Average Rating"
            value={analytics.totalRatings > 0 ? analytics.averageRating.toFixed(2) : "0.00"}
            icon={Star}
            subtitle="Across all wine ratings"
          />
          <MetricCard
            title="Wines Rated"
            value={String(analytics.uniqueWineIds)}
            icon={Wine}
            subtitle="Unique wines with at least one rating"
          />
          <MetricCard
            title="Members Participating"
            value={String(analytics.uniqueMemberIds)}
            icon={Users}
            subtitle="Unique members who submitted ratings"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyticsList
            title="Top Rated Wines"
            items={analytics.topRatedWines}
            emptyText="No ratings yet."
          />
          <AnalyticsList
            title="Lowest Rated Wines"
            items={analytics.lowestRatedWines}
            emptyText="No ratings yet."
          />
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search wines, members, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-stone-300 bg-white py-2.5 pl-10 pr-3 text-sm text-stone-800 outline-none"
              />
            </div>

            <select
              value={selectedWine}
              onChange={(e) => setSelectedWine(e.target.value)}
              className="rounded-2xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none"
            >
              <option value="all">All Wines</option>
              {wineOptions.map((wine) => (
                <option key={wine.id} value={wine.id}>
                  {wine.name}
                </option>
              ))}
            </select>

            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="rounded-2xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none"
            >
              <option value="all">All Members</option>
              {memberOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-stone-800">All Ratings</h2>
            <p className="text-sm text-stone-500">
              {filteredRatings.length} rating{filteredRatings.length === 1 ? "" : "s"}
            </p>
          </div>

          {filteredRatings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Wine className="mb-3 h-12 w-12 text-stone-300" />
              <p className="text-stone-500">No ratings match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500">
                    <th className="px-3 py-3 font-medium">Wine</th>
                    <th className="px-3 py-3 font-medium">Member</th>
                    <th className="px-3 py-3 font-medium">Rating</th>
                    <th className="px-3 py-3 font-medium">Notes</th>
                    <th className="px-3 py-3 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRatings.map((row) => (
                    <tr key={row.id} className="border-b border-stone-100 align-top">
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-stone-100 text-stone-600">
                            {row.wine?.image_url ? (
                              <img
                                src={row.wine.image_url}
                                alt={row.wine.name ?? "Wine"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Wine className="h-5 w-5" />
                            )}
                          </div>

                          <div>
                            <p className="font-medium text-stone-800">
                              {row.wine?.name ?? "Unknown wine"}
                            </p>
                            <p className="text-xs text-stone-500">
                              {[row.wine?.winery, row.wine?.vintage, row.wine?.region]
                                .filter(Boolean)
                                .join(" • ") || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-4">
                        <p className="font-medium text-stone-800">
                          {row.member?.name || "Unknown member"}
                        </p>
                        <p className="text-xs text-stone-500">
                          {row.member?.email || "—"}
                        </p>
                      </td>

                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <StarDisplay rating={row.rating} />
                          <p className="text-xs text-stone-500">{row.rating}/5</p>
                        </div>
                      </td>

                      <td className="px-3 py-4 text-stone-700">
                        {row.notes?.trim() ? row.notes : "—"}
                      </td>

                      <td className="px-3 py-4 text-stone-500">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
