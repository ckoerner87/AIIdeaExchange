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

    // Check for gibberish patterns
    const hasExcessiveRepeats = /(.)\1{6,}/.test(content); // 7+ repeated characters like "aaaaaaa"
    const hasRandomNonsense = /^[qwertasdfzxcv]{15,}$/i.test(content.replace(/\s/g, '')); // Pure keyboard mashing
    const hasRandomLetters = /^[a-z]{20,}$/i.test(content.replace(/\s/g, '')); // Long string of random letters
    const hasRepeatingPattern = /(.{2,4})\1{4,}/.test(content.replace(/\s/g, '')); // Repeating patterns like "abcabc"
    const hasLowVowelRatio = (() => {
      const cleanText = content.replace(/\s/g, '').toLowerCase();
      if (cleanText.length < 10) return false;
      const vowels = cleanText.match(/[aeiou]/g);
      const vowelRatio = vowels ? vowels.length / cleanText.length : 0;
      return vowelRatio < 0.1 && cleanText.length > 15; // Less than 10% vowels in long text
    })();
    
    if (hasExcessiveRepeats || hasRandomNonsense || hasRandomLetters || hasRepeatingPattern || hasLowVowelRatio) {
      return { isValid: false, reason: 'Please provide a meaningful description' };
    }

    return { isValid: true };
  }

  static validateIdea(useCase: string): { isValid: boolean; reason?: string } {
    return this.isValidSubmission(useCase);
  }
}