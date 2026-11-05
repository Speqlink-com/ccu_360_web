import type { Role } from "./domain/identity";
import type { IconName } from "@/components/ui/icon";
export type NavigationItem = {
  href: string;
  title: string;
  icon: IconName;
  group?: string;
};
export function navigationFor(role?: Role): NavigationItem[] {
  if (role === "ahs_admin")
    return [
      {
        href: "/dashboard",
        title: "Platform overview",
        icon: "overview",
        group: "PLATFORM",
      },
      {
        href: "/dashboard/facilities",
        title: "Facilities",
        icon: "facilities",
      },
      {
        href: "/dashboard/access",
        title: "Roles & access",
        icon: "shield",
        group: "GOVERNANCE",
      },
    ];
  if (role === "facility_admin")
    return [
      {
        href: "/dashboard",
        title: "Facility overview",
        icon: "overview",
        group: "YOUR FACILITY",
      },
      { href: "/dashboard/employees", title: "Employees", icon: "addUser" },
      { href: "/dashboard/units", title: "Units & beds", icon: "bed" },
      {
        href: "/dashboard/access",
        title: "Roles & access",
        icon: "shield",
        group: "GOVERNANCE",
      },
    ];
  return [
    {
      href: "/dashboard",
      title: "Clinical overview",
      icon: "overview",
      group: "PATIENT CARE",
    },
    { href: "/dashboard/patients", title: "Patient 360", icon: "patients" },
    { href: "/dashboard/actions", title: "Action 360", icon: "actions" },
    {
      href: "/dashboard/connect",
      title: "Connect 360",
      icon: "connect",
      group: "COORDINATION",
    },
    { href: "/dashboard/handover", title: "Handover 360", icon: "handover" },
    {
      href: "/dashboard/team",
      title: "Care team",
      icon: "profile",
      group: "YOUR FACILITY",
    },
    { href: "/dashboard/access", title: "Roles & access", icon: "shield" },
  ];
}
export const allowedSection = (role: Role, section: string) =>
  navigationFor(role).some((n) => n.href === `/dashboard/${section}`);
