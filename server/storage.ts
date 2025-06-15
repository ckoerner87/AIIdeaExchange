import { 
  ideas, 
  subscriptions, 
  userSessions, 
  votes,
  users,
  comments,
  commentVotes,
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
  type InsertComment,
  type CommentVote,
  type InsertCommentVote
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or, isNull, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // Ideas
  createIdea(idea: InsertIdea & { sessionId: string }): Promise<Idea>;
  getIdeas(sortBy?: 'votes' | 'recent' | 'comments', category?: string, tool?: string): Promise<Idea[]>;
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
  getRecentlySubmittedIdea(sessionId: string): Promise<Idea | undefined>;
  
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
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: { username: string; email: string; passwordHash: string }): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Comments
  createComment(comment: InsertComment): Promise<Comment>;
  getCommentsByIdeaId(ideaId: number): Promise<(Comment & { user: User | null })[]>;
  getCommentById(id: number): Promise<Comment | undefined>;
  getAllComments(): Promise<(Comment & { user: User | null; idea: { useCase: string } })[]>;
  deleteComment(id: number, userId: string): Promise<void>;
  adminDeleteComment(id: number): Promise<void>;
  bulkDeleteComments(ids: number[]): Promise<void>;
  
  // Comment voting
  voteOnComment(commentId: number, sessionId: string, ipAddress: string, voteType: 'up' | 'down'): Promise<void>;
  getCommentVote(commentId: number, sessionId: string): Promise<CommentVote | undefined>;
  updateCommentVotes(commentId: number, votes: number): Promise<void>;
  getRecentCommentVotesBySession(sessionId: string, timeWindowMs: number): Promise<CommentVote[]>;
  getRecentCommentVotesByIp(ipAddress: string, timeWindowMs: number): Promise<CommentVote[]>;
  updateCommentUsername(commentId: number, sessionId: string, username: string): Promise<void>;
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
      votes: 1
    };
    
    const [idea] = await db
      .insert(ideas)
      .values(ideaData)
      .returning();
    return idea;
  }

  async getIdeas(sortBy: 'votes' | 'recent' | 'comments' = 'votes', category?: string, tool?: string): Promise<Idea[]> {
    // Always include comment count for all queries
    const query = db
      .select({
        id: ideas.id,
        sessionId: ideas.sessionId,
        title: ideas.title,
        description: ideas.description,
        useCase: ideas.useCase,
        category: ideas.category,
        tools: ideas.tools,
        linkUrl: ideas.linkUrl,
        aiGrade: ideas.aiGrade,
        votes: ideas.votes,
        submittedAt: ideas.submittedAt,
        commentCount: sql<number>`COALESCE(COUNT(${comments.id}), 0)`.as('commentCount')
      })
      .from(ideas)
      .leftJoin(comments, eq(ideas.id, comments.ideaId))
      .groupBy(ideas.id);

    const conditions = [];
    
    if (category && category !== 'All') {
      if (category.toLowerCase() === 'other') {
        conditions.push(or(eq(ideas.category, 'Other'), eq(ideas.category, 'other'), isNull(ideas.category)));
      } else {
        conditions.push(eq(ideas.category, category));
      }
    }
    
    if (tool && tool !== 'All') {
      if (tool.toLowerCase() === 'other') {
        conditions.push(or(eq(ideas.tools, 'Other'), eq(ideas.tools, 'other'), isNull(ideas.tools)));
      } else {
        conditions.push(sql`LOWER(${ideas.tools}) = LOWER(${tool})`);
      }
    }
    
    let finalQuery = query;
    if (conditions.length > 0) {
      finalQuery = query.where(and(...conditions)) as any;
    }
    
    if (sortBy === 'comments') {
      const results = await finalQuery.orderBy(sql`commentCount DESC`);
      // Convert results back to Idea format (remove commentCount)
      return results.map(({ commentCount, ...idea }) => idea as Idea);
    } else if (sortBy === 'votes') {
      const results = await finalQuery.orderBy(desc(ideas.votes));
      // Convert results back to Idea format (remove commentCount)
      return results.map(({ commentCount, ...idea }) => idea as Idea);
    } else {
      const results = await finalQuery.orderBy(desc(ideas.submittedAt));
      // Convert results back to Idea format (remove commentCount)
      return results.map(({ commentCount, ...idea }) => idea as Idea);
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

  async getRecentlySubmittedIdea(sessionId: string): Promise<Idea | undefined> {
    // Get the most recent idea submitted by this session (within last 30 seconds)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const [recentIdea] = await db.select().from(ideas)
      .where(and(
        eq(ideas.sessionId, sessionId),
        sql`${ideas.submittedAt} > ${thirtySecondsAgo}`
      ))
      .orderBy(desc(ideas.submittedAt))
      .limit(1);
    return recentIdea || undefined;
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
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: { username: string; email: string; passwordHash: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        username: userData.username,
        email: userData.email,
        passwordHash: userData.passwordHash,
      })
      .returning();
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
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
        parentId: comments.parentId,
        sessionId: comments.sessionId,
        anonymousUsername: comments.anonymousUsername,
        content: comments.content,
        votes: comments.votes,
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

  async getCommentById(id: number): Promise<Comment | undefined> {
    const [comment] = await db.select().from(comments).where(eq(comments.id, id));
    return comment;
  }

  async getCommentCountByIdeaId(ideaId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(eq(comments.ideaId, ideaId));
    
    return result?.count || 0;
  }

  async getAllComments(): Promise<(Comment & { user: User | null; idea: { useCase: string } })[]> {
    const result = await db
      .select({
        id: comments.id,
        ideaId: comments.ideaId,
        userId: comments.userId,
        parentId: comments.parentId,
        content: comments.content,
        votes: comments.votes,
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
        idea: {
          useCase: ideas.useCase,
        },
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .leftJoin(ideas, eq(comments.ideaId, ideas.id))
      .orderBy(desc(comments.createdAt));

    return result.map(row => ({
      ...row,
      user: row.user?.id ? row.user : null,
      idea: { useCase: row.idea?.useCase || "" },
    }));
  }

  async adminDeleteComment(id: number): Promise<void> {
    await db.delete(comments).where(eq(comments.id, id));
  }

  async bulkDeleteComments(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    
    // Use OR conditions for each ID
    const conditions = ids.map(id => eq(comments.id, id));
    await db.delete(comments).where(
      or(...conditions)
    );
  }

  async deleteComment(id: number, userId: string): Promise<void> {
    await db.delete(comments).where(
      and(eq(comments.id, id), eq(comments.userId, userId))
    );
  }

  // Comment voting methods
  async voteOnComment(commentId: number, sessionId: string, ipAddress: string, voteType: 'up' | 'down'): Promise<void> {
    // Check if user already voted on this comment
    const existingVote = await db
      .select()
      .from(commentVotes)
      .where(and(
        eq(commentVotes.commentId, commentId),
        eq(commentVotes.sessionId, sessionId)
      ))
      .limit(1);

    if (existingVote.length > 0) {
      // Update existing vote
      await db
        .update(commentVotes)
        .set({ voteType, createdAt: new Date() })
        .where(and(
          eq(commentVotes.commentId, commentId),
          eq(commentVotes.sessionId, sessionId)
        ));
    } else {
      // Create new vote
      await db.insert(commentVotes).values({
        commentId,
        sessionId,
        ipAddress,
        voteType,
      });
    }

    // Recalculate and update comment vote count
    const voteCount = await db
      .select({
        upvotes: sql<number>`count(case when ${commentVotes.voteType} = 'up' then 1 end)`,
        downvotes: sql<number>`count(case when ${commentVotes.voteType} = 'down' then 1 end)`,
      })
      .from(commentVotes)
      .where(eq(commentVotes.commentId, commentId));

    const totalVotes = (voteCount[0]?.upvotes || 0) - (voteCount[0]?.downvotes || 0);
    
    await db
      .update(comments)
      .set({ votes: totalVotes })
      .where(eq(comments.id, commentId));
  }

  async getCommentVote(commentId: number, sessionId: string): Promise<CommentVote | undefined> {
    const [vote] = await db
      .select()
      .from(commentVotes)
      .where(and(
        eq(commentVotes.commentId, commentId),
        eq(commentVotes.sessionId, sessionId)
      ));
    return vote;
  }

  async updateCommentVotes(commentId: number, votes: number): Promise<void> {
    await db
      .update(comments)
      .set({ votes })
      .where(eq(comments.id, commentId));
  }

  async getRecentCommentVotesBySession(sessionId: string, timeWindowMs: number): Promise<CommentVote[]> {
    const cutoffTime = new Date(Date.now() - timeWindowMs);
    return await db
      .select()
      .from(commentVotes)
      .where(and(
        eq(commentVotes.sessionId, sessionId),
        sql`${commentVotes.createdAt} > ${cutoffTime}`
      ));
  }

  async getRecentCommentVotesByIp(ipAddress: string, timeWindowMs: number): Promise<CommentVote[]> {
    const cutoffTime = new Date(Date.now() - timeWindowMs);
    return await db
      .select()
      .from(commentVotes)
      .where(and(
        eq(commentVotes.ipAddress, ipAddress),
        sql`${commentVotes.createdAt} > ${cutoffTime}`
      ));
  }

  async updateCommentUsername(commentId: number, sessionId: string, username: string): Promise<void> {
    // Add a username field to comments table if it doesn't exist and update the comment
    // For now, we'll store it in a separate table to track anonymous comment usernames
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS comment_usernames (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        username TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(comment_id, session_id)
      )
    `);
    
    // Insert or update the username for this comment
    await db.execute(sql`
      INSERT INTO comment_usernames (comment_id, session_id, username)
      VALUES (${commentId}, ${sessionId}, ${username})
      ON CONFLICT (comment_id, session_id)
      DO UPDATE SET username = ${username}
    `);
  }
}

export const storage = new DatabaseStorage();
