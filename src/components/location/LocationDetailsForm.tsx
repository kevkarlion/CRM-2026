'use client';

interface LocationDetails {
  floor?: string;
  apartment?: string;
  tower?: string;
  office?: string;
  neighborhood?: string;
  block?: string;
  lot?: string;
  reference?: string;
  observations?: string;
}

interface LocationDetailsFormProps {
  details: LocationDetails;
  onChange: (details: LocationDetails) => void;
}

const FIELDS = [
  { key: 'floor', label: 'Piso', placeholder: 'Ej: 3' },
  { key: 'apartment', label: 'Departamento', placeholder: 'Ej: A' },
  { key: 'tower', label: 'Torre', placeholder: 'Ej: Torre 1' },
  { key: 'office', label: 'Oficina', placeholder: 'Ej: 305' },
  { key: 'neighborhood', label: 'Barrio', placeholder: 'Ej: Villa Crespo' },
  { key: 'block', label: 'Manzana', placeholder: 'Ej: M' },
  { key: 'lot', label: 'Lote', placeholder: 'Ej: 12' },
] as const;

export function LocationDetailsForm({ details, onChange }: LocationDetailsFormProps) {
  function handleChange(field: keyof LocationDetails, value: string) {
    onChange({
      ...details,
      [field]: value || undefined,
    });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {FIELDS.map(({ key, label, placeholder }) => (
        <div key={key} className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">{label}</label>
          <input
            type="text"
            value={details[key] || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={placeholder}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
          />
        </div>
      ))}
      <div className="flex flex-col col-span-2">
        <label className="text-xs text-gray-500 mb-1">Referencia</label>
        <input
          type="text"
          value={details.reference || ''}
          onChange={(e) => handleChange('reference', e.target.value)}
          placeholder="Ej: Cerca del supermercado, portón azul..."
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
        />
      </div>
      <div className="flex flex-col col-span-2">
        <label className="text-xs text-gray-500 mb-1">Observaciones</label>
        <input
          type="text"
          value={details.observations || ''}
          onChange={(e) => handleChange('observations', e.target.value)}
          placeholder="Notas adicionales..."
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
        />
      </div>
    </div>
  );
}
