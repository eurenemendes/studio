# Manual: Implementando Backup e Sincronização com Google Drive

Este manual detalha o passo a passo para implementar um sistema de backup e sincronização de dados de uma aplicação web usando o Google Drive. A arquitetura utilizada é moderna e segura, baseada em um "Site Pai" (sua aplicação principal) e um "Site Filho" (um módulo de backup isolado) que rodam em um `iframe`.

## Arquitetura: Site Pai e Site Filho

Em vez de colocar a lógica de backup diretamente na sua aplicação principal, nós a separamos em duas partes:

1.  **Site Pai (Ex: EcoFeira):** Sua aplicação principal onde o usuário interage. Ela é responsável por:
    *   Exibir o módulo de backup dentro de um `iframe`.
    *   Gerenciar o login do usuário (autenticação com o Google).
    *   Enviar os dados do usuário e da aplicação para o `iframe`.

2.  **Site Filho (Ex: DriveVault):** Uma aplicação dedicada exclusivamente ao backup. Ela é responsável por:
    *   Receber os dados e o token de acesso do Site Pai.
    *   Interagir com a API do Google Drive para salvar (backup) e ler (restaurar) os dados.
    *   Fornecer a interface de usuário para as ações de backup e restauração.

**Vantagens desta arquitetura:**
*   **Segurança:** Isola as permissões sensíveis do Google Drive. O Site Filho só tem o poder que o Site Pai lhe concede.
*   **Manutenção:** O código de backup fica separado e é mais fácil de manter.
*   **Reutilização:** O Site Filho pode ser reutilizado em outros projetos com poucas modificações.

---

## Parte 1: Configuração no Google Cloud Console

Antes de escrever qualquer código, você precisa configurar seu projeto no Google Cloud para permitir que sua aplicação acesse a API do Google Drive.

### Passo 1: Crie ou Selecione um Projeto

1.  Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2.  Crie um novo projeto ou selecione um existente.

### Passo 2: Ative a API do Google Drive

1.  No menu de navegação, vá para **APIs e Serviços > Biblioteca**.
2.  Pesquise por "Google Drive API" e clique em **Ativar**.

### Passo 3: Crie as Credenciais (OAuth 2.0)

Esta é a etapa mais crítica. Você está criando a "identidade digital" que sua aplicação usará para se comunicar com o Google.

1.  No menu, vá para **APIs e Serviços > Credenciais**.
2.  Clique em **+ CRIAR CREDENCIAIS** e selecione **ID do cliente OAuth**.
3.  Configure os seguintes campos:
    *   **Tipo de aplicativo:** Selecione `Aplicativo da Web`.
    *   **Nome:** Dê um nome descritivo (ex: "Cliente Web do EcoFeira").

4.  **Configurar Origens e Redirecionamentos (Muito Importante!):**
    *   **Origens JavaScript autorizadas:** Adicione a URL base do seu **Site Pai**. É daqui que as solicitações de login se originarão.
        *   Exemplo: `https://copyecofeira.vercel.app`
        *   Para desenvolvimento local: `http://localhost:3000` (ou a porta que você usa).
    *   **URIs de redirecionamento autorizados:** Adicione a URL exata para onde o Google deve retornar após o login. Para a biblioteca que usamos, é a mesma URL do site pai.
        *   Exemplo: `https://copyecofeira.vercel.app`
        *   Para desenvolvimento local: `http://localhost:3000`

5.  Clique em **CRIAR**. O Google fornecerá um **ID do Cliente**. Copie este valor, pois você precisará dele no código do Site Pai.

---

## Parte 2: Implementação do Site Filho (DriveVault)

Este é o módulo que fica dentro do `iframe` e lida com a API do Drive.

### Passo 1: Criar a Interface do Usuário

*   Crie uma página simples com:
    *   Um título (ex: "DriveVault - Backup").
    *   Um botão "Conectar ao Google Drive", que fica desabilitado inicialmente.
    *   Botões "Fazer Backup" e "Restaurar", que só aparecem após a conexão.

### Passo 2: Implementar a Comunicação `postMessage`

A comunicação é a espinha dorsal da integração.

1.  **Avisar que está Pronto:** Assim que o componente montar, envie uma mensagem para o pai para avisar que o `iframe` está pronto para receber dados.

    ```javascript
    // Dentro de um useEffect no Site Filho
    window.parent.postMessage({ type: 'ECOFEIRA_BACKUP_READY' }, 'URL_DO_SITE_PAI');
    ```

2.  **Ouvir o Pai:** Crie um listener para receber mensagens do Site Pai.

    ```javascript
    // Dentro de um useEffect no Site Filho
    window.addEventListener('message', (event) => {
      // Verificação de segurança crucial!
      if (event.origin !== 'URL_DO_SITE_PAI') return;

      const { type, user, data, token } = event.data;

      if (type === 'ECOFEIRA_BACKUP_INIT') {
        // Recebe dados do usuário e do app, habilita o botão "Conectar".
      }

      if (type === 'DRIVE_TOKEN_RESPONSE') {
        // Recebe o token de acesso e habilita os botões de backup/restauração.
      }
    });
    ```

### Passo 3: Implementar as Ações

1.  **Conectar ao Drive:** O clique no botão "Conectar" **não** inicia o login. Ele apenas envia uma mensagem para o pai, pedindo que ele o faça.

    ```javascript
    // Função de clique no botão Conectar no Site Filho
    const handleDriveConnect = () => {
      window.parent.postMessage({ type: 'DRIVE_CONNECT_REQUEST' }, 'URL_DO_SITE_PAI');
    };
    ```

2.  **Backup e Restauração:** Use a função `fetch` e o token de acesso (recebido do pai) para fazer chamadas diretas à API do Google Drive v3 para criar, ler e atualizar o arquivo de backup.

    *   **Escopo de Segurança:** Salve os arquivos na `appDataFolder`, uma pasta privada acessível apenas pela sua aplicação.
    *   **Endpoint de Upload/Update:** `https://www.googleapis.com/upload/drive/v3/files/...`
    *   **Endpoint de Download/List:** `https://www.googleapis.com/drive/v3/files/...`

---

## Parte 3: Implementação do Site Pai (EcoFeira)

Esta é a sua aplicação principal, que orquestra todo o processo.

### Passo 1: Incorporar o Iframe

*   Na sua página de backup (`/backup`), adicione o `iframe` apontando para a URL do **Site Filho**.

    ```jsx
    <iframe src="URL_DO_SITE_FILHO" />
    ```

### Passo 2: Gerenciar a Autenticação (O Coração da Lógica)

1.  **Carregar a Biblioteca do Google:** Crie um `useEffect` para injetar o script da biblioteca de identidade do Google (`https://accounts.google.com/gsi/client`) na sua página.

2.  **Inicializar o Cliente de Token:** Após o script carregar, inicialize o cliente OAuth do Google. É aqui que você usará o **ID do Cliente** que você copiou no início.

    ```javascript
    // Dentro de um useEffect no Site Pai
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: 'SEU_ID_DO_CLIENTE_AQUI.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata', // Escopos corretos!
      callback: (response) => {
        // Este callback é executado após o login do usuário.
        // Envie o token de volta para o iframe.
        iframeRef.current.contentWindow.postMessage({
          type: 'DRIVE_TOKEN_RESPONSE',
          token: response.access_token,
        }, 'URL_DO_SITE_FILHO');
      },
    });
    ```
    > **Nota Crítica sobre Escopos:** Usar `drive.file` e `drive.appdata` é fundamental. O primeiro permite criar arquivos e o segundo dá acesso à pasta segura do aplicativo.

3.  **Ouvir as Solicitações do Filho:** No listener de mensagens, espere por `DRIVE_CONNECT_REQUEST`. Quando receber, chame o cliente de token para iniciar o pop-up de login.

    ```javascript
    // Dentro do listener de mensagens no Site Pai
    if (type === 'DRIVE_CONNECT_REQUEST') {
      tokenClient.requestAccessToken(); // Isso abre o pop-up de login do Google.
    }
    ```

### Passo 3: Enviar os Dados de Inicialização

*   Quando o `iframe` avisar que está pronto (`ECOFEIRA_BACKUP_READY`), envie os dados do usuário e da aplicação para ele.

Parabéns! Seguindo esses três grandes blocos de implementação, você terá um sistema de backup robusto, seguro e desacoplado, pronto para ser usado em produção.
