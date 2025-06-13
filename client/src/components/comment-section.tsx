import { useState, memo, lazy, Suspense, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Trash2, User } from "lucide-react";
import type { Comment, User as UserType } from "@shared/schema";

// Lazy load heavy components for better performance
const Avatar = lazy(() => import("@/components/ui/avatar").then(module => ({ default: module.Avatar })));
const AvatarImage = lazy(() => import("@/components/ui/avatar").then(module => ({ default: module.AvatarImage })));
const AvatarFallback = lazy(() => import("@/components/ui/avatar").then(module => ({ default: module.AvatarFallback })));

interface CommentSectionProps {
  ideaId: number;
  className?: string;
}

interface CommentWithUser extends Comment {
  user: UserType | null;
}

// Memoized comment item for better performance
const CommentItem = memo(({ comment, onDelete, currentUserId }: {
  comment: CommentWithUser;
  onDelete: (id: number) => void;
  currentUserId?: string;
}) => {
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getInitials = (user: UserType | null) => {
    if (!user) return 'A';
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const getDisplayName = (user: UserType | null) => {
    if (!user) return 'Anonymous';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    return user.email?.split('@')[0] || 'Anonymous';
  };

  return (
    <div className="flex gap-3 p-4 border-b border-gray-100 last:border-0">
      <Suspense fallback={<div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />}>
        <Avatar className="w-8 h-8 flex-shrink-0">
          {comment.user?.profileImageUrl && (
            <AvatarImage 
              src={comment.user.profileImageUrl} 
              alt={`${getDisplayName(comment.user)}'s avatar`}
              loading="lazy"
              decoding="async"
            />
          )}
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
            {getInitials(comment.user)}
          </AvatarFallback>
        </Avatar>
      </Suspense>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-gray-900 truncate">
            {getDisplayName(comment.user)}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0">
            {formatTimeAgo(new Date(comment.createdAt))}
          </span>
        </div>
        
        <p className="text-sm text-gray-700 leading-relaxed break-words">
          {comment.content}
        </p>
        
        {currentUserId === comment.userId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(comment.id)}
            className="mt-2 h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            aria-label="Delete comment"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
});

CommentItem.displayName = 'CommentItem';

export default function CommentSection({ ideaId, className = "" }: CommentSectionProps) {
  const [newComment, setNewComment] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSignupPopup, setShowSignupPopup] = useState(false);
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // No pending comment logic needed for anonymous comments

  // Fetch comments with performance optimizations
  const { data: comments = [], isLoading, refetch } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/ideas", ideaId, "comments"],
    queryFn: async () => {
      const response = await fetch(`/api/ideas/${ideaId}/comments`);
      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`);
      }
      return response.json();
    },
    enabled: isExpanded, // Only fetch when expanded
    staleTime: 1000, // Cache for 1 second to see new comments quickly
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/ideas/${ideaId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: async (newComment) => {
      // Ensure section is expanded first
      setIsExpanded(true);
      
      // Clear the form
      setNewComment("");
      
      // Force immediate refetch
      await refetch();
      
      // Also invalidate cache for future requests
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "comments"] });
      
      toast({
        title: "Success",
        description: "Comment posted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "comments"] });
      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    // Allow anonymous comments, but show notification about reply alerts
    createCommentMutation.mutate(newComment.trim());
  };

  const handleDelete = (commentId: number) => {
    deleteCommentMutation.mutate(commentId);
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`border border-gray-200 rounded-lg bg-white ${className}`}>
      {/* Header */}
      <button
        onClick={handleToggleExpand}
        className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Hide' : 'Show'} comments section`}
      >
        <MessageCircle className="w-5 h-5 text-gray-600" />
        <span className="text-sm font-medium text-gray-900">
          Comments {comments.length > 0 && `(${comments.length})`}
        </span>
        <div className="ml-auto">
          <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Comment Form */}
          {!authLoading && (
            <div className="p-4 border-b border-gray-100">
              <form onSubmit={handleSubmit} className="space-y-3">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="min-h-20 resize-none focus:ring-2 focus:ring-blue-500"
                  maxLength={500}
                  aria-label="Write a comment"
                />
                <div className="flex items-center justify-end">
                  <Button
                    type="submit"
                    disabled={!newComment.trim() || createCommentMutation.isPending}
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 min-h-9"
                    aria-label="Post comment"
                  >
                    {createCommentMutation.isPending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {isAuthenticated ? "Post" : "Post Comment"}
                      </>
                    )}
                  </Button>
                </div>
                {!isAuthenticated && newComment.trim() && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700 mb-2">
                      <strong>Almost there!</strong> To publish your comment, you'll need to create a quick account.
                    </p>
                    <p className="text-xs text-blue-600">
                      Don't worry - your comment will be saved and posted once you sign in.
                    </p>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Comments List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-4 bg-gray-200 rounded w-full" />
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length > 0 ? (
              <div>
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onDelete={handleDelete}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm">No comments yet. Be the first to share your thoughts!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}