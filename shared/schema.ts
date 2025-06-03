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
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ideaId: integer("idea_id").notNull(),
  voteType: text("vote_type").notNull(), // 'up' or 'down'
  ipAddress: text("ip_address").notNull(),
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

export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type Idea = typeof ideas.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;
