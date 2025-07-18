import { pgTable, uuid, text, timestamp, integer, decimal, boolean, jsonb, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Admin and Authentication Tables
export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: text('role').notNull().default('admin'), // 'super_admin' | 'admin'
  isActive: boolean('is_active').notNull().default(true),
  invitedBy: uuid('invited_by').references(() => admins.id),
  invitationToken: text('invitation_token'),
  invitationExpiresAt: timestamp('invitation_expires_at'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  clerkUserIdIdx: index('clerk_user_id_idx').on(table.clerkUserId),
  emailIdx: index('email_idx').on(table.email),
  roleIdx: index('role_idx').on(table.role),
}))

// User Sessions and Interactions
export const userSessions = pgTable('user_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  gestureCount: integer('gesture_count').notNull().default(0),
  questionCount: integer('question_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
}, (table) => ({
  sessionIdIdx: index('session_id_idx').on(table.sessionId),
  startedAtIdx: index('started_at_idx').on(table.startedAt),
  isActiveIdx: index('is_active_idx').on(table.isActive),
}))

// QnA Conversation Logs
export const qnaLogs = pgTable('qna_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => userSessions.id),
  sequenceNumber: integer('sequence_number').notNull(),
  
  // Gesture Recognition Data
  gestureData: jsonb('gesture_data'), // MediaPipe landmarks, confidence scores
  recognizedText: text('recognized_text'),
  gestureConfidence: decimal('gesture_confidence', { precision: 5, scale: 4 }),
  gestureProcessingTime: integer('gesture_processing_time_ms'),
  
  // Question Processing
  processedQuestion: text('processed_question').notNull(),
  questionCategory: text('question_category'),
  
  // RAG System Data
  retrievedDocuments: jsonb('retrieved_documents'), // Document IDs and similarity scores
  ragContext: text('rag_context'),
  
  // LLM Response
  llmResponse: text('llm_response').notNull(),
  llmModel: text('llm_model').notNull().default('llama-3'),
  llmTokensUsed: integer('llm_tokens_used'),
  llmResponseTime: integer('llm_response_time_ms'),
  
  // Quality Metrics
  responseQualityScore: decimal('response_quality_score', { precision: 5, scale: 4 }),
  userFeedback: text('user_feedback'), // 'helpful' | 'not_helpful' | null
  
  // Admin Validation
  adminValidationStatus: text('admin_validation_status').default('pending'), // 'pending' | 'approved' | 'rejected' | 'needs_review'
  validatedBy: uuid('validated_by').references(() => admins.id),
  validationNotes: text('validation_notes'),
  validatedAt: timestamp('validated_at'),
  
  // QR Code Generation
  qrCodeGenerated: boolean('qr_code_generated').notNull().default(false),
  qrCodeData: text('qr_code_data'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  sessionIdIdx: index('session_id_idx').on(table.sessionId),
  createdAtIdx: index('created_at_idx').on(table.createdAt),
  adminValidationStatusIdx: index('admin_validation_status_idx').on(table.adminValidationStatus),
  questionCategoryIdx: index('question_category_idx').on(table.questionCategory),
  userFeedbackIdx: index('user_feedback_idx').on(table.userFeedback),
  validatedByIdx: index('validated_by_idx').on(table.validatedBy),
}))

// Performance Metrics and Analytics
export const performanceMetrics = pgTable('performance_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  metricType: text('metric_type').notNull(), // 'gesture_accuracy' | 'llm_response_time' | 'user_satisfaction' | 'system_load'
  metricCategory: text('metric_category').notNull(), // 'performance' | 'quality' | 'usage'
  
  // Metric Values
  value: decimal('value', { precision: 10, scale: 4 }).notNull(),
  unit: text('unit').notNull(), // 'ms' | 'percentage' | 'count' | 'score'
  
  // Context Data
  sessionId: uuid('session_id').references(() => userSessions.id),
  qnaLogId: uuid('qna_log_id').references(() => qnaLogs.id),
  additionalData: jsonb('additional_data'), // Flexible field for metric-specific data
  
  // Aggregation Support
  timeWindow: text('time_window').notNull(), // 'real_time' | 'hourly' | 'daily' | 'weekly' | 'monthly'
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
}, (table) => ({
  metricTypeIdx: index('metric_type_idx').on(table.metricType),
  metricCategoryIdx: index('metric_category_idx').on(table.metricCategory),
  timeWindowIdx: index('time_window_idx').on(table.timeWindow),
  recordedAtIdx: index('recorded_at_idx').on(table.recordedAt),
}))

// System Configuration and Knowledge Base
export const systemConfigs = pgTable('system_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  configKey: text('config_key').notNull().unique(),
  configValue: jsonb('config_value').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').notNull().references(() => admins.id),
  updatedBy: uuid('updated_by').references(() => admins.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  configKeyIdx: index('config_key_idx').on(table.configKey),
  isActiveIdx: index('is_active_idx').on(table.isActive),
}))

// Document Management for RAG System
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  documentType: text('document_type').notNull(), // 'ktp_guide' | 'kk_guide' | 'passport_guide' | 'general_info'
  category: text('category').notNull(), // 'requirements' | 'procedures' | 'forms' | 'faq'
  
  // Pinecone Integration
  pineconeId: text('pinecone_id').unique(),
  embeddings: jsonb('embeddings'), // Store embedding vectors if needed locally
  
  // Document Metadata
  version: text('version').notNull().default('1.0'),
  isActive: boolean('is_active').notNull().default(true),
  tags: jsonb('tags'), // Array of tags for better categorization
  
  // Content Management
  lastReviewedAt: timestamp('last_reviewed_at'),
  reviewedBy: uuid('reviewed_by').references(() => admins.id),
  approvalStatus: text('approval_status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  
  createdBy: uuid('created_by').notNull().references(() => admins.id),
  updatedBy: uuid('updated_by').references(() => admins.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  documentTypeIdx: index('document_type_idx').on(table.documentType),
  categoryIdx: index('category_idx').on(table.category),
  isActiveIdx: index('is_active_idx').on(table.isActive),
  pineconeIdIdx: index('pinecone_id_idx').on(table.pineconeId),
  approvalStatusIdx: index('approval_status_idx').on(table.approvalStatus),
}))

// Email Notifications Log
export const emailLogs = pgTable('email_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientEmail: text('recipient_email').notNull(),
  emailType: text('email_type').notNull(), // 'admin_invitation' | 'validation_reminder' | 'system_alert'
  subject: text('subject').notNull(),
  templateId: text('template_id'),
  
  // Resend API Integration
  resendMessageId: text('resend_message_id'),
  deliveryStatus: text('delivery_status').notNull().default('sent'), // 'sent' | 'delivered' | 'failed' | 'bounced'
  
  // Context
  relatedAdminId: uuid('related_admin_id').references(() => admins.id),
  additionalData: jsonb('additional_data'),
  
  sentAt: timestamp('sent_at').notNull().defaultNow(),
  deliveredAt: timestamp('delivered_at'),
}, (table) => ({
  recipientEmailIdx: index('recipient_email_idx').on(table.recipientEmail),
  emailTypeIdx: index('email_type_idx').on(table.emailType),
  deliveryStatusIdx: index('delivery_status_idx').on(table.deliveryStatus),
  sentAtIdx: index('sent_at_idx').on(table.sentAt),
}))

// Table Relations
export const adminRelations = relations(admins, ({ one, many }) => ({
  invitedByAdmin: one(admins, {
    fields: [admins.invitedBy],
    references: [admins.id],
    relationName: 'adminInvitation'
  }),
  invitedAdmins: many(admins, { relationName: 'adminInvitation' }),
  validatedQnaLogs: many(qnaLogs),
  createdDocuments: many(documents, { relationName: 'documentCreator' }),
  updatedDocuments: many(documents, { relationName: 'documentUpdater' }),
  reviewedDocuments: many(documents, { relationName: 'documentReviewer' }),
  createdConfigs: many(systemConfigs, { relationName: 'configCreator' }),
  updatedConfigs: many(systemConfigs, { relationName: 'configUpdater' }),
  relatedEmails: many(emailLogs),
}))

export const userSessionRelations = relations(userSessions, ({ many }) => ({
  qnaLogs: many(qnaLogs),
  performanceMetrics: many(performanceMetrics),
}))

export const qnaLogRelations = relations(qnaLogs, ({ one, many }) => ({
  session: one(userSessions, {
    fields: [qnaLogs.sessionId],
    references: [userSessions.id],
  }),
  validator: one(admins, {
    fields: [qnaLogs.validatedBy],
    references: [admins.id],
  }),
  performanceMetrics: many(performanceMetrics),
}))

export const performanceMetricRelations = relations(performanceMetrics, ({ one }) => ({
  session: one(userSessions, {
    fields: [performanceMetrics.sessionId],
    references: [userSessions.id],
  }),
  qnaLog: one(qnaLogs, {
    fields: [performanceMetrics.qnaLogId],
    references: [qnaLogs.id],
  }),
}))

export const documentRelations = relations(documents, ({ one }) => ({
  creator: one(admins, {
    fields: [documents.createdBy],
    references: [admins.id],
    relationName: 'documentCreator'
  }),
  updater: one(admins, {
    fields: [documents.updatedBy],
    references: [admins.id],
    relationName: 'documentUpdater'
  }),
  reviewer: one(admins, {
    fields: [documents.reviewedBy],
    references: [admins.id],
    relationName: 'documentReviewer'
  }),
}))

export const systemConfigRelations = relations(systemConfigs, ({ one }) => ({
  creator: one(admins, {
    fields: [systemConfigs.createdBy],
    references: [admins.id],
    relationName: 'configCreator'
  }),
  updater: one(admins, {
    fields: [systemConfigs.updatedBy],
    references: [admins.id],
    relationName: 'configUpdater'
  }),
}))

export const emailLogRelations = relations(emailLogs, ({ one }) => ({
  relatedAdmin: one(admins, {
    fields: [emailLogs.relatedAdminId],
    references: [admins.id],
  }),
}))