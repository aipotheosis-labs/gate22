import { useMetaInfo } from "@/components/context/metainfo";
import { getAllApps } from "@/features/apps/api/app";
import { getApiKey } from "@/lib/api-utils";
import { useQuery } from "@tanstack/react-query";

export const appKeys = {
  all: ["apps"] as const,
};

export function useApps(appNames?: string[]) {
  const { accessToken } = useMetaInfo();
  const apiKey = getApiKey(accessToken);

  return useQuery({
    queryKey: appKeys.all,
    queryFn: () => getAllApps(apiKey),
    select: (data) => {
      if (!appNames || appNames.length === 0) {
        return data;
      }
      return data.filter((app) => appNames.includes(app.name));
    },
  });
}

export function useApp(appName: string) {
  const query = useApps([appName]);
  return {
    app: query.data?.[0],
    ...query,
  };
}
