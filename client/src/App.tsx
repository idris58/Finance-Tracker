import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { storage } from "@/lib/storage";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";

// Lazy load pages for better performance (optional, but good practice)
import Dashboard from "@/pages/Dashboard";
import TransactionsPage from "@/pages/Transactions";
import BudgetPage from "@/pages/Budget";
import SettingsPage from "@/pages/Settings";
import WelcomePage from "@/pages/Welcome";

function AppRouter() {
  const [location] = useLocation();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => storage.getSettings(),
  });

  // Show welcome screen if setup is not complete (unless already on welcome/settings)
  if (!isLoading && settings && !settings.isSetupComplete && location !== '/settings') {
    return <WelcomePage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/transactions" component={TransactionsPage} />
        <Route path="/budget" component={BudgetPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter>
        <TooltipProvider>
          <AppRouter />
          <Toaster />
        </TooltipProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
