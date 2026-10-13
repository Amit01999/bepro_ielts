import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Upload, Eye, Sparkles, Trash2, Loader2, ArrowRight, FileWarning } from "lucide-react";

const STATUS_STYLE = {
  uploaded: "bg-slate-100 text-slate-700",
  extracting: "bg-amber-100 text-amber-700",
  extracted: "bg-emerald-100 text-emerald-700",
  extraction_failed: "bg-red-100 text-red-700",
};

function fmtSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SourceDocuments() {
  const nav = useNavigate();
  const [items, setItems] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [extractingIds, setExtractingIds] = useState([]);
  const [toDelete, setToDelete] = useState(null);
  const fileRef = useRef(null);
  const pollRef = useRef(null);

  const load = () => api.get("/admin/source-documents").then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const hasActive = (items || []).some((d) => d.status === "extracting");
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(load, 3000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [items]);

  const pickFile = () => fileRef.current?.click();

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { toast.error("Please choose a PDF file."); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("File too large (max 20MB)."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post("/admin/source-documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("PDF uploaded");
      load();
    } catch (err) { toast.error(apiError(err)); }
    finally { setUploading(false); }
  };

  const preview = async (doc) => {
    try {
      const { data } = await api.get(`/admin/source-documents/${doc.id}/preview-url`);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) { toast.error(apiError(err)); }
  };

  const extract = async (doc) => {
    setExtractingIds((ids) => [...ids, doc.id]);
    try {
      await api.post(`/admin/source-documents/${doc.id}/extract`);
      toast.message("Extraction started — this can take a little while.");
      load();
    } catch (err) { toast.error(apiError(err)); }
    finally { setExtractingIds((ids) => ids.filter((x) => x !== doc.id)); }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    try {
      await api.delete(`/admin/source-documents/${toDelete.id}`);
      toast.success("Deleted");
      setToDelete(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div data-testid="admin-source-documents">
      <button onClick={() => nav("/admin/exams")} className="flex items-center gap-2 text-sm text-muted-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Back to exams</button>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display">Source documents</h1>
          <p className="text-muted-foreground mt-1">Upload a PDF question paper, then extract it into a draft exam to review in the Exam Builder.</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFileChosen} data-testid="pdf-file-input" />
          <Button className="bg-slate-900 text-white" onClick={pickFile} disabled={uploading} data-testid="upload-pdf-btn">
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {uploading ? "Uploading..." : "Upload PDF"}
          </Button>
        </div>
      </div>

      {!items ? <Loading /> : items.length === 0 ? (
        <div className="mt-8"><EmptyState title="No source documents yet" description="Upload a PDF question paper to get started." /></div>
      ) : (
        <div className="bg-card border rounded-xl mt-6 overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>File</TableHead><TableHead>Size</TableHead><TableHead>Status</TableHead><TableHead>Warnings</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id} data-testid={`source-doc-${d.id}`}>
                  <TableCell className="font-medium">{d.filename}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtSize(d.size_bytes)}</TableCell>
                  <TableCell><Badge className={STATUS_STYLE[d.status] || "bg-slate-100 text-slate-700"}>{d.status === "extracting" && <Loader2 className="h-3 w-3 mr-1 inline animate-spin" />}{d.status}</Badge></TableCell>
                  <TableCell>
                    {(d.extraction_warnings || []).length > 0 ? (
                      <span className="flex items-center gap-1 text-amber-700 text-xs" title={(d.extraction_warnings || []).join("\n")}>
                        <FileWarning className="h-3.5 w-3.5" /> {d.extraction_warnings.length}
                      </span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => preview(d)} data-testid={`preview-${d.id}`}><Eye className="h-3.5 w-3.5" /></Button>
                    {d.status === "extracted" && d.exam_id ? (
                      <Button size="sm" className="bg-[#059669] text-white" onClick={() => nav(`/admin/exams/${d.exam_id}/build`)} data-testid={`review-${d.id}`}>
                        Review draft <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => extract(d)} disabled={d.status === "extracting" || extractingIds.includes(d.id)} data-testid={`extract-${d.id}`}>
                        {d.status === "extracting" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                        {d.status === "extraction_failed" ? "Retry extract" : "Extract"}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(d)} data-testid={`delete-${d.id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent data-testid="delete-source-doc-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this source document?</AlertDialogTitle>
            <AlertDialogDescription>This removes the uploaded PDF permanently. Any draft exam already created from it is not deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-source-doc">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
