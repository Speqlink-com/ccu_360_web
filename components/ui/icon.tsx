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
  MessageCircle,
  Plus,
  Search,
  Smile,
  ShieldCheck,
  Users,
  X,
  Activity,
  BedDouble,
  Building2,
  UserRoundPlus,
  TrendingUp,
  RefreshCw,
  PauseCircle,
  RotateCcw,
  CircleUserRound,
  Settings,
  MapPin,
  Monitor,
  Eye,
  EyeOff,
} from "lucide-react";
const icons = {
  overview: LayoutDashboard,
  platformOverview: LayoutDashboard,
  platformAudit: ShieldCheck,
  patients: Users,
  rounds: ClipboardList,
  actions: Check,
  check: Check,
  connect: MessageCircle,
  handover: ArrowDownLeft,
  outputs: FileText,
  clock: Clock3,
  search: Search,
  emoji: Smile,
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
  refresh: RefreshCw,
  suspend: PauseCircle,
  reactivate: RotateCcw,
  profile: CircleUserRound,
  team: Users,
  form: FileText,
  location: MapPin,
  settings: Settings,
  device: Monitor,
  show: Eye,
  hide: EyeOff,
};
export type IconName = keyof typeof icons;
// Supplied PNG/WebP artwork retains its original colours and alpha transparency.
const approvedAssets: Partial<Record<IconName, string>> = {
  platformOverview: "/icons/platform-overview.svg",
  platformAudit: "/icons/platform-audit.svg",
  profile: "/icons/profile-icon.webp",
  addUser: "/icons/add-user.png",
  shield: "/icons/shield-icon.webp",
  facilities: "/icons/facility-icon.webp",
  bed: "/icons/icu-bed.png",
  patients: "/icons/team-icon.png",
  team: "/icons/team-icon.png",
  form: "/icons/form-icon.png",
  connect: "/icons/chat-icon.svg",
  bell: "/icons/notification-icon.webp",
  search: "/icons/search-icon.webp",
  settings: "/icons/settings-icon.webp",
  location: "/icons/location-icon.webp",
  collapse: "/icons/sidebar-toggler-icon.webp",
  menu: "/icons/sidebar-toggler-icon.webp",
  logout: "/icons/logout-icon.png",
  refresh: "/icons/refresh-tech.svg",
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
  outline = false,
}: {
  name: IconName;
  size?: number;
  className?: string;
  outline?: boolean;
}) {
  const Component = icons[name];
  if (!outline && approvedAssets[name])
    return (
      <span
        className={`asset-icon ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Image
          unoptimized
          src={approvedAssets[name]!}
          alt=""
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
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
