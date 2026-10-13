/* ==========================================================================
   js/diretor.js — Painel de Gestão Financeiro & Administrativa
   Instituto Três Pontinhos
   --------------------------------------------------------------------------
   • Gestão Financeira & Fluxo de Caixa (KPIs, Gráficos, Entradas/Despesas)
   • Gestão dos Alunos (Frequência, Justificativas com Atestado, Prontuário)
   • Gestão da ONG (Projetos sociais, fila de espera, capacidade, avisos)
   • Gestão Profissional (Corpo técnico, escalas e cálculo de honorários)
   ========================================================================== */
'use strict';

(function () {
  const sessao = window.TP_SESSAO;
  if (!sessao) return;

  Auth.montarCabecalho(sessao);

  let agendamentos = [];
  let pacientes = [];
  let profissionais = [];
  let financeiro = [];
  let evolucoes = [];
  const graficos = {};

  const NOMES_MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  /* ------------------------------- Abas ------------------------------- */
  function abrirAba(nome) {
    document.querySelectorAll('.btn-aba').forEach(function (b) {
      b.classList.toggle('active', b.dataset.aba === nome);
    });
    document.querySelectorAll('.secao-aba').forEach(function (s) { s.classList.remove('active'); });
    const secao = document.getElementById('aba-' + nome);
    if (secao) secao.classList.add('active');

    if (nome === 'alunos') renderizarAlunos();
    if (nome === 'financeiro') renderizarGraficos();
  }

  /* ------------------------------ Cálculos ------------------------------ */
  function statusDoMes(iso) {
    return Global.apenasData(iso).slice(0, 7); // AAAA-MM
  }

  function totais() {
    const receitaRealizada = agendamentos
      .filter(function (a) { return a.status === 'Concluído'; })
      .reduce(function (soma, a) { return soma + Number(a.valor || 0); }, 0);

    const previsao = agendamentos
      .filter(function (a) { return a.status === 'Confirmado' || a.status === 'Aguardando'; })
      .reduce(function (soma, a) { return soma + Number(a.valor || 0); }, 0);

    const despesasPagas = financeiro
      .filter(function (f) { return f.status === 'Pago'; })
      .reduce(function (soma, f) { return soma + Number(f.valor || 0); }, 0);

    const despesasAPagar = financeiro
      .filter(function (f) { return f.status !== 'Pago'; })
      .reduce(function (soma, f) { return soma + Number(f.valor || 0); }, 0);

    return {
      receitaRealizada: receitaRealizada,
      previsao: previsao,
      despesasPagas: despesasPagas,
      despesasAPagar: despesasAPagar,
      resultado: receitaRealizada - despesasPagas
    };
  }

  function receitaPorMes() {
    const mapa = {};
    agendamentos.forEach(function (a) {
      if (a.status !== 'Concluído') return;
      const chave = statusDoMes(a.dataHora);
      mapa[chave] = (mapa[chave] || 0) + Number(a.valor || 0);
    });

    const chaves = Object.keys(mapa).sort().slice(-6);
    return {
      rotulos: chaves.map(function (chave) {
        const partes = chave.split('-');
        return NOMES_MESES_CURTO[Number(partes[1]) - 1] + '/' + partes[0].slice(2);
      }),
      valores: chaves.map(function (chave) { return mapa[chave]; })
    };
  }

  function despesasPorCategoria() {
    const mapa = {};
    financeiro.forEach(function (f) {
      const categoria = f.categoria || 'Outros';
      mapa[categoria] = (mapa[categoria] || 0) + Number(f.valor || 0);
    });
    return {
      rotulos: Object.keys(mapa),
      valores: Object.keys(mapa).map(function (c) { return mapa[c]; })
    };
  }

  function atendimentosPorTerapia() {
    const mapa = {};
    agendamentos.forEach(function (a) {
      const terapia = a.especialidade || 'Não informada';
      mapa[terapia] = (mapa[terapia] || 0) + 1;
    });
    return {
      rotulos: Object.keys(mapa),
      valores: Object.keys(mapa).map(function (t) { return mapa[t]; })
    };
  }

  /* ------------------------------- KPIs ------------------------------- */
  function renderizarKpis() {
    const t = totais();

    document.getElementById('kpiReceita').textContent = Global.moeda(t.receitaRealizada);
    document.getElementById('kpiPrevisao').textContent = Global.moeda(t.previsao);
    document.getElementById('kpiDespesas').textContent = Global.moeda(t.despesasPagas);
    document.getElementById('kpiPacientes').textContent = pacientes.length;
    document.getElementById('kpiProfissionais').textContent = profissionais.filter(function (p) {
      return p.ativo !== false;
    }).length;

    const campoResultado = document.getElementById('kpiResultado');
    campoResultado.textContent = Global.moeda(t.resultado);
    campoResultado.className = 'valor-dash ' + (t.resultado >= 0 ? 'valor-positivo' : 'valor-negativo');

    const extras = document.getElementById('kpiDespesas').parentElement.querySelector('.form-hint');
    if (extras) {
      extras.textContent = t.despesasAPagar > 0
        ? 'Pagas. A pagar: ' + Global.moeda(t.despesasAPagar)
        : 'Contas quitadas no período';
    }
  }

  /* ----------------------------- Gráficos ----------------------------- */
  function montarOuAtualizar(id, configuracao) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    if (graficos[id]) {
      graficos[id].data = configuracao.data;
      graficos[id].update();
      return;
    }
    graficos[id] = new Chart(canvas.getContext('2d'), configuracao);
  }

  function renderizarGraficos() {
    const receita = receitaPorMes();
    const despesas = despesasPorCategoria();
    const terapias = atendimentosPorTerapia();

    montarOuAtualizar('chartEvolucao', {
      type: 'line',
      data: {
        labels: receita.rotulos.length ? receita.rotulos : ['Sem dados'],
        datasets: [{
          label: 'Receita (R$)',
          data: receita.valores.length ? receita.valores : [0],
          borderColor: '#1a73e8',
          backgroundColor: 'rgba(26, 115, 232, 0.12)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#ff7a00'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true } } }
    });

    montarOuAtualizar('chartDespesas', {
      type: 'doughnut',
      data: {
        labels: despesas.rotulos.length ? despesas.rotulos : ['Sem despesas'],
        datasets: [{
          data: despesas.valores.length ? despesas.valores : [1],
          backgroundColor: ['#1a73e8', '#ff7a00', '#eab308', '#64748b', '#10b981', '#8b5cf6']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } } }
    });

    montarOuAtualizar('chartTerapias', {
      type: 'bar',
      data: {
        labels: terapias.rotulos.length ? terapias.rotulos : ['Sem atendimentos'],
        datasets: [{
          label: 'Atendimentos',
          data: terapias.valores.length ? terapias.valores : [0],
          backgroundColor: '#1a73e8',
          borderRadius: 6
        }]
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  /* ---------------------------- Financeiro ---------------------------- */
  function renderizarFinanceiro() {
    const mes = document.getElementById('financeiroMes').value;
    const lista = Banco.ordenar(
      mes ? financeiro.filter(function (f) { return String(f.dataPagamento).slice(0, 7) === mes; }) : financeiro,
      'dataPagamento', false
    );

    const corpo = document.getElementById('tabelaFinanceira');

    if (!lista.length) {
      corpo.innerHTML = '<tr><td colspan="6" class="linha-suave" style="text-align:center; padding:2rem">' +
        'Nenhuma movimentação registrada para este filtro.</td></tr>';
      return;
    }

    corpo.innerHTML = lista.map(function (f) {
      return '' +
        '<tr>' +
          '<td><strong>' + Global.escaparHTML(f.descricao) + '</strong></td>' +
          '<td>' + Global.escaparHTML(f.categoria) + '</td>' +
          '<td>' + Global.data(f.dataPagamento) + '</td>' +
          '<td><strong>' + Global.moeda(f.valor) + '</strong></td>' +
          '<td><span class="badge-status ' + (f.status === 'Pago' ? 'status-concluido' : 'status-aguardando') + '">' +
            Global.escaparHTML(f.status) + '</span></td>' +
          '<td><button type="button" class="btn-perigo btn-pequeno" data-acao="remover-despesa" ' +
            'data-id="' + f.id + '">Excluir</button></td>' +
        '</tr>';
    }).join('');
  }

  async function lancarDespesa(evento) {
    evento.preventDefault();
    const status = document.getElementById('statusDespesa');
    const valor = Number(document.getElementById('despesaValor').value);

    if (!valor || valor <= 0) {
      status.className = 'form-status erro';
      status.textContent = '⚠️ Informe um valor maior que zero.';
      return;
    }

    await Banco.salvar('financeiro', {
      descricao: document.getElementById('despesaDescricao').value.trim(),
      categoria: document.getElementById('despesaCategoria').value,
      valor: valor,
      dataPagamento: document.getElementById('despesaData').value,
      status: document.getElementById('despesaStatus').value
    });

    document.getElementById('formDespesa').reset();
    document.getElementById('despesaData').value = new Date().toISOString().slice(0, 10);
    status.className = 'form-status ok';
    status.textContent = '✅ Lançamento registrado com sucesso.';
    Global.avisar('Lançamento financeiro registrado.', 'sucesso');
    await carregar();
  }

  /* --------------------------- Gestão dos Alunos --------------------------- */
  function renderizarAlunos() {
    const alvo = document.getElementById('listaAlunosGestao');
    if (!alvo) return;

    const termo = (document.getElementById('buscaAlunos') ? document.getElementById('buscaAlunos').value : '').toLowerCase().trim();
    const filtrados = pacientes.filter(function (p) {
      return (p.nome || '').toLowerCase().indexOf(termo) !== -1 ||
             (p.terapia || '').toLowerCase().indexOf(termo) !== -1 ||
             (p.responsavel || '').toLowerCase().indexOf(termo) !== -1;
    });

    if (!filtrados.length) {
      alvo.innerHTML = '<p class="estado-vazio">Nenhum aluno encontrado na busca.</p>';
      return;
    }

    alvo.innerHTML = filtrados.map(function (p) {
      const seusAg = agendamentos.filter(function (a) { return String(a.pacienteId) === String(p.id); });
      const presencas = seusAg.filter(function (a) { return a.status === 'Concluído'; }).length;
      const faltasJustificadas = seusAg.filter(function (a) { return a.status === 'Falta Justificada'; });
      const totalFaltas = seusAg.filter(function (a) { return a.status === 'Falta Justificada' || a.status === 'Falta Não Justificada'; }).length;
      const relatoriosDoAluno = evolucoes.filter(function (e) { return String(e.pacienteId) === String(p.id); });

      const foto = p.foto
        ? '<img class="foto-paciente" src="' + p.foto + '" alt="Foto de ' + Global.escaparHTML(p.nome) + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--azul-vibrante);">'
        : '<span class="foto-paciente" style="width:64px;height:64px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--azul-claro);color:var(--azul-escuro);font-weight:800;font-size:1.2rem;">' +
          Global.escaparHTML(String(p.nome).charAt(0).toUpperCase()) + '</span>';

      const botoesAtestados = faltasJustificadas.map(function (f) {
        return '<button type="button" class="btn-outline btn-pequeno" style="border-color:#8b5cf6; color:#5b21b6;" data-acao="ver-atestado-diretor" data-id="' + f.id + '">📄 Atestado Falta (' + Global.data(f.dataHora) + ')</button>';
      }).join(' ');

      return '' +
        '<article class="card-consulta" style="background:#fff; box-shadow:var(--sombra-card);">' +
          '<div style="display:flex; gap:1rem; align-items:center; margin-bottom:.8rem;">' +
            foto +
            '<div>' +
              '<h3 style="color:var(--azul-escuro); font-size:1.15rem; margin:0;">' + Global.escaparHTML(p.nome) + '</h3>' +
              '<p class="linha-suave" style="margin:2px 0; font-weight:700; color:var(--azul-vibrante);">' + Global.escaparHTML(p.terapia) + '</p>' +
              '<p class="linha-suave" style="margin:0; font-size:.82rem;"><strong>Idade:</strong> ' + Global.idade(p.nascimento) + ' · <strong>Responsável:</strong> ' + Global.escaparHTML(p.responsavel) + '</p>' +
            '</div>' +
          '</div>' +
          '<div style="margin-bottom:.8rem; display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; font-size:.82rem;">' +
            '<span class="badge-status status-concluido">✅ ' + presencas + ' Presença(s)</span>' +
            '<span class="badge-status ' + (totalFaltas > 0 ? 'status-cancelado' : 'status-confirmado') + '">⚠️ ' + totalFaltas + ' Falta(s)</span>' +
            '<span class="badge-status status-confirmado">📋 ' + relatoriosDoAluno.length + ' Relatório(s) Técnico(s)</span>' +
            '<span class="badge-status status-aguardando">Mensalidade: Dia ' + Global.escaparHTML(p.diaPagamento || '10') + '</span>' +
          '</div>' +
          '<div class="acoes">' +
            '<button type="button" class="btn-primary btn-pequeno" data-acao="ver-relatorios-aluno" data-id="' + p.id + '">📑 Prontuário & Relatórios da Equipe</button>' +
            botoesAtestados +
          '</div>' +
        '</article>';
    }).join('');
  }

  function abrirAtestadoDiretor(agendamentoId) {
    const item = agendamentos.find(function (a) { return String(a.id) === String(agendamentoId); });
    if (!item || !item.faltaComprovante) return;

    document.getElementById('diretorComprovanteTitulo').textContent =
      item.pacienteNome + ' — Consulta de ' + Global.dataLonga(item.dataHora);
    document.getElementById('diretorComprovanteMotivo').textContent = item.faltaMotivo || 'Não informado';
    document.getElementById('diretorComprovanteData').textContent =
      'Enviado em: ' + (item.faltaDataRegistro ? new Date(item.faltaDataRegistro).toLocaleString('pt-BR') : 'Data não registrada');
    document.getElementById('diretorComprovanteImagem').src = item.faltaComprovante;

    Global.abrirModal('modalVerComprovanteDiretor');
  }

  function abrirRelatoriosAlunoDiretor(pacienteId) {
    const p = pacientes.find(function (item) { return String(item.id) === String(pacienteId); });
    if (!p) return;

    document.getElementById('diretorRelatoriosAlunoNome').textContent =
      'Prontuário de ' + p.nome + ' (' + (p.terapia || 'Terapia Integrada') + ') — Responsável: ' + p.responsavel;

    const lista = Banco.ordenar(evolucoes.filter(function (e) {
      return String(e.pacienteId) === String(pacienteId);
    }), 'dataSessao', false);

    const corpo = document.getElementById('tabelaRelatoriosAlunoDiretor');
    if (!lista.length) {
      corpo.innerHTML = '<tr><td colspan="8" class="linha-suave" style="text-align:center; padding:2rem">Nenhum relatório pós-consulta arquivado para esta criança até o momento.</td></tr>';
    } else {
      corpo.innerHTML = lista.map(function (r) {
        return '<tr>' +
          '<td><strong>' + Global.data(r.dataSessao) + '</strong></td>' +
          '<td>' + Global.escaparHTML(r.atendenteNome || 'Terapeuta / AT') + '</td>' +
          '<td><span class="badge-status status-confirmado">' + r.critAtencao + '/5</span></td>' +
          '<td><span class="badge-status status-confirmado">' + r.critComunicacao + '/5</span></td>' +
          '<td><span class="badge-status status-confirmado">' + r.critRegulacao + '/5</span></td>' +
          '<td><span class="badge-status status-confirmado">' + r.critMotricidade + '/5</span></td>' +
          '<td><span class="badge-status status-confirmado">' + r.critObjetivos + '/5</span></td>' +
          '<td style="max-width:260px; font-size:.82rem">' + Global.escaparHTML(r.observacoes) + '</td>' +
        '</tr>';
      }).join('');
    }

    Global.abrirModal('modalRelatoriosAlunoDiretor');
  }

  /* --------------------------- Profissionais --------------------------- */
  function renderizarProfissionais() {
    const lista = Banco.ordenar(profissionais, 'nome');
    const alvo = document.getElementById('listaProfissionais');

    if (!lista.length) {
      alvo.innerHTML = '<p class="estado-vazio">Nenhum profissional cadastrado.</p>';
      return;
    }

    alvo.innerHTML = lista.map(function (p) {
      const atendimentos = agendamentos.filter(function (a) {
        return a.profissionalNome === p.nome && a.status === 'Concluído';
      }).length;
      const totalRepasse = atendimentos * Number(p.valorSessao || 0);

      return '' +
        '<div class="card-generico mb-1">' +
          '<div style="display:flex; justify-content:space-between; gap:1rem; align-items:flex-start">' +
            '<div>' +
              '<strong style="font-size:1.05rem; color:var(--azul-escuro);">' + Global.escaparHTML(p.nome) + '</strong>' +
              '<p class="linha-suave">' + Global.escaparHTML(p.ocupacao) + ' (' + Global.escaparHTML(p.registro) + ')</p>' +
              '<p class="linha-suave">' + Global.escaparHTML(p.telefone) + ' · ' +
                Global.moeda(p.valorSessao) + '/sessão · <strong>' + atendimentos + ' atendimento(s) concluído(s)</strong></p>' +
              '<p class="linha-suave" style="color:var(--azul-vibrante); font-weight:700; margin-top:.3rem;">' +
                'Honorários a repassar no mês: ' + Global.moeda(totalRepasse) + '</p>' +
            '</div>' +
            '<span class="badge-status ' + (p.ativo !== false ? 'status-concluido' : 'status-cancelado') + '">' +
              (p.ativo !== false ? 'Ativo' : 'Inativo') + '</span>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  async function cadastrarProfissional(evento) {
    evento.preventDefault();
    const status = document.getElementById('statusProfissional');
    const cpfLimpo = Auth.limparCPF(document.getElementById('profCpf').value);

    if (cpfLimpo.length !== 11) {
      status.className = 'form-status erro';
      status.textContent = '⚠️ Informe um CPF válido com 11 dígitos.';
      return;
    }

    const repetido = profissionais.find(function (p) { return Auth.limparCPF(p.cpf) === cpfLimpo; });
    if (repetido) {
      status.className = 'form-status erro';
      status.textContent = '⚠️ Já existe profissional cadastrado com este CPF (' + repetido.nome + ').';
      return;
    }

    const ocupacao = document.getElementById('profOcupacao').value;
    const ehEstagiario = ocupacao.indexOf('Estagiário') !== -1;

    const profissional = {
      nome: document.getElementById('profNome').value.trim(),
      cpf: cpfLimpo,
      telefone: document.getElementById('profTelefone').value.trim(),
      ocupacao: ocupacao,
      registro: document.getElementById('profRegistro').value.trim(),
      valorSessao: Number(document.getElementById('profValor').value) || 0,
      ativo: true
    };

    await Banco.salvar('profissionais', profissional);

    // Cria o acesso do profissional ou estagiário na Área Restrita
    const usuarios = await Banco.listar('usuarios');
    const jaTemUsuario = usuarios.some(function (u) { return Auth.limparCPF(u.cpf) === cpfLimpo; });

    if (!jaTemUsuario) {
      await Banco.salvar('usuarios', {
        cpf: cpfLimpo,
        nome: profissional.nome,
        email: '',
        senha: '123',
        perfil: ehEstagiario ? 'estagiario' : 'profissional',
        cargo: profissional.ocupacao,
        ativo: true
      });
    }

    document.getElementById('formProfissional').reset();
    status.className = 'form-status ok';
    status.textContent = '✅ Profissional cadastrado! Acesso liberado com o CPF e senha inicial 123.';
    Global.avisar('Profissional cadastrado com sucesso.', 'sucesso');
    await carregar();
  }

  /* ------------------------------ Carregar ------------------------------ */
  async function carregar() {
    await Banco.iniciar();
    document.getElementById('modoDados').textContent =
      Banco.modo === 'firebase' ? 'Firebase (nuvem)' : 'localStorage (demonstração)';

    agendamentos = await Banco.listar('agendamentos');
    pacientes = await Banco.listar('pacientes');
    profissionais = await Banco.listar('profissionais');
    financeiro = await Banco.listar('financeiro');
    evolucoes = await Banco.listar('evolucoes');

    renderizarKpis();
    renderizarGraficos();
    renderizarFinanceiro();
    renderizarProfissionais();
    renderizarAlunos();
  }

  /* ------------------------------- Eventos ------------------------------- */
  document.querySelectorAll('.btn-aba').forEach(function (botao) {
    botao.addEventListener('click', function () { abrirAba(botao.dataset.aba); });
  });

  const formDesp = document.getElementById('formDespesa');
  if (formDesp) formDesp.addEventListener('submit', lancarDespesa);

  const formProf = document.getElementById('formProfissional');
  if (formProf) formProf.addEventListener('submit', cadastrarProfissional);

  const mesFiltro = document.getElementById('financeiroMes');
  if (mesFiltro) mesFiltro.addEventListener('change', renderizarFinanceiro);

  const btnVerTodosFin = document.querySelector('[data-acao="ver-todos-financeiro"]');
  if (btnVerTodosFin) {
    btnVerTodosFin.addEventListener('click', function () {
      document.getElementById('financeiroMes').value = '';
      renderizarFinanceiro();
    });
  }

  const buscaAlunosInput = document.getElementById('buscaAlunos');
  if (buscaAlunosInput) buscaAlunosInput.addEventListener('input', renderizarAlunos);

  document.addEventListener('click', async function (evento) {
    const botao = evento.target.closest('[data-acao]');
    if (!botao) return;
    const acao = botao.dataset.acao;

    if (acao === 'remover-despesa') {
      const item = financeiro.find(function (f) { return String(f.id) === String(botao.dataset.id); });
      if (!item) return;
      if (!Global.confirmar('Excluir a movimentação "' + item.descricao + '"?')) return;
      await Banco.remover('financeiro', item.id);
      Global.avisar('Movimentação excluída.', 'sucesso');
      await carregar();
    }

    if (acao === 'ver-atestado-diretor') {
      abrirAtestadoDiretor(botao.dataset.id);
    }

    if (acao === 'fechar-comprovante-diretor') {
      Global.fecharModal('modalVerComprovanteDiretor');
    }

    if (acao === 'ver-relatorios-aluno') {
      abrirRelatoriosAlunoDiretor(botao.dataset.id);
    }

    if (acao === 'fechar-relatorios-diretor') {
      Global.fecharModal('modalRelatoriosAlunoDiretor');
    }

    if (acao === 'restaurar-demo') {
      if (!Global.confirmar('Isto restaura os registros originais de demonstração. Continuar?')) return;
      await Banco.resetarDemonstracao();
      Global.avisar('Dados restaurados.', 'sucesso');
      await carregar();
    }
  });

  // Data padrão do lançamento de movimentação
  const campoDataDesp = document.getElementById('despesaData');
  if (campoDataDesp) campoDataDesp.value = new Date().toISOString().slice(0, 10);

  carregar();
})();