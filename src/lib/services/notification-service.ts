import { createClient } from "@/lib/supabase/client";

export type NotificationType = "general" | "pickup" | "case_update";

export type NotificationRecord = {
  id: string;
  member_email: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
};

type NotificationInput = {
  member_email: string;
  title: string;
  message: string;
  type?: NotificationType;
};

type NotificationRow = {
  id: string;
  member_email: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_date: string;
};

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return [
      maybeError.message ? `message: ${maybeError.message}` : null,
      maybeError.details ? `details: ${maybeError.details}` : null,
      maybeError.hint ? `hint: ${maybeError.hint}` : null,
      maybeError.code ? `code: ${maybeError.code}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function logSupabaseError(label: string, error: unknown) {
  console.error(label, getErrorMessage(error), error);
}

function normalizeNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    member_email: row.member_email,
    title: row.title,
    message: row.message,
    type: row.type,
    is_read: row.is_read,
    created_at: row.created_date,
  };
}

export async function getMyNotifications() {
  const supabase = createClient();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    logSupabaseError("Error loading session:", sessionError);
    throw new Error(getErrorMessage(sessionError));
  }

  const email = session?.user?.email;
  if (!email) {
    return [];
  }

  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
        id,
        member_email,
        title,
        message,
        type,
        is_read,
        created_date
      `
    )
    .eq("member_email", email)
    .order("created_date", { ascending: false });

  if (error) {
    logSupabaseError("Error loading notifications:", error);
    throw new Error(getErrorMessage(error));
  }

  return ((data ?? []) as NotificationRow[]).map(normalizeNotification);
}

export async function getUserNotifications() {
  return getMyNotifications();
}

export async function getAllNotifications() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
        id,
        member_email,
        title,
        message,
        type,
        is_read,
        created_date
      `
    )
    .order("created_date", { ascending: false });

  if (error) {
    logSupabaseError("Error loading all notifications:", error);
    throw new Error(getErrorMessage(error));
  }

  return ((data ?? []) as NotificationRow[]).map(normalizeNotification);
}

export async function createNotification(input: NotificationInput) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notifications")
    .insert([
      {
        member_email: input.member_email,
        title: input.title,
        message: input.message,
        type: input.type ?? "general",
      },
    ])
    .select(
      `
        id,
        member_email,
        title,
        message,
        type,
        is_read,
        created_date
      `
    )
    .single();

  if (error) {
    logSupabaseError("Error creating notification:", error);
    throw new Error(getErrorMessage(error));
  }

  return normalizeNotification(data as NotificationRow);
}

export async function createNotificationsForAllMembers(input: {
  title: string;
  message: string;
  type?: NotificationType;
}) {
  const supabase = createClient();

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("email, user_id")
    .not("user_id", "is", null);

  if (membersError) {
    logSupabaseError("Error loading members:", membersError);
    throw new Error(getErrorMessage(membersError));
  }

  const emails = Array.from(
    new Set(
      (members ?? [])
        .map((member) => member.email)
        .filter((email): email is string => Boolean(email))
    )
  );

  if (emails.length === 0) {
    return [];
  }

  const payload = emails.map((email) => ({
    member_email: email,
    title: input.title,
    message: input.message,
    type: input.type ?? "general",
  }));

  const { data, error } = await supabase
    .from("notifications")
    .insert(payload)
    .select(
      `
        id,
        member_email,
        title,
        message,
        type,
        is_read,
        created_date
      `
    );

  if (error) {
    logSupabaseError("Error creating notifications for all members:", error);
    throw new Error(getErrorMessage(error));
  }

  return ((data ?? []) as NotificationRow[]).map(normalizeNotification);
}

export async function markNotificationAsRead(id: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .select(
      `
        id,
        member_email,
        title,
        message,
        type,
        is_read,
        created_date
      `
    )
    .single();

  if (error) {
    logSupabaseError("Error marking notification as read:", error);
    throw new Error(getErrorMessage(error));
  }

  return normalizeNotification(data as NotificationRow);
}

export async function deleteNotification(id: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id);

  if (error) {
    logSupabaseError("Error deleting notification:", error);
    throw new Error(getErrorMessage(error));
  }

  return true;
}