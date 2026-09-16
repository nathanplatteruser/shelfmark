import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Bookmark,
  Clapperboard,
  Coins,
  Crosshair,
  Keyboard,
  Layers,
  LayoutGrid,
  Link2,
  Package,
  ScanBarcode,
  Share2,
  Ship,
  Users,
  Waypoints,
} from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { cn } from "@/lib/utils";

const KID_NAV = [
  { to: "/", label: "Shop", icon: ScanBarcode },
  { to: "/hunt", label: "Hunt", icon: Crosshair },
  { to: "/pile", label: "Pile", icon: BookOpen },
  { to: "/jar", label: "Jar", icon: Coins },
  { to: "/story", label: "Story", icon: Bookmark },
] as const;

const GROWN_NAV = [
  { to: "/desk", label: "Desk", icon: Keyboard },
  { to: "/connect", label: "Connect", icon: Link2 },
  { to: "/reel", label: "Reel", icon: Clapperboard },
  { to: "/inventory", label: "Inventory", icon: LayoutGrid },
  { to: "/listings", label: "Listings", icon: BookOpen },
  { to: "/channels", label: "Channels", icon: Share2 },
  { to: "/ship", label: "Ship", icon: Ship },
  { to: "/analytics", label: "Numbers", icon: Waypoints },
  { to: "/crew", label: "Crew", icon: Users },
  { to: "/playbook", label: "Playbook", icon: Package },
  { to: "/looks", label: "Looks", icon: Layers },
] as const;

const NAV = [...KID_NAV, ...GROWN_NAV];

export function AppShell({
  children,
  listedToday,
  goal,
}: {
  children: ReactNode;
  listedToday?: number;
  goal?: number;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-svh bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-sm bg-cloth text-cloth-fg"
            >
              <span className="font-display text-[11px] font-semibold tracking-[0.18em]">SM</span>
            </span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-semibold tracking-tight">Shelfmark</span>
              <span className="hidden text-[11px] uppercase tracking-[0.22em] text-muted sm:block">
                The tag is not the jar
              </span>
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-0.5 overflow-x-auto lg:flex">
            {KID_NAV.map((item) => (
              <NavLink key={item.to} item={item} pathname={pathname} strong />
            ))}
            <span aria-hidden className="mx-2 h-5 w-px bg-rule" />
            {GROWN_NAV.map((item) => (
              <NavLink key={item.to} item={item} pathname={pathname} />
            ))}
          </nav>
          {typeof listedToday === "number" && (
            <div className="hidden items-baseline gap-2 border-l border-rule pl-4 lg:flex">
              <span className="font-display text-2xl font-semibold tabular-nums leading-none">
                {listedToday}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-muted">/ {goal ?? 100} today</span>
            </div>
          )}
          <div className="hidden lg:block">
            <UserButton />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-rule px-2 py-2 lg:hidden">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                data-tour={`nav-${item.label.toLowerCase()}`}
                className={cn(
                  "flex min-w-[4.5rem] flex-col items-center gap-1 rounded-md px-2 py-1 text-[11px] no-underline",
                  active ? "bg-cloth text-cloth-fg" : "text-muted",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 pb-24 md:px-6 md:py-8 md:pb-28">{children}</div>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  strong,
}: {
  item: (typeof NAV)[number];
  pathname: string;
  strong?: boolean;
}) {
  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      data-tour={`nav-${item.label.toLowerCase()}`}
      className={cn(
        "flex h-10 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm no-underline transition-colors duration-150",
        active ? "bg-cloth text-cloth-fg" : strong ? "text-ink hover:bg-elevated" : "text-muted hover:bg-elevated hover:text-ink",
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
      {item.label}
    </Link>
  );
}
