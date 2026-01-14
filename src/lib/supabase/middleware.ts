import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log('Middleware Path:', request.nextUrl.pathname);
  console.log('Middleware User:', user?.id || 'No User');

  const path = request.nextUrl.pathname;

  // Define public routes that can be accessed without authentication
  const isPublicRoute = 
    path.startsWith("/login") || 
    path.startsWith("/auth");

  if (user) {
    // If user is logged in and trying to access login page or root, redirect to dashboard
    if (path.startsWith("/login") || path === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      const redirectResponse = NextResponse.redirect(url);
      
      // Preserve cookies from supabaseResponse
      const cookies = response.cookies.getAll();
      cookies.forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      
      return redirectResponse;
    }
  } else {
    // If user is NOT logged in and trying to access a protected route
    if (!isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const redirectResponse = NextResponse.redirect(url);
      
      // Preserve cookies (e.g. for clearing them if needed)
      const cookies = response.cookies.getAll();
      cookies.forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });

      return redirectResponse;
    }
  }

  return response;
}
