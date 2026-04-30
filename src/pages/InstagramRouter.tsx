import { useQuery } from "@tanstack/react-query";
import { getCurrentConsultant, isSuperAdmin } from "@/lib/consultant-context";
import AdminInstagram from "./AdminInstagram";
import ConsultantInstagram from "./ConsultantInstagram";
import { Loader2 } from "lucide-react";

const InstagramRouter = () => {
  const { data: user, isLoading } = useQuery({
    queryKey: ["current-user-instagram-router"],
    queryFn: getCurrentConsultant,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return user?.role && isSuperAdmin(user.role) ? <AdminInstagram /> : <ConsultantInstagram />;
};

export default InstagramRouter;
