import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getApiKey } from "@/lib/api-utils";
import { LinkedAccount } from "@/features/linked-accounts/types/linkedaccount.types";
import { Agent } from "../types/agent.types";
import { getAllLinkedAccounts } from "@/features/linked-accounts/api/linkedaccount";
import { getApps } from "@/features/apps/api/app";
import { App } from "@/features/apps/types/app.types";
import { AppFunction } from "@/features/apps/types/appfunction.types";
import { searchFunctions } from "@/features/apps/api/appfunction";

interface AgentState {
  allowedApps: string[];
  selectedApps: string[];
  selectedLinkedAccountOwnerId: string;
  selectedFunctions: string[];
  selectedAgent: string;
  linkedAccounts: LinkedAccount[];
  agents: Agent[];
  apps: App[];
  appFunctions: AppFunction[];
  loadingFunctions: boolean;
  setSelectedApps: (apps: string[]) => void;
  setSelectedLinkedAccountOwnerId: (id: string) => void;
  setAllowedApps: (apps: string[]) => void;
  setSelectedFunctions: (functions: string[]) => void;
  setSelectedAgent: (id: string) => void;
  setAgents: (agents: Agent[]) => void;
  getApiKey: (accessToken: string) => string;
  fetchLinkedAccounts: (apiKey: string) => Promise<LinkedAccount[]>;
  getUniqueLinkedAccounts: () => LinkedAccount[];
  fetchApps: (apiKey: string) => Promise<App[]>;
  getAvailableApps: () => App[];
  fetchAppFunctions: (apiKey: string) => Promise<AppFunction[]>;
  getAvailableAppFunctions: () => AppFunction[];
  initializeFromAgents: (agents: Agent[]) => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      selectedApps: [],
      selectedLinkedAccountOwnerId: "",
      allowedApps: [],
      selectedFunctions: [],
      selectedAgent: "",
      linkedAccounts: [],
      agents: [],
      apps: [],
      appFunctions: [],
      loadingFunctions: false,
      setSelectedApps: (apps: string[]) =>
        set((state) => ({ ...state, selectedApps: apps })),
      setSelectedLinkedAccountOwnerId: (id: string) =>
        set((state) => ({ ...state, selectedLinkedAccountOwnerId: id })),
      setAllowedApps: (apps: string[]) =>
        set((state) => ({ ...state, allowedApps: apps })),
      setSelectedFunctions: (functions: string[]) =>
        set((state) => ({ ...state, selectedFunctions: functions })),
      setSelectedAgent: (id: string) =>
        set((state) => ({ ...state, selectedAgent: id })),
      setAgents: (agents: Agent[]) =>
        set((state) => ({ ...state, agents: agents })),
      getApiKey: (accessToken: string) => {
        return getApiKey(accessToken);
      },
      fetchLinkedAccounts: async (apiKey: string) => {
        try {
          const accounts = await getAllLinkedAccounts(apiKey);
          set((state) => ({ ...state, linkedAccounts: accounts }));
          return accounts;
        } catch (error) {
          console.error("Failed to fetch linked accounts:", error);
          throw error;
        }
      },
      getUniqueLinkedAccounts: () => {
        const linkedAccounts = get().linkedAccounts;
        const uniqueLinkedAccounts = Array.from(
          new Map(
            linkedAccounts.map((account) => [account.user_id, account]),
          ).values(),
        );
        return uniqueLinkedAccounts;
      },

      fetchApps: async (apiKey: string) => {
        try {
          const apps = await getApps([], apiKey);
          set((state) => ({ ...state, apps: apps }));
          return apps;
        } catch (error) {
          console.error("Failed to fetch apps:", error);
          throw error;
        }
      },
      getAvailableApps: () => {
        let filteredApps = get().apps.filter((app) =>
          get().allowedApps.includes(app.name),
        );
        // filter from linked accounts
        if (!get().selectedLinkedAccountOwnerId) {
          filteredApps = filteredApps.filter((app) =>
            get().linkedAccounts.some(
              (linkedAccount) =>
                linkedAccount.mcp_server_configuration?.mcp_server?.name ===
                app.name,
            ),
          );
        } else {
          filteredApps = filteredApps.filter((app) =>
            get().linkedAccounts.some(
              (linkedAccount) =>
                linkedAccount.mcp_server_configuration?.mcp_server?.name ===
                  app.name &&
                linkedAccount.user_id === get().selectedLinkedAccountOwnerId,
            ),
          );
        }
        return filteredApps;
      },
      fetchAppFunctions: async (apiKey: string) => {
        set((state) => ({ ...state, loadingFunctions: true }));
        try {
          let functionsData = await searchFunctions(
            {
              allowed_apps_only: true,
              limit: 1000,
            },
            apiKey,
          );
          functionsData = functionsData.sort((a, b) =>
            a.name.localeCompare(b.name),
          );

          set((state) => ({ ...state, appFunctions: functionsData }));
          return functionsData;
        } catch (error) {
          console.error("Failed to fetch functions:", error);
          throw error;
        } finally {
          set((state) => ({ ...state, loadingFunctions: false }));
        }
      },
      getAvailableAppFunctions: () => {
        const { selectedApps } = get();
        if (selectedApps.length === 0) {
          return [];
        }
        return get().appFunctions.filter((func) =>
          selectedApps.some((appName) =>
            func.name.startsWith(`${appName.toUpperCase()}__`),
          ),
        );
      },
      initializeFromAgents: (agents: Agent[]) => {
        if (agents && agents.length > 0) {
          // After the selected agent's loaded from session storage,
          // we need to check if the selected agent is still in the agents list.
          // If not, we need to set the default agent to the first agent.
          const currentSelectedAgent = get().selectedAgent;
          let selectedAgent = currentSelectedAgent;

          if (!agents.find((agent) => agent.id === currentSelectedAgent)) {
            selectedAgent = agents[0].id;
          }

          set((state) => ({
            ...state,
            agents: agents,
            selectedAgent: selectedAgent,
            allowedApps:
              agents.find((agent) => agent.id === selectedAgent)
                ?.allowed_apps || [],
          }));
        }
      },
    }),
    {
      name: "agent-config-history",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        selectedApps: state.selectedApps,
        selectedLinkedAccountOwnerId: state.selectedLinkedAccountOwnerId,
        selectedFunctions: state.selectedFunctions,
        selectedAgent: state.selectedAgent,
      }),
    },
  ),
);
