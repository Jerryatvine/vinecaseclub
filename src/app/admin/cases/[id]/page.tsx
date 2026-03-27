"use client";

import {
  addTemplateItem,
  deleteTemplateItem,
  getCaseTemplateById,
  getTemplateItems,
  publishTemplateToAllMembers,
  updateCaseTemplate,
  updateTemplateItem,
} from "@/lib/services/case-template-service";
import { getClubWines } from "@/lib/services/wine-service";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Package, Trash2 } from "lucide-react";

type MembershipTier = "economy" | "premium";

type Template = {
  id: string;
  quarter: string;
  title: string;
  case_size: number;
  status: "draft" | "published";
  membership_tier: MembershipTier;
  finalize_deadline?: string | null;
};

type TemplateItem = {
  id: string;
  template_id: string;
  wine_id: string;
  quantity: number;
};

type Wine = {
  id: string;
  name: string;
  winery?: string | null;
  club_price?: number | null;
  inventory?: number | null;
};

export default function AdminCaseBuilder() {
  const params = useParams();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [newItem, setNewItem] = useState({
    wine_id: "",
    quantity: "1",
  });

  useEffect(() => {
    if (!templateId) return;
    loadData();
  }, [templateId]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [templateData, templateItems, allWines] = await Promise.all([
        getCaseTemplateById(templateId),
        getTemplateItems(templateId),
        getClubWines(),
      ]);

      setTemplate(templateData);
      setItems(templateItems);
      setWines(allWines);
    } catch (err) {
      console.error(err);
      setError("Could not load case builder.");
    } finally {
      setLoading(false);
    }
  }

  const totalBottles = useMemo(
    () => items.reduce((sum, item) => sum + (item.quantity || 0), 0),
    [items]
  );

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const wine = wines.find((w) => w.id === item.wine_id);
      return sum + Number(wine?.club_price ?? 0) * item.quantity;
    }, 0);
  }, [items, wines]);

  const inventoryProblems = useMemo(() => {
    return items
      .map((item) => {
        const wine = wines.find((w) => w.id === item.wine_id);
        const inventory = Number(wine?.inventory ?? 0);
        const quantity = Number(item.quantity ?? 0);

        return {
          itemId: item.id,
          wineId: item.wine_id,
          wineName: wine?.name ?? "Unknown wine",
          quantity,
          inventory,
          exceeds: quantity > inventory,
        };
      })
      .filter((entry) => entry.exceeds);
  }, [items, wines]);

  const hasInventoryProblem = inventoryProblems.length > 0;

  async function handleAddWine(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.wine_id) return;

    const selectedWine = wines.find((w) => w.id === newItem.wine_id);
    const requestedQty = Number(newItem.quantity) || 1;
    const availableInventory = Number(selectedWine?.inventory ?? 0);

    if (requestedQty > availableInventory) {
      setError(
        `Cannot add ${requestedQty} bottle(s). Only ${availableInventory} in stock for ${selectedWine?.name ?? "that wine"}.`
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      await addTemplateItem({
        template_id: templateId,
        wine_id: newItem.wine_id,
        quantity: requestedQty,
      });

      setNewItem({
        wine_id: "",
        quantity: "1",
      });

      await loadData();
    } catch (err) {
      console.error(err);
      setError("Could not add wine.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    try {
      setSaving(true);
      setError("");
      await deleteTemplateItem(itemId);
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Could not remove wine.");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuantityChange(itemId: string, quantity: number) {
    if (quantity < 1) return;

    try {
      setSaving(true);
      setError("");
      await updateTemplateItem(itemId, { quantity });
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Could not update quantity.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTierChange(tier: MembershipTier) {
    if (!template) return;

    try {
      setSaving(true);
      setError("");

      const updated = await updateCaseTemplate(template.id, {
        membership_tier: tier,
      });

      setTemplate(updated);
    } catch (err) {
      console.error(err);
      setError("Could not update membership tier.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!template) return;

    if (hasInventoryProblem) {
      setError("Cannot publish while one or more wines exceed available inventory.");
      return;
    }

    const confirmed = confirm(
      `Publish this ${template.membership_tier} case to all matching members?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");

      await publishTemplateToAllMembers(template.id);
      await loadData();

      alert("Case published successfully.");
    } catch (err) {
      console.error(err);
      setError("Could not publish case.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f2ef]">
        <div className="mx-auto max-w-7xl p-6 lg:p-10">
          <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
            <p className="text-stone-500">Loading case builder...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !template) {
    return (
      <main className="min-h-screen bg-[#f4f2ef]">
        <div className="mx-auto max-w-7xl p-6 lg:p-10">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 shadow-sm">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!template) {
    return (
      <main className="min-h-screen bg-[#f4f2ef]">
        <div className="mx-auto max-w-7xl p-6 lg:p-10">
          <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
            <p className="text-stone-500">Template not found.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-stone-800">{template.title}</h1>
              <p className="mt-2 text-stone-500">{template.quarter}</p>
              <p className="mt-2 text-stone-500">
                {totalBottles} / {template.case_size} bottles
              </p>
              <p className="mt-1 text-stone-500">
                Total value: ${subtotal.toFixed(2)}
              </p>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-stone-700">
                  Membership Tier
                </label>
                <select
                  value={template.membership_tier}
                  disabled={saving || template.status === "published"}
                  onChange={(e) =>
                    handleTierChange(e.target.value as MembershipTier)
                  }
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-sm outline-none disabled:opacity-50"
                >
                  <option value="economy">Economy</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
            </div>

            <button
              onClick={handlePublish}
              disabled={saving || template.status === "published" || hasInventoryProblem}
              className="rounded-2xl bg-emerald-700 px-6 py-4 text-lg font-medium text-white disabled:opacity-50"
            >
              {template.status === "published"
                ? `Published to ${template.membership_tier} Members`
                : `Publish to All ${
                    template.membership_tier === "premium" ? "Premium" : "Economy"
                  } Members`}
            </button>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {hasInventoryProblem && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Inventory warning</p>
                  <ul className="mt-2 space-y-1">
                    {inventoryProblems.map((problem) => (
                      <li key={problem.itemId}>
                        {problem.wineName}: template uses {problem.quantity}, but only{" "}
                        {problem.inventory} in stock.
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <form
            onSubmit={handleAddWine}
            className="mt-10 grid gap-4 md:grid-cols-[1fr_180px_auto]"
          >
            <select
              value={newItem.wine_id}
              onChange={(e) =>
                setNewItem({ ...newItem, wine_id: e.target.value })
              }
              className="rounded-2xl border border-stone-300 bg-white px-4 py-4 text-lg outline-none"
              required
            >
              <option value="">Select wine</option>
              {wines.map((wine) => (
                <option key={wine.id} value={wine.id}>
                  {wine.name} {wine.winery ? `(${wine.winery})` : ""} — Stock:{" "}
                  {Number(wine.inventory ?? 0)}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              value={newItem.quantity}
              onChange={(e) =>
                setNewItem({ ...newItem, quantity: e.target.value })
              }
              className="rounded-2xl border border-stone-300 px-4 py-4 text-lg outline-none"
              required
            />

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-[#263330] px-6 py-4 text-lg font-medium text-white disabled:opacity-50"
            >
              Add Wine
            </button>
          </form>

          <div className="mt-10 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="px-6 py-4 text-sm font-medium">Wine</th>
                  <th className="px-6 py-4 text-sm font-medium">Quantity</th>
                  <th className="px-6 py-4 text-sm font-medium">Inventory</th>
                  <th className="px-6 py-4 text-sm font-medium">Club Price</th>
                  <th className="px-6 py-4 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-stone-500"
                    >
                      No wines added yet.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const wine = wines.find((w) => w.id === item.wine_id);
                    const inventory = Number(wine?.inventory ?? 0);
                    const exceedsInventory = item.quantity > inventory;

                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-stone-100 ${
                          exceedsInventory ? "bg-red-50" : ""
                        }`}
                      >
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">
                              <Package className="h-7 w-7" />
                            </div>
                            <div>
                              <p className="text-lg font-medium text-stone-800">
                                {wine?.name || "Unknown wine"}
                              </p>
                              <p className="text-stone-500">{wine?.winery || ""}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-6">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(
                                item.id,
                                Number(e.target.value) || 1
                              )
                            }
                            className={`w-40 rounded-2xl border px-4 py-3 text-lg outline-none ${
                              exceedsInventory
                                ? "border-red-300 bg-red-50"
                                : "border-stone-300"
                            }`}
                          />
                        </td>

                        <td className="px-6 py-6 text-lg text-stone-700">
                          <span className={exceedsInventory ? "font-semibold text-red-600" : ""}>
                            {inventory}
                          </span>
                        </td>

                        <td className="px-6 py-6 text-lg text-stone-700">
                          ${Number(wine?.club_price ?? 0).toFixed(2)}
                        </td>

                        <td className="px-6 py-6">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="rounded-2xl border border-stone-300 p-4 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}