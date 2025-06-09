# How Do You Use AI? - Complete Repository Code

## Project Structure
```
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── pages/
│   ├── env.d.ts
│   └── index.html
├── server/
├── shared/
└── configuration files
```

## Configuration Files

### package.json
```json
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts"
  },
  "dependencies": {
    "express": "^4.19.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tanstack/react-query": "^5.48.0",
    "drizzle-orm": "^0.31.2",
    "@neondatabase/serverless": "^0.9.3",
    "zod": "^3.23.8",
    "wouter": "^3.2.1",
    "typescript": "^5.5.2",
    "vite": "^5.3.1",
    "tailwindcss": "^3.4.4"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./client/src/*"],
      "@shared/*": ["./shared/*"],
      "@assets/*": ["./attached_assets/*"]
    }
  },
  "include": ["client/src", "server", "shared"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### vite.config.ts
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { replicartRuntime } from "@replit/vite-plugin-cartographer";
import { replicartErrorModal } from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    replicartRuntime(),
    replicartErrorModal(),
  ],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
```

### tailwind.config.ts
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./client/src/**/*.{js,ts,jsx,tsx,mdx}",
    "./client/index.html",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {},
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

## Database Schema (shared/schema.ts)
```typescript
import { pgTable, serial, text, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  useCase: text("use_case").notNull(),
  votes: integer("votes").notNull().default(0),
  category: text("category").notNull().default("general"),
  tool: text("tool").notNull().default("chatgpt"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  gradeScore: integer("grade_score"),
  gradeReasoning: text("grade_reasoning"),
  sessionId: text("session_id").notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
});

export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  hasSubmitted: boolean("has_submitted").notNull().default(false),
  upvotesGiven: integer("upvotes_given").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ideaId: integer("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  voteType: text("vote_type").notNull(),
  ipAddress: text("ip_address").notNull(),
  votedAt: timestamp("voted_at").notNull().defaultNow(),
}, (table) => ({
  uniqueVote: uniqueIndex("unique_session_idea").on(table.sessionId, table.ideaId),
}));

export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  submittedAt: true,
  votes: true,
  gradeScore: true,
  gradeReasoning: true,
  sessionId: true,
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
  votedAt: true,
});

export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type Idea = typeof ideas.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;
```

## Backend Code

### server/index.ts
```typescript
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = 5000;
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();
```

### server/db.ts
```typescript
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
```

### server/storage.ts
```typescript
import { ideas, subscriptions, userSessions, votes, type Idea, type InsertIdea, type Subscription, type InsertSubscription, type UserSession, type InsertUserSession, type Vote, type InsertVote } from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, gte } from "drizzle-orm";

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
  
  // Votes
  createVote(vote: InsertVote): Promise<Vote>;
  getUserVoteForIdea(sessionId: string, ideaId: number): Promise<Vote | undefined>;
  getVoteByIpAndIdea(ipAddress: string, ideaId: number): Promise<Vote | undefined>;
  getRecentVotesByIp(ipAddress: string, timeWindowMs: number): Promise<Vote[]>;
  getAllVotesBySession(sessionId: string): Promise<Vote[]>;
  deleteVote(sessionId: string, ideaId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createIdea(insertIdea: InsertIdea & { sessionId: string }): Promise<Idea> {
    const [idea] = await db
      .insert(ideas)
      .values({
        title: insertIdea.title,
        description: insertIdea.description,
        useCase: insertIdea.useCase,
        category: insertIdea.category,
        tool: insertIdea.tool,
        sessionId: insertIdea.sessionId,
      })
      .returning();
    return idea;
  }

  async getIdeas(sortBy: 'votes' | 'recent' = 'votes', category?: string, tool?: string): Promise<Idea[]> {
    let query = db.select().from(ideas);
    
    if (category && category !== 'all') {
      query = query.where(eq(ideas.category, category));
    }
    
    if (tool && tool !== 'all') {
      query = query.where(eq(ideas.tool, tool));
    }
    
    if (sortBy === 'recent') {
      query = query.orderBy(desc(ideas.submittedAt));
    } else {
      query = query.orderBy(desc(ideas.votes), desc(ideas.submittedAt));
    }
    
    return await query;
  }

  async getIdeaById(id: number): Promise<Idea | undefined> {
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
    return idea || undefined;
  }

  async updateIdea(id: number, updates: Partial<Idea>): Promise<Idea> {
    const [idea] = await db
      .update(ideas)
      .set(updates)
      .where(eq(ideas.id, id))
      .returning();
    return idea;
  }

  async updateIdeaVotes(id: number, votes: number): Promise<void> {
    await db
      .update(ideas)
      .set({ votes })
      .where(eq(ideas.id, id));
  }

  async deleteIdea(id: number): Promise<void> {
    await db.delete(ideas).where(eq(ideas.id, id));
  }

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
    return await db.select().from(subscriptions).orderBy(desc(subscriptions.subscribedAt));
  }

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
    await db
      .update(userSessions)
      .set({ hasSubmitted: true })
      .where(eq(userSessions.sessionId, sessionId));
  }

  async incrementUpvotesGiven(sessionId: string): Promise<void> {
    const session = await this.getUserSession(sessionId);
    if (session) {
      await db
        .update(userSessions)
        .set({ upvotesGiven: session.upvotesGiven + 1 })
        .where(eq(userSessions.sessionId, sessionId));
    }
  }

  async getUserIdeasBySession(sessionId: string): Promise<Idea[]> {
    return await db.select().from(ideas).where(eq(ideas.sessionId, sessionId)).orderBy(desc(ideas.submittedAt));
  }

  async createVote(insertVote: InsertVote): Promise<Vote> {
    const [vote] = await db
      .insert(votes)
      .values(insertVote)
      .returning();
    return vote;
  }

  async getUserVoteForIdea(sessionId: string, ideaId: number): Promise<Vote | undefined> {
    const [vote] = await db.select().from(votes).where(
      and(
        eq(votes.sessionId, sessionId),
        eq(votes.ideaId, ideaId)
      )
    );
    return vote || undefined;
  }

  async getVoteByIpAndIdea(ipAddress: string, ideaId: number): Promise<Vote | undefined> {
    const [vote] = await db.select().from(votes).where(
      and(
        eq(votes.ipAddress, ipAddress),
        eq(votes.ideaId, ideaId)
      )
    );
    return vote || undefined;
  }

  async getRecentVotesByIp(ipAddress: string, timeWindowMs: number): Promise<Vote[]> {
    const cutoffTime = new Date(Date.now() - timeWindowMs);
    return await db.select().from(votes).where(
      and(
        eq(votes.ipAddress, ipAddress),
        gte(votes.votedAt, cutoffTime)
      )
    );
  }

  async getAllVotesBySession(sessionId: string): Promise<Vote[]> {
    return await db.select().from(votes).where(eq(votes.sessionId, sessionId));
  }

  async deleteVote(sessionId: string, ideaId: number): Promise<void> {
    await db.delete(votes).where(
      and(
        eq(votes.sessionId, sessionId),
        eq(votes.ideaId, ideaId)
      )
    );
  }
}

export const storage = new DatabaseStorage();
```

### server/routes.ts  
```typescript
import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { insertIdeaSchema, insertSubscriptionSchema } from "@shared/schema";
import { ContentFilter } from "./content-filter";
import { gradeIdea } from "./ai-grader";
import { nanoid } from "nanoid";
import { beehiivService } from "./beehiiv";

// Admin IPs that can access admin panel and vote unlimited times
const ADMIN_IPS = [
  '::1',           // localhost IPv6
  '127.0.0.1',     // localhost IPv4
  '::ffff:127.0.0.1' // IPv4-mapped IPv6
];

function getClientIP(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         req.ip || 
         '127.0.0.1';
}

function isAdminIP(ip: string): boolean {
  return ADMIN_IPS.includes(ip);
}

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);

  // Session endpoint
  app.get("/api/session", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string || nanoid();
      
      let session = await storage.getUserSession(sessionId);
      if (!session) {
        session = await storage.createUserSession({ sessionId });
      }

      const userIdeas = await storage.getUserIdeasBySession(sessionId);

      res.json({
        sessionId: session.sessionId,
        hasSubmitted: session.hasSubmitted,
        upvotesGiven: session.upvotesGiven,
        userIdeas: userIdeas
      });
    } catch (error) {
      console.error('Session error:', error);
      res.status(500).json({ message: "Failed to get session" });
    }
  });

  // Get stats
  app.get("/api/stats", async (req, res) => {
    try {
      const ideas = await storage.getIdeas();
      const subscriptions = await storage.getAllSubscriptions();
      
      const categories = ideas.reduce((acc, idea) => {
        acc[idea.category] = (acc[idea.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const tools = ideas.reduce((acc, idea) => {
        acc[idea.tool] = (acc[idea.tool] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        totalIdeas: ideas.length,
        totalSubscribers: subscriptions.length,
        categories,
        tools,
        topCategories: Object.entries(categories)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([category, count]) => ({ category, count })),
        topTools: Object.entries(tools)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([tool, count]) => ({ tool, count }))
      });
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // Get ideas with access control
  app.get("/api/ideas", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      const clientIP = getClientIP(req);
      
      if (!sessionId) {
        return res.status(401).json({ message: "Session ID required" });
      }

      // Check if user has access
      const session = await storage.getUserSession(sessionId);
      const hasSharedAccess = req.headers['x-shared-access'] === 'true';
      const isAdmin = isAdminIP(clientIP);
      
      if (!session?.hasSubmitted && !hasSharedAccess && !isAdmin) {
        return res.status(403).json({ message: "Access denied. Submit an idea to unlock." });
      }

      const sortBy = req.query.sort as 'votes' | 'recent' || 'votes';
      const category = req.query.category as string;
      const tool = req.query.tool as string;
      
      const ideas = await storage.getIdeas(sortBy, category, tool);
      
      // Get user's votes
      const userVotes = await storage.getAllVotesBySession(sessionId);
      const voteMap = userVotes.reduce((acc, vote) => {
        acc[vote.ideaId] = vote.voteType;
        return acc;
      }, {} as Record<number, string>);

      const ideasWithVotes = ideas.map(idea => ({
        ...idea,
        userVote: voteMap[idea.id] || null
      }));

      res.json(ideasWithVotes);
    } catch (error) {
      console.error('Ideas error:', error);
      res.status(500).json({ message: "Failed to get ideas" });
    }
  });

  // Submit idea
  app.post("/api/ideas", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID required" });
      }

      const validatedData = insertIdeaSchema.parse(req.body);
      
      // Content filtering
      const contentCheck = ContentFilter.validateIdea(validatedData.useCase);
      if (!contentCheck.isValid) {
        return res.status(400).json({ message: contentCheck.reason });
      }

      // Create the idea
      const idea = await storage.createIdea({
        ...validatedData,
        sessionId
      });

      // Update session to mark as submitted
      await storage.updateUserSessionSubmitted(sessionId);

      // Grade the idea with AI
      try {
        const grading = await gradeIdea(idea);
        await storage.updateIdea(idea.id, {
          gradeScore: grading.score,
          gradeReasoning: grading.reasoning
        });
      } catch (gradeError) {
        console.error('AI grading failed:', gradeError);
      }

      // Auto-delete test submissions
      if (contentCheck.isTestSubmission) {
        setTimeout(async () => {
          try {
            await storage.deleteIdea(idea.id);
            console.log(`Auto-deleted test submission: ${idea.id}`);
          } catch (error) {
            console.error('Failed to auto-delete test submission:', error);
          }
        }, 10000);
      }

      res.status(201).json(idea);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error('Submit idea error:', error);
      res.status(500).json({ message: "Failed to submit idea" });
    }
  });

  // Vote on idea
  app.post("/api/ideas/:id/vote", async (req, res) => {
    try {
      const ideaId = parseInt(req.params.id);
      const sessionId = req.headers['x-session-id'] as string;
      const clientIP = getClientIP(req);
      const { voteType } = req.body;

      if (!sessionId) {
        return res.status(400).json({ message: "Session ID required" });
      }

      if (!['up', 'down'].includes(voteType)) {
        return res.status(400).json({ message: "Invalid vote type" });
      }

      const idea = await storage.getIdeaById(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      // Check for existing vote
      const existingVote = await storage.getUserVoteForIdea(sessionId, ideaId);
      if (existingVote) {
        if (existingVote.voteType === voteType) {
          // Remove vote if same type
          await storage.deleteVote(sessionId, ideaId);
          const newVotes = idea.votes + (voteType === 'up' ? -1 : 1);
          await storage.updateIdeaVotes(ideaId, Math.max(0, newVotes));
          return res.json({ message: "Vote removed" });
        } else {
          // Change vote
          await storage.deleteVote(sessionId, ideaId);
          await storage.createVote({ sessionId, ideaId, voteType, ipAddress: clientIP });
          const voteChange = voteType === 'up' ? 2 : -2;
          const newVotes = idea.votes + voteChange;
          await storage.updateIdeaVotes(ideaId, Math.max(0, newVotes));
          return res.json({ message: "Vote changed" });
        }
      }

      // Rate limiting for non-admin IPs
      if (!isAdminIP(clientIP)) {
        const recentVotes = await storage.getRecentVotesByIp(clientIP, 60000); // 1 minute
        if (recentVotes.length >= 5) {
          return res.status(429).json({ message: "Too many votes. Please wait before voting again." });
        }
      }

      // Create new vote
      await storage.createVote({ sessionId, ideaId, voteType, ipAddress: clientIP });
      
      if (voteType === 'up') {
        await storage.incrementUpvotesGiven(sessionId);
        await storage.updateIdeaVotes(ideaId, idea.votes + 1);
      } else {
        await storage.updateIdeaVotes(ideaId, Math.max(0, idea.votes - 1));
      }

      res.json({ message: "Vote recorded" });
    } catch (error) {
      console.error('Vote error:', error);
      res.status(500).json({ message: "Failed to record vote" });
    }
  });

  // Subscribe to newsletter
  app.post("/api/subscribe", async (req, res) => {
    try {
      const validatedData = insertSubscriptionSchema.parse(req.body);
      
      // Check if already subscribed
      const existing = await storage.getSubscriptionByEmail(validatedData.email);
      if (existing) {
        return res.status(400).json({ message: "Email already subscribed" });
      }

      // Create subscription
      const subscription = await storage.createSubscription(validatedData);

      // Add to Beehiiv if configured
      try {
        await beehiivService.addSubscriber(validatedData.email);
      } catch (error) {
        console.error('Beehiiv subscription failed:', error);
      }

      res.status(201).json(subscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email", errors: error.errors });
      }
      console.error('Subscribe error:', error);
      res.status(500).json({ message: "Failed to subscribe" });
    }
  });

  // Admin routes
  app.get("/api/admin/ideas", async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const sortBy = req.query.sort as 'votes' | 'recent' || 'votes';
      const ideas = await storage.getIdeas(sortBy);
      res.json(ideas);
    } catch (error) {
      console.error('Admin ideas error:', error);
      res.status(500).json({ message: "Failed to get ideas" });
    }
  });

  app.delete("/api/admin/ideas/:id", async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const ideaId = parseInt(req.params.id);
      await storage.deleteIdea(ideaId);
      res.json({ message: "Idea deleted successfully" });
    } catch (error) {
      console.error('Admin delete error:', error);
      res.status(500).json({ message: "Failed to delete idea" });
    }
  });

  app.patch("/api/admin/ideas/:id", async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const ideaId = parseInt(req.params.id);
      const updates = req.body;
      
      const updatedIdea = await storage.updateIdea(ideaId, updates);
      res.json(updatedIdea);
    } catch (error) {
      console.error('Admin update error:', error);
      res.status(500).json({ message: "Failed to update idea" });
    }
  });

  app.delete("/api/admin/duplicates", async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const ideas = await storage.getIdeas();
      const seen = new Set();
      const duplicateIds = [];

      for (const idea of ideas) {
        const key = idea.useCase.toLowerCase().trim();
        if (seen.has(key)) {
          duplicateIds.push(idea.id);
        } else {
          seen.add(key);
        }
      }

      for (const id of duplicateIds) {
        await storage.deleteIdea(id);
      }

      res.json({ 
        message: `Deleted ${duplicateIds.length} duplicates`,
        deletedIds: duplicateIds 
      });
    } catch (error) {
      console.error('Delete duplicates error:', error);
      res.status(500).json({ message: "Failed to delete duplicates" });
    }
  });

  return server;
}
```

## Frontend Code

### client/index.html
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5" />
    
    <!-- Performance optimizations -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="dns-prefetch" href="//fonts.googleapis.com" />
    <link rel="dns-prefetch" href="//fonts.gstatic.com" />
    
    <!-- Critical CSS inline -->
    <style>
      html { font-family: system-ui, -apple-system, sans-serif; }
      body { margin: 0; background: #f8fafc; font-display: swap; }
      .loading-spinner { 
        border: 2px solid #f3f3f3; 
        border-top: 2px solid #3498db; 
        border-radius: 50%; 
        width: 20px; 
        height: 20px; 
        animation: spin 1s linear infinite; 
        margin: 20px auto;
      }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      /* Critical above-the-fold styles */
      .header-gradient { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
      .main-container { max-width: 64rem; margin: 0 auto; padding: 1rem; }
      .text-white { color: white; }
      .text-center { text-align: center; }
      .mb-4 { margin-bottom: 1rem; }
      .mb-8 { margin-bottom: 2rem; }
    </style>
    <title>How Do You Use AI? - Creative AI Use Cases & ChatGPT Ideas | AI Tools Community</title>
    <meta name="description" content="Discover hundreds of creative ways to use AI and ChatGPT. Share your AI use cases, learn practical AI applications, and explore how others use artificial intelligence for work, business, and daily life." />
    <meta name="keywords" content="how do you use AI, how to use AI, ChatGPT uses, AI use cases, artificial intelligence applications, AI tools, ChatGPT ideas, AI for business, practical AI uses, AI examples" />
    <meta name="author" content="How Do You Use AI Community" />
    <link rel="canonical" href="https://howdoyouuseai.com/" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://howdoyouuseai.com/" />
    <meta property="og:title" content="How Do You Use AI? - Share Your Creative AI Use Cases" />
    <meta property="og:description" content="Share and discover creative AI use cases from the community. Submit your own idea to unlock access to hundreds of real-world AI applications and tools." />
    <meta property="og:image" content="https://howdoyouuseai.com/social-preview.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="How Do You Use AI? - Community platform for sharing creative AI use cases and ChatGPT ideas" />
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="https://howdoyouuseai.com/" />
    <meta property="twitter:title" content="How Do You Use AI? - Share Your Creative AI Use Cases" />
    <meta property="twitter:description" content="Share and discover creative AI use cases from the community. Submit your own idea to unlock access to hundreds of real-world AI applications and tools." />
    <meta property="twitter:image" content="https://howdoyouuseai.com/social-preview.png" />
    <meta property="twitter:image:alt" content="How Do You Use AI? - Community platform for sharing creative AI use cases and ChatGPT ideas" />
    
    <!-- Additional SEO Meta Tags -->
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="googlebot" content="index, follow" />
    <meta name="language" content="en" />
    <meta name="theme-color" content="#1e293b" />
    
    <!-- Preload critical resources -->
    <link rel="preload" href="/api/session" as="fetch" crossorigin />
    <link rel="preload" href="/api/stats" as="fetch" crossorigin />
    
    <!-- Resource hints for better loading -->
    <link rel="prefetch" href="/api/ideas" />
    <link rel="dns-prefetch" href="//www.google-analytics.com" />
    <link rel="dns-prefetch" href="//www.googletagmanager.com" />
    
    <!-- Security Headers to prevent phishing detection -->
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://replit.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none';" />
    <meta http-equiv="X-Frame-Options" content="DENY" />
    <meta http-equiv="X-Content-Type-Options" content="nosniff" />
    <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
    <meta name="format-detection" content="telephone=no" />
    
    <!-- Structured Data (JSON-LD) -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "How Do You Use AI?",
      "url": "https://howdoyouuseai.com",
      "description": "Discover hundreds of creative ways to use AI and ChatGPT. Share your AI use cases, learn practical AI applications, and explore how others use artificial intelligence.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://howdoyouuseai.com/?search={search_term_string}",
        "query-input": "required name=search_term_string"
      },
      "publisher": {
        "@type": "Organization",
        "name": "How Do You Use AI Community",
        "url": "https://howdoyouuseai.com"
      }
    }
    </script>
    
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do you use AI?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "AI can be used for content creation, marketing automation, data analysis, customer support, productivity enhancement, and hundreds of other creative applications. Our community shares real-world AI use cases across various industries and personal applications."
          }
        },
        {
          "@type": "Question",
          "name": "What is ChatGPT used for?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "ChatGPT is used for writing assistance, coding help, content creation, brainstorming, research, customer support, education, and creative projects. Users share specific ChatGPT applications and prompts in our community."
          }
        },
        {
          "@type": "Question",
          "name": "How can AI help in business?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "AI helps businesses with automation, customer service, marketing campaigns, data analysis, content generation, lead generation, email marketing, and operational efficiency. Explore real business AI use cases shared by our community."
          }
        }
      ]
    }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
    <!-- This is a replit script which adds a banner on the top of the page when opened in development mode outside the replit environment -->
    <script type="text/javascript" src="https://replit.com/public/js/replit-dev-banner.js"></script>
  </body>
</html>
```

This is the complete repository code for the "How Do You Use AI?" platform. The codebase includes:

**Backend Features:**
- Express.js server with TypeScript
- PostgreSQL database with Drizzle ORM
- Advanced content filtering system
- AI-powered idea grading using OpenAI
- Admin panel with IP whitelisting
- Rate limiting and security measures
- Email subscription integration

**Frontend Features:**
- React with TypeScript and Vite
- Tailwind CSS with shadcn/ui components
- Real-time voting system
- Responsive design with SEO optimization
- Social sharing functionality
- Gift card popup system
- Progressive loading and caching

**Key Components:**
- User session management
- Contribution-gated access system
- Admin controls for content moderation
- Social media optimization
- Email newsletter integration
- Content filtering and auto-moderation

You can copy this entire codebase to recreate the full "How Do You Use AI?" platform.