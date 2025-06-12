import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertIdeaSchema, insertSubscriptionSchema, insertUserSessionSchema, insertVoteSchema, userSessions } from "@shared/schema";
import { db } from "./db";
import { nanoid } from "nanoid";
import { ContentFilter } from "./content-filter";
import { googleSheetsService } from "./google-sheets";



// Admin IPs to exclude from metrics (but allow unlimited voting)
const ADMIN_IPS = [
  "47.161.63.29",           // Original admin IP
  "104.28.50.131",          // Additional whitelisted IP
  "104.28.50.175",          // Additional whitelisted IP
  "2a09:bac2:bab7:1923::281:8d",  // IPv6 address
  "2a09:bac2:bbe1:1923::281:3f",   // IPv6 address
  '::1',                    // localhost IPv6
  '127.0.0.1',              // localhost IPv4
  '::ffff:127.0.0.1',       // IPv4-mapped IPv6
  "34.73.27.153",           // Current Replit IP
  "47.187.81.160"           // Browser IP
];

function getClientIP(req: any): string {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         req.ip || 
         '127.0.0.1';
  console.log('Client IP detected:', ip, 'X-Forwarded-For:', req.headers['x-forwarded-for']);
  return ip;
}

function isAdminIP(ip: string): boolean {
  const isAdmin = ADMIN_IPS.includes(ip);
  console.log('IP check:', ip, 'Is admin:', isAdmin, 'Admin IPs:', ADMIN_IPS);
  return isAdmin;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Admin authentication endpoint
  app.post("/api/admin/auth", async (req, res) => {
    try {
      const { password } = req.body;
      if (password === 'xxx') {
        res.json({ success: true, token: 'admin-authenticated' });
      } else {
        res.status(401).json({ message: "Invalid password" });
      }
    } catch (error) {
      res.status(500).json({ message: "Authentication failed" });
    }
  });

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
      
      // If this is a test submission, auto-delete it after 10 seconds
      if (contentValidation.isTestSubmission) {
        setTimeout(async () => {
          try {
            await storage.deleteIdea(idea.id);
            console.log(`Auto-deleted test submission ${idea.id}`);
          } catch (error) {
            console.error(`Failed to auto-delete test submission ${idea.id}:`, error);
          }
        }, 10000);
      }
      
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

      // Check paywall setting
      const paywallEnabled = (global as any).paywallEnabled !== false; // Default to true if not set
      
      // Normal flow - check if user has submitted (only if paywall is enabled)
      const session = await storage.getUserSession(sessionId);
      if (paywallEnabled && (!session || !session.hasSubmitted)) {
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

      // Get client IP address for tracking only
      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      
      // Check if user already voted with this session
      const existingVote = await storage.getUserVoteForIdea(sessionId, ideaId);
      
      if (existingVote) {
        // Always allow additional votes without removing existing ones
        await storage.createVote({ sessionId: sessionId + '-' + Date.now(), ideaId, voteType, ipAddress: clientIp as string });
        const voteChange = voteType === 'up' ? 1 : -1;
        const newVotes = idea.votes + voteChange;
        await storage.updateIdeaVotes(ideaId, newVotes);
        return res.json({ votes: newVotes, userVote: voteType });
      } else {
        // New vote - always allow
        await storage.createVote({ sessionId, ideaId, voteType, ipAddress: clientIp as string });
        const voteChange = voteType === 'up' ? 1 : -1;
        const newVotes = idea.votes + voteChange;
        await storage.updateIdeaVotes(ideaId, newVotes);
        
        // Reward system: Give bonus upvotes for upvoting others' ideas
        if (voteType === 'up') {
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
      
      // Get upvote statistics for each idea's submitter (exclude admin IP)
      const ideasWithStats = await Promise.all(ideas.map(async (idea: any) => {
        // Get actual votes given by this user from the votes table
        const votes = await storage.getAllVotesBySession(idea.sessionId);
        // Only count upvotes given to OTHER people's ideas (exclude self-upvotes and admin IPs)
        const actualUpvotesGiven = votes.filter(vote => 
          vote.voteType === 'up' && 
          vote.ideaId !== idea.id && 
          !ADMIN_IPS.includes(vote.ipAddress)
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
      const clientIP = getClientIP(req);
      
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }
      // Get current stats from admin ideas endpoint (reuse existing calculation)
      const ideas = await storage.getIdeas('votes');
      
      if (ideas.length === 0) {
        return res.json([]);
      }
      
      // Create sample data points showing progression over time
      // Sample at 10%, 25%, 50%, 75%, 90%, 100% of ideas
      const samplePoints = [0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
      const dataPoints = [];
      
      for (const percentage of samplePoints) {
        const index = Math.floor(ideas.length * percentage) - 1;
        if (index < 0) continue;
        
        const currentIdea = ideas[index];
        const currentDate = new Date(currentIdea.submittedAt).toISOString().split('T')[0];
        
        // Use ideas up to this point
        const ideasUpToDate = ideas.slice(0, index + 1);
        
        // Get upvote statistics (exclude admin IPs from metrics)
        const ideasWithStats = await Promise.all(ideasUpToDate.map(async (idea: any) => {
          const votes = await storage.getAllVotesBySession(idea.sessionId);
          const actualUpvotesGiven = votes.filter(vote => 
            vote.voteType === 'up' && 
            vote.ideaId !== idea.id && 
            !ADMIN_IPS.includes(vote.ipAddress)
          ).length;
          return { ...idea, upvotesGiven: actualUpvotesGiven };
        }));
        
        const totalUpvotesGiven = ideasWithStats.reduce((sum: number, idea: any) => sum + (idea.upvotesGiven || 0), 0);
        const averageUpvotes = ideasWithStats.length > 0 ? totalUpvotesGiven / ideasWithStats.length : 0;
        
        dataPoints.push({
          date: currentDate,
          averageUpvotes: Math.round(averageUpvotes * 10) / 10,
          totalUsers: ideasWithStats.length,
          totalUpvotes: totalUpvotesGiven
        });
      }
      
      res.json(dataPoints);
    } catch (error) {
      console.error("Error getting upvote trends:", error);
      res.status(500).json({ message: "Failed to get upvote trends" });
    }
  });

  // Admin endpoint to get user statistics
  app.get("/api/admin/user-stats", async (req, res) => {
    try {
      // Check for admin token or IP
      const authToken = req.headers['authorization'];
      const clientIP = getClientIP(req);
      
      console.log('User stats auth check - Token:', authToken, 'IP:', clientIP);
      
      if (authToken !== 'Bearer admin-authenticated' && !isAdminIP(clientIP)) {
        console.log('Access denied for user stats');
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all user sessions and calculate upvote statistics
      const allSessions = await db.select().from(userSessions);
      
      // Calculate total upvotes given by all users
      const totalUpvotesGiven = allSessions.reduce((sum, session) => sum + (session.upvotesGiven || 0), 0);
      
      // Count users who have given at least one upvote
      const activeVoters = allSessions.filter(session => (session.upvotesGiven || 0) > 0).length;
      
      // Total registered users (those who have sessions)
      const totalUsers = allSessions.length;

      res.json({
        totalUsers,
        activeVoters,
        totalUpvotesGiven,
        averageUpvotesPerUser: totalUsers > 0 ? (totalUpvotesGiven / totalUsers) : 0,
        averageUpvotesPerActiveVoter: activeVoters > 0 ? (totalUpvotesGiven / activeVoters) : 0
      });
    } catch (error) {
      console.error("Error getting user stats:", error);
      res.status(500).json({ message: "Failed to get user stats" });
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
      // Check for admin token or IP
      const authToken = req.headers['authorization'];
      const clientIP = getClientIP(req);
      
      if (authToken !== 'Bearer admin-authenticated' && !isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

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

  // Admin endpoint to auto-delete duplicate entries
  app.post("/api/admin/delete-duplicates", async (req, res) => {
    try {
      const ideas = await storage.getIdeas();
      const duplicates: number[] = [];
      const seen = new Map<string, number>();

      // Find duplicates based on useCase text
      for (const idea of ideas) {
        const key = (idea.useCase || '').trim().toLowerCase();
        if (key && seen.has(key)) {
          // Keep the one with more votes, delete the other
          const existingId = seen.get(key)!;
          const existingIdea = ideas.find((i: any) => i.id === existingId);
          if (existingIdea && idea.votes > existingIdea.votes) {
            duplicates.push(existingId);
            seen.set(key, idea.id);
          } else {
            duplicates.push(idea.id);
          }
        } else {
          seen.set(key, idea.id);
        }
      }

      // Delete duplicates
      for (const id of duplicates) {
        await storage.deleteIdea(id);
      }

      res.json({ 
        message: `Deleted ${duplicates.length} duplicate entries`,
        deletedIds: duplicates
      });
    } catch (error) {
      console.error("Error deleting duplicates:", error);
      res.status(500).json({ message: "Failed to delete duplicates" });
    }
  });

  // Admin endpoint to update vote count
  app.patch("/api/admin/ideas/:id/votes", async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const id = parseInt(req.params.id);
      const { votes } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }
      
      if (typeof votes !== 'number' || votes < 0) {
        return res.status(400).json({ message: "Votes must be a non-negative number" });
      }

      await storage.updateIdeaVotes(id, votes);
      res.json({ message: "Vote count updated successfully", votes });
    } catch (error) {
      console.error("Error updating vote count:", error);
      res.status(500).json({ message: "Failed to update vote count" });
    }
  });

  // Admin endpoint to get subscribers
  app.get("/api/admin/subscribers", async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const subscribers = await storage.getAllSubscriptions();
      res.json(subscribers);
    } catch (error) {
      console.error("Error getting subscribers:", error);
      res.status(500).json({ message: "Failed to get subscribers" });
    }
  });

  // Export CSV with proper email-to-idea linking
  // Public endpoint to get paywall status (accessible to all users)
  app.get("/api/paywall-status", async (req, res) => {
    try {
      // Check if paywall is enabled (default to true)
      const paywallEnabled = (global as any).paywallEnabled !== false;
      res.json({ enabled: paywallEnabled });
    } catch (error) {
      console.error('Error getting paywall status:', error);
      res.status(500).json({ message: "Failed to get paywall status" });
    }
  });

  // Admin endpoint to get paywall status (for admin panel)
  app.get("/api/admin/paywall-status", async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const paywallEnabled = (global as any).paywallEnabled !== false;
      res.json({ enabled: paywallEnabled });
    } catch (error) {
      console.error('Error getting paywall status:', error);
      res.status(500).json({ message: "Failed to get paywall status" });
    }
  });

  // Admin endpoint to toggle paywall
  app.post("/api/admin/paywall-toggle", async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { enabled } = req.body;
      
      // Store paywall setting (in production, this would be stored in database)
      // For now, we'll store it in memory and update the environment variable approach
      (global as any).paywallEnabled = enabled;
      
      res.json({ 
        enabled, 
        message: enabled ? "Paywall enabled" : "Paywall disabled"
      });
    } catch (error) {
      console.error('Error toggling paywall:', error);
      res.status(500).json({ message: "Failed to toggle paywall" });
    }
  });

  app.get("/api/admin/export", async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

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
