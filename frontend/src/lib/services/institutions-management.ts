/**
 * Institution Management Service
 *
 * Manages institutions and their RAG file configuration in the system.
 */

import { db } from '@/lib/db'
import { institutions, users, ragFiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { initializeDefaultRoles } from '@/lib/services/role-management'

export interface InstitutionSeedData {
  name: string
  slug: string
  description: string
  logoUrl?: string
  contactInfo: {
    phone?: string
    email?: string
    address?: string
    website?: string
  }
  ragFiles: {
    fileName: string
    filePath: string
    description: string
  }[]
}

// Default Dukcapil institution configuration
export const DEFAULT_DUKCAPIL_INSTITUTION: InstitutionSeedData = {
  name: 'Dinas Kependudukan dan Pencatatan Sipil (Dukcapil)',
  slug: 'dukcapil',
  description: 'Layanan administrasi kependudukan dan pencatatan sipil untuk masyarakat',
  logoUrl: undefined,
  contactInfo: {
    phone: '(0274) 555-0123',
    email: 'info@dukcapil.yogyakarta.go.id',
    address: 'Jl. Malioboro No. 123, Yogyakarta',
    website: 'https://dukcapil.yogyakarta.go.id',
  },
  ragFiles: [
    {
      fileName: 'buku-saku-dukcapil-yogya.txt',
      filePath: 'documents/buku-saku-dukcapil-yogya.txt',
      description: 'Buku saku panduan layanan Dukcapil Yogyakarta',
    },
  ],
}

export async function seedDefaultInstitutions(): Promise<void> {
  try {
    console.log('🚀 Starting institution seeding process...')

    // Ensure roles exist first
    await initializeDefaultRoles()

    // Check if Dukcapil institution already exists
    const existingDukcapil = await db
      .select()
      .from(institutions)
      .where(eq(institutions.slug, DEFAULT_DUKCAPIL_INSTITUTION.slug))
      .limit(1)

    if (existingDukcapil.length > 0) {
      console.log(`✅ Dukcapil institution already exists (ID: ${existingDukcapil[0].institutionId})`)
      return
    }

    console.log('📝 No Dukcapil institution found. Creating default institution...')

    // Create a system admin user to be the creator (if doesn't exist)
    let systemUserId: number

    // Try to find an existing superadmin user
    const existingSuperAdmin = await db.select({ userId: users.userId }).from(users).where(eq(users.roleId, 1)).limit(1)

    if (existingSuperAdmin.length > 0) {
      systemUserId = existingSuperAdmin[0].userId
      console.log(`📋 Using existing superadmin user (ID: ${systemUserId}) as creator`)
    } else {
      // Create a system user for seeding purposes
      const systemUser = {
        supabaseUserId: crypto.randomUUID(),
        email: 'system@tunarasa.local',
        firstName: 'System',
        lastName: 'Administrator',
        fullName: 'System Administrator',
        roleId: 1, // superadmin
        isActive: true,
        emailVerified: true,
      }

      const [createdUser] = await db.insert(users).values(systemUser).returning({ userId: users.userId })

      systemUserId = createdUser.userId
      console.log(`👤 Created system admin user (ID: ${systemUserId}) for seeding`)
    }

    // Insert the Dukcapil institution
    const [newInstitution] = await db
      .insert(institutions)
      .values({
        name: DEFAULT_DUKCAPIL_INSTITUTION.name,
        slug: DEFAULT_DUKCAPIL_INSTITUTION.slug,
        description: DEFAULT_DUKCAPIL_INSTITUTION.description,
        logoUrl: DEFAULT_DUKCAPIL_INSTITUTION.logoUrl,
        contactInfo: DEFAULT_DUKCAPIL_INSTITUTION.contactInfo,
        isActive: true,
        createdBy: systemUserId,
      })
      .returning()

    console.log(`✅ Created Dukcapil institution (ID: ${newInstitution.institutionId})`)

    // Insert RAG files for the institution
    for (const ragFileData of DEFAULT_DUKCAPIL_INSTITUTION.ragFiles) {
      const [ragFile] = await db
        .insert(ragFiles)
        .values({
          institutionId: newInstitution.institutionId,
          fileName: ragFileData.fileName,
          fileType: ragFileData.fileName.endsWith('.pdf') ? 'pdf' : 'txt',
          filePath: ragFileData.filePath,
          description: ragFileData.description,
          processingStatus: 'completed', // Assume document is ready
          pineconeNamespace: `dukcapil-${newInstitution.institutionId}`,
          isActive: true,
          createdBy: systemUserId,
        })
        .returning()

      console.log(`📄 Created RAG file: ${ragFile.fileName} (ID: ${ragFile.ragFileId})`)
    }

    // Verify the setup
    const verification = await db
      .select({
        institution: institutions.name,
        ragFilesCount: db.$count(ragFiles, eq(ragFiles.institutionId, newInstitution.institutionId)),
      })
      .from(institutions)
      .where(eq(institutions.institutionId, newInstitution.institutionId))

    console.log('🔍 Verification:')
    console.log(`   - Institution: ${verification[0]?.institution}`)
    console.log(`   - RAG files: ${DEFAULT_DUKCAPIL_INSTITUTION.ragFiles.length} configured`)
    console.log('✅ Dukcapil institution setup completed successfully!')
  } catch (error) {
    console.error('❌ Error seeding institutions:', error)

    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        console.log('ℹ️  Institution may have been created already.')
      } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('⚠️  Database tables do not exist. Please run migrations first.')
      } else {
        console.log(`⚠️  Database error: ${error.message}`)
      }
    }

    throw error
  }
}

// Standalone function for direct execution
export async function runInstitutionSeeding(): Promise<boolean> {
  try {
    await seedDefaultInstitutions()
    return true
  } catch (error) {
    console.error('Failed to seed institutions:', error)
    return false
  }
}

// Utility function to get the default Dukcapil institution
export async function getDefaultDukcapilInstitution() {
  try {
    const institution = await db
      .select()
      .from(institutions)
      .where(eq(institutions.slug, DEFAULT_DUKCAPIL_INSTITUTION.slug))
      .limit(1)

    return institution.length > 0 ? institution[0] : null
  } catch (error) {
    console.error('Error fetching default Dukcapil institution:', error)
    return null
  }
}

// Export for reference
export const DUKCAPIL_INSTITUTION_CONFIG = {
  SLUG: 'dukcapil',
  NAME: 'Dinas Kependudukan dan Pencatatan Sipil (Dukcapil)',
  DEFAULT_DOCUMENT_PATH: 'documents/buku-saku-dukcapil-yogya.txt',
} as const
