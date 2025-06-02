// Content filtering for idea submissions
export class ContentFilter {
  private static bannedWords = [
    // Explicit content
    'porn', 'sex', 'nude', 'naked', 'xxx', 'adult', 'nsfw', 'erotic',
    // Common profanity
    'fuck', 'shit', 'damn', 'hell', 'bitch', 'ass', 'crap', 'piss',
    // Spam indicators
    'click here', 'buy now', 'limited time', 'act now', 'free money',
    'make money fast', 'work from home', 'get rich', 'no experience',
    // Irrelevant content
    'recipe', 'cooking', 'weather', 'sports', 'politics', 'religion'
  ];

  private static aiKeywords = [
    'ai', 'artificial intelligence', 'chatgpt', 'claude', 'gpt', 'llm',
    'machine learning', 'ml', 'automation', 'bot', 'assistant', 'prompt',
    'generate', 'analyze', 'summarize', 'translate', 'write', 'create',
    'midjourney', 'dall-e', 'stable diffusion', 'openai', 'anthropic',
    'gemini', 'copilot', 'jasper', 'notion ai', 'grammarly', 'canva ai'
  ];

  static isValidAIUseCase(content: string): { isValid: boolean; reason?: string } {
    const lowercaseContent = content.toLowerCase();
    
    // Check for banned words
    for (const word of this.bannedWords) {
      if (lowercaseContent.includes(word)) {
        return { isValid: false, reason: 'Contains inappropriate content' };
      }
    }

    // Check minimum length (at least 10 characters)
    if (content.trim().length < 10) {
      return { isValid: false, reason: 'Too short to be helpful' };
    }

    // Check for AI-related keywords
    const hasAIKeyword = this.aiKeywords.some(keyword => 
      lowercaseContent.includes(keyword)
    );

    if (!hasAIKeyword) {
      return { isValid: false, reason: 'Must be related to AI use cases' };
    }

    // Check for spam patterns (excessive capitalization, repeated characters)
    const excessiveCaps = content.replace(/[^A-Z]/g, '').length > content.length * 0.5;
    const repeatedChars = /(.)\1{4,}/.test(content);
    
    if (excessiveCaps || repeatedChars) {
      return { isValid: false, reason: 'Appears to be spam' };
    }

    return { isValid: true };
  }

  static validateIdea(title: string, description: string, useCase: string): { isValid: boolean; reason?: string } {
    // Validate each field
    const titleCheck = this.isValidAIUseCase(title);
    if (!titleCheck.isValid) {
      return { isValid: false, reason: titleCheck.reason };
    }

    const descriptionCheck = this.isValidAIUseCase(description);
    if (!descriptionCheck.isValid) {
      return { isValid: false, reason: descriptionCheck.reason };
    }

    const useCaseCheck = this.isValidAIUseCase(useCase);
    if (!useCaseCheck.isValid) {
      return { isValid: false, reason: useCaseCheck.reason };
    }

    return { isValid: true };
  }
}