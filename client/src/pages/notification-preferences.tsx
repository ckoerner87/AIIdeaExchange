import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Bell, Mail, MessageSquare, TrendingUp, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function NotificationPreferences() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Default notification preferences
  const [preferences, setPreferences] = useState({
    emailDigest: true,
    commentReplies: true,
    ideaUpvotes: false,
    weeklyTrends: true,
    newFeatures: true,
    communityUpdates: false,
  });

  const [saving, setSaving] = useState(false);

  const handlePreferenceChange = (key: string, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Simulate API call - replace with actual endpoint later
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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
            <CardDescription>Please log in to manage your notification preferences</CardDescription>
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
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = '/dashboard'}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Notification Preferences
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                  Choose how you'd like to stay updated about your activity
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Preferences Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Control when we send you email notifications about platform activity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Weekly Digest */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <Label htmlFor="emailDigest" className="font-medium">Weekly Digest</Label>
                </div>
                <p className="text-sm text-gray-500">
                  Get a summary of top ideas and community highlights each week
                </p>
              </div>
              <Switch
                id="emailDigest"
                checked={preferences.emailDigest}
                onCheckedChange={(checked) => handlePreferenceChange('emailDigest', checked)}
              />
            </div>

            <Separator />

            {/* Comment Replies */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4 text-purple-600" />
                  <Label htmlFor="commentReplies" className="font-medium">Comment Replies</Label>
                </div>
                <p className="text-sm text-gray-500">
                  Get notified when someone replies to your comments
                </p>
              </div>
              <Switch
                id="commentReplies"
                checked={preferences.commentReplies}
                onCheckedChange={(checked) => handlePreferenceChange('commentReplies', checked)}
              />
            </div>

            <Separator />

            {/* Idea Upvotes */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <Label htmlFor="ideaUpvotes" className="font-medium">Idea Upvotes</Label>
                </div>
                <p className="text-sm text-gray-500">
                  Get notified when your ideas receive upvotes (daily summary)
                </p>
              </div>
              <Switch
                id="ideaUpvotes"
                checked={preferences.ideaUpvotes}
                onCheckedChange={(checked) => handlePreferenceChange('ideaUpvotes', checked)}
              />
            </div>

            <Separator />

            {/* Weekly Trends */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <Label htmlFor="weeklyTrends" className="font-medium">Weekly Trends</Label>
                </div>
                <p className="text-sm text-gray-500">
                  Discover trending AI use cases and popular categories
                </p>
              </div>
              <Switch
                id="weeklyTrends"
                checked={preferences.weeklyTrends}
                onCheckedChange={(checked) => handlePreferenceChange('weeklyTrends', checked)}
              />
            </div>

            <Separator />

            {/* New Features */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Bell className="h-4 w-4 text-blue-600" />
                  <Label htmlFor="newFeatures" className="font-medium">New Features</Label>
                </div>
                <p className="text-sm text-gray-500">
                  Be the first to know about new platform features and updates
                </p>
              </div>
              <Switch
                id="newFeatures"
                checked={preferences.newFeatures}
                onCheckedChange={(checked) => handlePreferenceChange('newFeatures', checked)}
              />
            </div>

            <Separator />

            {/* Community Updates */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-purple-600" />
                  <Label htmlFor="communityUpdates" className="font-medium">Community Updates</Label>
                </div>
                <p className="text-sm text-gray-500">
                  Occasional updates about community milestones and events
                </p>
              </div>
              <Switch
                id="communityUpdates"
                checked={preferences.communityUpdates}
                onCheckedChange={(checked) => handlePreferenceChange('communityUpdates', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>

        {/* Info Note */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <strong>Note:</strong> You can unsubscribe from any email notifications at any time using the unsubscribe link in the emails.
              Your email address will only be used for the notifications you've enabled above.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}