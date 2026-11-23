"use client";

import { useState } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, LogOut, Monitor, Moon, PanelLeft, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { findActive, sectionHref, sectionItems, visibleSections, type NavCountKey, type NavItem, type NavSection } from "@/lib/nav";
import { SIDEBAR_MODE_OPTIONS, useSidebarMode, type SidebarMode } from "@/lib/sidebarMode";
import type { ThemeChoice } from "@/lib/theme";
import { TEAM_ROLE_LABELS, type AdminMe, type AdminPermission } from "@/lib/useAdminMe";
import { useEffectiveUrl } from "./NavigationProvider";
import { useTheme } from "./ThemeProvider";
import { BRAND_NAME } from "@/lib/config";
import { navCountLabel, useNavCounts } from "@/lib/useNavCounts";

const RAIL_COLLAPSED = "w-14";
const RAIL_EXPANDED = "w-[212px]";

function useActive(permissions?: readonly AdminPermission[]) {
  const { pathname, search } = useEffectiveUrl();
  const sections = visibleSections(permissions);
  return { sections, active: findActive(pathname, search, sections) };
}

/**
 * The brand in the sidebar. Expanded: the text logo (cream in dark mode) and an "Admin" tag.
 * Collapsed to the icon rail: the square app icon alone -- the two are never shown side by side.
 */
export function Logo({ text = "show" }: { text?: "show" | "hover" | "hidden" }) {
  if (text === "show") {
    return (
      <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-wordmark.png" alt={BRAND_NAME} width={960} height={278} className="h-6 w-auto dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-wordmark-light.png" alt={BRAND_NAME} width={960} height={278} className="hidden h-6 w-auto dark:block" />
        <span className="rounded-md border border-slate-200 px-1.5 py-px text-2xs font-medium text-slate-500">Admin</span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/icon-192.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-lg" />
      <span className="sr-only">{BRAND_NAME} Admin</span>
    </span>
  );
}

/** Menu chrome shared by the rail's two dropdowns. */
const MENU_CONTENT =
  "z-50 min-w-[220px] animate-scale-in rounded-xl border border-slate-200 bg-white p-1 text-sm text-slate-700 shadow-pop focus:outline-none";
const MENU_ITEM =
  "relative flex h-8 cursor-pointer select-none items-center gap-2 rounded-md px-2 outline-none data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900";
const MENU_LABEL = "px-2 pb-1 pt-1.5 text-2xs font-medium uppercase tracking-wider text-slate-400";

function RailRow({
  icon: Icon,
  label,
  labelsVisible,
  hoverReveal,
  active,
  tooltip,
}: {
  icon: LucideIcon;
  label: React.ReactNode;
  labelsVisible: boolean;
  hoverReveal: boolean;
  active?: boolean;
  tooltip?: string;
}) {
  return (
    <>
      <Icon aria-hidden className={cn("h-[18px] w-[18px] shrink-0 transition-colors", active ? "text-slate-900" : "text-slate-500 group-hover/item:text-slate-900")} />
      <span
        className={cn(
          "min-w-0 truncate whitespace-nowrap transition-opacity duration-150",
          labelsVisible ? "opacity-100" : hoverReveal ? "opacity-0 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100" : "opacity-0",
        )}
      >
        {label}
      </span>
      {tooltip && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-pop transition-opacity group-hover/item:opacity-100"
        >
          {tooltip}
        </span>
      )}
    </>
  );
}

const RAIL_ITEM =
  "group/item relative flex h-9 items-center gap-3 rounded-lg px-[9px] text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";

function SectionLink({ section, active, mode, hoverReveal, onClick }: { section: NavSection; active: boolean; mode: SidebarMode; hoverReveal: boolean; onClick?: () => void }) {
  return (
    <Link
      href={sectionHref(section)}
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(RAIL_ITEM, active ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")}
    >
      <RailRow
        icon={section.icon}
        label={section.label}
        labelsVisible={mode === "expanded"}
        hoverReveal={hoverReveal}
        active={active}
        tooltip={mode === "collapsed" ? section.label : undefined}
      />
    </Link>
  );
}

function SidebarModeMenu({ mode, hoverReveal }: { mode: SidebarMode; hoverReveal: boolean }) {
  const [, setMode] = useSidebarMode();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label="Sidebar control" className={cn(RAIL_ITEM, "w-full text-slate-500 hover:bg-slate-50 hover:text-slate-900")}>
          <RailRow
            icon={PanelLeft}
            label="Sidebar"
            labelsVisible={mode === "expanded"}
            hoverReveal={hoverReveal}
            tooltip={mode === "collapsed" ? "Sidebar control" : undefined}
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="right" align="end" sideOffset={10} className={MENU_CONTENT}>
          <DropdownMenu.Label className={MENU_LABEL}>Sidebar control</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={mode} onValueChange={(value) => setMode(value as SidebarMode)}>
            {SIDEBAR_MODE_OPTIONS.map((option) => (
              <DropdownMenu.RadioItem key={option.value} value={option.value} className={MENU_ITEM}>
                <span className="flex w-4 justify-center">
                  <DropdownMenu.ItemIndicator>
                    <Check aria-hidden className="h-3.5 w-3.5" />
                  </DropdownMenu.ItemIndicator>
                </span>
                {option.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const THEME_OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
];

function initials(me?: AdminMe) {
  if (!me) return "A";
  return ((me.first_name?.[0] ?? me.email?.[0] ?? "A") + (me.last_name?.[0] ?? "")).toUpperCase();
}

export function displayName(me?: AdminMe) {
  return (me && ([me.first_name, me.last_name].filter(Boolean).join(" ") || me.email)) || "Admin";
}

function AccountMenu({ me, mode, hoverReveal, onSignOut }: { me?: AdminMe; mode: SidebarMode; hoverReveal: boolean; onSignOut: () => void }) {
  const { choice, setChoice } = useTheme();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label="Account menu" className={cn(RAIL_ITEM, "w-full px-[6px] text-slate-700 hover:bg-slate-50")}>
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-2xs font-semibold text-snow"
          >
            {initials(me)}
          </span>
          <span
            className={cn(
              "min-w-0 text-left transition-opacity duration-150",
              mode === "expanded" ? "opacity-100" : hoverReveal ? "opacity-0 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100" : "opacity-0",
            )}
          >
            <span className="block truncate text-[13px] font-medium leading-tight text-slate-900">{displayName(me)}</span>
            {me && <span className="block truncate text-2xs leading-tight text-slate-500">{TEAM_ROLE_LABELS[me.team_role]}</span>}
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="right" align="end" sideOffset={10} className={MENU_CONTENT}>
          <div className="px-2 py-2">
            <div className="truncate font-medium text-slate-900">{displayName(me)}</div>
            {me?.email && <div className="truncate text-xs text-slate-500">{me.email}</div>}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-200" />
          <DropdownMenu.Label className={MENU_LABEL}>Theme</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={choice} onValueChange={(value) => setChoice(value as ThemeChoice)}>
            {THEME_OPTIONS.map(({ value, label, Icon }) => (
              <DropdownMenu.RadioItem key={value} value={value} className={MENU_ITEM}>
                <Icon aria-hidden className="h-4 w-4 text-slate-500" />
                <span className="flex-1">{label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check aria-hidden className="h-3.5 w-3.5" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-200" />
          <DropdownMenu.Item onSelect={onSignOut} className={cn(MENU_ITEM, "text-red-700 data-[highlighted]:text-red-700")}>
            <LogOut aria-hidden className="h-4 w-4" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** A small count beside a menu item ("Host requests  3"): things waiting for the team. */
function NavCount({ item, counts }: { item: NavItem; counts: Partial<Record<NavCountKey, number>> }) {
  const label = item.count ? navCountLabel(counts[item.count]) : null;
  if (!label) return null;
  return (
    <span className="ml-auto shrink-0 rounded-full bg-accent-500 px-1.5 py-px text-2xs font-semibold tabular-nums text-snow" aria-label={`${label} waiting`}>
      {label}
    </span>
  );
}

/** The selected section's own menu -- grouped, Supabase-style, no icons. */
function SectionMenu({
  section,
  currentHref,
  counts = {},
}: {
  section: NavSection;
  currentHref: string | null;
  counts?: Partial<Record<NavCountKey, number>>;
}) {
  return (
    <nav aria-label={`${section.label} menu`} className="flex h-full w-[220px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-canvas px-3 pb-6">
      <div className="flex h-12 shrink-0 items-center px-2">
        <h2 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{section.label}</h2>
      </div>
      <div className="space-y-5 pt-2">
        {section.groups.map((group, index) => (
          <div key={group.label ?? index}>
            {group.label && <div className="mb-1 px-2 text-2xs font-medium uppercase tracking-wider text-slate-400">{group.label}</div>}
            <ul className="space-y-px">
              {group.items.map((item) => {
                const active = item.href === currentHref;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-8 items-center rounded-md px-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400",
                        active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      <span className="truncate">{item.label}</span>
                      <NavCount item={item} counts={counts} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

/**
 * Desktop navigation: a rail of sections (expanded, collapsed, or expanding over the page on
 * hover -- the admin's choice) and, beside it, the selected section's own grouped menu. Both follow
 * a click instantly, before the new page has loaded.
 */
export function Sidebar({
  permissions,
  me,
  onSignOut,
}: {
  /** Omitted (e.g. while /me loads) = show every item; the API is the real gate either way. */
  permissions?: readonly AdminPermission[];
  me?: AdminMe;
  onSignOut?: () => void;
} = {}) {
  const [mode] = useSidebarMode();
  const { sections, active } = useActive(permissions);
  const counts = useNavCounts(permissions);
  // In "expand on hover", a click collapses the rail at once so the section menu it opens is not
  // left covered; it expands again once the pointer has left and come back.
  const [settled, setSettled] = useState(false);
  const hoverReveal = mode === "hover" && !settled;
  const settle = mode === "hover" ? () => setSettled(true) : undefined;
  const main = sections.filter((s) => !s.bottom);
  const bottom = sections.filter((s) => s.bottom);
  const showSectionMenu = active && sectionItems(active.section).length > 1;

  return (
    <div className="flex h-full">
      <div className={cn("relative h-full shrink-0 transition-[width] duration-200", mode === "expanded" ? RAIL_EXPANDED : RAIL_COLLAPSED)}>
        <nav
          aria-label="Admin sections"
          className={cn(
            "group/rail absolute inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-canvas px-2 transition-[width,box-shadow] duration-200 ease-out",
            mode === "expanded" ? RAIL_EXPANDED : RAIL_COLLAPSED,
            // Collapsed keeps overflow visible so the hover tooltips can sit outside the rail.
            mode !== "collapsed" && "overflow-hidden",
            hoverReveal && "delay-75 hover:w-[212px] hover:shadow-pop has-[:focus-visible]:w-[212px] has-[:focus-visible]:shadow-pop",
          )}
          onPointerLeave={() => setSettled(false)}
        >
          <Link href="/dashboard" className="flex h-12 shrink-0 items-center rounded-lg px-[6px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400" aria-label={`${BRAND_NAME} Admin home`}>
            <Logo text={mode === "expanded" ? "show" : hoverReveal ? "hover" : "hidden"} />
          </Link>
          <ul className="mt-2 space-y-1">
            {main.map((section) => (
              <li key={section.id}>
                <SectionLink section={section} active={active?.section.id === section.id} mode={mode} hoverReveal={hoverReveal} onClick={settle} />
              </li>
            ))}
          </ul>
          <div className="mt-auto space-y-1 border-t border-slate-200 pb-3 pt-3">
            {bottom.map((section) => (
              <SectionLink key={section.id} section={section} active={active?.section.id === section.id} mode={mode} hoverReveal={hoverReveal} onClick={settle} />
            ))}
            <SidebarModeMenu mode={mode} hoverReveal={hoverReveal} />
            {onSignOut && <AccountMenu me={me} mode={mode} hoverReveal={hoverReveal} onSignOut={onSignOut} />}
          </div>
        </nav>
      </div>
      {showSectionMenu && <SectionMenu section={active.section} currentHref={active.item.href} counts={counts} />}
    </div>
  );
}

/** The whole tree at once, for the mobile drawer (sections as headings, their pages beneath). */
export function NavTree({
  permissions,
  onNavigate,
  navLabel = "Admin sections (mobile menu)",
}: {
  permissions?: readonly AdminPermission[];
  onNavigate?: () => void;
  navLabel?: string;
}) {
  const { sections, active } = useActive(permissions);
  const counts = useNavCounts(permissions);
  return (
    <nav aria-label={navLabel} className="space-y-5">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <div key={section.id}>
            <div className="mb-1 flex items-center gap-2 px-2 text-2xs font-medium uppercase tracking-wider text-slate-400">
              <Icon aria-hidden className="h-3.5 w-3.5" />
              {section.label}
            </div>
            <ul className="space-y-px">
              {sectionItems(section).map((item) => {
                const current = active?.item.href === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center rounded-md px-2 text-sm transition-colors",
                        current ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      <span className="truncate">{item.label}</span>
                      <NavCount item={item} counts={counts} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
