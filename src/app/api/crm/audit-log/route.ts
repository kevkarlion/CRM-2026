import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ActivityLogModel from '@/core/models/activity-log';
import { errorMessage } from '@/core/error-message';

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
    const search = searchParams.get('search') || undefined;
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
      query.entityType = entityType;
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
      // Search across: actor name/email, entityType, and entity names (Lead/Client)
      const regex = { $regex: search, $options: 'i' } as const;

      const UserModel = (await import('@/core/models/user')).default;
      const LeadModel = (await import('@/leads/models/lead')).default;
      const ClientModel = (await import('@/crm/models/client')).default;

      // Parallel lookups for matching IDs across collections
      const [matchingUsers, matchingLeads, matchingClients] = await Promise.all([
        UserModel.find({
          tenantId,
          $or: [
            { firstName: regex },
            { lastName: regex },
            { email: regex },
          ],
        }).select('_id').lean(),
        LeadModel.find({
          tenantId,
          name: regex,
        }).select('_id').lean(),
        ClientModel.find({
          tenantId,
          $or: [
            { fullName: regex },
            { companyName: regex },
            { profileName: regex },
          ],
        }).select('_id').lean(),
      ]);

      const userIds = matchingUsers.map((u: { _id: unknown }) => u._id);
      const leadIds = matchingLeads.map((l: { _id: unknown }) => l._id);
      const clientIds = matchingClients.map((c: { _id: unknown }) => c._id);

      query.$or = [
        { actorId: { $in: userIds } },
        { entityType: regex },
        { entityType: { $in: ['lead', 'Lead'] }, entityId: { $in: leadIds } },
        { entityType: { $in: ['client', 'Client'] }, entityId: { $in: clientIds } },
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
