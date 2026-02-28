export type CidadeEstado = {
  uf: string;
  nome: string;
  cidades: string[];
};

export type RegiaoConfig = {
  label: string;
  estados: CidadeEstado[];
};

export const REGIOES_ESTADOS: Record<string, RegiaoConfig> = {
  norte: {
    label: 'Norte',
    estados: [
      {
        uf: 'AC', nome: 'Acre', cidades: [
          'Rio Branco','Cruzeiro do Sul','Sena Madureira','Tarauacá','Feijó','Brasileia','Senador Guiomard',
          'Plácido de Castro','Xapuri','Epitaciolândia','Mâncio Lima','Rodrigues Alves','Porto Walter',
          'Acrelândia','Bujari','Jordão','Marechal Thaumaturgo','Manoel Urbano','Assis Brasil',
          'Capixaba','Porto Acre','Santa Rosa do Purus',
        ],
      },
      {
        uf: 'AP', nome: 'Amapá', cidades: [
          'Macapá','Santana','Laranjal do Jari','Oiapoque','Mazagão','Porto Grande','Tartarugalzinho',
          'Vitória do Jari','Calçoene','Amapá','Ferreira Gomes','Pedra Branca do Amapari',
          'Serra do Navio','Cutias','Itaubal','Pracuúba',
        ],
      },
      {
        uf: 'AM', nome: 'Amazonas', cidades: [
          'Manaus','Parintins','Itacoatiara','Manacapuru','Coari','Tefé','Maués','Tabatinga',
          'Humaitá','São Gabriel da Cachoeira','Lábrea','Benjamin Constant','Iranduba','Manicoré',
          'Borba','Autazes','Carauari','Eirunepé','Nova Olinda do Norte','Presidente Figueiredo',
          'Barreirinha','Urucará','São Paulo de Olivença','Fonte Boa','Barcelos','Boca do Acre',
          'Rio Preto da Eva','Novo Airão','Novo Aripuanã','Jutaí','Codajás','Tonantins',
          'Alvarães','Uarini','Anori','Caapiranga','Nhamundá','Beruri','Tapauá','Envira',
          'Ipixuna','Pauini','Guajará','Itapiranga','Urucurituba','Silves','Apuí','Santo Antônio do Içá',
          'Anamã','Amaturá','Canutama','Atalaia do Norte','Careiro','Careiro da Várzea',
          'Manaquiri','Japurá','Maraã','Juruá','Santa Isabel do Rio Negro',
        ],
      },
      {
        uf: 'PA', nome: 'Pará', cidades: [
          'Belém','Ananindeua','Santarém','Marabá','Castanhal','Parauapebas','Marituba','Abaetetuba',
          'Cametá','Bragança','Tucuruí','Altamira','Barcarena','Itaituba','Tailândia','Paragominas',
          'Redenção','Breves','Salinópolis','Capanema','São Félix do Xingu','Conceição do Araguaia',
          'Tucumã','Xinguara','Benevides','Igarapé-Açu','Vigia','Tomé-Açu','Santa Isabel do Pará',
          'Moju','Oriximiná','Óbidos','Monte Alegre','Jacundá','Canaã dos Carajás','Ourilândia do Norte',
          'Dom Eliseu','São Miguel do Guamá','Igarapé-Miri','Marapanim','Soure','Salvaterra',
          'Rurópolis','Novo Repartimento','Curionópolis','Medicilândia','Mojuí dos Campos',
          'Acará','Baião','Mocajuba','Porto de Moz','Prainha','Almeirim','Juruti','Terra Santa',
          'Faro','Curuçá','São Caetano de Odivelas','Colares','Inhangapi','Santo Antônio do Tauá',
          'Irituia','Ourém','Bonito','Aurora do Pará','Capitão Poço','Garrafão do Norte',
          'Ipixuna do Pará','Nova Esperança do Piriá','Viseu','Augusto Corrêa','Tracuateua',
          'Santa Luzia do Pará','Peixe-Boi','Nova Timboteua','Primavera','Quatipuru',
          'Santa Maria do Pará','São João de Pirabas','São Domingos do Capim','Mãe do Rio',
          'Concórdia do Pará','Bujaru','Santa Bárbara do Pará','Benevides',
          'Eldorado dos Carajás','Floresta do Araguaia','Rio Maria','Sapucaia','Bannach',
          'Pau D\'Arco','Piçarra','São Geraldo do Araguaia','Curionópolis','Água Azul do Norte',
          'Ourilândia do Norte','Cumaru do Norte','São Félix do Xingu','Novo Progresso',
          'Trairão','Aveiro','Placas','Uruará','Brasil Novo','Vitória do Xingu','Senador José Porfírio',
          'Anapu','Pacajá','Portel','Melgaço','Bagre','Gurupá','Anajás','Chaves','Afuá',
          'Santa Cruz do Arari','Ponta de Pedras','Muaná','Cachoeira do Arari','São Sebastião da Boa Vista',
          'Curralinho','Oeiras do Pará','Limoeiro do Ajuru',
        ],
      },
      {
        uf: 'RO', nome: 'Rondônia', cidades: [
          'Porto Velho','Ji-Paraná','Ariquemes','Vilhena','Cacoal','Jaru','Rolim de Moura',
          'Guajará-Mirim','Ouro Preto do Oeste','Buritis','Pimenta Bueno','Machadinho d\'Oeste',
          'Espigão d\'Oeste','Nova Mamoré','Colorado do Oeste','Presidente Médici','Cerejeiras',
          'São Francisco do Guaporé','Alto Paraíso','Candeias do Jamari','Monte Negro',
          'São Miguel do Guaporé','Cujubim','Mirante da Serra','Alvorada d\'Oeste','Itapuã do Oeste',
          'Castanheiras','Governador Jorge Teixeira','Nova União','Novo Horizonte do Oeste',
          'Alto Alegre dos Parecis','Theobroma','Urupá','Teixeirópolis','Vale do Paraíso',
          'Cabixi','Chupinguaia','Corumbiara','Costa Marques','Nova Brasilândia d\'Oeste',
          'Parecis','Pimenteiras do Oeste','Primavera de Rondônia','Santa Luzia d\'Oeste',
          'São Felipe d\'Oeste','Seringueiras','Vale do Anari',
        ],
      },
      {
        uf: 'RR', nome: 'Roraima', cidades: [
          'Boa Vista','Rorainópolis','Caracaraí','Alto Alegre','Cantá','Mucajaí','Pacaraima',
          'Bonfim','São João da Baliza','São Luiz','Caroebe','Normandia','Amajari','Iracema',
          'Uiramutã',
        ],
      },
      {
        uf: 'TO', nome: 'Tocantins', cidades: [
          'Palmas','Araguaína','Gurupi','Porto Nacional','Paraíso do Tocantins','Colinas do Tocantins',
          'Guaraí','Dianópolis','Tocantinópolis','Miracema do Tocantins','Augustinópolis',
          'Formoso do Araguaia','Pedro Afonso','Taguatinga','Arraias','Natividade','Wanderlândia',
          'Xambioá','Ananás','Araguatins','Axixá do Tocantins','Buriti do Tocantins',
          'Colméia','Couto Magalhães','Cristalândia','Figueirópolis','Goiatins',
          'Itaguatins','Miranorte','Nova Olinda','Peixe','Presidente Kennedy',
          'Santa Fé do Araguaia','São Miguel do Tocantins','Talismã',
        ],
      },
    ],
  },
  nordeste: {
    label: 'Nordeste',
    estados: [
      {
        uf: 'AL', nome: 'Alagoas', cidades: [
          'Maceió','Arapiraca','Rio Largo','Palmeira dos Índios','União dos Palmares','Penedo',
          'São Miguel dos Campos','Delmiro Gouveia','Coruripe','Marechal Deodoro','Campo Alegre',
          'Santana do Ipanema','Viçosa','Pilar','Murici','Atalaia','São Luís do Quitunde',
          'Teotônio Vilela','Matriz de Camaragibe','Girau do Ponciano','Igreja Nova','Porto Calvo',
          'Joaquim Gomes','Junqueiro','Porto Real do Colégio','Olho d\'Água das Flores',
          'Pão de Açúcar','Maribondo','São José da Tapera','Traipu','Anadia','Batalha',
          'Boca da Mata','Cajueiro','Colônia Leopoldina','Craíbas','Flexeiras','Igaci',
          'Inhapi','Lagoa da Canoa','Major Isidoro','Messias','Monteirópolis','Olivença',
          'Ouro Branco','Palestina','Pariconha','Piranhas','Quebrangulo','Satuba',
          'São Miguel dos Milagres','Taquarana',
        ],
      },
      {
        uf: 'BA', nome: 'Bahia', cidades: [
          'Salvador','Feira de Santana','Vitória da Conquista','Camaçari','Itabuna','Juazeiro',
          'Lauro de Freitas','Ilhéus','Jequié','Teixeira de Freitas','Barreiras','Alagoinhas',
          'Porto Seguro','Simões Filho','Paulo Afonso','Eunápolis','Santo Antônio de Jesus',
          'Valença','Candeias','Guanambi','Jacobina','Luís Eduardo Magalhães','Serrinha',
          'Senhor do Bonfim','Dias d\'Ávila','Irecê','Cruz das Almas','Itaberaba','Brumado',
          'Itapetinga','Conceição do Coité','Itamaraju','Campo Formoso','Ribeira do Pombal',
          'Bom Jesus da Lapa','Euclides da Cunha','Santo Amaro','Catu','São Félix',
          'Conceição do Jacuípe','Ipirá','Morro do Chapéu','Mucuri','Nova Viçosa',
          'Poções','Santa Maria da Vitória','Santaluz','Ubaitaba','Una','Uruçuca',
          'Vera Cruz','Wenceslau Guimarães','Xique-Xique',
        ],
      },
      {
        uf: 'CE', nome: 'Ceará', cidades: [
          'Fortaleza','Caucaia','Juazeiro do Norte','Maracanaú','Sobral','Crato','Itapipoca',
          'Maranguape','Iguatu','Quixadá','Canindé','Crateús','Aracati','Aquiraz','Pacatuba',
          'Quixeramobim','Russas','Tianguá','Limoeiro do Norte','Horizonte','Pacajus',
          'Cascavel','Acaraú','Camocim','São Gonçalo do Amarante','Eusébio','Icó','Tauá',
          'Morada Nova','Beberibe','Brejo Santo','Trairi','Viçosa do Ceará','Barbalha',
          'Missão Velha','Mauriti','Lavras da Mangabeira','Pentecoste','Redenção',
          'São Benedito','Ubajara','Guaraciaba do Norte','Granja','Baturité','Independência',
          'Mombaça','Nova Russas','Pedra Branca','Tamboril',
        ],
      },
      {
        uf: 'MA', nome: 'Maranhão', cidades: [
          'São Luís','Imperatriz','São José de Ribamar','Timon','Caxias','Codó','Paço do Lumiar',
          'Açailândia','Bacabal','Balsas','Santa Inês','Chapadinha','Pinheiro','Barreirinhas',
          'Itapecuru Mirim','Coroatá','Pedreiras','Presidente Dutra','Barra do Corda',
          'Grajaú','Viana','Zé Doca','Buriticupu','Colinas','Dom Pedro','Estreito',
          'Governador Nunes Freire','Lago da Pedra','Bom Jardim','Cururupu','Humberto de Campos',
          'Carolina','Tutóia','Araioses','Buriti Bravo','Esperantinópolis','Fortuna',
          'Governador Eugênio Barros','Matinha','Monção','Paraibano','Pio XII',
          'Raposa','Riachão','São Bernardo','São Domingos do Maranhão',
          'São João dos Patos','São Mateus do Maranhão','Timbiras','Turiaçu',
          'Urbano Santos','Vitória do Mearim',
        ],
      },
      {
        uf: 'PB', nome: 'Paraíba', cidades: [
          'João Pessoa','Campina Grande','Santa Rita','Patos','Bayeux','Sousa','Cajazeiras',
          'Cabedelo','Guarabira','Sapé','Mamanguape','Monteiro','Pombal','Sumé','Itabaiana',
          'Solânea','Esperança','Rio Tinto','Queimadas','Catolé do Rocha','Alagoa Grande',
          'Areia','Bananeiras','Ingá','Itaporanga','Pedras de Fogo','Piancó','Princesa Isabel',
          'São Bento','Serra Branca','Taperoá','Cuité','Araruna','Lagoa Seca','Picuí',
          'Remígio','Santa Luzia','São João do Rio do Peixe','Soledade','Uiraúna',
        ],
      },
      {
        uf: 'PE', nome: 'Pernambuco', cidades: [
          'Recife','Jaboatão dos Guararapes','Olinda','Caruaru','Petrolina','Paulista',
          'Cabo de Santo Agostinho','Camaragibe','Garanhuns','Vitória de Santo Antão',
          'Igarassu','São Lourenço da Mata','Abreu e Lima','Serra Talhada','Carpina',
          'Araripina','Arcoverde','Goiana','Belo Jardim','Gravatá','Surubim','Escada',
          'Pesqueira','Palmares','Bezerros','Salgueiro','Limoeiro','Santa Cruz do Capibaribe',
          'Timbaúba','Ouricuri','Buíque','Nazaré da Mata','Paudalho','Catende','Cupira',
          'Toritama','Ipojuca','Moreno','São José do Egito','Tabira','Afogados da Ingazeira',
          'Barreiros','Bom Conselho','Cachoeirinha','Floresta','Lajedo','Panelas',
          'São Bento do Una','São Caitano','Sirinhaém','Tamandaré',
        ],
      },
      {
        uf: 'PI', nome: 'Piauí', cidades: [
          'Teresina','Parnaíba','Picos','Piripiri','Floriano','Campo Maior','Barras',
          'União','Altos','José de Freitas','Pedro II','Oeiras','Esperantina','Luzilândia',
          'Valença do Piauí','Corrente','São Raimundo Nonato','Uruçuí','Bom Jesus',
          'Regeneração','Miguel Alves','Água Branca','Alto Longá','Amarante','Batalha',
          'Canto do Buriti','Castelo do Piauí','Cocal','Demerval Lobão','Elesbão Veloso',
          'Fronteiras','Guadalupe','Inhuma','Itainópolis','Jaicós','Luís Correia',
          'Monsenhor Gil','Palmeirais','Paulistana','Porto','São João do Piauí',
          'São Miguel do Tapuio','Simplício Mendes',
        ],
      },
      {
        uf: 'RN', nome: 'Rio Grande do Norte', cidades: [
          'Natal','Mossoró','Parnamirim','São Gonçalo do Amarante','Macaíba','Ceará-Mirim',
          'Caicó','Assu','Currais Novos','São José de Mipibu','Santa Cruz','Nova Cruz',
          'Apodi','João Câmara','Touros','Pau dos Ferros','Canguaretama','Extremoz',
          'Macau','Alexandria','Areia Branca','Baraúna','Goianinha','Guamaré','Ipanguaçu',
          'Lajes','Monte Alegre','Nísia Floresta','Parelhas','Pendências','São Miguel',
          'São Paulo do Potengi','Tangará','Tibau do Sul','Umarizal',
        ],
      },
      {
        uf: 'SE', nome: 'Sergipe', cidades: [
          'Aracaju','Nossa Senhora do Socorro','Lagarto','Itabaiana','São Cristóvão','Estância',
          'Tobias Barreto','Propriá','Simão Dias','Capela','Itabaianinha','Barra dos Coqueiros',
          'Laranjeiras','Maruim','Nossa Senhora da Glória','Canindé de São Francisco',
          'Poço Redondo','Porto da Folha','Riachão do Dantas','São Domingos','Umbaúba',
          'Aquidabã','Areia Branca','Carmópolis','Cristinápolis','Frei Paulo','Indiaroba',
          'Japaratuba','Monte Alegre de Sergipe','Neópolis','Nossa Senhora das Dores',
          'Pedrinhas','Rosário do Catete','Salgado','Santa Luzia do Itanhy',
        ],
      },
    ],
  },
  sudeste: {
    label: 'Sudeste',
    estados: [
      {
        uf: 'ES', nome: 'Espírito Santo', cidades: [
          'Vitória','Vila Velha','Serra','Cariacica','Linhares','Cachoeiro de Itapemirim',
          'Colatina','São Mateus','Guarapari','Aracruz','Viana','Nova Venécia','Barra de São Francisco',
          'São Gabriel da Palha','Marataízes','Castelo','Domingos Martins','Afonso Cláudio',
          'Alegre','Anchieta','Baixo Guandu','Conceição da Barra','Fundão','Guaçuí',
          'Ibatiba','Iúna','Jaguaré','João Neiva','Mantenópolis','Mimoso do Sul',
          'Montanha','Muniz Freire','Pedro Canário','Pinheiros','Piúma','Santa Leopoldina',
          'Santa Maria de Jetibá','Santa Teresa','São José do Calçado','Sooretama','Venda Nova do Imigrante',
        ],
      },
      {
        uf: 'MG', nome: 'Minas Gerais', cidades: [
          'Belo Horizonte','Uberlândia','Contagem','Juiz de Fora','Betim','Montes Claros',
          'Ribeirão das Neves','Uberaba','Governador Valadares','Ipatinga','Sete Lagoas',
          'Divinópolis','Santa Luzia','Ibirité','Poços de Caldas','Patos de Minas',
          'Teófilo Otoni','Pouso Alegre','Barbacena','Sabará','Varginha','Conselheiro Lafaiete',
          'Araguari','Itabira','Passos','Coronel Fabriciano','Muriaé','Ituiutaba',
          'Araxá','Lavras','Nova Lima','Itaúna','Paracatu','Caratinga','Patrocínio',
          'Manhuaçu','São João del-Rei','Timóteo','Unaí','Curvelo','Ubá','Alfenas',
          'João Monlevade','Três Corações','Viçosa','Ouro Preto','Cataguases','Januária',
          'Janaúba','Nova Serrana','Formiga','Itajubá','Pedro Leopoldo','Leopoldina',
          'São Sebastião do Paraíso','Ponte Nova','Lagoa Santa','Mariana','Congonhas',
          'Frutal','Campo Belo','Três Pontas','Machado','Oliveira','Santos Dumont',
          'Almenara','Araçuaí','Bocaiúva','Diamantina','Guanhães','Nanuque','Salinas',
          'São Francisco','Várzea da Palma','Carangola','Cataguases','Além Paraíba',
          'Monte Carmelo','Boa Esperança','Caxambu','São Lourenço','Ouro Fino',
        ],
      },
      {
        uf: 'RJ', nome: 'Rio de Janeiro', cidades: [
          'Rio de Janeiro','São Gonçalo','Duque de Caxias','Nova Iguaçu','Niterói',
          'Belford Roxo','São João de Meriti','Campos dos Goytacazes','Petrópolis',
          'Volta Redonda','Magé','Itaboraí','Mesquita','Nova Friburgo','Barra Mansa',
          'Macaé','Cabo Frio','Nilópolis','Teresópolis','Resende','Angra dos Reis',
          'Maricá','Queimados','Araruama','Itaguaí','Rio das Ostras','Japeri',
          'São Pedro da Aldeia','Itaperuna','Barra do Piraí','Saquarema','Três Rios',
          'Valença','Guapimirim','Mangaratiba','Casimiro de Abreu','Cachoeiras de Macacu',
          'Búzios','Conceição de Macabu','Cordeiro','Cantagalo','Paraíba do Sul',
          'São Fidélis','Santo Antônio de Pádua','Vassouras','Miguel Pereira','Paty do Alferes',
          'Rio Bonito','Silva Jardim','Tanguá','Seropédica','Paracambi','Pinheiral',
        ],
      },
      {
        uf: 'SP', nome: 'São Paulo', cidades: [
          'São Paulo','Guarulhos','Campinas','São Bernardo do Campo','Santo André',
          'São José dos Campos','Osasco','Ribeirão Preto','Sorocaba','Santos','Mauá',
          'São José do Rio Preto','Mogi das Cruzes','Diadema','Jundiaí','Piracicaba',
          'Carapicuíba','Bauru','Itaquaquecetuba','São Vicente','Franca','Praia Grande',
          'Guarujá','Taubaté','Limeira','Suzano','Taboão da Serra','Sumaré',
          'Barueri','Embu das Artes','Indaiatuba','Cotia','Americana','Marília',
          'Jacareí','Araraquara','Presidente Prudente','Hortolândia','Rio Claro',
          'Araçatuba','Santa Bárbara d\'Oeste','Ferraz de Vasconcelos','Itapevi',
          'Francisco Morato','Bragança Paulista','Pindamonhangaba','Itapecerica da Serra',
          'São Caetano do Sul','Franco da Rocha','Atibaia','Valinhos','Catanduva',
          'Botucatu','Sertãozinho','Jaú','Assis','Leme','Bebedouro','Birigui',
          'Ourinhos','Cubatão','Votorantim','Itu','Mogi Guaçu','Lins','Penápolis',
          'São Carlos','Itatiba','Salto','Poá','Registro','Caraguatatuba','Ubatuba',
          'São Sebastião','Ilhabela','Bertioga','Mongaguá','Peruíbe','Itanhaém',
          'Votuporanga','Tupã','Mirassol','Olímpia','Matão','Monte Alto',
          'Andradina','Adamantina','Dracena','Osvaldo Cruz','Lucélia','Garça',
          'Lençóis Paulista','Pederneiras','Bariri','Dois Córregos','Brotas',
          'Capivari','Rafard','Elias Fausto','Monte Mor','Nova Odessa','Paulínia',
          'Cosmópolis','Artur Nogueira','Engenheiro Coelho','Holambra','Jaguariúna',
          'Pedreira','Amparo','Serra Negra','Socorro','Águas de Lindóia','Lindóia',
          'Vinhedo','Louveira','Campo Limpo Paulista','Várzea Paulista','Jarinu',
          'Cajamar','Caieiras','Mairiporã','Santana de Parnaíba','Alphaville',
        ],
      },
    ],
  },
  sul: {
    label: 'Sul',
    estados: [
      {
        uf: 'PR', nome: 'Paraná', cidades: [
          'Curitiba','Londrina','Maringá','Ponta Grossa','Cascavel','São José dos Pinhais',
          'Foz do Iguaçu','Colombo','Guarapuava','Paranaguá','Araucária','Toledo',
          'Apucarana','Pinhais','Campo Largo','Arapongas','Almirante Tamandaré',
          'Umuarama','Piraquara','Cambé','Campo Mourão','Fazenda Rio Grande',
          'Sarandi','Francisco Beltrão','Pato Branco','Cianorte','Telêmaco Borba',
          'Castro','Rolândia','Irati','União da Vitória','Cornélio Procópio',
          'Paranavaí','Ivaiporã','Prudentópolis','Bandeirantes','Jacarezinho',
          'Ibiporã','Medianeira','Santa Helena','Marechal Cândido Rondon',
          'Palotina','Assis Chateaubriand','Mandaguari','Jandaia do Sul',
          'Wenceslau Braz','Santo Antônio da Platina','Matinhos','Pontal do Paraná',
          'Guaratuba','Antonina','Morretes','Lapa','Rio Negro','São Mateus do Sul',
          'Quedas do Iguaçu','Laranjeiras do Sul','Pitanga','Goioerê','Dois Vizinhos',
        ],
      },
      {
        uf: 'SC', nome: 'Santa Catarina', cidades: [
          'Florianópolis','Joinville','Blumenau','São José','Chapecó','Criciúma',
          'Itajaí','Jaraguá do Sul','Lages','Palhoça','Balneário Camboriú','Brusque',
          'Tubarão','São Bento do Sul','Caçador','Concórdia','Camboriú','Navegantes',
          'Rio do Sul','Araranguá','Gaspar','Indaial','Mafra','Canoinhas',
          'Içara','Biguaçu','Tijucas','Imbituba','Laguna','São Francisco do Sul',
          'Penha','Itapema','Porto Belo','Bombinhas','Governador Celso Ramos',
          'Santo Amaro da Imperatriz','Águas Mornas','Rancho Queimado','Alfredo Wagner',
          'Urubici','São Joaquim','Bom Jardim da Serra','Orleans','Braço do Norte',
          'São Ludgero','Gravatal','Capivari de Baixo','Sombrio','Santa Rosa do Sul',
          'Praia Grande','Xanxerê','Xaxim','Joaçaba','Herval d\'Oeste','Videira',
          'Fraiburgo','Curitibanos','Campos Novos','Otacílio Costa',
        ],
      },
      {
        uf: 'RS', nome: 'Rio Grande do Sul', cidades: [
          'Porto Alegre','Caxias do Sul','Pelotas','Canoas','Santa Maria','Gravataí',
          'Viamão','Novo Hamburgo','São Leopoldo','Rio Grande','Alvorada','Passo Fundo',
          'Sapucaia do Sul','Uruguaiana','Cachoeirinha','Santa Cruz do Sul','Bagé',
          'Bento Gonçalves','Erechim','Guaíba','Cachoeira do Sul','Santana do Livramento',
          'Esteio','Ijuí','Sapiranga','Lajeado','Alegrete','Santo Ângelo','Venâncio Aires',
          'Camaquã','São Borja','Vacaria','Cruz Alta','Montenegro','São Gabriel',
          'Farroupilha','Tramandaí','Capão da Canoa','Torres','Osório','Igrejinha',
          'Taquara','Parobé','Campo Bom','Dois Irmãos','Estância Velha','Ivoti',
          'Flores da Cunha','Carlos Barbosa','Garibaldi','Nova Prata','Marau',
          'Carazinho','Não-Me-Toque','Soledade','Frederico Westphalen','Palmeira das Missões',
          'Santa Rosa','Três de Maio','Horizontina','São Luiz Gonzaga','Santiago',
          'Rosário do Sul','Dom Pedrito','Jaguarão','Arroio Grande','Piratini',
          'Canguçu','São Lourenço do Sul','Tapes','Charqueadas','São Jerônimo',
          'Butiá','Encruzilhada do Sul','Rio Pardo','General Câmara',
        ],
      },
    ],
  },
  centro_oeste: {
    label: 'Centro-Oeste',
    estados: [
      {
        uf: 'DF', nome: 'Distrito Federal', cidades: [
          'Brasília','Ceilândia','Taguatinga','Samambaia','Planaltina','Águas Claras',
          'Recanto das Emas','Gama','Guará','Santa Maria','Sobradinho','São Sebastião',
          'Vicente Pires','Riacho Fundo','Itapoã','Paranoá','Brazlândia','Núcleo Bandeirante',
          'Cruzeiro','Lago Sul','Lago Norte','Sudoeste','Octogonal','Park Way',
          'Jardim Botânico','SIA','Varjão','Fercal','Candangolândia',
        ],
      },
      {
        uf: 'GO', nome: 'Goiás', cidades: [
          'Goiânia','Aparecida de Goiânia','Anápolis','Rio Verde','Luziânia','Águas Lindas de Goiás',
          'Valparaíso de Goiás','Trindade','Formosa','Novo Gama','Itumbiara','Senador Canedo',
          'Catalão','Jataí','Planaltina','Caldas Novas','Inhumas','Mineiros','Cidade Ocidental',
          'Santo Antônio do Descoberto','Goianésia','Jaraguá','Porangatu','Cristalina',
          'Morrinhos','Iporá','Niquelândia','Uruaçu','São Luís de Montes Belos',
          'Ceres','Goiatuba','Pires do Rio','Quirinópolis','Santa Helena de Goiás',
          'Itaberaí','Rubiataba','Ipameri','Hidrolândia','Nerópolis','Pirenópolis',
          'Alexânia','Abadiânia','Corumbá de Goiás','Bela Vista de Goiás',
          'Goianira','Guapó','Aragarças','Padre Bernardo','Posse',
        ],
      },
      {
        uf: 'MT', nome: 'Mato Grosso', cidades: [
          'Cuiabá','Várzea Grande','Rondonópolis','Sinop','Tangará da Serra','Cáceres',
          'Sorriso','Lucas do Rio Verde','Primavera do Leste','Barra do Garças','Alta Floresta',
          'Ji-Paraná','Nova Mutum','Campo Verde','Pontes e Lacerda','Juína','Colíder',
          'Campo Novo do Parecis','Sapezal','Diamantino','Guarantã do Norte','Peixoto de Azevedo',
          'Juara','Confresa','Água Boa','Canarana','Querência','Nova Xavantina',
          'Paranatinga','Nobres','Rosário Oeste','Poconé','Santo Antônio de Leverger',
          'Nossa Senhora do Livramento','Chapada dos Guimarães','Jaciara','Juscimeira',
          'Pedra Preta','Itiquira','Alto Araguaia','Alto Garças','Guiratinga',
          'Mirassol d\'Oeste','São José dos Quatro Marcos','Araputanga','Lambari d\'Oeste',
        ],
      },
      {
        uf: 'MS', nome: 'Mato Grosso do Sul', cidades: [
          'Campo Grande','Dourados','Três Lagoas','Corumbá','Ponta Porã','Naviraí',
          'Nova Andradina','Aquidauana','Sidrolândia','Maracaju','Paranaíba','Coxim',
          'Amambai','Rio Brilhante','Chapadão do Sul','Jardim','São Gabriel do Oeste',
          'Costa Rica','Cassilândia','Bataguassu','Ivinhema','Miranda','Anastácio',
          'Aparecida do Taboado','Bonito','Bela Vista','Caarapó','Fátima do Sul',
          'Glória de Dourados','Guia Lopes da Laguna','Itaporã','Ladário','Mundo Novo',
          'Nioaque','Pedro Gomes','Ribas do Rio Pardo','Rio Negro','Rio Verde de Mato Grosso',
          'Sonora','Terenos',
        ],
      },
    ],
  },
};

/** Flattened list of all states */
export const TODOS_ESTADOS = Object.values(REGIOES_ESTADOS).flatMap(r => r.estados);
