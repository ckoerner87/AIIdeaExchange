import { ChevronUp, ChevronDown, Flag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Idea } from "@shared/schema";

interface IdeaCardProps {
  idea: Idea;
  onVote: (ideaId: number, voteType: 'up' | 'down') => void;
  isVoting: boolean;
}

const categoryColors: Record<string, string> = {
  productivity: "bg-blue-100 text-blue-800",
  creative: "bg-green-100 text-green-800",
  business: "bg-purple-100 text-purple-800",
  education: "bg-orange-100 text-orange-800",
  personal: "bg-pink-100 text-pink-800",
  other: "bg-gray-100 text-gray-800",
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

export default function IdeaCard({ idea, onVote, isVoting }: IdeaCardProps) {
  return (
    <Card className="border border-slate-200 hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <div className="flex flex-col items-center space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center p-2 rounded-lg hover:bg-slate-100 transition-colors"
              onClick={() => onVote(idea.id, 'up')}
              disabled={isVoting}
            >
              <ChevronUp className="text-slate-400 hover:text-secondary h-4 w-4" />
              <span className="text-sm font-semibold text-slate-700">{idea.votes}</span>
              <ChevronDown className="text-slate-400 hover:text-red-400 h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-3">
              <h3 className="text-lg font-semibold text-slate-900">{idea.title}</h3>
              {idea.category && (
                <Badge 
                  className={`text-xs rounded-full ${categoryColors[idea.category] || categoryColors.other}`}
                  variant="secondary"
                >
                  {idea.category.charAt(0).toUpperCase() + idea.category.slice(1)}
                </Badge>
              )}
            </div>
            <p className="text-slate-600 mb-4">{idea.description}</p>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <div className="flex items-center space-x-4">
                {idea.tools && <span>Tools: {idea.tools}</span>}
                <span>{formatTimeAgo(idea.submittedAt)}</span>
              </div>
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
      </CardContent>
    </Card>
  );
}
