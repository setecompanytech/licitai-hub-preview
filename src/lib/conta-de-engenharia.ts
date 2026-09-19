/**
 * A conta de engenharia da plataforma — `engsoft@praefectus.com.br`
 * (decisão do Rafael em 14/09, confirmada pelo Ian em 19/09/2026).
 *
 * É quem opera o SaaS: o grupo Admin, a tela remota do robô, o agente, o
 * servidor. Ela NÃO é membro de cliente nenhum — enxerga a operação pelo Admin,
 * sem se misturar aos dados de negócio das empresas (o incidente de 16/09 veio
 * justamente de uma conta da plataforma entrar numa empresa de cliente).
 *
 * A definição é por fato, não por e-mail: **admin da plataforma sem empresa
 * nenhuma**. Hoje só o engsoft@ se encaixa; a `comercial@gruposantarosa`,
 * login do dono do produto e também admin da plataforma (os dois coexistem,
 * decisão de 19/09), está na Santa Rosa e fica de fora — a regra não a atinge.
 *
 * O que a regra decide na tela: o seletor não oferece "Cadastrar empresa", o
 * assistente de boas-vindas não abre, a página de empresas não cadastra e a
 * `addEmpresa` recusa. A trava de verdade é a do banco (migration
 * `20260919000003`): esta aqui só evita oferecer uma porta que ele fecharia.
 */

export const MENSAGEM_CONTA_DE_ENGENHARIA =
  'A conta de engenharia da plataforma não cadastra nem entra em empresa: ela opera o sistema pelo Admin, fora dos dados dos clientes.';

export function ehContaDeEngenharia(conta: { isSystemAdmin: boolean; totalDeEmpresas: number }): boolean {
  return conta.isSystemAdmin && conta.totalDeEmpresas === 0;
}
