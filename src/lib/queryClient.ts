import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const DATABASE_CHANGE_CHANNEL = "finance-tracker:database-change";

if (typeof BroadcastChannel !== "undefined") {
  const databaseChangeChannel = new BroadcastChannel(DATABASE_CHANGE_CHANNEL);
  databaseChangeChannel.addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type === "invalidate-queries") {
      void queryClient.invalidateQueries();
    }
  });
}
