import { login } from "./actions";
import { PasswordInput } from "@/components/PasswordInput";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "16px",
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 360 }}>
        <h1 style={{ marginBottom: 4 }}>UniSole CRM</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
          Sign in to continue.
        </p>

        {error ? <div className="error-box">{error}</div> : null}

        <form action={login}>
          <div className="field">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              className="input"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">
              Password
            </label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
