export const WORK_ORDER_STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-teal-50 text-teal-700',
  assigned: 'bg-indigo-50 text-indigo-700',
  en_route: 'bg-purple-50 text-purple-700',
  on_site: 'bg-orange-50 text-orange-700',
  paused: 'bg-yellow-50 text-yellow-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  closed: 'bg-slate-50 text-slate-700',
};

export const WORK_ORDER_PRIORITY_VARIANT: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
  emergency: 'bg-red-100 text-red-900',
};

export const TECHNICAL_VISIT_STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-teal-50 text-teal-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  converted_to_work_order: 'bg-purple-50 text-purple-700',
};

export const TECHNICAL_VISIT_PRIORITY_VARIANT: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
};

export const TECHNICAL_VISIT_CATEGORY_VARIANT: Record<string, string> = {
  budget: 'bg-yellow-50 text-yellow-700',
  inspection: 'bg-blue-50 text-blue-700',
  assessment: 'bg-indigo-50 text-indigo-700',
  emergency: 'bg-red-50 text-red-700',
  other: 'bg-gray-50 text-gray-700',
};

export const LEAD_STATUS_VARIANT: Record<string, string> = {
  new: 'bg-info-50 text-info-700',
  contacted: 'bg-brand-50 text-brand-700',
  qualified: 'bg-warning-50 text-warning-700',
  won: 'bg-success-50 text-success-700',
  lost: 'bg-danger-50 text-danger-700',
  disqualified: 'bg-gray-100 text-gray-700',
};

export const CONTRACT_STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-success-50 text-success-700',
  paused: 'bg-warning-50 text-warning-700',
  expired: 'bg-orange-50 text-orange-700',
  cancelled: 'bg-danger-50 text-danger-700',
};
