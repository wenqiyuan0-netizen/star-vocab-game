import { useContext } from 'react';
import { ProfileContext } from '../../contexts/ProfileContext';

export function useSupabaseProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useSupabaseProfile must be used within a ProfileProvider');
  }
  return context;
}
