
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, ShieldX, UploadCloud, DownloadCloud } from 'lucide-react';

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
  const accessTokenRef = useRef<string | null>(null);

  // Define a origem do site pai para validação de segurança
  const PARENT_ORIGIN = 'https://copyecofeira.vercel.app';

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== PARENT_ORIGIN) {
        console.warn('Mensagem recebida de uma origem não confiável:', event.origin);
        return;
      }
      
      const { type, user, data, token } = event.data;

      if (type === 'ECOFEIRA_BACKUP_INIT') {
        setAppUser(user);
        setParentData(data);
        toast({
            title: "Conectado ao EcoFeira!",
            description: `Bem-vindo, ${user.displayName}.`,
        });
      }

      if (type === 'DRIVE_TOKEN_RESPONSE' && token) {
         accessTokenRef.current = token;
         setIsDriveConnected(true);
         setIsProcessing(false);
         toast({
           title: 'Google Drive Conectado!',
           description: 'Agora você pode fazer backup e restaurar seus dados.',
           variant: 'success'
         });
      }

      if (type === 'DRIVE_TOKEN_ERROR') {
          console.error('Erro de autenticação do Drive recebido do pai:', event.data.error);
          setIsProcessing(false);
          toast({
              title: 'Erro de conexão',
              description: 'Não foi possível conectar ao Google Drive através do EcoFeira.',
              variant: 'destructive',
          });
      }
    };

    window.addEventListener('message', handleMessage);
    // Informa ao pai que o iframe está pronto para receber dados
    window.parent.postMessage({ type: 'ECOFEIRA_BACKUP_READY' }, PARENT_ORIGIN);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleDriveConnect = () => {
    setIsProcessing(true);
    // Pede ao site pai para iniciar o fluxo de conexão com o Drive
    window.parent.postMessage({ type: 'DRIVE_CONNECT_REQUEST' }, PARENT_ORIGIN);
  };

  const handleBackup = async () => {
    if (!parentData || !appUser || !accessTokenRef.current) {
        toast({ title: 'Erro', description: 'Dados ou conexão com o Drive não encontrados.', variant: 'destructive'});
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
        // 1. Pesquisar pelo arquivo
        const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and 'appDataFolder' in parents and trashed=false&spaces=appDataFolder&fields=files(id)`, {
            headers: { 'Authorization': `Bearer ${accessTokenRef.current}` }
        });
        const searchResult = await searchResponse.json();

        if (searchResult.error) throw searchResult.error;
        
        const files = searchResult.files;
        const blob = new Blob([fileContent], {type: 'application/json'});
        let uploadUrl: string;
        let method: 'POST' | 'PATCH';

        if (files && files.length > 0) {
            // Arquivo existe, vamos atualizar (PATCH)
            const fileId = files[0].id;
            uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
            method = 'PATCH';
        } else {
            // Arquivo não existe, vamos criar (POST)
            uploadUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=media`;
            method = 'POST';
        }
        
        // Crie um novo FormData para o upload
        const formData = new FormData();
        if (method === 'POST') {
             // Para criar, precisamos dos metadados e do arquivo
             formData.append('metadata', new Blob([JSON.stringify({ ...fileMetadata, parents: ['appDataFolder'] })], { type: 'application/json' }));
             formData.append('file', blob);
             uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        } else {
            // Para atualizar, só o conteúdo do arquivo
             uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${files[0].id}?uploadType=media`;
             formData.append('file', blob); // Embora não seja um 'form', o corpo será o blob
        }

        const uploadResponse = await fetch(uploadUrl, {
            method: method,
            headers: { 'Authorization': `Bearer ${accessTokenRef.current}` },
            body: method === 'POST' ? formData : blob,
        });

        const uploadResult = await uploadResponse.json();
        if (uploadResult.error) throw uploadResult.error;

        toast({ title: `Backup ${method === 'POST' ? 'Concluído' : 'Atualizado'}!`, description: 'Seus dados foram salvos no Google Drive.', variant: 'success'});

    } catch(err: any) {
        console.error("Erro durante o backup:", err);
        toast({ title: 'Erro no Backup', description: err.message || 'Não foi possível salvar os dados no Drive.', variant: 'destructive'});
    } finally {
        setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
     if (!appUser || !accessTokenRef.current) {
        toast({ title: 'Erro', description: 'Usuário não identificado ou Drive não conectado.', variant: 'destructive'});
        return;
    }
    setIsProcessing(true);
    
    const fileName = `ecofeira_backup_${appUser.uid}.json`;

    try {
        const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and 'appDataFolder' in parents and trashed=false&spaces=appDataFolder&fields=files(id)`, {
            headers: { 'Authorization': `Bearer ${accessTokenRef.current}` }
        });
        const searchResult = await searchResponse.json();
        if (searchResult.error) throw searchResult.error;
        
        const files = searchResult.files;
        if (files && files.length > 0) {
            const fileId = files[0].id;
            const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { 'Authorization': `Bearer ${accessTokenRef.current}` }
            });
            
            if (!fileResponse.ok) {
                const errorBody = await fileResponse.json();
                throw errorBody.error;
            }

            const restoredData = await fileResponse.json();
            window.parent.postMessage({ type: 'ECOFEIRA_RESTORE_DATA', payload: restoredData }, PARENT_ORIGIN);
            toast({ title: 'Dados Restaurados!', description: 'Seus dados foram enviados de volta para o EcoFeira.', variant: 'success'});

        } else {
             toast({ title: 'Nada para restaurar', description: 'Nenhum arquivo de backup encontrado no seu Drive.', variant: 'destructive'});
        }
    } catch (err: any) {
         console.error("Erro durante a restauração:", err);
         toast({ title: 'Erro na Restauração', description: err.message || 'Não foi possível ler os dados do Drive.', variant: 'destructive'});
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 font-sans">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-3 mb-2">
            <GoogleDriveIcon className="h-8 w-8" />
            <h1 className="text-3xl font-bold text-foreground">DriveVault</h1>
          </div>
          <CardTitle className="text-xl">Backup do EcoFeira</CardTitle>
          <CardDescription>
            {appUser ? `Conectado como ${appUser.displayName}` : 'Aguardando conexão com o EcoFeira...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
            {!isDriveConnected ? (
                 <div className="flex flex-col items-center justify-center gap-4 text-center p-6 bg-card rounded-lg border border-border">
                    <ShieldX className="h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">Conecte seu Google Drive para gerenciar seus backups.</p>
                    <Button onClick={handleDriveConnect} disabled={!appUser || isProcessing}>
                        {isProcessing ? <Loader2 className="animate-spin" /> : 'Conectar ao Google Drive'}
                    </Button>
                </div>
            ): (
                 <div className="flex flex-col items-center justify-center gap-4 text-center p-6 bg-card rounded-lg border border-border">
                    <ShieldCheck className="h-12 w-12 text-primary" />
                    <p className="text-muted-foreground">Conexão com Google Drive ativa.</p>
                    <div className="grid grid-cols-2 gap-4 w-full mt-2">
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
      <footer className="text-center mt-6">
        <p className="text-sm text-muted-foreground">
            Protegido pelo Google Drive
        </p>
      </footer>
    </main>
  );
}
