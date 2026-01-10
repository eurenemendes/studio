
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// --- DADOS DE EXEMPLO (MOCK) ---
const mockUser = {
  uid: 'mock_user_12345',
  displayName: 'Usuário EcoFeira',
  email: 'usuario@ecofeira.com',
  photoURL: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwzfHxwZXJzb24lMjBwb3J0cmFpdHxlbnwwfHx8fDE3NjgwMDU1OTV8MA&ixlib=rb-4.1.0&q=80&w=1080',
};
const mockAppData = {
  favorites: ['Tomate Orgânico', 'Alface Crespa', 'Ovos Caipira (Dúzia)'],
  shoppingList: [{ item: 'Cenoura', quantity: 5 }, { item: 'Batata Doce', quantity: 3 }],
  scannedHistory: ['prod_123_tomate', 'prod_456_alface'],
  recentSearches: ['maçã fuji', 'banana prata'],
};

export default function BackupPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeReady, setIsIframeReady] = useState(false);
  const tokenClientRef = useRef<any>(null);

  const CHILD_APP_URL = 'https://drivervault.vercel.app/';
  // ID de Cliente OAuth 2.0 correto para o projeto.
  const GOOGLE_CLIENT_ID = '349676062186-jsle32i8463qpad128u2g7grjtj4td33.apps.googleusercontent.com';

  // Função para lidar com a resposta do token do Google
  const handleTokenResponse = useCallback((response: any) => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      if (response && response.access_token) {
        console.log('Token de acesso obtido, enviando para o filho...');
        iframe.contentWindow.postMessage({
          type: 'DRIVE_TOKEN_RESPONSE',
          token: response.access_token,
        }, CHILD_APP_URL);
      } else {
        console.error('Falha ao obter token de acesso.');
        iframe.contentWindow.postMessage({
          type: 'DRIVE_TOKEN_ERROR',
          error: 'Falha na autenticação do Google Drive.',
        }, CHILD_APP_URL);
      }
    }
  }, []);

  // Efeito para carregar e inicializar o Google Identity Services
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: handleTokenResponse,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [handleTokenResponse]);

  // Efeito para gerenciar a comunicação com o iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== new URL(CHILD_APP_URL).origin) {
        return;
      }

      const { type, payload } = event.data;

      if (type === 'ECOFEIRA_BACKUP_READY') {
        console.log('Site filho de backup está pronto.');
        setIsIframeReady(true);
      } else if (type === 'DRIVE_CONNECT_REQUEST') {
        console.log('Recebida solicitação de conexão com o Drive do filho.');
        if (tokenClientRef.current) {
          // Solicita o token de acesso em nome do iframe
          tokenClientRef.current.requestAccessToken();
        } else {
          console.error('Google Token Client não inicializado.');
        }
      } else if (type === 'ECOFEIRA_RESTORE_DATA') {
        console.log('Dados de restauração recebidos:', payload);
        alert('Dados restaurados com sucesso! Verifique o console.');
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleTokenResponse]);

  // Efeito para enviar os dados iniciais assim que o filho estiver pronto
  useEffect(() => {
    if (isIframeReady && iframeRef.current?.contentWindow) {
      console.log('Enviando dados de inicialização para o site filho...');
      iframeRef.current.contentWindow.postMessage({
        type: 'ECOFEIRA_BACKUP_INIT',
        user: mockUser,
        data: mockAppData,
      }, CHILD_APP_URL);
    }
  }, [isIframeReady]);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Gerenciamento de Backup</CardTitle>
          <CardDescription>
            Use o painel abaixo para salvar ou restaurar os dados da sua conta EcoFeira no seu Google Drive pessoal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <iframe
            ref={iframeRef}
            src={CHILD_APP_URL}
            style={{ width: '100%', height: '700px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
            title="DriveVault - Gerenciador de Backup do EcoFeira"
          />
        </CardContent>
      </Card>
    </div>
  );
}
