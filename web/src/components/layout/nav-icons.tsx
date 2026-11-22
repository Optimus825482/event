import {
  BarChart3,
  Bell,
  CalendarDays,
  Contact,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  ScanLine,
  Settings,
  Shield,
  Star,
  Table2,
  Ticket,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/features/auth/nav";

const ICONS: Record<NavIconName, LucideIcon> = {
  calendar: CalendarDays,
  users: Users,
  "layout-template": LayoutTemplate,
  mail: Mail,
  star: Star,
  ticket: Ticket,
  "user-round": UserRound,
  contact: Contact,
  "scan-line": ScanLine,
  shield: Shield,
  settings: Settings,
  table: Table2,
  bell: Bell,
  "layout-dashboard": LayoutDashboard,
  "bar-chart": BarChart3,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" className={className} />;
}
