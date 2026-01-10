
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, ShieldX, UploadCloud, DownloadCloud } from 'lucide-react';
import { firebaseConfig } from '@/firebase/config';

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
  const [parentData, setParentData] = useState<EcoFeiraData | null>(null);
  const [appUser, setAppUser] = useState<EcoFeiraUser | null>(null);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const tokenClient = useRef<any>(null);
  const gapiInited = useRef(false);
  const gisInited = useRef(false);


  const PARENT_ORIGIN = 'https://copyecofeira.vercel.app';
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

  const gapiLoaded = () => {
    (window as any).gapi.load('client', initializeGapiClient);
  }

  const initializeGapiClient = async () => {
    await (window as any).gapi.client.init({
      apiKey: firebaseConfig.apiKey,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    gapiInited.current = true;
  }

  const gisLoaded = () => {
      tokenClient.current = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: firebaseConfig.appId, 
        scope: DRIVE_SCOPE,
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            (window as any).gapi.client.setToken(tokenResponse);
             setIsDriveConnected(true);
             setIsProcessing(false);
             toast({
               title: 'Google Drive Conectado!',
               description: 'Agora você pode fazer backup e restaurar seus dados.',
             });
          }
        },
        error_callback: (error: any) => {
            console.error('Erro de autenticação:', error);
            setIsProcessing(false);
            toast({
                title: 'Erro de conexão',
                description: 'Não foi possível conectar ao Google Drive.',
                variant: 'destructive',
            });
        }
      });
      gisInited.current = true;
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== PARENT_ORIGIN) {
        return;
      }
      const { type, user, data } = event.data;
      if (type === 'ECOFEIRA_BACKUP_INIT') {
        setAppUser(user);
        setParentData(data);
        toast({
            title: "Conectado ao EcoFeira!",
            description: `Bem-vindo, ${user.displayName}.`,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'ECOFEIRA_BACKUP_READY' }, PARENT_ORIGIN);

    const scriptGapi = document.createElement('script');
    scriptGapi.src = 'https://apis.google.com/js/api.js';
    scriptGapi.async = true;
    scriptGapi.defer = true;
    scriptGapi.onload = gapiLoaded;
    document.body.appendChild(scriptGapi);

    const scriptGis = document.createElement('script');
    scriptGis.src = 'https://accounts.google.com/gsi/client';
    scriptGis.async = true;
    scriptGis.defer = true;
    scriptGis.onload = gisLoaded;
    document.body.appendChild(scriptGis);

    return () => {
      window.removeEventListener('message', handleMessage);
      document.body.removeChild(scriptGapi);
      document.body.removeChild(scriptGis);
    };
  }, []);

  const handleDriveConnect = () => {
    setIsProcessing(true);
    if (tokenClient.current) {
        tokenClient.current.requestAccessToken();
    } else {
        setIsProcessing(false);
        toast({
            title: 'Erro',
            description: 'A biblioteca de autenticação do Google não carregou.',
            variant: 'destructive',
        });
    }
  };

  const handleBackup = async () => {
    if (!parentData || !appUser) {
        toast({ title: 'Erro', description: 'Dados do EcoFeira não encontrados.', variant: 'destructive'});
        return;
    }
    setIsProcessing(true);

    const fileName = `ecofeira_backup_${appUser.uid}.json`;
    const fileContent = JSON.stringify(parentData);
    const fileMetadata = {
        'name': fileName,
        'mimeType': 'application/json',
    };

    try {
        const response = await (window as any).gapi.client.drive.files.list({
            q: `name='${fileName}' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
        });

        const files = response.result.files;
        const blob = new Blob([fileContent], {type: 'application/json'});

        if (files && files.length > 0) {
            // Update existing file
            const fileId = files[0].id;
            const updateRequest = (window as any).gapi.client.request({
                path: `/upload/drive/v3/files/${fileId}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                body: blob,
            });
            await updateRequest;
            toast({ title: 'Backup Atualizado!', description: 'Seus dados foram atualizados no Google Drive.'});
        } else {
            // Create new file
            const formData = new FormData();
            formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], {type: 'application/json'}));
            formData.append('file', blob);

            const createRequest = (window as any).gapi.client.request({
                path: 'https://www.googleapis.com/upload/drive/v3/files',
                method: 'POST',
                params: { uploadType: 'multipart' },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, // This will be overridden by the multipart content
                body: formData,
            });
             await createRequest;
            toast({ title: 'Backup Concluído!', description: 'Seus dados do EcoFeira foram salvos no Google Drive.'});
        }
    } catch(err) {
        console.error("Erro durante o backup:", err);
        toast({ title: 'Erro no Backup', description: 'Não foi possível salvar os dados no Drive.', variant: 'destructive'});
    } finally {
        setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
     if (!appUser) {
        toast({ title: 'Erro', description: 'Usuário não identificado.', variant: 'destructive'});
        return;
    }
    setIsProcessing(true);
    
    const fileName = `ecofeira_backup_${appUser.uid}.json`;

    try {
        const response = await (window as any).gapi.client.drive.files.list({
            q: `name='${fileName}' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
        });
        const files = response.result.files;
        if (files && files.length > 0) {
            const fileId = files[0].id;
            const fileResponse = await (window as any).gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media',
            });
            const restoredData = fileResponse.result;
            window.parent.postMessage({ type: 'ECOFEIRA_RESTORE_DATA', payload: restoredData }, PARENT_ORIGIN);
            toast({ title: 'Dados Restaurados!', description: 'Seus dados foram enviados de volta para o EcoFeira.'});

        } else {
             toast({ title: 'Nada para restaurar', description: 'Nenhum arquivo de backup encontrado no seu Drive.', variant: 'destructive'});
        }
    } catch (err) {
         console.error("Erro durante a restauração:", err);
         toast({ title: 'Erro na Restauração', description: 'Não foi possível ler os dados do Drive.', variant: 'destructive'});
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-2 mb-2">
            <GoogleDriveIcon className="h-7 w-7" />
            <h1 className="text-2xl font-bold text-foreground">Backup EcoFeira</h1>
          </div>
          <CardTitle>Gerenciador de Backup</CardTitle>
          <CardDescription>
            {appUser ? `Conectado como ${appUser.displayName}` : 'Aguardando conexão com o EcoFeira...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
            {!isDriveConnected ? (
                 <div className="flex flex-col items-center justify-center gap-4 text-center p-6 bg-card-dark rounded-lg">
                    <ShieldX className="h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">Conecte seu Google Drive para gerenciar seus backups.</p>
                    <Button onClick={handleDriveConnect} disabled={!appUser || isProcessing || !gapiInited.current || !gisInited.current}>
                        {isProcessing ? <Loader2 className="animate-spin" /> : 'Conectar ao Google Drive'}
                    </Button>
                </div>
            ): (
                 <div className="flex flex-col items-center justify-center gap-4 text-center p-6 bg-card-dark rounded-lg">
                    <ShieldCheck className="h-12 w-12 text-primary" />
                    <p className="text-muted-foreground">Conexão com Google Drive ativa.</p>
                    <div className="grid grid-cols-2 gap-4 w-full">
                         <Button onClick={handleBackup} disabled={isProcessing} className="bg-primary hover:bg-primary/90">
                            {isProcessing ? <Loader2 className="animate-spin" /> : <><UploadCloud className="mr-2"/> Fazer Backup</>}
                        </Button>
                        <Button onClick={handleRestore} disabled={isProcessing} variant="secondary">
                            {isProcessing ? <Loader2 className="animate-spin" /> : <><DownloadCloud className="mr-2"/> Restaurar</>}
                        </Button>
                    </div>
                </div>
            )}
        </CardContent>
      </Card>
    </main>
  );
}

    