"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  ImagePlus,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Wine,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createWine,
  deleteWine,
  getAllWines,
  updateWine,
} from "@/lib/services/wine-service";

type WineItem = {
  id: string;
  name: string;
  winery?: string;
  vintage?: number | null;
  type?: string;
  varietal?: string;
  region?: string;
  image_url?: string;
  msrp?: number | null;
  store_price?: number | null;
  club_price?: number | null;
  inventory?: number | null;
  available_for_club?: boolean;
};

type WineFormState = {
  name: string;
  winery: string;
  vintage: string;
  type: string;
  varietal: string;
  region: string;
  image_url: string;
  msrp: string;
  store_price: string;
  club_price: string;
  inventory: string;
  available_for_club: boolean;
};

const emptyForm: WineFormState = {
  name: "",
  winery: "",
  vintage: "",
  type: "",
  varietal: "",
  region: "",
  image_url: "",
  msrp: "",
  store_price: "",
  club_price: "",
  inventory: "",
  available_for_club: true,
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

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

function isSupportedImageFile(file: File) {
  const lowerName = file.name.toLowerCase();

  const blockedExtensions = [".heic", ".heif"];
  const isBlockedExtension = blockedExtensions.some((ext) =>
    lowerName.endsWith(ext)
  );

  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  const hasAllowedExtension = allowedExtensions.some((ext) =>
    lowerName.endsWith(ext)
  );

  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  return !isBlockedExtension && (allowedMimeTypes.includes(file.type) || hasAllowedExtension);
}

function getImageContentType(file: File) {
  if (file.type && file.type.startsWith("image/")) {
    return file.type;
  }

  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerName.endsWith(".png")) {
    return "image/png";
  }

  if (lowerName.endsWith(".webp")) {
    return "image/webp";
  }

  if (lowerName.endsWith(".gif")) {
    return "image/gif";
  }

  return null;
}

function getFileExtension(file: File) {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "jpg";
  }

  if (lowerName.endsWith(".png")) {
    return "png";
  }

  if (lowerName.endsWith(".webp")) {
    return "webp";
  }

  if (lowerName.endsWith(".gif")) {
    return "gif";
  }

  return "jpg";
}

export default function AdminWinesPage() {
  const [wines, setWines] = useState<WineItem[]>([]);
  const [form, setForm] = useState<WineFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadWines();
  }, []);

  async function loadWines() {
    try {
      setLoading(true);
      setError("");
      const data = await getAllWines();
      setWines(data);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setImageError("");
    setDragActive(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleEdit(wine: WineItem) {
    setEditingId(wine.id);
    setImageError("");
    setForm({
      name: wine.name ?? "",
      winery: wine.winery ?? "",
      vintage: wine.vintage?.toString() ?? "",
      type: wine.type ?? "",
      varietal: wine.varietal ?? "",
      region: wine.region ?? "",
      image_url: wine.image_url ?? "",
      msrp: wine.msrp?.toString() ?? "",
      store_price: wine.store_price?.toString() ?? "",
      club_price: wine.club_price?.toString() ?? "",
      inventory: wine.inventory?.toString() ?? "",
      available_for_club: wine.available_for_club ?? true,
    });
  }

  async function handleDelete(id: string) {
    try {
      setError("");
      await deleteWine(id);
      await loadWines();

      if (editingId === id) {
        resetForm();
      }
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    }
  }

  async function handleInventoryAdjust(wine: WineItem, delta: number) {
    try {
      setError("");
      const currentInventory = Number(wine.inventory ?? 0);
      const nextInventory = Math.max(0, currentInventory + delta);

      await updateWine(wine.id, {
        inventory: nextInventory,
      });

      await loadWines();

      if (editingId === wine.id) {
        setForm((prev) => ({
          ...prev,
          inventory: String(nextInventory),
        }));
      }
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    }
  }

  async function uploadWineImage(file: File) {
    if (!isSupportedImageFile(file)) {
      setImageError(
        "Please upload a JPG, JPEG, PNG, WEBP, or GIF image. HEIC images are not supported."
      );
      return;
    }

    const contentType = getImageContentType(file);

    if (!contentType) {
      setImageError("Could not determine the image type. Please use JPG, PNG, WEBP, or GIF.");
      return;
    }

    try {
      setUploadingImage(true);
      setImageError("");
      setError("");

      const supabase = createClient();
      const fileExt = getFileExtension(file);
      const safeName =
        form.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "wine";

      const filePath = `wines/${safeName}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("wine-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("wine-images").getPublicUrl(filePath);

      if (!data?.publicUrl) {
        throw new Error("Could not generate image URL.");
      }

      setForm((prev) => ({
        ...prev,
        image_url: data.publicUrl,
      }));
    } catch (err) {
      console.error(err);
      setImageError(getErrorMessage(err));
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadWineImage(file);
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    await uploadWineImage(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function clearImage() {
    setForm((prev) => ({
      ...prev,
      image_url: "",
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      console.log("session?", session);
      console.log("user?", session?.user);

      const payload = {
        name: form.name,
        winery: form.winery || null,
        vintage: form.vintage ? Number(form.vintage) : null,
        type: form.type || null,
        varietal: form.varietal || null,
        region: form.region || null,
        image_url: form.image_url || null,
        msrp: form.msrp ? Number(form.msrp) : null,
        store_price: form.store_price ? Number(form.store_price) : null,
        club_price: form.club_price ? Number(form.club_price) : null,
        inventory: form.inventory ? Number(form.inventory) : 0,
        available_for_club: form.available_for_club,
      };

      if (editingId) {
        await updateWine(editingId, payload);
      } else {
        await createWine(payload);
      }

      resetForm();
      await loadWines();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
        <div>
          <h1 className="text-3xl font-bold text-stone-800">Manage Wines</h1>
          <p className="mt-2 text-sm text-stone-500">
            Add wines, edit pricing, adjust inventory, and upload wine images.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-800">
              {editingId ? "Edit Wine" : "Add Wine"}
            </h2>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <input
                className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                placeholder="Wine name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <input
                className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                placeholder="Winery"
                value={form.winery}
                onChange={(e) => setForm({ ...form, winery: e.target.value })}
              />

              <input
                type="number"
                className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                placeholder="Vintage"
                value={form.vintage}
                onChange={(e) => setForm({ ...form, vintage: e.target.value })}
              />

              <input
                className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                placeholder="Type (red, white, rosé...)"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              />

              <input
                className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                placeholder="Varietal"
                value={form.varietal}
                onChange={(e) => setForm({ ...form, varietal: e.target.value })}
              />

              <input
                className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                placeholder="Region"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />

              <div className="space-y-3">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`rounded-3xl border-2 border-dashed p-5 text-center transition ${
                    dragActive
                      ? "border-[#263330] bg-stone-50"
                      : "border-stone-300 bg-stone-50"
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-stone-600 shadow-sm">
                      <Upload className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-sm font-medium text-stone-800">
                        Drag and drop a wine image here
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        JPG, PNG, WEBP, or GIF
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="inline-flex items-center gap-2 rounded-2xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                    >
                      <ImagePlus className="h-4 w-4" />
                      {uploadingImage ? "Uploading..." : "Choose Image"}
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {imageError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {imageError}
                  </div>
                )}

                <input
                  className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                  placeholder="Image URL"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                />

                {form.image_url && (
                  <div className="rounded-3xl border border-stone-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                        <img
                          src={form.image_url}
                          alt={form.name || "Wine preview"}
                          className="h-40 w-full object-cover"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={clearImage}
                        className="inline-flex items-center gap-2 rounded-2xl border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <input
                type="number"
                step="0.01"
                className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                placeholder="MSRP"
                value={form.msrp}
                onChange={(e) => setForm({ ...form, msrp: e.target.value })}
              />

              <input
                type="number"
                step="0.01"
                className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                placeholder="Store price"
                value={form.store_price}
                onChange={(e) => setForm({ ...form, store_price: e.target.value })}
              />

              <input
                type="number"
                step="0.01"
                className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                placeholder="Club price"
                value={form.club_price}
                onChange={(e) => setForm({ ...form, club_price: e.target.value })}
              />

              <input
                type="number"
                min="0"
                className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                placeholder="Inventory"
                value={form.inventory}
                onChange={(e) => setForm({ ...form, inventory: e.target.value })}
              />

              <label className="flex items-center gap-3 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={form.available_for_club}
                  onChange={(e) =>
                    setForm({ ...form, available_for_club: e.target.checked })
                  }
                />
                Available for club
              </label>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#263330] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {editingId ? "Update Wine" : "Add Wine"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-800">Current Wines</h2>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500">
                    <th className="px-3 py-3 font-medium">Wine</th>
                    <th className="px-3 py-3 font-medium">Type</th>
                    <th className="px-3 py-3 font-medium">Region</th>
                    <th className="px-3 py-3 font-medium">Inventory</th>
                    <th className="px-3 py-3 font-medium">Restock</th>
                    <th className="px-3 py-3 font-medium">Club Price</th>
                    <th className="px-3 py-3 font-medium">Available</th>
                    <th className="px-3 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-stone-500">
                        Loading wines...
                      </td>
                    </tr>
                  ) : wines.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-stone-500">
                        No wines added yet.
                      </td>
                    </tr>
                  ) : (
                    wines.map((wine) => (
                      <tr key={wine.id} className="border-b border-stone-100">
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-stone-100 text-stone-600">
                              {wine.image_url ? (
                                <img
                                  src={wine.image_url}
                                  alt={wine.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Wine className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-stone-800">{wine.name}</p>
                              <p className="text-xs text-stone-500">
                                {wine.winery || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-stone-700">{wine.type || "—"}</td>
                        <td className="px-3 py-4 text-stone-700">{wine.region || "—"}</td>
                        <td className="px-3 py-4 text-stone-700">
                          {Number(wine.inventory ?? 0)}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleInventoryAdjust(wine, 1)}
                              className="rounded-xl border border-stone-300 p-2 text-emerald-700 hover:bg-emerald-50"
                              title="Add 1 bottle"
                            >
                              <PackagePlus className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInventoryAdjust(wine, -1)}
                              className="rounded-xl border border-stone-300 p-2 text-amber-700 hover:bg-amber-50"
                              title="Remove 1 bottle"
                            >
                              <PackageMinus className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-stone-700">
                          ${Number(wine.club_price ?? 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-4 text-stone-700">
                          {wine.available_for_club ? "Yes" : "No"}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(wine)}
                              className="rounded-xl border border-stone-300 p-2 text-stone-700 hover:bg-stone-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(wine.id)}
                              className="rounded-xl border border-stone-300 p-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}