// Android app from Google Play (android/README.md): a Trusted Web Activity that opens the site. Google's payments policy
// does not allow an app to sell digital services past Play Billing, so inside the app nothing can be bought or changed:
// the plan page only shows the current plan. The app starts at /konto?quelle=app; that sets a session cookie.
const COOKIE = "jv_app";

/** Start of the app: remember "inside the Android app" for this browser session and go on without the parameter. */
export function appStart(request: Request): Response | null {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.searchParams.get("quelle") !== "app") return null;
  url.searchParams.delete("quelle");
  return new Response(null, { status: 302, headers: { location: url.pathname + url.search, "set-cookie": `${COOKIE}=1; Path=/; Secure; SameSite=Lax`, "cache-control": "no-store" } });
}

/** True inside the Android app (session cookie from the app start, or the app as referrer of the first page). */
export function inAndroidApp(request: Request): boolean {
  return /(?:^|;\s*)jv_app=1(?:;|$)/.test(request.headers.get("cookie") ?? "") || (request.headers.get("referer") ?? "").startsWith("android-app://eu.crewtender.app");
}

export const APP_KAUF_HINWEIS = "In der Android-App lassen sich Pläne nicht buchen oder ändern.";
