"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { useMetaInfo } from "@/components/context/metainfo";
import { createAuthenticatedRequest } from "@/lib/api-client";
import { toast } from "sonner";

interface OAuth2DiscoveryResponse {
  authorize_url?: string;
  access_token_url?: string;
  refresh_token_url?: string;
  registration_url?: string;
  token_endpoint_auth_method_supported?: string[];
}

export default function AddCustomMCPServerPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState("");
  const [authType, setAuthType] = useState<string>("");
  const [url, setUrl] = useState("");
  const [transportType, setTransportType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Step 2 fields
  const [oauth2Config, setOauth2Config] = useState<OAuth2DiscoveryResponse>({});
  const [authorizeUrl, setAuthorizeUrl] = useState("");
  const [tokenUrl, setTokenUrl] = useState("");

  const { accessToken, activeOrg, activeRole } = useMetaInfo();

  // Category management functions
  const addCategory = (category: string) => {
    const trimmedCategory = category.trim();
    if (trimmedCategory && !categories.includes(trimmedCategory)) {
      setCategories([...categories, trimmedCategory]);
      setCategoryInput("");
    }
  };

  const removeCategory = (categoryToRemove: string) => {
    setCategories(categories.filter((cat) => cat !== categoryToRemove));
  };

  const handleCategoryKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCategory(categoryInput);
    }
  };

  // Name validation function
  const validateName = (name: string): string | null => {
    if (!name.trim()) {
      return "Server name is required";
    }

    // Check for valid characters: uppercase letters, numbers, underscores only
    if (!/^[A-Z0-9_]+$/.test(name)) {
      return "Name must contain only uppercase letters, numbers, and underscores";
    }

    // Check for consecutive underscores
    if (/__/.test(name)) {
      return "Name cannot contain consecutive underscores";
    }

    return null;
  };

  // URL validation function
  const validateUrl = (url: string): string | null => {
    if (!url.trim()) {
      return "URL is required";
    }

    try {
      new URL(url);
      return null;
    } catch {
      return "Please enter a valid URL";
    }
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate name
    const nameError = validateName(name);
    if (nameError) {
      toast.error(nameError);
      return;
    }

    // Validate auth type
    if (!authType) {
      toast.error("Please select an authentication method");
      return;
    }

    // Validate URL
    const urlError = validateUrl(url);
    if (urlError) {
      toast.error(urlError);
      return;
    }

    // Validate transport type
    if (!transportType) {
      toast.error("Please select a transport type");
      return;
    }

    if (!accessToken) {
      toast.error("Authentication required. Please log in.");
      return;
    }

    // If OAuth2, perform discovery and go to step 2
    if (authType === "oauth2") {
      setIsDiscovering(true);

      try {
        const api = createAuthenticatedRequest(
          accessToken,
          activeOrg?.orgId,
          activeRole,
        );

        const response = await api.post<OAuth2DiscoveryResponse>(
          "/mcp-servers/oauth2-discovery",
          {
            mcp_server_url: url.trim(),
          },
        );

        setOauth2Config(response);
        // Pre-populate fields with discovered values
        setAuthorizeUrl(response.authorize_url || "");
        setTokenUrl(response.access_token_url || "");

        setCurrentStep(2);
        toast.success("OAuth2 configuration discovered successfully");
      } catch (error) {
        console.error("Failed to discover OAuth2 configuration:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to discover OAuth2 configuration",
        );
      } finally {
        setIsDiscovering(false);
      }
    } else {
      // For non-OAuth2, create server directly
      await createServer();
    }
  };

  const createServer = async () => {
    setIsSubmitting(true);

    try {
      const api = createAuthenticatedRequest(
        accessToken,
        activeOrg?.orgId,
        activeRole,
      );

      const payload: {
        name: string;
        auth_type: string;
        url: string;
        transport_type: string;
        description?: string;
        logo?: string;
        categories?: string[];
        authorize_url?: string;
        access_token_url?: string;
        token_endpoint_auth_method_supported?: string[];
      } = {
        name: name.trim(),
        auth_type: authType,
        url: url.trim(),
        transport_type: transportType,
      };

      // Add optional fields
      if (description.trim()) {
        payload.description = description.trim();
      }
      if (logoUrl.trim()) {
        payload.logo = logoUrl.trim();
      }
      if (categories.length > 0) {
        payload.categories = categories;
      }

      // Add OAuth2 fields if applicable
      if (authType === "oauth2") {
        payload.authorize_url = authorizeUrl.trim() || undefined;
        payload.access_token_url = tokenUrl.trim() || undefined;
        payload.token_endpoint_auth_method_supported =
          oauth2Config.token_endpoint_auth_method_supported;
      }

      await api.post("/mcp-servers", payload);

      toast.success("Custom MCP server added successfully");
      router.push("/mcp-servers");
    } catch (error) {
      console.error("Failed to create custom MCP server:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create custom MCP server",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createServer();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back Button */}
      <Button
        variant="outline"
        onClick={() => router.push("/mcp-servers")}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to MCP Servers
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Add Custom MCP Server</h1>
          <p className="text-muted-foreground mt-1">
            {authType === "oauth2"
              ? `Step ${currentStep} of 2: ${currentStep === 1 ? "Server Details" : "OAuth2 Configuration"}`
              : "Create a new custom MCP server configuration"}
          </p>
        </div>
      </div>

      <Separator className="mb-6" />

      {/* Step 1: Server Details */}
      {currentStep === 1 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Server Details</h2>
          <form onSubmit={handleStep1Submit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                Server Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="MY_CUSTOM_SERVER"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                disabled={isDiscovering}
                required
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                Use uppercase letters, numbers, and underscores only. No
                consecutive underscores.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="authType">
                Authentication Method <span className="text-red-500">*</span>
              </Label>
              <Select
                value={authType}
                onValueChange={setAuthType}
                disabled={isDiscovering}
                required
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Select authentication method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_auth">No Auth</SelectItem>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="oauth2">OAuth2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">
                Server URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="url"
                type="url"
                placeholder="http://mcp.example.com/mcp"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isDiscovering}
                required
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                Enter the full URL to your MCP server endpoint.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transportType">
                Transport Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={transportType}
                onValueChange={setTransportType}
                disabled={isDiscovering}
                required
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Select transport type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="streamable_http">
                    Streamable HTTP
                  </SelectItem>
                  <SelectItem value="sse">SSE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter a description for your MCP server..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isDiscovering}
                className="max-w-md"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="url"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                disabled={isDiscovering}
                className="max-w-md"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categories">Categories</Label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 mb-2">
                  {categories.map((category, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {category}
                      <button
                        type="button"
                        onClick={() => removeCategory(category)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                        disabled={isDiscovering}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="categories"
                    type="text"
                    placeholder="Add a category and press Enter..."
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    onKeyPress={handleCategoryKeyPress}
                    disabled={isDiscovering}
                    className="max-w-md"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addCategory(categoryInput)}
                    disabled={isDiscovering || !categoryInput.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={
                  isDiscovering ||
                  isSubmitting ||
                  !name.trim() ||
                  !authType ||
                  !url.trim() ||
                  !transportType
                }
                className="flex items-center gap-2"
              >
                {isDiscovering || isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {isDiscovering
                  ? "Discovering..."
                  : isSubmitting
                    ? "Creating..."
                    : authType === "oauth2"
                      ? "Next: Configure OAuth2"
                      : "Create Server"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/mcp-servers")}
                disabled={isDiscovering || isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2: OAuth2 Configuration */}
      {currentStep === 2 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">OAuth2 Configuration</h2>
          <form onSubmit={handleStep2Submit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="authorizeUrl">Authorization URL</Label>
              <Input
                id="authorizeUrl"
                type="url"
                placeholder="https://example.com/oauth/authorize"
                value={authorizeUrl}
                onChange={(e) => setAuthorizeUrl(e.target.value)}
                disabled={isSubmitting}
                className="max-w-md"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tokenUrl">Token URL</Label>
              <Input
                id="tokenUrl"
                type="url"
                placeholder="https://example.com/oauth/token"
                value={tokenUrl}
                onChange={(e) => setTokenUrl(e.target.value)}
                disabled={isSubmitting}
                className="max-w-md"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="authMethods">Token Endpoint Auth Methods</Label>
              <Input
                id="authMethods"
                type="text"
                value={
                  oauth2Config.token_endpoint_auth_method_supported?.join(
                    ", ",
                  ) || "None"
                }
                disabled
                readOnly
                className="max-w-md bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Supported authentication methods discovered from the server.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {isSubmitting ? "Creating..." : "Create Server"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/mcp-servers")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
