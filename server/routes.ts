import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertIdeaSchema, insertSubscriptionSchema, insertUserSessionSchema, insertVoteSchema } from "@shared/schema";
import { nanoid } from "nanoid";
import { ContentFilter } from "./content-filter";
import { googleSheetsService } from "./google-sheets";



// Whitelisted IPs that can vote multiple times (for testing)
const WHITELISTED_IPS = [
  "127.0.0.1",
  "::1",
  "localhost",
  "47.161.63.29"  // Your IP for testing
];

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

      // Content validation
      if (!result.data.useCase || result.data.useCase.trim().length < 1) {
        return res.status(400).json({ message: "Please provide a use case" });
      }

      // Apply content filter
      const contentValidation = ContentFilter.validateIdea(result.data.useCase);
      if (!contentValidation.isValid) {
        return res.status(400).json({ message: contentValidation.reason || "Invalid content" });
      }

      // Add sessionId to the idea data
      const ideaData = { ...result.data, sessionId };
      const idea = await storage.createIdea(ideaData);
      await storage.updateUserSessionSubmitted(sessionId);
      
      res.json(idea);
    } catch (error) {
      console.error("Error creating idea:", error);
      res.status(500).json({ message: "Failed to create idea" });
    }
  });

  // Get all ideas (only if user has submitted or has shared access)
  app.get("/api/ideas", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      const sharedAccess = req.headers['x-shared-access'] as string;
      
      if (!sessionId) {
        return res.status(401).json({ message: "Session ID required" });
      }

      // Check if user has shared access bypass
      if (sharedAccess === 'true') {
        const sortBy = req.query.sort as 'votes' | 'recent' || 'votes';
        const category = req.query.category as string;
        const tool = req.query.tool as string;
        const ideas = await storage.getIdeas(sortBy, category, tool);
        return res.json(ideas);
      }

      // Normal flow - check if user has submitted
      const session = await storage.getUserSession(sessionId);
      if (!session || !session.hasSubmitted) {
        return res.status(403).json({ message: "Must submit an idea first" });
      }

      const sortBy = req.query.sort as 'votes' | 'recent' || 'votes';
      const category = req.query.category as string;
      const tool = req.query.tool as string;
      const ideas = await storage.getIdeas(sortBy, category, tool);
      
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

      // Get client IP address
      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      const isWhitelisted = WHITELISTED_IPS.includes(clientIp as string);
      
      // Rate limiting for all IPs (including whitelisted for rate limits only)
      const recentVotes = await storage.getRecentVotesByIp(clientIp as string, 60000); // Last 1 minute
      if (recentVotes.length >= 5) {
        return res.status(429).json({ message: "Too many votes. Please wait before voting again." });
      }
      
      const veryRecentVotes = await storage.getRecentVotesByIp(clientIp as string, 10000); // Last 10 seconds
      if (veryRecentVotes.length >= 2) {
        return res.status(429).json({ message: "Voting too quickly. Please slow down." });
      }

      // Anti-gaming measures (skip for whitelisted IPs)
      if (!isWhitelisted) {
        // Prevent voting on own submission
        if (idea.sessionId === sessionId) {
          return res.status(400).json({ message: "You cannot vote on your own idea" });
        }
        
        // Check if this IP already voted on ANY idea (one vote total per IP)
        const existingIpVote = await storage.getVoteByIpAndIdea(clientIp as string, ideaId);
        if (existingIpVote) {
          return res.status(400).json({ message: "You can only vote once per idea from this location" });
        }
      }
      
      // Check if user already voted with this session
      const existingVote = await storage.getUserVoteForIdea(sessionId, ideaId);
      
      if (existingVote) {
        if (isWhitelisted) {
          // For whitelisted IPs, always allow additional votes without removing existing ones
          await storage.createVote({ sessionId: sessionId + '-' + Date.now(), ideaId, voteType, ipAddress: clientIp as string });
          const voteChange = voteType === 'up' ? 1 : -1;
          const newVotes = idea.votes + voteChange;
          await storage.updateIdeaVotes(ideaId, newVotes);
          return res.json({ votes: newVotes, userVote: voteType });
        } else if (existingVote.voteType === voteType) {
          // Remove vote if clicking same vote type (non-whitelisted users)
          await storage.deleteVote(sessionId, ideaId);
          const newVotes = voteType === 'up' ? idea.votes - 1 : idea.votes + 1;
          await storage.updateIdeaVotes(ideaId, newVotes);
          return res.json({ votes: newVotes, userVote: null });
        } else {
          // Change vote type (only allow if not blocked by IP restriction)
          if (voteType === 'up' && !isWhitelisted) {
            const existingIpVote = await storage.getVoteByIpAndIdea(clientIp as string, ideaId);
            if (existingIpVote) {
              return res.status(400).json({ message: "You can only upvote once per idea" });
            }
          }
          await storage.deleteVote(sessionId, ideaId);
          await storage.createVote({ sessionId, ideaId, voteType, ipAddress: clientIp as string });
          const voteChange = voteType === 'up' ? 2 : -2; // Change from down to up or vice versa
          const newVotes = idea.votes + voteChange;
          await storage.updateIdeaVotes(ideaId, newVotes);
          return res.json({ votes: newVotes, userVote: voteType });
        }
      } else {
        // New vote
        await storage.createVote({ sessionId, ideaId, voteType, ipAddress: clientIp as string });
        const voteChange = voteType === 'up' ? 1 : -1;
        const newVotes = idea.votes + voteChange;
        await storage.updateIdeaVotes(ideaId, newVotes);
        
        // Reward system: Give bonus upvotes for upvoting others' ideas
        if (voteType === 'up' && !isWhitelisted) {
          await storage.incrementUpvotesGiven(sessionId);
          
          // Check if user earned a reward (every 3 upvotes given)
          const userSession = await storage.getUserSession(sessionId);
          if (userSession && userSession.upvotesGiven > 0 && userSession.upvotesGiven % 3 === 0) {
            // Award 1 bonus upvote to one of their ideas
            const userIdeas = await storage.getUserIdeasBySession(sessionId);
            if (userIdeas.length > 0) {
              // Pick the idea with the lowest votes to boost
              const ideaToBoost = userIdeas.reduce((lowest, current) => 
                current.votes < lowest.votes ? current : lowest
              );
              
              const boostedVotes = ideaToBoost.votes + 1;
              await storage.updateIdeaVotes(ideaToBoost.id, boostedVotes);
            }
          }
        }
        
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

      // Store email in our database
      console.log('Creating subscription with data:', result.data);
      const subscription = await storage.createSubscription(result.data);
      console.log('Created subscription:', subscription);
      
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
      
      // Calculate category counts
      const categoryCounts: Record<string, number> = {};
      ideas.forEach((idea: any) => {
        const category = idea.category || 'Other';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
      
      res.json({
        totalIdeas: ideas.length,
        totalSubscribers: subscriptions.length,
        categoryCounts
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // Admin endpoint to get all ideas (no authentication required)
  app.get("/api/admin/ideas", async (req, res) => {
    try {
      const sortBy = req.query.sort as 'votes' | 'recent' || 'recent';
      const ideas = await storage.getIdeas(sortBy);
      
      // Get upvote statistics for each idea's submitter
      const ideasWithStats = await Promise.all(ideas.map(async (idea: any) => {
        // Get actual votes given by this user from the votes table
        const votes = await storage.getAllVotesBySession(idea.sessionId);
        // Only count upvotes given to OTHER people's ideas (exclude self-upvotes)
        const actualUpvotesGiven = votes.filter(vote => 
          vote.voteType === 'up' && vote.ideaId !== idea.id
        ).length;
        
        return {
          ...idea,
          upvotesGiven: actualUpvotesGiven
        };
      }));
      
      res.json(ideasWithStats);
    } catch (error) {
      console.error("Error getting admin ideas:", error);
      res.status(500).json({ message: "Failed to get ideas" });
    }
  });

  // Admin endpoint to get upvote trends over time
  app.get("/api/admin/upvote-trends", async (req, res) => {
    try {
      const ideas = await storage.getIdeas('recent');
      
      // Create a map to track cumulative data by date
      const dailyData = new Map();
      
      // Process ideas chronologically
      const sortedIdeas = ideas.sort((a, b) => 
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      );
      
      // For each day, calculate the average upvotes per user up to that point
      for (let i = 0; i < sortedIdeas.length; i++) {
        const currentIdea = sortedIdeas[i];
        const currentDate = new Date(currentIdea.submittedAt).toISOString().split('T')[0];
        
        // Get all ideas submitted up to this date (inclusive)
        const ideasUpToDate = sortedIdeas.slice(0, i + 1);
        
        // Calculate upvotes given by each user up to this date
        const userUpvoteCounts = await Promise.all(
          ideasUpToDate.map(async (idea: any) => {
            const votes = await storage.getAllVotesBySession(idea.sessionId);
            // Only count upvotes to others' ideas, and only those that existed at this date
            const relevantVotes = votes.filter(vote => {
              if (vote.voteType !== 'up') return false;
              // Find the idea that was voted on
              const votedIdea = ideasUpToDate.find(i => i.id === vote.ideaId);
              return votedIdea && votedIdea.id !== idea.id;
            });
            return relevantVotes.length;
          })
        );
        
        const totalUpvotes = userUpvoteCounts.reduce((sum, count) => sum + count, 0);
        const averageUpvotes = ideasUpToDate.length > 0 ? totalUpvotes / ideasUpToDate.length : 0;
        
        dailyData.set(currentDate, {
          date: currentDate,
          averageUpvotes: Math.round(averageUpvotes * 10) / 10, // Round to 1 decimal
          totalUsers: ideasUpToDate.length,
          totalUpvotes: totalUpvotes
        });
      }
      
      // Convert to array and ensure we have data for the last 30 days minimum
      const dataArray = Array.from(dailyData.values());
      
      res.json(dataArray);
    } catch (error) {
      console.error("Error getting upvote trends:", error);
      res.status(500).json({ message: "Failed to get upvote trends" });
    }
  });

  // Admin endpoint to get all subscribers (no authentication required)
  app.get("/api/admin/subscribers", async (req, res) => {
    try {
      const subscribers = await storage.getAllSubscriptions();
      res.json(subscribers);
    } catch (error) {
      console.error("Error getting subscribers:", error);
      res.status(500).json({ message: "Failed to get subscribers" });
    }
  });

  // Admin endpoint to update ideas
  app.put("/api/admin/ideas/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }

      const { useCase, title, description, category, tools, linkUrl } = req.body;
      const updates: any = {};
      
      if (useCase !== undefined) updates.useCase = useCase;
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (tools !== undefined) updates.tools = tools;
      if (linkUrl !== undefined) updates.linkUrl = linkUrl;

      const updatedIdea = await storage.updateIdea(id, updates);
      res.json(updatedIdea);
    } catch (error) {
      console.error("Error updating idea:", error);
      res.status(500).json({ message: "Failed to update idea" });
    }
  });

  // Admin endpoint to delete ideas
  app.delete("/api/admin/ideas/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }

      await storage.deleteIdea(id);
      res.json({ message: "Idea deleted successfully" });
    } catch (error) {
      console.error("Error deleting idea:", error);
      res.status(500).json({ message: "Failed to delete idea" });
    }
  });

  // Export CSV with proper email-to-idea linking
  app.get("/api/admin/export", async (req, res) => {
    try {
      const ideas = await storage.getIdeas('recent');
      const subscriptions = await storage.getAllSubscriptions();
      
      console.log("CSV Export Debug:");
      console.log("Ideas count:", ideas.length);
      console.log("Subscriptions count:", subscriptions.length);
      console.log("Sample idea sessionIds:", ideas.slice(0, 3).map(i => ({ id: i.id, sessionId: i.sessionId })));
      console.log("Sample subscription sessionIds:", subscriptions.slice(0, 3).map(s => ({ email: s.email, sessionId: s.sessionId })));
      
      // Create CSV content with proper email linking
      let csvContent = "Email,Source,SessionId,IdeaText,Category,Tools,Votes,SubmittedAt\n";
      
      // Create a comprehensive map of all session IDs and their associated data
      const sessionMap = new Map();
      
      // First, map all ideas by sessionId
      ideas.forEach(idea => {
        sessionMap.set(idea.sessionId, { idea });
      });
      
      // Then add subscription data to existing sessions or create new entries
      subscriptions.forEach(sub => {
        if (sessionMap.has(sub.sessionId)) {
          sessionMap.get(sub.sessionId).subscription = sub;
        } else {
          sessionMap.set(sub.sessionId, { subscription: sub });
        }
      });
      
      // Generate CSV rows from the session map
      sessionMap.forEach(({ idea, subscription }, sessionId) => {
        // Skip legacy ideas without matching subscriptions for cleaner export
        if (sessionId === 'legacy' && !subscription) {
          return;
        }
        
        const email = subscription ? subscription.email : "No email";
        const source = subscription ? (subscription.source || 'homepage') : "idea_only";
        const ideaText = idea ? (idea.useCase || '').replace(/"/g, '""') : "No idea submitted";
        const category = idea ? (idea.category || 'Other') : "";
        const tools = idea ? (idea.tools || '') : "";
        const votes = idea ? idea.votes : "";
        const submittedAt = idea ? idea.submittedAt : (subscription ? subscription.subscribedAt : "");
        
        csvContent += `"${email}","${source}","${sessionId}","${ideaText}","${category}","${tools}","${votes}","${submittedAt}"\n`;
      });
      
      // Also add subscribers without ideas as separate entries
      subscriptions.forEach(sub => {
        if (!sessionMap.has(sub.sessionId || 'null')) {
          csvContent += `"${sub.email}","${sub.source || 'homepage'}","${sub.sessionId || 'no-session'}","No idea submitted","","","","${sub.subscribedAt}"\n`;
        }
      });
      
      console.log("Generated CSV rows:", sessionMap.size);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="ai-ideas-export.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // SEO Routes - Sitemap and Robots.txt
  app.get("/sitemap.xml", (req, res) => {
    res.type('application/xml');
    res.sendFile('sitemap.xml', { root: './client/public' });
  });

  app.get("/robots.txt", (req, res) => {
    res.type('text/plain');
    res.sendFile('robots.txt', { root: './client/public' });
  });

  const httpServer = createServer(app);
  return httpServer;
}
