"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Package, Star, Wine } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { getUserCases, getCaseItems } from "@/lib/services/case-service";
import { getAllWines } from "@/lib/services/wine-service";

type WineCase = {
  id: string;
  quarter: string;
  status: "draft" | "customizing" | "finalized" | "ready_for_pickup" | "picked_up";
};

type CaseItem = {
  id: string;
  case_id: string;
  wine_id: string;
  quantity: number;
};

type WineItem = {
  id: string;
  name: string;
  winery: string;
  vintage?: number | null;
  image_url?: string | null;
  tasting_notes?: string | null;
};

type MemberRow = {
  id: string;
  email: string;
  role: string;
  user_id: string | null;
};

type WineRating = {
  id: string;
  member_id: string;
  wine_id: string;
  rating: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
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

function Button({
  children,
  className = "",
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full rounded-2xl border border-stone-300 px-3 py-2 text-sm outline-none ${className}`}
    />
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-stone-200 ${className}`} />;
}

function StarRating({
  rating,
  onChange,
  readOnly = false,
  size = "md",
}: {
  rating: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
}) {
  const starClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(value)}
          className={readOnly ? "cursor-default" : "cursor-pointer"}
        >
          <Star
            className={`${starClass} ${
              value <= rating ? "fill-amber-400 text-amber-400" : "text-stone-300"
            }`}
          />
        </button>
      ))}
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

export default function RateWinesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [pastCases, setPastCases] = useState<WineCase[]>([]);
  const [winesMap, setWinesMap] = useState<Record<string, WineItem>>({});
  const [caseItemsMap, setCaseItemsMap] = useState<Record<string, CaseItem[]>>({});
  const [ratings, setRatings] = useState<Record<string, WineRating>>({});
  const [editingWineId, setEditingWineId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingNotes, setRatingNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
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
        if (!authUser) {
          setPastCases([]);
          setLoading(false);
          return;
        }

        const { data: member, error: memberError } = await supabase
          .from("members")
          .select("id, email, role, user_id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (memberError) {
          throw memberError;
        }

        if (!member) {
          setPastCases([]);
          setError("Could not find your member profile.");
          setLoading(false);
          return;
        }

        const typedMember = member as MemberRow;
        setMemberId(typedMember.id);

        const [myCases, allWines, ratingsResponse] = await Promise.all([
          getUserCases(typedMember.email),
          getAllWines(),
          supabase.from("wine_ratings").select("*").eq("member_id", typedMember.id),
        ]);

        if (ratingsResponse.error) {
          throw ratingsResponse.error;
        }

        const rateableCases = myCases.filter((c) =>
          ["picked_up", "finalized", "ready_for_pickup"].includes(c.status)
        );
        setPastCases(rateableCases);

        const itemsMap: Record<string, CaseItem[]> = {};
        for (const c of rateableCases) {
          itemsMap[c.id] = await getCaseItems(c.id);
        }
        setCaseItemsMap(itemsMap);

        const wineMap: Record<string, WineItem> = {};
        allWines.forEach((w) => {
          wineMap[w.id] = w;
        });
        setWinesMap(wineMap);

        const rMap: Record<string, WineRating> = {};
        (ratingsResponse.data ?? []).forEach((r) => {
          const rating = r as WineRating;
          rMap[rating.wine_id] = rating;
        });
        setRatings(rMap);
      } catch (err) {
        console.error("Failed to load rate wines page:", err);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [supabase]);

  const handleStartRating = (wineId: string) => {
    const existing = ratings[wineId];
    setEditingWineId(wineId);
    setRatingValue(existing?.rating || 0);
    setRatingNotes(existing?.notes || "");
  };

  const handleCancelRating = () => {
    setEditingWineId(null);
    setRatingValue(0);
    setRatingNotes("");
  };

  const handleSaveRating = async () => {
    if (!editingWineId || !memberId || !ratingValue) return;

    try {
      setSaving(true);
      setError("");

      const existing = ratings[editingWineId];

      if (existing) {
        const { data, error: updateError } = await supabase
          .from("wine_ratings")
          .update({
            rating: ratingValue,
            notes: ratingNotes || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        if (data) {
          setRatings((prev) => ({
            ...prev,
            [editingWineId]: data as WineRating,
          }));
        }
      } else {
        const { data, error: insertError } = await supabase
          .from("wine_ratings")
          .insert([
            {
              member_id: memberId,
              wine_id: editingWineId,
              rating: ratingValue,
              notes: ratingNotes || null,
            },
          ])
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        if (data) {
          setRatings((prev) => ({
            ...prev,
            [editingWineId]: data as WineRating,
          }));
        }
      }

      handleCancelRating();
    } catch (err) {
      console.error("Failed to save wine rating:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6 lg:p-10">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6 lg:p-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (pastCases.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center lg:p-10">
        <Star className="mb-4 h-16 w-16 text-stone-300" />
        <h2 className="mb-2 text-2xl font-semibold text-stone-800">No Wines to Rate Yet</h2>
        <p className="max-w-md text-stone-500">
          Once you've received a wine case, you'll be able to rate each bottle here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8 p-6 lg:p-10">
      <div>
        <h1 className="text-2xl font-bold text-stone-800 lg:text-3xl">Rate Your Wines</h1>
        <p className="mt-1 text-sm text-stone-500">Share your tasting experiences</p>
      </div>

      {pastCases.map((wineCase) => {
        const items = caseItemsMap[wineCase.id] || [];

        return (
          <div key={wineCase.id} className="space-y-4">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-stone-800">{wineCase.quarter}</h2>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const wine = winesMap[item.wine_id];
                if (!wine) return null;

                const existingRating = ratings[wine.id];
                const isEditing = editingWineId === wine.id;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card>
                      <CardContent className="p-0">
                        <div className="flex items-start gap-0">
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-l-3xl bg-gradient-to-b from-stone-100 to-stone-50 sm:h-24 sm:w-24">
                            {wine.image_url ? (
                              <img
                                src={wine.image_url}
                                alt={wine.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Wine className="h-8 w-8 text-stone-300" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 p-4">
                            <p className="truncate text-sm font-semibold text-stone-800">
                              {wine.name}
                            </p>
                            <p className="text-xs text-stone-500">
                              {wine.winery}
                              {wine.vintage ? ` · ${wine.vintage}` : ""}
                            </p>

                            {wine.tasting_notes && (
                              <div className="mt-3 rounded-2xl bg-stone-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                                  Winery tasting notes
                                </p>
                                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-stone-600">
                                  {wine.tasting_notes}
                                </p>
                              </div>
                            )}

                            {!isEditing && existingRating && (
                              <div className="mt-2 flex items-center gap-3">
                                <StarRating rating={existingRating.rating} readOnly size="sm" />
                                <Button
                                  className="bg-transparent text-xs text-stone-500 hover:text-stone-800"
                                  onClick={() => handleStartRating(wine.id)}
                                >
                                  Edit
                                </Button>
                              </div>
                            )}

                            {!isEditing && !existingRating && (
                              <Button
                                className="mt-2 border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700 hover:bg-stone-50"
                                onClick={() => handleStartRating(wine.id)}
                              >
                                <Star className="mr-1 h-3 w-3" /> Rate this wine
                              </Button>
                            )}

                            {isEditing && (
                              <div className="mt-3 space-y-3">
                                <StarRating rating={ratingValue} onChange={setRatingValue} />
                                <Textarea
                                  placeholder="Your tasting notes (optional)..."
                                  value={ratingNotes}
                                  onChange={(e) => setRatingNotes(e.target.value)}
                                  className="h-20 text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    disabled={!ratingValue || saving}
                                    onClick={handleSaveRating}
                                    className="bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800"
                                  >
                                    <Check className="mr-1 h-3 w-3" /> Save
                                  </Button>
                                  <Button
                                    className="bg-transparent px-3 py-2 text-sm text-stone-600 hover:text-stone-900"
                                    onClick={handleCancelRating}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}