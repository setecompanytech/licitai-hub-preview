import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMaintenanceMode() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadMaintenanceMode = async () => {
      try {
        const { data, error } = await supabase
          .from('site_config')
          .select('valor')
          .eq('chave', 'maintenance_mode')
          .maybeSingle();

        if (error) throw error;

        if (isMounted) {
          setIsMaintenanceMode(data?.valor === 'true');
        }
      } catch (error) {
        console.warn('Falha ao carregar modo de manutenção; seguindo com acesso normal.', error);

        if (isMounted) {
          setIsMaintenanceMode(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadMaintenanceMode();

    return () => {
      isMounted = false;
    };
  }, []);

  return { isMaintenanceMode, loading };
}
