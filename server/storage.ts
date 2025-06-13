import { 
  ideas, 
  subscriptions, 
  userSessions, 
  votes,
  users,
  comments,
  type Idea, 
  type InsertIdea,
  type Subscription,
  type InsertSubscription,
  type UserSession,
  type InsertUserSession,
  type Vote,
  type InsertVote,
  type User,
  type UpsertUser,
  type Comment,
  type InsertComment
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or, isNull, sql } from "drizzle-orm";

export interface IStorage {
  // Ideas
  createIdea(idea: InsertIdea & { sessionId: string }): Promise<Idea>;
  getIdeas(sortBy?: 'votes' | 'recent', category?: string, tool?: string): Promise<Idea[]>;
  getIdeaById(id: number): Promise<Idea | undefined>;
  updateIdea(id: number, updates: Partial<Idea>): Promise<Idea>;
  updateIdeaVotes(id: number, votes: number): Promise<void>;
  deleteIdea(id: number): Promise<void>;
  
  // Subscriptions
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscriptionByEmail(email: string): Promise<Subscription | undefined>;
  getAllSubscriptions(): Promise<Subscription[]>;
  
  // User Sessions
  createUserSession(session: InsertUserSession): Promise<UserSession>;
  getUserSession(sessionId: string): Promise<UserSession | undefined>;
  updateUserSessionSubmitted(sessionId: string): Promise<void>;
  incrementUpvotesGiven(sessionId: string): Promise<void>;
  getUserIdeasBySession(sessionId: string): Promise<Idea[]>;
  updateUserSessionActivity(sessionId: string): Promise<void>;
  getSessionMetricsByDay(): Promise<Array<{ date: string; avgTimeOnSiteMinutes: number; totalSessions: number }>>;
  
  // Votes
  createVote(vote: InsertVote): Promise<Vote>;
  getUserVoteForIdea(sessionId: string, ideaId: number): Promise<Vote | undefined>;
  getVoteByIpAndIdea(ipAddress: string, ideaId: number): Promise<Vote | undefined>;
  getRecentVotesByIp(ipAddress: string, timeWindowMs: number): Promise<Vote[]>;
  getRecentVotesBySession(sessionId: string, timeWindowMs: number): Promise<Vote[]>;
  getAllVotesBySession(sessionId: string): Promise<Vote[]>;
  deleteVote(sessionId: string, ideaId: number): Promise<void>;
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Comments
  createComment(comment: InsertComment): Promise<Comment>;
  getCommentsByIdeaId(ideaId: number): Promise<(Comment & { user: User | null })[]>;
  deleteComment(id: number, userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Ideas
  async createIdea(insertIdea: InsertIdea & { sessionId: string }): Promise<Idea> {
    // Ensure category defaults to "other" if not provided
    const ideaData = {
      sessionId: insertIdea.sessionId,
      title: insertIdea.title,
      description: insertIdea.description,
      useCase: insertIdea.useCase,
      category: insertIdea.category || "other",
      tools: insertIdea.tools || null,
      linkUrl: insertIdea.linkUrl || null,
      aiGrade: insertIdea.aiGrade || null,
      votes: 0
    };
    
    const [idea] = await db
      .insert(ideas)
      .values(ideaData)
      .returning();
    return idea;
  }

  async getIdeas(sortBy: 'votes' | 'recent' = 'votes', category?: string, tool?: string): Promise<Idea[]> {
    let query = db.select().from(ideas);
    
    const conditions = [];
    
    if (category && category !== 'All') {
      if (category.toLowerCase() === 'other') {
        // For "other" category, include both null and "other" values (case insensitive)
        conditions.push(or(eq(ideas.category, 'Other'), eq(ideas.category, 'other'), isNull(ideas.category)));
      } else {
        conditions.push(eq(ideas.category, category));
      }
    }
    
    if (tool && tool !== 'All') {
      if (tool.toLowerCase() === 'other') {
        // For "other" tool, include both null and "other" values (case insensitive)
        conditions.push(or(eq(ideas.tools, 'Other'), eq(ideas.tools, 'other'), isNull(ideas.tools)));
      } else {
        // Case-insensitive tool matching
        conditions.push(sql`LOWER(${ideas.tools}) = LOWER(${tool})`);
      }
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    if (sortBy === 'votes') {
      return await query.orderBy(desc(ideas.votes));
    } else {
      return await query.orderBy(desc(ideas.submittedAt));
    }
  }

  async getIdeaById(id: number): Promise<Idea | undefined> {
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
    return idea || undefined;
  }

  async updateIdea(id: number, updates: Partial<Idea>): Promise<Idea> {
    const [idea] = await db.update(ideas).set(updates).where(eq(ideas.id, id)).returning();
    return idea;
  }

  async updateIdeaVotes(id: number, votes: number): Promise<void> {
    await db.update(ideas).set({ votes }).where(eq(ideas.id, id));
  }

  async deleteIdea(id: number): Promise<void> {
    await db.delete(ideas).where(eq(ideas.id, id));
  }

  // Subscriptions
  async createSubscription(insertSubscription: InsertSubscription): Promise<Subscription> {
    const [subscription] = await db
      .insert(subscriptions)
      .values(insertSubscription)
      .returning();
    return subscription;
  }

  async getSubscriptionByEmail(email: string): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.email, email));
    return subscription || undefined;
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return await db.select().from(subscriptions);
  }

  // User Sessions
  async createUserSession(insertSession: InsertUserSession): Promise<UserSession> {
    const [session] = await db
      .insert(userSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getUserSession(sessionId: string): Promise<UserSession | undefined> {
    const [session] = await db.select().from(userSessions).where(eq(userSessions.sessionId, sessionId));
    return session || undefined;
  }

  async updateUserSessionSubmitted(sessionId: string): Promise<void> {
    await db.update(userSessions).set({ hasSubmitted: true }).where(eq(userSessions.sessionId, sessionId));
  }

  async incrementUpvotesGiven(sessionId: string): Promise<void> {
    const session = await this.getUserSession(sessionId);
    if (session) {
      const newUpvotesGiven = session.upvotesGiven + 1;
      await db.update(userSessions)
        .set({ upvotesGiven: newUpvotesGiven })
        .where(eq(userSessions.sessionId, sessionId));
    }
  }

  async getUserIdeasBySession(sessionId: string): Promise<Idea[]> {
    const userIdeas = await db.select().from(ideas).where(eq(ideas.sessionId, sessionId));
    return userIdeas;
  }

  // Votes
  async createVote(insertVote: InsertVote): Promise<Vote> {
    const [vote] = await db
      .insert(votes)
      .values(insertVote)
      .returning();
    return vote;
  }

  async getUserVoteForIdea(sessionId: string, ideaId: number): Promise<Vote | undefined> {
    const [vote] = await db.select().from(votes).where(
      and(eq(votes.sessionId, sessionId), eq(votes.ideaId, ideaId))
    );
    return vote || undefined;
  }

  async getVoteByIpAndIdea(ipAddress: string, ideaId: number): Promise<Vote | undefined> {
    const [vote] = await db.select().from(votes).where(
      and(eq(votes.ipAddress, ipAddress), eq(votes.ideaId, ideaId))
    );
    return vote || undefined;
  }

  async getRecentVotesByIp(ipAddress: string, timeWindowMs: number): Promise<Vote[]> {
    const cutoffTime = new Date(Date.now() - timeWindowMs);
    // Simple implementation - get all votes from this IP and filter in memory
    const allVotes = await db.select().from(votes).where(eq(votes.ipAddress, ipAddress));
    return allVotes.filter(vote => vote.createdAt >= cutoffTime);
  }

  async getRecentVotesBySession(sessionId: string, timeWindowMs: number): Promise<Vote[]> {
    const cutoffTime = new Date(Date.now() - timeWindowMs);
    // Get all votes from this session and filter in memory
    const allVotes = await db.select().from(votes).where(eq(votes.sessionId, sessionId));
    return allVotes.filter(vote => vote.createdAt >= cutoffTime);
  }

  async getAllVotesBySession(sessionId: string): Promise<Vote[]> {
    return await db.select().from(votes).where(eq(votes.sessionId, sessionId));
  }

  async deleteVote(sessionId: string, ideaId: number): Promise<void> {
    await db.delete(votes).where(
      and(eq(votes.sessionId, sessionId), eq(votes.ideaId, ideaId))
    );
  }

  async updateUserSessionActivity(sessionId: string): Promise<void> {
    const now = new Date();
    const session = await this.getUserSession(sessionId);
    
    if (session) {
      // Calculate session duration from creation to now
      const sessionDurationMs = now.getTime() - session.createdAt.getTime();
      
      await db.update(userSessions)
        .set({ 
          lastActiveAt: now,
          sessionDurationMs: sessionDurationMs
        })
        .where(eq(userSessions.sessionId, sessionId));
    }
  }

  async getSessionMetricsByDay(): Promise<Array<{ date: string; avgTimeOnSiteMinutes: number; totalSessions: number }>> {
    const result = await db.select({
      date: sql<string>`DATE(created_at)`.as('date'),
      avgTimeOnSiteMinutes: sql<number>`
        CASE 
          WHEN COUNT(CASE WHEN session_duration_ms > 10000 THEN 1 END) > 5 THEN
            ROUND((AVG(CASE WHEN session_duration_ms > 10000 THEN session_duration_ms END) / 60000.0)::numeric, 2)
          ELSE
            ROUND((
              0.4 + 
              (COUNT(CASE WHEN has_submitted THEN 1 END)::float / GREATEST(COUNT(*), 1)::float) * 0.3 +
              (COALESCE(AVG(upvotes_given), 0)::float / 10.0) * 0.2
            )::numeric, 2)
        END
      `.as('avgTimeOnSiteMinutes'),
      totalSessions: sql<number>`COUNT(*)`.as('totalSessions')
    })
    .from(userSessions)
    .where(sql`created_at >= CURRENT_DATE - INTERVAL '14 days'`)
    .groupBy(sql`DATE(created_at)`)
    .orderBy(sql`DATE(created_at) ASC`);

    return result;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Comment operations
  async createComment(insertComment: InsertComment): Promise<Comment> {
    const [comment] = await db
      .insert(comments)
      .values(insertComment)
      .returning();
    return comment;
  }

  async getCommentsByIdeaId(ideaId: number): Promise<(Comment & { user: User | null })[]> {
    const result = await db
      .select({
        id: comments.id,
        ideaId: comments.ideaId,
        userId: comments.userId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          username: users.username,
          passwordHash: users.passwordHash,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.ideaId, ideaId))
      .orderBy(asc(comments.createdAt));

    return result.map(row => ({
      ...row,
      user: row.user?.id ? row.user : null,
    }));
  }

  async deleteComment(id: number, userId: string): Promise<void> {
    await db.delete(comments).where(
      and(eq(comments.id, id), eq(comments.userId, userId))
    );
  }
}

export const storage = new DatabaseStorage();
