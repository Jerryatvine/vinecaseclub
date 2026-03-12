"use client";

import { useEffect, useState } from "react";
import type { Member, MemberRole, MembershipTier } from "@/lib/types/member";
import {
  getAllMembers,
  updateMemberRole,
  updateMemberTier,
} from "@/lib/services/member-service";

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
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

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <h1 className="text-3xl font-bold text-stone-800">Members</h1>
        <p className="mt-2 text-sm text-stone-500">
          View member accounts, roles, and case tiers.
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
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Membership Tier</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                    Loading members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                    No members found.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="border-b border-stone-100">
                    <td className="px-4 py-4 text-stone-800">{member.name}</td>
                    <td className="px-4 py-4 text-stone-700">{member.email}</td>
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
                  </tr>
                ))
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