import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import { NotificationModel } from '@/operations/models/notification';

/**
 * GET /api/notifications
 * 
 * Returns pending notifications for the tenant.
 * Supports polling for fallback when SSE is not available.
 * 
 * Query params:
 * - limit: max notifications to return (default: 20)
 * - unreadOnly: only return unread (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const tenantId = request.headers.get('x-tenant-id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unreadOnly') !== 'false';
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }
    
    const query: Record<string, unknown> = {
      tenantId: new (await import('mongoose')).Types.ObjectId(tenantId),
      expiresAt: { $gt: new Date() },
    };
    
    if (unreadOnly) {
      query.readAt = null;
    }
    
    const notifications = await NotificationModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    const unreadCount = await NotificationModel.countDocuments({
      tenantId: new (await import('mongoose')).Types.ObjectId(tenantId),
      readAt: null,
      expiresAt: { $gt: new Date() },
    });
    
    return NextResponse.json({
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * 
 * Mark notifications as read.
 * 
 * Body:
 * - notificationIds: string[] of IDs to mark as read
 * - markAllRead: boolean to mark all as read
 */
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }
    
    const body = await request.json() as {
      notificationIds?: string[];
      markAllRead?: boolean;
    };
    
    const mongoose = await import('mongoose');
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    
    let result;
    
    if (body.markAllRead) {
      // Mark all as read
      result = await NotificationModel.updateMany(
        { tenantId: tenantObjectId, readAt: null },
        { $set: { readAt: new Date() } }
      );
    } else if (body.notificationIds && body.notificationIds.length > 0) {
      // Mark specific ones as read
      const objectIds = body.notificationIds.map(id => new mongoose.Types.ObjectId(id));
      result = await NotificationModel.updateMany(
        { _id: { $in: objectIds }, tenantId: tenantObjectId },
        { $set: { readAt: new Date() } }
      );
    } else {
      return NextResponse.json({ error: 'notificationIds or markAllRead required' }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true, 
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
