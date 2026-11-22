import { Award } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "./breadcrumbs";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { NotificationBell } from "./notification-bell";
import { ProfileMenu } from "./profile-menu";
import type { ShellNav } from "./shell-nav";

type NavbarProps = {
  username: string;
  avatarUrl?: string | null;
  roleLabel: string;
  isAdmin: boolean;
  nav: ShellNav;
  unreadCount: number;
  showBell: boolean;
};

/** Eski arayüzdeki `Navbar` / `LeaderNavbar` karşılığı: yapışkan üst çubuk + kırıntı satırı. */
export function Navbar({ username, avatarUrl = null, roleLabel, isAdmin, nav, unreadCount, showBell }: NavbarProps) {
  const leader = nav.variant === "leader";
  const accent = nav.modules[0]?.accent ?? "blue";
  const linkable = [...nav.modules.flatMap((g) => g.items.map((i) => i.href)), ...nav.general.map((i) => i.href)];

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm">
      <div className="relative border-b border-slate-800">
        <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {leader ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
                <Award aria-hidden="true" className="h-5 w-5 text-white" />
              </span>
            ) : (
              // Logo görseli beyaz zeminli ve geniştir: yalnızca sol baştaki işaret kırpılarak gösterilir.
              <span className="h-9 w-9 overflow-hidden rounded-lg bg-white">
                <Image
                  src="/eventflowprologo.png"
                  alt=""
                  width={96}
                  height={36}
                  unoptimized
                  className="-ml-[3px] h-9 max-w-none"
                />
              </span>
            )}
            <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-xl font-bold text-transparent">
              {leader ? "EventFlow" : "EventFlow PRO"}
            </span>
            {leader && (
              <span className="hidden rounded-full border border-cyan-500/30 bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-400 sm:inline">
                Takım Lideri
              </span>
            )}
          </Link>

          <NavLinks modules={nav.modules} />

          <div className="flex shrink-0 items-center gap-2">
            {showBell && <NotificationBell unread={unreadCount} />}
            <div className="hidden md:block">
              <ProfileMenu
                username={username}
                avatarUrl={avatarUrl}
                roleLabel={roleLabel}
                isAdmin={isAdmin}
                modules={nav.modules}
                general={nav.general}
                accent={accent}
              />
            </div>
            <MobileMenu
              username={username}
              avatarUrl={avatarUrl}
              roleLabel={roleLabel}
              modules={nav.modules}
              general={nav.general}
            />
          </div>
        </div>
      </div>
      <div className="border-b border-slate-800/60">
        <div className="container mx-auto px-4">
          <Breadcrumbs modules={nav.modules} linkable={linkable} />
        </div>
      </div>
    </header>
  );
}
