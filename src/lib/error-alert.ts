import { toast } from 'sonner';

/**
 * Global error alert wrapper — wraps async functions and shows toast on failure.
 * Use around any function call that might fail silently.
 */
export async function withErrorAlert<T>(
  fn: () => Promise<T>,
  contexto: string,
): Promise<T | null> {
  try {
    return await fn();
  } catch (err: any) {
    const message = err?.message || 'Erro desconhecido';
    console.error(`[ERRO] ${contexto}:`, err);
    toast.error(`Falha: ${contexto}`, {
      description: message,
      duration: 8000,
    });
    return null;
  }
}

/**
 * Sync version for non-async functions
 */
export function withErrorAlertSync<T>(
  fn: () => T,
  contexto: string,
): T | null {
  try {
    return fn();
  } catch (err: any) {
    const message = err?.message || 'Erro desconhecido';
    console.error(`[ERRO] ${contexto}:`, err);
    toast.error(`Falha: ${contexto}`, {
      description: message,
      duration: 8000,
    });
    return null;
  }
}
