import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, AlertTriangle, Lock, Download, Mail, Edit, Save, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";

export default function Admin() {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editingVotes, setEditingVotes] = useState<number | null>(null);
  const [editVoteValue, setEditVoteValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'votes' | 'recent'>('votes');
  const itemsPerPage = 50;

  // Get all ideas for admin view
  const { data: ideas, isLoading } = useQuery({
    queryKey: ['/api/admin/ideas', sortBy],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ideas?sort=${sortBy}`);
      if (!res.ok) {
        throw new Error('Failed to get ideas');
      }
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Get all subscribers
  const { data: subscribers } = useQuery({
    queryKey: ['/api/admin/subscribers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/subscribers');
      if (!res.ok) {
        throw new Error('Failed to get subscribers');
      }
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Get upvote trends over time
  const { data: upvoteTrends, isLoading: trendsLoading, error: trendsError } = useQuery({
    queryKey: ['/api/admin/upvote-trends'],
    queryFn: async () => {
      const res = await fetch('/api/admin/upvote-trends');
      if (!res.ok) {
        throw new Error('Failed to get upvote trends');
      }
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Update idea mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, useCase, linkUrl }: { id: number; useCase: string; linkUrl?: string }) => {
      const res = await fetch(`/api/admin/ideas/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ useCase, linkUrl: editUrl }),
      });
      if (!res.ok) {
        throw new Error('Failed to update idea');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Idea updated",
        description: "The idea has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ideas'] });
      setEditingId(null);
      setEditText("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update idea",
        variant: "destructive",
      });
    },
  });

  // Delete idea mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/ideas/${id}`, {
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

  // Mutation to update vote count
  const updateVotesMutation = useMutation({
    mutationFn: async ({ id, votes }: { id: number; votes: number }) => {
      const res = await fetch(`/api/admin/ideas/${id}/votes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ votes }),
      });
      if (!res.ok) {
        throw new Error('Failed to update vote count');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Vote count updated",
        description: "The vote count has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ideas'] });
      setEditingVotes(null);
      setEditVoteValue("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vote count",
        variant: "destructive",
      });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "xxx") {
      setIsAuthenticated(true);
    } else {
      toast({
        title: "Access Denied",
        description: "Invalid password",
        variant: "destructive",
      });
      setPassword("");
    }
  };

  const handleEdit = (idea: any) => {
    setEditingId(idea.id);
    setEditText(idea.useCase || "");
    setEditUrl(idea.linkUrl || "");
  };

  const handleSave = () => {
    if (editingId && editText.trim()) {
      updateMutation.mutate({ id: editingId, useCase: editText, linkUrl: editUrl });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditText("");
    setEditUrl("");
  };

  const handleEditVotes = (idea: any) => {
    setEditingVotes(idea.id);
    setEditVoteValue(idea.votes.toString());
  };

  const handleSaveVotes = () => {
    if (editingVotes && editVoteValue.trim()) {
      const votes = parseInt(editVoteValue);
      if (!isNaN(votes) && votes >= 0) {
        updateVotesMutation.mutate({ id: editingVotes, votes });
      }
    }
  };

  const handleCancelVotes = () => {
    setEditingVotes(null);
    setEditVoteValue("");
  };

  // Delete duplicates mutation
  const deleteDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/delete-duplicates', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to delete duplicates');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Duplicates deleted",
        description: `Removed ${data.deletedIds?.length || 0} duplicate entries`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ideas'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete duplicates",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (idea: any) => {
    if (window.confirm(`Are you sure you want to delete this idea: "${idea.useCase || idea.title}"?`)) {
      deleteMutation.mutate(idea.id);
    }
  };

  const handleExportEmails = async () => {
    try {
      const response = await fetch('/api/admin/export');
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'ai-ideas-export.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: "CSV file has been downloaded with email-to-idea linking.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Show password form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="text-center mb-6">
            <Lock className="mx-auto h-12 w-12 text-slate-400 mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
            <p className="text-slate-600">Authorized access required</p>
          </div>
          <form onSubmit={handlePasswordSubmit} autoComplete="off">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access code"
              className="mb-4"
              autoFocus
              autoComplete="new-password"
              name="admin-access-code"
            />
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
              <p className="text-slate-600">Manage AI use case ideas and subscribers</p>
            </div>
            <div className="flex space-x-4">
              <Button onClick={handleExportEmails} className="bg-green-600 hover:bg-green-700 text-sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Total Ideas</h3>
              <p className="text-3xl font-bold text-blue-600">{ideas?.length || 0}</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-green-900 mb-2">Total Subscribers</h3>
              <p className="text-3xl font-bold text-green-600">{subscribers?.length || 0}</p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-900 mb-2">Conversion Rate</h3>
              <p className="text-3xl font-bold text-purple-600">
                {ideas?.length && subscribers?.length 
                  ? Math.round((subscribers.length / ideas.length) * 100) 
                  : 0}%
              </p>
            </div>
          </div>

          {/* Community Engagement Summary */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Community Engagement</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">
                  {ideas?.reduce((sum: number, idea: any) => sum + idea.votes, 0) || 0}
                </div>
                <div className="text-sm text-green-700">Total Upvotes Received</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {ideas?.length && ideas.reduce((sum: number, idea: any) => sum + idea.votes, 0) > 0 ? (
                    (ideas.reduce((sum: number, idea: any) => sum + (idea.upvotesGiven || 0), 0) / 
                     ideas.reduce((sum: number, idea: any) => sum + idea.votes, 0) * 100
                    ).toFixed(1)
                  ) : '0.0'}%
                </div>
                <div className="text-sm text-purple-700">Community Ratio</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {ideas?.filter((idea: any) => (idea.upvotesGiven || 0) > 0).length || 0}
                </div>
                <div className="text-sm text-orange-700">Active Voters</div>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-teal-600">
                  {(() => {
                    if (!ideas?.length) return '0.0';
                    
                    // Calculate total upvotes given by all users
                    const totalUpvotesGiven = ideas.reduce((sum: number, idea: any) => sum + (idea.upvotesGiven || 0), 0);
                    // Total number of users (all idea submitters)
                    const totalUsers = ideas.length;
                    

                    
                    return totalUsers > 0 ? (totalUpvotesGiven / totalUsers).toFixed(1) : '0.0';
                  })()}
                </div>
                <div className="text-sm text-teal-700">Average Upvotes per User</div>
              </div>
            </div>
          </div>

          {/* Upvote Trends Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Average Upvotes per User Over Time</h2>
            <div className="h-80">
              {trendsLoading ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Loading trend data...
                </div>
              ) : trendsError ? (
                <div className="flex items-center justify-center h-full text-red-500">
                  Error loading trends: {trendsError.message}
                </div>
              ) : upvoteTrends && upvoteTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={upvoteTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis 
                      domain={[0, 'dataMax']}
                      tickFormatter={(value) => value.toFixed(1)}
                    />
                    <Tooltip 
                      labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                      formatter={(value: number) => [value.toFixed(1), 'Average Upvotes per User']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="averageUpvotes" 
                      stroke="#0891b2" 
                      strokeWidth={2}
                      dot={{ fill: '#0891b2', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No trend data available yet
                </div>
              )}
            </div>
            <div className="mt-4 text-sm text-gray-600">
              Shows how community engagement has evolved since site launch. Only counts upvotes given to other users' ideas.
            </div>
          </div>

          {/* Ideas List */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-4 sm:mb-0">AI Use Case Ideas</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-slate-700">Sort by:</label>
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as 'votes' | 'recent')}
                    className="px-3 py-1 border border-slate-300 rounded text-sm"
                  >
                    <option value="votes">Most Upvotes</option>
                    <option value="recent">Most Recent</option>
                  </select>
                </div>
                <Button 
                  onClick={() => deleteDuplicatesMutation.mutate()}
                  disabled={deleteDuplicatesMutation.isPending}
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  {deleteDuplicatesMutation.isPending ? "Deleting..." : "Delete Duplicates"}
                </Button>
              </div>
            </div>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-slate-600 mt-4">Loading ideas...</p>
              </div>
            ) : ideas && ideas.length > 0 ? (
              <>
                {/* Pagination Info */}
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, ideas.length)} of {ideas.length} ideas
                  </div>
                  <div className="text-sm text-gray-600">
                    Sorted by upvotes (highest first)
                  </div>
                </div>

                <div className="space-y-4">
                  {ideas
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((idea: any) => (
                      <div key={idea.id} className="border border-slate-200 rounded-lg p-4 sm:p-6 hover:shadow-md transition-shadow">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-4 sm:space-y-0">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2 text-xs sm:text-sm">
                              <span className="text-sm font-medium text-slate-500">ID: {idea.id}</span>
                              <span className="text-sm text-slate-500">•</span>
                              {editingVotes === idea.id ? (
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm text-slate-500">Votes:</span>
                                  <Input
                                    type="number"
                                    value={editVoteValue}
                                    onChange={(e) => setEditVoteValue(e.target.value)}
                                    className="w-20 h-6 text-xs"
                                    min="0"
                                  />
                                  <Button
                                    onClick={handleSaveVotes}
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    disabled={updateVotesMutation.isPending}
                                  >
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    onClick={handleCancelVotes}
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleEditVotes(idea)}
                                  className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                                >
                                  Votes: {idea.votes}
                                </button>
                              )}
                              <span className="text-sm text-slate-500 hidden sm:inline">•</span>
                              <span className="text-xs sm:text-sm text-slate-500">
                                Given: {idea.upvotesGiven || 0}
                              </span>
                              <span className="text-sm text-slate-500 hidden sm:inline">•</span>
                              <span className="text-xs sm:text-sm text-slate-500">
                                Ratio: {idea.votes > 0 ? ((idea.upvotesGiven || 0) / idea.votes).toFixed(1) : '0.0'}:1
                              </span>
                              <span className="text-sm text-slate-500 hidden sm:inline">•</span>
                              <span className="text-xs sm:text-sm text-slate-500">
                                {new Date(idea.submittedAt).toLocaleDateString()}
                              </span>
                              {idea.category && (
                                <>
                                  <span className="text-sm text-slate-500">•</span>
                                  <span className="text-sm text-slate-500 capitalize">{idea.category}</span>
                                </>
                              )}
                            </div>
                        {editingId === idea.id ? (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Idea Text</label>
                              <Textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full min-h-[100px]"
                                placeholder="Edit idea text..."
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">URL (Optional)</label>
                              <Input
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                                className="w-full"
                                placeholder="https://example.com or leave empty to remove"
                              />
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                onClick={handleSave} 
                                size="sm"
                                disabled={updateMutation.isPending}
                              >
                                <Save className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                              <Button onClick={handleCancel} variant="outline" size="sm">
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-700 whitespace-pre-wrap break-words overflow-wrap-anywhere">{idea.useCase || idea.description || idea.title || "No content"}</p>
                        )}
                        {idea.linkUrl && (
                          <div className="mt-2">
                            <a 
                              href={idea.linkUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm break-all"
                            >
                              {idea.linkUrl}
                            </a>
                          </div>
                        )}
                      </div>
                      {editingId !== idea.id && (
                        <div className="flex space-x-2 ml-4">
                          <Button
                            onClick={() => handleEdit(idea)}
                            variant="outline"
                            size="sm"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(idea)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                </div>

                {/* Pagination Controls */}
                {ideas.length > itemsPerPage && (
                  <div className="flex justify-center items-center space-x-4 mt-8">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {Math.ceil(ideas.length / itemsPerPage)}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(ideas.length / itemsPerPage), prev + 1))}
                      disabled={currentPage === Math.ceil(ideas.length / itemsPerPage)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No ideas found</h3>
                <p className="text-slate-600">No AI use case ideas have been submitted yet.</p>
              </div>
            )}
          </div>

          {/* Subscribers List */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Email Subscribers</h2>
            {subscribers && subscribers.length > 0 ? (
              <div className="bg-slate-50 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subscribers.map((subscriber: any, index: number) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-slate-200">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">{subscriber.email}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(subscriber.subscribedAt).toLocaleDateString()} • {subscriber.source || 'homepage'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Mail className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No subscribers</h3>
                <p className="text-slate-600">No email subscribers have signed up yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}