const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function numeroParaExtenso(valor: number): string {
  if (valor === 0) return "zero";
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
    "seiscentos", "setecentos", "oitocentos", "novecentos"];

  const converterGrupo = (n: number): string => {
    if (n === 0) return "";
    if (n === 100) return "cem";
    const grupos: string[] = [];
    if (n >= 100) grupos.push(centenas[Math.floor(n / 100)]);
    const resto = n % 100;
    if (resto > 0 && resto < 20) {
      grupos.push(unidades[resto]);
    } else {
      if (Math.floor(resto / 10) > 0) grupos.push(dezenas[Math.floor(resto / 10)]);
      if (resto % 10 > 0) grupos.push(unidades[resto % 10]);
    }
    return grupos.join(" e ");
  };

  const inteiro = Math.floor(Math.abs(valor));
  const centavos = Math.round((Math.abs(valor) - inteiro) * 100);
  const partes: string[] = [];

  if (inteiro >= 1000000000) {
    const bilhoes = Math.floor(inteiro / 1000000000);
    partes.push(converterGrupo(bilhoes) + (bilhoes === 1 ? " bilhão" : " bilhões"));
  }
  if (inteiro >= 1000000) {
    const milhoes = Math.floor((inteiro % 1000000000) / 1000000);
    if (milhoes > 0) partes.push(converterGrupo(milhoes) + (milhoes === 1 ? " milhão" : " milhões"));
  }
  const milhares = Math.floor((inteiro % 1000000) / 1000);
  if (milhares > 0) partes.push((milhares === 1 ? "" : converterGrupo(milhares) + " ") + "mil");
  const unidadesResto = inteiro % 1000;
  if (unidadesResto > 0) partes.push(converterGrupo(unidadesResto));

  let resultado = partes.length > 1
    ? partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1]
    : partes[0] || "";

  if (inteiro > 0) resultado += inteiro === 1 ? " real" : " reais";

  if (centavos > 0) {
    if (inteiro > 0) resultado += " e ";
    resultado += converterGrupo(centavos) + (centavos === 1 ? " centavo" : " centavos");
  }

  return resultado || "zero";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const dados = await req.json();
    const {
      empresa, cnpj, endereco, cidade, uf, cep, telefone, email,
      logoUrl,
      banco, agencia, contaCorrente, pix, tipoConta,
      responsavelNome, responsavelCpf, responsavelRg, responsavelCargo, responsavelEstadoCivil,
      orgaoNome, unidadeNome, numeroLicitacao, processoAdministrativo, modalidade,
      objetoLicitacao,
      itens,
      prazoEntrega, localEntrega, prazoValidade, condicoesPagamento,
      condicoesLiquidacao, condicoesEntrega, garantia,
      declaracoes,
      inscEstadual, inscMunicipal,
      cidade_proposta, data_proposta,
    } = dados;

    const totalGeral = (itens || []).reduce((s: number, i: any) => s + (Number(i.valor_total) || 0), 0);
    const totalExtenso = numeroParaExtenso(totalGeral);
    const fmtMoeda = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    const dataFormatada = data_proposta
      ? new Date(data_proposta).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

    const linhasItens = (itens || []).map((item: any) => {
      const vUnit = Number(item.valor_unitario) || 0;
      const qtd = Number(item.quantidade) || 0;
      const vTotal = vUnit * qtd || Number(item.valor_total) || 0;
      return `
        <tr>
          <td style="border:1px solid #000;padding:6px 8px;text-align:center;font-weight:700;">${item.numero_item || item.item || ''}</td>
          <td style="border:1px solid #000;padding:6px 8px;text-align:center;">${item.unidade_medida || item.unidade || ''}</td>
          <td style="border:1px solid #000;padding:6px 8px;text-align:center;">${qtd.toLocaleString("pt-BR")}</td>
          <td style="border:1px solid #000;padding:6px 8px;font-size:11px;line-height:1.4;">${item.descricao || ''}</td>
          <td style="border:1px solid #000;padding:6px 8px;text-align:center;">${item.marca || '-'}</td>
          <td style="border:1px solid #000;padding:6px 8px;text-align:right;">${fmtMoeda(vUnit)}</td>
          <td style="border:1px solid #000;padding:6px 8px;font-size:10px;line-height:1.3;font-style:italic;">${numeroParaExtenso(vUnit)}</td>
          <td style="border:1px solid #000;padding:6px 8px;text-align:right;font-weight:700;">${fmtMoeda(vTotal)}</td>
          <td style="border:1px solid #000;padding:6px 8px;font-size:10px;line-height:1.3;font-style:italic;">${numeroParaExtenso(vTotal)}</td>
        </tr>`;
    }).join("");

    const declaracoesHtml = (declaracoes || []).map((d: string) =>
      `<p><strong>DECLARA-SE</strong> ${d}</p>`
    ).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Proposta Comercial — ${empresa || ''}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; background: #FFF; }
    .pagina { max-width: 210mm; margin: 0 auto; padding: 20mm 20mm 15mm 20mm; }
    .timbrado { text-align: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #000; }
    .timbrado img { max-height: 100px; max-width: 400px; }
    .timbrado-texto { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
    .timbrado-subtexto { font-size: 11px; color: #444; margin-top: 4px; }
    .cabecalho-proposta { text-align: center; margin-bottom: 20px; }
    .cabecalho-proposta h1 { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; border: 2px solid #000; padding: 8px 20px; display: inline-block; }
    .cabecalho-proposta .ref { font-size: 12px; margin-top: 6px; }
    .destinatario { margin-bottom: 16px; line-height: 1.8; }
    .destinatario .a-label { font-size: 24px; font-style: italic; display: block; margin-bottom: 4px; }
    .apresentacao { margin-bottom: 20px; line-height: 1.6; text-align: justify; }
    table.itens { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
    table.itens th { background: #333; color: #FFF; padding: 6px 8px; text-align: center; font-weight: 700; border: 1px solid #000; font-size: 11px; text-transform: uppercase; }
    table.itens .total-row td { background: #F3F4F6; font-weight: 700; border: 2px solid #000; padding: 8px; }
    .secao { margin-bottom: 14px; line-height: 1.6; text-align: justify; }
    .secao-titulo { font-weight: 900; text-decoration: underline; text-transform: uppercase; font-size: 12px; }
    .declaracoes { margin-bottom: 16px; }
    .declaracoes p { margin-bottom: 8px; line-height: 1.6; text-align: justify; }
    .identificacao-empresa { margin: 16px 0; line-height: 1.8; border-top: 1px solid #999; padding-top: 12px; }
    .assinatura { margin-top: 32px; text-align: right; }
    .assinatura .cidade-data { margin-bottom: 40px; }
    .assinatura .linha-assinatura { border-top: 1px solid #000; display: inline-block; padding-top: 6px; min-width: 260px; text-align: center; }
    .rodape-contato { margin-top: 24px; border-top: 1px solid #999; padding-top: 10px; display: flex; gap: 24px; justify-content: center; font-size: 11px; color: #444; }
    @media print { .pagina { padding: 15mm; } @page { margin: 0; } }
  </style>
</head>
<body>
<div class="pagina">

  <!-- TIMBRADO -->
  <div class="timbrado">
    ${logoUrl
      ? `<img src="${logoUrl}" alt="Timbrado ${empresa}" />`
      : `<div class="timbrado-texto">${empresa || ''}</div>
         <div class="timbrado-subtexto">CNPJ: ${cnpj || ''}</div>`}
  </div>

  <!-- DESTINATÁRIO -->
  <div class="destinatario">
    <span class="a-label">A</span>
    <strong>${orgaoNome || ''}</strong><br>
    ${unidadeNome ? unidadeNome + "<br>" : ""}
  </div>

  <!-- REFERÊNCIA -->
  <div class="cabecalho-proposta">
    <h1>PROPOSTA COMERCIAL</h1>
    <div class="ref">
      Ref.: ${modalidade || "Pregão Eletrônico"} Nº ${numeroLicitacao || ''}.
      ${processoAdministrativo ? "Processo Administrativo N°. " + processoAdministrativo + "." : ""}
    </div>
  </div>

  <!-- APRESENTAÇÃO -->
  <div class="apresentacao">
    A empresa <strong>${empresa || ''}</strong>, devidamente inscrita no Ministério da Fazenda sob o
    CNPJ nº. <strong>${cnpj || ''}</strong>, com sede na ${endereco || ''},
    por intermédio de seu representante legal, infra-assinado, apresenta a seguinte
    <strong>PROPOSTA COMERCIAL:</strong>
  </div>

  <!-- TABELA DE ITENS -->
  <table class="itens">
    <thead>
      <tr>
        <th style="width:40px;">ITEM</th>
        <th style="width:70px;">UNIDADE</th>
        <th style="width:60px;">QUANT</th>
        <th>ESPECIFICAÇÃO TÉCNICA</th>
        <th style="width:80px;">MARCA</th>
        <th style="width:90px;">VL. UNIT.</th>
        <th style="width:110px;">EXTENSO</th>
        <th style="width:90px;">VL. TOTAL</th>
        <th style="width:110px;">EXTENSO</th>
      </tr>
    </thead>
    <tbody>
      ${linhasItens}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="7" style="text-align:right;padding:8px 12px;border:2px solid #000;">
          <em>${totalExtenso}</em>
        </td>
        <td colspan="2" style="text-align:center;border:2px solid #000;font-size:13px;">
          ${fmtMoeda(totalGeral)}
        </td>
      </tr>
    </tfoot>
  </table>

  <!-- INCLUSÃO DE ENCARGOS -->
  <div class="secao">
    Nos valores propostos acima, estão inclusos todos e quaisquer encargos inerentes ao
    fornecimento do objeto desta proposta, tais como: tributos, taxas, transportes, carregamento,
    descarregamento, encargos sociais, trabalhistas, frete, seguro, e outros que, direta e
    indiretamente, incidam sobre o perfeito e integral cumprimento da proposta apresentada.
  </div>

  <!-- CONDIÇÕES DE PAGAMENTO -->
  <div class="secao">
    <span class="secao-titulo">Condições de Pagamento:</span>
    ${condicoesPagamento || "O pagamento será realizado no prazo de até 30 (trinta) dias corridos, contados a partir do recebimento da nota fiscal ou fatura, através de ordem bancária, para crédito em banco, agência e conta corrente, indicados pela Contratada."}
  </div>

  <!-- CONDIÇÕES DE ENTREGA -->
  <div class="secao">
    <span class="secao-titulo">Condições de Entrega:</span>
    ${prazoEntrega || "As entregas serão realizadas em dias úteis, de segunda a sexta-feira, no horário de 08h00 às 16h00, mediante agendamento prévio e apresentação da Ordem de Fornecimento ou Pedido de Entrega emitido pelo Contratante."}
  </div>

  <!-- LOCAL DE ENTREGA -->
  ${localEntrega ? `
  <div class="secao">
    <span class="secao-titulo">Local de Entrega:</span>
    ${localEntrega}
  </div>` : ""}

  <!-- CONDIÇÕES DE ENTREGA ESPECIAIS -->
  ${condicoesEntrega ? `
  <div class="secao">
    <span class="secao-titulo">Condições Especiais de Entrega:</span>
    ${condicoesEntrega}
  </div>` : ""}

  <!-- LIQUIDAÇÃO/NFe -->
  ${condicoesLiquidacao ? `
  <div class="secao">
    <span class="secao-titulo">Liquidação / Nota Fiscal:</span>
    ${condicoesLiquidacao}
  </div>` : ""}

  <!-- GARANTIA -->
  <div class="secao">
    <span class="secao-titulo">Garantia:</span>
    ${garantia || "O prazo de garantia para o fornecimento de produtos é aquele estabelecido na Lei nº 8.078/1990 (Código de Defesa do Consumidor)."}
  </div>

  <!-- PRAZO DE VALIDADE -->
  <div class="secao">
    <span class="secao-titulo">Prazo de Validade desta Proposta:</span>
    O prazo de validade da proposta não será inferior a
    <strong>${prazoValidade || "60 (sessenta) dias"}</strong>,
    a contar da data de sua apresentação.
  </div>

  <!-- DECLARAÇÕES LEGAIS -->
  <div class="declaracoes">
    ${declaracoesHtml || `
    <p>DECLARA-SE que os produtos/serviços constantes desta proposta comercial ofertada atendem
    fielmente as Especificações Técnicas constantes do Termo de Referência – Anexo I do respectivo Edital.</p>
    <p><strong>DECLARA-SE</strong> também:</p>
    <p><strong>Declaração</strong> de que cumprirá todos os prazos estabelecidos no Edital e seus Anexos.</p>
    <p><strong>Declaração</strong> de inexistência de fato impeditivo de sua habilitação.</p>
    <p><strong>Declaração</strong> de fidelidade e veracidade dos documentos apresentados.</p>
    <p><strong>Declaração</strong> de que concorda com os termos do edital.</p>
    <p><strong>Declaração</strong> de que não emprega menor de 18 (dezoito) anos em trabalho noturno, perigoso ou insalubre e não emprega menor de 16 (dezesseis) anos, salvo menor, a partir de 14 (quatorze) anos, na condição de aprendiz, nos termos do inciso XXXIII, do art. 7º da Constituição Federal.</p>
    <p><strong>Declaração</strong> de que a proposta apresentada para essa licitação foi elaborada de maneira independente, de acordo com o que é estabelecido na Instrução Normativa Nº 2 de 16 de setembro de 2009 da SLTI/MP.</p>
    <p><strong>Declaração</strong> de que não possuo, em minha cadeia produtiva, empregados executando trabalho degradante ou forçado, observando o disposto nos incisos III e IV do art.1º e no inciso III do art.5º da Constituição Federal.</p>
    <p><strong>Declaração</strong> de que os preços propostos estão inclusos frete, tributos e encargos, elaboração independente de proposta, ciência de itens exclusivos/reservados para ME/EPP (quando aplicável) e que os produtos/serviços atendem às normas técnicas vigentes.</p>
    `}
  </div>

  <!-- IDENTIFICAÇÃO DA EMPRESA -->
  <div class="identificacao-empresa">
    <strong>Razão Social:</strong> ${empresa || ''}. <strong>CNPJ/MF:</strong> ${cnpj || ''}.<br>
    <strong>Endereço:</strong> ${endereco || ''}${cidade ? ", " + cidade : ""}${uf ? "/" + uf : ""}${cep ? ". CEP: " + cep : ""}.<br>
    ${telefone ? `<strong>Telefone/WhatsApp:</strong> ${telefone} ` : ""}
    ${email ? `<strong>Endereço Eletrônico (e-mail):</strong> ${email}<br>` : ""}
    ${inscEstadual ? `<strong>Inscrição Estadual:</strong> ${inscEstadual}<br>` : ""}
    ${inscMunicipal ? `<strong>Inscrição Municipal:</strong> ${inscMunicipal}<br>` : ""}
    ${banco ? `<strong>Banco:</strong> ${banco}` : ""}
    ${agencia ? ` <strong>Agência:</strong> ${agencia}` : ""}
    ${contaCorrente ? `. <strong>${tipoConta || 'C/C'}:</strong> ${contaCorrente}.` : ""}
    ${pix ? `<br><strong>PIX:</strong> ${pix}` : ""}
  </div>

  <!-- RESPONSÁVEL -->
  ${responsavelNome ? `
  <div class="secao" style="margin-top:16px;">
    <strong style="text-transform:uppercase;text-decoration:underline;">
      Responsável pela Assinatura do Contrato:
    </strong><br><br>
    <strong>Nome:</strong> ${responsavelNome}<br>
    ${responsavelEstadoCivil ? `<strong>Estado Civil:</strong> ${responsavelEstadoCivil}. ` : ""}
    <strong>Cargo/Função:</strong> ${responsavelCargo || "Representante Legal"}.<br>
    ${responsavelCpf ? `<strong>CPF:</strong> ${responsavelCpf} ` : ""}
    ${responsavelRg ? `<strong>C.I:</strong> ${responsavelRg}.` : ""}
  </div>` : ""}

  <!-- ASSINATURA -->
  <div class="assinatura">
    <div class="cidade-data">
      ${cidade_proposta || cidade || "________"}/${uf || "__"}, ${dataFormatada}.
    </div>
    <div class="linha-assinatura">
      <strong>${empresa || ''}</strong><br>
      CNPJ: ${cnpj || ''}<br>
      ${responsavelNome ? responsavelNome + "<br>" : ""}
      ${responsavelCpf ? "CPF: " + responsavelCpf + "<br>" : ""}
      ${responsavelCargo || "REPRESENTANTE LEGAL"}
    </div>
  </div>

</div>
</body>
</html>`;

    return new Response(
      JSON.stringify({ html, sucesso: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
