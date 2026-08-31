import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/core/db';

// Work Reports API - Returns all technical reports with client/technician info
// GET - Get all work reports
export async function GET(request: Request) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const mongooseConn = await connectDB();
    const db = mongooseConn.connection.db;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Match stage: empty match (or filter by search later)
    const matchStage: any = {};

    // Get all work reports with workOrderId or technicalVisitId
    const reports = await db.collection('workreports')
      .aggregate([
        { $match: matchStage },
        { $sort: { finishedAt: -1 } },
        { $skip: offset },
        { $limit: limit },
        // Get workOrder
        {
          $lookup: {
            from: 'workorders',
            localField: 'workOrderId',
            foreignField: '_id',
            as: 'workOrder'
          }
        },
        {
          $unwind: {
            path: '$workOrder',
            preserveNullAndEmptyArrays: true
          }
        },
        // Get technicalVisit
        {
          $lookup: {
            from: 'technicalvisits',
            localField: 'technicalVisitId',
            foreignField: '_id',
            as: 'technicalVisit'
          }
        },
        {
          $unwind: {
            path: '$technicalVisit',
            preserveNullAndEmptyArrays: true
          }
        },
        // Get client from workOrder
        {
          $lookup: {
            from: 'clients',
            localField: 'workOrder.clientId',
            foreignField: '_id',
            as: 'client'
          }
        },
        {
          $unwind: {
            path: '$client',
            preserveNullAndEmptyArrays: true
          }
        },
        // Get client from technicalVisit
        {
          $lookup: {
            from: 'clients',
            localField: 'technicalVisit.clientId',
            foreignField: '_id',
            as: 'clientFromVisit'
          }
        },
        {
          $addFields: {
            finalClient: {
              $cond: {
                if: { $and: [{ $eq: ['$client', null] }, { $gt: [{ $size: '$clientFromVisit' }, 0] }] },
                then: { $arrayElemAt: ['$clientFromVisit', 0] },
                else: '$client'
              }
            }
          }
        },
        // Get lead from workOrder
        {
          $lookup: {
            from: 'leads',
            localField: 'workOrder.leadId',
            foreignField: '_id',
            as: 'lead'
          }
        },
        {
          $unwind: {
            path: '$lead',
            preserveNullAndEmptyArrays: true
          }
        },
        // Get lead from technicalVisit
        {
          $lookup: {
            from: 'leads',
            localField: 'technicalVisit.leadId',
            foreignField: '_id',
            as: 'leadFromVisit'
          }
        },
        {
          $unwind: {
            path: '$leadFromVisit',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $addFields: {
            finalLead: {
              $cond: {
                if: { $and: [{ $eq: ['$lead', null] }, { $gt: [{ $size: '$leadFromVisit' }, 0] }] },
                then: { $arrayElemAt: ['$leadFromVisit', 0] },
                else: '$lead'
              }
            }
          }
        },
        {
          $project: {
            _id: 1,
            result: 1,
            workPerformed: 1,
            workPerformedOther: 1,
            hasObservations: 1,
            observationsText: 1,
            hasAdditionalIssues: 1,
            additionalIssues: 1,
            additionalIssuesText: 1,
            nextVisitRecommendation: 1,
            startedAt: 1,
            finishedAt: 1,
            createdAt: 1,
            workOrderId: 1,
            technicalVisitId: 1,
            technicianId: 1,
            viewedAt: 1,
            workOrderNumber: '$workOrder.workOrderNumber',
            visitNumber: '$technicalVisit.visitNumber',
            clientName: {
              $cond: {
                if: '$finalClient',
                then: { $ifNull: ['$finalClient.fullName', '$finalClient.companyName'] },
                else: null
              }
            },
            clientPhone: '$finalClient.phone',
            leadName: { $ifNull: ['$finalLead.profileName', '$finalLead.name', '$finalLead.companyName'] },
            leadPhone: '$finalLead.phone',
            entityType: {
              $cond: {
                if: '$workOrderId',
                then: 'OT',
                else: {
                  $cond: {
                    if: '$technicalVisitId',
                    then: 'VT',
                    else: null
                  }
                }
              }
            }
          }
        }
      ])
      .toArray();

    // Get unique technician IDs
    const techIdsRaw = reports.map((r: any) => r.technicianId).filter(Boolean);
    const techIdsObjId = techIdsRaw.map((id: any) => {
      try {
        return new mongoose.Types.ObjectId(String(id));
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    // Fetch all technicians from the technicians collection
    const technicians: Record<string, any> = {};
    if (techIdsObjId && techIdsObjId.length > 0) {
      const techDocs = await db.collection('technicians')
        .find({ _id: { $in: techIdsObjId } })
        .toArray();
      techDocs.forEach((tech: any) => {
        technicians[String(tech._id)] = tech;
      });
    }

    // Calculate duration and add technician name in JavaScript
    const reportsWithDuration = reports.map((r: any) => {
      let durationMinutes: number | undefined;
      if (r.startedAt && r.finishedAt) {
        const started = new Date(r.startedAt).getTime();
        const finished = new Date(r.finishedAt).getTime();
        durationMinutes = Math.round((finished - started) / 60000);
      }
      
      // Build technician name (handle different field names across collections)
      const tech = r.technicianId ? technicians[String(r.technicianId)] : null;
      let technicianName = '';
      if (tech) {
        if (tech.firstName && tech.lastName) {
          technicianName = `${tech.firstName} ${tech.lastName}`.trim();
        } else if (tech.name) {
          technicianName = tech.name;
        } else if (tech.fullName) {
          technicianName = tech.fullName;
        } else {
          technicianName = tech.email || String(r.technicianId);
        }
      }
      const technicianEmail = tech?.email || '';
      
      // Un informe es "nuevo" mientras nadie lo haya visto (viewedAt null).
      return { ...r, durationMinutes, technicianName, technicianEmail, isNew: !r.viewedAt };
    });

    // Get total count
    const total = await db.collection('workreports').countDocuments(matchStage);

    // Search filter (client name, lead name, work order number)
    let filteredReports = reportsWithDuration;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredReports = reportsWithDuration.filter((r: any) =>
        (r.clientName && r.clientName.toLowerCase().includes(searchLower)) ||
        (r.leadName && r.leadName.toLowerCase().includes(searchLower)) ||
        (r.workOrderNumber && r.workOrderNumber.toLowerCase().includes(searchLower)) ||
        (r.visitNumber && r.visitNumber.toLowerCase().includes(searchLower)) ||
        (r.technicianName && r.technicianName.toLowerCase().includes(searchLower)) ||
        (r.result && r.result.toLowerCase().includes(searchLower))
      );
    }

    return NextResponse.json({
      data: filteredReports,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('[WorkReports GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}