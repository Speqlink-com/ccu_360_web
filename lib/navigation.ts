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
export function productionNavigationFor(role?: Role): NavigationItem[] {
  const overview: NavigationItem = {
    href: "/dashboard",
    title: "Overview",
    icon: "overview",
    group: role === "ahs_admin" ? "AHS PLATFORM" : "YOUR FACILITY",
  };
  const security: NavigationItem = {
    href: "/dashboard/security",
    title: "My account & security",
    icon: "shield",
    group: "ACCOUNT",
  };
  if (role === "ahs_admin")
    return [
      overview,
      {
        href: "/dashboard/facilities",
        title: "Facilities",
        icon: "facilities",
      },
      {
        href: "/dashboard/administrators",
        title: "AHS administrators",
        icon: "addUser",
      },
      { href: "/dashboard/audit", title: "Audit & delivery", icon: "actions" },
      security,
    ];
  if (role === "facility_admin")
    return [
      overview,
      { href: "/dashboard/employees", title: "Employees", icon: "addUser" },
      {
        href: "/dashboard/workforce",
        title: "Departments & care teams",
        icon: "profile",
      },
      {
        href: "/dashboard/templates",
        title: "Journey forms & branding",
        icon: "handover",
      },
      { href: "/dashboard/audit", title: "Access audit", icon: "shield" },
      {
        href: "/dashboard/worksite",
        title: "Facility access",
        icon: "facilities",
      },
      {
        href: "/dashboard/connect",
        title: "Connect 360",
        icon: "connect",
        group: "COMMUNICATION",
      },
      security,
    ];
  return [
    overview,
    {
      href: "/dashboard/patients",
      title:
        role === "receptionist" ? "Reception & patients" : "Patient journeys",
      icon: "patients",
    },
    {
      href: "/dashboard/connect",
      title: "Connect 360",
      icon: "connect",
      group: "COMMUNICATION",
    },
    security,
  ];
}
