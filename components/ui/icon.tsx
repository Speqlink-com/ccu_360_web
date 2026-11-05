import Image from "next/image";
import {
  ArrowDownLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
  Activity,
  BedDouble,
  Building2,
  UserRoundPlus,
  TrendingUp,
  CircleUserRound,
} from "lucide-react";
const icons = {
  overview: LayoutDashboard,
  patients: Users,
  rounds: ClipboardList,
  actions: Check,
  connect: Network,
  handover: ArrowDownLeft,
  outputs: FileText,
  clock: Clock3,
  search: Search,
  bell: Bell,
  down: ChevronDown,
  left: ChevronLeft,
  right: ChevronRight,
  arrow: ArrowRight,
  collapse: ChevronsLeft,
  menu: Menu,
  close: X,
  plus: Plus,
  shield: ShieldCheck,
  help: CircleHelp,
  logout: LogOut,
  activity: Activity,
  bed: BedDouble,
  facilities: Building2,
  addUser: UserRoundPlus,
  growth: TrendingUp,
  profile: CircleUserRound,
};
export type IconName = keyof typeof icons;
// Supplied PNG/WebP artwork retains its original colours and alpha transparency.
const approvedAssets: Partial<Record<IconName, string>> = {
  profile: "/icons/profile-icon.webp",
  addUser: "/icons/add-user.png",
  shield: "/icons/verified-check-icon.webp",
  outputs: "/icons/invoice-icon.png",
  growth: "/icons/progress-bar.webp",
  left: "/icons/left-chevron.webp",
  right: "/icons/right-chevron.png",
  down: "/icons/dropdown-icon.webp",
};
export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Component = icons[name];
  if (approvedAssets[name])
    return (
      <span
        className={`asset-icon ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Image unoptimized src={approvedAssets[name]!} alt="" width={size} height={size} />
      </span>
    );
  return (
    <Component
      size={size}
      strokeWidth={1.7}
      aria-hidden="true"
      className={className}
    />
  );
}
