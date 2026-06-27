import { IPipelineStage } from '../../types/pipeline';
import { LeadStatus, ILead } from '../../types/lead';
import { canTransition } from '../../helpers/lead-state-machine';

export function getTargetStatus(stage: IPipelineStage): LeadStatus | undefined {
  return stage.mapsToStatus;
}

export function isValidDropTarget(lead: ILead, targetStage: IPipelineStage): boolean {
  if (!targetStage.mapsToStatus) return false;
  return canTransition(lead.status as LeadStatus, targetStage.mapsToStatus);
}
