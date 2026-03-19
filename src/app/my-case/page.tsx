"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Minus,
  Package,
  Plus,
  Trash2,
  Wine,
  X,
} from "lucide-react";
import {
  getUserCases,
  getCaseItems,
  updateCaseItem,
  deleteCaseItem,
  createCaseItem,
  updateCase,
} from "@/lib/services/case-service";
import { getAllWines } from "@/lib/services/wine-service";
import { createClient } from "@/lib/supabase/client";

type WineCase = {
  id: string;
  title?: string | null;
  quarter: string;
  status: "draft" | "customizing" | "finalized" | "ready_for_pickup" | "picked_up";
  tier?: "economy" | "premium" | null;
  case_size?: number | null;
  target_price_cap?: number | null;
  finalize_deadline?: string | null;
  pickup_date?: string | null;
  member_email?: string | null;
  template_case_id?: string | null;
};

type WineRecord = {
  id: string;
  name: string;
  winery?: string | null;
  vintage?: number | null;
  image_url?: string | null;
  inventory?: number | null;
  msrp?: number | null;
  store_price?: number | null;
  club_price?: number | null;
  available_for_club?: boolean | null;
  type?: string | null;
  region?: string | null;
};

type CaseItem = {
  id: string;
  case_id: string;
  wine_id: string;
  quantity: number;
  is_original_selection?: boolean;
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

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-stone-200 ${className}`} />;
}

function CaseStatusBadge({ status }: { status: WineCase["status"] }) {
  const styles: Record<WineCase["status"], string> = {
    draft: "bg-stone-100 text-stone-700",
    customizing: "bg-amber-100 text-amber-800",
    finalized: "bg-blue-100 text-blue-800",
    ready_for_pickup: "bg-green-100 text-green-800",
    picked_up: "bg-stone-200 text-stone-800",
  };

  const labels: Record<WineCase["status"], string> = {
    draft: "Draft",
    customizing: "Customizing",
    finalized: "Finalized",
    ready_for_pickup: "Ready for Pickup",
    picked_up: "Picked Up",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function CasePricingSummary({
  wines,
  caseItems,
}: {
  wines: WineRecord[];
  caseItems: CaseItem[];
}) {
  const bottleCount = caseItems.reduce(
    (sum, item) => sum + (item.quantity || 1),
    0
  );

  const totals = caseItems.reduce(
    (acc, item) => {
      const wine = wines.find((w) => w.id === item.wine_id);
      const qty = item.quantity || 1;

      acc.msrp += Number(wine?.msrp || 0) * qty;
      acc.store += Number(wine?.store_price || 0) * qty;
      acc.club += Number(wine?.club_price || 0) * qty;

      return acc;
    },
    { msrp: 0, store: 0, club: 0 }
  );

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-lg font-semibold text-stone-800">
          Case Value Summary
        </h3>

        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Bottles</span>
            <span className="font-medium text-stone-800">{bottleCount}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-stone-500">MSRP Price</span>
            <span className="font-medium text-stone-400 line-through">
              ${totals.msrp.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-stone-500">Store Price</span>
            <span className="font-medium text-stone-400 line-through">
              ${totals.store.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between border-t border-stone-200 pt-3">
            <span className="font-medium text-stone-700">Case Club Price</span>
            <span className="text-lg font-bold text-emerald-700">
              ${totals.club.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WineDetailModal({
  wine,
  open,
  onClose,
}: {
  wine: WineRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !wine) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold text-stone-800">{wine.name}</h3>
            <p className="text-stone-500">
              {wine.winery}
              {wine.vintage ? ` · ${wine.vintage}` : ""}
            </p>
          </div>
          <Button
            onClick={onClose}
            className="h-10 w-10 bg-stone-100 text-stone-700 hover:bg-stone-200"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-stone-100">
          {wine.image_url ? (
            <img
              src={wine.image_url}
              alt={wine.name}
              className="h-72 w-full object-cover"
            />
          ) : (
            <div className="flex h-72 items-center justify-center text-stone-400">
              <Package className="h-10 w-10" />
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2 text-sm">
          {wine.type ? (
            <p className="text-stone-600">
              Type: <span className="font-semibold text-stone-800">{wine.type}</span>
            </p>
          ) : null}
          {wine.region ? (
            <p className="text-stone-600">
              Region:{" "}
              <span className="font-semibold text-stone-800">{wine.region}</span>
            </p>
          ) : null}
          <p className="text-stone-600">
            Club price:{" "}
            <span className="font-semibold text-stone-800">
              ${Number(wine.club_price ?? 0).toFixed(2)}
            </span>
          </p>
          <p className="text-stone-600">
            Store price:{" "}
            <span className="font-semibold text-stone-800">
              ${Number(wine.store_price ?? 0).toFixed(2)}
            </span>
          </p>
          <p className="text-stone-600">
            Inventory:{" "}
            <span className="font-semibold text-stone-800">{wine.inventory ?? 0}</span>
          </p>
        </div>
      </div>
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

export default function MyCasePage() {
  const supabase = useMemo(() => createClient(), []);

  const [cases, setCases] = useState<WineCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);
  const [wines, setWines] = useState<WineRecord[]>([]);
  const [allWines, setAllWines] = useState<WineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWine, setSelectedWine] = useState<WineRecord | null>(null);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [addingWineId, setAddingWineId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");
        setSuccess("");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const email = session?.user?.email;
        if (!email) {
          setCases([]);
          setCaseItems([]);
          setWines([]);
          setAllWines([]);
          setLoading(false);
          return;
        }

        const [userCases, wineData] = await Promise.all([
          getUserCases(email),
          getAllWines(),
        ]);

        setCases(userCases);
        setAllWines(wineData);

        if (userCases.length > 0) {
          const active =
            userCases.find((c) =>
              ["customizing", "draft", "finalized", "ready_for_pickup"].includes(c.status)
            ) ?? userCases[0];

          setSelectedCaseId(active.id);
        } else {
          setSelectedCaseId(null);
          setCaseItems([]);
          setWines([]);
        }
      } catch (err) {
        console.error(err);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [supabase]);

  useEffect(() => {
    async function loadItems() {
      if (!selectedCaseId) return;

      try {
        const items = await getCaseItems(selectedCaseId);
        setCaseItems(items);
      } catch (err) {
        console.error(err);
        setError(getErrorMessage(err));
      }
    }

    loadItems();
  }, [selectedCaseId]);

  const currentCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId),
    [cases, selectedCaseId]
  );

  useEffect(() => {
    const wineIds = [...new Set(caseItems.map((i) => i.wine_id))];
    setWines(allWines.filter((w) => wineIds.includes(w.id)));
  }, [caseItems, allWines]);

  const canCustomize = currentCase?.status === "customizing";
  const minimumBottleCount = currentCase?.case_size || 12;
  const totalBottles = caseItems.reduce((sum, ci) => sum + (ci.quantity || 1), 0);
  const belowMinimum = totalBottles < minimumBottleCount;

  const currentCaseClubTotal = useMemo(() => {
    return caseItems.reduce((sum, item) => {
      const wine = allWines.find((w) => w.id === item.wine_id);
      return sum + Number(wine?.club_price ?? 0) * Number(item.quantity || 1);
    }, 0);
  }, [caseItems, allWines]);

  const currentCaseTargetCap =
    currentCase?.target_price_cap != null
      ? Number(currentCase.target_price_cap)
      : currentCase?.tier === "economy"
      ? 200
      : null;

  const isEconomyCase = currentCase?.tier === "economy";

  const caseWineIds = useMemo(
    () => new Set(caseItems.map((item) => item.wine_id)),
    [caseItems]
  );

  const availableWines = useMemo(() => {
    return allWines.filter((wine) => {
      const inventory = Number(wine.inventory ?? 0);

      return (
        wine.available_for_club !== false &&
        inventory > 0 &&
        !caseWineIds.has(wine.id)
      );
    });
  }, [allWines, caseWineIds]);

  async function reloadCurrentCaseItems() {
    if (!selectedCaseId) return;
    const items = await getCaseItems(selectedCaseId);
    setCaseItems(items);
  }

  async function handleRemoveWine(item: CaseItem) {
    try {
      setUpdatingItem(item.id);
      setError("");
      setSuccess("");
      await deleteCaseItem(item.id);
      await reloadCurrentCaseItems();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setUpdatingItem(null);
    }
  }

  async function handleChangeQuantity(item: CaseItem, delta: number) {
    const currentQty = item.quantity || 1;
    const newQty = currentQty + delta;

    try {
      setUpdatingItem(item.id);
      setError("");
      setSuccess("");

      if (newQty <= 0) {
        await deleteCaseItem(item.id);
      } else {
        await updateCaseItem(item.id, { quantity: newQty });
      }

      await reloadCurrentCaseItems();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setUpdatingItem(null);
    }
  }

  async function handleAddWine(wine: WineRecord) {
    if (!selectedCaseId) return;

    try {
      setAddingWineId(wine.id);
      setError("");
      setSuccess("");

      await createCaseItem({
        case_id: selectedCaseId,
        wine_id: wine.id,
        quantity: 1,
      });

      await reloadCurrentCaseItems();
      setSuccess(`Added ${wine.name} to your case.`);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setAddingWineId(null);
    }
  }

  async function handleFinalizeCase() {
    if (!currentCase) return;

    if (belowMinimum) {
      setError(
        `Your case must have at least ${minimumBottleCount} bottles before finalizing.`
      );
      return;
    }

    try {
      setFinalizing(true);
      setError("");
      setSuccess("");

      const updated = await updateCase(currentCase.id, {
        status: "finalized",
      });

      setCases((prev) =>
        prev.map((c) => (c.id === currentCase.id ? { ...c, ...updated } : c))
      );

      setSuccess("Your case has been finalized.");
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-10">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error && cases.length === 0) {
    return (
      <main className="min-h-screen bg-[#f4f2ef]">
        <div className="mx-auto max-w-6xl p-6 lg:p-10">
          <p className="text-red-600">{error}</p>
        </div>
      </main>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center lg:p-10">
        <Package className="mb-4 h-16 w-16 text-stone-300" />
        <h2 className="mb-2 text-2xl font-semibold text-stone-800">No Cases Yet</h2>
        <p className="max-w-md text-stone-500">
          Your quarterly wine case will appear here once it&apos;s been published to your
          account.
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-stone-800 lg:text-3xl">My Wine Case</h1>
            <p className="mt-1 text-sm text-stone-500">
              Manage and customize your quarterly selection
            </p>
          </div>

          <select
            value={selectedCaseId || ""}
            onChange={(e) => {
              setSelectedCaseId(e.target.value);
              setSuccess("");
              setError("");
            }}
            className="w-56 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 outline-none"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.quarter || c.title}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {currentCase && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <CaseStatusBadge status={currentCase.status} />

              <span className="text-sm text-stone-500">
                {totalBottles} bottles selected
              </span>

              <span className="text-sm text-stone-500">
                Minimum to finalize: {minimumBottleCount}
              </span>

              {canCustomize && belowMinimum && (
                <span className="flex items-center gap-1 text-sm font-medium text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Add {minimumBottleCount - totalBottles} more bottle
                  {minimumBottleCount - totalBottles !== 1 ? "s" : ""}
                </span>
              )}

              {currentCase.finalize_deadline && currentCase.status === "customizing" && (
                <span className="flex items-center gap-1 text-sm text-emerald-700">
                  <AlertCircle className="h-4 w-4" />
                  Customize by{" "}
                  {new Date(currentCase.finalize_deadline).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>

            {isEconomyCase && currentCaseTargetCap != null && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Your starting case was curated to stay under $
                {currentCaseTargetCap.toFixed(2)}. You can still customize it above that
                amount if you want. Current club total: $
                {currentCaseClubTotal.toFixed(2)}.
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <AnimatePresence>
              {caseItems.map((item, index) => {
                const wine = wines.find((w) => w.id === item.wine_id);
                if (!wine) return null;

                const qty = item.quantity || 1;
                const isUpdating = updatingItem === item.id;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <Card className="transition-shadow hover:shadow-md">
                      <CardContent className="p-0">
                        <div className="flex items-center gap-0">
                          <div
                            className="w-16 shrink-0 cursor-pointer overflow-hidden rounded-l-3xl bg-gradient-to-b from-stone-100 to-stone-50"
                            style={{ height: "6rem" }}
                            onClick={() => setSelectedWine(wine)}
                          >
                            {wine.image_url ? (
                              <img
                                src={wine.image_url}
                                alt={wine.name}
                                className="h-full w-full object-cover object-center"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-stone-300">
                                <Wine className="h-6 w-6" />
                              </div>
                            )}
                          </div>

                          <div
                            className="min-w-0 flex-1 cursor-pointer px-4 py-3"
                            onClick={() => setSelectedWine(wine)}
                          >
                            <p className="truncate text-sm font-semibold text-stone-800">
                              {wine.name}
                            </p>
                            <p className="text-xs text-stone-500">
                              {wine.winery}
                              {wine.vintage ? ` · ${wine.vintage}` : ""}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              {wine.msrp != null && (
                                <span className="text-xs text-stone-400 line-through">
                                  ${Number(wine.msrp).toFixed(2)}
                                </span>
                              )}
                              <span className="text-xs text-stone-500">
                                ${Number(wine.store_price ?? 0).toFixed(2)}
                              </span>
                              <span className="text-sm font-bold text-emerald-700">
                                ${Number(wine.club_price ?? 0).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2 pr-4">
                            {canCustomize ? (
                              <>
                                <div className="flex items-center gap-1 rounded-xl bg-stone-100 px-1 py-1">
                                  <Button
                                    className="h-7 w-7 bg-transparent text-stone-500 hover:bg-stone-200 hover:text-red-600"
                                    disabled={isUpdating}
                                    onClick={() => handleChangeQuantity(item, -1)}
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </Button>

                                  <span className="min-w-[1.5rem] text-center text-sm font-semibold text-stone-800">
                                    {qty}
                                  </span>

                                  <Button
                                    className="h-7 w-7 bg-transparent text-stone-500 hover:bg-stone-200 hover:text-emerald-700"
                                    disabled={isUpdating}
                                    onClick={() => handleChangeQuantity(item, 1)}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>

                                <Button
                                  className="h-9 w-9 bg-transparent text-stone-500 hover:bg-stone-100 hover:text-red-600"
                                  disabled={isUpdating}
                                  onClick={() => handleRemoveWine(item)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-sm font-semibold text-stone-500">×{qty}</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {caseItems.length === 0 && !canCustomize && (
              <div className="py-12 text-center text-stone-500">
                <Package className="mx-auto mb-2 h-10 w-10 opacity-30" />
                <p className="text-sm">No bottles in this case yet.</p>
              </div>
            )}

            {caseItems.length === 0 && canCustomize && (
              <div className="rounded-3xl border border-dashed border-stone-300 bg-white py-12 text-center text-stone-500">
                <Package className="mx-auto mb-2 h-10 w-10 opacity-30" />
                <p className="text-sm">Your case is empty. Add wines below.</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <CasePricingSummary wines={wines} caseItems={caseItems} />

            {canCustomize && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="text-lg font-semibold text-stone-800">Finalize Case</h3>
                  <p className="mt-2 text-sm text-stone-500">
                    Finalize once your case has at least {minimumBottleCount} bottles.
                  </p>

                  <Button
                    onClick={handleFinalizeCase}
                    disabled={finalizing || belowMinimum}
                    className="mt-4 w-full bg-[#263330] px-4 py-3 text-sm font-medium text-white hover:bg-[#1d2725]"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {finalizing ? "Finalizing..." : "Finalize My Case"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {currentCase?.status === "ready_for_pickup" && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4 text-center">
                  <Package className="mx-auto mb-2 h-8 w-8 text-green-600" />
                  <p className="text-sm font-semibold text-green-700">Ready for Pickup!</p>
                  {currentCase.pickup_date && (
                    <p className="mt-1 text-xs text-green-600">
                      Since{" "}
                      {new Date(currentCase.pickup_date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {canCustomize && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="text-lg font-semibold text-stone-800">Available Wines</h3>
                  <p className="mt-2 text-sm text-stone-500">
                    Add more wines to customize your case.
                  </p>

                  <div className="mt-4 space-y-3">
                    {availableWines.length === 0 ? (
                      <p className="text-sm text-stone-500">
                        No additional wines are currently available.
                      </p>
                    ) : (
                      availableWines.map((wine) => (
                        <div
                          key={wine.id}
                          className="rounded-2xl border border-stone-200 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-stone-800">
                                {wine.name}
                              </p>
                              <p className="text-xs text-stone-500">
                                {wine.winery}
                                {wine.vintage ? ` · ${wine.vintage}` : ""}
                              </p>
                              <p className="mt-1 text-xs text-emerald-700">
                                ${Number(wine.club_price ?? 0).toFixed(2)}
                              </p>
                            </div>

                            <Button
                              onClick={() => handleAddWine(wine)}
                              disabled={addingWineId === wine.id}
                              className="bg-stone-900 px-3 py-2 text-xs text-white hover:bg-black"
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              {addingWineId === wine.id ? "Adding..." : "Add"}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <WineDetailModal
          wine={selectedWine}
          open={!!selectedWine}
          onClose={() => setSelectedWine(null)}
        />
      </div>
    </main>
  );
}