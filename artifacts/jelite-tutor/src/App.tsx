import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import { AuthProvider } from "./hooks/useAuth";
import { Analytics } from "@vercel/analytics/react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
  context: {},
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Analytics />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
