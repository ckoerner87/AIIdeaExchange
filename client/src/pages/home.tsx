import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Lightbulb, Bell } from "lucide-react";
import IdeaSubmissionForm from "@/components/idea-submission-form";
import IdeaCard from "@/components/idea-card";
import SubscriptionForm from "@/components/subscription-form";
import UnlockMessage from "@/components/unlock-message";
import GiftCardPopup from "@/components/gift-card-popup";
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
  const [sharedIdeaAccess, setSharedIdeaAccess] = useState(false);

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

  // Get stats
  const { data: stats } = useQuery({
    queryKey: ['/api/stats'],
  });

  // Get ideas (only if user has submitted or has shared access)
  const { data: ideas, isLoading: ideasLoading } = useQuery({
    queryKey: ['/api/ideas', sortBy, selectedCategory],
    queryFn: async () => {
      const categoryParam = selectedCategory ? `&category=${selectedCategory}` : '';
      const res = await fetch(`/api/ideas?sort=${sortBy}${categoryParam}`, {
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
    enabled: !!sessionId && (hasSubmitted || sharedIdeaAccess),
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
      setHasSubmitted(sessionData.hasSubmitted);
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

  const handleIdeaSubmitted = () => {
    setShowGiftCardPopup(true);
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
                <p className="text-sm text-slate-600">Discover Real AI Applications & ChatGPT Use Cases</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600">
                {(stats as any)?.totalIdeas || 0} ideas shared
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Show unlock message */}
        {showUnlockMessage && <UnlockMessage />}

        {/* SEO Content Section */}
        {!hasSubmitted && (
          <div className="mb-8">
            <div className="text-center mb-8">
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
        )}

        {/* Submission Section */}
        {!hasSubmitted && (
          <div className="mb-12">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Share Your AI Use Case</h3>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Wanna see how hundreds of other geniuses are using AI? You've gotta share your own use case first! We don't care if you think it's silly - just share it! We don't need your email, name or your login, just your idea.
              </p>
            </div>
            <IdeaSubmissionForm sessionId={sessionData?.sessionId || sessionId} onSubmitted={handleIdeaSubmitted} />
          </div>
        )}

        {/* Community Section */}
        {hasSubmitted && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">AI Use Case Ideas</h2>
              </div>
              <div className="flex items-center space-x-4">
                <Button
                  onClick={() => setHasSubmitted(false)}
                  className="bg-primary hover:bg-primary/90"
                >
                  Submit Another Idea
                </Button>
                <Select value={sortBy} onValueChange={(value: 'votes' | 'recent') => setSortBy(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="votes">Sort by upvotes</SelectItem>
                    <SelectItem value="recent">Most recent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category Filter */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('')}
                  className="rounded-full"
                >
                  All Categories
                </Button>
                <Button
                  variant={selectedCategory === 'content-creation' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('content-creation')}
                  className="rounded-full"
                >
                  Content Creation
                </Button>
                <Button
                  variant={selectedCategory === 'marketing-ads' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('marketing-ads')}
                  className="rounded-full"
                >
                  Marketing & Ads
                </Button>
                <Button
                  variant={selectedCategory === 'sales-outreach' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('sales-outreach')}
                  className="rounded-full"
                >
                  Sales & Outreach
                </Button>
                <Button
                  variant={selectedCategory === 'automation-ai-agents' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('automation-ai-agents')}
                  className="rounded-full"
                >
                  Automation & AI Agents
                </Button>
                <Button
                  variant={selectedCategory === 'data-analysis-reporting' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('data-analysis-reporting')}
                  className="rounded-full"
                >
                  Data Analysis & Reporting
                </Button>
                <Button
                  variant={selectedCategory === 'productivity-time-saving' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('productivity-time-saving')}
                  className="rounded-full"
                >
                  Productivity & Time-Saving
                </Button>
                <Button
                  variant={selectedCategory === 'customer-support' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('customer-support')}
                  className="rounded-full"
                >
                  Customer Support
                </Button>
                <Button
                  variant={selectedCategory === 'ecommerce-dropshipping' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('ecommerce-dropshipping')}
                  className="rounded-full"
                >
                  E-commerce & Dropshipping
                </Button>
                <Button
                  variant={selectedCategory === 'personal-lifestyle' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('personal-lifestyle')}
                  className="rounded-full"
                >
                  Personal Life & Lifestyle
                </Button>
                <Button
                  variant={selectedCategory === 'real-estate' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('real-estate')}
                  className="rounded-full"
                >
                  Real Estate
                </Button>
                <Button
                  variant={selectedCategory === 'other' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('other')}
                  className="rounded-full"
                >
                  Other
                </Button>
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
                {ideas.map((idea: any) => (
                  <IdeaCard 
                    key={idea.id} 
                    idea={idea} 
                    onVote={handleVote}
                    isVoting={voteMutation.isPending}
                  />
                ))}
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

        {/* Submit Another Idea Button - Above subscription form */}
        {hasSubmitted && (
          <div className="mt-16 text-center">
            <Button
              onClick={() => setHasSubmitted(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-xl font-bold text-xl transition-all transform hover:scale-105"
            >
              Submit Another Idea
            </Button>
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
      />
    </div>
  );
}
