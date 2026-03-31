import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";

import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLeads from "./pages/AdminLeads";
import AdminSettings from "./pages/AdminSettings";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminPipeline from "./pages/AdminPipeline";
import AdminEvents from "./pages/AdminEvents";
import AdminRanking from "./pages/AdminRanking";
import AdminSuperAdmin from "./pages/AdminSuperAdmin";
import ConsultantsManagement from "./pages/ConsultantsManagement";
import QuizPage from "./pages/Quiz";
import AdminCRM from "./pages/AdminCRM";
import AdminAIConfig from "./pages/AdminAIConfig";
import AdminInstagram from "./pages/AdminInstagram";
import AdminTraffic from "./pages/AdminTraffic";
import CapturePage from "./pages/CapturePage";
import { ProtectedRoute } from "./components/admin/ProtectedRoute";

// QueryClient com cache otimizado para evitar recarregamentos desnecessários
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutos - dados considerados frescos
      gcTime: 10 * 60 * 1000, // 10 minutos - mantém no cache
      refetchOnWindowFocus: false, // Não recarrega ao focar na janela
      refetchOnMount: false, // Não recarrega ao montar se dados estão no cache
      retry: 1,
    },
  },
});

const App = () => {
  // Initialize Meta Pixel with dynamic ID from database
  useMetaPixel();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" storageKey="top-brasil-theme">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/quiz/:slug" element={<QuizPage />} />
              <Route path="/c/:slug" element={<CapturePage />} />
              <Route path="/r/:slug" element={<CapturePage />} />
              <Route path="/login" element={<AdminLogin />} />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/leads"
                element={
                  <ProtectedRoute>
                    <AdminLeads />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute>
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <ProtectedRoute>
                    <AdminAnalytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/pipeline"
                element={
                  <ProtectedRoute>
                    <AdminPipeline />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/events"
                element={
                  <ProtectedRoute>
                    <AdminEvents />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/ranking"
                element={
                  <ProtectedRoute>
                    <AdminRanking />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/super"
                element={
                  <ProtectedRoute>
                    <AdminSuperAdmin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/consultants"
                element={
                  <ProtectedRoute>
                    <ConsultantsManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/crm"
                element={
                  <ProtectedRoute>
                    <AdminCRM />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/ai-config"
                element={
                  <ProtectedRoute>
                    <AdminAIConfig />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/instagram"
                element={
                  <ProtectedRoute>
                    <AdminInstagram />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/traffic"
                element={
                  <ProtectedRoute>
                    <AdminTraffic />
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
