/* ==========================================================================
   js/estagiario.js — Painel do Estagiário / Acompanhante Terapêutico (AT)
   Instituto Três Pontinhos
   --------------------------------------------------------------------------
   • Acesso à lista de crianças cadastradas
   • Emissão de relatórios pós-consulta (vinculados a cada sessão finalizada)
   • Gráficos de evolução clínica confidencial (acesso restrito à equipe técnica)
   ========================================================================== */
'use strict';

(function () {
  const sessao = window.TP_SESSAO;
  if (!sessao) return;

  Auth.montarCabecalho(sessao);
  Global.ligarPiscadaDaLogo();
  Global.ligarFechamentoDeModais();

  let pacientes = [];
  let evolucoes = [];
  let agendamentos = [];
  let meuGrafico = null;

  const listaPacientesEl = document.getElementById('listaPacientesEstagiario');
  const listaConsultasFinalizadasEl = document.getElementById('listaConsultasFinalizadas');
  const buscaInput = document.getElementById('buscaPaciente');

  /* ------------------- Renderizar Consultas Finalizadas ------------------- */
  function renderizarConsultasFinalizadas() {
    if (!listaConsultasFinalizadasEl) return;
    const hojeIso = new Date().toISOString().slice(0, 10);

    // Consultas de hoje ou concluídas recentemente
    const concluidasHoje = agendamentos.filter(function (a) {
      const dataIso = Global.apenasData(a.dataHora);
      return dataIso === hojeIso || a.status === 'Concluído';
    }).sort(function (a, b) {
      return a.dataHora < b.dataHora ? 1 : -1;
    });

    if (!concluidasHoje.length) {
      listaConsultasFinalizadasEl.innerHTML =
        '<p class="estado-vazio">Nenhuma consulta finalizada hoje até o momento. As consultas marcadas como "Concluído" aparecerão aqui para preenchimento de relatório.</p>';
      return;
    }

    listaConsultasFinalizadasEl.innerHTML = concluidasHoje.slice(0, 6).map(function (a) {
      const jaTemRelatorio = evolucoes.some(function (e) {
        return String(e.agendamentoId) === String(a.id) || (String(e.pacienteId) === String(a.pacienteId) && e.dataSessao === Global.apenasData(a.dataHora));
      });

      return '' +
        '<article class="card-consulta" style="border-left: 4px solid var(--azul-vibrante);">' +
          '<div>' +
            '<div class="info-data">🗓️ ' + Global.dataLonga(a.dataHora) + '</div>' +
            '<div style="font-weight:700; color:var(--azul-escuro); font-size:1.05rem">' + Global.escaparHTML(a.pacienteNome) + '</div>' +
            '<div class="linha-suave"><strong>Terapia:</strong> ' + Global.escaparHTML(a.especialidade) + '</div>' +
            '<div class="linha-suave"><strong>Terapeuta:</strong> ' + Global.escaparHTML(a.profissionalNome) + '</div>' +
          '</div>' +
          '<div class="acoes">' +
            (jaTemRelatorio
              ? '<span class="badge-status status-concluido">✅ Relatório Já Emitido</span>'
              : '<button type="button" class="btn-laranja btn-pequeno" data-acao="relatorio-consulta" data-id="' + a.id + '">📝 Preencher Relatório do Dia</button>') +
          '</div>' +
        '</article>';
    }).join('');
  }

  /* -------------------------- Renderizar Pacientes -------------------------- */
  function renderizarPacientes() {
    const termo = (buscaInput ? buscaInput.value : '').toLowerCase().trim();
    const filtrados = pacientes.filter(function (p) {
      return (p.nome || '').toLowerCase().indexOf(termo) !== -1 ||
             (p.terapia || '').toLowerCase().indexOf(termo) !== -1;
    });

    if (!filtrados.length) {
      listaPacientesEl.innerHTML = '<p class="estado-vazio">Nenhum paciente encontrado na busca.</p>';
      return;
    }

    listaPacientesEl.innerHTML = filtrados.map(function (p) {
      const fotosPaciente = p.foto
        ? '<img class="foto-paciente" src="' + p.foto + '" alt="Foto" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--azul-vibrante);">'
        : '<span class="foto-paciente" style="width:64px;height:64px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--azul-claro);color:var(--azul-escuro);font-weight:800;font-size:1.2rem">' +
          Global.escaparHTML(String(p.nome).charAt(0).toUpperCase()) + '</span>';

      const doPaciente = evolucoes.filter(function (e) { return String(e.pacienteId) === String(p.id); });

      return '' +
        '<article class="card-consulta" style="background:#fff; box-shadow:var(--sombra-card);">' +
          '<div style="display:flex; gap:1rem; align-items:center; margin-bottom:.8rem">' +
            fotosPaciente +
            '<div>' +
              '<h3 style="color:var(--azul-escuro); font-size:1.15rem; margin:0">' + Global.escaparHTML(p.nome) + '</h3>' +
              '<p class="linha-suave" style="margin:2px 0; font-weight:600; color:var(--azul-vibrante)">' + Global.escaparHTML(p.terapia) + '</p>' +
              '<p class="linha-suave" style="margin:0; font-size:.82rem"><strong>Responsável:</strong> ' + Global.escaparHTML(p.responsavel) + ' · ' + Global.idade(p.nascimento) + '</p>' +
            '</div>' +
          '</div>' +
          '<div style="margin-bottom:1rem; display:flex; gap:.5rem; align-items:center; flex-wrap:wrap">' +
            '<span class="badge-status status-confirmado">📋 ' + doPaciente.length + ' relatório(s) pós-consulta</span>' +
            '<span class="badge-status status-aguardando" style="font-size:.7rem">🔒 Confidencial (Apenas equipe)</span>' +
          '</div>' +
          '<div class="acoes">' +
            '<button type="button" class="btn-primary btn-pequeno" data-acao="abrir-ficha" data-id="' + p.id + '">📝 Novo Relatório Clínico</button>' +
            '<button type="button" class="btn-laranja btn-pequeno" data-acao="ver-grafico" data-id="' + p.id + '">📊 Histórico & Gráfico</button>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  /* --------------------------- Abrir Ficha --------------------------- */
  function abrirFicha(pacienteId, agendamentoId) {
    const p = pacientes.find(function (item) { return String(item.id) === String(pacienteId); });
    if (!p) return;

    document.getElementById('fichaPacienteId').value = p.id;
    document.getElementById('fichaPacienteNome').value = p.nome;
    document.getElementById('fichaNomeDisplay').textContent = p.nome;
    document.getElementById('fichaTerapiaDisplay').textContent = p.terapia || 'Acompanhamento Multidisciplinar';

    const campoAgendamentoId = document.getElementById('fichaAgendamentoId');
    if (campoAgendamentoId) campoAgendamentoId.value = agendamentoId || '';

    document.getElementById('fichaData').value = new Date().toISOString().slice(0, 10);
    document.getElementById('fichaAtendente').value = sessao.nome || '';
    document.getElementById('statusFicha').textContent = '';

    // Limpa seleções
    document.getElementById('critAtencao').value = '';
    document.getElementById('critComunicacao').value = '';
    document.getElementById('critRegulacao').value = '';
    document.getElementById('critMotricidade').value = '';
    document.getElementById('critObjetivos').value = '';
    document.getElementById('fichaObservacoes').value = '';

    Global.abrirModal('modalFichaEvolucao');
  }

  function abrirRelatorioPorConsulta(agendamentoId) {
    const a = agendamentos.find(function (item) { return String(item.id) === String(agendamentoId); });
    if (!a) return;
    abbirFicha(a.pacienteId, a.id);
  }

  /* --------------------------- Salvar Ficha --------------------------- */
  async function salvarFicha(evento) {
    evento.preventDefault();

    const statusEl = document.getElementById('statusFicha');
    statusEl.className = 'form-status';
    statusEl.textContent = 'Salvando relatório pós-consulta...';

    const agendamentoId = document.getElementById('fichaAgendamentoId')
      ? document.getElementById('fichaAgendamentoId').value
      : null;

    const registro = {
      pacienteId: document.getElementById('fichaPacienteId').value,
      pacienteNome: document.getElementById('fichaPacienteNome').value,
      agendamentoId: agendamentoId,
      dataSessao: document.getElementById('fichaData').value,
      atendenteNome: document.getElementById('fichaAtendente').value.trim(),

      // Critérios clínicos de desempenho (escala 1 a 5)
      critAtencao: Number(document.getElementById('critAtencao').value),
      critComunicacao: Number(document.getElementById('critComunicacao').value),
      critRegulacao: Number(document.getElementById('critRegulacao').value),
      critMotricidade: Number(document.getElementById('critMotricidade').value),
      critObjetivos: Number(document.getElementById('critObjetivos').value),

      observacoes: document.getElementById('fichaObservacoes').value.trim(),
      criadoEm: new Date().toISOString()
    };

    await Banco.salvar('evolucoes', registro);

    // Se tiver agendamento associado, marca como concluído
    if (agendamentoId) {
      const ag = agendamentos.find(function (item) { return String(item.id) === String(agendamentoId); });
      if (ag && ag.status !== 'Concluído') {
        ag.status = 'Concluído';
        await Banco.salvar('agendamentos', ag);
      }
    }

    statusEl.className = 'form-status ok';
    statusEl.textContent = '✅ Relatório clínico pós-consulta salvo no prontuário!';
    Global.avisar('Relatório pós-consulta gravado com sucesso.', 'sucesso');

    Global.fecharModal('modalFichaEvolucao');
    await carregar();
  }

  /* --------------------------- Exibir Gráfico --------------------------- */
  function renderizarGraficoPaciente(pacienteId) {
    const p = pacientes.find(function (item) { return String(item.id) === String(pacienteId); });
    if (!p) return;

    document.getElementById('graficoNomePaciente').textContent = p.nome + ' — ' + (p.terapia || '');

    const registros = Banco.ordenar(evolucoes.filter(function (e) {
      return String(e.pacienteId) === String(pacienteId);
    }), 'dataSessao');

    document.getElementById('graficoTotalSessoes').textContent = registros.length + ' relatório(s) pós-consulta arquivado(s)';

    // Preenche a tabela no modal
    const corpoTabela = document.getElementById('tabelaHistoricoEvolucao');
    if (!registros.length) {
      corpoTabela.innerHTML = '<tr><td colspan="8" class="linha-suave" style="text-align:center; padding:1.5rem">Nenhum relatório emitido para esta criança ainda.</td></tr>';
    } else {
      corpoTabela.innerHTML = registros.map(function (r) {
        return '<tr>' +
          '<td><strong>' + Global.data(r.dataSessao) + '</strong></td>' +
          '<td>' + Global.escaparHTML(r.atendenteNome) + '</td>' +
          '<td><span class="badge-status status-confirmado">' + r.critAtencao + '/5</span></td>' +
          '<td><span class="badge-status status-confirmado">' + r.critComunicacao + '/5</span></td>' +
          '<td><span class="badge-status status-confirmado">' + r.critRegulacao + '/5</span></td>' +
          '<td><span class="badge-status status-confirmado">' + r.critMotricidade + '/5</span></td>' +
          '<td><span class="badge-status status-confirmado">' + r.critObjetivos + '/5</span></td>' +
          '<td style="max-width:240px; font-size:.82rem">' + Global.escaparHTML(r.observacoes) + '</td>' +
        '</tr>';
      }).join('');
    }

    // Renderiza Chart.js
    const canvas = document.getElementById('canvasEvolucaoPaciente');
    if (meuGrafico) meuGrafico.destroy();

    const rotulos = registros.map(function (r) { return Global.data(r.dataSessao); });

    meuGrafico = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: rotulos.length ? rotulos : ['Sem registros'],
        datasets: [
          { label: 'Atenção e Foco', data: registros.map(r => r.critAtencao), borderColor: '#1a73e8', tension: 0.3, fill: false },
          { label: 'Comunicação', data: registros.map(r => r.critComunicacao), borderColor: '#ff7a00', tension: 0.3, fill: false },
          { label: 'Regulação Emocional', data: registros.map(r => r.critRegulacao), borderColor: '#10b981', tension: 0.3, fill: false },
          { label: 'Motricidade', data: registros.map(r => r.critMotricidade), borderColor: '#8b5cf6', tension: 0.3, fill: false },
          { label: 'Cumprimento de Objetivos', data: registros.map(r => r.critObjetivos), borderColor: '#eab308', tension: 0.3, fill: false }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 0, max: 5, ticks: { stepSize: 1 } } }
      }
    });

    Global.abrirModal('modalGraficoEvolucao');
  }

  /* ------------------------------ Carregar ------------------------------ */
  async function carregar() {
    await Banco.iniciar();
    const modoEl = document.getElementById('modoDados');
    if (modoEl) {
      modoEl.textContent = Banco.modo === 'firebase' ? 'Firebase (nuvem)' : 'localStorage (demonstração)';
    }

    pacientes = await Banco.listar('pacientes');
    evolucoes = await Banco.listar('evolucoes');
    agendamentos = await Banco.listar('agendamentos');

    renderizarConsultasFinalizadas();
    renderizarPacientes();
  }

  /* ------------------------------- Eventos ------------------------------- */
  if (buscaInput) buscaInput.addEventListener('input', renderizarPacientes);
  const formFicha = document.getElementById('formFichaEvolucao');
  if (formFicha) formFicha.addEventListener('submit', salvarFicha);

  document.addEventListener('click', function (evento) {
    const botao = evento.target.closest('[data-acao]');
    if (!botao) return;
    const acao = botao.dataset.acao;

    if (acao === 'abrir-ficha') abrirFicha(botao.dataset.id);
    if (acao === 'relatorio-consulta') abrirRelatorioPorConsulta(botao.dataset.id);
    if (acao === 'ver-grafico') renderizarGraficoPaciente(botao.dataset.id);
    if (acao === 'fechar-ficha') Global.fecharModal('modalFichaEvolucao');
    if (acao === 'fechar-grafico') Global.fecharModal('modalGraficoEvolucao');
  });

  carregar();
})();
