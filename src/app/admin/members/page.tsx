"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Package,
  TriangleAlert,
  Wine as WineIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  approveMemberDelivery,
  getAllMembers,
  rejectMemberDelivery,
  updateMemberRole,
  updateMemberTier,
  type FulfillmentType,
} from "@/lib/services/member-service";
import {
  finalizeCaseAsAdmin,
  getLatestCasesForMemberEmails,
  markCasePickedUp,
  undoCasePickedUp,
  type MemberCaseSummary,
} from "@/lib/services/admin-case-service";
import {
  getCaseItems,
  removeCaseAndRestock,
  type CaseItemRecord,
} from "@/lib/services/case-service";
import { getAllWines } from "@/lib/services/wine-service";

type MemberRole = "admin" | "member";
type MembershipTier = "economy" | "premium";

type Member = {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  membership_tier: MembershipTier;
  user_id?: string | null;
  created_at?: string | null;
  fulfillment_type?: FulfillmentType | null;
  zip_code?: string | null;
  delivery_approved?: boolean | null;
  delivery_review_required?: boolean | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  delivery_notes?: string | null;
};

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

type MemberCaseDetail = {
  caseId: string;
  items: CaseItemRecord[];
};

type RemoveCaseModalState = {
  email: string;
  memberName: string;
  caseLabel: string;
  bottleCount: number;
  totalClubPrice: number;
} | null;

function formatDate(dateString?: string | null) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatDateTime(dateString?: string | null) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatCurrency(amount?: number | null) {
  const value = Number(amount ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function caseLabel(c?: MemberCaseSummary) {
  if (!c) return "—";
  const q = c.quarter ?? "";
  const y = c.year ? ` ${c.year}` : "";
  const t = c.tier ? ` (${c.tier})` : "";
  const label = `${q}${y}${t}`.trim();
  return label || "—";
}

function paymentStatusLabel(c?: MemberCaseSummary) {
  if (!c) return "—";
  if (c.charged) return "Charged";
  return "Not charged";
}

function paymentStatusClasses(c?: MemberCaseSummary) {
  if (!c) {
    return "bg-stone-100 text-stone-600";
  }

  if (c.charged) {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-amber-100 text-amber-700";
}

function fulfillmentLabel(member: Member) {
  if (member.fulfillment_type === "delivery") {
    return "Delivery";
  }

  if (member.fulfillment_type === "pickup") {
    return "Pickup";
  }

  return "—";
}

function deliveryStatusLabel(member: Member) {
  if (member.fulfillment_type !== "delivery") {
    return "Pickup";
  }

  if (member.delivery_approved) {
    return "Approved";
  }

  if (member.delivery_review_required) {
    return "Pending review";
  }

  return "Requested";
}

function deliveryStatusClasses(member: Member) {
  if (member.fulfillment_type !== "delivery") {
    return "bg-stone-100 text-stone-700";
  }

  if (member.delivery_approved) {
    return "bg-emerald-100 text-emerald-700";
  }

  if (member.delivery_review_required) {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-blue-100 text-blue-700";
}

function formatFullAddress(member: Member) {
  const line1 = member.address_line_1?.trim() || "";
  const line2 = member.address_line_2?.trim() || "";
  const city = member.city?.trim() || "";
  const state = member.state?.trim() || "";
  const zip = member.zip_code?.trim() || "";

  const cityStateZip = [city, state].filter(Boolean).join(", ");
  const finalLine = [cityStateZip, zip].filter(Boolean).join(" ");

  return [line1, line2, finalLine].filter(Boolean);
}

function hasCompleteDeliveryAddress(member: Member) {
  return Boolean(
    member.address_line_1?.trim() &&
      member.city?.trim() &&
      member.state?.trim() &&
      member.zip_code?.trim()
  );
}

function canFinalizeCaseNow(c?: MemberCaseSummary) {
  if (!c?.id || c.charged) return false;
  return c.status === "draft" || c.status === "customizing";
}

function canChargeCaseNow(c?: MemberCaseSummary) {
  if (!c?.id || c.charged) return false;
  return c.status === "finalized" || c.status === "ready_for_pickup";
}

export default function AdminMembersPage() {
  const supabase = useMemo(() => createClient(), []);

  const [members, setMembers] = useState<Member[]>([]);
  const [latestCasesByEmail, setLatestCasesByEmail] = useState<
    Map<string, MemberCaseSummary>
  >(new Map());
  const [caseDetailsByEmail, setCaseDetailsByEmail] = useState<
    Map<string, MemberCaseDetail>
  >(new Map());
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [winesById, setWinesById] = useState<Map<string, WineItem>>(new Map());

  const [loading, setLoading] = useState(true);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingCaseContentsEmail, setLoadingCaseContentsEmail] = useState<
    string | null
  >(null);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [pickupSavingEmail, setPickupSavingEmail] = useState<string | null>(null);
  const [chargeSavingEmail, setChargeSavingEmail] = useState<string | null>(null);
  const [finalizeSavingEmail, setFinalizeSavingEmail] = useState<string | null>(
    null
  );
  const [removingCaseEmail, setRemovingCaseEmail] = useState<string | null>(null);
  const [deliverySavingId, setDeliverySavingId] = useState<string | null>(null);
  const [removeCaseModal, setRemoveCaseModal] =
    useState<RemoveCaseModalState>(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function refreshLatestCases(memberList?: Member[]) {
    try {
      const sourceMembers = memberList ?? members;

      if (sourceMembers.length === 0) {
        setLatestCasesByEmail(new Map());
        return;
      }

      setLoadingCases(true);
      setError("");

      const map = await getLatestCasesForMemberEmails(
        sourceMembers.map((m) => m.email)
      );

      setLatestCasesByEmail(map);

      setCaseDetailsByEmail((prev) => {
        const next = new Map(prev);

        for (const [email, detail] of prev.entries()) {
          const latestCase = map.get(email);
          if (!latestCase?.id || detail.caseId !== latestCase.id) {
            next.delete(email);
          }
        }

        return next;
      });
    } catch (err) {
      console.error(err);
      setError("Could not load member cases.");
    } finally {
      setLoadingCases(false);
    }
  }

  async function loadCaseContentsForMember(
    memberEmail: string,
    forceRefresh = false
  ) {
    const email = memberEmail.trim().toLowerCase();
    const latestCase = latestCasesByEmail.get(email);

    if (!latestCase?.id) {
      setError("No case found for this member.");
      return;
    }

    const existing = caseDetailsByEmail.get(email);
    if (!forceRefresh && existing?.caseId === latestCase.id) {
      return;
    }

    try {
      setLoadingCaseContentsEmail(email);
      setError("");

      const items = await getCaseItems(latestCase.id);

      setCaseDetailsByEmail((prev) => {
        const next = new Map(prev);
        next.set(email, {
          caseId: latestCase.id,
          items,
        });
        return next;
      });
    } catch (err) {
      console.error(err);
      setError("Could not load case contents.");
    } finally {
      setLoadingCaseContentsEmail(null);
    }
  }

  async function toggleCaseContents(memberEmail: string) {
    const email = memberEmail.trim().toLowerCase();
    const isExpanded = expandedEmails.has(email);

    if (isExpanded) {
      setExpandedEmails((prev) => {
        const next = new Set(prev);
        next.delete(email);
        return next;
      });
      return;
    }

    setExpandedEmails((prev) => {
      const next = new Set(prev);
      next.add(email);
      return next;
    });

    await loadCaseContentsForMember(email);
  }

  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        setError("");

        const [memberData, wineData] = await Promise.all([
          getAllMembers(),
          getAllWines(),
        ]);

        setMembers(memberData);
        setWinesById(new Map(wineData.map((wine) => [wine.id, wine])));
        await refreshLatestCases(memberData);
      } catch (err) {
        console.error(err);
        setError("Could not load members.");
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-members-live-view")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases" },
        async () => {
          await refreshLatestCases();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_items" },
        async () => {
          const expanded = Array.from(expandedEmails);
          if (expanded.length === 0) return;

          for (const email of expanded) {
            await loadCaseContentsForMember(email, true);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wines" },
        async () => {
          try {
            const wineData = await getAllWines();
            setWinesById(new Map(wineData.map((wine) => [wine.id, wine])));
          } catch (err) {
            console.error(err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [expandedEmails, members, supabase]);

  const unreadable = useMemo(
    () => loading || loadingCases,
    [loading, loadingCases]
  );

  async function handleRoleChange(memberId: string, role: MemberRole) {
    try {
      setSavingId(memberId);
      setError("");
      setSuccessMessage("");

      const updated = await updateMemberRole(memberId, role);
      if (!updated) return;

      setMembers((prev) =>
        prev.map((member) =>
          member.id === memberId ? { ...member, role: updated.role } : member
        )
      );
    } catch (err) {
      console.error(err);
      setError("Could not update member role.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleTierChange(
    memberId: string,
    membership_tier: MembershipTier
  ) {
    try {
      setSavingId(memberId);
      setError("");
      setSuccessMessage("");

      const updated = await updateMemberTier(memberId, membership_tier);
      if (!updated) return;

      setMembers((prev) =>
        prev.map((member) =>
          member.id === memberId
            ? { ...member, membership_tier: updated.membership_tier }
            : member
        )
      );
    } catch (err) {
      console.error(err);
      setError("Could not update membership tier.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleApproveDelivery(memberId: string) {
    const member = members.find((m) => m.id === memberId);

    if (!member) {
      setError("Could not find member.");
      return;
    }

    if (!hasCompleteDeliveryAddress(member)) {
      setError(
        "Delivery cannot be approved until address line 1, city, state, and zip code are complete."
      );
      return;
    }

    try {
      setDeliverySavingId(memberId);
      setError("");
      setSuccessMessage("");

      const updated = await approveMemberDelivery(memberId);

      setMembers((prev) =>
        prev.map((member) => (member.id === memberId ? updated : member))
      );

      setSuccessMessage("Delivery approved.");
    } catch (err) {
      console.error(err);
      setError("Could not approve delivery.");
    } finally {
      setDeliverySavingId(null);
    }
  }

  async function handleRejectDelivery(memberId: string) {
    try {
      setDeliverySavingId(memberId);
      setError("");
      setSuccessMessage("");

      const updated = await rejectMemberDelivery(memberId);

      setMembers((prev) =>
        prev.map((member) => (member.id === memberId ? updated : member))
      );

      setSuccessMessage("Delivery rejected. Member was switched to pickup.");
    } catch (err) {
      console.error(err);
      setError("Could not reject delivery.");
    } finally {
      setDeliverySavingId(null);
    }
  }

  async function handleFinalizeCase(memberEmail: string) {
    const email = memberEmail.trim().toLowerCase();
    const current = latestCasesByEmail.get(email);

    if (!current?.id) {
      setError("No case found for this member.");
      return;
    }

    if (!canFinalizeCaseNow(current)) {
      setError("Only draft or customizing cases can be finalized here.");
      return;
    }

    const confirmed = window.confirm(
      `Finalize this member's latest case?\n\nMember: ${memberEmail}\nCase: ${caseLabel(
        current
      )}\n\nThis will mark the case as finalized.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setFinalizeSavingEmail(email);
      setError("");
      setSuccessMessage("");

      const updated = await finalizeCaseAsAdmin(current.id);

      setLatestCasesByEmail((prev) => {
        const next = new Map(prev);
        next.set(email, updated);
        return next;
      });

      setSuccessMessage("Case finalized.");
    } catch (err) {
      console.error(err);
      setError("Could not finalize case.");
    } finally {
      setFinalizeSavingEmail(null);
    }
  }

  async function handleMarkPickedUp(memberEmail: string) {
    const email = memberEmail.trim().toLowerCase();
    const current = latestCasesByEmail.get(email);

    if (!current?.id) {
      setError("No case found for this member.");
      return;
    }

    if (
      !window.confirm(
        `Mark this member's latest case as picked up?\n\n${caseLabel(current)}`
      )
    ) {
      return;
    }

    try {
      setPickupSavingEmail(email);
      setError("");
      setSuccessMessage("");

      const updated = await markCasePickedUp(current.id);

      setLatestCasesByEmail((prev) => {
        const next = new Map(prev);
        next.set(email, updated);
        return next;
      });

      setSuccessMessage("Case marked as picked up.");
    } catch (err) {
      console.error(err);
      setError("Could not mark case as picked up.");
    } finally {
      setPickupSavingEmail(null);
    }
  }

  async function handleUndoPickedUp(memberEmail: string) {
    const email = memberEmail.trim().toLowerCase();
    const current = latestCasesByEmail.get(email);

    if (!current?.id) {
      setError("No case found for this member.");
      return;
    }

    if (
      !window.confirm(
        `Undo picked up for this member's latest case?\n\n${caseLabel(current)}`
      )
    ) {
      return;
    }

    try {
      setPickupSavingEmail(email);
      setError("");
      setSuccessMessage("");

      const updated = await undoCasePickedUp(current.id);

      setLatestCasesByEmail((prev) => {
        const next = new Map(prev);
        next.set(email, updated);
        return next;
      });

      setSuccessMessage("Picked up status was undone.");
    } catch (err) {
      console.error(err);
      setError("Could not undo picked up.");
    } finally {
      setPickupSavingEmail(null);
    }
  }

  async function handleChargeCard(memberEmail: string) {
    const email = memberEmail.trim().toLowerCase();
    const current = latestCasesByEmail.get(email);

    if (!current?.id) {
      setError("No case found for this member.");
      return;
    }

    if (current.charged) {
      setError("This member's latest case is already charged.");
      return;
    }

    if (!canChargeCaseNow(current)) {
      setError(
        "This case can only be charged after it is finalized or ready for pickup."
      );
      return;
    }

    const confirmed = window.confirm(
      `Charge this member's saved card?\n\nMember: ${memberEmail}\nCase: ${caseLabel(
        current
      )}\n\nThis will charge the saved Square card on file.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setChargeSavingEmail(email);
      setError("");
      setSuccessMessage("");

      const response = await fetch("/api/admin/charge-case", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caseId: current.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result?.error || "Could not charge card.");
        return;
      }

      await refreshLatestCases();
      if (expandedEmails.has(email)) {
        await loadCaseContentsForMember(email, true);
      }

      setSuccessMessage(
        `Card charged successfully for ${memberEmail}. Total charged: ${formatCurrency(
          result?.total
        )}.`
      );
    } catch (err) {
      console.error(err);
      setError("Could not charge card.");
    } finally {
      setChargeSavingEmail(null);
    }
  }

  function openRemoveCaseModal(
    member: Member,
    currentCase: MemberCaseSummary | undefined,
    totalBottleCount: number,
    totalClubPrice: number
  ) {
    const email = member.email.trim().toLowerCase();

    if (!currentCase?.id) {
      setError("No case found for this member.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setRemoveCaseModal({
      email,
      memberName: member.name,
      caseLabel: caseLabel(currentCase),
      bottleCount: totalBottleCount,
      totalClubPrice,
    });
  }

  function closeRemoveCaseModal() {
    if (removingCaseEmail) return;
    setRemoveCaseModal(null);
  }

  async function confirmRemoveCase() {
    if (!removeCaseModal) return;

    const email = removeCaseModal.email;
    const current = latestCasesByEmail.get(email);

    if (!current?.id) {
      setError("No case found for this member.");
      setRemoveCaseModal(null);
      return;
    }

    try {
      setRemovingCaseEmail(email);
      setError("");
      setSuccessMessage("");

      const result = await removeCaseAndRestock(current.id);

      setLatestCasesByEmail((prev) => {
        const next = new Map(prev);
        next.delete(email);
        return next;
      });

      setCaseDetailsByEmail((prev) => {
        const next = new Map(prev);
        next.delete(email);
        return next;
      });

      setExpandedEmails((prev) => {
        const next = new Set(prev);
        next.delete(email);
        return next;
      });

      const wineData = await getAllWines();
      setWinesById(new Map(wineData.map((wine) => [wine.id, wine])));

      await refreshLatestCases();

      setSuccessMessage(
        `Case removed. ${result.restockedBottleCount} bottle${
          result.restockedBottleCount === 1 ? "" : "s"
        } returned to inventory.`
      );
      setRemoveCaseModal(null);
    } catch (err) {
      console.error(err);
      setError("Could not remove case and return inventory.");
    } finally {
      setRemovingCaseEmail(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-7xl p-6 lg:p-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-stone-800">Members</h1>
            <p className="mt-2 text-sm text-stone-500">
              View member accounts, delivery requests, full delivery addresses,
              roles, case tiers, payment status, pickup status, and live case
              contents.
            </p>
          </div>

          <Link
            href="/admin/payments"
            className="inline-flex w-fit items-center rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            View all payments
          </Link>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-3xl border border-stone-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Fulfillment</th>
                <th className="px-4 py-3 font-medium">Delivery Status</th>
                <th className="px-4 py-3 font-medium">Delivery Address</th>
                <th className="px-4 py-3 font-medium">Delivery Notes</th>
                <th className="px-4 py-3 font-medium">Latest Case</th>
                <th className="px-4 py-3 font-medium">Case Status</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Charged At</th>
                <th className="px-4 py-3 font-medium">Picked Up</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Membership Tier</th>
                <th className="px-4 py-3 font-medium">Case View</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {unreadable ? (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-stone-500">
                    Loading members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-stone-500">
                    No members found.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const email = member.email.trim().toLowerCase();
                  const c = latestCasesByEmail.get(email);
                  const isPickupSaving = pickupSavingEmail === email;
                  const isChargeSaving = chargeSavingEmail === email;
                  const isFinalizeSaving = finalizeSavingEmail === email;
                  const isRemovingCase = removingCaseEmail === email;
                  const isDeliverySaving = deliverySavingId === member.id;
                  const isExpanded = expandedEmails.has(email);
                  const caseDetail = caseDetailsByEmail.get(email);

                  const status = c?.status ?? null;
                  const pickedUpAt = c?.picked_up_at ?? null;
                  const chargedAt = c?.charged_at ?? null;

                  const canMarkPickedUp = !!c?.id && status === "ready_for_pickup";
                  const canUndoPickedUp = !!c?.id && status === "picked_up";
                  const canChargeCard = canChargeCaseNow(c);
                  const canFinalizeCase = canFinalizeCaseNow(c);

                  const addressComplete = hasCompleteDeliveryAddress(member);

                  const canApproveDelivery =
                    member.fulfillment_type === "delivery" &&
                    !member.delivery_approved &&
                    addressComplete;

                  const canRejectDelivery = member.fulfillment_type === "delivery";

                  const addressLines = formatFullAddress(member);

                  const detailedItems = (caseDetail?.items ?? [])
                    .map((item) => ({
                      ...item,
                      wine: winesById.get(item.wine_id) ?? null,
                    }))
                    .sort((a, b) => {
                      const aName = a.wine?.name ?? "";
                      const bName = b.wine?.name ?? "";
                      return aName.localeCompare(bName);
                    });

                  const totalBottleCount = detailedItems.reduce(
                    (sum, item) => sum + Number(item.quantity || 0),
                    0
                  );

                  const totalClubPrice = detailedItems.reduce((sum, item) => {
                    const clubPrice = Number(item.wine?.club_price ?? 0);
                    return sum + clubPrice * Number(item.quantity || 0);
                  }, 0);

                  return (
                    <React.Fragment key={member.id}>
                      <tr className="border-b border-stone-100 align-top">
                        <td className="px-4 py-4 text-stone-800">{member.name}</td>
                        <td className="px-4 py-4 text-stone-700">{member.email}</td>
                        <td className="px-4 py-4 text-stone-700">
                          {formatDate(member.created_at)}
                        </td>
                        <td className="px-4 py-4 text-stone-700">
                          {fulfillmentLabel(member)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-2">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${deliveryStatusClasses(
                                member
                              )}`}
                            >
                              {deliveryStatusLabel(member)}
                            </span>

                            {member.fulfillment_type === "delivery" &&
                            !addressComplete ? (
                              <p className="max-w-[200px] text-xs text-red-600">
                                Missing required address fields. Delivery cannot be
                                approved yet.
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-stone-700">
                          {member.fulfillment_type === "delivery" ? (
                            addressLines.length > 0 ? (
                              <div className="space-y-1">
                                {addressLines.map((line, index) => (
                                  <p key={index} className="max-w-[220px] break-words">
                                    {line}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              "—"
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-4 text-stone-700">
                          {member.fulfillment_type === "delivery" ? (
                            member.delivery_notes ? (
                              <p className="max-w-[220px] whitespace-pre-line break-words text-sm">
                                {member.delivery_notes}
                              </p>
                            ) : (
                              "—"
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-4 text-stone-700">{caseLabel(c)}</td>
                        <td className="px-4 py-4 text-stone-700">{c?.status ?? "—"}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${paymentStatusClasses(
                              c
                            )}`}
                          >
                            {paymentStatusLabel(c)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-stone-700">
                          {chargedAt ? formatDateTime(chargedAt) : "—"}
                        </td>
                        <td className="px-4 py-4 text-stone-700">
                          {pickedUpAt ? formatDateTime(pickedUpAt) : "—"}
                        </td>

                        <td className="px-4 py-4">
                          <select
                            value={member.role}
                            disabled={savingId === member.id}
                            onChange={(e) =>
                              handleRoleChange(member.id, e.target.value as MemberRole)
                            }
                            className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none disabled:opacity-50"
                          >
                            <option value="member">member</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>

                        <td className="px-4 py-4">
                          <select
                            value={member.membership_tier}
                            disabled={savingId === member.id}
                            onChange={(e) =>
                              handleTierChange(
                                member.id,
                                e.target.value as MembershipTier
                              )
                            }
                            className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none disabled:opacity-50"
                          >
                            <option value="economy">economy</option>
                            <option value="premium">premium</option>
                          </select>
                        </td>

                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => toggleCaseContents(member.email)}
                            disabled={!c?.id}
                            className="inline-flex items-center gap-2 rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title={
                              c?.id
                                ? isExpanded
                                  ? "Hide live case contents"
                                  : "Show live case contents"
                                : "No case found for this member"
                            }
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            {isExpanded ? "Hide case" : "View case"}
                          </button>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!canApproveDelivery || isDeliverySaving}
                              onClick={() => handleApproveDelivery(member.id)}
                              className="rounded-2xl bg-blue-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                              title={
                                canApproveDelivery
                                  ? "Approve delivery"
                                  : member.fulfillment_type !== "delivery"
                                  ? "Member is not set to delivery"
                                  : member.delivery_approved
                                  ? "Delivery is already approved"
                                  : !addressComplete
                                  ? "Complete address is required before approving delivery"
                                  : "Delivery cannot be approved yet"
                              }
                            >
                              {isDeliverySaving ? "Saving..." : "Approve delivery"}
                            </button>

                            <button
                              type="button"
                              disabled={!canRejectDelivery || isDeliverySaving}
                              onClick={() => handleRejectDelivery(member.id)}
                              className="rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 disabled:opacity-50"
                            >
                              Reject delivery
                            </button>

                            <button
                              type="button"
                              disabled={!canFinalizeCase || isFinalizeSaving}
                              onClick={() => handleFinalizeCase(member.email)}
                              className="rounded-2xl bg-amber-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                              title={
                                canFinalizeCase
                                  ? "Finalize the latest case"
                                  : c?.charged
                                  ? "This latest case is already charged"
                                  : "Only draft or customizing cases can be finalized"
                              }
                            >
                              {isFinalizeSaving ? "Finalizing..." : "Finalize case"}
                            </button>

                            <button
                              type="button"
                              disabled={!canChargeCard || isChargeSaving}
                              onClick={() => handleChargeCard(member.email)}
                              className="rounded-2xl bg-emerald-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                              title={
                                canChargeCard
                                  ? "Charge the saved card for the latest finalized or ready case"
                                  : c?.charged
                                  ? "This latest case is already charged"
                                  : "Only available when case status is finalized or ready_for_pickup"
                              }
                            >
                              {isChargeSaving ? "Charging..." : "Charge card"}
                            </button>

                            <button
                              type="button"
                              disabled={!canMarkPickedUp || isPickupSaving}
                              onClick={() => handleMarkPickedUp(member.email)}
                              className="rounded-2xl bg-[#263330] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                              title={
                                canMarkPickedUp
                                  ? "Mark latest case picked up"
                                  : "Only available when case status is ready_for_pickup"
                              }
                            >
                              {isPickupSaving ? "Saving..." : "Mark picked up"}
                            </button>

                            <button
                              type="button"
                              disabled={!canUndoPickedUp || isPickupSaving}
                              onClick={() => handleUndoPickedUp(member.email)}
                              className="rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 disabled:opacity-50"
                              title="Undo picked up (sets status back to ready_for_pickup)"
                            >
                              Undo
                            </button>

                            <Link
                              href={`/admin/payments?member=${encodeURIComponent(
                                member.email
                              )}`}
                              className="rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
                              title="View this member's payment history"
                            >
                              View payments
                            </Link>
                          </div>

                          {c?.square_payment_id ? (
                            <p className="mt-2 max-w-[220px] break-all text-xs text-stone-500">
                              Payment ID: {c.square_payment_id}
                            </p>
                          ) : null}
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className="border-b border-stone-200 bg-stone-50">
                          <td colSpan={16} className="px-4 py-4">
                            <div className="rounded-2xl border border-stone-200 bg-white p-4">
                              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <h3 className="text-base font-semibold text-stone-800">
                                    Live Case View
                                  </h3>
                                  <p className="mt-1 text-sm text-stone-500">
                                    {member.name}&apos;s current case contents update
                                    as case items change.
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-sm">
                                  <span className="rounded-full bg-stone-100 px-3 py-1 font-medium text-stone-700">
                                    {caseLabel(c)}
                                  </span>
                                  <span className="rounded-full bg-stone-100 px-3 py-1 font-medium text-stone-700">
                                    {totalBottleCount} bottles
                                  </span>
                                  <span className="rounded-full bg-stone-100 px-3 py-1 font-medium text-stone-700">
                                    {formatCurrency(totalClubPrice)}
                                  </span>

                                  {c?.id ? (
                                    <button
                                      type="button"
                                      disabled={isRemovingCase}
                                      onClick={() =>
                                        openRemoveCaseModal(
                                          member,
                                          c,
                                          totalBottleCount,
                                          totalClubPrice
                                        )
                                      }
                                      className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                      title="Remove this member's latest case and return wines to inventory"
                                    >
                                      {isRemovingCase ? "Removing..." : "Remove case"}
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              {loadingCaseContentsEmail === email ? (
                                <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-6 text-sm text-stone-500">
                                  <Package className="h-4 w-4" />
                                  Loading case contents...
                                </div>
                              ) : detailedItems.length === 0 ? (
                                <div className="flex items-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">
                                  <Package className="h-4 w-4" />
                                  No wines are currently assigned to this case.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-left text-sm">
                                    <thead>
                                      <tr className="border-b border-stone-200 text-stone-500">
                                        <th className="px-3 py-3 font-medium">Wine</th>
                                        <th className="px-3 py-3 font-medium">Type</th>
                                        <th className="px-3 py-3 font-medium">Region</th>
                                        <th className="px-3 py-3 font-medium">
                                          Club Price
                                        </th>
                                        <th className="px-3 py-3 font-medium">Qty</th>
                                        <th className="px-3 py-3 font-medium">
                                          Line Total
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detailedItems.map((item) => {
                                        const wine = item.wine;
                                        const lineTotal =
                                          Number(wine?.club_price ?? 0) *
                                          Number(item.quantity ?? 0);

                                        return (
                                          <tr
                                            key={item.id}
                                            className="border-b border-stone-100"
                                          >
                                            <td className="px-3 py-4">
                                              <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-stone-100 text-stone-600">
                                                  {wine?.image_url ? (
                                                    <img
                                                      src={wine.image_url}
                                                      alt={wine.name || "Wine"}
                                                      className="h-full w-full object-cover"
                                                    />
                                                  ) : (
                                                    <WineIcon className="h-5 w-5" />
                                                  )}
                                                </div>

                                                <div>
                                                  <p className="font-medium text-stone-800">
                                                    {wine?.name || "Unknown wine"}
                                                  </p>
                                                  <p className="text-xs text-stone-500">
                                                    {[wine?.winery, wine?.vintage]
                                                      .filter(Boolean)
                                                      .join(" • ") || "—"}
                                                  </p>
                                                </div>
                                              </div>
                                            </td>

                                            <td className="px-3 py-4 text-stone-700">
                                              {wine?.type || "—"}
                                            </td>

                                            <td className="px-3 py-4 text-stone-700">
                                              {wine?.region || "—"}
                                            </td>

                                            <td className="px-3 py-4 text-stone-700">
                                              {formatCurrency(wine?.club_price ?? 0)}
                                            </td>

                                            <td className="px-3 py-4 text-stone-700">
                                              {item.quantity}
                                            </td>

                                            <td className="px-3 py-4 font-medium text-stone-800">
                                              {formatCurrency(lineTotal)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-stone-500">
          Changes save directly to Supabase. Case contents refresh live when case
          or wine data changes.
        </p>
      </div>

      {removeCaseModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                <TriangleAlert className="h-6 w-6" />
              </div>

              <div className="flex-1">
                <h2 className="text-xl font-semibold text-stone-900">
                  Remove member case?
                </h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  This will permanently remove the current case for{" "}
                  <span className="font-semibold text-stone-800">
                    {removeCaseModal.memberName}
                  </span>{" "}
                  and return all wines to available inventory.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Case
                  </p>
                  <p className="mt-1 text-sm font-semibold text-stone-800">
                    {removeCaseModal.caseLabel}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Bottles returning
                  </p>
                  <p className="mt-1 text-sm font-semibold text-stone-800">
                    {removeCaseModal.bottleCount}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Club value returning to inventory
                  </p>
                  <p className="mt-1 text-sm font-semibold text-stone-800">
                    {formatCurrency(removeCaseModal.totalClubPrice)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              This action cannot be undone.
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeRemoveCaseModal}
                disabled={Boolean(removingCaseEmail)}
                className="rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmRemoveCase}
                disabled={Boolean(removingCaseEmail)}
                className="rounded-2xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
              >
                {removingCaseEmail ? "Removing case..." : "Yes, remove case"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}