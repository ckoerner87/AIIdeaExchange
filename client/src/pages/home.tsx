import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Lightbulb, Bell } from "lucide-react";
import IdeaSubmissionForm from "@/components/idea-submission-form";
import IdeaCard from "@/components/idea-card";
import SubscriptionForm from "@/components/subscription-form";
import UnlockMessage from "@/components/unlock-message";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Home() {
  const [sessionId, setSessionId] = useState<string>("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showUnlockMessage, setShowUnlockMessage] = useState(false);
  const [sortBy, setSortBy] = useState<'votes' | 'recent'>('votes');

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

  // Get ideas (only if user has submitted)
  const { data: ideas, isLoading: ideasLoading } = useQuery({
    queryKey: ['/api/ideas', sortBy],
    queryFn: async () => {
      const res = await fetch(`/api/ideas?sort=${sortBy}`, {
        headers: {
          'x-session-id': sessionId,
        },
      });
      if (!res.ok) {
        if (res.status === 403) return null; // User hasn't submitted yet
        throw new Error('Failed to get ideas');
      }
      return res.json();
    },
    enabled: !!sessionId && hasSubmitted,
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ ideaId, voteType }: { ideaId: number; voteType: 'up' | 'down' }) => {
      const res = await apiRequest('POST', `/api/ideas/${ideaId}/vote`, { voteType });
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
    }
  }, [sessionData]);

  const handleIdeaSubmitted = () => {
    setShowUnlockMessage(true);
    setHasSubmitted(true);
    queryClient.invalidateQueries({ queryKey: ['/api/session'] });
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
                <p className="text-sm text-slate-600">Share creative AI use cases</p>
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

        {/* Submission Section */}
        {!hasSubmitted && (
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Share Your AI Use Case</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Share how you're using AI in your work or life. Once you contribute, you'll unlock access to see what others are doing with AI and vote on the best ideas.
              </p>
            </div>
            <IdeaSubmissionForm sessionId={sessionId} onSubmitted={handleIdeaSubmitted} />
          </div>
        )}

        {/* Community Section */}
        {hasSubmitted && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Community AI Ideas</h2>
                <p className="text-slate-600">Discover how others are using AI creatively</p>
              </div>
              <div className="flex items-center space-x-4">
                <Select value={sortBy} onValueChange={(value: 'votes' | 'recent') => setSortBy(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="votes">Sort by votes</SelectItem>
                    <SelectItem value="recent">Most recent</SelectItem>
                  </SelectContent>
                </Select>
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

        {/* Subscription Section */}
        <div id="subscription-section" className="mt-16">
          <SubscriptionForm subscriberCount={stats?.totalSubscribers || 0} />
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
    </div>
  );
}
