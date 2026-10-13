import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AuditLogs() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/audit-logs").then(({ data }) => setData(data)).catch(() => setData({ items: [] })); }, []);
  if (!data) return <Loading />;
  return (
    <div data-testid="admin-audit">
      <h1 className="text-2xl sm:text-3xl font-bold font-display">Audit Logs</h1>
      <p className="text-muted-foreground mt-1">Record of sensitive administrative actions.</p>
      {data.items.length === 0 ? <EmptyState title="No audit entries yet" /> : (
        <div className="bg-card border rounded-xl mt-6 overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Actor</TableHead><TableHead>Entity</TableHead><TableHead>Summary</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.items.map((a) => (
                <TableRow key={a.id} data-testid={`audit-${a.id}`}>
                  <TableCell className="font-medium">{a.action}</TableCell>
                  <TableCell>{a.actor_name}</TableCell>
                  <TableCell className="text-xs">{a.entity}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.summary}</TableCell>
                  <TableCell className="text-xs font-mono-nums">{a.timestamp?.slice(0, 16).replace("T", " ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
