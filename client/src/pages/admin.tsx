import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function Admin() {
  const { toast } = useToast();

  // Get all ideas for admin view
  const { data: ideas, isLoading } = useQuery({
    queryKey: ['/api/admin/ideas'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ideas?sort=recent');
      if (!res.ok) {
        throw new Error('Failed to get ideas');
      }
      return res.json();
    },
  });

  // Delete idea mutation
  const deleteMutation = useMutation({
    mutationFn: async (ideaId: number) => {
      const res = await fetch(`/api/admin/ideas/${ideaId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete idea');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Idea deleted",
        description: "The idea has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ideas'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete idea",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (idea: any) => {
    if (window.confirm(`Are you sure you want to delete this idea: "${idea.useCase || idea.title}"?`)) {
      deleteMutation.mutate(idea.id);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen font-inter">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="text-amber-600 h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
              <p className="text-sm text-slate-600">Manage submitted ideas</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">All Ideas</h2>
          <p className="text-slate-600">Click the delete button to remove inappropriate or spam ideas.</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  </div>
                  <div className="w-20 h-10 bg-slate-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : ideas && ideas.length > 0 ? (
          <div className="space-y-4">
            {ideas.map((idea: any) => (
              <div key={idea.id} className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {idea.useCase || idea.title}
                      </h3>
                      {idea.category && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">
                          {idea.category}
                        </span>
                      )}

                    </div>
                    
                    {idea.description && (
                      <p className="text-slate-600 mb-3">{idea.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>Votes: {idea.votes}</span>
                      {idea.tools && <span>Tools: {idea.tools}</span>}
                      <span>ID: {idea.id}</span>
                      <span>Submitted: {new Date(idea.submittedAt).toLocaleDateString()}</span>
                    </div>
                    
                    {idea.linkUrl && idea.votes >= 10 && (
                      <div className="mt-3">
                        <a 
                          href={idea.linkUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {idea.linkUrl}
                        </a>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(idea)}
                    disabled={deleteMutation.isPending}
                    className="ml-4"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-500">No ideas found.</p>
          </div>
        )}
      </main>
    </div>
  );
}