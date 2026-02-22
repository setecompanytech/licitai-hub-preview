import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { licitacoesMock, Licitacao } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Search, Filter, MapPin, Calendar, Building2, ArrowUpDown } from 'lucide-react';

const regioes: Record<string, string[]> = {
  'Norte': ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
  'Nordeste': ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MS', 'MT'],
  'Sudeste': ['ES', 'MG', 'RJ', 'SP'],
  'Sul': ['PR', 'RS', 'SC'],
};

const municipiosPorUF: Record<string, string[]> = {
  AC: ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá', 'Feijó', 'Brasiléia', 'Senador Guiomard', 'Plácido de Castro'],
  AL: ['Maceió', 'Arapiraca', 'Rio Largo', 'Palmeira dos Índios', 'União dos Palmares', 'Penedo', 'São Miguel dos Campos', 'Delmiro Gouveia', 'Coruripe', 'Marechal Deodoro'],
  AM: ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari', 'Tefé', 'Tabatinga', 'Maués', 'Humaitá', 'Iranduba'],
  AP: ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque', 'Mazagão', 'Porto Grande', 'Tartarugalzinho'],
  BA: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Itabuna', 'Juazeiro', 'Lauro de Freitas', 'Ilhéus', 'Jequié', 'Teixeira de Freitas', 'Barreiras', 'Alagoinhas', 'Porto Seguro', 'Simões Filho', 'Paulo Afonso', 'Eunápolis', 'Santo Antônio de Jesus', 'Valença', 'Candeias', 'Guanambi'],
  CE: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato', 'Itapipoca', 'Maranguape', 'Iguatu', 'Quixadá', 'Canindé', 'Russas', 'Tianguá', 'Aracati', 'Pacatuba'],
  DF: ['Brasília'],
  ES: ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Cachoeiro de Itapemirim', 'Linhares', 'São Mateus', 'Colatina', 'Guarapari', 'Aracruz'],
  GO: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás', 'Valparaíso de Goiás', 'Trindade', 'Formosa', 'Novo Gama', 'Itumbiara', 'Senador Canedo', 'Catalão', 'Jataí'],
  MA: ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias', 'Codó', 'Paço do Lumiar', 'Açailândia', 'Bacabal', 'Santa Inês', 'Balsas', 'Pinheiro'],
  MG: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves', 'Uberaba', 'Governador Valadares', 'Ipatinga', 'Sete Lagoas', 'Divinópolis', 'Santa Luzia', 'Ibirité', 'Poços de Caldas', 'Patos de Minas', 'Teófilo Otoni', 'Pouso Alegre', 'Barbacena', 'Sabará'],
  MS: ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã', 'Naviraí', 'Nova Andradina', 'Aquidauana', 'Sidrolândia', 'Maracaju'],
  MT: ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Cáceres', 'Sorriso', 'Lucas do Rio Verde', 'Primavera do Leste', 'Barra do Garças'],
  PA: ['Abaetetuba', 'Abel Figueiredo', 'Acará', 'Afuá', 'Água Azul do Norte', 'Alenquer', 'Almeirim', 'Altamira', 'Anajás', 'Ananindeua', 'Anapu', 'Augusto Corrêa', 'Aurora do Pará', 'Bagre', 'Baião', 'Bannach', 'Barcarena', 'Belém', 'Benevides', 'Bom Jesus do Tocantins', 'Bonito', 'Bragança', 'Brasil Novo', 'Brejo Grande do Araguaia', 'Breu Branco', 'Breves', 'Bujaru', 'Cachoeira do Arari', 'Cachoeira do Piriá', 'Cametá', 'Canaã dos Carajás', 'Capanema', 'Capitão Poço', 'Castanhal', 'Chaves', 'Colares', 'Conceição do Araguaia', 'Concórdia do Pará', 'Cumaru do Norte', 'Curionópolis', 'Curralinho', 'Curuá', 'Curuçá', 'Dom Eliseu', 'Eldorado do Carajás', 'Faro', 'Floresta do Araguaia', 'Garrafão do Norte', 'Goianésia do Pará', 'Gurupá', 'Igarapé-Açu', 'Igarapé-Miri', 'Inhangapi', 'Ipixuna do Pará', 'Irituia', 'Itaituba', 'Itupiranga', 'Jacareacanga', 'Jacundá', 'Juruti', 'Limoeiro do Ajuru', 'Mãe do Rio', 'Magalhães Barata', 'Marabá', 'Maracanã', 'Marapanim', 'Marituba', 'Medicilândia', 'Melgaço', 'Mocajuba', 'Moju', 'Monte Alegre', 'Muaná', 'Nova Esperança do Piriá', 'Nova Ipixuna', 'Nova Timboteua', 'Novo Progresso', 'Novo Repartimento', 'Óbidos', 'Oeiras do Pará', 'Oriximiná', 'Ourém', 'Ourilândia do Norte', 'Pacajá', 'Palestina do Pará', 'Paragominas', 'Parauapebas', "Pau D'Arco", 'Peixe-Boi', 'Piçarra', 'Placas', 'Ponta de Pedras', 'Portel', 'Porto de Moz', 'Prainha', 'Primavera', 'Quatipuru', 'Redenção', 'Rio Maria', 'Rondon do Pará', 'Rurópolis', 'Salinópolis', 'Salvaterra', 'Santa Bárbara do Pará', 'Santa Cruz do Arari', 'Santa Izabel do Pará', 'Santa Luzia do Pará', 'Santa Maria das Barreiras', 'Santa Maria do Pará', 'Santana do Araguaia', 'Santarém', 'Santarém Novo', 'Santo Antônio do Tauá', 'São Caetano de Odivelas', 'São Domingos do Araguaia', 'São Domingos do Capim', 'São Félix do Xingu', 'São Francisco do Pará', 'São Geraldo do Araguaia', 'São João da Ponta', 'São João de Pirabas', 'São João do Araguaia', 'São Miguel do Guamá', 'Sapucaia', 'Senador José Porfírio', 'Soure', 'Tailândia', 'Terra Alta', 'Terra Santa', 'Tomé-Açu', 'Tracuateua', 'Trairão', 'Tucumã', 'Tucuruí', 'Ulianópolis', 'Uruará', 'Vigia', 'Viseu', 'Vitória do Xingu', 'Xinguara'],
  PB: ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Sousa', 'Cajazeiras', 'Cabedelo', 'Guarabira', 'Sapé'],
  PE: ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista', 'Cabo de Santo Agostinho', 'Camaragibe', 'Garanhuns', 'Vitória de Santo Antão', 'Igarassu', 'São Lourenço da Mata', 'Abreu e Lima', 'Serra Talhada', 'Araripina'],
  PI: ['Teresina', 'Parnaíba', 'Picos', 'Piripiri', 'Floriano', 'Barras', 'Campo Maior', 'Pedro II', 'Oeiras', 'José de Freitas'],
  PR: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo', 'Guarapuava', 'Paranaguá', 'Araucária', 'Toledo', 'Apucarana', 'Pinhais', 'Campo Largo', 'Arapongas', 'Almirante Tamandaré', 'Umuarama', 'Piraquara', 'Cambé'],
  RJ: ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'São João de Meriti', 'Campos dos Goytacazes', 'Petrópolis', 'Volta Redonda', 'Magé', 'Itaboraí', 'Macaé', 'Mesquita', 'Nilópolis', 'Cabo Frio', 'Nova Friburgo', 'Barra Mansa', 'Angra dos Reis', 'Teresópolis'],
  RN: ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Macaíba', 'Ceará-Mirim', 'Caicó', 'Açu', 'Currais Novos', 'São José de Mipibu'],
  RO: ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal', 'Rolim de Moura', 'Jaru', 'Guajará-Mirim', 'Ouro Preto do Oeste'],
  RR: ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Pacaraima', 'Alto Alegre'],
  RS: ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Rio Grande', 'Alvorada', 'Passo Fundo', 'Sapucaia do Sul', 'Uruguaiana', 'Santa Cruz do Sul', 'Cachoeirinha', 'Bagé', 'Bento Gonçalves', 'Erechim', 'Guaíba'],
  SC: ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Chapecó', 'Criciúma', 'Itajaí', 'Jaraguá do Sul', 'Palhoça', 'Lages', 'Balneário Camboriú', 'Brusque', 'Tubarão', 'São Bento do Sul', 'Caçador', 'Concórdia', 'Navegantes', 'Rio do Sul', 'Araranguá', 'Gaspar'],
  SE: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'São Cristóvão', 'Estância', 'Tobias Barreto', 'Simão Dias'],
  SP: ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'São José dos Campos', 'Osasco', 'Ribeirão Preto', 'Sorocaba', 'Mauá', 'São José do Rio Preto', 'Santos', 'Mogi das Cruzes', 'Diadema', 'Jundiaí', 'Piracicaba', 'Carapicuíba', 'Bauru', 'Itaquaquecetuba', 'São Vicente', 'Franca', 'Praia Grande', 'Guarujá', 'Taubaté', 'Limeira', 'Suzano', 'Taboão da Serra', 'Sumaré', 'Barueri', 'Embu das Artes'],
  TO: ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins', 'Colinas do Tocantins', 'Guaraí', 'Tocantinópolis'],
};

const statusConfig: Record<string, { label: string; className: string }> = {
  monitorando: { label: 'Monitorando', className: 'bg-info/10 text-info border-info/20' },
  analisando: { label: 'Analisando', className: 'bg-warning/10 text-warning border-warning/20' },
  proposta: { label: 'Proposta', className: 'bg-primary/10 text-primary border-primary/20' },
  enviada: { label: 'Enviada', className: 'bg-accent/10 text-accent border-accent/20' },
  vencida: { label: 'Vencida', className: 'bg-success/10 text-success border-success/20' },
  perdida: { label: 'Perdida', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function Licitacoes() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalidadeFilter, setModalidadeFilter] = useState<string>('all');
  const [regiaoFilter, setRegiaoFilter] = useState<string>('all');
  const [ufFilter, setUfFilter] = useState<string>('all');
  const [municipioFilter, setMunicipioFilter] = useState<string>('all');
  const [uasgSearch, setUasgSearch] = useState('');

  const ufsDisponiveis = regiaoFilter === 'all'
    ? Object.values(regioes).flat()
    : regioes[regiaoFilter] || [];

  const municipiosDisponiveis = ufFilter === 'all'
    ? []
    : municipiosPorUF[ufFilter] || [];

  const handleRegiaoChange = (v: string) => {
    setRegiaoFilter(v);
    setUfFilter('all');
    setMunicipioFilter('all');
  };

  const handleUfChange = (v: string) => {
    setUfFilter(v);
    setMunicipioFilter('all');
  };

  const filtered = licitacoesMock.filter((l) => {
    const matchSearch =
      l.objeto.toLowerCase().includes(search.toLowerCase()) ||
      l.orgao.toLowerCase().includes(search.toLowerCase()) ||
      l.numero.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchModalidade = modalidadeFilter === 'all' || l.modalidade === modalidadeFilter;
    const matchUf = ufFilter === 'all'
      ? (regiaoFilter === 'all' || ufsDisponiveis.includes(l.uf))
      : l.uf === ufFilter;
    const matchMunicipio = municipioFilter === 'all' || l.cidade === municipioFilter;
    const matchUasg = !uasgSearch || 
      (l.uasg?.toLowerCase().includes(uasgSearch.toLowerCase()) || 
       l.unidadeCompradora?.toLowerCase().includes(uasgSearch.toLowerCase()));
    return matchSearch && matchStatus && matchModalidade && matchUf && matchMunicipio && matchUasg;
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Licitações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} licitações encontradas
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[250px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por objeto, órgão ou número..."
            className="pl-9 bg-card border-border/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative min-w-[220px] max-w-xs">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="UASG / Unidade Compradora..."
            className="pl-9 bg-card border-border/50"
            value={uasgSearch}
            onChange={(e) => setUasgSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-card border-border/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="monitorando">Monitorando</SelectItem>
            <SelectItem value="analisando">Analisando</SelectItem>
            <SelectItem value="proposta">Proposta</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="vencida">Vencida</SelectItem>
            <SelectItem value="perdida">Perdida</SelectItem>
          </SelectContent>
        </Select>
        <Select value={modalidadeFilter} onValueChange={setModalidadeFilter}>
          <SelectTrigger className="w-[180px] bg-card border-border/50">
            <SelectValue placeholder="Modalidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas modalidades</SelectItem>
            <SelectItem value="Pregão Eletrônico">Pregão Eletrônico</SelectItem>
            <SelectItem value="Concorrência">Concorrência</SelectItem>
            <SelectItem value="Tomada de Preços">Tomada de Preços</SelectItem>
            <SelectItem value="Dispensa">Dispensa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={regiaoFilter} onValueChange={handleRegiaoChange}>
          <SelectTrigger className="w-[160px] bg-card border-border/50">
            <MapPin className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Região" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas regiões</SelectItem>
            {Object.keys(regioes).map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ufFilter} onValueChange={handleUfChange}>
          <SelectTrigger className="w-[120px] bg-card border-border/50">
            <SelectValue placeholder="UF" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos UFs</SelectItem>
            {ufsDisponiveis.sort().map((uf) => (
              <SelectItem key={uf} value={uf}>{uf}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {municipiosDisponiveis.length > 0 && (
          <Select value={municipioFilter} onValueChange={setMunicipioFilter}>
            <SelectTrigger className="w-[180px] bg-card border-border/50">
              <SelectValue placeholder="Município" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos municípios</SelectItem>
              {municipiosDisponiveis.sort().map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>


      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Nº / Objeto</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Órgão / UASG</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Unidade Compradora</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Valor</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Encerramento</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Relevância</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lic, i) => {
                const st = statusConfig[lic.status];
                return (
                  <tr
                    key={lic.id}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-muted-foreground block">{lic.numero}</span>
                      <span className="text-sm font-medium line-clamp-1">{lic.objeto}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="line-clamp-1">{lic.orgao}</span>
                      </div>
                      {lic.uasg && (
                        <span className="text-xs font-mono text-muted-foreground mt-0.5 block">UASG: {lic.uasg}</span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {lic.cidade}/{lic.uf}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm line-clamp-2">{lic.unidadeCompradora || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(lic.valor)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm flex items-center justify-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        {new Date(lic.dataEncerramento).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', st.className)}>
                        {st.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${lic.relevancia}%`,
                              background:
                                lic.relevancia > 80
                                  ? 'hsl(var(--success))'
                                  : lic.relevancia > 60
                                  ? 'hsl(var(--warning))'
                                  : 'hsl(var(--muted-foreground))',
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{lic.relevancia}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
