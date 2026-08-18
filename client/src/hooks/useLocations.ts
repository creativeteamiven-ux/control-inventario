import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { deviceLocationLabel } from '@/lib/statusLabels';

export interface LocationItem {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

export function useLocations() {
  const query = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data } = await api.get<LocationItem[]>('/api/locations');
      return data;
    },
  });
  const locations = query.data ?? [];
  const label = (code?: string | null) => {
    if (!code) return '—';
    return locations.find((l) => l.code === code)?.name ?? deviceLocationLabel(code);
  };
  return { ...query, locations, label };
}
