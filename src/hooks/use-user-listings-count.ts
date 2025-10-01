import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/auth-context';

export function useUserListingsCount() {
  const { user } = useAuthContext();
  const [listingsCount, setListingsCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchListingsCount();
    } else {
      setListingsCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user.id to avoid infinite loops

  const fetchListingsCount = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { count, error: countError } = await supabase
        .from('spaces')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user.id);

      if (countError) {
        throw countError;
      }

      setListingsCount(count || 0);
    } catch (error) {
      console.error('Error fetching listings count:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch listings count');
      setListingsCount(0);
    } finally {
      setLoading(false);
    }
  };

  const hasListings = listingsCount > 0;

  return {
    listingsCount,
    hasListings,
    loading,
    error,
    refetch: fetchListingsCount
  };
}
