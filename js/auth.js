/* ==========================================================================
   js/auth.js — Autenticação, sessão e proteção de rotas
   --------------------------------------------------------------------------
   • Login por CPF + senha (valida no Banco, que hoje é localStorage e amanhã
     será Firebase Authentication / Firestore).
   • Sessão guardada em `tp_sessao` (apenas o usuário logado — muito mais
     seguro que o localStorage.clear() da versão anterior).
   • Todo painel chama Auth.iniciarPagina(['perfil']) e, se o usuário não
     tiver permissão, é devolvido para o login automaticamente.
   ========================================================================== */
'use strict';

const TP_ROTAS_POR_PERFIL = {
  diretor:      'diretor.html',
  coordenacao:  'coordenacao.html',
  profissional: 'profissional.html',
  estagiario:   'estagiario.html',
  cliente:      'cliente.html'
};

const TP_NOMES_PERFIL = {
  diretor:      'Gestão Financeiro',
  coordenacao:  'Coordenadoria',
  profissional: 'Profissional',
  estagiario:   'Estagiário / AT',
  cliente:      'Cliente'
};

const Auth = {
  /* ------------------------------ CPF ------------------------------ */
  limparCPF(valor) {
    return String(valor || '').replace(/\D/g, '').slice(0, 11);
  },

  formatarCPF(valor) {
    const v = this.limparCPF(valor);
    return v
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  },

  /* Aplica a máscara enquanto o usuário digita (usar no oninput) */
  mascaraCPF(input) {
    input.value = this.formatarCPF(input.value);
  },

  /* ---------------------------- Sessão ---------------------------- */
  sessao() {
    const dados = Armazenamento.ler(TP_CHAVE_SESSAO, null);
    if (!dados || !dados.perfil) return null;
    return dados;
  },

  temSessao() { return this.sessao() !== null; },

  async login(identificador, senha) {
    await Banco.iniciar();
    const str = String(identificador || '').trim();
    const ehEmail = str.indexOf('@') !== -1;
    const cpfLimpo = this.limparCPF(str);

    const usuarios = await Banco.listar('usuarios');
    let encontrado = null;

    if (ehEmail) {
      encontrado = usuarios.find(function (u) {
        return String(u.email || '').toLowerCase() === str.toLowerCase() && String(u.senha) === String(senha);
      });
      if (!encontrado) {
        return { sucesso: false, mensagem: 'E-mail ou senha incorretos para a Gestão Financeiro.' };
      }
    } else {
      if (cpfLimpo.length !== 11) {
        return { sucesso: false, mensagem: 'Informe um CPF válido com 11 dígitos ou o e-mail da Gestão.' };
      }
      encontrado = usuarios.find(function (u) {
        return Auth.limparCPF(u.cpf) === cpfLimpo && String(u.senha) === String(senha);
      });
      if (!encontrado) {
        return { sucesso: false, mensagem: 'CPF ou senha incorretos.' };
      }
    }

    if (encontrado.ativo === false) {
      return { sucesso: false, mensagem: 'Este acesso está desativado. Fale com a coordenadoria.' };
    }

    const sessao = {
      id: encontrado.id,
      nome: encontrado.nome,
      email: encontrado.email || '',
      cpf: encontrado.cpf || '',
      perfil: encontrado.perfil,
      cargo: encontrado.cargo || TP_NOMES_PERFIL[encontrado.perfil] || '',
      loginEm: new Date().toISOString()
    };
    Armazenamento.gravar(TP_CHAVE_SESSAO, sessao);
    return { sucesso: true, sessao: sessao };
  },

  /* Sai apenas da sessão — NUNCA apaga os dados da clínica */
  sair(mensagem) {
    Armazenamento.remover(TP_CHAVE_SESSAO);
    const sufixo = mensagem ? '?aviso=' + encodeURIComponent(mensagem) : '';
    window.location.href = 'login.html' + sufixo;
  },

  rotaDoPerfil(perfil) {
    return TP_ROTAS_POR_PERFIL[perfil] || 'login.html';
  },

  nomeDoPerfil(perfil) {
    return TP_NOMES_PERFIL[perfil] || perfil;
  },

  /* ---------------------- Proteção das páginas --------------------- */
  /* Se o perfil logado não estiver na lista permitida, volta para o login. */
  exigir(perfisPermitidos) {
    const sessao = this.sessao();
    if (!sessao) {
      window.location.replace('login.html?aviso=' + encodeURIComponent('Faça login para acessar a Área Restrita.'));
      return null;
    }
    if (Array.isArray(perfisPermitidos) && perfisPermitidos.length && perfisPermitidos.indexOf(sessao.perfil) === -1) {
      window.location.replace('login.html?aviso=' + encodeURIComponent('Seu perfil (' + this.nomeDoPerfil(sessao.perfil) + ') não tem acesso a este painel.'));
      return null;
    }
    return sessao;
  },

  /* Preenche o cabeçalho do painel e liga o botão "Sair" */
  montarCabecalho(sessao) {
    const campoSaudacao = document.querySelectorAll('[data-usuario-nome]');
    campoSaudacao.forEach(function (el) { el.textContent = sessao.nome; });

    const campoPerfil = document.querySelectorAll('[data-usuario-perfil]');
    campoPerfil.forEach(function (el) { el.textContent = TP_NOMES_PERFIL[sessao.perfil] || sessao.perfil; });

    const campoCargo = document.querySelectorAll('[data-usuario-cargo]');
    campoCargo.forEach(function (el) { el.textContent = sessao.cargo || ''; });

    document.querySelectorAll('[data-acao="sair"]').forEach(function (botao) {
      botao.addEventListener('click', function (evento) {
        evento.preventDefault();
        Auth.sair();
      });
    });
  },

  /* Atalho usado no topo de cada painel */
  iniciarPagina(perfisPermitidos) {
    const sessao = this.exigir(perfisPermitidos);
    if (!sessao) return null;
    this.montarCabecalho(sessao);
    return sessao;
  }
};
