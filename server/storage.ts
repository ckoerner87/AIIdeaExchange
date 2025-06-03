import { 
  ideas, 
  subscriptions, 
  userSessions, 
  votes,
  type Idea, 
  type InsertIdea,
  type Subscription,
  type InsertSubscription,
  type UserSession,
  type InsertUserSession,
  type Vote,
  type InsertVote
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or, isNull } from "drizzle-orm";

export interface IStorage {
  // Ideas
  createIdea(idea: InsertIdea): Promise<Idea>;
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
  
  // Votes
  createVote(vote: InsertVote): Promise<Vote>;
  getUserVoteForIdea(sessionId: string, ideaId: number): Promise<Vote | undefined>;
  getVoteByIpAndIdea(ipAddress: string, ideaId: number): Promise<Vote | undefined>;
  deleteVote(sessionId: string, ideaId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Ideas
  async createIdea(insertIdea: InsertIdea): Promise<Idea> {
    // Ensure category defaults to "other" if not provided
    const ideaData = {
      ...insertIdea,
      category: insertIdea.category || "other"
    };
    
    const [idea] = await db
      .insert(ideas)
      .values([ideaData])
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
        conditions.push(eq(ideas.tools, tool));
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

  async deleteVote(sessionId: string, ideaId: number): Promise<void> {
    await db.delete(votes).where(
      and(eq(votes.sessionId, sessionId), eq(votes.ideaId, ideaId))
    );
  }
}

export const storage = new DatabaseStorage();
