import { useState, memo, lazy, Suspense, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Trash2, User, ChevronUp, ChevronDown } from "lucide-react";
import type { Comment, User as UserType } from "@shared/schema";

// Lazy load heavy components for better performance
const Avatar = lazy(() => import("@/components/ui/avatar").then(module => ({ default: module.Avatar })));
const AvatarImage = lazy(() => import("@/components/ui/avatar").then(module => ({ default: module.AvatarImage })));
const AvatarFallback = lazy(() => import("@/components/ui/avatar").then(module => ({ default: module.AvatarFallback })));
const AccountCreationPopup = lazy(() => import("./account-creation-popup"));
const UsernameCollectionPopup = lazy(() => import("./username-collection-popup").then(module => ({ default: module.UsernameCollectionPopup })));

interface CommentSectionProps {
  ideaId: number;
  className?: string;
  commentCount?: number;
}

interface CommentWithUser extends Comment {
  user: UserType | null;
  votes: number;
  parentId: number | null;
  replies?: CommentWithUser[];
  replyCount?: number;
}

// Memoized comment item for better performance
const CommentItem = memo(({ comment, onDelete, currentUserId, onVote, sessionId, onReply, onToggleReplies, replyingTo, replyContent, setReplyContent, onSubmitReply, onCancelReply, expandedReplies }: {
  comment: CommentWithUser;
  onDelete: (id: number) => void;
  onVote: (commentId: number, voteType: 'up' | 'down') => void;
  onReply: (parentId: number) => void;
  onToggleReplies: (commentId: number) => void;
  currentUserId?: string;
  sessionId?: string;
  replyingTo: number | null;
  replyContent: string;
  setReplyContent: (content: string) => void;
  onSubmitReply: (parentId: number, content: string) => void;
  onCancelReply: () => void;
  expandedReplies: Set<number>;
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

  const getDisplayName = (comment: any) => {
    // For anonymous comments, use the anonymousUsername if available
    if (!comment.user && comment.anonymousUsername) {
      return comment.anonymousUsername;
    }
    
    // For authenticated users
    if (comment.user) {
      const user = comment.user;
      if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
      }
      if (user.firstName) {
        return user.firstName;
      }
      if (user.username) {
        return user.username;
      }
      return user.email?.split('@')[0] || "Anonymous";
    }
    
    // Default for anonymous without username
    return "Anonymous";
  };

  return (
    <div className="flex gap-3 p-4 border-b border-gray-100 last:border-0">
      {/* Voting buttons on the left */}
      <div className="flex flex-col items-center flex-shrink-0 -mt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onVote(comment.id, 'up')}
          className="h-4 w-4 p-0 hover:bg-green-50 hover:text-green-600"
          aria-label="Upvote comment"
        >
          <ChevronUp className="w-3 h-3" />
        </Button>
        <span className="text-xs font-medium text-gray-600 min-w-[14px] text-center leading-[1] py-0.5">
          {comment.votes || 0}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onVote(comment.id, 'down')}
          className="h-4 w-4 p-0 hover:bg-red-50 hover:text-red-600"
          aria-label="Downvote comment"
        >
          <ChevronDown className="w-3 h-3" />
        </Button>
      </div>

      <Suspense fallback={<div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />}>
        <Avatar className="w-8 h-8 flex-shrink-0">
          {comment.user?.profileImageUrl && (
            <AvatarImage 
              src={comment.user.profileImageUrl} 
              alt={`${getDisplayName(comment)}'s avatar`}
              loading="lazy"
              decoding="async"
            />
          )}
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
            {comment.anonymousUsername ? comment.anonymousUsername.charAt(0).toUpperCase() : getInitials(comment.user)}
          </AvatarFallback>
        </Avatar>
      </Suspense>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-gray-900 truncate">
            {getDisplayName(comment)}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0">
            {formatTimeAgo(new Date(comment.createdAt))}
          </span>
        </div>
        
        <p className="text-sm text-gray-700 leading-relaxed break-words">
          {comment.content}
        </p>
        
        <div className="flex items-center gap-3 mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => comment.replyCount && comment.replyCount > 0 ? onToggleReplies(comment.id) : onReply(comment.id)}
            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            aria-label={comment.replyCount && comment.replyCount > 0 ? "View replies" : "Reply to comment"}
          >
            <MessageCircle className="w-3 h-3 mr-1" />
            {comment.replyCount && comment.replyCount > 0 
              ? `${comment.replyCount} ${comment.replyCount === 1 ? 'Reply' : 'Replies'}`
              : 'Reply'
            }
          </Button>
          
          {currentUserId === comment.userId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(comment.id)}
              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              aria-label="Delete comment"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          )}
        </div>
        
        {/* Reply form */}
        {replyingTo === comment.id && (
          <div className="mt-3 pl-11 border-l-2 border-blue-200">
            <form onSubmit={(e) => {
              e.preventDefault();
              if (replyContent.trim()) {
                onSubmitReply(comment.id, replyContent.trim());
              }
            }}>
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`Reply to ${comment.user?.username || "Chris's New Friend"}...`}
                className="min-h-[80px] resize-none border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancelReply}
                  className="h-8 px-3 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!replyContent.trim()}
                  className="h-8 px-3 text-xs bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  Reply
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Nested Replies */}
        {expandedReplies.has(comment.id) && comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 pl-11 border-l-2 border-gray-200 space-y-4">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                onDelete={() => {}}
                onVote={() => {}}
                onReply={onReply}
                onToggleReplies={onToggleReplies}
                currentUserId={currentUserId}
                sessionId={sessionId}
                replyingTo={replyingTo}
                replyContent={replyContent}
                setReplyContent={setReplyContent}
                onSubmitReply={onSubmitReply}
                onCancelReply={onCancelReply}
                expandedReplies={expandedReplies}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

CommentItem.displayName = 'CommentItem';

export default function CommentSection({ ideaId, className = "", commentCount: propCommentCount }: CommentSectionProps) {
  const [newComment, setNewComment] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSignupPopup, setShowSignupPopup] = useState(false);
  const [showUsernamePopup, setShowUsernamePopup] = useState(false);
  const [pendingComment, setPendingComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get session ID from storage
  const sessionId = localStorage.getItem('ai-ideas-session');

  // No pending comment logic needed for anonymous comments

  // Use comment count from props or fetch if not provided
  const { data: fetchedCommentCount = 0 } = useQuery<number>({
    queryKey: ["/api/ideas", ideaId, "comments", "count"],
    queryFn: async () => {
      const response = await fetch(`/api/ideas/${ideaId}/comments/count`);
      if (!response.ok) {
        throw new Error(`Failed to fetch comment count: ${response.status}`);
      }
      const data = await response.json();
      return typeof data === 'string' ? parseInt(data, 10) : data;
    },
    staleTime: 1000,
    enabled: propCommentCount === undefined, // Only fetch if not provided via props
  });

  const commentCount = propCommentCount ?? fetchedCommentCount;

  // Fetch full comments with performance optimizations
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
      
      // Store the comment content for username collection
      setPendingComment(newComment);
      
      // Clear the form
      setNewComment("");
      
      // Immediately update local cache with optimistic update
      queryClient.setQueryData(["/api/ideas", ideaId, "comments"], (oldComments: any) => {
        if (!oldComments) return [newComment];
        return [...oldComments, newComment];
      });
      
      // Update comment count immediately
      queryClient.setQueryData(["/api/ideas", ideaId, "comments", "count"], (oldCount: number) => (oldCount || 0) + 1);
      
      // Invalidate all comment count queries for this idea
      queryClient.invalidateQueries({ 
        queryKey: ["/api/ideas", ideaId, "comments", "count"]
      });
      
      // Also invalidate the main ideas list to update comment count there
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      
      // Force immediate refetch for accuracy
      await refetch();
      
      // Show username collection popup for anonymous users
      if (!isAuthenticated) {
        setShowUsernamePopup(true);
      } else {
        toast({
          title: "Success",
          description: "Comment posted successfully",
        });
      }
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
    onSuccess: (_, deletedCommentId) => {
      // Immediately update local cache by removing the deleted comment
      queryClient.setQueryData(["/api/ideas", ideaId, "comments"], (oldComments: any) => {
        if (!oldComments) return [];
        return oldComments.filter((comment: any) => comment.id !== deletedCommentId);
      });
      
      // Update comment count immediately
      queryClient.setQueryData(["/api/ideas", ideaId, "comments", "count"], (oldCount: number) => Math.max(0, (oldCount || 0) - 1));
      
      // Also invalidate the main ideas list to update comment count there
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      
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

  // Vote on comment mutation
  const voteCommentMutation = useMutation({
    mutationFn: async ({ commentId, voteType, sessionId: currentSessionId }: { commentId: number; voteType: 'up' | 'down'; sessionId: string }) => {
      const response = await fetch(`/api/comments/${commentId}/vote`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-session-id": currentSessionId
        },
        body: JSON.stringify({ voteType }),
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onMutate: async ({ commentId, voteType }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/ideas", ideaId, "comments"] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(["/api/ideas", ideaId, "comments"]);
      
      // Optimistically update the vote count
      queryClient.setQueryData(["/api/ideas", ideaId, "comments"], (oldData: any) => {
        if (!oldData) return oldData;
        
        return oldData.map((comment: any) => {
          if (comment.id === commentId) {
            const currentVotes = comment.votes || 0;
            const newVotes = voteType === 'up' ? currentVotes + 1 : Math.max(0, currentVotes - 1);
            return { ...comment, votes: newVotes };
          }
          // Also update in replies
          if (comment.replies) {
            return {
              ...comment,
              replies: comment.replies.map((reply: any) => {
                if (reply.id === commentId) {
                  const currentVotes = reply.votes || 0;
                  const newVotes = voteType === 'up' ? currentVotes + 1 : Math.max(0, currentVotes - 1);
                  return { ...reply, votes: newVotes };
                }
                return reply;
              })
            };
          }
          return comment;
        });
      });
      
      return { previousData };
    },
    onSuccess: (data: any, variables) => {
      const newVoteCount = data.voteCount || data.votes || 0;
      const commentId = variables.commentId;
      
      // Update with actual server response
      queryClient.setQueryData(["/api/ideas", ideaId, "comments"], (oldData: any) => {
        if (!oldData) return oldData;
        
        return oldData.map((comment: any) => {
          if (comment.id === commentId) {
            return { ...comment, votes: newVoteCount };
          }
          // Also update in replies
          if (comment.replies) {
            return {
              ...comment,
              replies: comment.replies.map((reply: any) => 
                reply.id === commentId 
                  ? { ...reply, votes: newVoteCount }
                  : reply
              )
            };
          }
          return comment;
        });
      });
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousData) {
        queryClient.setQueryData(["/api/ideas", ideaId, "comments"], context.previousData);
      }
      
      // Don't show error for duplicate votes - just silently ignore
      if (error.message.includes("already voted")) {
        return;
      }
      
      const errorMessage = error.message.includes("429") 
        ? "Please wait before voting again" 
        : "Failed to record vote";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleVote = (commentId: number, voteType: 'up' | 'down') => {
    // Get session ID dynamically from the correct localStorage key
    const currentSessionId = localStorage.getItem('ai-ideas-session') || sessionId;
    
    if (!currentSessionId) {
      toast({
        title: "Error",
        description: "Session not found. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    voteCommentMutation.mutate({ commentId, voteType, sessionId: currentSessionId });
  };

  const handleReply = (parentId: number) => {
    setReplyingTo(parentId);
    setReplyContent("");
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyContent("");
  };

  const handleSubmitReply = (parentId: number, content: string) => {
    createReplyMutation.mutate({ parentId, content });
    setReplyingTo(null);
    setReplyContent("");
  };

  const createReplyMutation = useMutation({
    mutationFn: async ({ parentId, content }: { parentId: number; content: string }) => {
      const currentSessionId = localStorage.getItem('ai-ideas-session') || sessionId;
      const response = await fetch(`/api/comments/${parentId}/replies`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-session-id": currentSessionId || ""
        },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "comments", "count"] });
      refetch(); // Force immediate refetch to update reply counts
      toast({
        title: "Reply posted!",
        description: "Your reply has been added to the conversation.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to post reply",
        variant: "destructive",
      });
    },
  });

  const toggleReplies = (commentId: number) => {
    const newExpanded = new Set(expandedReplies);
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId);
    } else {
      newExpanded.add(commentId);
    }
    setExpandedReplies(newExpanded);
  };

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
          Comments {commentCount > 0 && `(${commentCount})`}
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
                <div className="flex items-center justify-between">
                  {!isAuthenticated && newComment.trim() && (
                    <div className="flex-1 mr-4">
                      <p className="text-sm text-blue-700">
                        Wanna know when people reply? <button 
                          onClick={() => setShowSignupPopup(true)}
                          className="text-blue-700 underline hover:text-blue-800 font-medium"
                        >
                          Create a free account real fast here
                        </button>.
                      </p>
                    </div>
                  )}
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
                    onVote={handleVote}
                    onReply={handleReply}
                    onToggleReplies={toggleReplies}
                    currentUserId={user?.id}
                    sessionId={sessionId ?? undefined}
                    replyingTo={replyingTo}
                    replyContent={replyContent}
                    setReplyContent={setReplyContent}
                    onSubmitReply={handleSubmitReply}
                    onCancelReply={handleCancelReply}
                    expandedReplies={expandedReplies}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
      
      {/* Account Creation Popup */}
      <Suspense fallback={null}>
        <AccountCreationPopup 
          isOpen={showSignupPopup} 
          onClose={() => setShowSignupPopup(false)} 
        />
      </Suspense>

      {/* Username Collection Popup */}
      <Suspense fallback={null}>
        {showUsernamePopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <UsernameCollectionPopup
                isOpen={showUsernamePopup}
                onClose={() => setShowUsernamePopup(false)}
                onUsernameSubmit={async (username: string) => {
                  // Update the username for the most recent comment
                  if (pendingComment && sessionId) {
                    try {
                      await fetch(`/api/comments/${pendingComment.id}/username`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, sessionId }),
                      });
                      
                      // Close the popup and refresh comments to show updated username
                      setShowUsernamePopup(false);
                      setPendingComment("");
                      
                      // Force refresh to show new username
                      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "comments"] });
                      
                      toast({
                        title: "Username saved!",
                        description: "Your comment is now associated with your username.",
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to update username. Please try again.",
                        variant: "destructive",
                      });
                    }
                  }
                }}
                onAccountCreate={async (data: { username: string; email: string; password: string }) => {
                  try {
                    const response = await fetch('/api/signup', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(data),
                    });
                    
                    if (response.ok) {
                      setShowUsernamePopup(false);
                      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "comments"] });
                      toast({
                        title: "Account created!",
                        description: "You can now receive reply notifications and build your reputation.",
                      });
                    } else {
                      const responseData = await response.json();
                      toast({
                        title: "Error",
                        description: responseData.message || "Failed to create account",
                        variant: "destructive",
                      });
                    }
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to create account",
                      variant: "destructive",
                    });
                  }
                }}
              />
            </div>
          </div>
        )}
      </Suspense>
    </div>
  );
}