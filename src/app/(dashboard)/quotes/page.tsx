import CentroOperativoContent from '@/components/quotes/centro-operativo-content';

export default async function CentroOperativoPage(props: {
  searchParams: Promise<{
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    client?: string;
    assigned?: string;
  }>;
}) {
  const params = await props.searchParams;

  return (
    <CentroOperativoContent
      initialFilters={{
        status: params.status?.split(',').filter(Boolean) || [],
        dateFrom: params.dateFrom || '',
        dateTo: params.dateTo || '',
        client: params.client || '',
        assignedTo: params.assigned || '',
      }}
    />
  );
}
