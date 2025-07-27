import { pgTable, text, timestamp, integer, boolean, varchar, serial, index, jsonb, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Genders Table
export const genders = pgTable(
  'genders',
  {
    genderId: serial('gender_id').primaryKey(),
    genderName: varchar('gender_name', { length: 50 }).notNull().unique(),
  },
  (table) => [index('genders_gender_name_idx').on(table.genderName)],
).enableRLS()

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

// Enhanced Users Table with better Clerk integration
export const users = pgTable(
  'users',
  {
    userId: serial('user_id').primaryKey(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    fullName: varchar('full_name', { length: 255 }),
    imageUrl: text('image_url'),
    roleId: integer('role_id')
      .references(() => roles.roleId)
      .default(3), // Default to regular user role
    genderId: integer('gender_id').references(() => genders.genderId),
    isActive: boolean('is_active').notNull().default(true),
    lastSignInAt: timestamp('last_sign_in_at'),
    emailVerified: boolean('email_verified').notNull().default(false),
    // Clerk metadata sync
    clerkMetadata: jsonb('clerk_metadata'),
    // Admin invitation tracking
    invitedBy: integer('invited_by'),
    invitedAt: timestamp('invited_at'),
    invitationAcceptedAt: timestamp('invitation_accepted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('users_clerk_user_id_idx').on(table.clerkUserId),
    index('users_email_idx').on(table.email),
    index('users_role_id_idx').on(table.roleId),
    index('users_gender_id_idx').on(table.genderId),
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

// User Sync Log Table for tracking Clerk synchronization
export const userSyncLog = pgTable(
  'user_sync_log',
  {
    syncId: serial('sync_id').primaryKey(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 50 }).notNull(), // user.created, user.updated, user.deleted
    syncStatus: varchar('sync_status', { length: 20 }).notNull().default('success'), // success, failed, retry
    errorMessage: text('error_message'),
    clerkPayload: jsonb('clerk_payload'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('user_sync_log_clerk_user_id_idx').on(table.clerkUserId),
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
    // Service mode: 'full_llm_bot' or 'human_cs_support'
    serviceMode: varchar('service_mode', { length: 20 }).notNull().default('full_llm_bot'),
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
    urlAccess: varchar('url_access', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('notes_conversation_id_idx').on(table.conversationId),
    index('notes_created_at_idx').on(table.createdAt),
  ],
).enableRLS()

// Sessions Table - Supporting both anonymous users and authenticated admins
export const sessions = pgTable(
  'sessions',
  {
    sessionId: serial('session_id').primaryKey(),
    // Anonymous session identifier (for non-authenticated users)
    anonymousSessionId: varchar('anonymous_session_id', { length: 255 }),
    // Optional user reference (only for admin/superadmin sessions)
    userId: integer('user_id').references(() => users.userId, { onDelete: 'cascade' }),
    sessionType: varchar('session_type', { length: 20 }).notNull().default('anonymous'), // 'anonymous', 'admin'
    sessionStart: timestamp('session_start').notNull().defaultNow(),
    sessionEnd: timestamp('session_end'),
    isActive: boolean('is_active').notNull().default(true),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
    deviceInfo: jsonb('device_info'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('sessions_anonymous_session_id_idx').on(table.anonymousSessionId),
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_session_type_idx').on(table.sessionType),
    index('sessions_is_active_idx').on(table.isActive),
    index('sessions_session_start_idx').on(table.sessionStart),
    index('sessions_created_at_idx').on(table.createdAt),
  ],
).enableRLS()

// Q&A Logs Table - Enhanced for dual-mode tracking with anonymous users
export const qaLogs = pgTable(
  'qa_logs',
  {
    qaId: serial('qa_id').primaryKey(),
    // Anonymous session tracking (no foreign key to users table)
    sessionId: varchar('session_id', { length: 255 }).notNull(),
    conversationId: integer('conversation_id').references(() => conversations.conversationId, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    confidence: integer('confidence'), // 0-100 percentage
    responseTime: integer('response_time'), // milliseconds
    gestureInput: text('gesture_input'),
    contextUsed: text('context_used'),
    evaluationScore: integer('evaluation_score'), // 0-100 for LLM evaluation
    // Service mode tracking
    serviceMode: varchar('service_mode', { length: 20 }).notNull().default('full_llm_bot'),
    respondedBy: varchar('responded_by', { length: 20 }).notNull().default('llm'), // 'llm', 'admin'
    adminId: integer('admin_id').references(() => users.userId), // If responded by admin
    llmRecommendationUsed: boolean('llm_recommendation_used').default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('qa_logs_session_id_idx').on(table.sessionId),
    index('qa_logs_conversation_id_idx').on(table.conversationId),
    index('qa_logs_service_mode_idx').on(table.serviceMode),
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
  // Get current user's Clerk ID from JWT
  getCurrentClerkUserId: () => `(SELECT auth.jwt()->>'sub')`,

  // Check if current user is admin (role 1 or 2)
  isAdmin: () => `
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_user_id = (SELECT auth.jwt()->>'sub')
      AND u.role_id IN (1, 2)
      AND u.is_active = true
    )
  `,

  // Check if current user is superadmin (role 1)
  isSuperAdmin: () => `
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_user_id = (SELECT auth.jwt()->>'sub')
      AND u.role_id = 1
      AND u.is_active = true
    )
  `,

  // Get current user's database ID
  getCurrentUserId: () => `
    (SELECT user_id FROM users
     WHERE clerk_user_id = (SELECT auth.jwt()->>'sub')
     AND is_active = true
     LIMIT 1)
  `,

  // Check if user owns resource
  ownsResource: (userIdColumn: string) => `
    ${userIdColumn} = (
      SELECT user_id FROM users
      WHERE clerk_user_id = (SELECT auth.jwt()->>'sub')
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
  gender: one(genders, {
    fields: [users.genderId],
    references: [genders.genderId],
  }),
  invitedByUser: one(users, {
    fields: [users.invitedBy],
    references: [users.userId],
    relationName: 'invitations',
  }),
  // Admin-only sessions (authenticated users)
  adminSessions: many(sessions, {
    relationName: 'adminSessions',
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
}))

export const roleRelations = relations(roles, ({ many }) => ({
  users: many(users),
}))

export const genderRelations = relations(genders, ({ many }) => ({
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
    fields: [userSyncLog.clerkUserId],
    references: [users.clerkUserId],
  }),
}))

export const conversationRelations = relations(conversations, ({ one, many }) => ({
  // No user relation - conversations are anonymous now
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

export const sessionRelations = relations(sessions, ({ one }) => ({
  // Optional user relation - only for admin sessions
  user: one(users, {
    fields: [sessions.userId],
    references: [users.userId],
    relationName: 'adminSessions',
  }),
}))

export const qaLogRelations = relations(qaLogs, ({ one }) => ({
  // No user relation - QA logs are anonymous now
  conversation: one(conversations, {
    fields: [qaLogs.conversationId],
    references: [conversations.conversationId],
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
export type Gender = typeof genders.$inferSelect
export type NewGender = typeof genders.$inferInsert
export type AdminInvitation = typeof adminInvitations.$inferSelect
export type NewAdminInvitation = typeof adminInvitations.$inferInsert
export type UserSyncLog = typeof userSyncLog.$inferSelect
export type NewUserSyncLog = typeof userSyncLog.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type QaLog = typeof qaLogs.$inferSelect
export type NewQaLog = typeof qaLogs.$inferInsert
export type AppSetting = typeof appSettings.$inferSelect
export type NewAppSetting = typeof appSettings.$inferInsert
export type AdminQueue = typeof adminQueue.$inferSelect
export type NewAdminQueue = typeof adminQueue.$inferInsert

// Enum types for better type safety
export type UserRole = 'superadmin' | 'admin' | 'user'
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled'
export type SyncStatus = 'success' | 'failed' | 'retry'
export type ClerkEventType = 'user.created' | 'user.updated' | 'user.deleted'

// Chat-specific types
export type ServiceMode = 'full_llm_bot' | 'human_cs_support'
export type ConversationStatus = 'active' | 'waiting' | 'in_progress' | 'resolved'
export type MessageType = 'user' | 'admin' | 'llm_bot' | 'llm_recommendation' | 'system'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type InputMethod = 'text' | 'speech' | 'gesture'
export type QueueStatus = 'waiting' | 'assigned' | 'in_progress' | 'resolved'
export type SettingType = 'string' | 'number' | 'boolean' | 'json'
