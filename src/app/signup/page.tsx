"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MembershipTier = "economy" | "premium";

export default function SignupPage() {
  const supabase = createClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [membershipTier, setMembershipTier] =
    useState<MembershipTier>("economy");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: name,
            membership_tier: membershipTier,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setSuccess(
        "Account created. Please check your email and click the confirmation link to complete signup."
      );

      setName("");
      setEmail("");
      setPassword("");
      setMembershipTier("economy");
    } catch (err) {
      console.error(err);
      setError("Could not create account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f2ef] p-6 text-stone-900">
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-stone-900 shadow-sm">
        <h1 className="text-2xl font-bold text-stone-900">Create account</h1>
        <p className="mt-1 text-sm text-stone-600">
          Choose your membership tier to get the right wine case.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-800">
              Full name
            </label>
            <input
              type="text"
              className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none placeholder-stone-400 focus:border-[#263330] focus:ring-2 focus:ring-[#263330]/20"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-800">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none placeholder-stone-400 focus:border-[#263330] focus:ring-2 focus:ring-[#263330]/20"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-800">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none placeholder-stone-400 focus:border-[#263330] focus:ring-2 focus:ring-[#263330]/20"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-800">
              Membership tier
            </label>
            <select
              value={membershipTier}
              onChange={(e) =>
                setMembershipTier(e.target.value as MembershipTier)
              }
              className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-[#263330] focus:ring-2 focus:ring-[#263330]/20"
            >
              <option value="economy">Economy Case</option>
              <option value="premium">Premium Case</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-[#263330] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-stone-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-stone-900 underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}