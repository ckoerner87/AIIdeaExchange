import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, MessageCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminComment {
  id: number;
  content: string;
  createdAt: string;
  votes: number;
  user: {
    username: string | null;
    email: string | null;
  } | null;
  idea: {
    useCase: string | null;
  };
}

export default function AdminComments() {
  const [selectedComments, setSelectedComments] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery<AdminComment[]>({
    queryKey: ["/api/admin/comments"],
    queryFn: async () => {
      const response = await fetch("/api/admin/comments");
      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }
      return response.json();
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const response = await fetch(`/api/admin/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to delete comment");
      }
      return response.json();
    },
    onMutate: async (commentId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/admin/comments"] });
      
      // Snapshot the previous value
      const previousComments = queryClient.getQueryData(["/api/admin/comments"]);
      
      // Optimistically update to remove the comment
      queryClient.setQueryData(["/api/admin/comments"], (old: AdminComment[] | undefined) => {
        return old?.filter(comment => comment.id !== commentId) || [];
      });
      
      return { previousComments };
    },
    onError: (err, commentId, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(["/api/admin/comments"], context?.previousComments);
      // Refetch admin comments on error to get correct state
      queryClient.invalidateQueries({ queryKey: ["/api/admin/comments"] });
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });
      // Only invalidate main site comment queries - admin page uses optimistic updates
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/ideas" && query.queryKey[2] === "comments"
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (commentIds: number[]) => {
      const response = await fetch("/api/admin/comments/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentIds }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to bulk delete comments");
      }
      return response.json();
    },
    onMutate: async (commentIds) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/admin/comments"] });
      
      // Snapshot the previous value
      const previousComments = queryClient.getQueryData(["/api/admin/comments"]);
      
      // Optimistically update to remove the comments
      queryClient.setQueryData(["/api/admin/comments"], (old: AdminComment[] | undefined) => {
        return old?.filter(comment => !commentIds.includes(comment.id)) || [];
      });
      
      return { previousComments };
    },
    onError: (err, commentIds, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(["/api/admin/comments"], context?.previousComments);
      toast({
        title: "Error",
        description: "Failed to bulk delete comments",
        variant: "destructive",
      });
    },
    onSuccess: (_, commentIds) => {
      setSelectedComments(new Set());
      toast({
        title: "Success",
        description: `Deleted ${commentIds.length} comments successfully`,
      });
      // Only invalidate main site comment queries - admin page uses optimistic updates
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/ideas" && query.queryKey[2] === "comments"
      });
    },
    onError: (err, commentIds, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(["/api/admin/comments"], context?.previousComments);
      // Refetch admin comments on error to get correct state
      queryClient.invalidateQueries({ queryKey: ["/api/admin/comments"] });
      toast({
        title: "Error",
        description: "Failed to bulk delete comments",
        variant: "destructive",
      });
    },
  });

  const handleSelectComment = (commentId: number) => {
    const newSelected = new Set(selectedComments);
    if (newSelected.has(commentId)) {
      newSelected.delete(commentId);
    } else {
      newSelected.add(commentId);
    }
    setSelectedComments(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedComments.size === comments.length) {
      setSelectedComments(new Set());
    } else {
      setSelectedComments(new Set(comments.map(c => c.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedComments.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedComments.size} comments?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedComments));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Comment Management</h1>
        <p className="text-gray-600">Manage and moderate user comments</p>
      </div>

      {comments.length > 0 && (
        <div className="mb-4 flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="select-all"
              checked={selectedComments.size === comments.length}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm font-medium">
              Select All ({comments.length})
            </label>
          </div>
          
          {selectedComments.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedComments.size})
            </Button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {comments.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <div className="text-center text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No comments found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          comments.map((comment) => (
            <Card key={comment.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedComments.has(comment.id)}
                    onCheckedChange={() => handleSelectComment(comment.id)}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">
                          {comment.user?.username || comment.user?.email || "Anonymous"}
                        </span>
                        <span>•</span>
                        <span>{formatDate(comment.createdAt)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <span>{comment.votes}</span>
                          <span>votes</span>
                        </span>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const preview = comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : '');
                          if (confirm(`Are you sure you want to delete this comment?\n\n${preview}`)) {
                            deleteCommentMutation.mutate(comment.id);
                          }
                        }}
                        disabled={deleteCommentMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <p className="text-gray-900 mb-3 leading-relaxed">
                      {comment.content}
                    </p>
                    
                    {comment.idea.useCase && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <ExternalLink className="w-4 h-4" />
                          <span>Commented on idea:</span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {comment.idea.useCase.substring(0, 150)}
                          {comment.idea.useCase.length > 150 && "..."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}