import { useQuery, useMutation } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Lightbulb, Bell, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import IdeaSubmissionForm from "@/components/idea-submission-form";
import IdeaCard from "@/components/idea-card";
import SubscriptionForm from "@/components/subscription-form";
import UnlockMessage from "@/components/unlock-message";
import GiftCardPopup from "@/components/gift-card-popup";
import InlineSubscribe from "@/components/inline-subscribe";
import { UserDropdown } from "@/components/user-dropdown";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [sessionId, setSessionId] = useState<string>('');
  
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [paywallEnabled, setPaywallEnabled] = useState(false);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [showUnlockMessage, setShowUnlockMessage] = useState(false);
  const [showGiftCardPopup, setShowGiftCardPopup] = useState(false);
  const [newlySubmittedIdeaId, setNewlySubmittedIdeaId] = useState<number | null>(null);
  const [submittedIdeaText, setSubmittedIdeaText] = useState('');
  const [highlightedIdeaId, setHighlightedIdeaId] = useState<number | null>(null);
  const [sharedIdeaAccess, setSharedIdeaAccess] = useState(false);
  const [isSharedLink, setIsSharedLink] = useState(false);
  const [sortBy, setSortBy] = useState<'votes' | 'recent' | 'comments'>('votes');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTool, setSelectedTool] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);

  // Get session data first
  const { data: sessionData } = useQuery({
    queryKey: ['/api/session'],
    queryFn: async () => {
      const res = await fetch('/api/session');
      if (!res.ok) throw new Error('Failed to get session');
      return res.json();
    },
  });

  // Initialize session ID when sessionData is available
  useEffect(() => {
    if (sessionData?.sessionId && !sessionId) {
      setSessionId(sessionData.sessionId);
      setHasSubmitted(sessionData.hasSubmitted || false);
    }
  }, [sessionData, sessionId]);

  // Check paywall status
  const { data: paywallStatus } = useQuery({
    queryKey: ['/api/paywall-status'],
  });

  useEffect(() => {
    if (paywallStatus?.enabled !== undefined) {
      setPaywallEnabled(paywallStatus.enabled);
    }
  }, [paywallStatus]);

  // Activity tracking
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

  // Get recently submitted idea for highlighting (only for current user)
  const { data: recentlySubmittedIdea } = useQuery({
    queryKey: ['/api/recently-submitted'],
    queryFn: async () => {
      const res = await fetch('/api/recently-submitted', {
        headers: {
          'x-session-id': sessionId,
        },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!sessionId,
    refetchInterval: 5000, // Check every 5 seconds for recently submitted ideas
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

  // Process and order ideas with recently submitted at top
  const processedIdeas = React.useMemo(() => {
    if (!allIdeas) return [];
    
    // Filter based on search query
    const filteredIdeas = allIdeas.filter((idea: any) => {
      if (!searchQuery.trim()) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        idea.useCase?.toLowerCase().includes(query) ||
        idea.title?.toLowerCase().includes(query) ||
        idea.description?.toLowerCase().includes(query) ||
        idea.category?.toLowerCase().includes(query) ||
        idea.tools?.toLowerCase().includes(query)
      );
    });

    // Separate recently submitted idea from others
    const recentlySubmittedId = recentlySubmittedIdea?.id;
    const recentIdea = recentlySubmittedId ? filteredIdeas.find(idea => idea.id === recentlySubmittedId) : null;
    const otherIdeas = filteredIdeas.filter(idea => idea.id !== recentlySubmittedId);

    // If there's a recently submitted idea, put it at the top
    if (recentIdea) {
      return [{ ...recentIdea, isRecentlySubmitted: true }, ...otherIdeas];
    }

    return filteredIdeas;
  }, [allIdeas, searchQuery, recentlySubmittedIdea]);

  // Use processedIdeas instead of ideas
  const ideas = processedIdeas;

  // Get session data
  const { data: sessionData } = useQuery({
    queryKey: ['/api/session'],
    queryFn: async () => {
      const res = await fetch('/api/session', {
        headers: {
          'x-session-id': sessionId,
        },
      });
      if (!res.ok) throw new Error('Failed to get session');
      return res.json();
    },
    enabled: !!sessionId,
  });

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
                {isAuthenticated && user ? (
                  <div className="flex items-center space-x-3">
                    <UserDropdown user={{
                      id: user.id,
                      username: user.username || undefined,
                      email: user.email || undefined,
                      firstName: user.firstName || undefined,
                      lastName: user.lastName || undefined,
                    }} />
                  </div>
                ) : (
                  <a
                    href="/api/login"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Login / Sign Up
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Ideas list */}
        {(!paywallEnabled || hasSubmitted) && (
          <div>
            {/* Search and Filter Controls - Sticky */}
            <div className="sticky top-0 sm:top-20 z-40 bg-slate-50 pb-4 mb-6 space-y-4 shadow-md border-b border-slate-200">
              {/* Search Bar and Submit Button Row */}
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                {/* Search Bar - Left Side */}
                <div className="relative flex-1 w-full">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg blur opacity-75 animate-pulse"></div>
                  <div className="relative flex items-center bg-white border-2 border-purple-200 hover:border-purple-400 focus-within:border-purple-500 transition-all duration-300 hover:shadow-lg hover:shadow-purple-200/50 rounded-lg">
                    <Search className="absolute left-3 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="🔍 Search ideas, categories, tools..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 bg-transparent focus:outline-none text-gray-900 placeholder-gray-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Submit Button - Right Side (only when paywall is disabled) */}
                {!paywallEnabled && (
                  <div className="flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowSubmissionForm(!showSubmissionForm);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-bold rounded-xl shadow-lg transition-all hover:scale-105 whitespace-nowrap h-[50px] flex items-center cursor-pointer touch-manipulation"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <Lightbulb className="w-5 h-5 mr-2" />
                      Share My Idea
                    </button>
                  </div>
                )}
              </div>
              
              {/* Filter and Sort Controls - Three equal columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Category Filter */}
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-75 animate-pulse"></div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="relative w-full bg-white border-2 border-blue-200 hover:border-blue-400 focus:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-200/50 animate-slow-bounce">
                      <SelectValue placeholder="🎯 Filter by Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">🌟 All Categories</SelectItem>
                      <SelectItem value="business">💼 Business</SelectItem>
                      <SelectItem value="content">📝 Content Creation</SelectItem>
                      <SelectItem value="productivity">⚡ Productivity</SelectItem>
                      <SelectItem value="learning">🎓 Learning</SelectItem>
                      <SelectItem value="creative">🎨 Creative</SelectItem>
                      <SelectItem value="technical">⚙️ Technical</SelectItem>
                      <SelectItem value="personal">👤 Personal</SelectItem>
                      <SelectItem value="other">🔧 Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tool Filter */}
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg blur opacity-75 animate-pulse"></div>
                  <Select value={selectedTool} onValueChange={setSelectedTool}>
                    <SelectTrigger className="relative w-full bg-white border-2 border-green-200 hover:border-green-400 focus:border-green-500 transition-all duration-300 hover:shadow-lg hover:shadow-green-200/50 animate-slow-bounce">
                      <SelectValue placeholder="🛠️ Filter by Tool" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">🔧 All Tools</SelectItem>
                      <SelectItem value="chatgpt">🤖 ChatGPT</SelectItem>
                      <SelectItem value="claude">🧠 Claude</SelectItem>
                      <SelectItem value="midjourney">🎨 Midjourney</SelectItem>
                      <SelectItem value="github-copilot">👨‍💻 GitHub Copilot</SelectItem>
                      <SelectItem value="zapier">⚡ Zapier</SelectItem>
                      <SelectItem value="custom-gpt">🔧 Custom GPT</SelectItem>
                      <SelectItem value="perplexity">🔍 Perplexity</SelectItem>
                      <SelectItem value="other">🛠️ Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg blur opacity-75 animate-pulse"></div>
                  <Select value={sortBy} onValueChange={(value: 'votes' | 'recent' | 'comments') => setSortBy(value)}>
                    <SelectTrigger className="relative w-full bg-white border-2 border-orange-200 hover:border-orange-400 focus:border-orange-500 transition-all duration-300 hover:shadow-lg hover:shadow-orange-200/50 animate-slow-bounce">
                      <SelectValue placeholder="📊 Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="votes">🔥 Sort by Upvotes</SelectItem>
                      <SelectItem value="recent">⏰ Most Recent</SelectItem>
                      <SelectItem value="comments">💬 Most Comments</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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

            {/* Ideas Grid */}
            {ideasLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading ideas...</p>
              </div>
            ) : ideas?.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No ideas found matching your search.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {ideas?.map((idea: any, index: number) => {
                  // Add inline subscription components at positions 3, 11, and 18
                  const shouldShowInlineSubscribe = (index === 2 || index === 10 || index === 17) && !showSubscriptionForm;
                  
                  return (
                    <div key={idea.id}>
                      <IdeaCard
                        idea={idea}
                        onVote={(voteType) => handleVote(idea.id, voteType)}
                        sessionId={sessionId}
                        isHighlighted={idea.isRecentlySubmitted}
                        className={idea.isRecentlySubmitted ? "animate-pulse border-green-500 border-2 bg-green-50" : ""}
                      />
                      {shouldShowInlineSubscribe && (
                        <div className="my-8">
                          <InlineSubscribe />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  function handleVote(ideaId: number, voteType: 'up' | 'down') {
    voteMutation.mutate({ ideaId, voteType });
  }
}