"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  pictureUrl: string;
  metadata: Record<string, unknown>;
}

interface Org {
  orgId: string;
  orgName: string;
  orgMetadata: Record<string, unknown>;
  userRole: string;
  userPermissions: string[];
}

interface MockAuthProps {
  onAuthenticated: (token: string, user: User, org: Org) => void;
}

export function MockAuth({ onAuthenticated }: MockAuthProps) {
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("password");
  const [firstName, setFirstName] = useState("Test");
  const [lastName, setLastName] = useState("User");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      if (!response.ok) throw new Error('Signup failed');

      const data = await response.json();
      toast.success("Account created successfully!");
      onAuthenticated(data.token, data.user, data.org);
    } catch {
      toast.error("Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) throw new Error('Login failed');

      const data = await response.json();
      toast.success("Logged in successfully!");
      onAuthenticated(data.token, data.user, data.org);
    } catch {
      toast.error("Failed to login");
    } finally {
      setIsLoading(false);
    }
  };

  // Quick login for development
  const handleQuickLogin = () => {
    const mockToken = `mock-jwt-token-${Date.now()}`;
    const mockUser = {
      userId: 'mock-user-123',
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
      pictureUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=testuser',
      metadata: {},
    };
    const mockOrg = {
      orgId: 'org-123',
      orgName: 'Personal Organization',
      orgMetadata: {},
      userRole: 'Admin',
      userPermissions: ['admin', 'write', 'read'],
    };
    
    onAuthenticated(mockToken, mockUser, mockOrg);
    toast.success("Quick login successful!");
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to ACI.DEV Platform</CardTitle>
          <CardDescription>
            This is a mock authentication for development. Click &quot;Quick Login&quot; to proceed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleQuickLogin} 
            className="w-full" 
            size="lg"
            variant="default"
          >
            Quick Login (Development Mode)
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or use mock forms
              </span>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter any password"
                />
              </div>
              <Button 
                onClick={handleLogin} 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Test"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="User"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter any password"
                />
              </div>
              <Button 
                onClick={handleSignup} 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Sign Up"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}