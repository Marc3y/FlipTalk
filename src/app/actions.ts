"use server";
import { signIn, signOut } from "@/auth";
import { isMockAuth } from "@/lib/server/env";

/** Only same-site paths, so the redirect can't be abused as an open redirect. */
function safePath(path: FormDataEntryValue | null) {
  const p = typeof path === "string" ? path : "/";
  return p.startsWith("/") && !p.startsWith("//") ? p : "/";
}

export async function signInWithTwitch(formData: FormData) {
  await signIn("twitch", { redirectTo: safePath(formData.get("redirectTo")) });
}

export async function signInMock(formData: FormData) {
  if (!isMockAuth) throw new Error("Mock login is disabled");
  await signIn("mock", {
    username: String(formData.get("username") ?? ""),
    redirectTo: safePath(formData.get("redirectTo")),
  });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
