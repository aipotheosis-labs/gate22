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
import { LoginForm } from "@/features/auth/components/login-form";
import { login, getCurrentUser, logout as apiLogout } from "@/features/auth/api/auth";

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
      // Check both token formats for compatibility
      const storedToken = localStorage.getItem('accessToken') || localStorage.getItem('access-token');
      const storedUser = localStorage.getItem('user');
      
      // Demo mode - if we have a demo token, use stored user data
      if (storedToken && storedToken.startsWith('demo-token-')) {
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            setAccessToken(storedToken);
            setUser({
              userId: userData.id || 'demo-user-001',
              email: userData.email,
              firstName: userData.name,
              lastName: '',
              username: userData.name,
            });
            setOrgs([{
              orgId: 'demo-org-001',
              orgName: 'Demo Organization',
              userRole: userData.role || 'admin',
              userPermissions: ['read', 'write', 'admin'],
            }]);
            setIsAuthenticated(true);
          } catch {
            // Invalid stored data, clear it
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
          }
        }
      } else if (storedToken) {
        // Real token - try to get user from API
        try {
          const { user, org } = await getCurrentUser(storedToken);
          setAccessToken(storedToken);
          setUser(user);
          setOrgs([org]);
          setIsAuthenticated(true);
        } catch {
          // Token is invalid, clear it
          localStorage.removeItem('access-token');
          localStorage.removeItem('accessToken');
        }
      }
      setIsLoading(false);
    };

    checkExistingSession();
  }, []);

  const handleLogin = useCallback(async (email: string, password: string) => {
    const { token, user, org } = await login({ email, password });
    
    // Store token in localStorage for persistence
    localStorage.setItem('access-token', token);
    
    setAccessToken(token);
    setUser(user);
    setOrgs([org]);
    setIsAuthenticated(true);
  }, []);

  const handleLogout = useCallback(async () => {
    if (accessToken) {
      try {
        await apiLogout(accessToken);
      } catch {
        // Continue with logout even if API call fails
      }
    }
    
    // Clear all state and localStorage
    localStorage.removeItem('access-token');
    setAccessToken("");
    setUser(null);
    setOrgs([]);
    setActiveOrg(null);
    setIsAuthenticated(false);
    
    // Redirect to home page after logout
    router.push('/');
  }, [accessToken, router]);

  useEffect(() => {
    if (orgs.length > 0) {
      setActiveOrg(orgs[0]);
    }
  }, [orgs]);

  // Show loading while checking existing session
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-3">
        <h1 className="text-2xl font-semibold">Loading...</h1>
        <Skeleton className="h-[125px] w-[250px] rounded-xl" />
      </div>
    );
  }

  // Show authentication screen if not authenticated
  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  // Show loading while fetching initial data
  if (!user || !activeOrg || !accessToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-3">
        <h1 className="text-2xl font-semibold">
          Setting up your workspace...
        </h1>
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