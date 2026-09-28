import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Twitch from "next-auth/providers/twitch";
import { hasTwitch, isMockAuth, isProd } from "@/lib/server/env";

const providers: Provider[] = [];

// Reads AUTH_TWITCH_ID / AUTH_TWITCH_SECRET automatically. Only the `openid` scope: we need the
// Twitch id, display name and avatar, not the email the provider asks for by default.
if (hasTwitch && !isMockAuth) {
  providers.push(Twitch({ authorization: { params: { scope: "openid" } } }));
}

if (isMockAuth) {
  providers.push(
    Credentials({
      id: "mock",
      name: "Dev login",
      credentials: { username: { label: "Username" } },
      authorize(credentials) {
        const username = String(credentials?.username ?? "").trim();
        if (!/^[a-zA-Z0-9_]{2,25}$/.test(username)) return null;
        return { id: `mock:${username.toLowerCase()}`, name: username, image: null };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  // A fixed secret is fine locally; production must set AUTH_SECRET (Auth.js refuses to start otherwise).
  secret: process.env.AUTH_SECRET || (isProd ? undefined : "fliptalk-local-dev-secret-do-not-use-in-prod"),
  trustHost: true,
  pages: { signIn: "/" },
  callbacks: {
    jwt({ token, user, account }) {
      if (account && user) {
        // Auth.js gives OAuth users a random `user.id`; the stable Twitch user id is providerAccountId.
        token.uid = account.provider === "mock" ? user.id! : `twitch:${account.providerAccountId}`;
        token.name = user.name;
        token.picture = user.image;
      }
      delete token.email; // never kept, even if a provider sends one
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      return session;
    },
  },
});
