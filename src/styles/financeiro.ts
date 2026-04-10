// Design System Financeiro — Praefectus v2.0
export const DESIGN = {
  fundo: '#EEF0F4',
  card: '#FFFFFF',
  borda: '#E2E6ED',
  borda2: '#F0F2F5',
  texto1: '#1C2436',
  texto2: '#4A5568',
  texto3: '#8492A8',
  texto4: '#B8BFCC',
  dourado: '#C9A84C',
  verde: '#15803D',
  verde_bg: '#F0FBF4',
  vermelho: '#DC2626',
  vermelho_bg: '#FEF2F2',
  ambar: '#D97706',
  ambar_bg: '#FFFBEB',
  azul: '#2563EB',
  azul_bg: '#EFF6FF',

  badgeCategoria: {
    receita_bruta: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    deducoes_receita: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    receita_financeira: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    custo_produto: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    despesa_operacional: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
    despesa_financeira: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    outras_despesas: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  } as Record<string, string>,
} as const;

// Formatação monetária PT-BR
export const fmtMoney = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// Formatação de data PT-BR
export const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const parts = d.split('T')[0].split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

// Classe CSS para valores monetários
export const moneyClass = (v: number) =>
  v > 0 ? 'text-green-700 dark:text-green-400' :
  v < 0 ? 'text-red-600 dark:text-red-400' :
  'text-foreground';
