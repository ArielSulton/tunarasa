import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireSuperAdmin } from '@/lib/auth/supabase-auth'
import { db } from '@/lib/db'
import { appSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Service Configuration API
 *
 * Manages global service mode settings:
 * - full_llm_bot: Direct LLM responses (default)
 * - human_cs_support: Route to admin queue for human CS support
 */

const SERVICE_MODE_KEY = 'service_mode'

export async function GET() {
  try {
    // Get current service mode setting
    const setting = await db.select().from(appSettings).where(eq(appSettings.settingKey, SERVICE_MODE_KEY)).limit(1)

    const serviceMode = setting.length > 0 ? setting[0].settingValue : 'full_llm_bot'

    return NextResponse.json({
      success: true,
      serviceMode,
      description:
        serviceMode === 'full_llm_bot'
          ? 'Users receive direct LLM responses'
          : 'Users are routed to human customer support queue',
    })
  } catch (error) {
    console.error('Error fetching service configuration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication and authorization - require admin access
    const authUser = await requireAdmin()

    const body = await req.json()
    const { serviceMode } = body

    // Validate service mode
    if (!serviceMode || !['full_llm_bot', 'human_cs_support'].includes(serviceMode)) {
      return NextResponse.json(
        {
          error: 'Invalid service mode. Must be "full_llm_bot" or "human_cs_support"',
        },
        { status: 400 },
      )
    }

    // Update or insert service mode setting
    const existingSetting = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.settingKey, SERVICE_MODE_KEY))
      .limit(1)

    if (existingSetting.length > 0) {
      // Update existing setting
      await db
        .update(appSettings)
        .set({
          settingValue: serviceMode,
          updatedBy: authUser.userId,
          updatedAt: new Date(),
        })
        .where(eq(appSettings.settingKey, SERVICE_MODE_KEY))
    } else {
      // Insert new setting
      await db.insert(appSettings).values({
        settingKey: SERVICE_MODE_KEY,
        settingValue: serviceMode,
        settingType: 'string',
        description: 'Global service mode for chat system',
        isPublic: true, // Can be read by non-admin users
        updatedBy: authUser.userId,
      })
    }

    const modeDescription =
      serviceMode === 'full_llm_bot'
        ? 'Users will receive direct LLM responses'
        : 'Users will be routed to human customer support queue'

    return NextResponse.json({
      success: true,
      message: 'Service mode updated successfully',
      serviceMode,
      description: modeDescription,
      updatedBy: authUser.email ?? authUser.fullName ?? authUser.supabaseUserId,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating service configuration:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Initialize default service mode setting
 */
export async function PUT() {
  try {
    // Check authentication and authorization - require super admin
    const authUser = await requireSuperAdmin()

    // Check if service mode setting already exists
    const existingSetting = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.settingKey, SERVICE_MODE_KEY))
      .limit(1)

    if (existingSetting.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Service mode setting already exists',
        serviceMode: existingSetting[0].settingValue,
        alreadyExists: true,
      })
    }

    // Initialize default service mode
    await db.insert(appSettings).values({
      settingKey: SERVICE_MODE_KEY,
      settingValue: 'full_llm_bot',
      settingType: 'string',
      description: 'Global service mode for chat system',
      isPublic: true,
      updatedBy: authUser.userId,
    })

    return NextResponse.json({
      success: true,
      message: 'Service mode initialized successfully',
      serviceMode: 'full_llm_bot',
      description: 'Users will receive direct LLM responses (default mode)',
    })
  } catch (error) {
    console.error('Error initializing service configuration:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
