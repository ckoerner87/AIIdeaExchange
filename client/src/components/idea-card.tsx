import { ChevronUp, ChevronDown, Flag, ExternalLink, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Idea } from "@shared/schema";

interface IdeaCardProps {
  idea: Idea;
  onVote: (ideaId: number, voteType: 'up' | 'down') => void;
  isVoting: boolean;
  isHighlighted?: boolean;
}

const categoryColors: Record<string, string> = {
  "content-creation": "bg-purple-100 text-purple-800",
  "marketing-ads": "bg-pink-100 text-pink-800",
  "sales-outreach": "bg-green-100 text-green-800",
  "automation-ai-agents": "bg-blue-100 text-blue-800",
  "data-analysis-reporting": "bg-indigo-100 text-indigo-800",
  "productivity-time-saving": "bg-cyan-100 text-cyan-800",
  "customer-support": "bg-amber-100 text-amber-800",
  "ecommerce-dropshipping": "bg-emerald-100 text-emerald-800",
  "personal-lifestyle": "bg-rose-100 text-rose-800",
  "real-estate": "bg-orange-100 text-orange-800",
  "other": "bg-gray-100 text-gray-800",
};

const formatTimeAgo = (date: Date) => {
  const now = new Date();
  const diffInMs = now.getTime() - new Date(date).getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  } else if (diffInHours > 0) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  } else {
    return 'Less than an hour ago';
  }
};

export default function IdeaCard({ idea, onVote, isVoting, isHighlighted = false }: IdeaCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const maxLength = 150; // Character limit for truncation
  const useCase = idea.useCase || idea.description || idea.title || "";
  const shouldTruncate = useCase.length > maxLength;
  const displayText = shouldTruncate && !isExpanded 
    ? useCase.substring(0, maxLength) + "..." 
    : useCase;

  const handleShareIdea = async () => {
    const shareUrl = `${window.location.origin}/?idea=${idea.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copied!",
        description: "Share this link to let others see this specific AI use case",
      });
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast({
        title: "Link copied!",
        description: "Share this link to let others see this specific AI use case",
      });
    }
  };

  return (
    <Card className={`border hover:shadow-lg transition-all ${isHighlighted ? 'border-blue-400 bg-blue-50 shadow-lg ring-2 ring-blue-200' : 'border-slate-200'}`}>
      <CardContent className="p-6">
        {isHighlighted && (
          <div className="mb-4 bg-blue-100 border border-blue-300 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-blue-800 text-sm font-medium">This is the shared idea you were sent!</span>
            </div>
          </div>
        )}
        <div className="flex items-start space-x-4">
          <div className="flex flex-col items-center space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
              onClick={() => onVote(idea.id, 'up')}
              disabled={isVoting}
              aria-label={`Upvote idea: ${idea.useCase?.substring(0, 50) || idea.title || 'this idea'}...`}
            >
              <ChevronUp className="text-slate-600 hover:text-blue-600 h-5 w-5" />
            </Button>
            <div className="px-2 text-center">
              <span className="text-sm font-semibold text-slate-700 block">{idea.votes}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
              onClick={() => onVote(idea.id, 'down')}
              disabled={isVoting}
              aria-label={`Downvote idea: ${idea.useCase?.substring(0, 50) || idea.title || 'this idea'}...`}
            >
              <ChevronDown className="text-slate-600 hover:text-red-600 h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-3">
              {idea.category && (
                <Badge 
                  className={`text-xs rounded-full ${categoryColors[idea.category] || categoryColors.other}`}
                  variant="secondary"
                >
                  {idea.category.charAt(0).toUpperCase() + idea.category.slice(1)}
                </Badge>
              )}
            </div>
            
            <div className="mb-4">
              <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{displayText}</p>
              {shouldTruncate && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-2"
                >
                  {isExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>

            {/* Show link if idea has 10+ votes */}
            {idea.votes >= 10 && idea.linkUrl && (() => {
              // Check if the linkUrl is a valid URL
              const isValidUrl = (url: string) => {
                try {
                  // More comprehensive URL validation
                  return url.includes('.') && (
                    url.startsWith('http://') || 
                    url.startsWith('https://') || 
                    url.startsWith('www.') ||
                    /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(url)
                  );
                } catch {
                  return false;
                }
              };

              const formatUrl = (url: string) => {
                if (url.startsWith('www.') || (!url.startsWith('http://') && !url.startsWith('https://') && url.includes('.'))) {
                  return `https://${url}`;
                }
                return url;
              };

              return isValidUrl(idea.linkUrl) ? (
                <div className="mb-3">
                  <a
                    href={formatUrl(idea.linkUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Visit Link</span>
                  </a>
                </div>
              ) : (
                <div className="mb-3">
                  <div className="flex items-center space-x-2 text-slate-500 text-sm">
                    <ExternalLink className="h-4 w-4" />
                    <span>{idea.linkUrl}</span>
                  </div>
                </div>
              );
            })()}
            <div className="flex items-center justify-between text-sm text-slate-500">
              <div className="flex items-center space-x-4">
                {idea.tools && <span>Tools: {idea.tools}</span>}
                <span>{formatTimeAgo(idea.submittedAt)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShareIdea}
                  className="flex items-center space-x-1 text-slate-400 hover:text-slate-600"
                >
                  <Copy className="h-3 w-3" />
                  <span>Share</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center space-x-1 text-slate-400 hover:text-slate-600"
                >
                  <Flag className="h-3 w-3" />
                  <span>Report</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
