export interface GetLeadParams {
  tenantId: string;
  id?: string;
  phone?: string;
  email?: string;
}

export interface GetClientParams {
  tenantId: string;
  id?: string;
  phone?: string;
  taxId?: string;
}

export interface GetWorkOrderParams {
  tenantId: string;
  id?: string;
  workOrderNumber?: string;
  clientId?: string;
}

export interface LeadLookups {
  id?: string;
  phone?: string;
  email?: string;
}

export interface ClientLookups {
  id?: string;
  phone?: string;
  taxId?: string;
}

export interface WorkOrderLookups {
  id?: string;
  workOrderNumber?: string;
  clientId?: string;
}

export interface ToolResponse {
  content: [{ type: 'text'; text: string }];
}