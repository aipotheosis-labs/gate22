export interface AppConfig {
  id: string;
  app_name: string;
  security_scheme: string;
  security_scheme_overrides: Record<string, unknown>;
  enabled: boolean;
  all_functions_enabled: boolean;
  enabled_functions: string[];
}
