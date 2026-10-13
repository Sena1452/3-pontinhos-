/* ==========================================================================
   js/banco.js — Camada de dados do Instituto Três Pontinhos
   --------------------------------------------------------------------------
   Toda a API é assíncrona (Promise) de propósito: hoje ela grava no
   localStorage (modo demonstração) e amanhã no Firebase Firestore, SEM
   precisar reescrever nenhum painel.

   Uso nos painéis:
     const agendamentos = await Banco.listar('agendamentos');
     await Banco.salvar('agendamentos', registro);
     await Banco.remover('agendamentos', id);
   ========================================================================== */
'use strict';

/* ------------------------- Coleções (nomes únicos) ----------------------- */
const TP_COLECOES = {
  usuarios:      'tp_usuarios',
  pacientes:     'tp_pacientes',
  profissionais: 'tp_profissionais',
  agendamentos:  'tp_agendamentos',
  solicitacoes:  'tp_solicitacoes',
  evolucoes:     'tp_evolucoes',
  financeiro:    'tp_financeiro'
};

const TP_CHAVE_SESSAO = 'tp_sessao';

/* Chaves da versão antiga do projeto — migradas automaticamente */
const TP_LEGADO = {
  usuarios: 'usuarios',
  agendamentos: 'agendamentos',
  db_agendamentos: 'db_agendamentos',
  usuarioLogado: 'usuarioLogado'
};

/* ----------------------------- Armazenamento ----------------------------- */
const Armazenamento = {
  ler(chave, padrao) {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : padrao;
    } catch (erro) {
      console.warn('[Banco] Não foi possível ler "' + chave + '":', erro);
      return padrao;
    }
  },
  gravar(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
      return true;
    } catch (erro) {
      console.error('[Banco] Não foi possível gravar "' + chave + '":', erro);
      return false;
    }
  },
  remover(chave) { localStorage.removeItem(chave); },
  existe(chave) { return localStorage.getItem(chave) !== null; }
};

/* ---------------------- Dados de demonstração (seed) --------------------- */
const TP_DADOS_DEMO = {
  usuarios: [
    { id: 'u1', cpf: '11111111111', nome: 'Gestão Financeiro - Isaac Sena', email: 'gestao@trespontinhos.org', senha: '123', perfil: 'diretor', cargo: 'Gestão Financeiro & Administrativa', ativo: true },
    { id: 'u2', cpf: '22222222222', nome: 'Kesia Almeida', email: 'kesia@trespontinhos.org', senha: '123', perfil: 'coordenacao', cargo: 'Coordenadora Administrativa', ativo: true },
    { id: 'u3', cpf: '33333333333', nome: 'Dr. André Mendonça', email: 'andre@trespontinhos.org', senha: '123', perfil: 'profissional', cargo: 'Psicólogo - Terapia ABA', ativo: true },
    { id: 'u4', cpf: '44444444444', nome: 'Ana Clara Souza', email: 'anaclara@email.com', senha: '123', perfil: 'cliente', cargo: 'Responsável legal', ativo: true },
    { id: 'u5', cpf: '55555555555', nome: 'Gabriel Santos', email: 'gabriel@trespontinhos.org', senha: '123', perfil: 'estagiario', cargo: 'Estagiário / AT', ativo: true }
  ],
  profissionais: [
    { id: 'p1', nome: 'Dr. André Mendonça', cpf: '33333333333', telefone: '(85) 98888-1111', ocupacao: 'Psicólogo(a) - Terapia ABA',   registro: 'CRP 11/0892',     valorSessao: 180, ativo: true, criadoEm: '2026-01-15' },
    { id: 'p2', nome: 'Dra. Camila Rocha',  cpf: '55555555555', telefone: '(85) 98888-2222', ocupacao: 'Nutricionista Comportamental', registro: 'CRN 11/4431',     valorSessao: 150, ativo: true, criadoEm: '2026-02-10' },
    { id: 'p3', nome: 'Dra. Juliana Paes',  cpf: '66666666666', telefone: '(85) 98888-3333', ocupacao: 'Terapeuta Ocupacional',        registro: 'CREFITO 3/99887', valorSessao: 160, ativo: true, criadoEm: '2026-03-02' },
    { id: 'p4', nome: 'Dr. Carlos Lima',    cpf: '77777777777', telefone: '(85) 98888-4444', ocupacao: 'Fonoaudiólogo(a)',             registro: 'CRFa 3/12345',    valorSessao: 170, ativo: true, criadoEm: '2026-03-20' }
  ],
  pacientes: [
    { id: 'pc1', nome: 'Lucas Oliveira',  nascimento: '2021-04-12', responsavel: 'Ana Clara Souza', telefone: '(85) 99200-5743', cpfResponsavel: '44444444444', terapia: 'Terapia ABA + Psicomotricidade', diaPagamento: '05', status: 'Em Evolução', criadoEm: '2026-02-01' },
    { id: 'pc2', nome: 'Miguel Ferreira', nascimento: '2019-08-30', responsavel: 'Rafael Ferreira', telefone: '(85) 99111-2222', cpfResponsavel: '88888888888', terapia: 'Fonoaudiologia',                diaPagamento: '10', status: 'Em Evolução', criadoEm: '2026-03-11' },
    { id: 'pc3', nome: 'Sofia Marques',   nascimento: '2020-11-02', responsavel: 'Juliana Marques', telefone: '(85) 99333-4444', cpfResponsavel: '99999999999', terapia: 'Terapia Nutricional',           diaPagamento: '15', status: 'Aguardando',  criadoEm: '2026-04-05' }
  ],
  agendamentos: [
    { id: 'a1', pacienteId: 'pc1', pacienteNome: 'Lucas Oliveira',  profissionalId: 'p1', profissionalNome: 'Dr. André Mendonça', especialidade: 'Terapia ABA + Psicomotricidade', dataHora: '2026-10-05T14:00', status: 'Confirmado', valor: 180, entradaEm: null, criadoEm: '2026-09-28' },
    { id: 'a2', pacienteId: 'pc2', pacienteNome: 'Miguel Ferreira', profissionalId: 'p4', profissionalNome: 'Dr. Carlos Lima',    especialidade: 'Fonoaudiologia',                dataHora: '2026-10-05T09:00', status: 'Confirmado', valor: 170, entradaEm: null, criadoEm: '2026-09-29' },
    { id: 'a3', pacienteId: 'pc3', pacienteNome: 'Sofia Marques',   profissionalId: 'p2', profissionalNome: 'Dra. Camila Rocha',  especialidade: 'Terapia Nutricional',           dataHora: '2026-10-06T16:30', status: 'Aguardando', valor: 150, entradaEm: null, criadoEm: '2026-09-30' },
    { id: 'a4', pacienteId: 'pc1', pacienteNome: 'Lucas Oliveira',  profissionalId: 'p1', profissionalNome: 'Dr. André Mendonça', especialidade: 'Terapia ABA + Psicomotricidade', dataHora: '2026-09-22T14:00', status: 'Concluído',  valor: 180, entradaEm: '2026-09-22T13:55', criadoEm: '2026-09-10' }
  ],
  solicitacoes: [
    { id: 's1', pacienteId: 'pc1', pacienteNome: 'Lucas Oliveira', profissionalNome: 'Dr. André Mendonça', observacao: 'Manter 1 sessão por semana, preferência à tarde.', status: 'Pendente', criadoEm: '2026-09-30' }
  ],
  financeiro: [
    { id: 'f1', descricao: 'Folha de Pagamento - Equipe Terapêutica', categoria: 'Recursos Humanos',  dataPagamento: '2026-10-05', valor: 14200, status: 'Pago' },
    { id: 'f2', descricao: 'Aluguel da Sede do Instituto',            categoria: 'Infraestrutura',   dataPagamento: '2026-10-01', valor: 4500,  status: 'Pago' },
    { id: 'f3', descricao: 'Materiais de Terapia ABA e Brinquedos',   categoria: 'Insumos Clínicos', dataPagamento: '2026-10-08', valor: 1600,  status: 'Pago' },
    { id: 'f4', descricao: 'Licenças de Software e Prontuário',       categoria: 'Tecnologia',       dataPagamento: '2026-10-10', valor: 1000,  status: 'Pago' }
  ]
};

/* ---------------------- Migração da versão anterior ---------------------- */
/* Converte as chaves antigas do projeto (usuarios / agendamentos /
   db_agendamentos / usuarioLogado) para o modelo novo, sem perder dados. */
function migrarDadosLegados() {
  const legadoUsuarios = Armazenamento.ler(TP_LEGADO.usuarios, null);
  if (Array.isArray(legadoUsuarios) && legadoUsuarios.length && !Armazenamento.existe(TP_COLECOES.usuarios)) {
    const convertidos = legadoUsuarios.map(function (u, i) {
      return {
        id: 'u' + (i + 1),
        cpf: (u.cpf || '').replace(/\D/g, '') || '00000000000',
        nome: u.nome || 'Usuário',
        email: u.email || '',
        senha: u.senha || '123',
        perfil: u.perfil || 'cliente',
        cargo: u.cargo || '',
        ativo: true
      };
    });
    Armazenamento.gravar(TP_COLECOES.usuarios, convertidos);
    console.info('[Banco] Usuários antigos migrados:', convertidos.length);
  }

  const legadoAgendamentos = Armazenamento.ler(TP_LEGADO.agendamentos, []).concat(Armazenamento.ler(TP_LEGADO.db_agendamentos, []));
  if (legadoAgendamentos.length && !Armazenamento.existe(TP_COLEICOES_AG)) {
    const convertidos = legadoAgendamentos.map(function (a, i) {
      const nomeCliente = a.clienteNome || a.pacienteNome || 'Paciente';
      return {
        id: 'mig' + i,
        pacienteId: a.pacienteId || null,
        pacienteNome: nomeCliente,
        profissionalNome: a.profissionalNome || a.profissional || 'Profissional',
        especialidade: a.tipo || a.especialidade || 'Atendimento',
        dataHora: (a.dataHora || a.data || '').slice(0, 16),
        status: a.status || 'Confirmado',
        valor: Number(a.valor) || 0,
        entradaEm: null,
        criadoEm: a.criadoEm || ''
      };
    });
    Armazenamento.gravar(TP_COLECOES.agendamentos, convertidos);
    console.info('[Banco] Agendamentos antigos migrados:', convertidos.length);
  }
}

const TP_COLEICOES_AG = TP_COLECOES.agendamentos;

/* Preenche o banco na primeira execução (modo demonstração) */
function semearDemonstracao(forcar) {
  Object.keys(TP_COLECOES).forEach(function (nome) {
    const chave = TP_COLECOES[nome];
    if (forcar || !Armazenamento.existe(chave)) {
      Armazenamento.gravar(chave, TP_DADOS_DEMO[nome] || []);
    }
  });
}

/* ==========================================================================
   ADAPTADOR FIREBASE (Firestore)
   Só é acionado quando js/firebase-config.js tiver  ativo: true  e as
   credenciais preenchidas. Enquanto isso o sistema usa o localStorage.
   ========================================================================== */
const FirebaseAdapter = {
  app: null,
  db: null,

  /* Carrega o SDK compat do Firebase via CDN apenas quando necessário */
  carregarSdk() {
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) return Promise.resolve();
    const urls = [
      'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
    ];
    return urls.reduce(function (cadeia, url) {
      return cadeia.then(function () {
        return new Promise(function (resolver, rejeitar) {
          const script = document.createElement('script');
          script.src = url;
          script.onload = resolver;
          script.onerror = function () { rejeitar(new Error('Falha ao carregar ' + url)); };
          document.head.appendChild(script);
        });
      });
    }, Promise.resolve());
  },

  async iniciar() {
    await this.carregarSdk();
    this.app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(TP_FIREBASE.config);
    this.db = firebase.firestore();
    await this.listar('pacientes', null); // teste de leitura/leitura de permissão
    return true;
  },

  refColecao(nomeLocal) {
    const colecao = TP_COLECOES[nomeLocal] || nomeLocal;
    return this.db.collection(TP_FIREBASE.documentoRaiz).doc(TP_FIREBASE.documentoEstado).collection(colecao);
  },

  async listar(nomeLocal, filtro) {
    let consulta = this.refColecao(nomeLocal);
    if (filtro) {
      Object.keys(filtro).forEach(function (campo) { consulta = consulta.where(campo, '==', filtro[campo]); });
    }
    const snap = await consulta.get();
    return snap.docs.map(function (doc) { return Object.assign({ id: doc.id }, doc.data()); });
  },

  async obter(nomeLocal, id) {
    const doc = await this.refColecao(nomeLocal).doc(String(id)).get();
    return doc.exists ? Object.assign({ id: doc.id }, doc.data()) : null;
  },

  async salvar(nomeLocal, registro) {
    const dados = Object.assign({}, registro);
    const id = String(dados.id || Banco.gerarId());
    delete dados.id;
    await this.refColecao(nomeLocal).doc(id).set(dados, { merge: true });
    return Object.assign({ id: id }, dados);
  },

  async remover(nomeLocal, id) {
    await this.refColecao(nomeLocal).doc(String(id)).delete();
    return true;
  }
};

/* ==========================================================================
   API PÚBLICA — use sempre estas funções nos painéis
   ========================================================================== */
const Banco = {
  modo: 'local',
  _promessaInicio: null,

  /* Garante que o banco está pronto (semente/migração ou Firebase) */
  iniciar() {
    if (!this._promessaInicio) this._promessaInicio = this._iniciarDeVerdade();
    return this._promessaInicio;
  },

  async _iniciarDeVerdade() {
    const configurado = typeof TP_FIREBASE !== 'undefined' && TP_FIREBASE && TP_FIREBASE.ativo &&
      String(TP_FIREBASE.config.apiKey).indexOf('COLE_') !== 0;

    if (configurado) {
      try {
        await FirebaseAdapter.iniciar();
        this.modo = 'firebase';
      } catch (erro) {
        console.warn('[Banco] Firebase indisponível — continuando no localStorage.', erro);
        this.modo = 'local';
      }
    } else {
      this.modo = 'local';
    }

    if (this.modo === 'local') {
      migrarDadosLegados();
      semearDemonstracao(false);
    }
    console.info('[Banco] Modo de dados ativo:', this.modo);
    return this.modo;
  },

  /* ------------------------------- Helpers ------------------------------- */
  gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  ordenar(lista, campo, crescente) {
    return lista.slice().sort(function (a, b) {
      const va = a[campo] || '', vb = b[campo] || '';
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * (crescente === false ? -1 : 1);
    });
  },

  /* ------------------------------ Operações ------------------------------ */
  async listar(nomeLocal, filtro) {
    await this.iniciar();
    const dados = this.modo === 'firebase'
      ? await FirebaseAdapter.listar(nomeLocal, filtro)
      : Armazenamento.ler(TP_COLECOES[nomeLocal], []);

    if (!filtro || this.modo === 'firebase') return dados;
    return dados.filter(function (registro) {
      return Object.keys(filtro).every(function (campo) { return registro[campo] === filtro[campo]; });
    });
  },

  async obter(nomeLocal, id) {
    await this.iniciar();
    if (this.modo === 'firebase') return FirebaseAdapter.obter(nomeLocal, id);
    const dados = Armazenamento.ler(TP_COLECOES[nomeLocal], []);
    return dados.find(function (r) { return String(r.id) === String(id); }) || null;
  },

  async salvar(nomeLocal, registro) {
    await this.iniciar();
    const dados = Object.assign({}, registro);
    if (!dados.id) dados.id = this.gerarId();
    if (!dados.criadoEm) dados.criadoEm = new Date().toISOString().slice(0, 10);

    if (this.modo === 'firebase') return FirebaseAdapter.salvar(nomeLocal, dados);

    const lista = Armazenamento.ler(TP_COLECOES[nomeLocal], []);
    const indice = lista.findIndex(function (r) { return String(r.id) === String(dados.id); });
    if (indice >= 0) lista[indice] = dados; else lista.push(dados);
    Armazenamento.gravar(TP_COLECOES[nomeLocal], lista);
    return dados;
  },

  async remover(nomeLocal, id) {
    await this.iniciar();
    if (this.modo === 'firebase') return FirebaseAdapter.remover(nomeLocal, id);
    const lista = Armazenamento.ler(TP_COLECOES[nomeLocal], [])
      .filter(function (r) { return String(r.id) !== String(id); });
    Armazenamento.gravar(TP_COLECOES[nomeLocal], lista);
    return true;
  },

  async contar(nomeLocal, filtro) {
    const lista = await this.listar(nomeLocal, filtro || null);
    return lista.length;
  },

  /* Restaura os dados de demonstração (útil em apresentações) */
  async resetarDemonstracao() {
    this._promessaInicio = null;
    this.modo = 'local';
    semearDemonstracao(true);
    return true;
  }
};
