import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DownloadCloud, Loader2 } from 'lucide-react';

interface BackupControlsProps {
  isConnected: boolean;
  isBackingUp: boolean;
  backupProgress: number;
  onBackupStart: () => void;
}

export function BackupControls({ isConnected, isBackingUp, backupProgress, onBackupStart }: BackupControlsProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Manual Backup</CardTitle>
        <CardDescription>
          {isConnected ? 'Start a new backup of your data to Google Drive.' : 'Please connect to Google Drive first.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center items-center gap-4 text-center">
        {!isConnected ? (
          <div className="text-muted-foreground">Connect to start a backup</div>
        ) : isBackingUp ? (
          <div className="w-full space-y-2">
             <div className="flex justify-center items-center text-sm text-primary font-medium">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>Backing up... {backupProgress}%</span>
            </div>
            <Progress value={backupProgress} className="w-full" />
            <p className="text-xs text-muted-foreground">Please keep this window open.</p>
          </div>
        ) : (
          <Button size="lg" onClick={onBackupStart} disabled={!isConnected || isBackingUp} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <DownloadCloud className="mr-2 h-5 w-5" /> Start Backup
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
