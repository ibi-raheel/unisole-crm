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

  const role = profile.role;
  const items: { href: string; label: string; icon: string; badge?: number }[] = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/carriers", label: "Carriers", icon: "truck" },
  ];
  if (role === "dispatcher" || role === "dispatch_head" || role === "admin") {
    items.push({ href: "/loads", label: "Loads", icon: "box" });
  }
  if (role === "admin" || role === "sales_head") {
    items.push({ href: "/leads/import", label: "Import", icon: "inbox" });
  }
  if (role === "admin" || role === "sales_head" || role === "dispatch_head") {
    items.push({ href: "/activity", label: "Activity", icon: "activity" });
  }
  if (role === "admin") {
    items.push({ href: "/team", label: "Team", icon: "users" });
    items.push({ href: "/admin", label: "Admin", icon: "shield" });
  }

  const roleLabels: Record<string, string> = {
    sales_agent: "Sales agent",
    dispatcher: "Dispatcher",
    sales_head: "Sales head",
    dispatch_head: "Dispatch head",
    admin: "Admin",
    system: "System",
  };
  const roleLabel = roleLabels[role] ?? role;

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
