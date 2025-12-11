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

    // Separate updates
    const { level, totalXP, ...metadataUpdates } = updates;

    // 1. Prepare Metadata Updates (Standard UPDATE)
    const dbUpdates = {};
    if (metadataUpdates.checkInDates !== undefined) dbUpdates.check_in_dates = metadataUpdates.checkInDates;
    if (metadataUpdates.dailyStats !== undefined) dbUpdates.daily_stats = metadataUpdates.dailyStats;
    if (metadataUpdates.dailyPlan !== undefined) dbUpdates.daily_plan = metadataUpdates.dailyPlan;
    if (metadataUpdates.settings !== undefined) dbUpdates.settings = metadataUpdates.settings;
    if (metadataUpdates.name !== undefined) dbUpdates.username = metadataUpdates.name;
    if (metadataUpdates.avatar !== undefined) dbUpdates.avatar_url = metadataUpdates.avatar;

    // Optimistic update
    setProfile(prev => ({ ...prev, ...updates }));

    try {
      const promises = [];

      // Execute Metadata Update
      if (Object.keys(dbUpdates).length > 0) {
        promises.push(
          supabase
            .from('profiles')
            .update({ ...dbUpdates, updated_at: new Date().toISOString() })
            .eq('id', user.id)
        );
      }

      // Execute XP/Level Update (Secure RPC)
      // We calculate the delta because our RPC is add_xp(amount)
      // This is safer for concurrency and allows backend validation
      if (totalXP !== undefined || level !== undefined) {
        const currentXP = profile.totalXP || 0;
        const targetXP = totalXP !== undefined ? totalXP : currentXP;
        const xpDelta = targetXP - currentXP;

        // Only call RPC if there is a positive change or a level change
        // We allow 0 delta if level is changing (e.g. manual level up without XP? Unlikely but possible)
        if (xpDelta > 0 || (level !== undefined && level !== profile.level)) {
             promises.push(
               supabase.rpc('add_xp', { 
                 xp_amount: Math.max(0, xpDelta), 
                 new_level: level 
               })
             );
        }
      }

      const results = await Promise.all(promises);
      
      // Check for errors
      results.forEach(({ error }) => {
        if (error) throw error;
      });

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
