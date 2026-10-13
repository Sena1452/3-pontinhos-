/* ==========================================================================
   js/cliente.js — Painel do cliente (responsável legal)
   Instituto Três Pontinhos
   --------------------------------------------------------------------------
   • Pagamento via PIX e solicitação de Boleto Bancário via WhatsApp
   • Justificativa de falta com envio de foto de documento / atestado
   • Agendamento com seleção de frequência (Único, Semanal ou Quinzenal)
   ========================================================================== */
'use strict';

/* ==========================================================================
   👉 ESPAÇO NO CÓDIGO PARA O ADMINISTRADOR CONFIGURAR O PAGAMENTO (PIX & BOLETO)
   Você pode alterar os dados abaixo para integrar com seu gateway bancário,
   chave PIX da instituição ou URL do seu gerador de boletos.
   ========================================================================== */
const CONFIG_PAGAMENTO = {
  // 1. Chave PIX oficial do Instituto (CNPJ, Telefone, E-mail ou Aleatória)
  chavePix: '59.795.570/0001-68',
  tipoChavePix: 'CNPJ',
  titularPix: 'Instituto Três Pontinhos',
  bancoPix: 'Banco Cora SCD / Caixa',

  // 2. Imagem personalizada do QR Code (deixe null para usar o gerador padrão ou insira a URL/caminho, ex: 'img/qrcode-pix.png')
  qrCodeImagemUrl: null,

  // 3. Código PIX "Copia e Cola" padrão (Payload EMV do Banco Central do Brasil)
  pixCopiaECola: '00020126580014BR.GOV.BCB.PIX0136597955700001685204000053039865802BR5924INSTITUTO TRES PONTINHOS6009FORTALEZA62070503***6304E2D1',

  // 4. WhatsApp oficial do Instituto para emissão de boleto (formato internacional sem +)
  whatsappNumero: '5585992005743',

  // 5. [ESPAÇO PARA LINK DIRETO DE BOLETO] Caso possua API (ex: Asaas, Mercado Pago, Banco Inter, Cora):
  urlEmissaoBoletoExterno: '' // Preencha aqui caso deseje redirecionar para emissor de boleto próprio
};

(function () {
  const sessao = window.TP_SESSAO;
  if (!sessao) return; // o guard já redirecionou para o login

  Auth.montarCabecalho(sessao);
  Global.ligarPiscadaDaLogo();
  Global.ligarFechamentoDeModais();

  let pacientesDoCliente = [];
  let agendamentos = [];
  let profissionais = [];

  const listaProximos = document.getElementById('listaProximos');
  const listaHistorico = document.getElementById('listaHistorico');
  const selectEspecialidade = document.getElementById('selectEspecialidade');
  const selectProfissional = document.getElementById('selectProfissional');
  const selectCategoriaTipo = document.getElementById('selectCategoriaTipo');
  const selectFrequencia = document.getElementById('selectFrequencia');
  const statusAgendamento = document.getElementById('statusAgendamento');

  const STATUS_PASSADOS = ['Concluído', 'Cancelado', 'Falta Justificada', 'Falta Não Justificada'];

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

  /* ----------------------------- Configurar PIX e Boleto ----------------------------- */
  function configurarAreaPagamento() {
    const displayChavePix = document.getElementById('displayChavePix');
    if (displayChavePix) displayChavePix.textContent = CONFIG_PAGAMENTO.chavePix;

    const displayCopiaECola = document.getElementById('displayCopiaECola');
    if (displayCopiaECola) displayCopiaECola.textContent = CONFIG_PAGAMENTO.pixCopiaECola;

    // Se houver imagem customizada de QR Code, substitui o SVG
    const pixQrContainer = document.getElementById('pixQrContainer');
    if (pixQrContainer && CONFIG_PAGAMENTO.qrCodeImagemUrl) {
      pixQrContainer.innerHTML = '<img src="' + CONFIG_PAGAMENTO.qrCodeImagemUrl + '" alt="QR Code PIX" style="max-width:160px; height:auto; border-radius:8px;">';
    }

    // Botão de solicitar boleto via WhatsApp
    const btnSolicitarBoletoWhatsApp = document.getElementById('btnSolicitarBoletoWhatsApp');
    if (btnSolicitarBoletoWhatsApp) {
      const nomePaciente = pacientesDoCliente.length ? pacientesDoCliente[0].nome : 'aluno(a)';
      const mensagem = encodeURIComponent(
        'Olá! Sou responsável pelo(a) aluno(a) ' + nomePaciente +
        ' no Instituto Três Pontinhos e gostaria de solicitar a emissão do boleto bancário para pagamento da mensalidade/consultas.'
      );
      btnSolicitarBoletoWhatsApp.href = 'https://wa.me/' + CONFIG_PAGAMENTO.whatsappNumero + '?text=' + mensagem;
    }

    // Copiar Chave PIX
    const btnCopiarPix = document.getElementById('btnCopiarPix');
    if (btnCopiarPix) {
      btnCopiarPix.onclick = function () {
        copiarParaAreaTransferencia(CONFIG_PAGAMENTO.chavePix, 'Chave PIX (' + CONFIG_PAGAMENTO.tipoChavePix + ') copiada com sucesso!');
      };
    }

    // Copiar Copia e Cola
    const btnCopiarCopiaECola = document.getElementById('btnCopiarCopiaECola');
    if (btnCopiarCopiaECola) {
      btnCopiarCopiaECola.onclick = function () {
        copiarParaAreaTransferencia(CONFIG_PAGAMENTO.pixCopiaECola, 'Código PIX Copia e Cola copiado com sucesso!');
      };
    }
  }

  function copiarParaAreaTransferencia(texto, mensagemSucesso) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () {
        Global.avisar(mensagemSucesso, 'sucesso');
      }).catch(function () {
        fallbackCopiar(texto, mensagemSucesso);
      });
    } else {
      fallbackCopiar(texto, mensagemSucesso);
    }
  }

  function fallbackCopiar(texto, mensagemSucesso) {
    const input = document.createElement('textarea');
    input.value = texto;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      Global.avisar(mensagemSucesso, 'sucesso');
    } catch (e) {
      Global.avisar('Não foi possível copiar automaticamente. Selecione e copie o texto.', 'erro');
    }
    document.body.removeChild(input);
  }

  /* ----------------------------- Renderização ----------------------------- */
  function montarCartao(item, ehProximo) {
    const cat = item.categoriaTipo || 'particular';
    const tagCat = '<span class="tag-categoria ' + classeCategoria(cat) + '">' + rotuloCategoria(cat) + '</span>';
    const tagFreq = rotuloFrequencia(item.frequencia || 'semanal');

    // Ações disponíveis
    let botoesAcao = '';

    if (item.status === 'Falta Justificada' && item.faltaComprovante) {
      botoesAcao += '<button type="button" class="btn-outline btn-pequeno" data-acao="ver-comprovante" data-id="' + item.id + '">📄 Ver Atestado</button>';
    } else if (item.status !== 'Cancelado' && item.status !== 'Falta Justificada') {
      botoesAcao += '<button type="button" class="btn-outline btn-pequeno" style="border-color:#8b5cf6; color:#6b21a8;" data-acao="justificar-falta" data-id="' + item.id + '">⚠️ Justificar Falta</button>';
    }

    if (ehProximo && item.status !== 'Cancelado' && item.status !== 'Falta Justificada') {
      botoesAcao += '<button type="button" class="btn-perigo" data-acao="cancelar" data-id="' + item.id + '">Cancelar</button>';
    } else if (item.status === 'Concluído') {
      botoesAcao += '<button type="button" class="btn-primary btn-pequeno" data-acao="ficha" data-id="' + item.id + '">Baixar comprovante</button>';
    }

    const justificativaAviso = item.faltaMotivo
      ? '<div style="background:#f3e8ff; padding:.5rem .8rem; border-radius:6px; margin-top:.6rem; font-size:.82rem; color:#5b21b6;">' +
          '<strong>Justificativa de falta enviada:</strong> "' + Global.escaparHTML(item.faltaMotivo) + '"' +
        '</div>'
      : '';

    return '' +
      '<article class="card-consulta">' +
        '<div>' +
          '<div style="display:flex; gap:.4rem; align-items:center; flex-wrap:wrap; margin-bottom:.5rem;">' +
            tagCat +
            tagFreq +
          '</div>' +
          '<div class="info-data">🗓️ ' + Global.dataLonga(item.dataHora) + '</div>' +
          '<div style="font-weight:700; color:var(--azul-escuro); font-size:1.05rem;">' + Global.escaparHTML(item.profissionalNome) + '</div>' +
          '<div class="linha-suave">' + Global.escaparHTML(item.especialidade) + '</div>' +
          '<div class="linha-suave">' + Global.escaparHTML(item.pacienteNome) + ' · ' + Global.moeda(item.valor) + '</div>' +
          justificativaAviso +
        '</div>' +
        '<div class="acoes">' +
          '<span class="badge-status ' + classeDoStatus(item.status) + '">' + Global.escaparHTML(item.status) + '</span>' +
          '<div style="display:flex; gap:.4rem; align-items:center; flex-wrap:wrap;">' + botoesAcao + '</div>' +
        '</div>' +
      '</article>';
  }

  function renderizar() {
    const agora = new Date();
    const proximos = agendamentos
      .filter(function (a) { return STATUS_PASSADOS.indexOf(a.status) === -1 && new Date(a.dataHora) >= agora; })
      .sort(function (a, b) { return a.dataHora > b.dataHora ? 1 : -1; });

    const historico = agendamentos
      .filter(function (a) { return STATUS_PASSADOS.indexOf(a.status) !== -1 || new Date(a.dataHora) < agora; })
      .sort(function (a, b) { return a.dataHora < b.dataHora ? 1 : -1; });

    listaProximos.innerHTML = proximos.length
      ? proximos.map(function (a) { return montarCartao(a, true); }).join('')
      : '<p class="estado-vazio">Você não tem consultas agendadas no momento. Use o botão "Agendar Nova Consulta" acima.</p>';

    listaHistorico.innerHTML = historico.length
      ? historico.map(function (a) { return montarCartao(a, false); }).join('')
      : '<p class="estado-vazio">Nenhum atendimento anterior registrado.</p>';
  }

  /* ------------------------- Ficha de atendimento ------------------------- */
  function baixarFicha(item) {
    const conteudo =
      'INSTITUTO TRÊS PONTINHOS - DECLARAÇÃO DE ATENDIMENTO\n' +
      '====================================================\n' +
      'Paciente: ' + item.pacienteNome + '\n' +
      'Profissional: ' + item.profissionalNome + '\n' +
      'Terapia: ' + item.especialidade + '\n' +
      'Data e hora: ' + Global.dataLonga(item.dataHora) + '\n' +
      'Status: ' + item.status + '\n' +
      'Frequência: ' + (item.frequencia || 'Semanal') + '\n' +
      'Valor: ' + Global.moeda(item.valor) + '\n' +
      '====================================================\n' +
      'Instituto Três Pontinhos | CNPJ: 59.795.570/0001-68\n' +
      'Rua Padre Valdevino, 294 - Joaquim Távora, Fortaleza-CE\n' +
      'Emitido em: ' + new Date().toLocaleString('pt-BR') + '.\n';

    const arquivo = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(arquivo);
    link.download = 'declaracao-' + String(item.pacienteNome).toLowerCase().replace(/\s+/g, '-') + '.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    Global.avisar('Declaração gerada no seu computador.', 'sucesso');
  }

  /* --------------------------- Justificar Falta --------------------------- */
  function abrirModalJustificativa(id) {
    const item = agendamentos.find(function (a) { return String(a.id) === String(id); });
    if (!item) return;

    document.getElementById('justificativaAgendamentoId').value = item.id;
    document.getElementById('justificativaConsultaInfo').textContent =
      'Consulta de ' + Global.dataLonga(item.dataHora) + ' — ' + item.especialidade;
    document.getElementById('campoMotivoFalta').value = '';
    document.getElementById('campoFotoDocumento').value = '';
    document.getElementById('statusJustificativa').textContent = '';
    document.getElementById('previewFotoContainer').style.display = 'none';
    document.getElementById('previewFotoComprovante').src = '';

    Global.abrirModal('modalJustificativa');
  }

  function lerFotoDocumento() {
    return new Promise(function (resolver) {
      const input = document.getElementById('campoFotoDocumento');
      const arquivo = input && input.files ? input.files[0] : null;
      if (!arquivo) return resolver(null);

      if (arquivo.size > 400 * 1024) {
        Global.avisar('A imagem do documento é muito grande (máximo 400 KB). Tire uma foto com menor resolução ou reduza a imagem.', 'erro');
        return resolver(null);
      }

      const leitor = new FileReader();
      leitor.onload = function () { resolver(leitor.result); };
      leitor.onerror = function () { resolver(null); };
      leitor.readAsDataURL(arquivo);
    });
  }

  async function salvarJustificativa(evento) {
    evento.preventDefault();

    const id = document.getElementById('justificativaAgendamentoId').value;
    const item = agendamentos.find(function (a) { return String(a.id) === String(id); });
    if (!item) return;

    const motivo = document.getElementById('campoMotivoFalta').value.trim();
    const statusEl = document.getElementById('statusJustificativa');

    if (!motivo) {
      statusEl.className = 'form-status erro';
      statusEl.textContent = '⚠️ Informe o motivo da falta.';
      return;
    }

    statusEl.className = 'form-status';
    statusEl.textContent = 'Enviando documento e justificativa...';

    const fotoBase64 = await lerFotoDocumento();
    if (!fotoBase64) {
      statusEl.className = 'form-status erro';
      statusEl.textContent = '⚠️ Selecione uma foto nítida do documento / atestado (máx 400 KB).';
      return;
    }

    item.status = 'Falta Justificada';
    item.faltaMotivo = motivo;
    item.faltaComprovante = fotoBase64;
    item.faltaDataRegistro = new Date().toISOString();

    await Banco.salvar('agendamentos', item);

    Global.fecharModal('modalJustificativa');
    Global.avisar('Falta justificada com sucesso! Documento enviado para a coordenação.', 'sucesso');
    await carregar();
  }

  function abrirVerComprovante(id) {
    const item = agendamentos.find(function (a) { return String(a.id) === String(id); });
    if (!item || !item.faltaComprovante) return;

    document.getElementById('verComprovanteTitulo').textContent =
      'Justificativa: Consulta de ' + Global.dataLonga(item.dataHora);
    document.getElementById('verComprovanteMotivo').textContent = item.faltaMotivo || 'Não informado';
    document.getElementById('verComprovanteData').textContent =
      'Registrado em: ' + (item.faltaDataRegistro ? new Date(item.faltaDataRegistro).toLocaleString('pt-BR') : 'Data não registrada');
    document.getElementById('verComprovanteImagem').src = item.faltaComprovante;

    Global.abrirModal('modalVerComprovante');
  }

  /* --------------------------- Modal de agendar --------------------------- */
  function preencherEspecialidades() {
    const especialidades = [];
    profissionais.forEach(function (p) {
      if (p.ocupacao && especialidades.indexOf(p.ocupacao) === -1) especialidades.push(p.ocupacao);
    });

    selectEspecialidade.innerHTML = '<option value="">Selecione...</option>' +
      especialidades.map(function (e) {
        return '<option value="' + Global.escaparHTML(e) + '">' + Global.escaparHTML(e) + '</option>';
      }).join('');
  }

  function preencherProfissionais() {
    const escolhida = selectEspecialidade.value;
    const disponiveis = profissionais.filter(function (p) { return p.ocupacao === escolhida && p.ativo !== false; });

    selectProfissional.innerHTML = disponiveis.length
      ? disponiveis.map(function (p) {
          return '<option value="' + p.id + '">' + Global.escaparHTML(p.nome) + '</option>';
        }).join('')
      : '<option value="">Nenhum profissional disponível</option>';
  }

  function abrirModal() {
    statusAgendamento.textContent = '';
    document.getElementById('campoDataAgendamento').value = '';
    Global.abrirModal('modalAgendamento');
  }

  async function salvarAgendamento(evento) {
    evento.preventDefault();

    const profissionalId = selectProfissional.value;
    const profissional = profissionais.find(function (p) { return String(p.id) === String(profissionalId); });
    const dataHora = document.getElementById('campoDataAgendamento').value;
    const paciente = pacientesDoCliente[0];
    const categoriaTipo = selectCategoriaTipo ? selectCategoriaTipo.value : 'particular';
    const frequencia = selectFrequencia ? selectFrequencia.value : 'semanal';

    if (!paciente) {
      statusAgendamento.className = 'form-status erro';
      statusAgendamento.textContent = '⚠️ Nenhum paciente vinculado ao seu CPF. Fale com a coordenadoria.';
      return;
    }
    if (!profissional) {
      statusAgendamento.className = 'form-status erro';
      statusAgendamento.textContent = '⚠️ Selecione o profissional desejado.';
      return;
    }
    if (!dataHora || new Date(dataHora) <= new Date()) {
      statusAgendamento.className = 'form-status erro';
      statusAgendamento.textContent = '⚠️ Escolha uma data e horário futuros.';
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
      status: 'Aguardando',
      valor: Number(profissional.valorSessao) || 0,
      entradaEm: null,
      criadoEm: new Date().toISOString().slice(0, 10)
    });

    Global.fecharModal('modalAgendamento');
    Global.avisar('Consulta (' + frequencia + ') solicitada com sucesso! A coordenadoria vai confirmar a agenda.', 'sucesso');
    await carregar();
  }

  async function cancelar(id) {
    const item = agendamentos.find(function (a) { return String(a.id) === String(id); });
    if (!item) return;
    if (!Global.confirmar('Tem certeza que deseja cancelar a consulta de ' + Global.dataLonga(item.dataHora) + '?')) return;

    item.status = 'Cancelado';
    await Banco.salvar('agendamentos', item);
    Global.avisar('Consulta cancelada.', 'sucesso');
    await carregar();
  }

  /* ------------------------------ Carregar ------------------------------- */
  async function carregar() {
    await Banco.iniciar();
    const modoEl = document.getElementById('modoDados');
    if (modoEl) {
      modoEl.textContent = Banco.modo === 'firebase' ? 'Firebase (nuvem)' : 'localStorage (demonstração)';
    }

    const pacientes = await Banco.listar('pacientes');
    pacientesDoCliente = pacientes.filter(function (p) {
      return Auth.limparCPF(p.cpfResponsavel) === Auth.limparCPF(sessao.cpf);
    });

    profissionais = await Banco.listar('profissionais');

    const ids = pacientesDoCliente.map(function (p) { return String(p.id); });
    const todos = await Banco.listar('agendamentos');
    agendamentos = todos.filter(function (a) { return ids.indexOf(String(a.pacienteId)) !== -1; });

    configurarAreaPagamento();
    preencherEspecialidades();
    renderizar();
  }

  /* ------------------------------- Eventos ------------------------------- */
  document.querySelectorAll('[data-acao="agendar"]').forEach(function (botao) {
    botao.addEventListener('click', abrirModal);
  });
  document.querySelectorAll('[data-acao="fechar-agendamento"]').forEach(function (botao) {
    botao.addEventListener('click', function () { Global.fecharModal('modalAgendamento'); });
  });
  document.querySelectorAll('[data-acao="fechar-justificativa"]').forEach(function (botao) {
    botao.addEventListener('click', function () { Global.fecharModal('modalJustificativa'); });
  });
  document.querySelectorAll('[data-acao="fechar-ver-comprovante"]').forEach(function (botao) {
    botao.addEventListener('click', function () { Global.fecharModal('modalVerComprovante'); });
  });

  if (selectEspecialidade) selectEspecialidade.addEventListener('change', preencherProfissionais);
  const formAg = document.getElementById('formAgendamento');
  if (formAg) formAg.addEventListener('submit', salvarAgendamento);

  const formJust = document.getElementById('formJustificativa');
  if (formJust) formJust.addEventListener('submit', salvarJustificativa);

  // Preview de foto de atestado
  const campoFotoDoc = document.getElementById('campoFotoDocumento');
  if (campoFotoDoc) {
    campoFotoDoc.addEventListener('change', function () {
      const arquivo = this.files ? this.files[0] : null;
      if (arquivo) {
        const url = URL.createObjectURL(arquivo);
        const img = document.getElementById('previewFotoComprovante');
        const box = document.getElementById('previewFotoContainer');
        if (img && box) {
          img.src = url;
          box.style.display = 'block';
        }
      }
    });
  }

  document.addEventListener('click', function (evento) {
    const botao = evento.target.closest('[data-acao]');
    if (!botao) return;
    const acao = botao.dataset.acao;

    if (acao === 'cancelar') cancelar(botao.dataset.id);
    if (acao === 'justificar-falta') abrirModalJustificativa(botao.dataset.id);
    if (acao === 'ver-comprovante') abrirVerComprovante(botao.dataset.id);
    if (acao === 'ficha') {
      const item = agendamentos.find(function (a) { return String(a.id) === String(botao.dataset.id); });
      if (item) baixarFicha(item);
    }
  });

  carregar();
})();
