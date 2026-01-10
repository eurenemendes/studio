
'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const PARENT_ORIGIN = 'https://copyecofeira.vercel.app';

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Por segurança, sempre verifique a origem da mensagem
      if (event.origin !== PARENT_ORIGIN) {
        console.warn('Mensagem recebida de uma origem não confiável:', event.origin);
        return;
      }

      const { type, user, data } = event.data;

      if (type === 'ECOFEIRA_BACKUP_INIT') {
        console.log('Dados de inicialização recebidos do EcoFeira:', { user, data });
        setAppUser(user);
        setParentData(data);
        toast({
            title: "Conectado ao EcoFeira!",
            description: `Bem-vindo, ${user.displayName}.`,
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Envia uma mensagem para o pai avisando que o iframe está pronto
    window.parent.postMessage({ type: 'ECOFEIRA_BACKUP_READY' }, PARENT_ORIGIN);


    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [toast]);

  const handleDriveConnect = () => {
    // Aqui viria a lógica de autenticação OAuth2 com a API do Google Drive
    // Por enquanto, vamos apenas simular a conexão.
    setIsProcessing(true);
    setTimeout(() => {
      setIsDriveConnected(true);
      setIsProcessing(false);
      toast({
        title: 'Google Drive Conectado!',
        description: 'Agora você pode fazer backup e restaurar seus dados.',
      });
    }, 1500);
  };

  const handleBackup = async () => {
    if (!parentData || !appUser) {
        toast({ title: 'Erro', description: 'Dados do EcoFeira não encontrados.', variant: 'destructive'});
        return;
    }

    setIsProcessing(true);
    console.log('Iniciando backup com os dados:', parentData);

    // Simulação da lógica de backup
    setTimeout(() => {
         // Lógica para salvar o arquivo `ecofeira_backup_[UID].json` no Drive
        toast({ title: 'Backup Concluído!', description: 'Seus dados do EcoFeira foram salvos no Google Drive.'});
        setIsProcessing(false);
    }, 2000);
  };

  const handleRestore = () => {
     if (!appUser) {
        toast({ title: 'Erro', description: 'Usuário não identificado.', variant: 'destructive'});
        return;
    }
    setIsProcessing(true);
    console.log('Iniciando restauração do Drive...');
    
    // Simulação da lógica de restauração
    setTimeout(() => {
        // Lógica para ler o arquivo `ecofeira_backup_[UID].json` do Drive
        const restoredData = parentData; // Simulação
        
        window.parent.postMessage({ type: 'ECOFEIRA_RESTORE_DATA', payload: restoredData }, PARENT_ORIGIN);
        toast({ title: 'Dados Restaurados!', description: 'Seus dados foram enviados de volta para o EcoFeira.'});
        setIsProcessing(false);
    }, 2000);
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
                    <Button onClick={handleDriveConnect} disabled={!appUser || isProcessing}>
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
