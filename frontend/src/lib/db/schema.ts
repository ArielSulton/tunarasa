import { pgTable, text, timestamp, integer, boolean, varchar, serial, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Notes Table (sesuai ERD)
export const notes = pgTable(
  'notes',
  {
    noteId: serial('note_id').primaryKey(),
    conversationId: integer('conversation_id').notNull(),
    noteContent: text('note_content').notNull(),
    urlAccess: varchar('url_access', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('notes_conversation_id_idx').on(table.conversationId),
    index('notes_created_at_idx').on(table.createdAt),
  ],
)

// Messages Table (sesuai ERD)
export const messages = pgTable(
  'messages',
  {
    messageId: serial('message_id').primaryKey(),
    conversationId: integer('conversation_id').notNull(),
    messageContent: text('message_content').notNull(),
    isUser: boolean('is_user').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('messages_conversation_id_idx').on(table.conversationId),
    index('messages_is_user_idx').on(table.isUser),
    index('messages_created_at_idx').on(table.createdAt),
  ],
)

// Conversations Table (sesuai ERD)
export const conversations = pgTable(
  'conversations',
  {
    conversationId: serial('conversation_id').primaryKey(),
    isActive: boolean('is_active').notNull().default(true),
    userId: integer('user_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('conversations_user_id_idx').on(table.userId),
    index('conversations_is_active_idx').on(table.isActive),
    index('conversations_created_at_idx').on(table.createdAt),
  ],
)

// Users Table (sesuai ERD)
export const users = pgTable(
  'users',
  {
    userId: serial('user_id').primaryKey(),
    clerkUserId: integer('clerk_user_id').unique(),
    fullName: varchar('full_name', { length: 255 }),
    roleId: integer('role_id').notNull(),
    genderId: integer('gender_id').notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('users_clerk_user_id_idx').on(table.clerkUserId),
    index('users_role_id_idx').on(table.roleId),
    index('users_gender_id_idx').on(table.genderId),
    index('users_created_at_idx').on(table.createdAt),
  ],
)

// Genders Table (sesuai ERD)
export const genders = pgTable(
  'genders',
  {
    genderId: serial('gender_id').primaryKey(),
    genderName: varchar('gender_name', { length: 50 }).notNull(),
  },
  (table) => [index('genders_gender_name_idx').on(table.genderName)],
)

// Roles Table (sesuai ERD)
export const roles = pgTable(
  'roles',
  {
    roleId: serial('role_id').primaryKey(),
    roleName: varchar('role_name', { length: 50 }).notNull(),
  },
  (table) => [index('roles_role_name_idx').on(table.roleName)],
)

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
  conversations: many(conversations),
}))

export const roleRelations = relations(roles, ({ many }) => ({
  users: many(users),
}))

export const genderRelations = relations(genders, ({ many }) => ({
  users: many(users),
}))

export const conversationRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.userId],
  }),
  messages: many(messages),
  notes: many(notes),
}))

export const messageRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.conversationId],
  }),
}))

export const noteRelations = relations(notes, ({ one }) => ({
  conversation: one(conversations, {
    fields: [notes.conversationId],
    references: [conversations.conversationId],
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
export type Gender = typeof genders.$inferSelect
