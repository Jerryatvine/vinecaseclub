export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f4f2ef] px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6 rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-stone-800">
          Terms & Conditions
        </h1>

        <p className="text-sm text-stone-500">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="space-y-3 text-sm text-stone-700">
          <h2 className="text-lg font-semibold text-stone-800">
            1. Orders & Payments
          </h2>
          <p>
            All purchases are processed securely through Square. By placing an
            order, you agree to pay the total amount shown at checkout.
          </p>
        </section>

        <section className="space-y-3 text-sm text-stone-700">
          <h2 className="text-lg font-semibold text-stone-800">
            2. Case Customization
          </h2>
          <p>
            Members may customize their wine case prior to the stated deadline.
            Once finalized, changes are not guaranteed.
          </p>
        </section>

        <section className="space-y-3 text-sm text-stone-700">
          <h2 className="text-lg font-semibold text-stone-800">
            3. Refunds & Returns
          </h2>
          <p>
            All sales are final after pickup. Any issues will be handled on a
            case-by-case basis at our discretion.
          </p>
        </section>

        <section className="space-y-3 text-sm text-stone-700">
          <h2 className="text-lg font-semibold text-stone-800">
            4. Pickup Policy
          </h2>
          <p>
            Orders are for local pickup only. Valid ID is required, and customers
            must be 21 years or older to receive wine.
          </p>
        </section>

        <section className="space-y-3 text-sm text-stone-700">
          <h2 className="text-lg font-semibold text-stone-800">
            5. Alcohol Compliance
          </h2>
          <p>
            We reserve the right to refuse service if age verification cannot be
            completed or if a customer appears intoxicated.
          </p>
        </section>

        <section className="space-y-3 text-sm text-stone-700">
          <h2 className="text-lg font-semibold text-stone-800">
            6. Liability
          </h2>
          <p>
            We are not responsible for delays, inventory substitutions, or
            vintage variations.
          </p>
        </section>

        <section className="space-y-3 text-sm text-stone-700">
          <h2 className="text-lg font-semibold text-stone-800">
            7. Account Responsibility
          </h2>
          <p>
            You are responsible for maintaining the confidentiality of your
            account and ensuring your information is accurate.
          </p>
        </section>
      </div>
    </main>
  );
}