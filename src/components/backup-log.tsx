import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, History } from 'lucide-react';

export interface BackupLogEntry {
  id: string;
  date: string;
  status: 'Completed' | 'Failed';
  details: string;
}

interface BackupLogProps {
  logs: BackupLogEntry[];
}

const StatusIcon = ({ status }: { status: BackupLogEntry['status'] }) => {
  if (status === 'Completed') {
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  }
  return <XCircle className="h-4 w-4" />;
}

export function BackupLog({ logs }: BackupLogProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <History className="h-6 w-6" />
            Backup Activity Log
        </CardTitle>
        <CardDescription>A history of your recent data backups.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Date</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {new Date(log.date).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'Completed' ? 'secondary' : 'destructive'}>
                        <StatusIcon status={log.status} />
                        <span className="ml-1.5">{log.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>{log.details}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    No backup activities yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
