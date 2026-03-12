"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MembershipTier = "economy" | "premium";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [membershipTier, setMembershipTier] =
    useState<MembershipTier>("economy");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      // 1. Create Supabase Auth user
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      const user = data.user;

      if (!user) {
        setError("Could not create account.");
        return;
      }

      // 2. Insert profile into members table
      const { error: memberError } = await supabase.from("members").insert([
        {
          id: user.id,
          name,
          email,
          membership_tier: membershipTier,
          role: "member",
        },
      ]);

      if (memberError) {
        setError(memberError.message);
        return;
      }

      // 3. Redirect to login
      router.push("/login");
    } catch (err) {
      console.error(err);
      setError("Could not create account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-stone-800">Create account</h1>
        <p className="mt-1 text-sm text-stone-500">
          Choose your membership tier to get the right wine case.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Full name
            </label>
            <input
              type="text"
              className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Membership tier
            </label>
            <select
              value={membershipTier}
              onChange={(e) =>
                setMembershipTier(e.target.value as MembershipTier)
              }
              className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none"
            >
              <option value="economy">Economy Case</option>
              <option value="premium">Premium Case</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-[#263330] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-stone-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-stone-800 underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}