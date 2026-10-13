/* ==========================================================================
   js/firebase-config.js
   Configuração do Firebase (Firestore + Authentication).

   COMO ATIVAR (passo a passo no README.md):
     1. Crie um projeto em https://console.firebase.google.com
     2. Ative o Firestore Database (modo produção) e o Authentication (E-mail/senha)
     3. Copie as credenciais em: Configurações do projeto > Seus apps > Web
     4. Cole os valores abaixo e mude  ativo: false  para  ativo: true

   Enquanto `ativo` for false, o sistema continua funcionando 100% no
   localStorage (modo demonstração) — nada quebra.
   ========================================================================== */
'use strict';

const TP_FIREBASE = {
  ativo: false,

  config: {
    apiKey: 'COLE_AQUI_A_API_KEY',
    authDomain: 'COLE_AQUI.firebaseapp.com',
    projectId: 'COLE_AQUI',
    storageBucket: 'COLE_AQUI.appspot.com',
    messagingSenderId: 'COLE_AQUI',
    appId: 'COLE_AQUI'
  },

  /* Coleção raiz usada no Firestore. Cada "coleção" local vira uma
     subcoleção:  instituto/estado/<colecao>/itens/<id>  */
  documentoRaiz: 'instituto',
  documentoEstado: 'estado'
};
