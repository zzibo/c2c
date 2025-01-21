import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProfile } from '@/lib/auth';
import type { VibeType, Profile } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';

/**
 * Hook for updating user vibes with optimistic updates
 * Uses TanStack Query for optimistic UI updates
 */
export function useUpdateVibes() {
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile } = useAuth();

  return useMutation({
    mutationFn: async (vibes: VibeType[]) => {
      if (!user) {
        throw new Error('User not authenticated');
      }
      return await updateProfile(user.id, { vibes });
    },
    // Optimistic update - update UI immediately
    onMutate: async (newVibes: VibeType[]) => {
      if (!user || !profile) return;

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['profile', user.id] });

      // Snapshot the previous value for rollback
      const previousProfile = profile;

      // Return context with previous profile for rollback
      return { previousProfile, newVibes };
    },
    // On success, refresh the profile from server to get latest data
    onSuccess: async (updatedProfile: Profile) => {
      if (!user) return;
      
      // Update query cache with server response
      queryClient.setQueryData(['profile', user.id], updatedProfile);
      
      // Refresh AuthContext profile to update UI
      await refreshProfile();
    },
    // On error, rollback to previous state
    onError: (error, newVibes, context) => {
      if (!user || !context) return;

      // Rollback to previous profile in query cache
      queryClient.setQueryData(['profile', user.id], context.previousProfile);
      
      // Refresh from server to ensure consistency
      refreshProfile();
      
      console.error('Error updating vibes:', error);
    },
    // Always refetch after mutation completes (success or error)
    onSettled: () => {
      if (!user) return;
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    },
  });
}
