"use client";

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/header';
import { ConnectDrive } from '@/components/connect-drive';
import { BackupControls } from '@/components/backup-controls';
import { BackupLog } from '@/components/backup-log';
import { useToast } from "@/hooks/use-toast";
import type { BackupLogEntry } from '@/components/backup-log';
import { useAuth, useUser } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const initialLogs: BackupLogEntry[] = [
  {
    id: 'log3',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Completed',
    details: 'Full backup of 2,415 items.',
  },
  {
    id: 'log2',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Failed',
    details: 'API connection timed out.',
  },
  {
    id: 'log1',
    date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Completed',
    details: 'Full backup of 2,388 items.',
  },
];


export default function Home() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupLogs, setBackupLogs] = useState<BackupLogEntry[]>(initialLogs);
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
      await signInWithPopup(auth, provider);
      toast({
        title: "Successfully connected to Google Drive!",
        description: "You can now start backing up your data.",
      });
    } catch (error) {
      console.error("Error during sign-in:", error);
      toast({
        title: "Connection Failed",
        description: "Could not connect to Google Drive. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Disconnected from Google Drive",
        description: "You can reconnect anytime.",
      });
    } catch (error) {
      console.error("Error during sign-out:", error);
      toast({
        title: "Disconnection Failed",
        description: "An error occurred while disconnecting. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBackupStart = useCallback(() => {
    if (isBackingUp) return;

    setIsBackingUp(true);
    setBackupProgress(0);

    const interval = setInterval(() => {
      setBackupProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 50);

  }, [isBackingUp]);

  useEffect(() => {
    if (backupProgress === 100) {
      setIsBackingUp(false);
      
      const success = Math.random() > 0.2; // 80% success rate
      const newLog: BackupLogEntry = {
        id: `log${Date.now()}`,
        date: new Date().toISOString(),
        status: success ? 'Completed' : 'Failed',
        details: success ? `Full backup of ${Math.floor(2000 + Math.random() * 500)} items.` : 'An unknown error occurred.',
      };

      setBackupLogs((prevLogs) => [newLog, ...prevLogs]);

      toast({
        title: success ? "Backup Complete" : "Backup Failed",
        description: success ? "Your data has been securely backed up." : "Please try again later.",
        variant: success ? "default" : "destructive",
      });
    }
  }, [backupProgress, toast]);

  const isConnected = !!user;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header user={user} onSignOut={handleSignOut} />
      <main className="flex-1 bg-background">
        <div className="container mx-auto grid max-w-5xl gap-8 px-4 py-8 md:px-6 md:py-12">
          <div className="grid gap-8 md:grid-cols-2">
            <ConnectDrive
              isConnected={isConnected}
              user={user}
              isLoading={isUserLoading}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />
            <BackupControls
              isConnected={isConnected}
              isBackingUp={isBackingUp}
              backupProgress={backupProgress}
              onBackupStart={handleBackupStart}
            />
          </div>
          <BackupLog logs={backupLogs} />
        </div>
      </main>
    </div>
  );
}
