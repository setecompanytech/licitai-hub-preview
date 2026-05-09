import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMaintenanceMode() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadMaintenanceMode = async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 3000);

      try {
        const { data, error } = await supabase
          .from('site_config')
          .select('valor')
          .eq('chave', 'maintenance_mode')
          .abortSignal(controller.signal)
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
        window.clearTimeout(timeoutId);
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
