"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Payment = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  case_id: string | null;
};

type CardInfo = {
  last4: string;
  brand: string;
};

type SquareCard = {
  attach: (selectorOrElement: string | HTMLElement) => Promise<void>;
  tokenize: () => Promise<{
    status: string;
    token?: string;
    errors?: unknown[];
  }>;
  destroy?: () => Promise<void>;
};

declare global {
  interface Window {
    Square?: {
      payments: (
        appId: string,
        locationId: string
      ) => Promise<{
        card: () => Promise<SquareCard>;
      }>;
    };
  }
}

const squareAppId = process.env.NEXT_PUBLIC_SQUARE_APP_ID ?? "";
const squareLocationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? "";
const squareScriptSrc = "https://web.squarecdn.com/v1/square.js";

function BillingPageContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetupFlow = searchParams.get("setup") === "1";

  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<SquareCard | null>(null);

  const [card, setCard] = useState<CardInfo | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCard, setSavingCard] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [squareReady, setSquareReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSquareScript() {
      try {
        if (!squareAppId || !squareLocationId) {
          if (!cancelled) {
            setError(
              "Square is not configured. Add NEXT_PUBLIC_SQUARE_APP_ID and NEXT_PUBLIC_SQUARE_LOCATION_ID."
            );
          }
          return;
        }

        if (window.Square) {
          if (!cancelled) {
            setSquareReady(true);
          }
          return;
        }

        const existingScript = document.querySelector<HTMLScriptElement>(
          `script[src="${squareScriptSrc}"]`
        );

        if (existingScript) {
          existingScript.addEventListener("load", () => {
            if (!cancelled) {
              setSquareReady(true);
            }
          });

          existingScript.addEventListener("error", () => {
            if (!cancelled) {
              setError("Square payment form failed to load.");
            }
          });

          return;
        }

        const script = document.createElement("script");
        script.src = squareScriptSrc;
        script.async = true;

        script.onload = () => {
          if (!cancelled) {
            setSquareReady(true);
          }
        };

        script.onerror = () => {
          if (!cancelled) {
            setError("Square payment form failed to load.");
          }
        };

        document.head.appendChild(script);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Square payment form failed to load.");
        }
      }
    }

    loadSquareScript();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function loadBilling() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          setError("Not authenticated.");
          return;
        }

        const user = session.user;

        let memberId: string | null = null;
        let hasCardOnFile = false;

        const { data: memberByUserId, error: memberByUserIdError } =
          await supabase
            .from("members")
            .select("id, square_card_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (memberByUserIdError) {
          setError("Could not load billing info.");
          return;
        }

        if (memberByUserId) {
          memberId = memberByUserId.id;
          hasCardOnFile = !!memberByUserId.square_card_id;
        }

        if (!memberId && user.email) {
          const normalizedEmail = user.email.trim().toLowerCase();

          const { data: memberByEmail, error: memberByEmailError } =
            await supabase
              .from("members")
              .select("id, square_card_id")
              .eq("email", normalizedEmail)
              .maybeSingle();

          if (memberByEmailError) {
            setError("Could not load billing info.");
            return;
          }

          if (memberByEmail) {
            memberId = memberByEmail.id;
            hasCardOnFile = !!memberByEmail.square_card_id;
          }
        }

        if (!memberId) {
          setError("Could not load billing info.");
          return;
        }

        if (hasCardOnFile) {
          const cardRes = await fetch("/api/square/get-card", {
            method: "GET",
            cache: "no-store",
          });

          const cardText = await cardRes.text();

          let cardJson: {
            error?: string;
            card?: {
              last4?: string | null;
              brand?: string | null;
            } | null;
          } | null = null;

          try {
            cardJson = cardText ? JSON.parse(cardText) : null;
          } catch {
            console.error("Non-JSON response from /api/square/get-card:", cardText);
            setError("Could not load saved card details.");
            return;
          }

          if (!cardRes.ok) {
            setError(cardJson?.error || "Could not load saved card details.");
            return;
          }

          if (cardJson?.card?.last4 && cardJson?.card?.brand) {
            setCard({
              last4: cardJson.card.last4,
              brand: cardJson.card.brand,
            });
          }
        }

        const { data: paymentData, error: paymentError } = await supabase
          .from("payments")
          .select("id, amount, status, created_at, case_id")
          .eq("member_id", memberId)
          .order("created_at", { ascending: false });

        if (paymentError) {
          setError("Could not load payments.");
          return;
        }

        setPayments(paymentData ?? []);

        if (isSetupFlow && !hasCardOnFile) {
          setShowCardForm(true);
        }
      } catch (err) {
        console.error(err);
        setError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    loadBilling();
  }, [supabase, isSetupFlow]);

  useEffect(() => {
    async function mountSquareCard() {
      if (!showCardForm || !cardContainerRef.current) {
        return;
      }

      if (!squareAppId || !squareLocationId) {
        setError(
          "Square is not configured. Add NEXT_PUBLIC_SQUARE_APP_ID and NEXT_PUBLIC_SQUARE_LOCATION_ID."
        );
        return;
      }

      if (!squareReady || !window.Square) {
        setError("Square payment form failed to load.");
        return;
      }

      try {
        setError("");

        if (cardRef.current?.destroy) {
          await cardRef.current.destroy();
          cardRef.current = null;
        }

        cardContainerRef.current.innerHTML = "";

        const payments = await window.Square.payments(
          squareAppId,
          squareLocationId
        );

        const squareCard = await payments.card();
        await squareCard.attach(cardContainerRef.current);

        cardRef.current = squareCard;
      } catch (err) {
        console.error(err);
        setError("Could not load payment form.");
      }
    }

    mountSquareCard();

    return () => {
      const current = cardRef.current;
      if (current?.destroy) {
        current.destroy().catch(() => {
          // no-op
        });
      }
      cardRef.current = null;
    };
  }, [showCardForm, squareReady]);

  async function refreshSavedCard() {
    const cardRes = await fetch("/api/square/get-card", {
      method: "GET",
      cache: "no-store",
    });

    const cardJson = (await cardRes.json()) as {
      card?: {
        last4?: string | null;
        brand?: string | null;
      } | null;
    };

    if (cardJson?.card?.last4 && cardJson?.card?.brand) {
      setCard({
        last4: cardJson.card.last4,
        brand: cardJson.card.brand,
      });
    } else {
      setCard(null);
    }
  }

  async function handleSaveCard() {
    try {
      setSavingCard(true);
      setError("");

      if (!cardRef.current) {
        setError("Card form is not ready.");
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

      await refreshSavedCard();
      setShowCardForm(false);

      if (isSetupFlow) {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError("Could not save card.");
    } finally {
      setSavingCard(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  }

  function formatDate(date: string) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-4xl space-y-8 p-6 lg:p-10">
        <div>
          <h1 className="text-3xl font-bold text-stone-800">
            {isSetupFlow ? "Add Your Payment Method" : "Billing"}
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            {isSetupFlow
              ? "Add a card to finish setting up your membership."
              : "Manage your payment method and view your billing history."}
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-800">
            Payment Method
          </h2>

          {loading ? (
            <p className="mt-3 text-sm text-stone-500">Loading...</p>
          ) : card ? (
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-sm text-stone-700">
                {card.brand} ending in {card.last4}
              </p>

              {!isSetupFlow && (
                <button
                  className="rounded-2xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                  onClick={() => setShowCardForm((prev) => !prev)}
                >
                  {showCardForm ? "Cancel" : "Replace card"}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-sm text-stone-700">No card on file</p>

              <button
                className="rounded-2xl bg-[#263330] px-4 py-2 text-sm font-medium text-white"
                onClick={() => setShowCardForm((prev) => !prev)}
              >
                {showCardForm ? "Cancel" : "Add card"}
              </button>
            </div>
          )}

          {showCardForm ? (
            <div className="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div
                ref={cardContainerRef}
                className="min-h-[120px] rounded-2xl bg-white p-4"
              />

              <button
                type="button"
                onClick={handleSaveCard}
                disabled={savingCard || !squareReady}
                className="rounded-2xl bg-[#263330] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {savingCard
                  ? "Saving..."
                  : isSetupFlow
                  ? "Save card and continue"
                  : "Save card"}
              </button>
            </div>
          ) : null}
        </div>

        {!isSetupFlow && (
          <div className="rounded-3xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-stone-800">
                Payment History
              </h2>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-stone-500">Loading...</div>
            ) : payments.length === 0 ? (
              <div className="p-6 text-sm text-stone-500">No payments yet.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-stone-500">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-stone-100">
                      <td className="px-6 py-4 text-stone-700">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="px-6 py-4 font-medium text-stone-800">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-6 py-4 capitalize text-stone-700">
                        {p.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f4f2ef]">
          <div className="mx-auto max-w-4xl space-y-8 p-6 lg:p-10">
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-stone-500">Loading billing...</p>
            </div>
          </div>
        </main>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}