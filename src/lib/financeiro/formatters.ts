// ============================================================================
// PRAEFECTUS — Formatters financeiros
// Path no Lovable: src/lib/financeiro/formatters.ts
// ============================================================================

export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const formatBRL = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return "R$ 0,00";
  return BRL.format(n);
};

export const formatBRLCompact = (n: number): string => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}K`;
  return formatBRL(n);
};

export const formatPercent = (n: number, decimals = 1): string =>
  `${(n * 100).toFixed(decimals)}%`;

// ----------------------------------------------------------------------------
// Datas
// ----------------------------------------------------------------------------

export const formatDate = (d: string | Date | null | undefined): string => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return date.toLocaleDateString("pt-BR");
};

export const formatDateTime = (d: string | Date): string => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatRelativeDate = (d: string): string => {
  const date = new Date(d + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - today.getTime()) / 86400000);

  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  if (diff > 0 && diff <= 7) return `Em ${diff} dias`;
  if (diff < 0 && diff >= -7) return `${Math.abs(diff)} dias atrás`;
  return formatDate(d);
};

// ----------------------------------------------------------------------------
// Documentos brasileiros
// ----------------------------------------------------------------------------

export const formatCPF = (cpf: string): string => {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11) return cpf;
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
};

export const formatCNPJ = (cnpj: string): string => {
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
};

export const formatDocumento = (doc: string): string => {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return formatCPF(d);
  if (d.length === 14) return formatCNPJ(d);
  return doc;
};

export const maskDocumento = (doc: string): string => {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return `***.***.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.***.***/${d.slice(8, 12)}-**`;
  return doc;
};

// ----------------------------------------------------------------------------
// Validações
// ----------------------------------------------------------------------------

export const isValidCPF = (cpf: string): boolean => {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (slice: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += +slice[i] * (factor - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(c.slice(0, 9), 10) === +c[9] && calc(c.slice(0, 10), 11) === +c[10];
};

export const isValidCNPJ = (cnpj: string): boolean => {
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string, factors: number[]) => {
    let sum = 0;
    for (let i = 0; i < factors.length; i++) sum += +base[i] * factors[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const f1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const f2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return calc(c.slice(0, 12), f1) === +c[12] && calc(c.slice(0, 13), f2) === +c[13];
};

// ----------------------------------------------------------------------------
// Status helpers
// ----------------------------------------------------------------------------

export const statusLabel: Record<string, string> = {
  previsto: "Previsto",
  realizado: "Realizado",
  conciliado: "Conciliado",
  cancelado: "Cancelado",
  em_atraso: "Em atraso",
};

export const statusColor: Record<string, string> = {
  previsto: "bg-amber-100 text-amber-800 ring-amber-200",
  realizado: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  conciliado: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  cancelado: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  em_atraso: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const tipoLabel: Record<string, string> = {
  a_pagar: "A Pagar",
  a_receber: "A Receber",
  movimento_bancario: "Movimento",
  transferencia: "Transferência",
};
