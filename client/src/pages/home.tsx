import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, lazy, Suspense } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Lightbulb, Bell, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// Lazy load heavy components only
const AccountCreationPopup = lazy(() => import("@/components/account-creation-popup"));
const GiftCardPopup = lazy(() => import("@/components/gift-card-popup"));

// Import lightweight components directly to reduce chunk splitting overhead
import IdeaSubmissionForm from "@/components/idea-submission-form";
import IdeaCard from "@/components/idea-card";
import SubscriptionForm from "@/components/subscription-form";
import UnlockMessage from "@/components/unlock-message";
import InlineSubscribe from "@/components/inline-subscribe";
import { UserDropdown } from "@/components/user-dropdown";


export default function Home() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [sessionId, setSessionId] = useState<string>(() => {
    // Initialize from localStorage on mount
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai-ideas-session') || '';
    }
    return '';
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showUnlockMessage, setShowUnlockMessage] = useState(false);
  const [showGiftCardPopup, setShowGiftCardPopup] = useState(false);
  const [sortBy, setSortBy] = useState<'votes' | 'recent' | 'comments'>('votes');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sharedIdeaAccess, setSharedIdeaAccess] = useState(false);
  const [highlightedIdeaId, setHighlightedIdeaId] = useState<number | null>(null);
  const [visibleIdeasCount, setVisibleIdeasCount] = useState(15);
  const [newlySubmittedIdeaId, setNewlySubmittedIdeaId] = useState<number | null>(null);
  const [isSharedLink, setIsSharedLink] = useState(false);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [paywallEnabled, setPaywallEnabled] = useState(true);
  const [submittedIdeaText, setSubmittedIdeaText] = useState<string>('');
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [viewedIdeasCount, setViewedIdeasCount] = useState(0);
  const [showAccountCreationPopup, setShowAccountCreationPopup] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Check screen size for mobile optimization with debouncing
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkScreenSize, 100);
    };
    
    checkScreenSize();
    window.addEventListener('resize', debouncedResize, { passive: true });
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Check paywall status
  const { data: paywallStatus } = useQuery({
    queryKey: ['/api/paywall-status'],
    queryFn: async () => {
      const res = await fetch('/api/paywall-status');
      if (!res.ok) return { enabled: true }; // Default to enabled if error
      return res.json();
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Update paywall state when status loads
  useEffect(() => {
    if (paywallStatus?.enabled !== undefined) {
      setPaywallEnabled(paywallStatus.enabled);
    }
  }, [paywallStatus]);

  // Get or create session
  const { data: sessionData } = useQuery({
    queryKey: ['/api/session'],
    queryFn: async () => {
      const res = await fetch('/api/session', {
        headers: {
          'x-session-id': sessionId || '',
        },
      });
      if (!res.ok) throw new Error('Failed to get session');
      return res.json();
    },
  });

  // Track user activity for session metrics
  useEffect(() => {
    if (!sessionId) return;

    const updateActivity = async () => {
      try {
        await fetch('/api/session/activity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId,
          },
        });
      } catch (error) {
        // Silently fail - activity tracking is not critical
      }
    };

    // Update activity on mount and every 30 seconds
    updateActivity();
    const interval = setInterval(updateActivity, 30000);

    // Update activity on page visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Final activity update when component unmounts
      updateActivity();
    };
  }, [sessionId]);

  // Get stats
  const { data: stats } = useQuery({
    queryKey: ['/api/stats'],
  });

  // Get ideas (show when paywall disabled OR user has submitted OR has shared access)
  const { data: allIdeas, isLoading: ideasLoading } = useQuery({
    queryKey: ['/api/ideas', sortBy, selectedCategory, selectedTool],
    queryFn: async () => {
      const categoryParam = selectedCategory && selectedCategory !== 'all' ? `&category=${selectedCategory}` : '';
      const toolParam = selectedTool && selectedTool !== 'all' ? `&tool=${selectedTool}` : '';
      const res = await fetch(`/api/ideas?sort=${sortBy}${categoryParam}${toolParam}`, {
        headers: {
          'x-session-id': sessionId,
          'x-shared-access': sharedIdeaAccess ? 'true' : 'false',
        },
      });
      if (!res.ok) {
        if (res.status === 403) return null; // User hasn't submitted yet
        throw new Error('Failed to get ideas');
      }
      return res.json();
    },
    enabled: !!sessionId && (!paywallEnabled || hasSubmitted || sharedIdeaAccess),
  });

  // Filter ideas based on search query
  const ideas = allIdeas?.filter((idea: any) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      idea.useCase?.toLowerCase().includes(query) ||
      idea.title?.toLowerCase().includes(query) ||
      idea.description?.toLowerCase().includes(query) ||
      idea.category?.toLowerCase().includes(query) ||
      idea.tool?.toLowerCase().includes(query)
    );
  }) || [];

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ ideaId, voteType }: { ideaId: number; voteType: 'up' | 'down' }) => {
      const res = await fetch(`/api/ideas/${ideaId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({ voteType }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to vote');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ideas'] });
    },
    onError: (error: any) => {
      // Check if it's a rate limiting error (429 status)
      if (error.message.includes("Please actually read the ideas")) {
        toast({
          title: "Please actually read the ideas you're upvoting. :)",
          description: "Take a moment to read each idea before voting to help maintain quality discussions.",
          duration: 4000,
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to vote",
          variant: "destructive",
        });
      }
    },
  });

  useEffect(() => {
    if (sessionData) {
      setSessionId(sessionData.sessionId);
      
      // Check for shared access first, then server data
      const hasSharedAccess = localStorage.getItem('shared-idea-access') === 'true';
      const urlParams = new URLSearchParams(window.location.search);
      const sharedIdeaId = urlParams.get('idea');
      
      if (hasSharedAccess || sharedIdeaId) {
        setHasSubmitted(true);
        setSharedIdeaAccess(true);
        // Set the highlighted idea ID if coming from shared link
        if (sharedIdeaId) {
          setHighlightedIdeaId(parseInt(sharedIdeaId));
        }
      } else {
        setHasSubmitted(sessionData.hasSubmitted);
      }
      
      // Save session ID to localStorage for persistence across page refreshes
      localStorage.setItem('ai-ideas-session', sessionData.sessionId);
    }
  }, [sessionData]);

  // Check for shared idea URL on mount and grant access
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedIdeaId = urlParams.get('idea');
    console.log('Checking shared link access:', { sharedIdeaId, currentURL: window.location.href });
    
    if (sharedIdeaId) {
      console.log('Found shared idea ID, granting access');
      setSharedIdeaAccess(true);
      setHasSubmitted(true); // Grant access to all ideas
      setHighlightedIdeaId(parseInt(sharedIdeaId));
      setIsSharedLink(true); // Mark this as a shared link
      // Store the bypass in localStorage for session persistence
      localStorage.setItem('shared-idea-access', 'true');
    } else {
      // Check if user previously accessed via shared link
      const hasSharedAccess = localStorage.getItem('shared-idea-access');
      if (hasSharedAccess === 'true') {
        console.log('Found stored shared access, granting access');
        setSharedIdeaAccess(true);
        setHasSubmitted(true);
      }
    }
  }, []);

  const handleIdeaSubmitted = (newIdeaId?: number, ideaText?: string) => {
    setShowGiftCardPopup(true);
    if (newIdeaId) {
      setNewlySubmittedIdeaId(newIdeaId);
      setSubmittedIdeaText(ideaText || '');
      // Clear the highlight after 15 seconds
      setTimeout(() => {
        setNewlySubmittedIdeaId(null);
      }, 15000);
    }
    queryClient.invalidateQueries({ queryKey: ['/api/session'] });
  };

  const handleGiftCardPopupClose = () => {
    setShowGiftCardPopup(false);
    setShowUnlockMessage(true);
    setHasSubmitted(true);
    setTimeout(() => {
      setShowUnlockMessage(false);
    }, 3000);
  };

  const handleVote = (ideaId: number, voteType: 'up' | 'down') => {
    voteMutation.mutate({ ideaId, voteType });
    
    // Track interactions for non-authenticated users
    if (!isAuthenticated) {
      const newCount = interactionCount + 1;
      setInteractionCount(newCount);
      
      // Show account creation popup after 3 interactions
      if (newCount >= 3) {
        setShowAccountCreationPopup(true);
        setInteractionCount(0); // Reset counter
      }
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen font-inter">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4 md:py-6">
          <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
            <div className="flex items-center justify-between sm:justify-start sm:space-x-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                  <Lightbulb className="text-white text-base sm:text-lg" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                    <span className="sm:hidden">How Do You<br/>Use AI?</span>
                    <span className="hidden sm:inline">How Do You Use AI?</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600">
                    <span className="sm:hidden">Real World Use Cases<br/>for AI and ChatGPT</span>
                    <span className="hidden sm:inline">Real World Use Cases for AI and ChatGPT</span>
                  </p>
                </div>
              </div>
              <div className="sm:hidden">
                <div className="bg-white px-3 py-2 rounded-lg">
                  <div className="flex flex-col text-center">
                    <span className="font-bold text-base text-slate-900">
                      {(stats as any)?.totalIdeas || 0}
                    </span>
                    <span className="text-xs font-medium text-slate-700 mt-0.5">
                      ideas shared
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex sm:items-center sm:space-x-4">
              <div className="bg-white px-5 py-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-lg text-slate-900">
                    {(stats as any)?.totalIdeas || 0}
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    ideas shared
                  </span>
                </div>
              </div>
              
              {/* Authentication Area */}
              <div className="flex items-center space-x-3">
                {!authLoading && user ? (
                  <div className="flex items-center space-x-3">
                    <UserDropdown 
                      user={user} 
                      onLogout={() => {
                        window.location.href = '/api/logout';
                      }}
                    />
                  </div>
                ) : authLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => window.location.href = '/auth'}
                      variant="outline"
                      size="sm"
                      className="text-sm"
                    >
                      Login / Sign Up
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Show unlock message */}
        {showUnlockMessage && <UnlockMessage />}



        {/* Submission Section - Only show when paywall enabled AND user hasn't submitted */}
        {paywallEnabled && !hasSubmitted && (
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                {paywallEnabled 
                  ? "Need more AI ideas? We've got hundreds! But share yours first!"
                  : "Share Your AI Use Case!"
                }
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-6">
                {paywallEnabled
                  ? "Wanna see how hundreds of other geniuses are using AI? You've gotta share your own use case first! We don't care if you think it's silly - just share it! We don't need your email, name or your login, just your idea."
                  : "Share how you're using AI in your work or personal life. Help others discover new ways to leverage AI technology. No email or login required - just your creative ideas!"
                }
              </p>
              
              {/* ChatGPT Prompt Suggestion */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 max-w-3xl mx-auto">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <h2 className="text-lg font-semibold text-green-900">Need Ideas? Ask ChatGPT!</h2>
                </div>
                <p className="text-sm text-green-800 mb-3">
                  Copy this prompt to ChatGPT, then paste the best responses into the form below:
                </p>
                <div className="relative bg-white border border-green-300 rounded-lg p-4">
                  <div className="font-mono text-sm text-slate-700 mb-3 whitespace-pre-line">
                    {isPromptExpanded ? (
                      `Based on all our past chats, tell me the 5 most innovative, unique, or genius ways I've actually used AI in real-world execution — especially in business, content, or parenting.

For each one, break it down tactically with:

The original idea or use-case
The problem it solved
The exact workflow or prompt structure used
What made it clever or non-obvious
How it could be scaled, productized, or improved

Prioritize examples that combine creativity + execution. If relevant, include what most people would've done instead — and why mine was better.`
                    ) : (
                      `Based on all our past chats, tell me the 5 most innovative...`
                    )}
                  </div>
                  
                  {/* Expand/Collapse button */}
                  <button
                    onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                    className="absolute bottom-2 left-2 text-green-700 hover:text-green-900 text-xs flex items-center gap-1 transition-colors font-medium"
                    aria-label={isPromptExpanded ? "Collapse ChatGPT prompt" : "Expand ChatGPT prompt"}
                  >
                    {isPromptExpanded ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        Read more
                      </>
                    )}
                  </button>
                  
                  {/* Copy button */}
                  <button
                    onClick={(event) => {
                      navigator.clipboard.writeText(`Based on all our past chats, tell me the 5 most innovative, unique, or genius ways I've actually used AI in real-world execution — especially in business, content, or parenting.

For each one, break it down tactically with:

The original idea or use-case
The problem it solved
The exact workflow or prompt structure used
What made it clever or non-obvious
How it could be scaled, productized, or improved

Prioritize examples that combine creativity + execution. If relevant, include what most people would've done instead — and why mine was better.`);
                      // Show temporary feedback
                      const btn = event.currentTarget as HTMLButtonElement;
                      const originalText = btn.textContent;
                      btn.textContent = "Copied!";
                      btn.classList.add("bg-green-600");
                      setTimeout(() => {
                        btn.textContent = originalText;
                        btn.classList.remove("bg-green-600");
                      }, 2000);
                    }}
                    className="absolute top-2 right-2 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded-md transition-colors font-medium"
                    aria-label="Copy ChatGPT prompt to clipboard"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <IdeaSubmissionForm sessionId={sessionData?.sessionId || sessionId} onSubmitted={handleIdeaSubmitted} />
          </div>
        )}

        {/* Community Section - Show when paywall disabled OR when user has submitted */}
        {(!paywallEnabled || hasSubmitted) && (
          <div>
            {/* Page Title */}
            <div className="mb-4">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 text-center">
                {paywallEnabled ? "AI Use Case Ideas" : "AI + Ideas = Life Changing. Start here 👇"}
              </h1>
              {!paywallEnabled && (
                <p className="text-lg text-slate-600 text-center mt-1">
                  100s of free, real world AI use case ideas
                </p>
              )}
              {paywallEnabled && (
                <div className="mt-4 text-center">
                  <Button
                    onClick={() => setHasSubmitted(false)}
                    className="bg-primary hover:bg-primary/90"
                    aria-label="Submit another AI use case idea"
                  >
                    Submit Another Idea
                  </Button>
                </div>
              )}
            </div>

            {/* Submission Form (when toggled) */}
            {!paywallEnabled && showSubmissionForm && (
              <div className="mb-8">
                <IdeaSubmissionForm 
                  sessionId={sessionId} 
                  onSubmitted={(ideaId, ideaText) => {
                    setNewlySubmittedIdeaId(ideaId || null);
                    if (ideaText) setSubmittedIdeaText(ideaText);
                    setHasSubmitted(true);
                    setShowSubmissionForm(false); // Hide form after submission
                    // Show gift card popup for new submissions
                    if (ideaId) {
                      setShowGiftCardPopup(true);
                    }
                    // Invalidate ideas cache to refresh the list
                    queryClient.invalidateQueries({ queryKey: ['/api/ideas'] });
                  }}
                />
              </div>
            )}

            {/* Search and Filter Controls - Sticky */}
            <div className="sticky top-0 sm:top-20 z-50 bg-slate-50 pb-2 md:pb-4 mb-4 md:mb-6 space-y-2 md:space-y-4 shadow-md border-b border-slate-200">
              {/* Search Bar */}
              <div className="relative w-full">
                <div className="flex items-center bg-white border-2 border-purple-200 hover:border-purple-400 focus-within:border-purple-500 transition-all rounded-lg">
                  <Search className="absolute left-3 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="🔍 Search ideas, categories, tools..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 md:py-3 bg-transparent focus:outline-none text-gray-900 placeholder-gray-500 text-sm md:text-base"
                    aria-label="Search ideas, categories, and tools"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 text-gray-500 hover:text-gray-700"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Filter and Sort Controls */}
              <div className="grid grid-cols-3 gap-2 md:gap-4">
                {/* Category Filter */}
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full bg-white border border-blue-200 hover:border-blue-400 focus:border-blue-500 py-2 md:py-3 text-xs md:text-sm">
                    <SelectValue placeholder={isMobile ? "Category" : "🎯 Filter by Category"} />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="content-creation">Content Creation</SelectItem>
                      <SelectItem value="marketing-ads">Marketing & Ads</SelectItem>
                      <SelectItem value="sales-outreach">Sales & Outreach</SelectItem>
                      <SelectItem value="automation-ai-agents">Automation & AI Agents</SelectItem>
                      <SelectItem value="data-analysis-reporting">Data Analysis & Reporting</SelectItem>
                      <SelectItem value="productivity-time-saving">Productivity & Time-Saving</SelectItem>
                      <SelectItem value="customer-support">Customer Support</SelectItem>
                      <SelectItem value="ecommerce-dropshipping">E-commerce & Dropshipping</SelectItem>
                      <SelectItem value="personal-lifestyle">Personal Life & Lifestyle</SelectItem>
                      <SelectItem value="real-estate">Real Estate</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                
                {/* Tool Filter */}
                <Select value={selectedTool} onValueChange={setSelectedTool}>
                  <SelectTrigger className="w-full bg-white border border-green-200 hover:border-green-400 focus:border-green-500 py-2 md:py-3 text-xs md:text-sm">
                    <SelectValue placeholder={isMobile ? "Tool" : "🛠️ Filter by Tool"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tools</SelectItem>
                    <SelectItem value="ChatGPT">ChatGPT</SelectItem>
                    <SelectItem value="Claude">Claude</SelectItem>
                    <SelectItem value="Midjourney">Midjourney</SelectItem>
                    <SelectItem value="DALL-E">DALL-E</SelectItem>
                    <SelectItem value="Stable Diffusion">Stable Diffusion</SelectItem>
                    <SelectItem value="GitHub Copilot">GitHub Copilot</SelectItem>
                    <SelectItem value="Cursor">Cursor</SelectItem>
                    <SelectItem value="Notion AI">Notion AI</SelectItem>
                    <SelectItem value="Zapier">Zapier</SelectItem>
                    <SelectItem value="Make">Make</SelectItem>
                    <SelectItem value="Custom API">Custom API</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort Dropdown */}
                <Select value={sortBy} onValueChange={(value: 'votes' | 'recent' | 'comments') => setSortBy(value)}>
                  <SelectTrigger className="w-full bg-white border border-orange-200 hover:border-orange-400 focus:border-orange-500 py-2 md:py-3 text-xs md:text-sm">
                    <SelectValue placeholder={isMobile ? "Sort" : "📊 Sort by"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="votes">{isMobile ? "Upvotes" : "🔥 Sort by Upvotes"}</SelectItem>
                    <SelectItem value="recent">{isMobile ? "Recent" : "⏰ Most Recent"}</SelectItem>
                    <SelectItem value="comments">{isMobile ? "Comments" : "💬 Most Comments"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Amazon Gift Card Banner - Subtle, below filters */}
            <div className="mb-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4 shadow-sm">
              <div className="text-center">
                <p className="text-sm font-medium text-amber-800 mb-1">
                  🏆 The most upvoted idea every week will win a free $100 Amazon gift card! 🏆
                </p>
                <p className="text-xs text-amber-700">
                  Get 1 free upvote for every 3 upvotes you give out!
                </p>
              </div>
            </div>

            {ideasLoading ? (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-20 bg-slate-200 rounded"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                        <div className="h-4 bg-slate-200 rounded w-full"></div>
                        <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : ideas && ideas.length > 0 ? (
              <div className="space-y-6">
                {/* Sort ideas to put recently submitted ones first for the submitter */}
                {ideas
                  .sort((a: any, b: any) => {
                    // Recently submitted ideas go to the top for the submitter
                    if (a.isRecentlySubmitted && !b.isRecentlySubmitted) return -1;
                    if (b.isRecentlySubmitted && !a.isRecentlySubmitted) return 1;
                    
                    // Highlighted ideas (shared links)
                    if (highlightedIdeaId) {
                      if (a.id === highlightedIdeaId) return -1;
                      if (b.id === highlightedIdeaId) return 1;
                    }
                    if (newlySubmittedIdeaId) {
                      if (a.id === newlySubmittedIdeaId) return -1;
                      if (b.id === newlySubmittedIdeaId) return 1;
                    }
                    return 0;
                  })
                  .slice(0, visibleIdeasCount)
                  .map((idea: any, index: number) => {
                    const elements = [
                      <IdeaCard 
                        key={idea.id}
                        idea={idea} 
                        onVote={handleVote}
                        isVoting={voteMutation.isPending}
                        isHighlighted={highlightedIdeaId === idea.id || newlySubmittedIdeaId === idea.id}
                        isRecentlySubmitted={idea.isRecentlySubmitted}
                        isSharedLink={isSharedLink && highlightedIdeaId === idea.id}
                      />
                    ];
                    
                    // Add subscription component after 3rd, 11th, and 18th ideas
                    if (index + 1 === 3 || index + 1 === 11 || index + 1 === 18) {
                      elements.push(
                        <InlineSubscribe key={`subscribe-${index}`} />
                      );
                    }
                    
                    return elements;
                  })
                  .flat()}
                
                {/* Show More Button */}
                {ideas.length > visibleIdeasCount && (
                  <div className="text-center pt-8">
                    <Button
                      onClick={() => setVisibleIdeasCount(prev => prev + 20)}
                      variant="outline"
                      className="px-4 md:px-8 py-3 text-sm md:text-lg whitespace-nowrap"
                    >
                      <span className="hidden sm:inline">Show 20 More Ideas ({ideas.length - visibleIdeasCount} remaining)</span>
                      <span className="sm:hidden">Show 20 More ({ideas.length - visibleIdeasCount})</span>
                    </Button>
                  </div>
                )}


              </div>
            ) : (
              <div className="text-center py-12">
                <Lightbulb className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No ideas yet</h3>
                <p className="text-slate-600">Be the first to share your AI use case!</p>
              </div>
            )}
          </div>
        )}

        {/* Subscription Section */}
        <div id="subscription-section" className="mt-12">
          <SubscriptionForm subscriberCount={(stats as any)?.totalSubscribers || 0} />
        </div>

        {/* Feature Request Section */}
        <div className="mt-12 text-center">
          <a
            href="mailto:chris@cofounders.com?subject=Feature Request - AI Ideas Exchange"
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            💡 Request a Feature
          </a>
        </div>

        {/* SEO Content Section - Moved to bottom for cleaner UX while preserving SEO */}
        <div className="mt-16 border-t border-slate-200 pt-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              How Do You Use AI? Real ChatGPT & AI Applications
            </h2>
            <p className="text-lg text-slate-700 mb-6">
              Discover hundreds of practical ways people use artificial intelligence and ChatGPT for work, business, and daily life. Learn real AI use cases, creative applications, and proven strategies from our community.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600 mb-8">
              <div>✓ AI Content Creation</div>
              <div>✓ ChatGPT for Business</div>
              <div>✓ Marketing Automation</div>
              <div>✓ Data Analysis with AI</div>
              <div>✓ AI Customer Support</div>
              <div>✓ Productivity Tools</div>
              <div>✓ Creative AI Projects</div>
              <div>✓ AI for E-commerce</div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Share My Idea Button - Fixed position at bottom center */}
      {!paywallEnabled && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <Button
            onClick={() => {
              setShowSubmissionForm(!showSubmissionForm);
              // Scroll to top to show the submission form
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-bold rounded-full shadow-2xl transition-all hover:scale-105 whitespace-nowrap flex items-center"
            style={{ 
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              boxShadow: '0 10px 25px rgba(79, 70, 229, 0.3)'
            }}
          >
            🚀&nbsp;&nbsp;Share My Idea
          </Button>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <Lightbulb className="text-white text-sm" />
              </div>
              <span className="text-slate-600">How Do You Use AI?</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-slate-600">
              <a href="#" className="hover:text-slate-900 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Terms of Service</a>
              <a href="mailto:chris@cofounders.com?subject=Feature Request - AI Ideas Exchange" className="hover:text-slate-900 transition-colors">Feature Request</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Gift Card Popup */}
      <Suspense fallback={null}>
        <GiftCardPopup
          isOpen={showGiftCardPopup}
          onClose={handleGiftCardPopupClose}
          sessionId={sessionId}
          submittedIdeaId={newlySubmittedIdeaId || undefined}
          submittedIdeaText={submittedIdeaText}
        />
      </Suspense>

      {/* Account Creation Popup */}
      <Suspense fallback={null}>
        <AccountCreationPopup
          isOpen={showAccountCreationPopup}
          onClose={() => setShowAccountCreationPopup(false)}
        />
      </Suspense>
    </div>
  );
}
