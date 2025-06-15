import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  useCase: text("use_case"),
  category: text("category").default("other"),
  tools: text("tools"),
  linkUrl: text("link_url"),
  sessionId: text("session_id").notNull(), // Track who submitted this idea
  votes: integer("votes").notNull().default(1),
  aiGrade: text("ai_grade"), // Store as decimal string like "7.3"
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  // Reddit-style post types
  postType: text("post_type").default("text"), // "text", "link", "media"
  mediaUrl: text("media_url"), // For images/videos
  mediaType: text("media_type"), // "image" or "video"
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("homepage"), // "homepage" or "gift_card_popup"
  sessionId: text("session_id"), // Link to user session for gift card popup emails
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
});

export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  hasSubmitted: boolean("has_submitted").notNull().default(false),
  upvotesGiven: integer("upvotes_given").notNull().default(0),
  rewardUpvotesEarned: integer("reward_upvotes_earned").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
  sessionDurationMs: integer("session_duration_ms").default(0),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ideaId: integer("idea_id").notNull(),
  voteType: text("vote_type").notNull(), // 'up' or 'down'
  ipAddress: text("ip_address").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Session storage table for auth
export const sessions = pgTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: text("sess").notNull(), // JSON session data
  expire: timestamp("expire").notNull(),
});

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull(),
  userId: integer("user_id"), // Allow null for anonymous comments
  parentId: integer("parent_id"), // For nested comments
  sessionId: text("session_id"), // For anonymous comments
  anonymousUsername: text("anonymous_username"), // For anonymous comments
  content: text("content").notNull(),
  votes: integer("votes").default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Comment votes table
export const commentVotes = pgTable("comment_votes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull(),
  sessionId: text("session_id").notNull(),
  ipAddress: text("ip_address").notNull(),
  voteType: text("vote_type").notNull(), // 'up' or 'down'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  votes: true,
  submittedAt: true,
  sessionId: true, // Handled separately in the API
}).extend({
  useCase: z.string().min(100, "Please write at least 100 characters to describe your use case"),
  linkUrl: z.string().optional().refine((url) => {
    if (!url || url.trim() === '') return true;
    return url.includes('.') && (
      url.startsWith('http://') || 
      url.startsWith('https://') || 
      url.startsWith('www.') ||
      /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(url)
    );
  }, {
    message: "Please enter a valid URL (e.g., https://example.com, www.example.com, or example.com)"
  }),
  postType: z.enum(["text", "link", "media"]).optional(),
  mediaUrl: z.string().optional(),
  mediaType: z.enum(["image", "video"]).optional(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  subscribedAt: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  votes: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommentVoteSchema = createInsertSchema(commentVotes).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
}).extend({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type Idea = typeof ideas.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertCommentVote = z.infer<typeof insertCommentVoteSchema>;
export type CommentVote = typeof commentVotes.$inferSelect;
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;
