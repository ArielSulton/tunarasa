import { pgTable, text, timestamp, integer, boolean, varchar, serial, index, jsonb, uuid } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// Roles Table with enhanced admin role support
export const roles = pgTable(
  'roles',
  {
    roleId: serial('role_id').primaryKey(),
    roleName: varchar('role_name', { length: 50 }).notNull().unique(),
    description: text('description'),
    permissions: jsonb('permissions').$type<string[]>().default([]),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('roles_role_name_idx').on(table.roleName), index('roles_is_active_idx').on(table.isActive)],
).enableRLS()

// Enhanced Users Table with Supabase Auth integration
export const users = pgTable(
  'users',
  {
    userId: serial('user_id').primaryKey(),
    supabaseUserId: uuid('supabase_user_id').notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    fullName: varchar('full_name', { length: 255 }),
    imageUrl: text('image_url'),
    roleId: integer('role_id')
      .references(() => roles.roleId)
      .default(3), // Default to regular user role
    isActive: boolean('is_active').notNull().default(true),
    lastSignInAt: timestamp('last_sign_in_at'),
    emailVerified: boolean('email_verified').notNull().default(false),
    // Supabase user metadata
    userMetadata: jsonb('user_metadata'),
    // Admin invitation tracking
    invitedBy: integer('invited_by'),
    invitedAt: timestamp('invited_at'),
    invitationAcceptedAt: timestamp('invitation_accepted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('users_supabase_user_id_idx').on(table.supabaseUserId),
    index('users_email_idx').on(table.email),
    index('users_role_id_idx').on(table.roleId),
    index('users_is_active_idx').on(table.isActive),
    index('users_created_at_idx').on(table.createdAt),
    index('users_invited_by_idx').on(table.invitedBy),
  ],
).enableRLS()

// Admin Invitations Table
export const adminInvitations = pgTable(
  'admin_invitations',
  {
    invitationId: uuid('invitation_id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(), // 'admin' or 'superadmin'
    invitedBy: integer('invited_by')
      .notNull()
      .references(() => users.userId),
    customMessage: text('custom_message'),
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, accepted, expired, cancelled
    token: varchar('token', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    cancelledAt: timestamp('cancelled_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('admin_invitations_email_idx').on(table.email),
    index('admin_invitations_status_idx').on(table.status),
    index('admin_invitations_token_idx').on(table.token),
    index('admin_invitations_expires_at_idx').on(table.expiresAt),
    index('admin_invitations_invited_by_idx').on(table.invitedBy),
  ],
).enableRLS()

// User Sync Log Table for tracking Supabase Auth synchronization
export const userSyncLog = pgTable(
  'user_sync_log',
  {
    syncId: serial('sync_id').primaryKey(),
    supabaseUserId: uuid('supabase_user_id').notNull(),
    eventType: varchar('event_type', { length: 50 }).notNull(), // auth.user.created, auth.user.updated, auth.user.deleted
    syncStatus: varchar('sync_status', { length: 20 }).notNull().default('success'), // success, failed, retry
    errorMessage: text('error_message'),
    supabasePayload: jsonb('supabase_payload'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('user_sync_log_supabase_user_id_idx').on(table.supabaseUserId),
    index('user_sync_log_event_type_idx').on(table.eventType),
    index('user_sync_log_sync_status_idx').on(table.syncStatus),
    index('user_sync_log_created_at_idx').on(table.createdAt),
  ],
).enableRLS()

// Conversations Table - Enhanced for dual-mode service with anonymous users
export const conversations = pgTable(
  'conversations',
  {
    conversationId: serial('conversation_id').primaryKey(),
    isActive: boolean('is_active').notNull().default(true),
    // Anonymous user session tracking (no foreign key to users table)
    sessionId: varchar('session_id', { length: 255 }).notNull(),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
    // Service mode: 'full_llm_bot' or 'bot_with_admin_validation'
    serviceMode: varchar('service_mode', { length: 50 }).notNull().default('full_llm_bot'),
    // Institution context for RAG system
    institutionId: integer('institution_id').references(() => institutions.institutionId),
    // For human CS support mode
    assignedAdminId: integer('assigned_admin_id').references(() => users.userId),
    status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'waiting', 'in_progress', 'resolved'
    priority: varchar('priority', { length: 10 }).notNull().default('normal'), // 'low', 'normal', 'high', 'urgent'
    lastMessageAt: timestamp('last_message_at').defaultNow(),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('conversations_session_id_idx').on(table.sessionId),
    index('conversations_is_active_idx').on(table.isActive),
    index('conversations_service_mode_idx').on(table.serviceMode),
    index('conversations_institution_id_idx').on(table.institutionId),
    index('conversations_assigned_admin_id_idx').on(table.assignedAdminId),
    index('conversations_status_idx').on(table.status),
    index('conversations_last_message_at_idx').on(table.lastMessageAt),
    index('conversations_created_at_idx').on(table.createdAt),
  ],
).enableRLS()

// Messages Table - Enhanced for multi-party chat
export const messages = pgTable(
  'messages',
  {
    messageId: serial('message_id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.conversationId, { onDelete: 'cascade' }),
    messageContent: text('message_content').notNull(),
    // Message types: 'user', 'admin', 'llm_bot', 'llm_recommendation', 'system'
    messageType: varchar('message_type', { length: 20 }).notNull().default('user'),
    // For admin messages
    adminId: integer('admin_id').references(() => users.userId),
    // For LLM recommendations (parent message they're responding to)
    parentMessageId: integer('parent_message_id'),
    // Message metadata
    confidence: integer('confidence'), // 0-100 for LLM responses
    isRead: boolean('is_read').notNull().default(false),
    // For speech-to-text metadata
    inputMethod: varchar('input_method', { length: 20 }).default('text'), // 'text', 'speech', 'gesture'
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('messages_conversation_id_idx').on(table.conversationId),
    index('messages_message_type_idx').on(table.messageType),
    index('messages_admin_id_idx').on(table.adminId),
    index('messages_parent_message_id_idx').on(table.parentMessageId),
    index('messages_is_read_idx').on(table.isRead),
    index('messages_created_at_idx').on(table.createdAt),
  ],
).enableRLS()

// Notes Table
export const notes = pgTable(
  'notes',
  {
    noteId: serial('note_id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.conversationId, { onDelete: 'cascade' }),
    noteContent: text('note_content').notNull(),
    title: varchar('title', { length: 255 }), // New column for title
    urlAccess: varchar('url_access', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('notes_conversation_id_idx').on(table.conversationId),
    index('notes_created_at_idx').on(table.createdAt),
  ],
).enableRLS()

// Q&A Logs Table - Enhanced for dual-mode tracking with conversation-based tracking
export const qaLogs = pgTable(
  'qa_logs',
  {
    qaId: serial('qa_id').primaryKey(),
    // Conversation-based tracking using foreign key
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.conversationId, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    confidence: integer('confidence'), // 0-100 percentage
    responseTime: integer('response_time'), // milliseconds
    gestureInput: text('gesture_input'),
    contextUsed: text('context_used'),
    evaluationScore: integer('evaluation_score'), // 0-100 for LLM evaluation
    // Service mode tracking
    serviceMode: varchar('service_mode', { length: 50 }).notNull().default('full_llm_bot'),
    // Institution context for RAG system
    institutionId: integer('institution_id').references(() => institutions.institutionId),
    respondedBy: varchar('responded_by', { length: 20 }).notNull().default('llm'), // 'llm', 'admin'
    adminId: integer('admin_id').references(() => users.userId), // If responded by admin
    llmRecommendationUsed: boolean('llm_recommendation_used').default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('qa_logs_conversation_id_idx').on(table.conversationId),
    index('qa_logs_service_mode_idx').on(table.serviceMode),
    index('qa_logs_institution_id_idx').on(table.institutionId),
    index('qa_logs_responded_by_idx').on(table.respondedBy),
    index('qa_logs_admin_id_idx').on(table.adminId),
    index('qa_logs_created_at_idx').on(table.createdAt),
    index('qa_logs_confidence_idx').on(table.confidence),
    index('qa_logs_evaluation_score_idx').on(table.evaluationScore),
  ],
).enableRLS()

// App Settings Table - Global application configuration
export const appSettings = pgTable(
  'app_settings',
  {
    settingId: serial('setting_id').primaryKey(),
    settingKey: varchar('setting_key', { length: 100 }).notNull().unique(),
    settingValue: text('setting_value').notNull(),
    settingType: varchar('setting_type', { length: 20 }).notNull().default('string'), // 'string', 'number', 'boolean', 'json'
    description: text('description'),
    isPublic: boolean('is_public').notNull().default(false), // Can be accessed by non-admin users
    updatedBy: integer('updated_by').references(() => users.userId),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('app_settings_setting_key_idx').on(table.settingKey),
    index('app_settings_is_public_idx').on(table.isPublic),
    index('app_settings_updated_at_idx').on(table.updatedAt),
  ],
).enableRLS()

// Institutions Table - For managing different government agencies/organizations
export const institutions = pgTable(
  'institutions',
  {
    institutionId: serial('institution_id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    description: text('description'),
    logoUrl: text('logo_url'),
    contactInfo: jsonb('contact_info')
      .$type<{
        phone?: string
        email?: string
        address?: string
        website?: string
      }>()
      .default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.userId),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('institutions_slug_idx').on(table.slug),
    index('institutions_is_active_idx').on(table.isActive),
    index('institutions_created_by_idx').on(table.createdBy),
    index('institutions_created_at_idx').on(table.createdAt),
  ],
).enableRLS()

// RAG Files Table - For managing PDF/TXT files associated with institutions
export const ragFiles = pgTable(
  'rag_files',
  {
    ragFileId: serial('rag_file_id').primaryKey(),
    institutionId: integer('institution_id')
      .notNull()
      .references(() => institutions.institutionId, { onDelete: 'cascade' }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileType: varchar('file_type', { length: 10 }).notNull(), // 'pdf' or 'txt'
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size'), // in bytes
    description: text('description'),
    processingStatus: varchar('processing_status', { length: 20 }).notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
    pineconeNamespace: varchar('pinecone_namespace', { length: 100 }),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.userId),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('rag_files_institution_id_idx').on(table.institutionId),
    index('rag_files_file_type_idx').on(table.fileType),
    index('rag_files_processing_status_idx').on(table.processingStatus),
    index('rag_files_pinecone_namespace_idx').on(table.pineconeNamespace),
    index('rag_files_is_active_idx').on(table.isActive),
    index('rag_files_created_by_idx').on(table.createdBy),
    index('rag_files_created_at_idx').on(table.createdAt),
  ],
).enableRLS()

// Admin Queue Table - For managing user conversations in CS mode
export const adminQueue = pgTable(
  'admin_queue',
  {
    queueId: serial('queue_id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.conversationId, { onDelete: 'cascade' })
      .unique(),
    assignedAdminId: integer('assigned_admin_id').references(() => users.userId),
    priority: varchar('priority', { length: 10 }).notNull().default('normal'),
    status: varchar('status', { length: 20 }).notNull().default('waiting'), // 'waiting', 'assigned', 'in_progress', 'resolved'
    queuedAt: timestamp('queued_at').notNull().defaultNow(),
    assignedAt: timestamp('assigned_at'),
    resolvedAt: timestamp('resolved_at'),
  },
  (table) => [
    index('admin_queue_status_idx').on(table.status),
    index('admin_queue_priority_idx').on(table.priority),
    index('admin_queue_assigned_admin_id_idx').on(table.assignedAdminId),
    index('admin_queue_queued_at_idx').on(table.queuedAt),
  ],
).enableRLS()

// RLS Helper Functions (for use in policies)
export const rlsHelpers = {
  // Get current user's Supabase ID from JWT
  getCurrentSupabaseUserId: () => `(SELECT auth.uid())`,

  // Check if current user is admin (role 1 or 2)
  isAdmin: () => `
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role_id IN (1, 2)
      AND u.is_active = true
    )
  `,

  // Check if current user is superadmin (role 1)
  isSuperAdmin: () => `
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role_id = 1
      AND u.is_active = true
    )
  `,

  // Get current user's database ID
  getCurrentUserId: () => `
    (SELECT user_id FROM users
     WHERE supabase_user_id = auth.uid()
     AND is_active = true
     LIMIT 1)
  `,

  // Check if user owns resource
  ownsResource: (userIdColumn: string) => `
    ${userIdColumn} = (
      SELECT user_id FROM users
      WHERE supabase_user_id = auth.uid()
      AND is_active = true
    )
  `,
} as const

// Table Relations
export const userRelations = relations(users, ({ one, many }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.roleId],
  }),
  invitedByUser: one(users, {
    fields: [users.invitedBy],
    references: [users.userId],
    relationName: 'invitations',
  }),
  sentInvitations: many(adminInvitations, {
    relationName: 'invitedBy',
  }),
  invitedUsers: many(users, {
    relationName: 'invitations',
  }),
  syncLogs: many(userSyncLog),
  // CS Support relations (admin-only)
  assignedConversations: many(conversations, {
    relationName: 'assignedConversations',
  }),
  adminMessages: many(messages, {
    relationName: 'adminMessages',
  }),
  adminQaLogsResponded: many(qaLogs, {
    relationName: 'adminQaLogs',
  }),
  // Institution management relations (admin-only)
  createdInstitutions: many(institutions),
  createdRagFiles: many(ragFiles),
}))

export const roleRelations = relations(roles, ({ many }) => ({
  users: many(users),
}))

export const adminInvitationRelations = relations(adminInvitations, ({ one }) => ({
  invitedByUser: one(users, {
    fields: [adminInvitations.invitedBy],
    references: [users.userId],
    relationName: 'invitedBy',
  }),
}))

export const userSyncLogRelations = relations(userSyncLog, ({ one }) => ({
  user: one(users, {
    fields: [userSyncLog.supabaseUserId],
    references: [users.supabaseUserId],
  }),
}))

export const conversationRelations = relations(conversations, ({ one, many }) => ({
  // No user relation - conversations are anonymous now
  institution: one(institutions, {
    fields: [conversations.institutionId],
    references: [institutions.institutionId],
  }),
  assignedAdmin: one(users, {
    fields: [conversations.assignedAdminId],
    references: [users.userId],
    relationName: 'assignedConversations',
  }),
  messages: many(messages),
  notes: many(notes),
  queueItem: one(adminQueue, {
    fields: [conversations.conversationId],
    references: [adminQueue.conversationId],
  }),
}))

export const messageRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.conversationId],
  }),
  admin: one(users, {
    fields: [messages.adminId],
    references: [users.userId],
    relationName: 'adminMessages',
  }),
  // Self-referencing relation for parent messages
  parentMessage: one(messages, {
    fields: [messages.parentMessageId],
    references: [messages.messageId],
  }),
  // Many relation for child messages
  replies: many(messages),
}))

export const noteRelations = relations(notes, ({ one }) => ({
  conversation: one(conversations, {
    fields: [notes.conversationId],
    references: [conversations.conversationId],
  }),
}))

export const qaLogRelations = relations(qaLogs, ({ one }) => ({
  // No user relation - QA logs are anonymous now
  conversation: one(conversations, {
    fields: [qaLogs.conversationId],
    references: [conversations.conversationId],
  }),
  institution: one(institutions, {
    fields: [qaLogs.institutionId],
    references: [institutions.institutionId],
  }),
  admin: one(users, {
    fields: [qaLogs.adminId],
    references: [users.userId],
    relationName: 'adminQaLogs',
  }),
}))

export const appSettingsRelations = relations(appSettings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [appSettings.updatedBy],
    references: [users.userId],
  }),
}))

export const institutionRelations = relations(institutions, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [institutions.createdBy],
    references: [users.userId],
  }),
  ragFiles: many(ragFiles),
  conversations: many(conversations),
  qaLogs: many(qaLogs),
}))

export const ragFileRelations = relations(ragFiles, ({ one }) => ({
  institution: one(institutions, {
    fields: [ragFiles.institutionId],
    references: [institutions.institutionId],
  }),
  createdByUser: one(users, {
    fields: [ragFiles.createdBy],
    references: [users.userId],
  }),
}))

export const adminQueueRelations = relations(adminQueue, ({ one }) => ({
  conversation: one(conversations, {
    fields: [adminQueue.conversationId],
    references: [conversations.conversationId],
  }),
  assignedAdmin: one(users, {
    fields: [adminQueue.assignedAdminId],
    references: [users.userId],
  }),
}))

// ========================================
// EXPORTED RLS POLICY FUNCTIONS
// ========================================

// Note: RLS policy functions are exported individually below

// Export table types for use in the application
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert
export type Role = typeof roles.$inferSelect
export type NewRole = typeof roles.$inferInsert
export type AdminInvitation = typeof adminInvitations.$inferSelect
export type NewAdminInvitation = typeof adminInvitations.$inferInsert
export type UserSyncLog = typeof userSyncLog.$inferSelect
export type NewUserSyncLog = typeof userSyncLog.$inferInsert
export type QaLog = typeof qaLogs.$inferSelect
export type NewQaLog = typeof qaLogs.$inferInsert
export type AppSetting = typeof appSettings.$inferSelect
export type NewAppSetting = typeof appSettings.$inferInsert
export type AdminQueue = typeof adminQueue.$inferSelect
export type NewAdminQueue = typeof adminQueue.$inferInsert
export type Institution = typeof institutions.$inferSelect
export type NewInstitution = typeof institutions.$inferInsert
export type RagFile = typeof ragFiles.$inferSelect
export type NewRagFile = typeof ragFiles.$inferInsert

// Enum types for better type safety
export type UserRole = 'superadmin' | 'admin' | 'user'
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled'
export type SyncStatus = 'success' | 'failed' | 'retry'
export type SupabaseEventType = 'auth.user.created' | 'auth.user.updated' | 'auth.user.deleted'

// Chat-specific types
export type ServiceMode = 'full_llm_bot' | 'bot_with_admin_validation'
export type ConversationStatus = 'active' | 'waiting' | 'in_progress' | 'resolved'
export type MessageType = 'user' | 'admin' | 'llm_bot' | 'llm_recommendation' | 'system'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type InputMethod = 'text' | 'speech' | 'gesture'
export type QueueStatus = 'waiting' | 'assigned' | 'in_progress' | 'resolved'
export type SettingType = 'string' | 'number' | 'boolean' | 'json'
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type FileType = 'pdf' | 'txt'

// ========================================
// DATABASE TRIGGERS & FUNCTIONS
// ========================================

// Function to handle new user creation from Supabase Auth
export const handleNewUserFunction = sql`
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO public.users (
      supabase_user_id,
      email,
      email_verified,
      user_metadata,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.email,
      (NEW.email_confirmed_at IS NOT NULL),
      COALESCE(NEW.raw_user_meta_data, '{}'::jsonb),
      NEW.created_at,
      NOW()
    );

    -- Log successful sync
    INSERT INTO public.user_sync_log (
      supabase_user_id,
      event_type,
      sync_status,
      supabase_payload,
      created_at
    ) VALUES (
      NEW.id,
      'auth.user.created',
      'success',
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'email_confirmed_at', NEW.email_confirmed_at
      ),
      NOW()
    );

    RETURN NEW;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail the auth operation
      INSERT INTO public.user_sync_log (
        supabase_user_id,
        event_type,
        sync_status,
        error_message,
        created_at
      ) VALUES (
        NEW.id,
        'auth.user.created',
        'failed',
        SQLERRM,
        NOW()
      );
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
`

// Function to handle user updates (email confirmation, etc.)
export const handleUserUpdateFunction = sql`
  CREATE OR REPLACE FUNCTION public.handle_user_update()
  RETURNS TRIGGER AS $$
  BEGIN
    -- Update existing user record
    UPDATE public.users SET
      email = NEW.email,
      email_verified = (NEW.email_confirmed_at IS NOT NULL),
      user_metadata = COALESCE(NEW.raw_user_meta_data, '{}'::jsonb),
      last_sign_in_at = COALESCE(NEW.last_sign_in_at, OLD.last_sign_in_at),
      updated_at = NOW()
    WHERE supabase_user_id = NEW.id;

    -- Log the update
    INSERT INTO public.user_sync_log (
      supabase_user_id,
      event_type,
      sync_status,
      supabase_payload,
      created_at
    ) VALUES (
      NEW.id,
      'auth.user.updated',
      'success',
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'email_confirmed_at', NEW.email_confirmed_at,
        'last_sign_in_at', NEW.last_sign_in_at
      ),
      NOW()
    );

    RETURN NEW;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error
      INSERT INTO public.user_sync_log (
        supabase_user_id,
        event_type,
        sync_status,
        error_message,
        created_at
      ) VALUES (
        NEW.id,
        'auth.user.updated',
        'failed',
        SQLERRM,
        NOW()
      );
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
`

// Create triggers
export const createAuthTriggers = sql`
  -- Drop existing triggers if they exist
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
  
  -- Create new triggers
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    
  CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();
`

// ========================================
// COMPREHENSIVE RLS POLICIES
// ========================================

// Policies for roles table (public read access)
export const rolesPolicies = sql`
  -- Drop existing policies
  DROP POLICY IF EXISTS "Anyone can read roles" ON public.roles;
  DROP POLICY IF EXISTS "Service role can manage roles" ON public.roles;
  DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
  
  -- Public read access for roles
  CREATE POLICY "Anyone can read roles" ON public.roles
    FOR SELECT USING (true);
    
  -- Service role can manage all roles
  CREATE POLICY "Service role can manage roles" ON public.roles
    FOR ALL USING (auth.role() = 'service_role');
    
  -- Admins can manage roles
  CREATE POLICY "Admins can manage roles" ON public.roles
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
`

// Comprehensive policies for users table - Fixed for UPSERT operations
export const usersPolicies = sql`
  -- Drop existing policies
  DROP POLICY IF EXISTS "Service role can manage users" ON public.users;
  DROP POLICY IF EXISTS "Users can read own data" ON public.users;
  DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
  DROP POLICY IF EXISTS "Users can update own data" ON public.users;
  DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
  DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
  DROP POLICY IF EXISTS "Authenticated users can insert own data" ON public.users;
  DROP POLICY IF EXISTS "Authenticated users can update own data" ON public.users;
  
  -- Service role has full access (for triggers and admin operations)
  CREATE POLICY "Service role can manage users" ON public.users
    FOR ALL USING (auth.role() = 'service_role');
  
  -- Authenticated users can insert their own record (UPSERT INSERT part)
  CREATE POLICY "Authenticated users can insert own data" ON public.users
    FOR INSERT 
    WITH CHECK (auth.uid() = supabase_user_id);
  
  -- Users can read their own data
  CREATE POLICY "Users can read own data" ON public.users
    FOR SELECT 
    USING (auth.uid() = supabase_user_id);
  
  -- Authenticated users can update their own data (UPSERT UPDATE part)
  CREATE POLICY "Authenticated users can update own data" ON public.users
    FOR UPDATE 
    USING (auth.uid() = supabase_user_id)
    WITH CHECK (auth.uid() = supabase_user_id);
  
  -- Admins can read all user data
  CREATE POLICY "Admins can read all users" ON public.users
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
  
  -- Admins can manage all users
  CREATE POLICY "Admins can manage all users" ON public.users
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
`

// Policies for user_sync_log table - Fixed for authenticated users and service operations
export const userSyncLogPolicies = sql`
  -- Drop existing policies
  DROP POLICY IF EXISTS "Service role can manage sync logs" ON public.user_sync_log;
  DROP POLICY IF EXISTS "Users can read own sync logs" ON public.user_sync_log;
  DROP POLICY IF EXISTS "Users can insert own sync logs" ON public.user_sync_log;
  DROP POLICY IF EXISTS "Admins can read all sync logs" ON public.user_sync_log;
  DROP POLICY IF EXISTS "Authenticated users can insert sync logs" ON public.user_sync_log;
  
  -- Service role has full access (for triggers and system operations)
  CREATE POLICY "Service role can manage sync logs" ON public.user_sync_log
    FOR ALL USING (auth.role() = 'service_role');
  
  -- Authenticated users can insert sync logs for their own user_id
  CREATE POLICY "Authenticated users can insert sync logs" ON public.user_sync_log
    FOR INSERT 
    WITH CHECK (
      auth.uid() IS NOT NULL AND 
      auth.uid() = supabase_user_id
    );
  
  -- Users can read their own sync logs
  CREATE POLICY "Users can read own sync logs" ON public.user_sync_log
    FOR SELECT 
    USING (auth.uid() = supabase_user_id);
  
  -- Admins can read all sync logs
  CREATE POLICY "Admins can read all sync logs" ON public.user_sync_log
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
`

// Policies for admin invitations table
export const adminInvitationsPolicies = sql`
  -- Drop existing policies
  DROP POLICY IF EXISTS "Service role can manage invitations" ON public.admin_invitations;
  DROP POLICY IF EXISTS "Admins can manage invitations" ON public.admin_invitations;
  DROP POLICY IF EXISTS "Invited users can read own invitations" ON public.admin_invitations;
  
  -- Service role has full access
  CREATE POLICY "Service role can manage invitations" ON public.admin_invitations
    FOR ALL USING (auth.role() = 'service_role');
  
  -- Admins can manage invitations
  CREATE POLICY "Admins can manage invitations" ON public.admin_invitations
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
  
  -- Invited users can read invitations sent to their email
  CREATE POLICY "Invited users can read own invitations" ON public.admin_invitations
    FOR SELECT 
    USING (
      email = (
        SELECT u.email FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
      )
    );
`

// Policies for conversations table (anonymous access)
export const conversationsPolicies = sql`
  -- Drop existing policies
  DROP POLICY IF EXISTS "Service role can manage conversations" ON public.conversations;
  DROP POLICY IF EXISTS "Anyone can create conversations" ON public.conversations;
  DROP POLICY IF EXISTS "Session owners can manage conversations" ON public.conversations;
  DROP POLICY IF EXISTS "Admins can manage all conversations" ON public.conversations;
  
  -- Service role has full access
  CREATE POLICY "Service role can manage conversations" ON public.conversations
    FOR ALL USING (auth.role() = 'service_role');
  
  -- Anyone can create conversations (anonymous users)
  CREATE POLICY "Anyone can create conversations" ON public.conversations
    FOR INSERT WITH CHECK (true);
  
  -- Anyone can read and update conversations (session-based access)
  CREATE POLICY "Session owners can manage conversations" ON public.conversations
    FOR ALL USING (true);
  
  -- Admins can manage all conversations
  CREATE POLICY "Admins can manage all conversations" ON public.conversations
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
`

// Policies for messages table (anonymous access)
export const messagesPolicies = sql`
  -- Drop existing policies
  DROP POLICY IF EXISTS "Service role can manage messages" ON public.messages;
  DROP POLICY IF EXISTS "Anyone can manage messages" ON public.messages;
  DROP POLICY IF EXISTS "Admins can manage all messages" ON public.messages;
  
  -- Service role has full access
  CREATE POLICY "Service role can manage messages" ON public.messages
    FOR ALL USING (auth.role() = 'service_role');
  
  -- Anyone can manage messages (anonymous access)
  CREATE POLICY "Anyone can manage messages" ON public.messages
    FOR ALL USING (true);
  
  -- Admins can manage all messages
  CREATE POLICY "Admins can manage all messages" ON public.messages
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
`

// Policies for other tables (qa_logs, notes, etc.)

export const qaLogsPolicies = sql`
  -- Drop existing policies
  DROP POLICY IF EXISTS "Service role can manage qa_logs" ON public.qa_logs;
  DROP POLICY IF EXISTS "Anyone can manage qa_logs" ON public.qa_logs;
  DROP POLICY IF EXISTS "Admins can manage all qa_logs" ON public.qa_logs;
  
  -- Service role has full access
  CREATE POLICY "Service role can manage qa_logs" ON public.qa_logs
    FOR ALL USING (auth.role() = 'service_role');
  
  -- Anyone can manage QA logs (anonymous access)
  CREATE POLICY "Anyone can manage qa_logs" ON public.qa_logs
    FOR ALL USING (true);
  
  -- Admins can manage all QA logs
  CREATE POLICY "Admins can manage all qa_logs" ON public.qa_logs
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
`

export const notesPolicies = sql`
  -- Drop existing policies
  DROP POLICY IF EXISTS "Service role can manage notes" ON public.notes;
  DROP POLICY IF EXISTS "Anyone can manage notes" ON public.notes;
  DROP POLICY IF EXISTS "Admins can manage all notes" ON public.notes;
  
  -- Service role has full access
  CREATE POLICY "Service role can manage notes" ON public.notes
    FOR ALL USING (auth.role() = 'service_role');
  
  -- Anyone can manage notes (anonymous access)
  CREATE POLICY "Anyone can manage notes" ON public.notes
    FOR ALL USING (true);
  
  -- Admins can manage all notes
  CREATE POLICY "Admins can manage all notes" ON public.notes
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
`

export const appSettingsPolicies = sql`
  -- Drop existing policies
  DROP POLICY IF EXISTS "Service role can manage app_settings" ON public.app_settings;
  DROP POLICY IF EXISTS "Anyone can read public settings" ON public.app_settings;
  DROP POLICY IF EXISTS "Admins can manage all settings" ON public.app_settings;
  
  -- Service role has full access
  CREATE POLICY "Service role can manage app_settings" ON public.app_settings
    FOR ALL USING (auth.role() = 'service_role');
  
  -- Anyone can read public settings
  CREATE POLICY "Anyone can read public settings" ON public.app_settings
    FOR SELECT USING (is_public = true);
  
  -- Admins can manage all settings
  CREATE POLICY "Admins can manage all settings" ON public.app_settings
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
`

export const adminQueuePolicies = sql`
  -- Drop existing policies
  DROP POLICY IF EXISTS "Service role can manage admin_queue" ON public.admin_queue;
  DROP POLICY IF EXISTS "Admins can manage admin_queue" ON public.admin_queue;
  
  -- Service role has full access
  CREATE POLICY "Service role can manage admin_queue" ON public.admin_queue
    FOR ALL USING (auth.role() = 'service_role');
  
  -- Admins can manage admin queue
  CREATE POLICY "Admins can manage admin_queue" ON public.admin_queue
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
`

// Policies for institutions table
export const institutionsPolicies = sql`
  -- Drop existing policies
  DROP POLICY IF EXISTS "Service role can manage institutions" ON public.institutions;
  DROP POLICY IF EXISTS "Anyone can read active institutions" ON public.institutions;
  DROP POLICY IF EXISTS "Admins can manage institutions" ON public.institutions;
  
  -- Service role has full access
  CREATE POLICY "Service role can manage institutions" ON public.institutions
    FOR ALL USING (auth.role() = 'service_role');
  
  -- Anyone can read active institutions (for public listing)
  CREATE POLICY "Anyone can read active institutions" ON public.institutions
    FOR SELECT USING (is_active = true);
  
  -- Admins can manage all institutions
  CREATE POLICY "Admins can manage institutions" ON public.institutions
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
`

// Policies for rag_files table
export const ragFilesPolicies = sql`
  -- Drop existing policies
  DROP POLICY IF EXISTS "Service role can manage rag_files" ON public.rag_files;
  DROP POLICY IF EXISTS "Admins can manage rag_files" ON public.rag_files;
  
  -- Service role has full access
  CREATE POLICY "Service role can manage rag_files" ON public.rag_files
    FOR ALL USING (auth.role() = 'service_role');
  
  -- Admins can manage all RAG files
  CREATE POLICY "Admins can manage rag_files" ON public.rag_files
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.supabase_user_id = auth.uid()
        AND u.role_id IN (1, 2)
        AND u.is_active = true
      )
    );
`

// Master policy application function
export const applyAllRLSPolicies = sql`
  -- Apply all RLS policies in correct order
  SELECT 'Starting RLS policy application...';
  
  -- Apply reference table policies first
  ${rolesPolicies};
  
  -- Apply core user management policies
  ${usersPolicies};
  ${userSyncLogPolicies};
  ${adminInvitationsPolicies};
  
  -- Apply application data policies
  ${conversationsPolicies};
  ${messagesPolicies};
  ${qaLogsPolicies};
  ${notesPolicies};
  ${appSettingsPolicies};
  ${adminQueuePolicies};
  
  -- Apply new institution and RAG file policies
  ${institutionsPolicies};
  ${ragFilesPolicies};
  
  SELECT 'RLS policies applied successfully!';
`
