"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAllMembers,
  updateMemberRole,
  updateMemberTier,
} from "@/lib/services/member-service";
import {
  getLatestCasesForMemberEmails,
  markCasePickedUp,
  undoCasePickedUp,
  type MemberCaseSummary,
} from "@/lib/services/admin-case-service";

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
};

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

function caseLabel(c?: MemberCaseSummary) {
  if (!c) return "—";
  const q = c.quarter ?? "";
  const y = c.year ? ` ${c.year}` : "";
  const t = c.tier ? ` (${c.tier})` : "";
  const label = `${q}${y}${t}`.trim();
  return label || "—";
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [latestCasesByEmail, setLatestCasesByEmail] = useState<
    Map<string, MemberCaseSummary>
  >(new Map());

  const [loading, setLoading] = useState(true);
  const [loadingCases, setLoadingCases] = useState(false);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [pickupSavingEmail, setPickupSavingEmail] = useState<string | null>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    const loadMembers = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getAllMembers();
        setMembers(data);
      } catch (err) {
        console.error(err);
        setError("Could not load members.");
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, []);

  useEffect(() => {
    async function loadLatestCases() {
      try {
        if (members.length === 0) {
          setLatestCasesByEmail(new Map());
          return;
        }

        setLoadingCases(true);
        setError("");

        const map = await getLatestCasesForMemberEmails(
          members.map((m) => m.email)
        );

        setLatestCasesByEmail(map);
      } catch (err) {
        console.error(err);
        setError("Could not load member cases.");
      } finally {
        setLoadingCases(false);
      }
    }

    loadLatestCases();
  }, [members]);

  const unreadable = useMemo(() => loading || loadingCases, [loading, loadingCases]);

  async function handleRoleChange(memberId: string, role: MemberRole) {
    try {
      setSavingId(memberId);
      setError("");

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

      const updated = await markCasePickedUp(current.id);

      setLatestCasesByEmail((prev) => {
        const next = new Map(prev);
        next.set(email, updated);
        return next;
      });
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

      const updated = await undoCasePickedUp(current.id);

      setLatestCasesByEmail((prev) => {
        const next = new Map(prev);
        next.set(email, updated);
        return next;
      });
    } catch (err) {
      console.error(err);
      setError("Could not undo picked up.");
    } finally {
      setPickupSavingEmail(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-7xl p-6 lg:p-10">
        <h1 className="text-3xl font-bold text-stone-800">Members</h1>
        <p className="mt-2 text-sm text-stone-500">
          View member accounts, roles, case tiers, and pickup status.
        </p>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-3xl border border-stone-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Latest Case</th>
                <th className="px-4 py-3 font-medium">Case Status</th>
                <th className="px-4 py-3 font-medium">Picked Up</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Membership Tier</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {unreadable ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-stone-500">
                    Loading members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-stone-500">
                    No members found.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const email = member.email.trim().toLowerCase();
                  const c = latestCasesByEmail.get(email);
                  const isPickupSaving = pickupSavingEmail === email;

                  const status = c?.status ?? null;
                  const pickedUpAt = c?.picked_up_at ?? null;

                  const canMarkPickedUp = c?.id && status === "ready_for_pickup";
                  const canUndoPickedUp = c?.id && status === "picked_up";

                  return (
                    <tr key={member.id} className="border-b border-stone-100">
                      <td className="px-4 py-4 text-stone-800">{member.name}</td>
                      <td className="px-4 py-4 text-stone-700">{member.email}</td>
                      <td className="px-4 py-4 text-stone-700">
                        {formatDate(member.created_at)}
                      </td>
                      <td className="px-4 py-4 text-stone-700">{caseLabel(c)}</td>
                      <td className="px-4 py-4 text-stone-700">
                        {c?.status ?? "—"}
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
                        <div className="flex flex-wrap gap-2">
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
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-stone-500">
          Changes save directly to Supabase.
        </p>
      </div>
    </main>
  );
}