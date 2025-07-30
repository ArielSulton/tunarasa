import { pgTable, text, timestamp, integer, boolean, varchar, serial, index } from 'drizzle-orm/pg-core'
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

// Roles Table
export const roles = pgTable(
  'roles',
  {
    roleId: serial('role_id').primaryKey(),
    roleName: varchar('role_name', { length: 50 }).notNull().unique(),
  },
  (table) => [index('roles_role_name_idx').on(table.roleName)],
).enableRLS()

// Users Table
export const users = pgTable(
  'users',
  {
    userId: serial('user_id').primaryKey(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull().unique(),
    fullName: varchar('full_name', { length: 255 }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.roleId),
    genderId: integer('gender_id')
      .notNull()
      .references(() => genders.genderId),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('users_clerk_user_id_idx').on(table.clerkUserId),
    index('users_role_id_idx').on(table.roleId),
    index('users_gender_id_idx').on(table.genderId),
    index('users_created_at_idx').on(table.createdAt),
  ],
).enableRLS()

// Conversations Table
export const conversations = pgTable(
  'conversations',
  {
    conversationId: serial('conversation_id').primaryKey(),
    isActive: boolean('is_active').notNull().default(true),
    userId: integer('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('conversations_user_id_idx').on(table.userId),
    index('conversations_is_active_idx').on(table.isActive),
    index('conversations_created_at_idx').on(table.createdAt),
  ],
).enableRLS()

// Messages Table
export const messages = pgTable(
  'messages',
  {
    messageId: serial('message_id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.conversationId, { onDelete: 'cascade' }),
    messageContent: text('message_content').notNull(),
    isUser: boolean('is_user').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('messages_conversation_id_idx').on(table.conversationId),
    index('messages_is_user_idx').on(table.isUser),
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
export type NewRole = typeof roles.$inferInsert
export type Gender = typeof genders.$inferSelect
export type NewGender = typeof genders.$inferInsert
