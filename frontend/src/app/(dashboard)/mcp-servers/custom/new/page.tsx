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
import { Checkbox } from "@/components/ui/checkbox";
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

interface OAuth2DCRResponse {
  token_endpoint_auth_method: string;
  client_id?: string;
  client_secret?: string;
}

export default function AddCustomMCPServerPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState("");
  const [authMethods, setAuthMethods] = useState<{
    no_auth: boolean;
    api_key: boolean;
    oauth2: boolean;
  }>({
    no_auth: false,
    api_key: false,
    oauth2: false,
  });
  const [url, setUrl] = useState("");
  const [transportType, setTransportType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Step 2 fields - OAuth2
  const [oauth2Config, setOauth2Config] = useState<OAuth2DiscoveryResponse>({});
  const [authorizeUrl, setAuthorizeUrl] = useState("");
  const [tokenUrl, setTokenUrl] = useState("");
  const [dcrResult, setDcrResult] = useState<OAuth2DCRResponse | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Step 2 fields - API Key
  const [apiKeyLocation, setApiKeyLocation] = useState<string>("");
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeyPrefix, setApiKeyPrefix] = useState("");

  // Step 3 fields - Operational Account
  const [operationalAccountAuthType, setOperationalAccountAuthType] =
    useState<string>("");

  const { accessToken, activeOrg, activeRole } = useMetaInfo();

  // Auth method management functions
  const handleAuthMethodChange = (
    method: keyof typeof authMethods,
    checked: boolean,
  ) => {
    setAuthMethods((prev) => ({
      ...prev,
      [method]: checked,
    }));
  };

  const hasSelectedAuthMethod = () => {
    return Object.values(authMethods).some((method) => method);
  };

  const needsStep2 = () => {
    return authMethods.api_key || authMethods.oauth2;
  };

  const needsStep3 = () => {
    return hasSelectedAuthMethod(); // Always show step 3 if any auth method is selected
  };

  const getSelectedAuthMethods = () => {
    return Object.entries(authMethods)
      .filter(([, selected]) => selected)
      .map(([method]) => method);
  };

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

    // Validate auth methods
    if (!hasSelectedAuthMethod()) {
      toast.error("Please select at least one authentication method");
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

    // If needs step 2 (API Key or OAuth2), proceed to step 2
    if (needsStep2()) {
      // If OAuth2 is selected, perform discovery
      if (authMethods.oauth2) {
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
        // For API Key only, go directly to step 2
        setCurrentStep(2);
      }
    } else {
      // For No Auth only, go to step 3 (operational account)
      setCurrentStep(3);
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
        auth_methods: string[];
        url: string;
        transport_type: string;
        description?: string;
        logo?: string;
        categories?: string[];
        // API Key fields
        api_key_location?: string;
        api_key_name?: string;
        api_key_prefix?: string;
        // OAuth2 fields
        authorize_url?: string;
        access_token_url?: string;
        token_endpoint_auth_method_supported?: string[];
        // OAuth2 DCR fields
        oauth2_client_id?: string;
        oauth2_client_secret?: string;
        oauth2_token_endpoint_auth_method?: string;
        // Operational Account
        operational_account_auth_type?: string;
      } = {
        name: name.trim(),
        auth_methods: getSelectedAuthMethods(),
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

      // Add API Key fields if applicable
      if (authMethods.api_key) {
        if (apiKeyLocation) {
          payload.api_key_location = apiKeyLocation;
        }
        if (apiKeyName.trim()) {
          payload.api_key_name = apiKeyName.trim();
        }
        if (apiKeyPrefix.trim()) {
          payload.api_key_prefix = apiKeyPrefix.trim();
        }
      }

      // Add OAuth2 fields if applicable
      if (authMethods.oauth2) {
        payload.authorize_url = authorizeUrl.trim() || undefined;
        payload.access_token_url = tokenUrl.trim() || undefined;
        payload.token_endpoint_auth_method_supported =
          oauth2Config.token_endpoint_auth_method_supported;

        // Add DCR results if available
        if (dcrResult) {
          payload.oauth2_client_id = dcrResult.client_id || undefined;
          payload.oauth2_client_secret = dcrResult.client_secret || undefined;
          payload.oauth2_token_endpoint_auth_method =
            dcrResult.token_endpoint_auth_method;
        }
      }

      // Add operational account auth type
      if (operationalAccountAuthType) {
        payload.operational_account_auth_type = operationalAccountAuthType;
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

  const handleAutoRegisterClient = async () => {
    if (!oauth2Config.registration_url) {
      toast.error("Registration URL not available from OAuth2 discovery");
      return;
    }

    if (!accessToken) {
      toast.error("Authentication required. Please log in.");
      return;
    }

    setIsRegistering(true);

    try {
      const api = createAuthenticatedRequest(
        accessToken,
        activeOrg?.orgId,
        activeRole,
      );

      const response = await api.post<OAuth2DCRResponse>(
        "/mcp-servers/oauth2-dcr",
        {
          mcp_server_url: url.trim(),
          registration_url: oauth2Config.registration_url,
          token_endpoint_auth_method_supported:
            oauth2Config.token_endpoint_auth_method_supported || [],
        },
      );

      setDcrResult(response);
      toast.success("Client registered successfully");
    } catch (error) {
      console.error("Failed to register OAuth2 client:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to register OAuth2 client",
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep(3);
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate operational account auth type
    if (!operationalAccountAuthType) {
      toast.error("Please select an operational account authentication method");
      return;
    }

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
            {currentStep === 1
              ? needsStep3()
                ? `Step ${currentStep} of ${needsStep2() ? "3" : "2"}: Server Details`
                : "Create a new custom MCP server configuration"
              : currentStep === 2
                ? `Step ${currentStep} of 3: Setup Auth Method`
                : currentStep === 3
                  ? `Step ${currentStep} of ${needsStep2() ? "3" : "2"}: Operational Account`
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
                onChange={(e) => {
                  // Only allow uppercase letters, digits, and underscores
                  const filteredValue = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9_]/g, "");
                  setName(filteredValue);
                }}
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
              <Label>
                Authentication Methods <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="no_auth"
                    checked={authMethods.no_auth}
                    onCheckedChange={(checked) =>
                      handleAuthMethodChange("no_auth", checked as boolean)
                    }
                    disabled={isDiscovering}
                  />
                  <Label htmlFor="no_auth" className="text-sm font-normal">
                    No Auth
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="api_key"
                    checked={authMethods.api_key}
                    onCheckedChange={(checked) =>
                      handleAuthMethodChange("api_key", checked as boolean)
                    }
                    disabled={isDiscovering}
                  />
                  <Label htmlFor="api_key" className="text-sm font-normal">
                    API Key
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="oauth2"
                    checked={authMethods.oauth2}
                    onCheckedChange={(checked) =>
                      handleAuthMethodChange("oauth2", checked as boolean)
                    }
                    disabled={isDiscovering}
                  />
                  <Label htmlFor="oauth2" className="text-sm font-normal">
                    OAuth2
                  </Label>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Select one or more authentication methods supported by your
                server.
              </p>
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
                  !hasSelectedAuthMethod() ||
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
                    ? "Registering..."
                    : needsStep2()
                      ? "Next: Setup Auth Method"
                      : "Next: Operational Account"}
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

      {/* Step 2: Setup Auth Method */}
      {currentStep === 2 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Setup Auth Method</h2>
          <form onSubmit={handleStep2Submit} className="space-y-6">
            {authMethods.api_key && (
              <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
                <h3 className="text-md font-medium">API Key Configuration</h3>

                <div className="space-y-2">
                  <Label htmlFor="apiKeyLocation">Location</Label>
                  <Select
                    value={apiKeyLocation}
                    onValueChange={setApiKeyLocation}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Select API key location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="path">PATH</SelectItem>
                      <SelectItem value="query">QUERY</SelectItem>
                      <SelectItem value="header">HEADER</SelectItem>
                      <SelectItem value="cookie">COOKIE</SelectItem>
                      <SelectItem value="body">BODY</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    The location of the API key in the request.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKeyName">Name</Label>
                  <Input
                    id="apiKeyName"
                    type="text"
                    placeholder="X-Subscription-Token"
                    value={apiKeyName}
                    onChange={(e) => setApiKeyName(e.target.value)}
                    disabled={isSubmitting}
                    className="max-w-md"
                  />
                  <p className="text-sm text-muted-foreground">
                    The name of the API key in the request, e.g.,
                    &apos;X-Subscription-Token&apos;.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKeyPrefix">Prefix</Label>
                  <Input
                    id="apiKeyPrefix"
                    type="text"
                    placeholder="Bearer"
                    value={apiKeyPrefix}
                    onChange={(e) => setApiKeyPrefix(e.target.value)}
                    disabled={isSubmitting}
                    className="max-w-md"
                  />
                  <p className="text-sm text-muted-foreground">
                    The prefix of the API key in the request, e.g.,
                    &apos;Bearer&apos;.
                  </p>
                </div>
              </div>
            )}

            {authMethods.oauth2 && (
              <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
                <h3 className="text-md font-medium">OAuth2 Configuration</h3>

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
                  <Label htmlFor="authMethodsSupported">
                    Token Endpoint Auth Methods
                  </Label>
                  <Input
                    id="authMethodsSupported"
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

                {oauth2Config.registration_url && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAutoRegisterClient}
                        disabled={isRegistering || isSubmitting}
                        className="flex items-center gap-2"
                      >
                        {isRegistering ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        {isRegistering
                          ? "Registering..."
                          : "Auto Register Client"}
                      </Button>
                      {dcrResult && (
                        <span className="text-sm text-green-600 font-medium">
                          ✓ Client registered successfully
                        </span>
                      )}
                    </div>

                    {dcrResult && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                        <h4 className="text-sm font-medium text-green-800">
                          Registration Results
                        </h4>
                        <div className="grid grid-cols-1 gap-3 text-sm">
                          <div>
                            <span className="font-medium text-green-700">
                              Auth Method:
                            </span>{" "}
                            <span className="text-green-600">
                              {dcrResult.token_endpoint_auth_method}
                            </span>
                          </div>
                          {dcrResult.client_id && (
                            <div>
                              <span className="font-medium text-green-700">
                                Client ID:
                              </span>{" "}
                              <span className="text-green-600 font-mono text-xs">
                                {dcrResult.client_id}
                              </span>
                            </div>
                          )}
                          {dcrResult.client_secret && (
                            <div>
                              <span className="font-medium text-green-700">
                                Client Secret:
                              </span>{" "}
                              <span className="text-green-600 font-mono text-xs">
                                {"•".repeat(8)}...
                                {dcrResult.client_secret.slice(-4)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
                {isSubmitting ? "Registering..." : "Next: Operational Account"}
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

      {/* Step 3: Operational Account */}
      {currentStep === 3 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Operational Account</h2>
          <form onSubmit={handleStep3Submit} className="space-y-6">
            <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Operational Account is an account primarily used for fetching
                  MCP server information and listening any server changes, for
                  example obtaining tool list. Please select the authentication
                  method used to connect Operational Account.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="operationalAccountAuthType">
                    Operational Account Auth Method{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={operationalAccountAuthType}
                    onValueChange={setOperationalAccountAuthType}
                    disabled={isSubmitting}
                    required
                  >
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Select auth method" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSelectedAuthMethods().map((method) => (
                        <SelectItem key={method} value={method}>
                          {method === "no_auth"
                            ? "No Auth"
                            : method === "api_key"
                              ? "API Key"
                              : method === "oauth2"
                                ? "OAuth2"
                                : method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(needsStep2() ? 2 : 1)}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !operationalAccountAuthType}
                className="flex items-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {isSubmitting ? "Registering..." : "Register Server"}
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
