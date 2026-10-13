/* ==========================================================================
   js/coordenacao.js — Painel da coordenadoria
   • Calendário mensal gerado a partir dos agendamentos reais
   • Cadastro de pacientes que realmente fica salvo (Banco)
   • Atendimento das solicitações de "próxima consulta" feitas pelos profissionais
   ========================================================================== */
'use strict';

(function () {
  const sessao = window.TP_SESSAO;
  if (!sessao) return;

  Auth.montarCabecalho(sessao);

  let agendamentos = [];
  let pacientes = [];
  let solicitacoes = [];
  let profissionais = [];
  let mesAtual = new Date();
  let solicitacaoSelecionada = null;

  const calendario = document.getElementById('calendario');
  const tituloMes = document.getElementById('tituloMes');
  const listaPacientes = document.getElementById('listaPacientes');
  const listaDia = document.getElementById('listaDia');
  const avisoSolicitacoes = document.getElementById('avisoSolicitacoes');
  const statusPaciente = document.getElementById('statusPaciente');
  const statusRemarcacao = document.getElementById('statusRemarcacao');

  const NOMES_DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function classeDoStatus(status) {
    if (status === 'Concluído') return 'status-concluido';
    if (status === 'Cancelado') return 'status-cancelado';
    if (status === 'Aguardando') return 'status-aguardando';
    if (status === 'Falta Justificada') return 'status-falta-justificada';
    if (status === 'Falta Não Justificada') return 'status-falta';
    return 'status-confirmado';
  }

  function classeCategoria(cat) {
    const mapa = {
      reposicao: 'tag-reposicao',
      particular: 'tag-particular',
      triagem: 'tag-triagem',
      nutricionista: 'tag-nutricionista',
      pis: 'tag-pis',
      adiado: 'tag-adiado',
      feriado: 'tag-feriado'
    };
    return mapa[cat] || 'tag-particular';
  }

  function rotuloCategoria(cat) {
    const mapa = {
      reposicao: '🟣 Reposição',
      particular: '🟢 Particular',
      triagem: '🟡 Triagem',
      nutricionista: '🥗 Nutricionista',
      pis: '🔵 Sessão PIS',
      adiado: '🟠 Adiado',
      feriado: '🔴 Feriado'
    };
    return mapa[cat] || '🟢 Atendimento';
  }

  function rotuloFrequencia(freq) {
    if (freq === 'unico') return '<span class="badge-freq freq-unico">📌 Único</span>';
    if (freq === 'quinzenal') return '<span class="badge-freq freq-quinzenal">🔄 Quinzenal</span>';
    return '<span class="badge-freq freq-semanal">🔁 Semanal</span>';
  }

  function agendamentosDoDia(iso) {
    return Banco.ordenar(agendamentos.filter(function (a) {
      return Global.apenasData(a.dataHora) === iso && a.status !== 'Cancelado';
    }), 'dataHora');
  }

  /* ------------------------------ Abas ------------------------------ */
  function abrirAba(nome) {
    document.querySelectorAll('.btn-aba').forEach(function (b) {
      b.classList.toggle('active', b.dataset.aba === nome);
    });
    document.querySelectorAll('.secao-aba').forEach(function (s) { s.classList.remove('active'); });
    const secao = document.getElementById('aba-' + nome);
    if (secao) secao.classList.add('active');
  }

  /* --------------------------- Calendário --------------------------- */
  function renderizarCalendario() {
    const ano = mesAtual.getFullYear();
    const mes = mesAtual.getMonth();
    tituloMes.textContent = 'Calendário de ' + NOMES_MESES[mes] + ' de ' + ano;

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const diasMesAnterior = new Date(ano, mes, 0).getDate();
    const hoje = new Date();
    const isoHoje = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
      String(hoje.getDate()).padStart(2, '0');

    let html = NOMES_DIAS.map(function (d) { return '<div class="cal-head">' + d + '</div>'; }).join('');

    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      html += '<div class="cal-cel fora-do-mes"><div class="cal-dia">' + (diasMesAnterior - i) + '</div></div>';
    }

    for (let dia = 1; dia <= diasNoMes; dia++) {
      const iso = ano + '-' + String(mes + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
      const eventos = agendamentosDoDia(iso);
      const classes = 'cal-cel' + (iso === isoHoje ? ' hoje' : '');

      const blocos = eventos.slice(0, 3).map(function (e) {
        const cat = e.categoriaTipo || 'particular';
        const catClass = 'evento-' + cat;
        return '<div class="evento ' + catClass + '">' +
          '<strong>' + Global.escaparHTML(e.pacienteNome) + '</strong><br>' +
          Global.hora(e.dataHora) + ' · ' + rotuloCategoria(cat) +
        '</div>';
      }).join('');

      const extra = eventos.length > 3
        ? '<div class="evento">+ ' + (eventos.length - 3) + ' atendimento(s)</div>' : '';

      html += '<div class="' + classes + '" data-dia="' + iso + '" role="button" tabindex="0">' +
        '<div class="cal-dia">' + dia + '</div>' + blocos + extra + '</div>';
    }

    const celulasUsadas = primeiroDiaSemana + diasNoMes;
    const restantes = (7 - (celulasUsadas % 7)) % 7;
    for (let i = 1; i <= restantes; i++) {
      html += '<div class="cal-cel fora-do-mes"><div class="cal-dia">' + i + '</div></div>';
    }

    calendario.innerHTML = html;
  }

  function abrirModalDia(iso) {
    const eventos = agendamentosDoDia(iso);
    document.getElementById('tituloModalDia').textContent =
      'Atendimentos de ' + Global.data(iso + 'T12:00');

    listaDia.innerHTML = eventos.length ? eventos.map(function (e) {
      const cat = e.categoriaTipo || 'particular';
      const tagCat = '<span class="tag-categoria ' + classeCategoria(cat) + '">' + rotuloCategoria(cat) + '</span>';
      const tagFreq = rotuloFrequencia(e.frequencia || 'semanal');
      const botaoComprovante = e.faltaComprovante
        ? '<button type="button" class="btn-outline btn-pequeno" data-acao="ver-atestado" data-id="' + e.id + '">📄 Ver Atestado</button>'
        : '';
      const justificativaTexto = e.faltaMotivo
        ? '<div style="background:#f3e8ff; padding:.4rem .7rem; border-radius:6px; margin-top:.4rem; font-size:.82rem; color:#5b21b6;">' +
            '<strong>Justificativa:</strong> "' + Global.escaparHTML(e.faltaMotivo) + '"' +
          '</div>'
        : '';

      return '' +
        '<div class="card-consulta mb-1">' +
          '<div>' +
            '<div style="display:flex; gap:.4rem; align-items:center; flex-wrap:wrap; margin-bottom:.4rem;">' +
              tagCat +
              tagFreq +
            '</div>' +
            '<div class="info-data">' + Global.hora(e.dataHora) + ' · ' + Global.escaparHTML(e.pacienteNome) + '</div>' +
            '<div class="linha-suave">' + Global.escaparHTML(e.especialidade) + ' — ' + Global.escaparHTML(e.profissionalNome) + '</div>' +
            '<div class="linha-suave">Valor: ' + Global.moeda(e.valor) + '</div>' +
            justificativaTexto +
          '</div>' +
          '<div class="acoes">' +
            '<span class="badge-status ' + classeDoStatus(e.status) + '">' + Global.escaparHTML(e.status) + '</span>' +
            botaoComprovante +
            (e.status === 'Aguardando'
              ? '<button type="button" class="btn-primary btn-pequeno" data-acao="confirmar" data-id="' + e.id + '">Confirmar</button>'
              : '') +
            '<button type="button" class="btn-perigo" data-acao="cancelar" data-id="' + e.id + '">Cancelar</button>' +
          '</div>' +
        '</div>';
    }).join('') : '<p class="estado-vazio">Nenhum atendimento neste dia.</p>';

    Global.abrirModal('modalDia');
  }

  /* ------------------ Solicitações do profissional ------------------ */
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
            '<h4>📩 Solicitação de próxima consulta enviada pelo profissional</h4>' +
            '<p>Paciente <strong>' + Global.escaparHTML(s.pacienteNome) + '</strong> — pedido por ' +
              Global.escaparHTML(s.profissionalNome) + ' em ' + Global.data(s.criadoEm) + '.</p>' +
          '</div>' +
          '<button type="button" class="btn-primary btn-pequeno" data-acao="remarcar" data-id="' + s.id + '">' +
            'Escolher dia e horário</button>' +
        '</div>';
    }).join('');
  }

  function preencherTerapias() {
    const terapias = [];
    profissionais.forEach(function (p) {
      if (p.ocupacao && terapias.indexOf(p.ocupacao) === -1) terapias.push(p.ocupacao);
    });

    const selectTerapia = document.getElementById('remarcarTerapia');
    const desejada = solicitacaoSelecionada && solicitacaoSelecionada.terapia;

    selectTerapia.innerHTML = terapias.map(function (t) {
      const marcado = t === desejada ? ' selected' : '';
      return '<option value="' + Global.escaparHTML(t) + '"' + marcado + '>' + Global.escaparHTML(t) + '</option>';
    }).join('');

    preencherProfissionaisDaTerapia();
  }

  function preencherProfissionaisDaTerapia() {
    const terapia = document.getElementById('remarcarTerapia').value;
    const selectProfissional = document.getElementById('remarcarProfissional');
    const disponiveis = profissionais.filter(function (p) { return p.ocupacao === terapia && p.ativo !== false; });

    selectProfissional.innerHTML = disponiveis.length
      ? disponiveis.map(function (p) {
          const marcado = solicitacaoSelecionada && p.nome === solicitacaoSelecionada.profissionalNome ? ' selected' : '';
          return '<option value="' + p.id + '"' + marcado + '>' + Global.escaparHTML(p.nome) + '</option>';
        }).join('')
      : '<option value="">Nenhum profissional cadastrado para esta terapia</option>';
  }

  function abrirRemarcacao(id) {
    const solicitacao = solicitacoes.find(function (s) { return String(s.id) === String(id); });
    if (!solicitacao) return;

    solicitacaoSelecionada = solicitacao;
    document.getElementById('nomePacienteRemarcar').textContent = solicitacao.pacienteNome;
    statusRemarcacao.textContent = '';

    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    document.getElementById('remarcarData').value = amanha.toISOString().slice(0, 10);

    preencherTerapias();
    Global.abrirModal('modalRemarcacao');
  }

  async function confirmarRemarcacao(evento) {
    evento.preventDefault();

    if (!solicitacaoSelecionada) return;

    const dia = document.getElementById('remarcarData').value;
    const horario = document.getElementById('remarcarHorario').value;
    const terapia = document.getElementById('remarcarTerapia').value;
    const profissionalId = document.getElementById('remarcarProfissional').value;
    const profissional = profissionais.find(function (p) { return String(p.id) === String(profissionalId); });

    if (!dia || !horario || !profissional) {
      statusRemarcacao.className = 'form-status erro';
      statusRemarcacao.textContent = '⚠️ Preencha dia, horário e profissional.';
      return;
    }

    const paciente = pacientes.find(function (p) { return String(p.id) === String(solicitacaoSelecionada.pacienteId); });
    const categoriaTipo = document.getElementById('remarcarCategoria') ? document.getElementById('remarcarCategoria').value : 'particular';
    const frequencia = document.getElementById('remarcarFrequencia') ? document.getElementById('remarcarFrequencia').value : 'semanal';

    await Banco.salvar('agendamentos', {
      pacienteId: solicitacaoSelecionada.pacienteId,
      pacienteNome: solicitacaoSelecionada.pacienteNome,
      profissionalId: profissional.id,
      profissionalNome: profissional.nome,
      especialidade: terapia,
      categoriaTipo: categoriaTipo,
      frequencia: frequencia,
      dataHora: dia + 'T' + horario,
      status: 'Confirmado',
      valor: Number(profissional.valorSessao) || (paciente ? 0 : 0),
      entradaEm: null,
      criadoEm: new Date().toISOString().slice(0, 10)
    });

    solicitacaoSelecionada.status = 'Atendida';
    await Banco.salvar('solicitacoes', solicitacaoSelecionada);

    Global.fecharModal('modalRemarcacao');
    Global.avisar('Consulta (' + frequencia + ') agendada para ' + Global.data(dia + 'T12:00') + ' às ' + horario + '.', 'sucesso');

    mesAtual = new Date(dia + 'T12:00');
    await carregar();
  }

  /* ------------------- Novo Agendamento Direto (Coordenação) ------------------- */
  function abrirNovoAgendamento() {
    const selectPac = document.getElementById('novoAgPaciente');
    const selectProf = document.getElementById('novoAgProfissional');
    const statusNovo = document.getElementById('statusNovoAgendamento');
    if (statusNovo) statusNovo.textContent = '';

    if (selectPac) {
      selectPac.innerHTML = '<option value="">Selecione o paciente...</option>' +
        pacientes.map(function (p) {
          return '<option value="' + p.id + '">' + Global.escaparHTML(p.nome) + ' (' + Global.escaparHTML(p.terapia) + ')</option>';
        }).join('');
    }

    if (selectProf) {
      selectProf.innerHTML = '<option value="">Selecione o profissional...</option>' +
        profissionais.filter(function (p) { return p.ativo !== false; }).map(function (p) {
          return '<option value="' + p.id + '">' + Global.escaparHTML(p.nome) + ' — ' + Global.escaparHTML(p.ocupacao) + '</option>';
        }).join('');
    }

    Global.abrirModal('modalNovoAgendamento');
  }

  async function salvarNovoAgendamento(evento) {
    evento.preventDefault();

    const pacienteId = document.getElementById('novoAgPaciente').value;
    const profissionalId = document.getElementById('novoAgProfissional').value;
    const dataHora = document.getElementById('novoAgDataHora').value;
    const categoriaTipo = document.getElementById('novoAgCategoria').value;
    const frequencia = document.getElementById('novoAgFrequencia').value;
    const statusNovo = document.getElementById('statusNovoAgendamento');

    const paciente = pacientes.find(function (p) { return String(p.id) === String(pacienteId); });
    const profissional = profissionais.find(function (p) { return String(p.id) === String(profissionalId); });

    if (!paciente || !profissional || !dataHora) {
      statusNovo.className = 'form-status erro';
      statusNovo.textContent = '⚠️ Preencha todos os campos obrigatórios.';
      return;
    }

    await Banco.salvar('agendamentos', {
      pacienteId: paciente.id,
      pacienteNome: paciente.nome,
      profissionalId: profissional.id,
      profissionalNome: profissional.nome,
      especialidade: profissional.ocupacao,
      categoriaTipo: categoriaTipo,
      frequencia: frequencia,
      dataHora: dataHora,
      status: 'Confirmado',
      valor: Number(profissional.valorSessao) || 0,
      entradaEm: null,
      criadoEm: new Date().toISOString().slice(0, 10)
    });

    Global.fecharModal('modalNovoAgendamento');
    Global.avisar('Novo agendamento registrado com sucesso!', 'sucesso');
    mesAtual = new Date(dataHora);
    await carregar();
  }

  /* ------------------- Visualizar Atestado de Falta ------------------- */
  function abrirVerAtestadoCoord(id) {
    const item = agendamentos.find(function (a) { return String(a.id) === String(id); });
    if (!item || !item.faltaComprovante) return;

    document.getElementById('coordComprovantePaciente').textContent =
      item.pacienteNome + ' — Consulta de ' + Global.dataLonga(item.dataHora);
    document.getElementById('coordComprovanteMotivo').textContent = item.faltaMotivo || 'Não informado';
    document.getElementById('coordComprovanteData').textContent =
      'Enviado pela família em: ' + (item.faltaDataRegistro ? new Date(item.faltaDataRegistro).toLocaleString('pt-BR') : 'Data não registrada');
    document.getElementById('coordComprovanteImagem').src = item.faltaComprovante;

    Global.abrirModal('modalVerComprovanteCoordenacao');
  }

  /* --------------------------- Pacientes --------------------------- */
  function renderizarPacientes() {
    const criterio = document.getElementById('selectOrdenacao').value;
    let lista = pacientes.slice();

    if (criterio === 'nome') lista = Banco.ordenar(lista, 'nome');
    else if (criterio === 'criadoEm') lista = Banco.ordenar(lista, 'criadoEm', false);
    else lista = Banco.ordenar(lista, 'status');

    if (!lista.length) {
      listaPacientes.innerHTML = '<p class="estado-vazio">Nenhum paciente cadastrado ainda. Use a aba ' +
        '"Cadastro de novo paciente".</p>';
      return;
    }

    listaPacientes.innerHTML = lista.map(function (p) {
      const foto = p.foto
        ? '<img class="foto-paciente" src="' + p.foto + '" alt="Foto de ' + Global.escaparHTML(p.nome) + '">'
        : '<span class="foto-paciente" style="display:flex; align-items:center; justify-content:center; ' +
          'background:var(--azul-claro); color:var(--azul-escuro); font-weight:800">' +
          Global.escaparHTML(String(p.nome).charAt(0).toUpperCase()) + '</span>';

      const seus = agendamentos.filter(function (a) { return String(a.pacienteId) === String(p.id); });
      const proximo = Banco.ordenar(seus.filter(function (a) {
        return new Date(a.dataHora) >= new Date() && a.status !== 'Cancelado';
      }), 'dataHora')[0];

      return '' +
        '<article class="card-paciente">' +
          '<div style="display:flex; gap:1rem; align-items:center; margin-bottom:.8rem">' +
            foto +
            '<div>' +
              '<h3 style="color:var(--azul-escuro); font-size:1.1rem">' + Global.escaparHTML(p.nome) + '</h3>' +
              '<p class="linha-suave">' + Global.idade(p.nascimento) + ' · ' + Global.escaparHTML(p.terapia) + '</p>' +
            '</div>' +
          '</div>' +
          '<p class="linha-suave"><strong>Responsável:</strong> ' + Global.escaparHTML(p.responsavel) + '</p>' +
          '<p class="linha-suave"><strong>Telefone:</strong> ' + Global.escaparHTML(p.telefone) + '</p>' +
          '<p class="linha-suave"><strong>CPF do responsável:</strong> ' + Auth.formatarCPF(p.cpfResponsavel) + '</p>' +
          '<p class="linha-suave"><strong>Pagamento:</strong> dia ' + Global.escaparHTML(p.diaPagamento) + '</p>' +
          '<p class="linha-suave"><strong>Próxima sessão:</strong> ' +
            (proximo ? Global.dataLonga(proximo.dataHora) : 'sem agendamento futuro') + '</p>' +
          '<div class="acoes">' +
            '<span class="badge-status ' + (p.status === 'Aguardando' ? 'status-aguardando' : 'status-confirmado') + '">' +
              Global.escaparHTML(p.status) + '</span>' +
            '<span class="linha-suave">' + seus.length + ' atendimento(s)</span>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  /* ------------------------- Cadastro de paciente ------------------------- */
  function lerFoto() {
    return new Promise(function (resolver) {
      const arquivo = document.getElementById('pacienteFoto').files[0];
      if (!arquivo) return resolver(null);
      if (arquivo.size > 200 * 1024) {
        Global.avisar('A foto é maior que 200 KB e não será salva. Reduza a imagem e tente novamente.', 'erro');
        return resolver(null);
      }
      const leitor = new FileReader();
      leitor.onload = function () { resolver(leitor.result); };
      leitor.onerror = function () { resolver(null); };
      leitor.readAsDataURL(arquivo);
    });
  }

  async function cadastrarPaciente(evento) {
    evento.preventDefault();

    const cpfLimpo = Auth.limparCPF(document.getElementById('pacienteCpf').value);
    if (cpfLimpo.length !== 11) {
      statusPaciente.className = 'form-status erro';
      statusPaciente.textContent = '⚠️ Informe o CPF do responsável com 11 dígitos.';
      return;
    }

    const repetido = pacientes.find(function (p) { return Auth.limparCPF(p.cpfResponsavel) === cpfLimpo; });
    if (repetido) {
      statusPaciente.className = 'form-status erro';
      statusPaciente.textContent = '⚠️ Já existe paciente cadastrado para este CPF (' + repetido.nome + ').';
      return;
    }

    statusPaciente.className = 'form-status';
    statusPaciente.textContent = 'Salvando...';
    const foto = await lerFoto();

    const paciente = {
      nome: document.getElementById('pacienteNome').value.trim(),
      nascimento: document.getElementById('pacienteNascimento').value,
      responsavel: document.getElementById('pacienteResponsavel').value.trim(),
      telefone: document.getElementById('pacienteTelefone').value.trim(),
      cpfResponsavel: cpfLimpo,
      terapia: document.getElementById('pacienteTerapia').value,
      diaPagamento: document.getElementById('pacientePagamento').value.trim(),
      status: document.getElementById('pacienteStatus').value,
      foto: foto,
      criadoEm: new Date().toISOString().slice(0, 10)
    };

    await Banco.salvar('pacientes', paciente);

    // Garante que a família consiga entrar na Área Restrita com o CPF do responsável
    const usuarios = await Banco.listar('usuarios');
    const jaTemUsuario = usuarios.some(function (u) { return Auth.limparCPF(u.cpf) === cpfLimpo; });

    if (!jaTemUsuario) {
      await Banco.salvar('usuarios', {
        cpf: cpfLimpo,
        nome: paciente.responsavel,
        email: '',
        senha: '123',
        perfil: 'cliente',
        cargo: 'Responsável legal',
        ativo: true
      });
    }

    statusPaciente.className = 'form-status ok';
    statusPaciente.textContent = '✅ Paciente ' + paciente.nome + ' cadastrado! Acesso do responsável liberado ' +
      'com o CPF informado e senha inicial 123.';

    document.getElementById('formPaciente').reset();
    Global.avisar('Paciente cadastrado com sucesso.', 'sucesso');

    await carregar();
    abrirAba('pacientes');
  }

  /* ------------------------------ Carregar ------------------------------ */
  async function carregar() {
    await Banco.iniciar();
    document.getElementById('modoDados').textContent =
      Banco.modo === 'firebase' ? 'Firebase (nuvem)' : 'localStorage (demonstração)';

    agendamentos = await Banco.listar('agendamentos');
    pacientes = await Banco.listar('pacientes');
    solicitacoes = await Banco.listar('solicitacoes');
    profissionais = await Banco.listar('profissionais');

    renderizarCalendario();
    renderizarPacientes();
    renderizarSolicitacoes();
  }

  /* ------------------------------- Eventos ------------------------------- */
  document.querySelectorAll('.btn-aba').forEach(function (botao) {
    botao.addEventListener('click', function () { abrirAba(botao.dataset.aba); });
  });

  calendario.addEventListener('click', function (evento) {
    const celula = evento.target.closest('.cal-cel[data-dia]');
    if (celula) abrirModalDia(celula.dataset.dia);
  });
  calendario.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    const celula = evento.target.closest('.cal-cel[data-dia]');
    if (celula) {
      evento.preventDefault();
      abrirModalDia(celula.dataset.dia);
    }
  });

  document.addEventListener('click', async function (evento) {
    const botao = evento.target.closest('[data-acao]');
    if (!botao) return;
    const acao = botao.dataset.acao;

    if (acao === 'mes-anterior') {
      mesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1);
      renderizarCalendario();
      return;
    }
    if (acao === 'mes-proximo') {
      mesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1);
      renderizarCalendario();
      return;
    }
    if (acao === 'mes-atual') {
      mesAtual = new Date();
      renderizarCalendario();
      return;
    }
    if (acao === 'abrir-novo-agendamento') { abrirNovoAgendamento(); return; }
    if (acao === 'fechar-novo-agendamento') { Global.fecharModal('modalNovoAgendamento'); return; }
    if (acao === 'ver-atestado') { abrirVerAtestadoCoord(botao.dataset.id); return; }
    if (acao === 'fechar-ver-comprovante-coord') { Global.fecharModal('modalVerComprovanteCoordenacao'); return; }
    if (acao === 'fechar-dia') { Global.fecharModal('modalDia'); return; }
    if (acao === 'fechar-remarcacao') { Global.fecharModal('modalRemarcacao'); return; }
    if (acao === 'remarcar') { abrirRemarcacao(botao.dataset.id); return; }

    if (acao === 'confirmar') {
      const item = agendamentos.find(function (a) { return String(a.id) === String(botao.dataset.id); });
      if (!item) return;
      item.status = 'Confirmado';
      await Banco.salvar('agendamentos', item);
      Global.avisar('Consulta confirmada.', 'sucesso');
      await carregar();
      abrirModalDia(Global.apenasData(item.dataHora));
      return;
    }

    if (acao === 'cancelar') {
      const item = agendamentos.find(function (a) { return String(a.id) === String(botao.dataset.id); });
      if (!item) return;
      if (!Global.confirmar('Cancelar o atendimento de ' + item.pacienteNome + '?')) return;
      item.status = 'Cancelado';
      await Banco.salvar('agendamentos', item);
      Global.avisar('Atendimento cancelado.', 'sucesso');
      await carregar();
      abrirModalDia(Global.apenasData(item.dataHora));
    }
  });

  const formNovoAg = document.getElementById('formNovoAgendamento');
  if (formNovoAg) formNovoAg.addEventListener('submit', salvarNovoAgendamento);

  document.getElementById('remarcarTerapia').addEventListener('change', preencherProfissionaisDaTerapia);
  document.getElementById('formRemarcacao').addEventListener('submit', confirmarRemarcacao);
  document.getElementById('formPaciente').addEventListener('submit', cadastrarPaciente);
  document.getElementById('selectOrdenacao').addEventListener('change', renderizarPacientes);

  carregar();
})();
