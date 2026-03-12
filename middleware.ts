  import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/signup"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
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
  const isAdminRoute = pathname.startsWith("/admin");
  const isProtectedRoute =
    pathname === "/" ||
    pathname.startsWith("/my-case") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/rate-wines") ||
    isAdminRoute;

  if (!user && isProtectedRoute && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
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
      const homeUrl = new URL("/", request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/my-case/:path*",
    "/notifications/:path*",
    "/rate-wines/:path*",
    "/admin/:path*",
  ],
};