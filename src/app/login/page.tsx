"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const rememberedEmail = localStorage.getItem("remembered_email") || "";
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRemember(true);
    }

    const params = new URLSearchParams(window.location.search);
    const message = params.get("message") || "";
    setSuccessMessage(message);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    try {
      setSaving(true);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message || "Invalid email or password");
        return;
      }

      if (remember) {
        localStorage.setItem("remembered_email", email);
      } else {
        localStorage.removeItem("remembered_email");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Could not sign in.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-10 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-stone-800">
            Vine & Table Case Club
          </h1>
          <p className="mt-2 text-sm text-stone-500">Member Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-stone-900 placeholder-stone-400 focus:border-[#263330] focus:ring-2 focus:ring-[#263330]/20 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-stone-900 placeholder-stone-400 focus:border-[#263330] focus:ring-2 focus:ring-[#263330]/20 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-stone-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>

            <Link
              href="/forgot-password"
              className="text-[#263330] font-medium hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {successMessage && (
            <p className="text-sm text-emerald-600">{successMessage}</p>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-[#263330] py-3 text-white font-medium transition hover:bg-[#1e2826] disabled:opacity-50"
          >
            {saving ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-[#263330] hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}