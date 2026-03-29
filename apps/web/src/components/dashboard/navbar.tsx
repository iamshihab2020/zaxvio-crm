"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconBell, IconSettings, IconLogout } from "@tabler/icons-react";
import { useSession, signOut } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSidebar } from "@/components/dashboard/sidebar-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/customers": "Customers",
  "/jobs": "Jobs",
  "/invoices": "Invoices",
  "/quotes": "Quotes",
  "/bookings": "Bookings",
  "/schedule": "Schedule",
  "/catalog": "Catalog",
  "/checklists": "Checklists",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      return title;
    }
  }
  return "Dashboard";
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { isCollapsed } = useSidebar();

  // Shift navbar down when impersonation bar is visible
  const [isImpersonating, setIsImpersonating] = useState(false);
  useEffect(() => {
    setIsImpersonating(document.cookie.includes("x-impersonation-id="));
  }, []);

  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";
  const userRole = session?.user?.role ?? "member";
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
      className={`fixed right-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card px-6 transition-[left,top] duration-300 ease-in-out ${isImpersonating ? "top-10" : "top-0"}`}
      style={{ left: isCollapsed ? "4rem" : "15rem" }}
    >
      <h1 className="font-heading text-lg font-semibold text-foreground">
        {pageTitle}
      </h1>

      <div className="flex items-center gap-1">
        <ThemeToggle />

        <Button variant="ghost" size="icon" className="relative">
          <IconBell className="h-[18px] w-[18px]" stroke={1.5} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand" />
          <span className="sr-only">Notifications</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="ml-1 gap-2 px-2"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-brand text-[10px] font-bold text-white">
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
                  {userEmail || userRole}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              className="cursor-pointer gap-2"
            >
              <IconSettings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
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
