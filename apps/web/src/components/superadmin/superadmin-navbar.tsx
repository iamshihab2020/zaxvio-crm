"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  IconLogout,
  IconMoon,
  IconShieldLock,
  IconSun,
} from "@tabler/icons-react";
import { useSession, signOut } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "./global-search";
import { SuperadminMobileNav } from "./superadmin-mobile-nav";

const pageTitles: Record<string, string> = {
  "/superadmin/dashboard": "Dashboard",
  "/superadmin/tenants": "Tenants",
  "/superadmin/analytics": "Analytics",
  "/superadmin/support": "Support",
  "/superadmin/affiliates": "Affiliates",
  "/superadmin/system": "System Health",
};

function getPageTitle(pathname: string): string {
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      return title;
    }
  }
  return "Admin";
}

export function SuperadminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();

  const userName = session?.user?.name ?? "Admin";
  const userEmail = session?.user?.email ?? "";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    // Clear role cookie before signing out
    document.cookie = "x-user-role=; path=/; max-age=0";
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/login");
        },
      },
    });
  };

  const pageTitle = getPageTitle(pathname);

  return (
    <header
      // The sidebar offset is a class, not an inline style: `--sidebar-w` is
      // published by SuperadminShell (this renders inside it) and is 0 below
      // `lg`, where the sidebar is a drawer. `left-0` first so the bar spans
      // the phone instead of starting 240px in.
      className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card px-4 transition-[left] duration-300 ease-in-out sm:px-6 lg:left-[var(--sidebar-w)]"
    >
      {/* Menu button (below `lg`), title and the ADMIN mark. `min-w-0 flex-1`
          lets the title truncate instead of pushing the account controls off a
          375px screen; the badge stays whole because it is the cue that this
          is not a tenant's workspace. */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <SuperadminMobileNav />
        <h1 className="truncate font-heading text-lg font-semibold text-foreground">
          {pageTitle}
        </h1>
        <Badge className="ml-2 shrink-0 bg-admin-accent/10 text-admin-accent border-admin-accent/20 text-xs font-medium">
          <IconShieldLock className="mr-1 h-3 w-3" />
          ADMIN
        </Badge>
      </div>

      <div className="ml-3 flex shrink-0 items-center gap-1 sm:gap-2">
        {/* An icon button below `sm` (see GlobalSearch), so it is a peer of the
            account button rather than a field with no room. */}
        <GlobalSearch />
        {/* Below `sm` the toggle moves into the account menu to give the title
            room. */}
        <ThemeToggle className="hidden sm:inline-flex" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 gap-2 px-2 sm:ml-1 sm:h-9"
              aria-label={userName}
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-admin-accent text-[10px] font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden font-body text-sm font-medium text-foreground md:inline">
                {userName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="font-body text-sm font-medium">{userName}</p>
                <p className="font-body text-xs text-muted-foreground">
                  {userEmail}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="cursor-pointer gap-2 max-sm:min-h-10 sm:hidden"
            >
              {resolvedTheme === "dark" ? (
                <IconSun className="h-4 w-4" />
              ) : (
                <IconMoon className="h-4 w-4" />
              )}
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="sm:hidden" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer gap-2 text-destructive focus:text-destructive max-sm:min-h-10"
            >
              <IconLogout className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
