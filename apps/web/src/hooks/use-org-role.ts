"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";

interface OrgRoleState {
  role: string | null;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isLoading: boolean;
}

export function useOrgRole(): OrgRoleState {
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      try {
        const result = await authClient.organization.getActiveMember();
        if (result.data) {
          setRole(result.data.role ?? "member");
        }
      } catch {
        // Default to member if fetch fails
        setRole("member");
      } finally {
        setIsLoading(false);
      }
    }
    fetchRole();
  }, []);

  return {
    role,
    isOwner: role === "owner",
    isAdmin: role === "admin",
    isMember: role === "member",
    isLoading,
  };
}
