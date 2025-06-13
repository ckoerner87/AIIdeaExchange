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
import { Rocket, FileText, Link2, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { useState } from "react";
import type { InsertIdea } from "@shared/schema";

interface IdeaSubmissionFormProps {
  sessionId: string;
  onSubmitted: (newIdeaId?: number, ideaText?: string) => void;
}

export default function IdeaSubmissionForm({ sessionId, onSubmitted }: IdeaSubmissionFormProps) {
  const { toast } = useToast();
  const [selectedPostType, setSelectedPostType] = useState<"text" | "link" | "media">("text");
  
  const form = useForm<InsertIdea>({
    resolver: zodResolver(insertIdeaSchema),
    defaultValues: {
      title: "",
      description: "",
      useCase: "",
      category: "",
      tools: "",
      linkUrl: "",
      postType: "text",
      mediaUrl: "",
      mediaType: "",
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
    onSuccess: (data) => {
      toast({
        title: "Idea submitted successfully!",
        description: "Your AI use case has been added to the community.",
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              form.reset();
              // Keep form visible for another submission
            }}
          >
            Submit Another
          </Button>
        ),
      });
      form.reset();
      onSubmitted(data?.id, data?.useCase);
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
    
    // Auto-default to "Other" if no category or tools selected
    const submissionData = {
      ...data,
      category: data.category || "Other",
      tools: data.tools || "Other"
    };
    
    submitMutation.mutate(submissionData);
  };

  return (
    <Card className="shadow-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"></div>
      <CardContent className="p-8 relative z-10">
        {/* Prize announcement */}
        <div className="text-center mb-6 bg-gradient-to-r from-yellow-100 to-orange-100 p-4 rounded-lg border-2 border-yellow-300">
          <p className="text-xl font-bold text-amber-800">
            🏆 The most upvoted idea every week will win a free $100 Amazon gift card! 🏆
          </p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Post Type Selection */}
            <div className="space-y-3">
              <FormLabel className="text-sm font-medium text-slate-700">
                Post Type <span className="text-red-500">*</span>
              </FormLabel>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={selectedPostType === "text" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedPostType("text");
                    form.setValue("postType", "text");
                  }}
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Text
                </Button>
                <Button
                  type="button"
                  variant={selectedPostType === "link" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedPostType("link");
                    form.setValue("postType", "link");
                  }}
                  className="flex items-center gap-2"
                >
                  <Link2 className="w-4 h-4" />
                  Link
                </Button>
                <Button
                  type="button"
                  variant={selectedPostType === "media" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedPostType("media");
                    form.setValue("postType", "media");
                  }}
                  className="flex items-center gap-2"
                >
                  <Image className="w-4 h-4" />
                  Media
                </Button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="useCase"
              render={({ field }) => {
                const charCount = field.value?.length || 0;
                const isMinimumReached = charCount >= 100;
                
                return (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">
                      How are you using AI? The more specific, the better! <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder="Prompt ideas, prompt tips, real life stories, AI automations you're using, etc..."
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                        {...field}
                      />
                    </FormControl>
                    <div className="flex justify-between items-center mt-1">
                      <FormMessage />
                      <div className={`text-sm ${isMinimumReached ? 'text-green-600' : charCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {charCount}/100 characters minimum
                      </div>
                    </div>
                  </FormItem>
                );
              }}
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
                        <SelectItem value="manus">Manus</SelectItem>
                        <SelectItem value="mistral">Mistral</SelectItem>
                        <SelectItem value="llama">Llama</SelectItem>
                        <SelectItem value="gumloop">Gumloop</SelectItem>
                        <SelectItem value="lindy">Lindy</SelectItem>
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
                  <FormLabel className="text-sm font-medium text-slate-700 break-words">
                    <span className="block sm:inline">Link Your Stuff - </span>
                    <span className="block sm:inline">Only Visible Once Your Idea Gets 10+ Upvotes</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://your-website.com or social media link"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      value={field.value || ""}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={submitMutation.isPending || !sessionId}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-6 px-4 rounded-xl font-bold text-sm sm:text-base md:text-lg shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-300 transition-all transform hover:scale-[1.05] border-2 border-blue-500 min-h-[60px] flex items-center justify-center"
            >
              {submitMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="hidden md:inline">Share My Idea & Show Me Everyone Else's!</span>
                  <span className="hidden sm:inline md:hidden">Share My Idea & View Others!</span>
                  <span className="sm:hidden">Submit Idea</span>
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
