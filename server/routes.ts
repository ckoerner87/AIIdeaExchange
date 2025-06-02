import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertIdeaSchema, insertSubscriptionSchema, insertUserSessionSchema, insertVoteSchema } from "@shared/schema";
import { nanoid } from "nanoid";
import { ContentFilter } from "./content-filter";
import { googleSheetsService } from "./google-sheets";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get or create user session
  app.get("/api/session", async (req, res) => {
    try {
      let sessionId = req.headers['x-session-id'] as string;
      
      if (!sessionId) {
        sessionId = nanoid();
        const session = await storage.createUserSession({ 
          sessionId, 
          hasSubmitted: false 
        });
        return res.json({ sessionId, hasSubmitted: session.hasSubmitted });
      }

      const session = await storage.getUserSession(sessionId);
      if (!session) {
        const newSession = await storage.createUserSession({ 
          sessionId, 
          hasSubmitted: false 
        });
        return res.json({ sessionId, hasSubmitted: newSession.hasSubmitted });
      }

      res.json({ sessionId, hasSubmitted: session.hasSubmitted });
    } catch (error) {
      res.status(500).json({ message: "Failed to get session" });
    }
  });

  // Submit an idea
  app.post("/api/ideas", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(401).json({ message: "Session ID required" });
      }

      const result = insertIdeaSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid idea data", errors: result.error.errors });
      }

      // Validate content with content filter
      const contentValidation = ContentFilter.validateIdea(
        result.data.useCase
      );
      
      if (!contentValidation.isValid) {
        return res.status(400).json({ message: "Sorry, but that isn't helpful enough" });
      }

      const idea = await storage.createIdea(result.data);
      await storage.updateUserSessionSubmitted(sessionId);
      
      res.json(idea);
    } catch (error) {
      res.status(500).json({ message: "Failed to create idea" });
    }
  });

  // Get all ideas (only if user has submitted)
  app.get("/api/ideas", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(401).json({ message: "Session ID required" });
      }

      const session = await storage.getUserSession(sessionId);
      if (!session || !session.hasSubmitted) {
        return res.status(403).json({ message: "Must submit an idea first" });
      }

      const sortBy = req.query.sort as 'votes' | 'recent' || 'votes';
      const ideas = await storage.getIdeas(sortBy);
      
      res.json(ideas);
    } catch (error) {
      res.status(500).json({ message: "Failed to get ideas" });
    }
  });

  // Vote on an idea
  app.post("/api/ideas/:id/vote", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(401).json({ message: "Session ID required" });
      }

      const session = await storage.getUserSession(sessionId);
      if (!session || !session.hasSubmitted) {
        return res.status(403).json({ message: "Must submit an idea first" });
      }

      const ideaId = parseInt(req.params.id);
      const { voteType } = req.body; // 'up' or 'down'

      if (!['up', 'down'].includes(voteType)) {
        return res.status(400).json({ message: "Invalid vote type" });
      }

      const idea = await storage.getIdeaById(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      // Check if user already voted
      const existingVote = await storage.getUserVoteForIdea(sessionId, ideaId);
      
      if (existingVote) {
        if (existingVote.voteType === voteType) {
          // Remove vote if clicking same vote type
          await storage.deleteVote(sessionId, ideaId);
          const newVotes = voteType === 'up' ? idea.votes - 1 : idea.votes + 1;
          await storage.updateIdeaVotes(ideaId, newVotes);
          return res.json({ votes: newVotes, userVote: null });
        } else {
          // Change vote type
          await storage.deleteVote(sessionId, ideaId);
          await storage.createVote({ sessionId, ideaId, voteType });
          const voteChange = voteType === 'up' ? 2 : -2; // Change from down to up or vice versa
          const newVotes = idea.votes + voteChange;
          await storage.updateIdeaVotes(ideaId, newVotes);
          return res.json({ votes: newVotes, userVote: voteType });
        }
      } else {
        // New vote
        await storage.createVote({ sessionId, ideaId, voteType });
        const voteChange = voteType === 'up' ? 1 : -1;
        const newVotes = idea.votes + voteChange;
        await storage.updateIdeaVotes(ideaId, newVotes);
        return res.json({ votes: newVotes, userVote: voteType });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to vote" });
    }
  });

  // Subscribe to weekly digest
  app.post("/api/subscribe", async (req, res) => {
    try {
      const result = insertSubscriptionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid email", errors: result.error.errors });
      }

      // Check if already subscribed
      const existing = await storage.getSubscriptionByEmail(result.data.email);
      if (existing) {
        return res.status(409).json({ message: "Email already subscribed" });
      }

      const subscription = await storage.createSubscription(result.data);
      
      // Add email to Google Sheets
      try {
        await googleSheetsService.addEmailToSheet(result.data.email);
      } catch (sheetsError) {
        console.error('Failed to add email to Google Sheets:', sheetsError);
        // Continue with response even if Google Sheets fails
      }
      
      res.json({ message: "Successfully subscribed", subscription });
    } catch (error) {
      res.status(500).json({ message: "Failed to subscribe" });
    }
  });

  // Get stats
  app.get("/api/stats", async (req, res) => {
    try {
      const ideas = await storage.getIdeas();
      const subscriptions = await storage.getAllSubscriptions();
      
      res.json({
        totalIdeas: ideas.length,
        totalSubscribers: subscriptions.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
