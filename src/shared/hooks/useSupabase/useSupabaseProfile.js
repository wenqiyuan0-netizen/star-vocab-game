import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../infrastructure/supabaseClient';
import { useAuth } from '../../../features/auth/contexts/AuthContext';

export function useSupabaseProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    level: 1,
    totalXP: 0,
    checkInDates: [],
    dailyStats: null,
    dailyPlan: null,
    settings: {},
    name: '',
    avatar: null
  });
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error loading profile:', error);
      }

      if (data) {
        setProfile({
          level: data.level || 1,
          totalXP: data.total_xp || 0,
          checkInDates: data.check_in_dates || [],
          dailyStats: data.daily_stats || null,
          dailyPlan: data.daily_plan || null,
          settings: data.settings || {},
          name: data.username || user.email.split('@')[0],
          avatar: data.avatar_url
        });
      } else {
        // Profile might not exist yet (trigger should have created it, but maybe race condition or old user)
        // We can try to upsert it or just use defaults
      }
    } catch (err) {
      console.error('Error in loadProfile:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateProfile = async (updates) => {
    if (!user) return;

    // Convert camelCase to snake_case for DB
    const dbUpdates = {};
    if (updates.level !== undefined) dbUpdates.level = updates.level;
    if (updates.totalXP !== undefined) dbUpdates.total_xp = updates.totalXP;
    if (updates.checkInDates !== undefined) dbUpdates.check_in_dates = updates.checkInDates;
    if (updates.dailyStats !== undefined) dbUpdates.daily_stats = updates.dailyStats;
    if (updates.dailyPlan !== undefined) dbUpdates.daily_plan = updates.dailyPlan;
    if (updates.settings !== undefined) dbUpdates.settings = updates.settings;
    if (updates.name !== undefined) dbUpdates.username = updates.name;
    if (updates.avatar !== undefined) dbUpdates.avatar_url = updates.avatar;

    // Optimistic update
    setProfile(prev => ({ ...prev, ...updates }));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...dbUpdates, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating profile:', err);
      // Revert logic could go here
    }
  };

  // Initialize & Realtime Subscription
  useEffect(() => {
    if (user) {
      loadProfile();

      // Subscribe to realtime changes
      const channel = supabase
        .channel(`public:profiles:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            console.log('Profile updated from remote:', payload);
            const newData = payload.new;
            if (newData) {
              setProfile(prev => ({
                ...prev,
                level: newData.level ?? prev.level,
                totalXP: newData.total_xp ?? prev.totalXP,
                checkInDates: newData.check_in_dates ?? prev.checkInDates,
                dailyStats: newData.daily_stats ?? prev.dailyStats,
                dailyPlan: newData.daily_plan ?? prev.dailyPlan,
                settings: newData.settings ?? prev.settings,
                name: newData.username ?? prev.name,
                avatar: newData.avatar_url ?? prev.avatar
              }));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, loadProfile]);

  return {
    profile,
    updateProfile,
    loading
  };
}
