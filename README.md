# Instituto Três Pontinhos — Sistema Web

Site institucional + Área Restrita (painéis de gestão) do Instituto Três Pontinhos.
O site público reproduz o conteúdo real de [institutotrespontinhos.com.br](https://www.institutotrespontinhos.com.br/quem-somos);
a Área Restrita é a funcionalidade nova, com login por CPF.

---

## 1. Como abrir

Não precisa de build nem servidor. Duas opções:

**Opção A — abrir direto (mais rápido na apresentação)**

Dê dois cliques em `index.html`.

**Opção B — servidor local (recomendado)**

Alguns navegadores restringem recursos em `file://`. Se quiser o comportamento
100% correto (área de transferência do PIX, foto dos pacientes, gráficos):

```powershell
python -m http.server 8080
```

Depois acesse: <http://localhost:8080>

---

## 2. Credenciais de demonstração

Senha de **todos** os perfis: `123`

| Perfil | CPF | Nome | Vai para |
|---|---|---|---|
| Diretoria | `111.111.111-11` | Isaac Braga | `diretor.html` |
| Coordenadoria | `222.222.222-22` | Kesia Almeida | `coordenacao.html` |
| Profissional | `333.333.333-33` | Dr. André Mendonça | `profissional.html` |
| Cliente | `444.444.444-44` | Ana Clara Souza | `cliente.html` |

Na tela de login existem **botões de acesso rápido** que preenchem o CPF e a senha.

> Dica de apresentação: no painel da Diretoria há o botão
> **“Restaurar dados de demonstração”**, que devolve o sistema ao estado inicial
> (útil se você alterou tudo durante os testes).

---

## 3. Roteiro sugerido para demonstrar

1. **`index.html`** — mostre o site institucional (terapias, projetos, doação).
2. **Login** pela Coordenadoria → aba **Cadastro de novo paciente** →
   cadastre uma criança com o CPF do responsável.
3. **Login** pelo Cliente usando o CPF que você acabou de cadastrar →
   o paciente aparece; clique em **+ Agendar Nova Consulta**.
4. **Login** pela Coordenadoria → o pedido aparece no **calendário** (status
   *Aguardando*) → clique no dia → **Confirmar**.
   Se o profissional pediu “próxima consulta”, aparece o aviso azul no topo →
   **Escolher dia e horário**.
5. **Login** pelo Profissional → o atendimento aparece na tabela →
   **Marcar entrada na sala** → **Concluir** → **Próxima consulta**.
6. **Login** pela Diretoria → os KPIs e os gráficos já refletem tudo o que
   aconteceu nos passos acima (receita realizada, despesas, terapias).

---

## 4. Arquitetura em 30 segundos

```
HTML  →  js/global.js   (formatação, modais, toast, máscaras)
         js/auth.js     (login por CPF, sessão, guard de rota)
         js/banco.js    (camada de dados assíncrona)
              ↓
      localStorage  ou  Firebase Firestore  (mesma API)
```

- **Nenhum painel fala com `localStorage` direto.** Todos usam `Banco`, que
  expõe `listar / obter / salvar / remover`. Por isso a migração para a nuvem
  não exige reescrever nenhuma tela.
- **Guards de rota:** cada painel chama `Auth.exigir([...perfis])` antes de
  renderizar. Sem sessão válida, o usuário volta para o login.
- **Sair** remove apenas a sessão (`tp_sessao`) — **nunca** apaga os dados.

---

## 5. Como ativar o Firebase (nuvem)

O projeto já está pronto para a nuvem. Faltam 4 passos:

1. Crie um projeto em <https://console.firebase.google.com>.
2. Ative **Firestore Database** (modo produção) e **Authentication → E-mail/senha**.
3. Em *Configurações do projeto → Seus apps → Web*, copie as credenciais.
4. Abra `js/firebase-config.js`, cole os valores e mude `ativo: false` para `ativo: true`:

```js
const TP_FIREBASE = {
  ativo: true,                      // <—— só isto
  config: {
    apiKey: 'AIza...',
    authDomain: 'seu-projeto.firebaseapp.com',
    projectId: 'seu-projeto',
    storageBucket: 'seu-projeto.appspot.com',
    messagingSenderId: '0000000000',
    appId: '1:0000000000:web:abc123'
  }
};
```

Pronto. Ao recarregar, o rodapé dos painéis mostra
**“Modo de dados: Firebase (nuvem)”**. O SDK é carregado por CDN
automaticamente e os dados ficam em
`instituto/estado/<colecao>/itens/<id>`.

> Se o Firebase falhar (credencial errada, regras bloqueando), o sistema avisa
> no console e **continua funcionando no localStorage** — a apresentação não quebra.

### Regras de segurança sugeridas

Hoje `tp_usuarios` guarda senhas em texto puro no navegador — aceitável
apenas no modo demonstração. Ao publicar de verdade:

- Troque o login por **Firebase Authentication** (e-mail/senha) e nunca guarde
  senha em documento do Firestore.
- Restrinja as regras do Firestore por perfil (só `diretor`/`coordenacao`
  escrevem; cada `cliente` lê apenas os próprios dados).
- O sistema trata **dados de saúde de menores** (LGPD): colete consentimento e
  evite guardar foto/laudo sem necessidade.

---

## 6. Correções feitas em relação à versão anterior

| Problema encontrado | Situação agora |
|---|---|
| Login do cliente mandava para `paciente.html` (inexistente) → 404 | Corrigido: vai para `cliente.html` |
| `cliente.html` era uma página órfã, sem nenhum link | Acessível pelo login do perfil *cliente* |
| `js/app.js` e `js/banco.js` eram código morto (nunca carregados) | Reescrevidos e integrados a todas as páginas |
| Senha não era validada (qualquer senha entrava) | Senha conferida em `Auth.login` |
| Perfis definidos por CPF fixo no `if` | Vêm do banco de usuários |
| Nenhuma sessão criada; nome do usuário sempre errado | Sessão real em `tp_sessao`, nome/cargo no cabeçalho |
| “Sair” usava `localStorage.clear()` → **apagava os agendamentos** | Remove só a sessão |
| Dois “bancos” diferentes (`agendamentos` × `db_agendamentos`) | Modelo único, com migração automática dos dados antigos |
| Sem proteção de rota (painéis abriam por URL) | `Auth.exigir()` em todos os painéis |
| CSS com dois `:root` conflitantes e `@import` inválido | Um único `:root`; fonte carregada por `<link>` |
| Animação da logo copiada em 4 arquivos | `Global.ligarPiscadaDaLogo()` em `js/global.js` |
| Layout quebrava no celular (tabelas e grids largos) | Grids flexíveis + `.tabela-scroll` + menu hambúrguer |
| Números fixos no HTML (financeiro, gráficos, pacientes) | Tudo calculado dos dados reais |
| Calendário fixo em “Outubro 2026”, botões de mês sem ação | Calendário dinâmico, navegação de mês funcional |
| `estrutura.txt` descrevia arquivos que não existiam | Documentação atualizada |

---

## 7. Verificação automática

O script `_validar.py` confere:

- balanceamento de delimitadores em todos os JS/CSS/HTML;
- se existe **apenas um** `:root` no CSS e nenhum `@import` inválido;
- **links quebrados** (todo `href`/`src` local deve existir);
- **IDs duplicados** em cada página;
- se todo painel tem **guard de rota** e carrega `js/auth.js`;
- se o JS não acessa `getElementById` de elementos inexistentes no HTML;
- se sobrou algum `localStorage.clear()`.

```powershell
python _validar.py
```

Saída esperada: `PROBLEMAS: nenhum`.

---

## 8. Pendências para uso real (opcional)

- [ ] Preencher a **chave PIX oficial** em `doacao.html` (hoje o botão orienta a
      solicitar pelo WhatsApp, para não inventar uma chave).
- [ ] Trocar as imagens ilustrativas (Unsplash) por fotos autorizadas do Instituto.
- [ ] Ativar o Firebase e migrar o login para Firebase Authentication.
- [ ] Publicar (Netlify, Vercel ou Firebase Hosting) — é um site estático.

---

© Instituto Três Pontinhos | CNPJ: 59.795.570/0001-68
Rua Padre Valdevino, 294 — Joaquim Távora, Fortaleza-CE
WhatsApp: (85) 99200-5743 · trespontinhos.contato@gmail.com"# 3-pontinhos-" 
