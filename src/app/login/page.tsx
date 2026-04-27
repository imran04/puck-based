import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  fetchStudioSession,
  sanitizeNextPath,
  STUDIO_SESSION_COOKIE,
} from "@/lib/studio-auth";

export const dynamic = "force-dynamic";

function asString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(asString(params.next));
  const errorCode = asString(params.error);

  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get(STUDIO_SESSION_COOKIE)?.value?.trim() ||
    cookieStore.get("builder_token")?.value?.trim() ||
    null;
  const session = await fetchStudioSession(sessionToken);

  if (session.authenticated) {
    redirect(nextPath === "/login" ? "/" : nextPath);
  }

  return (
    <main className="studio-login">
      <section className="studio-login__panel">
        <div className="studio-login__intro">
          <p className="studio-kicker">Puck Studio</p>
          <h1>Author and editor login</h1>
          <p>Sign in to manage pages, forms, tables, and publishing tools.</p>
        </div>

        {!session.reachable ? (
          <div className="studio-login__notice studio-login__notice--warn">
            <strong>Authentication service is unavailable</strong>
            <p>
              The admin API could not be reached. Start the ASP.NET Builder API and
              reload this page.
            </p>
          </div>
        ) : !session.authEnabled ? (
          <div className="studio-login__notice studio-login__notice--warn">
            <strong>Authentication is disabled</strong>
            <p>
              No admin credentials are configured on the ASP.NET API. Set BuilderAuth
              users to enable login protection.
            </p>
          </div>
        ) : (
          <form action="/api/auth/login" className="studio-login__form" method="post">
            <input name="next" type="hidden" value={nextPath} />
            <label>
              Username
              <input autoComplete="username" name="username" required type="text" />
            </label>
            <label>
              Password
              <input autoComplete="current-password" name="password" required type="password" />
            </label>
            <button type="submit">Sign in</button>
          </form>
        )}

        {errorCode === "invalid" ? (
          <div className="studio-login__notice studio-login__notice--error">
            Invalid username or password.
          </div>
        ) : null}
        {errorCode === "service" ? (
          <div className="studio-login__notice studio-login__notice--error">
            Authentication service is unavailable.
          </div>
        ) : null}
        {errorCode === "failed" ? (
          <div className="studio-login__notice studio-login__notice--error">
            Login failed. Check server configuration and try again.
          </div>
        ) : null}
      </section>
    </main>
  );
}
