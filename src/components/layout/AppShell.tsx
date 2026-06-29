"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/providers/AuthProvider";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { USER_ROLES } from "@/lib/constants";

/**
 * AppShell renders the navigation chrome (sidebar on desktop, collapsible top
 * bar on mobile) around every authenticated page.
 *
 * The active page is highlighted by comparing the current pathname against
 * each nav item's href.
 */

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

// Small inline icons keep the bundle light (no icon library needed).
const icons = {
  dashboard: (
    <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
  ),
  projects: <path d="M3 7h18v13H3V7Zm2-4h6l2 2h8v2H3V3Z" />,
  trades: <path d="M14 6l4 4-9 9H5v-4l9-9Zm2-2l2-2 4 4-2 2-4-4Z" />,
  phases: (
    <path d="M9 11l3 3 8-8 1.5 1.5L12 17l-4.5-4.5L9 11ZM3 5h11v2H3V5Zm0 6h5v2H3v-2Zm0 6h5v2H3v-2Z" />
  ),
  contractors: (
    <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5Z" />
  ),
  materials: (
    <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3L18.5 8 12 11.7 5.5 8 12 4.3ZM5 9.7l6 3.4v6.6l-6-3.3V9.7Zm14 0v6.7l-6 3.3v-6.6l6-3.4Z" />
  ),
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <Icon>{icons.dashboard}</Icon>,
  },
  { label: "Projects", href: "/projects", icon: <Icon>{icons.projects}</Icon> },
  { label: "Trades", href: "/trades", icon: <Icon>{icons.trades}</Icon> },
  {
    label: "Trade Phases",
    href: "/trade-phases",
    icon: <Icon>{icons.phases}</Icon>,
  },
  {
    label: "Contractors",
    href: "/contractors",
    icon: <Icon>{icons.contractors}</Icon>,
  },
  {
    label: "Materials",
    href: "/material-orders/new",
    icon: <Icon>{icons.materials}</Icon>,
  },
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { email, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const roleLabel =
    USER_ROLES.find((r) => r.value === role)?.label ?? "Member";

  // A nav link is active when the path matches or is nested under its href.
  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const navLinks = (onClick?: () => void) =>
    NAV_ITEMS.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClick}
        aria-current={isActive(item.href) ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive(item.href)
            ? "bg-brand-50 text-brand-700"
            : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
        )}
      >
        {item.icon}
        {item.label}
      </Link>
    ));

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-shrink-0 border-r border-ink-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-ink-100 px-5">
          <Link href="/dashboard" className="text-lg font-bold text-ink-900">
            TradeFlow
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">{navLinks()}</nav>
        <div className="border-t border-ink-100 p-4">
          <p className="truncate text-sm font-medium text-ink-800">{email}</p>
          <p className="text-xs text-ink-500">{roleLabel}</p>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex h-14 items-center justify-between border-b border-ink-200 bg-white px-4 lg:hidden">
        <Link href="/dashboard" className="text-lg font-bold text-ink-900">
          TradeFlow
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          className="rounded-lg p-2 text-ink-600 hover:bg-ink-100"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <path
              d={mobileOpen ? "M6 6l12 12M6 18L18 6" : "M4 6h16M4 12h16M4 18h16"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <nav className="space-y-1 border-b border-ink-200 bg-white p-3 lg:hidden">
          {navLinks(() => setMobileOpen(false))}
          <div className="mt-2 flex items-center justify-between border-t border-ink-100 px-3 pt-3">
            <div>
              <p className="truncate text-sm font-medium text-ink-800">
                {email}
              </p>
              <p className="text-xs text-ink-500">{roleLabel}</p>
            </div>
            <LogoutButton />
          </div>
        </nav>
      )}

      {/* Page content */}
      <main className="flex-1 bg-ink-50">{children}</main>
    </div>
  );
}
