import { ChevronUp, ChevronDown, Flag, ExternalLink, Copy, Link2, Image, FileText, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, memo, lazy, Suspense, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Idea } from "@shared/schema";

// Lazy load comment section for better performance
const CommentSection = lazy(() => import("@/components/comment-section"));

interface IdeaCardProps {
  idea: Idea;
  onVote: (ideaId: number, voteType: 'up' | 'down') => void;
  isVoting: boolean;
  isHighlighted?: boolean;
  isSharedLink?: boolean;
  isRecentlySubmitted?: boolean;
}

// Function to format category names properly
const formatCategoryName = (category: string): string => {
  const categoryMap: Record<string, string> = {
    'marketing-ads': 'Marketing & Ads',
    'automation-ai-agents': 'Automation AI Agents',
    'data-analysis-reporting': 'Data Analysis & Reporting',
    'sales-outreach': 'Sales & Outreach',
    'content-creation': 'Content Creation',
    'productivity-time-saving': 'Productivity & Time-Saving',
    'customer-support': 'Customer Support',
    'ecommerce-dropshipping': 'E-commerce & Dropshipping',
    'personal-lifestyle': 'Personal & Lifestyle',
    'real-estate': 'Real Estate',
  };

  return categoryMap[category] || category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

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

export default function IdeaCard({ idea, onVote, isVoting, isHighlighted = false, isSharedLink = false, isRecentlySubmitted = false }: IdeaCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  
  // Memoize expensive calculations for better performance
  const { useCase, shouldTruncate, displayText } = useMemo(() => {
    const maxLength = 150;
    const text = idea.useCase || idea.description || idea.title || "";
    const truncate = text.length > maxLength;
    const display = truncate && !isExpanded 
      ? text.substring(0, maxLength) + "..." 
      : text;
    
    return {
      useCase: text,
      shouldTruncate: truncate,
      displayText: display
    };
  }, [idea.useCase, idea.description, idea.title, isExpanded]);

  const handleShareIdea = useCallback(async () => {
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
  }, [idea.id, toast]);

  return (
    <Card className={`border hover:shadow-lg transition-all ${
      isRecentlySubmitted 
        ? 'border-green-400 bg-green-50 shadow-lg ring-2 ring-green-200 animate-pulse' 
        : isHighlighted 
        ? 'border-blue-400 bg-blue-50 shadow-lg ring-2 ring-blue-200' 
        : 'border-slate-200'
    }`}>
      <CardContent className="p-6">
        {isRecentlySubmitted && (
          <div className="mb-4 bg-green-100 border border-green-300 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-800 text-sm font-medium">Your idea was just submitted! 🎉</span>
            </div>
          </div>
        )}
        {isHighlighted && isSharedLink && (
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
              className={`p-1 rounded-lg transition-colors ${
                idea.votes >= 100 
                  ? "hover:bg-slate-100" 
                  : "opacity-30 cursor-not-allowed"
              }`}
              onClick={() => idea.votes >= 100 && onVote(idea.id, 'down')}
              disabled={isVoting || idea.votes < 100}
              aria-label={
                idea.votes >= 100 
                  ? `Downvote idea: ${idea.useCase?.substring(0, 50) || idea.title || 'this idea'}...`
                  : `Downvoting disabled until 100 upvotes (currently ${idea.votes})`
              }
              title={idea.votes < 100 ? `Downvoting enabled at 100 upvotes (currently ${idea.votes})` : undefined}
            >
              <ChevronDown className={`h-5 w-5 ${
                idea.votes >= 100 
                  ? "text-slate-600 hover:text-red-600" 
                  : "text-slate-300"
              }`} />
            </Button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-3">
              {/* Post type indicator */}
              <Badge 
                className={`text-xs rounded-full flex items-center gap-1 ${
                  idea.postType === 'media' ? 'bg-purple-100 text-purple-800' :
                  idea.postType === 'link' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}
                variant="secondary"
              >
                {idea.postType === 'media' ? (
                  <>
                    {idea.mediaType === 'video' ? <Play className="w-3 h-3" /> : <Image className="w-3 h-3" />}
                    {idea.mediaType === 'video' ? 'Video' : 'Image'}
                  </>
                ) : idea.postType === 'link' ? (
                  <>
                    <Link2 className="w-3 h-3" />
                    Link
                  </>
                ) : (
                  <>
                    <FileText className="w-3 h-3" />
                    Text
                  </>
                )}
              </Badge>
              
              {idea.category && (
                <Badge 
                  className={`text-xs rounded-full ${categoryColors[idea.category] || categoryColors.other}`}
                  variant="secondary"
                >
                  {formatCategoryName(idea.category)}
                </Badge>
              )}
            </div>
            
            <div className="mb-2">
              <p className="text-slate-800 leading-relaxed whitespace-pre-wrap break-words overflow-hidden">{displayText}</p>
              {shouldTruncate && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-blue-700 hover:text-blue-900 text-sm font-medium mt-0.5"
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} idea description: ${idea.useCase?.substring(0, 50) || idea.title || 'this idea'}...`}
                >
                  {isExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>

            {/* Media display for media posts */}
            {idea.postType === 'media' && idea.mediaUrl && (
              <div className="mb-2 rounded-lg overflow-hidden border border-gray-200">
                {idea.mediaType === 'video' ? (
                  <video 
                    src={idea.mediaUrl} 
                    className="w-full max-h-96 object-cover" 
                    controls 
                    preload="metadata"
                  />
                ) : (
                  <img 
                    src={idea.mediaUrl} 
                    alt="User uploaded content" 
                    className="w-full max-h-96 object-cover"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    width="600"
                    height="400"
                  />
                )}
              </div>
            )}

            {/* Link preview for link posts */}
            {idea.postType === 'link' && idea.linkUrl && (
              <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700">
                  <Link2 className="w-4 h-4" />
                  <a 
                    href={idea.linkUrl.startsWith('http') ? idea.linkUrl : `https://${idea.linkUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm truncate"
                  >
                    {idea.linkUrl}
                  </a>
                </div>
              </div>
            )}

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
                <div className="mb-1">
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
                <div className="mb-1">
                  <div className="flex items-center space-x-2 text-slate-500 text-sm">
                    <ExternalLink className="h-4 w-4" />
                    <span>{idea.linkUrl}</span>
                  </div>
                </div>
              );
            })()}
            <div className="flex items-center justify-between text-sm text-slate-500 mt-1">
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

              </div>
            </div>
            
            {/* Comment Section */}
            <div className="mt-1 pt-1 border-t border-gray-100">
              <Suspense fallback={
                <div className="p-4 bg-gray-50 rounded-lg animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              }>
                <CommentSection ideaId={idea.id} />
              </Suspense>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
