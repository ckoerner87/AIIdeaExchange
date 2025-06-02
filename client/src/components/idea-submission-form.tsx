import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertIdeaSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import type { InsertIdea } from "@shared/schema";

interface IdeaSubmissionFormProps {
  sessionId: string;
  onSubmitted: () => void;
}

export default function IdeaSubmissionForm({ sessionId, onSubmitted }: IdeaSubmissionFormProps) {
  const { toast } = useToast();
  
  const form = useForm<InsertIdea>({
    resolver: zodResolver(insertIdeaSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      tools: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: InsertIdea) => {
      console.log("Making API request with sessionId:", sessionId);
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify(data),
      });
      console.log("Response status:", res.status);
      if (!res.ok) {
        const error = await res.json();
        console.log("Error response:", error);
        throw new Error(error.message || 'Failed to submit idea');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Idea submitted successfully!",
        description: "Your AI use case has been added to the community.",
      });
      form.reset();
      onSubmitted();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit idea",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertIdea) => {
    console.log("Form submit - sessionId:", sessionId);
    if (!sessionId) {
      toast({
        title: "Error",
        description: "Session not initialized. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate(data);
  };

  return (
    <Card className="shadow-lg border border-slate-200">
      <CardContent className="p-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="useCase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-slate-700">
                    What's Your AI Use Case? <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Describe how you use AI, what tools you use, and what benefits you've seen..."
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="content-creation">Content Creation</SelectItem>
                        <SelectItem value="marketing-ads">Marketing & Ads</SelectItem>
                        <SelectItem value="sales-outreach">Sales & Outreach</SelectItem>
                        <SelectItem value="automation-ai-agents">Automation & AI Agents</SelectItem>
                        <SelectItem value="data-analysis-reporting">Data Analysis & Reporting</SelectItem>
                        <SelectItem value="productivity-time-saving">Productivity & Time-Saving</SelectItem>
                        <SelectItem value="customer-support">Customer Support</SelectItem>
                        <SelectItem value="ecommerce-dropshipping">E-commerce & Dropshipping</SelectItem>
                        <SelectItem value="personal-lifestyle">Personal Life & Lifestyle Hacks</SelectItem>
                        <SelectItem value="real-estate">Real Estate</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tools"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">AI Tools Used</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all">
                          <SelectValue placeholder="Select AI tools" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="chatgpt">ChatGPT</SelectItem>
                        <SelectItem value="claude">Claude</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="deepseek">DeepSeek</SelectItem>
                        <SelectItem value="grok">Grok</SelectItem>
                        <SelectItem value="perplexity">Perplexity</SelectItem>
                        <SelectItem value="mistral">Mistral</SelectItem>
                        <SelectItem value="llama">Llama</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="linkUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-slate-700">
                    Link Your Stuff - Only Visible Once Your Idea Gets 10+ Upvotes
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://your-website.com or social media link"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={submitMutation.isPending || !sessionId}
              className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-600 focus:ring-4 focus:ring-blue-200 transition-all transform hover:scale-[1.02]"
            >
              {submitMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-5 w-5" />
                  Share My Idea & Unlock Community
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
