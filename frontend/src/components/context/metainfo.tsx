"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, logout as apiLogout } from "@/features/auth/api/auth";
import { tokenManager } from "@/lib/token-manager";

export interface UserClass {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  pictureUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface OrgMemberInfoClass {
  orgId: string;
  orgName: string;
  orgMetadata?: Record<string, unknown>;
  userRole: string;
  userPermissions: string[];
}

interface MetaInfoContextType {
  user: UserClass;
  orgs: OrgMemberInfoClass[];
  activeOrg: OrgMemberInfoClass;
  setActiveOrg: (org: OrgMemberInfoClass) => void;
  accessToken: string;
  logout: () => Promise<void>;
}

const MetaInfoContext = createContext<MetaInfoContextType | undefined>(
  undefined,
);

interface MetaInfoProviderProps {
  children: ReactNode;
}

export const MetaInfoProvider = ({ children }: MetaInfoProviderProps) => {
  const router = useRouter();
  const [user, setUser] = useState<UserClass | null>(null);
  const [orgs, setOrgs] = useState<OrgMemberInfoClass[]>([]);
  const [activeOrg, setActiveOrg] = useState<OrgMemberInfoClass | null>(null);
  const [accessToken, setAccessToken] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        // First check if we have an existing valid token
        let token = tokenManager.getAccessToken();

        // If no token in memory, try to get a fresh token from the backend using the refresh token cookie
        if (!token) {
          token = await tokenManager.refreshAccessToken();
        }

        if (token) {
          // Get user profile with the new token
          const userProfile = await getProfile(token);

          // Transform the profile to match the expected format
          const user: UserClass = {
            userId: userProfile.user_id,
            email: userProfile.email,
            firstName: userProfile.name.split(" ")[0],
            lastName: userProfile.name.split(" ").slice(1).join(" "),
            username: userProfile.email.split("@")[0],
            pictureUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name)}&background=random`,
          };

          const org: OrgMemberInfoClass =
            userProfile.organizations && userProfile.organizations.length > 0
              ? {
                  orgId: userProfile.organizations[0].organization_id,
                  orgName: userProfile.organizations[0].organization_name,
                  userRole: userProfile.organizations[0].role,
                  userPermissions: [], // TODO: Get permissions from backend
                }
              : {
                  orgId: "",
                  orgName: "",
                  userRole: "",
                  userPermissions: [],
                };

          setAccessToken(token);
          setUser(user);
          setOrgs([org]);
          setIsAuthenticated(true);
        } else {
          // No valid session - this is expected for non-authenticated users
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Continue with logout even if API call fails
    }

    // Clear token from memory
    tokenManager.clearToken();

    // Clear all state
    setAccessToken("");
    setUser(null);
    setOrgs([]);
    setActiveOrg(null);
    setIsAuthenticated(false);

    // Redirect to home page after logout
    router.push("/");
  }, [router]);

  useEffect(() => {
    if (orgs.length > 0) {
      setActiveOrg(orgs[0]);
    }
  }, [orgs]);

  // Redirect to login page if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading while checking existing session
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-3">
        <h1 className="text-2xl font-semibold">Loading...</h1>
        <Skeleton className="h-[125px] w-[250px] rounded-xl" />
      </div>
    );
  }

  // Show loading while redirecting to login
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-3">
        <h1 className="text-2xl font-semibold">Redirecting to login...</h1>
        <Skeleton className="h-[125px] w-[250px] rounded-xl" />
      </div>
    );
  }

  // Show loading while fetching initial data
  if (!user || !activeOrg || !accessToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-3">
        <h1 className="text-2xl font-semibold">Setting up your workspace...</h1>
        <Skeleton className="h-[125px] w-[250px] rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    );
  }

  return (
    <MetaInfoContext.Provider
      value={{
        user,
        orgs,
        activeOrg,
        setActiveOrg,
        accessToken,
        logout: handleLogout,
      }}
    >
      {children}
    </MetaInfoContext.Provider>
  );
};

export const useMetaInfo = () => {
  const context = useContext(MetaInfoContext);
  if (!context) {
    throw new Error("useMetaInfo must be used within a MetaInfoProvider");
  }
  return context;
};
