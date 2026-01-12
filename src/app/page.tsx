
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';

// Tipos para os dados recebidos do site pai
interface EcoFeiraUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

interface EcoFeiraData {
  favorites: any[];
  shoppingList: any[];
  scannedHistory: any[];
  recentSearches: any[];
}

const GoogleDriveIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 28">
        <path fill="#4285F4" d="M21.102 28H10.898L0 9.333l5.449-9.333h10.204l5.449 9.333z"/>
        <path fill="#34A853" d="M32 9.333L21.102 28h-5.449L26.551 0h5.449z"/>
        <path fill="#FFC107" d="M5.449 0L0 9.333l5.449 9.334L10.898 0z"/>
    </svg>
);

export default function Home() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [lastBackupStatus, setLastBackupStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const { toast } = useToast();
  
  const accessTokenRef = useRef<string | null>(null);
  const appDataRef = useRef<EcoFeiraData | null>(null);
  const appUserRef = useRef<EcoFeiraUser | null>(null);
  const parentOriginRef = useRef<string | null>(null);
  
  const isThrottled = useRef(false);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const ALLOWED_PARENT_ORIGINS = [
    'https://copyecofeira.vercel.app',
    'https://ecofeiraintv3.vercel.app',
  ];

  const handleBackup = useCallback(async () => {
    if (isThrottled.current) return;

    const dataToBackup = appDataRef.current;
    const currentUser = appUserRef.current;
    const accessToken = accessTokenRef.current;

    if (!currentUser || !accessToken || !dataToBackup) {
        setLastBackupStatus('error');
        console.error('Backup não pode ser realizado: Dados do usuário, dados do app ou conexão com o Drive não encontrados.', {
            hasUser: !!currentUser,
            hasToken: !!accessToken,
            hasData: !!dataToBackup
        });
        return;
    }

    isThrottled.current = true;
    setLastBackupStatus('saving');

    const fileName = `ecofeira_backup_${currentUser.uid}.json`;
    const fileContent = JSON.stringify(dataToBackup);
    const fileMetadata = {
        'name': fileName,
        'mimeType': 'application/json',
        'parents': ['appDataFolder'] 
    };

    try {
        const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and 'appDataFolder' in parents and trashed=false&spaces=appDataFolder&fields=files(id)`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!searchResponse.ok) {
          const errorBody = await searchResponse.json();
          throw new Error(errorBody.error.message || 'Falha ao buscar arquivo no Drive.');
        }

        const searchResult = await searchResponse.json();
        
        const files = searchResult.files;
        const blob = new Blob([fileContent], {type: 'application/json'});
        let uploadUrl: string;
        let method: 'POST' | 'PATCH';
        let headers: HeadersInit = { 'Authorization': `Bearer ${accessToken}` };
        let body: any;

        if (files && files.length > 0) {
            const fileId = files[0].id;
            uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
            method = 'PATCH';
            body = blob;
            headers['Content-Type'] = 'application/json';
        } else {
            uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            method = 'POST';
            const formData = new FormData();
            formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
            formData.append('file', blob);
            body = formData;
        }
        
        const uploadResponse = await fetch(uploadUrl, {
            method: method,
            headers: headers,
            body: body,
        });

        if (!uploadResponse.ok) {
            const errorBody = await uploadResponse.json();
            throw new Error(errorBody.error.message || 'Falha ao salvar o arquivo no Drive.');
        }

        setLastBackupStatus('saved');

    } catch(err: any) {
        console.error("Erro durante o backup automático:", err);
        setLastBackupStatus('error');
        toast({ title: 'Erro na Sincronização', description: err.message || 'Não foi possível salvar os dados no Drive.', variant: 'destructive'});
    } finally {
        if (throttleTimeoutRef.current) clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = setTimeout(() => {
            isThrottled.current = false;
        }, 20000); // 20 segundos
    }
  }, [toast]);

  const tryBackup = useCallback(() => {
    if (appUserRef.current && appDataRef.current && accessTokenRef.current) {
      handleBackup();
    }
  }, [handleBackup]);


  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!ALLOWED_PARENT_ORIGINS.includes(event.origin)) {
        return;
      }
      
      if (!parentOriginRef.current) {
        parentOriginRef.current = event.origin;
      }
      
      const { type, user, data, token, error } = event.data;

      if (type === 'ECOFEIRA_BACKUP_INIT') {
        appUserRef.current = user;
        appDataRef.current = data;
        if (user) setDisplayName(user.displayName);
        tryBackup();
      }

      if (type === 'DRIVE_TOKEN_RESPONSE' && token) {
         accessTokenRef.current = token;
         setIsDriveConnected(true);
         toast({
           title: 'Google Drive Conectado!',
           description: 'A sincronização automática está ativa.',
           variant: 'success'
         });
         tryBackup();
      }

      if (type === 'DRIVE_TOKEN_ERROR') {
          console.error('Erro de autenticação do Drive recebido do pai:', error);
          toast({
              title: 'Erro de conexão',
              description: 'Não foi possível conectar ao Google Drive.',
              variant: 'destructive',
          });
      }
    };

    window.addEventListener('message', handleMessage);
    
    if(window.parent) {
      window.parent.postMessage({ type: 'ECOFEIRA_BACKUP_READY' }, '*');
    }
    
    return () => {
      window.removeEventListener('message', handleMessage);
      if (throttleTimeoutRef.current) clearTimeout(throttleTimeoutRef.current);
    };
  }, [toast, tryBackup]);


  const renderStatus = () => {
    if (!isDriveConnected) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 text-center p-6 bg-card rounded-lg border border-border">
          <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
          <p className="font-semibold">Conectando ao Google Drive...</p>
          <p className="text-sm text-muted-foreground">Aguardando autorização do EcoFeira.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center p-6 bg-card rounded-lg border-2 border-green-500/50">
        <ShieldCheck className="h-12 w-12 text-primary" />
        <p className="font-semibold text-primary">Sincronização Ativa</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {lastBackupStatus === 'saving' && <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>}
          {lastBackupStatus === 'saved' && <><CheckCircle2 className="h-4 w-4 text-green-400" /> Sincronizado</>}
          {lastBackupStatus === 'error' && <p className="text-destructive">Erro na última sincronização</p>}
          {lastBackupStatus === 'idle' && <p>Aguardando alterações...</p>}
        </div>
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 font-sans">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-3 mb-2">
            <GoogleDriveIcon className="h-8 w-8" />
            <h1 className="text-3xl font-bold text-foreground">DriveVault</h1>
          </div>
          <CardTitle className="text-xl">Sincronização do EcoFeira</CardTitle>
          <CardDescription>
            {displayName ? `Conectado como ${displayName}` : 'Conexão gerenciada pelo EcoFeira.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
            {renderStatus()}
        </CardContent>
      </Card>
      <footer className="text-center mt-6">
        <p className="text-sm text-muted-foreground">
            Protegido pelo Google Drive
        </p>
      </footer>
    </main>
  );
}
