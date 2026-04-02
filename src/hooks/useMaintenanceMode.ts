import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMaintenanceMode() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('site_config')
      .select('valor')
      .eq('chave', 'maintenance_mode')
      .single()
      .then(({ data }) => {
        setIsMaintenanceMode(data?.valor === 'true');
        setLoading(false);
      });
  }, []);

  return { isMaintenanceMode, loading };
}
