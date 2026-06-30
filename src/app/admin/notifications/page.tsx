"use client";

import { useEffect, useState } from "react";
import { Bell, Send, Trash2 } from "lucide-react";
import {
  createNotification,
  createNotificationsForAllMembers,
  deleteNotification,
  getAllNotifications,
  type NotificationRecord,
  type NotificationType,
} from "@/lib/services/notification-service";

type FormState = {
  member_email: string;
  title: string;
  message: string;
  type: NotificationType;
  send_to_all: boolean;
};

const emptyForm: FormState = {
  member_email: "",
  title: "",
  message: "",
  type: "general",
  send_to_all: false,
};

function typeLabel(type: NotificationRecord["type"]) {
  switch (type) {
    case "pickup":
      return "Pickup";
    case "case_update":
      return "Case Update";
    default:
      return "General";
  }
}

function typeStyles(type: NotificationRecord["type"]) {
  switch (type) {
    case "pickup":
      return "bg-green-100 text-green-800";
    case "case_update":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-stone-100 text-stone-700";
  }
}

export default function AdminNotificationsPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");
      const data = await getAllNotifications();
      setNotifications(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSending(true);
      setError("");
      setSuccess("");

      if (!form.title.trim()) {
        setError("Title is required.");
        return;
      }

      if (!form.message.trim()) {
        setError("Message is required.");
        return;
      }

      if (form.send_to_all) {
        const created = await createNotificationsForAllMembers({
          title: form.title.trim(),
          message: form.message.trim(),
          type: form.type,
        });

        setNotifications((prev) => [...created, ...prev]);
        setSuccess(`Sent ${created.length} notification${created.length === 1 ? "" : "s"} to all members.`);
      } else {
        if (!form.member_email.trim()) {
          setError("Member email is required when not sending to all.");
          return;
        }

        const created = await createNotification({
          member_email: form.member_email.trim(),
          title: form.title.trim(),
          message: form.message.trim(),
          type: form.type,
        });

        setNotifications((prev) => [created, ...prev]);
        setSuccess("Notification sent.");
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not send notification.");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Delete this notification?");
    if (!confirmed) return;

    try {
      setDeletingId(id);
      setError("");
      setSuccess("");

      await deleteNotification(id);
      setNotifications((prev) => prev.filter((item) => item.id !== id));
      setSuccess("Notification deleted.");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not delete notification.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
        <div>
          <h1 className="text-3xl font-bold text-stone-800">Notifications</h1>
          <p className="mt-2 text-sm text-stone-500">
            Send updates to individual members or the whole club.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-800">Send Notification</h2>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <label className="flex items-center gap-3 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={form.send_to_all}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      send_to_all: e.target.checked,
                    }))
                  }
                />
                Send to all members
              </label>

              {!form.send_to_all && (
                <input
                  type="email"
                  placeholder="Member email"
                  value={form.member_email}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      member_email: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
                />
              )}

              <select
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value as NotificationType,
                  }))
                }
                className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
              >
                <option value="general">General</option>
                <option value="pickup">Pickup</option>
                <option value="case_update">Case Update</option>
              </select>

              <input
                type="text"
                placeholder="Title"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
              />

              <textarea
                placeholder="Message"
                value={form.message}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    message: e.target.value,
                  }))
                }
                className="h-32 w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm outline-none"
              />

              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#263330] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? "Sending..." : "Send Notification"}
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-800">Recent Notifications</h2>
              <p className="text-sm text-stone-500">
                {notifications.length} total
              </p>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-3xl bg-stone-200" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-16 text-center text-stone-500">
                <Bell className="mx-auto mb-3 h-12 w-12 text-stone-300" />
                <p>No notifications sent yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-3xl border border-stone-200 p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${typeStyles(
                              item.type
                            )}`}
                          >
                            {typeLabel(item.type)}
                          </span>

                          {!item.is_read && (
                            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                              Unread
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 text-lg font-semibold text-stone-800">
                          {item.title}
                        </h3>

                        <p className="mt-1 text-xs text-stone-500">
                          To: {item.member_email}
                        </p>

                        <p className="mt-3 whitespace-pre-wrap text-sm text-stone-600">
                          {item.message}
                        </p>

                        <p className="mt-3 text-xs text-stone-500">
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="inline-flex items-center gap-2 rounded-2xl border border-stone-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}