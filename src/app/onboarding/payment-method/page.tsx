"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    Square?: {
      payments: (
        appId: string,
        locationId: string
      ) => Promise<{
        card: () => Promise<{
          attach: (selector: string) => Promise<void>;
          tokenize: () => Promise<{
            status: string;
            token?: string;
            errors?: unknown[];
          }>;
          destroy?: () => Promise<void>;
        }>;
      }>;
    };
  }
}

const squareAppId = process.env.NEXT_PUBLIC_SQUARE_APP_ID ?? "";
const squareLocationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? "";

export default function PaymentMethodOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  const cardRef = useRef<{
    tokenize: () => Promise<{
      status: string;
      token?: string;
      errors?: unknown[];
    }>;
    destroy?: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        setMemberEmail(user.email ?? "");

        const { data: memberByUserId } = await supabase
          .from("members")
          .select("square_card_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (memberByUserId?.square_card_id) {
          router.replace("/");
          return;
        }

        if (!squareAppId || !squareLocationId) {
          setError(
            "Square is not configured. Add NEXT_PUBLIC_SQUARE_APP_ID and NEXT_PUBLIC_SQUARE_LOCATION_ID to your environment variables."
          );
          return;
        }

        await loadSquareScript();

        if (!window.Square) {
          setError("Square payment form failed to load.");
          return;
        }

        const payments = await window.Square.payments(
          squareAppId,
          squareLocationId
        );

        const card = await payments.card();
        await card.attach("#square-card-container");

        if (!mounted) {
          if (card.destroy) {
            await card.destroy();
          }
          return;
        }

        cardRef.current = card;
        setReady(true);
      } catch (err) {
        console.error(err);
        setError("Could not load payment form.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;

      const currentCard = cardRef.current;
      if (currentCard?.destroy) {
        currentCard.destroy().catch(() => {
          // no-op
        });
      }
    };
  }, [router, supabase]);

  async function loadSquareScript() {
    const existing = document.querySelector(
      'script[data-square-web-payments="true"]'
    ) as HTMLScriptElement | null;

    if (existing) {
      if (window.Square) return;

      await new Promise<void>((resolve, reject) => {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load Square script.")),
          { once: true }
        );
      });

      return;
    }

    const script = document.createElement("script");
    script.dataset.squareWebPayments = "true";
    script.src =
      squareAppId.startsWith("sandbox-") ||
      process.env.NODE_ENV !== "production"
        ? "https://sandbox.web.squarecdn.com/v1/square.js"
        : "https://web.squarecdn.com/v1/square.js";

    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load Square script."));
      document.head.appendChild(script);
    });
  }

  async function handleSaveCard() {
    try {
      setSaving(true);
      setError("");

      if (!cardRef.current) {
        setError("Payment form is not ready yet.");
        return;
      }

      const tokenResult = await cardRef.current.tokenize();

      if (tokenResult.status !== "OK" || !tokenResult.token) {
        setError("Card tokenization failed. Please check your card details.");
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setError("Could not verify your login session.");
        return;
      }

      const response = await fetch("/api/square/save-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          token: tokenResult.token,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result?.details || result?.error || "Failed to save card.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Could not save your card.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef] px-6 py-10 text-stone-900">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-stone-800">
            Add your payment method
          </h1>

          <p className="mt-3 text-sm leading-6 text-stone-600">
            A card on file is required to complete your membership setup. You
            will not be charged immediately. Your card will be charged later
            when your wine case is finalized and ready.
          </p>

          {memberEmail ? (
            <p className="mt-2 text-sm text-stone-500">
              Signed in as <span className="font-medium">{memberEmail}</span>
            </p>
          ) : null}

          <div className="mt-8 rounded-3xl border border-stone-200 bg-stone-50 p-5">
            <div
              id="square-card-container"
              className="min-h-[120px] rounded-2xl bg-white p-4"
            />
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-stone-500">
              Loading payment form...
            </p>
          ) : null}

          {!loading && !ready && !error ? (
            <p className="mt-4 text-sm text-stone-500">
              Preparing secure payment form...
            </p>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSaveCard}
              disabled={loading || !ready || saving}
              className="rounded-2xl bg-[#263330] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#1e2826] disabled:opacity-50"
            >
              {saving ? "Saving card..." : "Save payment method"}
            </button>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/login");
              }}
              className="rounded-2xl border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              Sign out
            </button>
          </div>

          <p className="mt-4 text-xs leading-5 text-stone-500">
            Card entry is handled securely by Square.
          </p>
        </div>
      </div>
    </main>
  );
}