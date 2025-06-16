import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertIdeaSchema, insertSubscriptionSchema, insertUserSessionSchema, insertVoteSchema, insertCommentSchema, userSessions, votes, ideas, users } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./auth";
import { db } from "./db";
import { nanoid } from "nanoid";
import { count, countDistinct, eq, and, sql } from "drizzle-orm";
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
  // Auth middleware
  await setupAuth(app);

  // Initialize paywall as disabled by default
  (global as any).paywallEnabled = false;

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Register new user
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ message: "Username, email, and password are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username is already taken" });
      }

      // Hash password
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({ username, email, passwordHash });
      
      // Auto-login the user by creating a session
      (req.session as any).userId = user.id;
      (req.session as any).isAuthenticated = true;
      
      res.status(201).json({ 
        message: "Account created successfully",
        user: { id: user.id, username: user.username, email: user.email },
        authenticated: true
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Forgot password
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists for security
        return res.json({ message: "If an account with this email exists, a password reset link has been sent" });
      }

      // Generate reset token (implement token storage if needed)
      const crypto = await import('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // In a real app, you'd store this token with expiration
      // For now, we'll just send the email
      
      // Send reset email using SendGrid if configured
      if (process.env.SENDGRID_API_KEY) {
        const { sendEmail } = require('./sendgrid');
        const resetUrl = `${req.protocol}://${req.hostname}/reset-password?token=${resetToken}`;
        
        await sendEmail(process.env.SENDGRID_API_KEY, {
          to: email,
          from: 'noreply@yourdomain.com', // Replace with your verified sender
          subject: 'Password Reset Request',
          html: `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <a href="${resetUrl}">Reset Password</a>
            <p>If you didn't request this, please ignore this email.</p>
          `
        });
      }

      res.json({ message: "If an account with this email exists, a password reset link has been sent" });
    } catch (error) {
      console.error("Error sending reset email:", error);
      res.status(500).json({ message: "Failed to send reset email" });
    }
  });

  // Signup endpoint for notification system
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { username, email, password } = req.body;

      // Validate input
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email, and password are required' });
      }

      // Validate username format and profanity
      const usernameValidation = ContentFilter.validateUsername(username);
      if (!usernameValidation.isValid) {
        return res.status(400).json({ message: usernameValidation.reason });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Please enter a valid email address' });
      }

      // Check if username already exists
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: 'Username already taken' });
      }

      // Check if email already exists
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      // Hash password
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        username,
        email,
        passwordHash,
      });

      // Log user registration to CSV
      try {
        const { csvLogger } = await import('./csv-logger');
        await csvLogger.logUserRegistration({
          username,
          email,
          timestamp: new Date().toISOString(),
          ipAddress: getClientIP(req),
        });
      } catch (error) {
        console.error('Failed to log user registration to CSV:', error);
      }

      // Auto-subscribe to email list
      try {
        await storage.createSubscription({ email });
      } catch (error) {
        // Don't fail signup if subscription fails
        console.log('Failed to auto-subscribe user:', error);
      }

      // Send welcome email notification
      try {
        const { sendEmail } = await import('./sendgrid');
        if (process.env.SENDGRID_API_KEY) {
          const emailSent = await sendEmail(process.env.SENDGRID_API_KEY, {
            to: email,
            from: 'noreply@howdoyouuseai.com',
            subject: 'Welcome to How Do You Use AI - Account Created!',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Welcome to How Do You Use AI!</h2>
                <p>Hi ${username},</p>
                <p>Your account has been successfully created. You can now:</p>
                <ul>
                  <li>Submit your own AI use cases</li>
                  <li>Vote on community ideas</li>
                  <li>Comment and engage with others</li>
                  <li>Access exclusive features as they're released</li>
                </ul>
                <p>Start exploring amazing AI use cases from our community!</p>
                <p style="margin-top: 30px;">
                  <a href="https://howdoyouuseai.com" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Visit How Do You Use AI</a>
                </p>
                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                  If you didn't create this account, please ignore this email.
                </p>
              </div>
            `,
            text: `Welcome to How Do You Use AI! Your account "${username}" has been successfully created. Start exploring amazing AI use cases from our community at https://howdoyouuseai.com`
          });
          
          if (!emailSent) {
            console.error('Failed to send welcome email to:', email);
          }
        }
      } catch (error) {
        console.error('Welcome email error:', error);
      }

      res.json({ 
        success: true, 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email 
        } 
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Failed to create account' });
    }
  });

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

  // Download user registrations CSV (admin only)
  app.get("/api/admin/download-users-csv", async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { csvLogger } = await import('./csv-logger');
      const csvPath = csvLogger.getCSVPath();
      
      // Check if file exists
      const fs = await import('fs');
      if (!fs.existsSync(csvPath)) {
        return res.status(404).json({ message: "No user registration data found" });
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="user_registrations.csv"');
      
      // Stream the file
      const fileStream = fs.createReadStream(csvPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('CSV download error:', error);
      res.status(500).json({ message: "Failed to download CSV" });
    }
  });

  // Contact form endpoint
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, message } = req.body;
      
      if (!name || !email || !message) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Send email using SendGrid
      try {
        const { sendEmail } = await import('./sendgrid');
        if (process.env.SENDGRID_API_KEY) {
          const emailSent = await sendEmail(process.env.SENDGRID_API_KEY, {
            to: 'chris@cofounders.com',
            from: 'noreply@howdoyouuseai.com',
            subject: `Contact Form: Message from ${name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">New Contact Form Message</h2>
                <p><strong>From:</strong> ${name} (${email})</p>
                <p><strong>Message:</strong></p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                  ${message.replace(/\n/g, '<br>')}
                </div>
                <p style="color: #666; font-size: 14px;">
                  Reply directly to this email to respond to ${name}.
                </p>
              </div>
            `,
            text: `New Contact Form Message\n\nFrom: ${name} (${email})\n\nMessage:\n${message}`
          });
          
          if (!emailSent) {
            console.error('Failed to send contact email');
          }
        }
      } catch (emailError) {
        console.error('Contact email error:', emailError);
        // Don't fail the request if email fails
      }

      res.json({ message: "Message sent successfully" });
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Update session activity
  app.post("/api/session/activity", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID required" });
      }

      await storage.updateUserSessionActivity(sessionId);
      res.json({ message: "Activity updated" });
    } catch (error) {
      console.error('Session activity update error:', error);
      res.status(500).json({ message: "Failed to update activity" });
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
      let userId = null;
      
      // Check if user is authenticated (supports both traditional auth and Replit OAuth)
      if (req.isAuthenticated() && req.user) {
        // Traditional auth: user has id property directly
        if ((req.user as any).id) {
          userId = (req.user as any).id.toString();
        }
        // Replit OAuth: user has claims.sub property
        else if ((req.user as any).claims?.sub) {
          userId = (req.user as any).claims.sub;
        }
      }
      
      // Require sessionId for anonymous users
      if (!userId && !sessionId) {
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

      // Add sessionId and userId to the idea data
      const ideaData = { 
        ...result.data, 
        sessionId: !userId ? (sessionId || null) : null, // Only store sessionId for anonymous ideas
        userId 
      };
      const idea = await storage.createIdea(ideaData);
      
      // Update session for anonymous users
      if (!userId && sessionId) {
        await storage.updateUserSessionSubmitted(sessionId);
      }
      
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
        
        // For shared access, no recently submitted ideas (since it's not their session)
        const ideasWithFlags = ideas.map(idea => ({
          ...idea,
          userVote: null,
          isRecentlySubmitted: false
        }));
        
        // Add cache-busting headers to ensure fresh data
        res.set({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        
        return res.json(ideasWithFlags);
      }

      // Check paywall setting (default to false - DISABLED)
      const paywallEnabled = (global as any).paywallEnabled === true;
      
      // Normal flow - check if user has submitted (only if paywall is enabled)
      const session = await storage.getUserSession(sessionId);
      if (paywallEnabled && (!session || !session.hasSubmitted)) {
        return res.status(403).json({ message: "Must submit an idea first" });
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

      // Check for recently submitted idea by this session (within last 30 seconds)
      const recentlySubmittedIdea = await storage.getRecentlySubmittedIdea(sessionId);

      const ideasWithVotes = ideas.map(idea => ({
        ...idea,
        userVote: voteMap[idea.id] || null,
        isRecentlySubmitted: recentlySubmittedIdea?.id === idea.id,
        commentCount: (idea as any).commentCount || 0
      }));
      
      // Add cache-busting headers to ensure fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(ideasWithVotes);
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

      // Create user session if it doesn't exist
      let session = await storage.getUserSession(sessionId);
      if (!session) {
        await storage.createUserSession({ sessionId });
        session = await storage.getUserSession(sessionId);
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

      // Check downvote restriction: only allow downvotes on ideas with 100+ upvotes
      if (voteType === 'down' && idea.votes < 100) {
        return res.status(403).json({ 
          message: `Downvoting is only enabled for ideas with 100+ upvotes. This idea has ${idea.votes} upvotes.` 
        });
      }

      // Get client IP address for tracking only
      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      
      // Rate limiting: Check if user is voting too quickly (5 second minimum between votes)
      const recentVotes = await storage.getRecentVotesBySession(sessionId, 5000); // 5 seconds
      if (recentVotes.length > 0) {
        const lastVoteTime = new Date(recentVotes[0].createdAt).getTime();
        const currentTime = Date.now();
        const timeDiff = currentTime - lastVoteTime;
        
        if (timeDiff < 5000) { // Less than 5 seconds
          return res.status(429).json({ 
            message: "Please actually read the ideas you're upvoting. :)",
            remainingTime: Math.ceil((5000 - timeDiff) / 1000)
          });
        }
      }
      
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

  // Comment endpoints
  app.get("/api/ideas/:id/comments", async (req, res) => {
    try {
      const ideaId = parseInt(req.params.id);
      const comments = await storage.getCommentsByIdeaId(ideaId);
      
      // Transform comments to include reply counts and organize by hierarchy
      const commentsWithReplies = comments.map(comment => ({
        ...comment,
        replyCount: comments.filter(c => c.parentId === comment.id).length,
        replies: comments.filter(c => c.parentId === comment.id)
      }));
      
      // Return only top-level comments (parentId is null)
      const topLevelComments = commentsWithReplies.filter(comment => !comment.parentId);
      
      res.json(topLevelComments);
    } catch (error) {
      console.error('Get comments error:', error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Get comment count for an idea
  app.get("/api/ideas/:id/comments/count", async (req, res) => {
    try {
      const ideaId = parseInt(req.params.id);
      const count = await storage.getCommentCountByIdeaId(ideaId);
      res.json(count);
    } catch (error) {
      console.error('Get comment count error:', error);
      res.status(500).json({ message: "Failed to fetch comment count" });
    }
  });

  // Check username availability
  app.get("/api/check-username/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const existingUser = await storage.getUserByUsername(username);
      res.json({ available: !existingUser });
    } catch (error) {
      console.error('Check username error:', error);
      res.status(500).json({ message: "Failed to check username" });
    }
  });

  app.post("/api/ideas/:id/comments", async (req: any, res) => {
    try {
      const ideaId = parseInt(req.params.id);
      let userId = null;
      const sessionId = req.headers['x-session-id'];
      
      // Check if user is authenticated (supports both traditional auth and Replit OAuth)
      if (req.isAuthenticated() && req.user) {
        // Traditional auth: user has id property directly
        if ((req.user as any).id) {
          userId = (req.user as any).id.toString();
        }
        // Replit OAuth: user has claims.sub property
        else if ((req.user as any).claims?.sub) {
          userId = (req.user as any).claims.sub;
        }
      }
      
      const result = insertCommentSchema.safeParse({
        ...req.body,
        ideaId,
        userId,
        sessionId: !userId ? sessionId : null // Only store sessionId for anonymous comments
      });
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid comment data", errors: result.error.errors });
      }

      // Filter comment content
      const contentValidation = ContentFilter.validateComment(result.data.content);
      if (!contentValidation.isValid) {
        return res.status(400).json({ message: contentValidation.reason });
      }

      const comment = await storage.createComment(result.data);
      
      // Return comment with user data
      const commentWithUser = await storage.getCommentsByIdeaId(ideaId);
      const newComment = commentWithUser.find(c => c.id === comment.id);
      
      res.json(newComment);
    } catch (error) {
      console.error('Create comment error:', error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Reply to comment endpoint
  app.post("/api/comments/:parentId/replies", async (req: any, res) => {
    try {
      const parentId = parseInt(req.params.parentId);
      let userId = null;
      
      // Check if user is authenticated
      if (req.isAuthenticated() && req.user?.claims?.sub) {
        userId = req.user.claims.sub;
      }

      // Get parent comment to find the ideaId
      const parentComment = await storage.getCommentById?.(parentId);
      if (!parentComment) {
        return res.status(404).json({ message: "Parent comment not found" });
      }
      
      const result = insertCommentSchema.safeParse({
        ...req.body,
        ideaId: parentComment.ideaId,
        userId,
        parentId
      });
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid reply data", errors: result.error.errors });
      }

      // Filter comment content
      const contentValidation = ContentFilter.validateComment(result.data.content);
      if (!contentValidation.isValid) {
        return res.status(400).json({ message: contentValidation.reason });
      }

      const reply = await storage.createComment(result.data);
      
      // Return the reply with updated parent comment data
      const updatedComments = await storage.getCommentsByIdeaId(parentComment.ideaId);
      const parentWithReplies = updatedComments.find(c => c.id === parentId);
      
      res.json({
        ...reply,
        parentUpdated: parentWithReplies
      });
    } catch (error) {
      console.error('Create reply error:', error);
      res.status(500).json({ message: "Failed to create reply" });
    }
  });

  // Update comment username for anonymous comments
  app.patch("/api/comments/:id/username", async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const { username, sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID required" });
      }
      
      if (!username || username.trim().length < 2) {
        return res.status(400).json({ message: "Valid username required" });
      }
      
      await storage.updateCommentUsername(commentId, sessionId, username.trim());
      res.json({ message: "Username updated" });
    } catch (error) {
      console.error('Update comment username error:', error);
      res.status(500).json({ message: "Failed to update username" });
    }
  });

  app.delete("/api/comments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      await storage.deleteComment(commentId, userId);
      res.json({ message: "Comment deleted" });
    } catch (error) {
      console.error('Delete comment error:', error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Admin comment management endpoints
  app.get("/api/admin/comments", async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const comments = await storage.getAllComments();
      res.json(comments);
    } catch (error) {
      console.error('Get admin comments error:', error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.delete("/api/admin/comments/:id", async (req, res) => {
    try {
      const authToken = req.headers['authorization'];
      const clientIP = getClientIP(req);
      
      if (!authToken?.startsWith('Bearer ') && !isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const commentId = parseInt(req.params.id);
      await storage.adminDeleteComment(commentId);
      res.json({ message: "Comment deleted" });
    } catch (error) {
      console.error('Admin delete comment error:', error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  app.post("/api/admin/comments/bulk-delete", async (req, res) => {
    try {
      const authToken = req.headers['authorization'];
      const clientIP = getClientIP(req);
      
      if (!authToken?.startsWith('Bearer ') && !isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { commentIds } = req.body;
      if (!Array.isArray(commentIds)) {
        return res.status(400).json({ message: "commentIds must be an array" });
      }

      await storage.bulkDeleteComments(commentIds);
      res.json({ message: `Deleted ${commentIds.length} comments` });
    } catch (error) {
      console.error('Bulk delete comments error:', error);
      res.status(500).json({ message: "Failed to bulk delete comments" });
    }
  });

  // Bulk delete ideas endpoint
  app.post("/api/admin/ideas/bulk-delete", async (req, res) => {
    try {
      const authToken = req.headers['authorization'];
      const clientIP = getClientIP(req);
      
      if (!authToken?.startsWith('Bearer ') && !isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { ideaIds } = req.body;
      if (!Array.isArray(ideaIds)) {
        return res.status(400).json({ message: "ideaIds must be an array" });
      }

      // Delete each idea individually
      for (const ideaId of ideaIds) {
        await storage.deleteIdea(ideaId);
      }
      
      res.json({ message: `Deleted ${ideaIds.length} ideas` });
    } catch (error) {
      console.error('Bulk delete ideas error:', error);
      res.status(500).json({ message: "Failed to bulk delete ideas" });
    }
  });

  // Comment voting endpoints
  app.post("/api/comments/:id/vote", async (req: any, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const { voteType } = req.body;
      const sessionId = req.headers['x-session-id'];
      const clientIP = getClientIP(req);

      if (!sessionId) {
        return res.status(400).json({ message: "Session ID required" });
      }

      if (!['up', 'down'].includes(voteType)) {
        return res.status(400).json({ message: "Invalid vote type" });
      }

      // Check if user already voted on this specific comment - silently ignore if duplicate
      const existingVote = await storage.getCommentVote(commentId, sessionId);
      if (existingVote) {
        const currentComment = await storage.getCommentById(commentId);
        return res.json({ 
          message: "Vote already recorded", 
          voteCount: currentComment?.votes || 0 
        });
      }

      // Global rate limiting: 2 seconds between any comment votes
      const recentCommentVotes = await storage.getRecentCommentVotesBySession(sessionId, 2000); // 2 seconds
      if (recentCommentVotes.length > 0) {
        return res.status(429).json({ message: "Please wait 2 seconds before voting again" });
      }

      // IP-based global rate limiting
      const recentCommentVotesByIP = await storage.getRecentCommentVotesByIp(clientIP, 2000);
      if (recentCommentVotesByIP.length > 0) {
        return res.status(429).json({ message: "Please wait 2 seconds before voting again" });
      }

      await storage.voteOnComment(commentId, sessionId, clientIP, voteType);
      
      // Get updated vote count to return to frontend
      const updatedComment = await storage.getCommentById(commentId);
      res.json({ 
        message: "Vote recorded", 
        voteCount: updatedComment?.votes || 0 
      });
    } catch (error) {
      console.error('Comment vote error:', error);
      res.status(500).json({ message: "Failed to record vote" });
    }
  });

  app.get("/api/comments/:id/vote", async (req: any, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const sessionId = req.headers['x-session-id'];

      if (!sessionId) {
        return res.status(400).json({ message: "Session ID required" });
      }

      const vote = await storage.getCommentVote(commentId, sessionId);
      res.json({ vote: vote?.voteType || null });
    } catch (error) {
      console.error('Get comment vote error:', error);
      res.status(500).json({ message: "Failed to get vote" });
    }
  });

  // User-specific endpoints for dashboard
  app.get("/api/user/ideas", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id.toString();
      const userIdeas = await storage.getIdeasByUserId(userId);
      res.json(userIdeas);
    } catch (error) {
      console.error('Get user ideas error:', error);
      res.status(500).json({ message: "Failed to get user ideas" });
    }
  });

  app.get("/api/user/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id.toString();
      const userComments = await storage.getCommentsByUserId(userId);
      res.json(userComments);
    } catch (error) {
      console.error('Get user comments error:', error);
      res.status(500).json({ message: "Failed to get user comments" });
    }
  });

  app.get("/api/user/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id.toString();
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({ message: "Failed to get user stats" });
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
      const currentIdeas = await storage.getIdeas();
      const subscriptions = await storage.getAllSubscriptions();
      
      // Get cumulative count by checking the highest ID in the database
      // This gives us total ideas ever created, regardless of deletions
      let cumulativeIdeasCount = currentIdeas.length;
      try {
        const maxIdQuery = await db.execute(sql`SELECT COALESCE(MAX(id), 0) as max_id FROM ideas`);
        cumulativeIdeasCount = Number(maxIdQuery.rows[0]?.max_id) || currentIdeas.length;
      } catch (error) {
        // Fallback to current count if query fails
        console.log('Using fallback count for stats');
      }
      
      // Calculate category counts
      const categoryCounts: Record<string, number> = {};
      currentIdeas.forEach((idea: any) => {
        const category = idea.category || 'Other';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
      
      res.json({
        totalIdeas: cumulativeIdeasCount,
        totalSubscribers: subscriptions.length,
        categoryCounts
      });
    } catch (error) {
      console.error('Error getting stats:', error);
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

      // Get all user sessions and find the earliest one
      const allSessions = await db.select().from(userSessions);
      
      if (allSessions.length === 0) {
        return res.json([]);
      }

      // Find the earliest session creation date (platform launch)
      const earliestDate = new Date(Math.min(...allSessions.map((session: any) => new Date(session.createdAt).getTime())));
      const today = new Date();
      
      // Generate daily data points from launch to today
      const dataPoints = [];
      const currentDate = new Date(earliestDate);
      
      // Track dates we've already processed to avoid duplicates
      const processedDates = new Set<string>();
      
      // Generate data points every 2 days to balance performance and detail
      while (currentDate <= today) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Skip if we've already processed this date
        if (processedDates.has(dateStr)) {
          currentDate.setDate(currentDate.getDate() + 2);
          continue;
        }
        
        processedDates.add(dateStr);
        
        // Get ALL sessions that existed by this date AND have submitted ideas
        const sessionsUpToDate = allSessions.filter((session: any) => 
          new Date(session.createdAt) <= currentDate && session.hasSubmitted
        );
        
        if (sessionsUpToDate.length > 0) {
          const totalUsers = sessionsUpToDate.length;
          
          // For trends, use the session upvotesGiven field for performance
          // (We'll fix the data sync issue separately)
          const totalUpvotesGiven = sessionsUpToDate.reduce((sum: number, session: any) => sum + (session.upvotesGiven || 0), 0);
          const averageUpvotes = totalUsers > 0 ? totalUpvotesGiven / totalUsers : 0;
          
          dataPoints.push({
            date: dateStr,
            averageUpvotes: parseFloat(averageUpvotes.toFixed(6)),
            totalUsers,
            totalUpvotes: totalUpvotesGiven
          });
        }
        
        // Move to next point (every 2 days)
        currentDate.setDate(currentDate.getDate() + 2);
      }
      
      // Ensure we have today's data point
      const todayStr = today.toISOString().split('T')[0];
      if (!processedDates.has(todayStr)) {
        // Get ALL sessions that have submitted ideas (current total user count)
        const usersWhoSubmittedToday = allSessions.filter((session: any) => session.hasSubmitted);
        const totalUsers = usersWhoSubmittedToday.length;
        const totalUpvotesGiven = usersWhoSubmittedToday.reduce((sum: number, session: any) => sum + (session.upvotesGiven || 0), 0);
        const averageUpvotes = totalUsers > 0 ? totalUpvotesGiven / totalUsers : 0;
        
        dataPoints.push({
          date: todayStr,
          averageUpvotes: parseFloat(averageUpvotes.toFixed(6)),
          totalUsers,
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
      
      // Only count users who have actually submitted ideas
      const usersWhoSubmitted = allSessions.filter(session => session.hasSubmitted);
      
      // Get actual vote counts from votes table for accurate statistics
      const submitterSessionIds = usersWhoSubmitted.map(session => session.sessionId);
      
      // Count unique voters among idea submitters
      const activeVotersResult = await db
        .select({ count: countDistinct(votes.sessionId) })
        .from(votes)
        .where(and(
          eq(votes.voteType, 'up'),
          // Filter to only session IDs that belong to idea submitters
        ));
      
      // Count total upvotes from idea submitters
      const totalUpvotesResult = await db
        .select({ count: count() })
        .from(votes)
        .where(and(
          eq(votes.voteType, 'up'),
          // Filter to only session IDs that belong to idea submitters
        ));
      
      const totalUsers = usersWhoSubmitted.length;
      
      // For now, let's get accurate data using a simpler approach
      const allVotes = await db.select().from(votes).where(eq(votes.voteType, 'up'));
      const votersFromSubmitters = new Set();
      let totalUpvotesFromSubmitters = 0;
      
      for (const vote of allVotes) {
        if (submitterSessionIds.includes(vote.sessionId)) {
          votersFromSubmitters.add(vote.sessionId);
          totalUpvotesFromSubmitters++;
        }
      }
      
      const activeVoters = votersFromSubmitters.size;
      const totalUpvotesGiven = totalUpvotesFromSubmitters;

      // Calculate percentage of idea submitters who upvote others
      const participationRate = totalUsers > 0 ? (activeVoters / totalUsers * 100) : 0;

      console.log(`User stats: ${totalUsers} users, ${activeVoters} active voters, ${participationRate.toFixed(1)}% participation`);

      res.json({
        totalUsers,
        activeVoters,
        totalUpvotesGiven,
        participationRate: parseFloat(participationRate.toFixed(1)),
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
      
      if (!authToken?.startsWith('Bearer ') && !isAdminIP(clientIP)) {
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
      // Check if paywall is enabled (default to false - DISABLED)
      const paywallEnabled = (global as any).paywallEnabled === true;
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

      const paywallEnabled = (global as any).paywallEnabled === true;
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

  // Admin endpoint to get session metrics
  app.get("/api/admin/session-metrics", async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      
      if (!isAdminIP(clientIP)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const metrics = await storage.getSessionMetricsByDay();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting session metrics:", error);
      res.status(500).json({ message: "Failed to get session metrics" });
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
      const authenticatedUsers = await storage.getAllUsers();
      
      console.log("CSV Export Debug:");
      console.log("Ideas count:", ideas.length);
      console.log("Subscriptions count:", subscriptions.length);
      console.log("Authenticated users count:", authenticatedUsers.length);
      
      // Create CSV content with comprehensive user data
      let csvContent = "Email,Username,Source,SessionId,IdeaText,Category,Tools,Votes,SubmittedAt,UserType\n";
      
      // Create a comprehensive map of all session IDs and their associated data
      const sessionMap = new Map();
      
      // First, map all ideas by sessionId
      ideas.forEach(idea => {
        sessionMap.set(idea.sessionId, { idea });
      });
      
      // Add subscription data to existing sessions or create new entries
      subscriptions.forEach(sub => {
        if (sessionMap.has(sub.sessionId)) {
          sessionMap.get(sub.sessionId).subscription = sub;
        } else {
          sessionMap.set(sub.sessionId, { subscription: sub });
        }
      });
      
      // Add authenticated user data - these are users who logged in via Replit Auth
      authenticatedUsers.forEach(user => {
        // For authenticated users, we need to find their session data by matching their activity
        // Since we don't have a direct sessionId->userId mapping, we'll add them as separate entries
        if (!sessionMap.has(`auth-${user.id}`)) {
          sessionMap.set(`auth-${user.id}`, { authenticatedUser: user });
        }
      });
      
      // Generate CSV rows from the session map
      sessionMap.forEach(({ idea, subscription, authenticatedUser }, sessionId) => {
        // Skip legacy ideas without matching subscriptions for cleaner export
        if (sessionId === 'legacy' && !subscription && !authenticatedUser) {
          return;
        }
        
        let email = "No email";
        let username = "No username";
        let source = "idea_only";
        let userType = "anonymous";
        
        if (authenticatedUser) {
          email = authenticatedUser.email || "No email";
          username = authenticatedUser.firstName && authenticatedUser.lastName 
            ? `${authenticatedUser.firstName} ${authenticatedUser.lastName}`.trim()
            : "No name";
          source = "authenticated";
          userType = "authenticated";
        } else if (subscription) {
          email = subscription.email;
          source = subscription.source || 'homepage';
          userType = "subscriber";
        }
        
        const ideaText = idea ? (idea.useCase || '').replace(/"/g, '""') : "No idea submitted";
        const category = idea ? (idea.category || 'Other') : "";
        const tools = idea ? (idea.tools || '') : "";
        const votes = idea ? idea.votes : "";
        const submittedAt = idea ? idea.submittedAt : (subscription ? subscription.subscribedAt : (authenticatedUser ? authenticatedUser.createdAt : ""));
        
        csvContent += `"${email}","${username}","${source}","${sessionId}","${ideaText}","${category}","${tools}","${votes}","${submittedAt}","${userType}"\n`;
      });
      
      // Also add subscribers without ideas as separate entries
      subscriptions.forEach(sub => {
        if (!sessionMap.has(sub.sessionId || 'null')) {
          csvContent += `"${sub.email}","No username","${sub.source || 'homepage'}","${sub.sessionId || 'no-session'}","No idea submitted","","","","${sub.subscribedAt}","subscriber"\n`;
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
