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
import { eq, desc, asc, and } from "drizzle-orm";

export interface IStorage {
  // Ideas
  createIdea(idea: InsertIdea): Promise<Idea>;
  getIdeas(sortBy?: 'votes' | 'recent'): Promise<Idea[]>;
  getIdeaById(id: number): Promise<Idea | undefined>;
  updateIdeaVotes(id: number, votes: number): Promise<void>;
  
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
  deleteVote(sessionId: string, ideaId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Ideas
  async createIdea(insertIdea: InsertIdea): Promise<Idea> {
    const [idea] = await db
      .insert(ideas)
      .values(insertIdea)
      .returning();
    return idea;
  }

  async getIdeas(sortBy: 'votes' | 'recent' = 'votes'): Promise<Idea[]> {
    if (sortBy === 'votes') {
      return await db.select().from(ideas).orderBy(desc(ideas.votes));
    } else {
      return await db.select().from(ideas).orderBy(desc(ideas.submittedAt));
    }
  }

  async getIdeaById(id: number): Promise<Idea | undefined> {
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
    return idea || undefined;
  }

  async updateIdeaVotes(id: number, votes: number): Promise<void> {
    await db.update(ideas).set({ votes }).where(eq(ideas.id, id));
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

  async deleteVote(sessionId: string, ideaId: number): Promise<void> {
    await db.delete(votes).where(
      and(eq(votes.sessionId, sessionId), eq(votes.ideaId, ideaId))
    );
  }
}

export const storage = new DatabaseStorage();
