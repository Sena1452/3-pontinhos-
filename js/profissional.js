/* ==========================================================================
   js/profissional.js — Painel do profissional
   Lista os atendimentos do próprio profissional, marca a entrada na sala,
   conclui sessões e solicita a próxima consulta para a coordenadoria.
   ========================================================================== */
'use strict';

(function () {
  const sessao = window.TP_SESSAO;
  if (!sessao) return;

  Auth.montarCabecalho(sessao);
  Global.ligarPiscadaDaLogo();

  let agendamentos = [];
  let solicitacoes = [];

  const corpoTabela = document.getElementById('corpoTabela');
  const filtroData = document.getElementById('filtroData');
  const avisoSolicitacoes = document.getElementById('avisoSolicitacoes');

  function classeDoStatus(status) {
    if (status === 'Concluído') return 'status-concluido';
    if (status === 'Cancelado') return 'status-cancelado';
    if (status === 'Aguardando') return 'status-aguardando';
    return 'status-confirmado';
  }

  /* ----------------------------- Renderização ----------------------------- */
  function atendimentosFiltrados() {
    const dia = filtroData.value;
    const lista = agendamentos.slice();
    if (!dia) return Banco.ordenar(lista, 'dataHora');
    return Banco.ordenar(lista.filter(function (a) { return Global.apenasData(a.dataHora) === dia; }), 'dataHora');
  }

  function renderizarTabela() {
    const lista = atendimentosFiltrados();

    if (!lista.length) {
      corpoTabela.innerHTML = '<tr><td colspan="6" class="linha-suave" style="text-align:center; padding:2rem">' +
        'Nenhum atendimento encontrado para este filtro.</td></tr>';
      return;
    }

    corpoTabela.innerHTML = lista.map(function (item) {
      const presente = !!item.entradaEm;
      const podeConcluir = item.status !== 'Concluído' && item.status !== 'Cancelado';

      return '' +
        '<tr>' +
          '<td>' +
            '<button type="button" class="btn-presenca" data-acao="presenca" data-id="' + item.id + '">' +
              '<span class="status-bolinha ' + (presente ? 'bolinha-verde' : 'bolinha-cinza') + '"></span>' +
              '<small>' + (presente ? 'Em atendimento' : 'Marcar entrada na sala') + '</small>' +
            '</button>' +
          '</td>' +
          '<td><strong>' + Global.escaparHTML(item.pacienteNome) + '</strong></td>' +
          '<td>' + Global.hora(item.dataHora) + '<br><span class="linha-suave">' + Global.data(item.dataHora) + '</span></td>' +
          '<td>' + Global.escaparHTML(item.especialidade) + '</td>' +
          '<td><span class="badge-status ' + classeDoStatus(item.status) + '">' + Global.escaparHTML(item.status) + '</span></td>' +
          '<td style="white-space:nowrap">' +
            (podeConcluir
              ? '<button type="button" class="btn-primary btn-pequeno" data-acao="concluir" data-id="' + item.id + '">✔ Concluir</button> '
              : '') +
            '<button type="button" class="btn-laranja btn-pequeno" data-acao="solicitar" data-id="' + item.id + '" ' +
              'title="Pedir à coordenadoria o próximo agendamento deste paciente">🗓️ Próxima consulta</button>' +
          '</td>' +
        '</tr>';
    }).join('');
  }

  function renderizarSolicitacoes() {
    const pendentes = solicitacoes.filter(function (s) { return s.status === 'Pendente'; });

    if (!pendentes.length) {
      avisoSolicitacoes.innerHTML = '';
      return;
    }

    avisoSolicitacoes.innerHTML = pendentes.map(function (s) {
      return '' +
        '<div class="aviso aviso-info">' +
          '<div>' +
            '<h4>📩 Solicitação enviada para a coordenadoria</h4>' +
            '<p>Próxima consulta de <strong>' + Global.escaparHTML(s.pacienteNome) + '</strong> aguardando escolha de dia e horário.</p>' +
          '</div>' +
          '<span class="badge-status status-aguardando">Pendente</span>' +
        '</div>';
    }).join('');
  }

  /* -------------------------------- Ações -------------------------------- */
  async function alternarPresenca(id) {
    const item = agendamentos.find(function (a) { return String(a.id) === String(id); });
    if (!item) return;

    item.entradaEm = item.entradaEm ? null : new Date().toISOString();
    if (item.entradaEm && item.status === 'Confirmado') item.status = 'Confirmado';
    await Banco.salvar('agendamentos', item);
    Global.avisar(item.entradaEm ? 'Entrada na sala registrada.' : 'Entrada cancelada.', item.entradaEm ? 'sucesso' : '');
    renderizarTabela();
  }

  async function concluirAtendimento(id) {
    const item = agendamentos.find(function (a) { return String(a.id) === String(id); });
    if (!item) return;
    if (!Global.confirmar('Marcar este atendimento como concluído?')) return;

    item.status = 'Concluído';
    if (!item.entradaEm) item.entradaEm = new Date().toISOString();
    await Banco.salvar('agendamentos', item);
    Global.avisar('Atendimento concluído. O valor entra no faturamento da diretoria.', 'sucesso');
    await carregar();
  }

  async function solicitarProxima(id) {
    const item = agendamentos.find(function (a) { return String(a.id) === String(id); });
    if (!item) return;

    const jaExiste = solicitacoes.some(function (s) {
      return s.pacienteId === item.pacienteId && s.status === 'Pendente';
    });
    if (jaExiste) {
      Global.avisar('Já existe uma solicitação pendente para este paciente.', 'erro');
      return;
    }

    await Banco.salvar('solicitacoes', {
      pacienteId: item.pacienteId,
      pacienteNome: item.pacienteNome,
      profissionalNome: sessao.nome,
      terapia: item.especialidade,
      observacao: 'Solicitada pelo profissional em ' + Global.data(new Date().toISOString()) + '.',
      status: 'Pendente',
      criadoEm: new Date().toISOString().slice(0, 10)
    });

    Global.avisar('Solicitação enviada para a coordenadoria.', 'sucesso');
    await carregar();
  }

  /* ------------------------------ Carregar ------------------------------- */
  async function carregar() {
    await Banco.iniciar();
    document.getElementById('modoDados').textContent =
      Banco.modo === 'firebase' ? 'Firebase (nuvem)' : 'localStorage (demonstração)';

    const todos = await Banco.listar('agendamentos');
    const meus = todos.filter(function (a) { return a.profissionalNome === sessao.nome; });
    agendamentos = meus.length ? meus : todos;

    solicitacoes = (await Banco.listar('solicitacoes')).filter(function (s) {
      return s.profissionalNome === sessao.nome;
    });

    // Se o filtro estiver vazio, posiciona na data do próximo atendimento
    if (!filtroData.value) {
      const proximo = Banco.ordenar(agendamentos.filter(function (a) {
        return new Date(a.dataHora) >= new Date() && a.status !== 'Cancelado';
      }), 'dataHora')[0];
      filtroData.value = proximo ? Global.apenasData(proximo.dataHora) : '';
    }

    renderizarTabela();
    renderizarSolicitacoes();
  }

  /* ------------------------------- Eventos ------------------------------- */
  filtroData.addEventListener('change', renderizarTabela);
  document.querySelector('[data-acao="ver-todos"]').addEventListener('click', function () {
    filtroData.value = '';
    renderizarTabela();
  });

  corpoTabela.addEventListener('click', function (evento) {
    const botao = evento.target.closest('[data-acao]');
    if (!botao) return;
    const acao = botao.dataset.acao;
    if (acao === 'presenca') alternarPresenca(botao.dataset.id);
    if (acao === 'concluir') concluirAtendimento(botao.dataset.id);
    if (acao === 'solicitar') solicitarProxima(botao.dataset.id);
  });

  Global.ligarFechamentoDeModais();
  carregar();
})();
