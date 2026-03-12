import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isLoginPage = pathname === "/login";
  const isSignupPage = pathname === "/signup";
  const isPublicRoute = isLoginPage || isSignupPage;
  const isAdminRoute = pathname.startsWith("/admin");

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user && isAdminRoute) {
    let role: "admin" | "member" | null = null;

    const { data: memberByUserId } = await supabase
      .from("members")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      memberByUserId?.role === "admin" ||
      memberByUserId?.role === "member"
    ) {
      role = memberByUserId.role;
    }

    if (!role && user.email) {
      const { data: memberByEmail } = await supabase
        .from("members")
        .select("role")
        .eq("email", user.email)
        .maybeSingle();

      if (
        memberByEmail?.role === "admin" ||
        memberByEmail?.role === "member"
      ) {
        role = memberByEmail.role;
      }
    }

    if (role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};