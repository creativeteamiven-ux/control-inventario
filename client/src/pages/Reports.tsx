import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileBarChart, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function Reports() {
  const [downloading, setDownloading] = useState(false);

  const downloadInventoryPdf = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/api/reports/inventory/pdf', { responseType: 'blob' });
      const blob = res.data as Blob;
      if (blob.type?.includes('application/json')) {
        const text = await blob.text();
        const json = JSON.parse(text);
        throw new Error(json.error || json.message || 'Error del servidor');
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventario-soundvault.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF descargado');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al descargar el PDF';
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Reportes</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-6 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-primary/20">
              <FileBarChart className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display font-semibold">Inventario completo</h2>
          </div>
          <p className="text-sm text-muted mb-4">Exporta el inventario completo en PDF con logo y fecha de generación.</p>
          <Button onClick={downloadInventoryPdf} disabled={downloading}>
            <Download className="h-4 w-4 mr-2" />
            Descargar PDF
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
