# Manual: Implementando Backup com Google Drive Diretamente na Aplicação

Este manual detalha o passo a passo para implementar um sistema de backup e sincronização de dados de uma aplicação web usando o Google Drive, com toda a lógica contida diretamente na aplicação principal (ex: EcoFeira).

## Arquitetura: Integração Direta

Neste modelo, toda a lógica de autenticação, autorização e comunicação com a API do Google Drive reside em um único componente dentro da sua aplicação.

1.  **Aplicação Principal (Ex: EcoFeira):** É responsável por tudo:
    *   Gerenciar o estado dos dados do usuário.
    *   Exibir a interface de backup (botões de conectar, salvar, restaurar).
    *   Carregar as bibliotecas de cliente do Google.
    *   Iniciar o fluxo de autenticação e autorização para o Google Drive.
    *   Fazer as chamadas diretas para a API do Google Drive para salvar e restaurar os dados.

**Vantagens e Desvantagens:**
*   **Vantagem (Simplicidade):** Menos complexidade, pois não há necessidade de comunicação entre janelas (`postMessage`). Todo o código está em um só lugar.
*   **Desvantagem (Segurança):** A sua aplicação principal precisa solicitar escopos de permissão mais amplos (acesso ao Google Drive), o que aumenta a superfície de ataque se houver uma vulnerabilidade. O modelo de `iframe` isola essas permissões.

---

## Parte 1: Configuração no Google Cloud Console

Esta etapa é idêntica à da arquitetura com `iframe`, pois sua aplicação ainda precisa ser registrada no Google para obter permissão.

### Passo 1: Crie ou Selecione um Projeto

1.  Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2.  Crie um novo projeto ou selecione um existente (ex: `ecofeira-a05e8`).

### Passo 2: Ative a API do Google Drive

1.  No menu de navegação, vá para **APIs e Serviços > Biblioteca**.
2.  Pesquise por "Google Drive API" e clique em **Ativar**.

### Passo 3: Crie as Credenciais (OAuth 2.0)

Esta é a etapa crítica para identificar sua aplicação para o Google.

1.  No menu, vá para **APIs e Serviços > Credenciais**.
2.  Clique em **+ CRIAR CREDENCIAIS** e selecione **ID do cliente OAuth**.
3.  Configure os seguintes campos:
    *   **Tipo de aplicativo:** Selecione `Aplicativo da Web`.
    *   **Nome:** Dê um nome descritivo (ex: "Cliente Web do EcoFeira").

4.  **Configurar Origens e Redirecionamentos (Muito Importante!):**
    *   **Origens JavaScript autorizadas:** Adicione a URL base da sua aplicação. É daqui que as solicitações de login se originarão.
        *   Exemplo Produção: `https://copyecofeira.vercel.app`
        *   Exemplo Local: `http://localhost:3000` (ou a porta que você usa).
    *   **URIs de redirecionamento autorizados:** Adicione a mesma URL base da sua aplicação. A biblioteca GSI do Google usa essa URL para o fluxo de redirecionamento.
        *   Exemplo Produção: `https://copyecofeira.vercel.app`
        *   Exemplo Local: `http://localhost:3000`

5.  Clique em **CRIAR**. O Google fornecerá um **ID do Cliente**. Copie este valor; você o usará diretamente no seu código.

---

## Parte 2: Implementação na Aplicação (Ex: EcoFeira)

Toda a lógica a seguir deve ser implementada em um único componente React (ex: `src/app/backup/page.tsx`).

### Passo 1: Criar a Interface do Usuário

*   Crie uma página ou componente com:
    *   Um botão "Conectar ao Google Drive".
    *   Botões "Fazer Backup" e "Restaurar", que ficam desabilitados ou ocultos até que a conexão com o Drive seja estabelecida.
    *   Indicadores de estado (ex: ícones de carregamento, mensagens de status).

### Passo 2: Gerenciar o Estado do Componente

Use os hooks do React para gerenciar o estado da funcionalidade de backup.

```javascript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ... resto dos imports

export default function BackupPage() {
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [appData, setAppData] = useState({ /* dados do seu app */ });
  const [user, setUser] = useState({ /* dados do usuário logado */ });
  const accessTokenRef = useRef<string | null>(null);
  const tokenClientRef = useRef<any>(null);

  // ... resto do código
}
```

### Passo 3: Implementar a Lógica de Autenticação

1.  **Carregar o Script do Google:** Use um `useEffect` para injetar o script da biblioteca de identidade do Google (`https://accounts.google.com/gsi/client`) na página.

2.  **Inicializar o Cliente de Token:** No `onload` do script, inicialize o cliente OAuth do Google. É aqui que você usará o **ID do Cliente** e os **escopos** corretos.

    ```javascript
    // Dentro de um useEffect
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: 'SEU_ID_DO_CLIENTE.apps.googleusercontent.com',
          // Escopos CRÍTICOS para criar arquivos e acessar a pasta privada do app
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata',
          callback: (response) => {
            // Este callback é executado após o login e consentimento do usuário.
            if (response && response.access_token) {
              accessTokenRef.current = response.access_token;
              setIsDriveConnected(true);
              setIsProcessing(false);
              // Lógica de sucesso (ex: mostrar toast)
            } else {
              // Lógica de erro
            }
          },
        });
      }
    };
    document.body.appendChild(script);
    ```

3.  **Criar a Função de Conexão:** Crie uma função que será chamada pelo clique do botão "Conectar".

    ```javascript
    const handleDriveConnect = () => {
      if (tokenClientRef.current) {
        setIsProcessing(true);
        tokenClientRef.current.requestAccessToken(); // Isso abre o pop-up de login do Google.
      }
    };
    ```

### Passo 4: Implementar as Funções de Backup e Restauração

Estas funções usarão o `accessTokenRef.current` para fazer chamadas diretas à API do Google Drive usando `fetch`.

1.  **Função de Backup (`handleBackup`):**
    *   Verifique se o token de acesso existe.
    *   Defina o nome do arquivo (ex: `ecofeira_backup_USER_ID.json`).
    *   Prepare o conteúdo do arquivo (um JSON com os dados do seu app).
    *   **Pesquisar:** Primeiro, pesquise na `appDataFolder` se o arquivo já existe.
        *   Endpoint: `https://www.googleapis.com/drive/v3/files?q=name='...' and 'appDataFolder' in parents&spaces=appDataFolder`
    *   **Criar ou Atualizar:**
        *   Se o arquivo **não existe**, faça uma requisição `POST` para `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, enviando os metadados (nome, mimeType, `parents: ['appDataFolder']`) e o conteúdo do arquivo.
        *   Se o arquivo **existe**, faça uma requisição `PATCH` para `https://www.googleapis.com/upload/drive/v3/files/FILE_ID?uploadType=media`, enviando apenas o novo conteúdo.
    *   Em todas as chamadas `fetch`, inclua o cabeçalho de autorização:
        ```
        headers: { 'Authorization': `Bearer ${accessTokenRef.current}` }
        ```

2.  **Função de Restauração (`handleRestore`):**
    *   Verifique se o token de acesso existe.
    *   Pesquise pelo arquivo de backup na `appDataFolder`.
    *   Se encontrado, obtenha o ID do arquivo.
    *   Faça uma requisição `GET` para `https://www.googleapis.com/drive/v3/files/FILE_ID?alt=media`.
    *   O corpo da resposta será o JSON com os dados salvos. Use `response.json()` para lê-lo.
    *   Atualize o estado da sua aplicação com os dados restaurados.

Parabéns! Seguindo esses passos, você terá um sistema de backup robusto e funcional, totalmente integrado à sua aplicação principal.
