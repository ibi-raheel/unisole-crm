import { login } from "./actions";
import { PasswordInput } from "@/components/PasswordInput";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo" />
          <span>UniSole <b>CRM</b></span>
        </div>

        <h1 className="login-title">Welcome back</h1>
        <p className="login-sub">Sign in to your dispatch workspace.</p>

        {error ? <div className="error-box">{error}</div> : null}

        <form action={login}>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
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
            <label className="label" htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" style={{ width: "100%", marginTop: 4 }}>
            Sign in
          </button>
        </form>

        <p className="login-foot">Protected by database-level access control.</p>
      </div>
    </div>
  );
}
