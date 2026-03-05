import { motion } from 'framer-motion';
import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Configuración</h1>
      <div className="bg-card rounded-xl border border-border p-12 text-center text-muted">
        <SettingsIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Configuración de la organización, alertas, SMTP y ubicaciones.</p>
      </div>
    </motion.div>
  );
}
