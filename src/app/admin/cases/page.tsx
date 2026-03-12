"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Save,
  Wine as WineIcon,
  Send,
  Lock,
  CheckCircle2,
  ShoppingBag,
} from "lucide-react";
import {
  createCase,
  deleteCase,
  getAllCases,
  getCaseItems,
  replaceCaseItems,
  updateCase,
  type CaseRecord,
  type CaseStatus,
  type CaseTier,
} from "@/lib/services/case-service";
import { getAllWines } from "@/lib/services/wine-service";

type WineItem = {
  id: string;
  name: string;
  winery?: string | null;
  vintage?: number | null;
  type?: string | null;
  region?: string | null;
  image_url?: string | null;
  available_for_club?: boolean | null;
  club_price?: number | null;
};

type CaseFormState = {
  quarter: string;
  status: CaseStatus;
  tier: CaseTier;
  case_size: number;
  target_price_cap: number | null;
  member_email: string;
  finalize_deadline: string;
};

const emptyForm: CaseFormState = {
  quarter: "",
  status: "draft",
  tier: "premium",
  case_size: 12,
  target_price_cap: null,
  member_email: "",
  finalize_deadline: "",
};

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

function StatusBadge({ status }: { status: CaseStatus }) {
  const styles: Record<CaseStatus, string> = {
    draft: "bg-stone-100 text-stone-700",
    customizing: "bg-amber-100 text-amber-800",
    finalized: "bg-blue-100 text-blue-800",
    ready_for_pickup: "bg-green-100 text-green-800",
    picked_up: "bg-stone-200 text-stone-800",
  };

  const labels: Record<CaseStatus, string> = {
    draft: "Draft",
    customizing: "Customizing",
    finalized: "Finalized",
    ready_for_pickup: "Ready for Pickup",
    picked_up: "Picked Up",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function TierBadge({ tier }: { tier?: CaseTier | null }) {
  const safeTier = tier === "economy" ? "economy" : "premium";

  const styles: Record<CaseTier, string> = {
    economy: "bg-amber-100 text-amber-800",
    premium: "bg-purple-100 text-purple-800",
  };

  const labels: Record<CaseTier, string> = {
    economy: "Economy",
    premium: "Premium",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[safeTier]}`}
    >
      {labels[safeTier]}
    </span>
  );
}

export default function AdminCasesPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [wines, setWines] = useState<WineItem[]>([]);
  const [form, setForm] = useState<CaseFormState>(emptyForm);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingCase, setSavingCase] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<CaseStatus | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const [caseData, wineData] = await Promise.all([
        getAllCases(),
        getAllWines(),
      ]);

      setCases(caseData);
      setWines(wineData);

      if (!selectedCaseId && caseData.length > 0) {
        const firstCaseId = caseData[0].id;
        setSelectedCaseId(firstCaseId);
        await loadCaseItems(firstCaseId);
      } else if (selectedCaseId) {
        await loadCaseItems(selectedCaseId);
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Could not load case builder."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadCaseItems(caseId: string) {
    try {
      const items = await getCaseItems(caseId);
      const map: Record<string, string> = {};

      items.forEach((item) => {
        map[item.wine_id] = String(item.quantity);
      });

      setQuantities(map);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Could not load case items."
      );
    }
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingCaseId(null);
  }

  function handleEditCase(caseRecord: CaseRecord) {
    setEditingCaseId(caseRecord.id);
    setSelectedCaseId(caseRecord.id);
    setForm({
      quarter: caseRecord.quarter ?? caseRecord.title ?? "",
      status: caseRecord.status,
      tier: caseRecord.tier ?? "premium",
      case_size: caseRecord.case_size ?? 12,
      target_price_cap:
        caseRecord.target_price_cap != null
          ? Number(caseRecord.target_price_cap)
          : caseRecord.tier === "economy"
          ? 200
          : null,
      member_email: caseRecord.member_email ?? "",
      finalize_deadline: caseRecord.finalize_deadline
        ? caseRecord.finalize_deadline.slice(0, 10)
        : "",
    });

    loadCaseItems(caseRecord.id);
  }

  async function handleDeleteCase(caseId: string) {
    const caseRecord = cases.find((c) => c.id === caseId);
    const confirmed = window.confirm(
      `Are you sure you want to delete "${
        caseRecord?.quarter ?? caseRecord?.title ?? "this case"
      }"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");
      await deleteCase(caseId);

      const remainingCases = cases.filter((c) => c.id !== caseId);
      setCases(remainingCases);

      if (editingCaseId === caseId) {
        resetForm();
      }

      if (selectedCaseId === caseId) {
        const nextCaseId = remainingCases[0]?.id ?? null;
        setSelectedCaseId(nextCaseId);
        if (nextCaseId) {
          await loadCaseItems(nextCaseId);
        } else {
          setQuantities({});
        }
      }

      setSuccess("Case deleted.");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not delete case.");
    }
  }

  async function handleSaveCase(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSavingCase(true);
      setError("");
      setSuccess("");

      const cleanQuarter = form.quarter.trim();
      const normalizedTier: CaseTier = form.tier === "economy" ? "economy" : "premium";
      const normalizedCaseSize = Number(form.case_size) || 12;
      const normalizedTargetCap =
        normalizedTier === "economy"
          ? Number(form.target_price_cap ?? 200)
          : null;

      const payload = {
        title: cleanQuarter,
        quarter: cleanQuarter,
        status: form.status,
        tier: normalizedTier,
        case_size: normalizedCaseSize,
        target_price_cap: normalizedTargetCap,
        member_email: form.member_email.trim() || null,
        finalize_deadline: form.finalize_deadline || null,
      };

      if (!payload.title) {
        setError("Quarter label is required.");
        return;
      }

      if (editingCaseId) {
        const updated = await updateCase(editingCaseId, payload);
        setCases((prev) =>
          prev.map((c) => (c.id === editingCaseId ? updated : c))
        );
        setSuccess("Case updated.");
      } else {
        const created = await createCase(payload);
        setCases((prev) => [created, ...prev]);
        setSelectedCaseId(created.id);
        setEditingCaseId(created.id);
        setSuccess("Case created.");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not save case.");
    } finally {
      setSavingCase(false);
    }
  }

  async function handleSaveItems() {
    if (!selectedCaseId) return;

    try {
      setSavingItems(true);
      setError("");
      setSuccess("");

      const payload = wines.map((wine) => ({
        wine_id: wine.id,
        quantity: Number(quantities[wine.id] || 0),
      }));

      await replaceCaseItems(selectedCaseId, payload);
      await loadCaseItems(selectedCaseId);

      setSuccess("Case contents saved.");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Could not save case items."
      );
    } finally {
      setSavingItems(false);
    }
  }

  async function handleStatusChange(nextStatus: CaseStatus) {
    if (!selectedCaseId || !selectedCase) return;

    const labelMap: Record<CaseStatus, string> = {
      draft: "Draft",
      customizing: "Customizing",
      finalized: "Finalized",
      ready_for_pickup: "Ready for Pickup",
      picked_up: "Picked Up",
    };

    try {
      setStatusUpdating(nextStatus);
      setError("");
      setSuccess("");

      const updated = await updateCase(selectedCaseId, {
        status: nextStatus,
      });

      setCases((prev) =>
        prev.map((c) => (c.id === selectedCaseId ? updated : c))
      );

      if (editingCaseId === selectedCaseId) {
        setForm((prev) => ({
          ...prev,
          status: nextStatus,
        }));
      }

      setSuccess(`Case status updated to ${labelMap[nextStatus]}.`);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Could not update case status."
      );
    } finally {
      setStatusUpdating(null);
    }
  }

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) ?? null,
    [cases, selectedCaseId]
  );

  const clubWines = useMemo(
    () => wines.filter((wine) => wine.available_for_club !== false),
    [wines]
  );

  const selectedBottleCount = useMemo(() => {
    return Object.values(quantities).reduce((sum, value) => {
      return sum + Number(value || 0);
    }, 0);
  }, [quantities]);

  const selectedCaseTotalClubPrice = useMemo(() => {
    return clubWines.reduce((sum, wine) => {
      const qty = Number(quantities[wine.id] || 0);
      return sum + Number(wine.club_price || 0) * qty;
    }, 0);
  }, [clubWines, quantities]);

  const selectedCaseTargetCap =
    selectedCase?.target_price_cap != null
      ? Number(selectedCase.target_price_cap)
      : selectedCase?.tier === "economy"
      ? 200
      : null;

  const isEconomySelectedCase = selectedCase?.tier === "economy";
  const overEconomyTarget =
    isEconomySelectedCase &&
    selectedCaseTargetCap != null &&
    selectedCaseTotalClubPrice > selectedCaseTargetCap;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f2ef]">
        <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
          <div className="h-10 w-48 animate-pulse rounded-2xl bg-stone-200" />
          <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
            <div className="h-[520px] animate-pulse rounded-3xl bg-stone-200" />
            <div className="h-[520px] animate-pulse rounded-3xl bg-stone-200" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
        <div>
          <h1 className="text-3xl font-bold text-stone-800">Manage Cases</h1>
          <p className="mt-2 text-sm text-stone-500">
            Create cases, assign wines, and control case workflow.
          </p>
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

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <div className="space-y-8">
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-stone-800">
                  {editingCaseId ? "Edit Case" : "Create Case"}
                </h2>

                {editingCaseId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm text-stone-500 hover:text-stone-800"
                  >
                    New Case
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveCase} className="mt-4 space-y-4">
                <input
                  className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                  placeholder="Quarter label (ex: Fall 2025)"
                  value={form.quarter}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, quarter: e.target.value }))
                  }
                  required
                />

                <select
                  className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                  value={form.tier}
                  onChange={(e) => {
                    const nextTier = e.target.value as CaseTier;

                    setForm((prev) => ({
                      ...prev,
                      tier: nextTier,
                      case_size: 12,
                      target_price_cap: nextTier === "economy" ? 200 : null,
                    }));
                  }}
                >
                  <option value="premium">Premium</option>
                  <option value="economy">Economy</option>
                </select>

                <select
                  className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as CaseStatus,
                    }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="customizing">Customizing</option>
                  <option value="finalized">Finalized</option>
                  <option value="ready_for_pickup">Ready for Pickup</option>
                  <option value="picked_up">Picked Up</option>
                </select>

                <input
                  type="number"
                  min="1"
                  className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                  placeholder="Case size"
                  value={form.case_size}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      case_size: Number(e.target.value) || 12,
                    }))
                  }
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                  placeholder="Target price cap"
                  value={form.target_price_cap ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      target_price_cap:
                        e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  disabled={form.tier !== "economy"}
                />

                <input
                  className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                  placeholder="Member email (optional for individual case)"
                  value={form.member_email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, member_email: e.target.value }))
                  }
                />

                <input
                  type="date"
                  className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                  value={form.finalize_deadline}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      finalize_deadline: e.target.value,
                    }))
                  }
                />

                <button
                  type="submit"
                  disabled={savingCase}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#263330] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {editingCaseId ? "Update Case" : "Create Case"}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-stone-800">Existing Cases</h2>

              {cases.length === 0 ? (
                <p className="mt-4 text-sm text-stone-500">No cases created yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {cases.map((caseRecord) => {
                    const isSelected = selectedCaseId === caseRecord.id;

                    return (
                      <div
                        key={caseRecord.id}
                        className={`rounded-2xl border p-4 ${
                          isSelected
                            ? "border-stone-800 bg-stone-50"
                            : "border-stone-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-stone-800">
                              {caseRecord.quarter || caseRecord.title || "Untitled Case"}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <StatusBadge status={caseRecord.status} />
                              <TierBadge tier={caseRecord.tier} />
                            </div>

                            {caseRecord.member_email && (
                              <p className="mt-2 text-xs text-stone-500">
                                {caseRecord.member_email}
                              </p>
                            )}

                            <p className="mt-2 text-xs text-stone-500">
                              {caseRecord.case_size ?? 12} bottles
                              {caseRecord.tier === "economy" &&
                              caseRecord.target_price_cap != null
                                ? ` • $${Number(caseRecord.target_price_cap).toFixed(2)} target`
                                : ""}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCaseId(caseRecord.id);
                                loadCaseItems(caseRecord.id);
                              }}
                              className="rounded-xl border border-stone-300 p-2 text-stone-700 hover:bg-stone-50"
                              title="Manage case contents"
                            >
                              <Package className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEditCase(caseRecord)}
                              className="rounded-xl border border-stone-300 p-2 text-stone-700 hover:bg-stone-50"
                              title="Edit case"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCase(caseRecord.id)}
                              className="rounded-xl border border-stone-300 p-2 text-red-600 hover:bg-red-50"
                              title="Delete case"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-stone-800">
                    {selectedCase
                      ? `Case Contents: ${selectedCase.quarter || selectedCase.title}`
                      : "Case Contents"}
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    Choose which wines belong in this case and how many bottles of each.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveItems}
                  disabled={!selectedCaseId || savingItems}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#263330] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Save Contents
                </button>
              </div>

              {selectedCase && (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <StatusBadge status={selectedCase.status} />
                    <TierBadge tier={selectedCase.tier} />
                    <span className="text-sm text-stone-500">
                      {selectedBottleCount} / {selectedCase.case_size ?? 12} bottles selected
                    </span>
                    <span className="text-sm font-medium text-stone-700">
                      Club total: ${selectedCaseTotalClubPrice.toFixed(2)}
                    </span>
                    {selectedCase.finalize_deadline && (
                      <span className="text-sm text-stone-500">
                        Deadline:{" "}
                        {new Date(selectedCase.finalize_deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {isEconomySelectedCase && selectedCaseTargetCap != null && (
                    <div
                      className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                        overEconomyTarget
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      Economy starter-case target: keep this build at or under $
                      {selectedCaseTargetCap.toFixed(2)}.
                      {overEconomyTarget
                        ? " This is over the target, but saving is still allowed."
                        : " This build is within target."}
                    </div>
                  )}
                </>
              )}

              {!selectedCaseId ? (
                <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-stone-50 text-center">
                  <div>
                    <Package className="mx-auto mb-3 h-10 w-10 text-stone-300" />
                    <p className="text-stone-500">
                      Select or create a case to start assigning wines.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500">
                        <th className="px-3 py-3 font-medium">Wine</th>
                        <th className="px-3 py-3 font-medium">Type</th>
                        <th className="px-3 py-3 font-medium">Region</th>
                        <th className="px-3 py-3 font-medium">Club Price</th>
                        <th className="px-3 py-3 font-medium">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clubWines.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-8 text-center text-stone-500"
                          >
                            No club-available wines found.
                          </td>
                        </tr>
                      ) : (
                        clubWines.map((wine) => (
                          <tr key={wine.id} className="border-b border-stone-100">
                            <td className="px-3 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-stone-100 text-stone-600">
                                  {wine.image_url ? (
                                    <img
                                      src={wine.image_url}
                                      alt={wine.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <WineIcon className="h-5 w-5" />
                                  )}
                                </div>

                                <div>
                                  <p className="font-medium text-stone-800">{wine.name}</p>
                                  <p className="text-xs text-stone-500">
                                    {[wine.winery, wine.vintage]
                                      .filter(Boolean)
                                      .join(" • ") || "—"}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-3 py-4 text-stone-700">
                              {wine.type || "—"}
                            </td>

                            <td className="px-3 py-4 text-stone-700">
                              {wine.region || "—"}
                            </td>

                            <td className="px-3 py-4 text-stone-700">
                              ${Number(wine.club_price ?? 0).toFixed(2)}
                            </td>

                            <td className="px-3 py-4">
                              <input
                                type="number"
                                min="0"
                                value={quantities[wine.id] ?? "0"}
                                onChange={(e) =>
                                  setQuantities((prev) => ({
                                    ...prev,
                                    [wine.id]: e.target.value,
                                  }))
                                }
                                className="w-24 rounded-2xl border border-stone-300 px-3 py-2 text-sm outline-none"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedCase && (
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-stone-800">Case Workflow</h2>
                <p className="mt-2 text-sm text-stone-500">
                  Move this case through the club process.
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleStatusChange("customizing")}
                    disabled={statusUpdating !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {statusUpdating === "customizing" ? "Publishing..." : "Publish Case"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange("finalized")}
                    disabled={statusUpdating !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800 disabled:opacity-50"
                  >
                    <Lock className="h-4 w-4" />
                    {statusUpdating === "finalized" ? "Locking..." : "Lock Case"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange("ready_for_pickup")}
                    disabled={statusUpdating !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {statusUpdating === "ready_for_pickup"
                      ? "Updating..."
                      : "Mark Ready"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange("picked_up")}
                    disabled={statusUpdating !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm font-medium text-stone-800 disabled:opacity-50"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {statusUpdating === "picked_up"
                      ? "Updating..."
                      : "Mark Picked Up"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
