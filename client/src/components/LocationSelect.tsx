import { cn } from '@/lib/utils';
import { useLocations } from '@/hooks/useLocations';

interface LocationSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export default function LocationSelect({
  value,
  onChange,
  className,
  id,
  allowEmpty,
  emptyLabel = 'Todos los lugares',
}: LocationSelectProps) {
  const { locations, isLoading } = useLocations();
  const known = locations.some((l) => l.code === value);

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary',
        className
      )}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {isLoading && <option value={value || ''}>Cargando lugares...</option>}
      {!known && value && <option value={value}>{value}</option>}
      {locations.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
