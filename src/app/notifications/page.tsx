"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Bell, Check, Inbox, MailOpen, RotateCcw } from "lucide-react";
import {
  archiveNotification,
  getMyNotifications,
  markNotificationAsRead,
  unarchiveNotification,
  type NotificationRecord,
} from "@/lib/services/notification-service";

type NotificationView = "active" | "archived";

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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [view, setView] = useState<NotificationView>("active");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadNotifications() {
      try {
        setLoading(true);
        setError("");

        const data = await getMyNotifications({
          archived: view === "archived",
        });

        setNotifications(data);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Could not load notifications."
        );
      } finally {
        setLoading(false);
      }
    }

    loadNotifications();
  }, [view]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  async function handleMarkRead(id: string) {
    try {
      setMarkingId(id);
      setError("");

      const updated = await markNotificationAsRead(id);

      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not mark notification as read."
      );
    } finally {
      setMarkingId(null);
    }
  }

  async function handleArchive(id: string) {
    try {
      setArchivingId(id);
      setError("");

      await archiveNotification(id);
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Could not archive notification."
      );
    } finally {
      setArchivingId(null);
    }
  }

  async function handleUnarchive(id: string) {
    try {
      setUnarchivingId(id);
      setError("");

      await unarchiveNotification(id);
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Could not restore notification."
      );
    } finally {
      setUnarchivingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f2ef]">
        <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-10">
          <div className="h-10 w-48 animate-pulse rounded-2xl bg-stone-200" />
          <div className="h-12 w-64 animate-pulse rounded-2xl bg-stone-200" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-3xl bg-stone-200"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  const emptyMessage =
    view === "active"
      ? "You do not have any active notifications."
      : "You do not have any archived notifications.";

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-4xl space-y-8 p-6 lg:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-stone-800">Notifications</h1>
            <p className="mt-2 text-sm text-stone-500">
              Stay up to date with case and pickup updates.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 shadow-sm">
            {unreadCount} unread
          </div>
        </div>

        <div className="inline-flex rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setView("active")}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              view === "active"
                ? "bg-[#263330] text-white"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setView("archived")}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              view === "archived"
                ? "bg-[#263330] text-white"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            Archived
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="rounded-3xl border border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
            <Bell className="mx-auto mb-4 h-12 w-12 text-stone-300" />
            <p className="text-stone-500">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((item) => {
              const isMarking = markingId === item.id;
              const isArchiving = archivingId === item.id;
              const isUnarchiving = unarchivingId === item.id;
              const isBusy = isMarking || isArchiving || isUnarchiving;

              return (
                <div
                  key={item.id}
                  className={`rounded-3xl border bg-white p-5 shadow-sm ${
                    item.is_read
                      ? "border-stone-200"
                      : "border-emerald-200 ring-1 ring-emerald-100"
                  }`}
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
                          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                            New
                          </span>
                        )}

                        {item.is_archived && (
                          <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                            Archived
                          </span>
                        )}
                      </div>

                      <h2 className="mt-3 text-lg font-semibold text-stone-800">
                        {item.title}
                      </h2>

                      <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">
                        {item.message}
                      </p>

                      <p className="mt-3 text-xs text-stone-500">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      {!item.is_read && view === "active" && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(item.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 rounded-2xl bg-[#263330] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                          {isMarking ? "Marking..." : "Mark as Read"}
                        </button>
                      )}

                      {item.is_read && (
                        <span className="inline-flex items-center gap-2 rounded-2xl bg-stone-100 px-4 py-2 text-sm text-stone-600">
                          <MailOpen className="h-4 w-4" />
                          Read
                        </span>
                      )}

                      {view === "active" ? (
                        <button
                          type="button"
                          onClick={() => handleArchive(item.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 rounded-2xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                        >
                          <Archive className="h-4 w-4" />
                          {isArchiving ? "Archiving..." : "Archive"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUnarchive(item.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 rounded-2xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {isUnarchiving ? "Restoring..." : "Restore to Inbox"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600 shadow-sm">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Active notifications stay in your inbox. Archived notifications can
            be viewed anytime in the Archived tab.
          </div>
        </div>
      </div>
    </main>
  );
}