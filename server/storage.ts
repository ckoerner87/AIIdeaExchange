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

export class MemStorage implements IStorage {
  private ideas: Map<number, Idea>;
  private subscriptions: Map<number, Subscription>;
  private userSessions: Map<string, UserSession>;
  private votes: Map<string, Vote>;
  private currentIdeaId: number;
  private currentSubscriptionId: number;
  private currentSessionId: number;
  private currentVoteId: number;

  constructor() {
    this.ideas = new Map();
    this.subscriptions = new Map();
    this.userSessions = new Map();
    this.votes = new Map();
    this.currentIdeaId = 1;
    this.currentSubscriptionId = 1;
    this.currentSessionId = 1;
    this.currentVoteId = 1;
  }

  // Ideas
  async createIdea(insertIdea: InsertIdea): Promise<Idea> {
    const id = this.currentIdeaId++;
    const idea: Idea = { 
      ...insertIdea, 
      id, 
      votes: 0,
      submittedAt: new Date()
    };
    this.ideas.set(id, idea);
    return idea;
  }

  async getIdeas(sortBy: 'votes' | 'recent' = 'votes'): Promise<Idea[]> {
    const allIdeas = Array.from(this.ideas.values());
    
    if (sortBy === 'votes') {
      return allIdeas.sort((a, b) => b.votes - a.votes);
    } else {
      return allIdeas.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
    }
  }

  async getIdeaById(id: number): Promise<Idea | undefined> {
    return this.ideas.get(id);
  }

  async updateIdeaVotes(id: number, votes: number): Promise<void> {
    const idea = this.ideas.get(id);
    if (idea) {
      idea.votes = votes;
      this.ideas.set(id, idea);
    }
  }

  // Subscriptions
  async createSubscription(insertSubscription: InsertSubscription): Promise<Subscription> {
    const id = this.currentSubscriptionId++;
    const subscription: Subscription = {
      ...insertSubscription,
      id,
      subscribedAt: new Date()
    };
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  async getSubscriptionByEmail(email: string): Promise<Subscription | undefined> {
    return Array.from(this.subscriptions.values()).find(
      (subscription) => subscription.email === email
    );
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values());
  }

  // User Sessions
  async createUserSession(insertSession: InsertUserSession): Promise<UserSession> {
    const id = this.currentSessionId++;
    const session: UserSession = {
      ...insertSession,
      id,
      createdAt: new Date()
    };
    this.userSessions.set(insertSession.sessionId, session);
    return session;
  }

  async getUserSession(sessionId: string): Promise<UserSession | undefined> {
    return this.userSessions.get(sessionId);
  }

  async updateUserSessionSubmitted(sessionId: string): Promise<void> {
    const session = this.userSessions.get(sessionId);
    if (session) {
      session.hasSubmitted = true;
      this.userSessions.set(sessionId, session);
    }
  }

  // Votes
  async createVote(insertVote: InsertVote): Promise<Vote> {
    const id = this.currentVoteId++;
    const vote: Vote = { ...insertVote, id };
    const key = `${insertVote.sessionId}-${insertVote.ideaId}`;
    this.votes.set(key, vote);
    return vote;
  }

  async getUserVoteForIdea(sessionId: string, ideaId: number): Promise<Vote | undefined> {
    const key = `${sessionId}-${ideaId}`;
    return this.votes.get(key);
  }

  async deleteVote(sessionId: string, ideaId: number): Promise<void> {
    const key = `${sessionId}-${ideaId}`;
    this.votes.delete(key);
  }
}

export const storage = new MemStorage();
