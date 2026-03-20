"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  findMemberByUserId,
  updateMemberFulfillment,
  type FulfillmentType,
  type Member,
} from "@/lib/services/member-service";

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fulfillmentType, setFulfillmentType] =
    useState<FulfillmentType>("pickup");
  const [zipCode, setZipCode] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadMember() {
      try {
        setLoading(true);
        setError("");
        setSuccess("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setError("Could not load your account.");
          return;
        }

        const foundMember = await findMemberByUserId(user.id);

        if (!foundMember) {
          setError("Could not find your member profile.");
          return;
        }

        setMember(foundMember);
        setFulfillmentType(foundMember.fulfillment_type ?? "pickup");
        setZipCode(foundMember.zip_code ?? "");
      } catch (err) {
        console.error(err);
        setError("Could not load your profile.");
      } finally {
        setLoading(false);
      }
    }

    loadMember();
  }, [supabase]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!member) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const updated = await updateMemberFulfillment(
        member.id,
        fulfillmentType,
        zipCode.trim()
      );

      setMember(updated);
      setFulfillmentType(updated.fulfillment_type ?? "pickup");
      setZipCode(updated.zip_code ?? "");

      if (updated.fulfillment_type === "delivery" && updated.delivery_approved) {
        setSuccess("Your delivery preference has been updated and approved.");
      } else if (
        updated.fulfillment_type === "delivery" &&
        updated.delivery_review_required
      ) {
        setSuccess(
          "Your delivery request has been submitted and is pending review."
        );
      } else {
        setSuccess("Your fulfillment preference has been updated.");
      }
    } catch (err) {
      console.error(err);
      setError("Could not update your fulfillment preference.");
    } finally {
      setSaving(false);
    }
  }

  function renderDeliveryStatus() {
    if (!member) return null;

    if (member.fulfillment_type !== "delivery") {
      return (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          You are currently set to pickup.
        </div>
      );
    }

    if (member.delivery_approved) {
      return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Your delivery preference is approved.
        </div>
      );
    }

    if (member.delivery_review_required) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your delivery request is pending review.
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        Delivery has been requested.
      </div>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f2ef] px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-stone-500">Loading profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef] px-6 py-10">
      <div className="mx-auto max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-stone-800">Profile</h1>
        <p className="mt-2 text-sm text-stone-500">
          Manage your fulfillment preference.
        </p>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="mt-6">
          {renderDeliveryStatus()}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-800">
              Fulfillment option
            </label>
            <select
              value={fulfillmentType}
              onChange={(e) =>
                setFulfillmentType(e.target.value as FulfillmentType)
              }
              className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-[#263330] focus:ring-2 focus:ring-[#263330]/20"
            >
              <option value="pickup">Pickup</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-800">
              Zip code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={zipCode}
              onChange={(e) =>
                setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))
              }
              placeholder="83843"
              className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-[#263330] focus:ring-2 focus:ring-[#263330]/20"
            />
          </div>

          {fulfillmentType === "delivery" && (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              Delivery is currently auto-approved for zip code 83843. Other zip
              codes can be reviewed individually.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-[#263330] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save preferences"}
          </button>
        </form>
      </div>
    </main>
  );
}