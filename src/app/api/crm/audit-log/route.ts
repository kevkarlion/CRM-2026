import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ActivityLogModel from '@/core/models/activity-log';
import { errorMessage } from '@/core/error-message';

/**
 * Metadata keys that store a user ObjectId ("who did it"). Values for these
 * keys are resolved to user names in the API response so the audit UI shows
 * readable names instead of raw 24-hex IDs.
 */
const METADATA_USER_KEYS = [
  'sentBy',
  'approvedBy',
  'rejectedBy',
  'wonBy',
  'convertedBy',
  'createdBy',
  'updatedBy',
  'deletedBy',
  'blockedBy',
  'unblockedBy',
  'assignedBy',
  'unassignedBy',
  'resolvedBy',
];

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    let search = searchParams.get('search') || undefined;
    if (search) search = search.slice(0, 100);
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    // Build query
    const query: Record<string, unknown> = { tenantId };

    if (action) {
      query.action = action;
    }

    if (entityType) {
      // Handler-driven rows store the aggregateType casing ('Quote', 'Lead', ...)
      // while the UI filters with lowercase values; match both.
      const capitalized = entityType.charAt(0).toUpperCase() + entityType.slice(1);
      query.entityType = { $in: [entityType, capitalized] };
    }

    if (dateFrom || dateTo) {
      const tsQuery: Record<string, Date> = {};
      if (dateFrom) tsQuery.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        tsQuery.$lte = endDate;
      }
      query.timestamp = tsQuery;
    }

    if (search) {
      // Search across: actor name/email, entityType, and entity names (Lead/Client/Gestion/Quote/WorkOrder)
      // Escape regex metacharacters so user input can't 500 or trigger ReDoS
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = { $regex: escaped, $options: 'i' } as const;

      const UserModel = (await import('@/core/models/user')).default;
      const LeadModel = (await import('@/leads/models/lead')).default;
      const ClientModel = (await import('@/crm/models/client')).default;
      const GestionModel = (await import('@/gestion/models/gestion')).default;
      const QuoteModel = (await import('@/quotes/models/quote')).default;
      const WorkOrderModel = (await import('@/operations/models/work-order')).default;

      // Parallel lookups for matching IDs across collections
      const [matchingUsers, matchingLeads, matchingClients, matchingGestions, matchingQuotes, matchingWorkOrders] = await Promise.all([
        UserModel.find({
          tenantId,
          $or: [
            { firstName: regex },
            { lastName: regex },
            { email: regex },
          ],
        }).select('_id').limit(50).lean(),
        LeadModel.find({
          tenantId,
          name: regex,
        }).select('_id').limit(50).lean(),
        ClientModel.find({
          tenantId,
          $or: [
            { fullName: regex },
            { companyName: regex },
            { profileName: regex },
          ],
        }).select('_id').limit(50).lean(),
        GestionModel.find({
          tenantId,
          $or: [
            { name: regex },
            { companyName: regex },
          ],
        }).select('_id').limit(50).lean(),
        QuoteModel.find({
          tenantId,
          $or: [
            { number: regex },
            { title: regex },
          ],
        }).select('_id').limit(50).lean(),
        WorkOrderModel.find({
          tenantId,
          $or: [
            { workOrderNumber: regex },
            { title: regex },
          ],
        }).select('_id').limit(50).lean(),
      ]);

      const userIds = matchingUsers.map((u: { _id: unknown }) => u._id);
      const leadIds = matchingLeads.map((l: { _id: unknown }) => l._id);
      const clientIds = matchingClients.map((c: { _id: unknown }) => c._id);
      const gestionIds = matchingGestions.map((g: { _id: unknown }) => g._id);
      const quoteIds = matchingQuotes.map((q: { _id: unknown }) => q._id);
      const workOrderIds = matchingWorkOrders.map((w: { _id: unknown }) => w._id);

      // Metadata keys that hold snapshot/historical names — the live entity may no longer match
      const metadataRegex = [
        'name',
        'profileName',
        'companyName',
        'phone',
        'email',
        'number',
        'workOrderNumber',
        'title',
        'clientName',
        'leadName',
        'technicianName',
        'reason',
        'workOrderTitle',
        'category',
        'priority',
      ].map((key) => ({ [`metadata.${key}`]: regex }));

      query.$or = [
        { actorId: { $in: userIds } },
        { entityType: regex },
        { entityType: { $in: ['lead', 'Lead'] }, entityId: { $in: leadIds } },
        { entityType: { $in: ['client', 'Client'] }, entityId: { $in: clientIds } },
        { entityType: { $in: ['gestion', 'Gestion'] }, entityId: { $in: gestionIds } },
        { entityType: { $in: ['quote', 'Quote'] }, entityId: { $in: quoteIds } },
        { entityType: { $in: ['workOrder', 'WorkOrder'] }, entityId: { $in: workOrderIds } },
        // El nombre histórico vive en metadata (snapshot en el momento del log)
        ...metadataRegex,
      ];
    }

    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      ActivityLogModel.find(query)
        .populate('actorId', 'firstName lastName email')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      ActivityLogModel.countDocuments(query),
    ]);

    // Transform populated actorId into flat fields
    const entries = data.map((doc) => {
      const actor = doc.actorId as unknown as { firstName?: string; lastName?: string; email?: string; _id?: { toString(): string } };
      return {
        _id: doc._id?.toString() ?? '',
        tenantId: doc.tenantId?.toString() ?? '',
        entityType: doc.entityType,
        entityId: doc.entityId?.toString() ?? '',
        action: doc.action,
        actorId: actor?._id?.toString() ?? '',
        actorName: actor ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() : undefined,
        actorEmail: actor?.email,
        changes: doc.changes,
        metadata: doc.metadata,
        timestamp: doc.timestamp?.toISOString() ?? '',
      };
    });

    // Resolve user ObjectIds embedded in metadata ("sentBy", "approvedBy", ...)
    // so the audit UI shows names instead of raw IDs.
    const userIdsInMetadata = entries.flatMap((e) =>
      Object.entries((e.metadata as Record<string, unknown>) || {})
        .filter(([key]) => METADATA_USER_KEYS.includes(key))
        .map(([, value]) => (typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value) ? value : ''))
        .filter(Boolean),
    );
    const uniqueIds = Array.from(new Set(userIdsInMetadata));
    let userMap: Record<string, string> = {};
    if (uniqueIds.length > 0) {
      const UserModel = (await import('@/core/models/user')).default;
      const users = await UserModel.find({ _id: { $in: uniqueIds } })
        .select('firstName lastName email')
        .lean();
      userMap = Object.fromEntries(
        users.map((u: { _id: unknown; firstName?: string; lastName?: string; email?: string }) => [
          String(u._id),
          `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || String(u._id),
        ]),
      );
    }
    for (const e of entries) {
      if (!e.metadata) continue;
      for (const [key, value] of Object.entries(e.metadata as Record<string, unknown>)) {
        if (METADATA_USER_KEYS.includes(key) && typeof value === 'string' && userMap[value]) {
          (e.metadata as Record<string, unknown>)[key] = userMap[value];
        }
      }
    }

    return NextResponse.json({
      data: entries,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 },
    );
  }
}
