import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { storage } from "@/lib/storage";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";
import { ThemeProvider } from "next-themes";
import { TransactionEditorProvider } from "@/components/TransactionEditorProvider";

// Lazy load pages for better performance (optional, but good practice)
import HomePage from "@/pages/Home";
import StatisticsPage from "@/pages/Statistics";
import AccountsPage from "@/pages/Accounts";
import TransactionsPage from "@/pages/Transactions";
import SettingsPage from "@/pages/Settings";
import WelcomePage from "@/pages/Welcome";

function AppRouter() {
  const [location] = useLocation();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => storage.getSettings(),
  });

  // Show welcome screen if setup is not complete (unless already on welcome/settings)
  if (!isLoading && settings && !settings.isSetupComplete) {
    return <WelcomePage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/statistics" component={StatisticsPage} />
        <Route path="/accounts" component={AccountsPage} />
        <Route path="/transactions" component={TransactionsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TransactionEditorProvider>
          <WouterRouter>
            <TooltipProvider>
              <AppRouter />
              <Toaster />
            </TooltipProvider>
          </WouterRouter>
        </TransactionEditorProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
