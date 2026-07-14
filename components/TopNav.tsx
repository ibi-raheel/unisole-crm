"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TopNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav>
      {items.map((i) => {
        const active =
          pathname === i.href || pathname.startsWith(i.href + "/");
        return (
          <Link key={i.href} href={i.href} className={active ? "active" : ""}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
