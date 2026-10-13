/* ==========================================================================
   js/global.js — Utilidades compartilhadas por todas as páginas
   (antes esse código estava copiado dentro de 4 arquivos HTML diferentes)
   ========================================================================== */
'use strict';

const Global = {
  /* ---------------------- Formatação (pt-BR) ---------------------- */
  moeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  dataHora(iso) {
    if (!iso) return '—';
    const data = new Date(iso);
    if (isNaN(data)) return String(iso);
    return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  },

  dataLonga(iso) {
    if (!iso) return '—';
    const data = new Date(iso);
    if (isNaN(data)) return String(iso);
    return data.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  },

  data(iso) {
    if (!iso) return '—';
    const data = new Date(iso);
    if (isNaN(data)) return String(iso);
    return data.toLocaleDateString('pt-BR');
  },

  apenasData(iso) { return String(iso || '').slice(0, 10); },
  hora(iso) { return String(iso || '').slice(11, 16) || '—'; },

  idade(nascimento) {
    if (!nascimento) return '';
    const nas = new Date(nascimento);
    if (isNaN(nas)) return '';
    const hoje = new Date();
    let anos = hoje.getFullYear() - nas.getFullYear();
    const aniversarioPassou = (hoje.getMonth() > nas.getMonth()) ||
      (hoje.getMonth() === nas.getMonth() && hoje.getDate() >= nas.getDate());
    if (!aniversarioPassou) anos--;
    return anos >= 0 ? anos + ' ano' + (anos === 1 ? '' : 's') : '';
  },

  escaparHTML(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  /* --------------------------- Avisos (toast) --------------------------- */
  avisar(mensagem, tipo) {
    let caixa = document.getElementById('tp-toast');
    if (!caixa) {
      caixa = document.createElement('div');
      caixa.id = 'tp-toast';
      caixa.className = 'toast';
      caixa.setAttribute('role', 'status');
      caixa.setAttribute('aria-live', 'polite');
      document.body.appendChild(caixa);
    }
    caixa.textContent = mensagem;
    caixa.className = 'toast visivel ' + (tipo || '');
    clearTimeout(this._timerToast);
    this._timerToast = setTimeout(function () { caixa.className = 'toast ' + (tipo || ''); }, 3600);
  },

  confirmar(mensagem) { return window.confirm(mensagem); },

  /* Mensagem vinda da URL (?aviso=... disparado pelo guard de rotas) */
  mostrarAvisoDaUrl() {
    const parametros = new URLSearchParams(window.location.search);
    const aviso = parametros.get('aviso');
    if (aviso) {
      this.avisar(aviso, 'erro');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  },

  /* ------------------------ Cabeçalho e rodapé ------------------------ */
  /* Marca o link do menu da página atual e liga o menu do celular */
  iniciarSite(paginaAtual) {
    document.querySelectorAll('.site-nav a').forEach(function (link) {
      const destino = (link.getAttribute('href') || '').split('?')[0];
      if (destino && destino === paginaAtual) link.classList.add('ativo');
    });

    const botaoMenu = document.getElementById('menuToggle');
    const menu = document.getElementById('siteNav');
    if (botaoMenu && menu) {
      botaoMenu.addEventListener('click', function () {
        const aberto = menu.classList.toggle('aberto');
        botaoMenu.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      });
      menu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () { menu.classList.remove('aberto'); });
      });
    }

    document.querySelectorAll('[data-ano]').forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });

    this.ligarPiscadaDaLogo();
    this.mostrarAvisoDaUrl();
    this.ligarFechamentoDeModais();
  },

  /* Animação do olho que pisca — agora em UM só lugar para todo o site */
  ligarPiscadaDaLogo() {
    document.addEventListener('click', function (evento) {
      const alvo = evento.target.closest('a, button, .card-servico, .brand-logo-container');
      if (!alvo) return;
      const logo = document.querySelector('.brand-logo-container');
      if (!logo) return;
      logo.classList.add('piscando');
      setTimeout(function () { logo.classList.remove('piscando'); }, 200);
    });
  },

  /* ------------------------------ Modais ------------------------------ */
  abrirModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('aberto');
    const primeiro = modal.querySelector('input, select, textarea');
    if (primeiro) setTimeout(function () { primeiro.focus(); }, 80);
  },

  fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('aberto');
  },

  /* Fecha o modal ao clicar no fundo escuro ou apertar ESC */
  ligarFechamentoDeModais() {
    document.querySelectorAll('.modal').forEach(function (modal) {
      modal.addEventListener('click', function (evento) {
        if (evento.target === modal) modal.classList.remove('aberto');
      });
    });
    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') {
        document.querySelectorAll('.modal.aberto').forEach(function (m) { m.classList.remove('aberto'); });
      }
    });
  },

  /* ------------------------- Máscaras de input ------------------------- */
  mascaraTelefone(input) {
    let v = String(input.value || '').replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
    else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    else if (v.length > 0) v = v.replace(/^(\d{0,2}).*/, '($1');
    input.value = v;
  }
};
