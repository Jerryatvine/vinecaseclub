import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type PaymentRow = {
  id: string;
  member_id: string;
  case_id: string;
  amount: number;
  square_payment_id: string;
  status: "paid" | "failed" | "refunded" | string;
  created_at: string;
  members:
    | {
        email: string | null;
      }
    | {
        email: string | null;
      }[]
    | null;
  cases:
    | {
        id: string;
        quarter?: string | null;
        title?: string | null;
      }
    | {
        id: string;
        quarter?: string | null;
        title?: string | null;
      }[]
    | null;
};

function formatCurrencyFromCents(amount: number | null | undefined) {
  const cents = Number(amount ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "—";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getJoinedRow<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function getStatusClasses(status: string) {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700";
    case "failed":
      return "bg-red-100 text-red-700";
    case "refunded":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-stone-100 text-stone-700";
  }
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ member?: string }>;
}) {
  const supabase = await createClient();
  const resolvedSearchParams = (await searchParams) ?? {};
  const memberFilter = resolvedSearchParams.member?.trim() ?? "";

  let query = supabase
    .from("payments")
    .select(
      `
        id,
        member_id,
        case_id,
        amount,
        square_payment_id,
        status,
        created_at,
        members (
          email
        ),
        cases (
          id,
          quarter,
          title
        )
      `
    )
    .order("created_at", { ascending: false });

  const { data, error } = await query;

  const payments = ((data ?? []) as PaymentRow[])
    .map((payment) => {
      const member = getJoinedRow(payment.members);
      const caseRow = getJoinedRow(payment.cases);

      return {
        ...payment,
        member,
        caseRow,
      };
    })
    .filter((payment) => {
      if (!memberFilter) return true;

      const email = payment.member?.email?.toLowerCase() ?? "";
      return email.includes(memberFilter.toLowerCase());
    });

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3">
              <Link
                href="/admin"
                className="text-sm font-medium text-stone-500 transition hover:text-stone-800"
              >
                ← Back to Admin Dashboard
              </Link>
            </div>

            <h1 className="text-3xl font-bold text-stone-800">Payments</h1>
            <p className="mt-2 text-sm text-stone-500">
              View all successful and future payment records for member cases.
            </p>
          </div>

          <form className="flex w-full max-w-md gap-2" action="/admin/payments">
            <input
              type="text"
              name="member"
              defaultValue={memberFilter}
              placeholder="Filter by member email"
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 outline-none ring-0 placeholder:text-stone-400 focus:border-stone-500"
            />
            <button
              type="submit"
              className="rounded-2xl bg-stone-800 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              Search
            </button>
          </form>
        </div>

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            Failed to load payments: {error.message}
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-stone-500">
                  {memberFilter
                    ? `Showing ${payments.length} payment record${
                        payments.length === 1 ? "" : "s"
                      } for "${memberFilter}".`
                    : `Showing ${payments.length} payment record${
                        payments.length === 1 ? "" : "s"
                      }.`}
                </p>

                {memberFilter ? (
                  <Link
                    href="/admin/payments"
                    className="text-sm font-medium text-stone-600 transition hover:text-stone-800"
                  >
                    Clear filter
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-200">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Member
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Case
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Square Payment ID
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-stone-100">
                    {payments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-10 text-center text-sm text-stone-500"
                        >
                          No payments found.
                        </td>
                      </tr>
                    ) : (
                      payments.map((payment) => {
                        const memberEmail = payment.member?.email || "—";

                        const caseLabel =
                          payment.caseRow?.title?.trim() ||
                          payment.caseRow?.quarter?.trim() ||
                          payment.case_id;

                        return (
                          <tr key={payment.id} className="hover:bg-stone-50/60">
                            <td className="px-4 py-4 text-sm text-stone-700">
                              {formatDate(payment.created_at)}
                            </td>

                            <td className="px-4 py-4">
                              <div className="text-sm font-medium text-stone-800">
                                {memberEmail}
                              </div>
                            </td>

                            <td className="px-4 py-4 text-sm text-stone-700">
                              {caseLabel}
                            </td>

                            <td className="px-4 py-4 text-sm font-medium text-stone-800">
                              {formatCurrencyFromCents(payment.amount)}
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                                  payment.status
                                )}`}
                              >
                                {payment.status}
                              </span>
                            </td>

                            <td className="px-4 py-4 text-xs text-stone-500">
                              <span className="break-all">
                                {payment.square_payment_id}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}