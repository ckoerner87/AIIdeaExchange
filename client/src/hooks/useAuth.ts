import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Clear React Query cache first
      queryClient.clear();
      // Navigate to logout endpoint
      window.location.href = '/api/logout';
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logoutMutation,
  };
}