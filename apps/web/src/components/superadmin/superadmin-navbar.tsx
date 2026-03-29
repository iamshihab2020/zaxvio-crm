"use client";

import { usePathname, useRouter } from "next/navigation";
import { IconLogout, IconShieldLock } from "@tabler/icons-react";
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
import { useSuperadminSidebar } from "./superadmin-sidebar-provider";
import { GlobalSearch } from "./global-search";

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
  const { isCollapsed } = useSuperadminSidebar();

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
      className="fixed top-0 right-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card px-6 transition-[left] duration-300 ease-in-out"
      style={{ left: isCollapsed ? "4rem" : "15rem" }}
    >
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-lg font-semibold text-foreground">
          {pageTitle}
        </h1>
        <Badge className="bg-admin-accent/10 text-admin-accent border-admin-accent/20 text-xs font-medium">
          <IconShieldLock className="mr-1 h-3 w-3" />
          ADMIN
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <GlobalSearch />
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="ml-1 gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-admin-accent text-[10px] font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="font-body text-sm font-medium text-foreground">
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
              onClick={handleLogout}
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
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
