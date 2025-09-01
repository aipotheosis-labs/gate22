import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getApiKey } from "@/lib/api-utils";
import { ConnectedAccount } from "@/features/connected-accounts/types/connectedaccount.types";
import { Agent } from "../types/agent.types";
import { getAllConnectedAccounts } from "@/features/connected-accounts/api/connectedaccount";
import { getApps } from "@/features/apps/api/app";
import { App } from "@/features/apps/types/app.types";
import { AppFunction } from "@/features/apps/types/appfunction.types";
import { searchFunctions } from "@/features/apps/api/appfunction";

interface AgentState {
  allowedApps: string[];
  selectedApps: string[];
  selectedConnectedAccountOwnerId: string;
  selectedFunctions: string[];
  selectedAgent: string;
  connectedAccounts: ConnectedAccount[];
  agents: Agent[];
  apps: App[];
  appFunctions: AppFunction[];
  loadingFunctions: boolean;
  setSelectedApps: (apps: string[]) => void;
  setSelectedConnectedAccountOwnerId: (id: string) => void;
  setAllowedApps: (apps: string[]) => void;
  setSelectedFunctions: (functions: string[]) => void;
  setSelectedAgent: (id: string) => void;
  setAgents: (agents: Agent[]) => void;
  getApiKey: (accessToken: string) => string;
  fetchConnectedAccounts: (apiKey: string) => Promise<ConnectedAccount[]>;
  getUniqueConnectedAccounts: () => ConnectedAccount[];
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
      selectedConnectedAccountOwnerId: "",
      allowedApps: [],
      selectedFunctions: [],
      selectedAgent: "",
      connectedAccounts: [],
      agents: [],
      apps: [],
      appFunctions: [],
      loadingFunctions: false,
      setSelectedApps: (apps: string[]) =>
        set((state) => ({ ...state, selectedApps: apps })),
      setSelectedConnectedAccountOwnerId: (id: string) =>
        set((state) => ({ ...state, selectedConnectedAccountOwnerId: id })),
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
      fetchConnectedAccounts: async (apiKey: string) => {
        try {
          const accounts = await getAllConnectedAccounts(apiKey);
          set((state) => ({ ...state, connectedAccounts: accounts }));
          return accounts;
        } catch (error) {
          console.error("Failed to fetch connected accounts:", error);
          throw error;
        }
      },
      getUniqueConnectedAccounts: () => {
        const connectedAccounts = get().connectedAccounts;
        const uniqueConnectedAccounts = Array.from(
          new Map(
            connectedAccounts.map((account) => [account.user_id, account]),
          ).values(),
        );
        return uniqueConnectedAccounts;
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
        // filter from connected accounts
        if (!get().selectedConnectedAccountOwnerId) {
          filteredApps = filteredApps.filter((app) =>
            get().connectedAccounts.some(
              (connectedAccount) =>
                connectedAccount.mcp_server_configuration?.mcp_server?.name ===
                app.name,
            ),
          );
        } else {
          filteredApps = filteredApps.filter((app) =>
            get().connectedAccounts.some(
              (connectedAccount) =>
                connectedAccount.mcp_server_configuration?.mcp_server?.name ===
                  app.name &&
                connectedAccount.user_id ===
                  get().selectedConnectedAccountOwnerId,
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
        selectedConnectedAccountOwnerId: state.selectedConnectedAccountOwnerId,
        selectedFunctions: state.selectedFunctions,
        selectedAgent: state.selectedAgent,
      }),
    },
  ),
);
