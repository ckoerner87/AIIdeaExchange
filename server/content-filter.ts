// Content filtering for idea submissions
export class ContentFilter {
  private static bannedWords = [
    // Explicit content
    'porn', 'sex', 'nude', 'naked', 'xxx', 'adult', 'nsfw', 'erotic', 'sexy', 'sexual',
    // Common profanity
    'fuck', 'shit', 'damn', 'hell', 'bitch', 'ass', 'crap', 'piss', 'bastard', 'asshole'
  ];

  static isValidSubmission(content: string): { isValid: boolean; reason?: string } {
    const lowercaseContent = content.toLowerCase();
    
    // Check for banned words (swear words and sex-related content)
    for (const word of this.bannedWords) {
      if (lowercaseContent.includes(word)) {
        return { isValid: false, reason: 'Contains inappropriate content' };
      }
    }

    // Check minimum length
    if (content.trim().length < 3) {
      return { isValid: false, reason: 'Too short' };
    }

    // Check for gibberish (random keyboard mashing)
    // Look for patterns that suggest random typing
    const hasRepeatedChars = /(.)\1{3,}/.test(content); // 4+ repeated characters
    const hasRandomPattern = /[qwertyuiopasdfghjklzxcvbnm]{8,}/i.test(content.replace(/\s/g, '')); // Long sequences of adjacent keyboard letters
    const hasExcessiveNumbers = /\d{6,}/.test(content); // 6+ consecutive numbers
    const wordsCount = content.trim().split(/\s+/).length;
    const validWordsPattern = /^[a-zA-Z\s\d\.,!?'-]+$/; // Only allow standard characters
    
    if (hasRepeatedChars || hasRandomPattern || hasExcessiveNumbers) {
      return { isValid: false, reason: 'Please provide a meaningful description' };
    }

    // Check if content contains mostly valid characters (English text)
    if (!validWordsPattern.test(content)) {
      return { isValid: false, reason: 'Please use standard English characters' };
    }

    // Check for very short words suggesting gibberish
    const words = content.trim().split(/\s+/);
    const veryShortWords = words.filter(word => word.length === 1 && !/[aAiI]/.test(word));
    if (veryShortWords.length > words.length * 0.3) {
      return { isValid: false, reason: 'Please provide a meaningful description' };
    }

    return { isValid: true };
  }

  static validateIdea(useCase: string): { isValid: boolean; reason?: string } {
    return this.isValidSubmission(useCase);
  }
}