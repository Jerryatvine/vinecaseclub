export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f4f2ef] px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-stone-800">
              Payment Authorization Terms
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              By saving a payment method with Vine and Table, you agree to the
              following payment authorization terms.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-800">
              1. Authorization to Store Payment Method
            </h2>
            <p className="text-sm leading-6 text-stone-700">
              You authorize Vine and Table to securely store your payment method
              through our payment processor, Square, for use in connection with
              your wine club membership and related purchases.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-800">
              2. Authorization to Charge Your Card
            </h2>
            <p className="text-sm leading-6 text-stone-700">
              You authorize Vine and Table to charge your saved payment method
              for wine club purchases when applicable, including charges related
              to your finalized wine case.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-800">
              3. Variable Charge Amounts
            </h2>
            <p className="text-sm leading-6 text-stone-700">
              You understand that your final charge amount may vary based on the
              wines included in your case, any customization you make, bottle
              quantities, pricing changes permitted by the club, and other
              applicable purchase details.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-800">
              4. Timing of Charges
            </h2>
            <p className="text-sm leading-6 text-stone-700">
              Saving a card does not mean you will be charged immediately. Your
              card may be charged later, after your case is finalized or when a
              club-related purchase is otherwise due.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-800">
              5. Pickup and Age Verification
            </h2>
            <p className="text-sm leading-6 text-stone-700">
              Wine purchases require valid government-issued identification at
              pickup. You must be at least 21 years old to receive alcoholic
              products. Vine and Table reserves the right to refuse pickup or
              release of alcohol if age verification cannot be completed.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-800">
              6. Refunds and Disputes
            </h2>
            <p className="text-sm leading-6 text-stone-700">
              If you believe a charge was made in error, please contact Vine and
              Table promptly so the issue can be reviewed. Refunds, credits, and
              billing adjustments are handled at Vine and Table&apos;s discretion
              and according to applicable law and store policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-800">
              7. Payment Processor
            </h2>
            <p className="text-sm leading-6 text-stone-700">
              Payment information is collected and processed securely by Square.
              Vine and Table does not directly store your full card number in
              this application.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-800">
              8. Agreement
            </h2>
            <p className="text-sm leading-6 text-stone-700">
              By checking the authorization box and saving your payment method,
              you confirm that you are the authorized cardholder or have
              authority to use the payment method provided, and you agree to
              these Payment Authorization Terms.
            </p>
          </section>

          <div className="border-t border-stone-200 pt-6">
            <p className="text-xs leading-5 text-stone-500">
              These terms are provided for operational purposes and should be
              reviewed with legal counsel before full public launch, especially
              for alcohol sales, payment authorization language, pickup policy,
              and local compliance requirements.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}