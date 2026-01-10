import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, LogOut, Loader2 } from 'lucide-react';
import type { User } from 'firebase/auth';

interface ConnectDriveProps {
  isConnected: boolean;
  user: User | null;
  isLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const GoogleDriveIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 28">
        <path fill="#4285F4" d="M21.102 28H10.898L0 9.333l5.449-9.333h10.204l5.449 9.333z"/>
        <path fill="#34A853" d="M32 9.333L21.102 28h-5.449L26.551 0h5.449z"/>
        <path fill="#FFC107" d="M5.449 0L0 9.333l5.449 9.334L10.898 0z"/>
    </svg>
);

export function ConnectDrive({ isConnected, user, isLoading, onSignIn, onSignOut }: ConnectDriveProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isConnected && <CheckCircle className="h-6 w-6 text-success" />}
          Google Drive Connection
        </CardTitle>
        <CardDescription>
          {isConnected ? 'Your account is connected and ready for backups.' : 'Connect your Google Drive account to get started.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center items-center gap-4 text-center">
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : isConnected && user ? (
          <>
            <p className="font-medium text-lg">{user.email}</p>
            <p className="text-sm text-muted-foreground">Ready to back up to your Drive.</p>
            <Button variant="outline" className="mt-4" onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Disconnect
            </Button>
          </>
        ) : (
          <Button size="lg" onClick={onSignIn}>
             <GoogleDriveIcon className="mr-2 h-5 w-5" /> Connect to Google Drive
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
