import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, ThumbsUp, User, Calendar, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserIdea {
  id: number;
  useCase: string;
  description: string;
  category: string;
  upvotes: number;
  commentCount: number;
  createdAt: string;
  status: string;
}

interface UserComment {
  id: number;
  content: string;
  votes: number;
  createdAt: string;
  ideaId: number;
  ideaTitle: string;
}

export default function UserDashboard() {
  const { user, isLoading: authLoading } = useAuth();

  const { data: userIdeas = [], isLoading: ideasLoading } = useQuery({
    queryKey: ["/api/user/ideas"],
    enabled: !!user,
  });

  const { data: userComments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["/api/user/comments"],
    enabled: !!user,
  });

  const { data: userStats } = useQuery({
    queryKey: ["/api/user/stats"],
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Access Required</CardTitle>
            <CardDescription>Please log in to view your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/auth'} className="w-full">
              Login / Sign Up
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Welcome back, {user.username}!
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Here's your activity summary and recent contributions
              </p>
            </div>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Back to Ideas
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="flex items-center p-6">
              <User className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ideas Submitted</p>
                <p className="text-2xl font-bold">{userStats?.totalIdeas || userIdeas.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <ThumbsUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Upvotes</p>
                <p className="text-2xl font-bold">{userStats?.totalUpvotes || 0}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <MessageCircle className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Comments Made</p>
                <p className="text-2xl font-bold">{userStats?.totalComments || userComments.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <TrendingUp className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg. Score</p>
                <p className="text-2xl font-bold">{userStats?.averageScore || "N/A"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="ideas" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ideas">My Ideas ({userIdeas.length})</TabsTrigger>
            <TabsTrigger value="comments">My Comments ({userComments.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="ideas" className="space-y-4">
            {ideasLoading ? (
              <div className="text-center py-8">Loading your ideas...</div>
            ) : userIdeas.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No ideas yet</h3>
                  <p className="text-gray-500 mb-4">Share your first AI use case with the community!</p>
                  <Button onClick={() => window.location.href = '/'}>
                    Submit an Idea
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {userIdeas.map((idea: UserIdea) => (
                  <Card key={idea.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{idea.useCase}</CardTitle>
                          <CardDescription className="mt-2">{idea.description}</CardDescription>
                          <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {idea.category}
                            </span>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {formatDistanceToNow(new Date(idea.createdAt))} ago
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 ml-4">
                          <div className="flex items-center text-green-600">
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            <span className="font-medium">{idea.upvotes}</span>
                          </div>
                          <div className="flex items-center text-blue-600">
                            <MessageCircle className="h-4 w-4 mr-1" />
                            <span className="font-medium">{idea.commentCount}</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="comments" className="space-y-4">
            {commentsLoading ? (
              <div className="text-center py-8">Loading your comments...</div>
            ) : userComments.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No comments yet</h3>
                  <p className="text-gray-500 mb-4">Join the conversation and share your thoughts!</p>
                  <Button onClick={() => window.location.href = '/'}>
                    Browse Ideas
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {userComments.map((comment: UserComment) => (
                  <Card key={comment.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-gray-900 mb-2">{comment.content}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>On: <span className="font-medium">{comment.ideaTitle}</span></span>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {formatDistanceToNow(new Date(comment.createdAt))} ago
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center text-green-600 ml-4">
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          <span className="font-medium">{comment.votes}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}