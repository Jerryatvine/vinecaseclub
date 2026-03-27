"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PaymentMethodOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    async function redirectToBillingSetup() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const { data: memberByUserId, error: memberByUserIdError } =
          await supabase
            .from("members")
            .select("square_card_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (memberByUserIdError) {
          console.error(
            "Failed to check member billing setup by user_id:",
            memberByUserIdError
          );
        }

        if (memberByUserId?.square_card_id) {
          router.replace("/");
          return;
        }

        if (user.email) {
          const { data: memberByEmail, error: memberByEmailError } =
            await supabase
              .from("members")
              .select("square_card_id")
              .eq("email", user.email)
              .maybeSingle();

          if (memberByEmailError) {
            console.error(
              "Failed to check member billing setup by email:",
              memberByEmailError
            );
          }

          if (memberByEmail?.square_card_id) {
            router.replace("/");
            return;
          }
        }

        if (!mounted) return;

        router.replace("/account/billing?setup=1");
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        router.replace("/account/billing?setup=1");
      }
    }

    redirectToBillingSetup();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  return (
    <main className="min-h-screen bg-[#f4f2ef] px-6 py-10 text-stone-900">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-stone-800">
            Redirecting to payment setup...
          </h1>

          <p className="mt-3 text-sm leading-6 text-stone-600">
            Please wait while we open your secure billing setup page.
          </p>
        </div>
      </div>
    </main>
  );
}