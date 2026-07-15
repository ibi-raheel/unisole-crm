"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import {
  IconDashboard,
  IconTruck,
  IconBox,
  IconUsers,
  IconShield,
  IconActivity,
  IconLogout,
} from "@/components/icons";

type NavItem = { href: string; label: string; icon: string };

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  dashboard: IconDashboard,
  truck: IconTruck,
  box: IconBox,
  users: IconUsers,
  shield: IconShield,
  activity: IconActivity,
};

export function Sidebar({
  items,
  roleLabel,
  email,
}: {
  items: NavItem[];
  roleLabel: string;
  email: string;
}) {
  const pathname = usePathname();
  const initial = (email || "?").charAt(0).toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo" />
        <span className="sidebar-brand-text">UniSole</span>
      </div>

      <nav className="sidebar-nav">
        {items.map((i) => {
          const active = pathname === i.href || pathname.startsWith(i.href + "/");
          const Icon = ICONS[i.icon] ?? IconDashboard;
          return (
            <Link key={i.href} href={i.href} className={`side-link${active ? " active" : ""}`}>
              <Icon size={19} className="side-icon" />
              <span>{i.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <div className="side-user">
          <span className="side-avatar">{initial}</span>
          <span className="side-user-meta">
            <span className="side-role">{roleLabel}</span>
            <span className="side-email" title={email}>{email}</span>
          </span>
        </div>
        <form action={logout}>
          <button type="submit" className="side-signout">
            <IconLogout size={17} />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
