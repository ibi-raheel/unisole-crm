import { requireProfile } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { TopNav } from "@/components/TopNav";

// Every signed-in page shows per-user data behind row-level security, so it
// must render fresh on every request and never be cached/shared between users.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  const items = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/carriers", label: "Carriers" },
  ];
  if (profile.role === "dispatcher" || profile.role === "admin") {
    items.push({ href: "/loads", label: "Loads" });
  }
  if (profile.role === "admin") {
    items.push({ href: "/admin", label: "Admin" });
  }

  const roleLabel =
    profile.role === "sales_agent"
      ? "Sales agent"
      : profile.role === "dispatcher"
        ? "Dispatcher"
        : profile.role === "admin"
          ? "Admin"
          : profile.role;

  return (
    <>
      <header className="topbar">
        <span className="brand">UniSole</span>
        <TopNav items={items} />
        <div className="user">
          <span title={profile.email ?? ""}>{roleLabel}</span>
          <form action={logout}>
            <button
              className="btn"
              style={{
                padding: "4px 10px",
                background: "transparent",
                color: "#fff",
                borderColor: "rgba(255,255,255,0.35)",
              }}
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
