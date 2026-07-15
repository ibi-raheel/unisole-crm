import { requireProfile } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { PresenceTracker } from "@/components/PresenceTracker";

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

  const items: { href: string; label: string; icon: string }[] = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/carriers", label: "Carriers", icon: "truck" },
  ];
  if (profile.role === "dispatcher" || profile.role === "admin") {
    items.push({ href: "/loads", label: "Loads", icon: "box" });
  }
  if (profile.role === "admin") {
    items.push({ href: "/team", label: "Team", icon: "users" });
    items.push({ href: "/activity", label: "Activity", icon: "activity" });
    items.push({ href: "/admin", label: "Admin", icon: "shield" });
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
    <div className="app-shell">
      <PresenceTracker />
      <Sidebar items={items} roleLabel={roleLabel} email={profile.email ?? ""} />
      <div className="app-main">
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
