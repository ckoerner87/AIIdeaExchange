import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Lightbulb, Bell, ChevronDown, ChevronUp } from "lucide-react";
import IdeaSubmissionForm from "@/components/idea-submission-form";
import IdeaCard from "@/components/idea-card";
import SubscriptionForm from "@/components/subscription-form";
import UnlockMessage from "@/components/unlock-message";
import GiftCardPopup from "@/components/gift-card-popup";
import InlineSubscribe from "@/components/inline-subscribe";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Home() {
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
  const [sortBy, setSortBy] = useState<'votes' | 'recent'>('votes');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [sharedIdeaAccess, setSharedIdeaAccess] = useState(false);
  const [highlightedIdeaId, setHighlightedIdeaId] = useState<number | null>(null);
  const [visibleIdeasCount, setVisibleIdeasCount] = useState(20);
  const [newlySubmittedIdeaId, setNewlySubmittedIdeaId] = useState<number | null>(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [paywallEnabled, setPaywallEnabled] = useState(true);
  const [submittedIdeaText, setSubmittedIdeaText] = useState<string>('');
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);

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
  const { data: ideas, isLoading: ideasLoading } = useQuery({
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
  };

  return (
    <div className="bg-slate-50 min-h-screen font-inter">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <Lightbulb className="text-white text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">How Do You Use AI?</h1>
                <p className="text-sm text-slate-600">Real World Use Cases for AI and ChatGPT</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-75 animate-pulse"></div>
                <div className="relative bg-white border-2 border-blue-200 hover:border-blue-400 focus:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-200/50 animate-slow-bounce px-5 py-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="font-bold text-lg text-slate-900">
                      {(stats as any)?.totalIdeas || 0}
                    </span>
                    <span className="text-sm font-medium text-slate-700">
                      ideas shared
                    </span>
                  </div>
                </div>
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
                  <h3 className="text-lg font-semibold text-green-900">Need Ideas? Ask ChatGPT!</h3>
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
                    className="absolute bottom-2 left-2 text-green-600 hover:text-green-800 text-xs flex items-center gap-1 transition-colors"
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
                    className="absolute top-2 right-2 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded-md transition-colors"
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
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 text-center">
                {paywallEnabled ? "AI Use Case Ideas" : "AI + Ideas = Life Changing. Start here 👇"}
              </h1>
              {paywallEnabled && (
                <div className="mt-4 text-center">
                  <Button
                    onClick={() => setHasSubmitted(false)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Submit Another Idea
                  </Button>
                </div>
              )}
            </div>



            {/* Submit Your Own Idea Button and Sort - Top (only when paywall is disabled) - Sticky */}
            {!paywallEnabled && (
              <div className="sticky top-0 z-20 bg-slate-50 py-4 mb-8 flex flex-col sm:flex-row items-center justify-center gap-4 shadow-sm border-b border-slate-200">
                <div className="text-center">
                  <Button
                    onClick={() => setShowSubmissionForm(!showSubmissionForm)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-6 text-xl font-bold rounded-xl shadow-lg transition-all hover:scale-105"
                  >
                    <Lightbulb className="w-6 h-6 mr-3" />
                    Submit Your Own Idea
                  </Button>
                </div>
                <div className="flex-shrink-0">
                  <Select value={sortBy} onValueChange={(value: 'votes' | 'recent') => setSortBy(value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="votes">Sort by upvotes</SelectItem>
                      <SelectItem value="recent">Most recent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

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

            {/* Filter Dropdowns - Sticky */}
            <div className="sticky top-20 z-10 bg-slate-50 py-4 mb-6 flex flex-col sm:flex-row gap-4 shadow-sm border-b border-slate-200">
              <div className="w-full sm:flex-1 sm:min-w-[200px] relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-75 animate-pulse"></div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="relative w-full bg-white border-2 border-blue-200 hover:border-blue-400 focus:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-200/50 animate-slow-bounce">
                    <SelectValue placeholder="🎯 Filter by Category" />
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
              </div>
              
              <div className="w-full sm:flex-1 sm:min-w-[200px] relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-teal-600 rounded-lg blur opacity-75 animate-pulse"></div>
                <Select value={selectedTool} onValueChange={setSelectedTool}>
                  <SelectTrigger className="relative w-full bg-white border-2 border-green-200 hover:border-green-400 focus:border-green-500 transition-all duration-300 hover:shadow-lg hover:shadow-green-200/50 animate-slow-bounce">
                    <SelectValue placeholder="🛠️ Filter by Tool" />
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
                {/* Sort ideas to put highlighted/newly submitted one first */}
                {ideas
                  .sort((a: any, b: any) => {
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
                      />
                    ];
                    
                    // Add subscription component every 7th idea (but not after the first few)
                    if ((index + 1) % 7 === 0 && index > 5) {
                      elements.push(
                        <InlineSubscribe key={`subscribe-${selectedCategory}-${selectedTool}-${sortBy}-${index}`} />
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

        {/* GIF Section */}
        <div className="mt-8 text-center">
          <div className="flex justify-center gap-6 flex-wrap">
            <img 
              src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaHdpa3piajBreXl0NnBheGV6ZmNoZHl5cnV0NGhsc3F1YWx4N3ZwNCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/fZoKDBwdbILBjhtXZD/giphy.gif"
              alt="AI Animation Left"
              className="rounded-lg shadow-md max-w-sm w-full"
            />
            <img 
              src="https://media.giphy.com/media/SbGMR2CbpUxzCxBL9j/giphy.gif?cid=ecf05e47zlpbxusjvpvzr0yjl5cq0c40uyrebycxspdnupa6&ep=v1_gifs_search&rid=giphy.gif&ct=g"
              alt="AI Animation Right"
              className="rounded-lg shadow-md max-w-sm w-full"
            />
          </div>
        </div>

        {/* Feature Request Section */}
        <div className="mt-12 text-center">
          <a 
            href="mailto:chris@cofounders.com?subject=Feature Request - How Do You Use AI?" 
            className="inline-block bg-gradient-to-r from-primary to-secondary text-white px-8 py-4 rounded-xl font-bold text-xl hover:shadow-lg transition-all transform hover:scale-105"
          >
            💡 Got Ideas? Send Feature Requests
          </a>
          <p className="text-slate-600 mt-3 text-sm">
            Help us improve the platform by sharing your suggestions
          </p>
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
      <GiftCardPopup
        isOpen={showGiftCardPopup}
        onClose={handleGiftCardPopupClose}
        sessionId={sessionId}
        submittedIdeaId={newlySubmittedIdeaId || undefined}
        submittedIdeaText={submittedIdeaText}
      />
    </div>
  );
}
