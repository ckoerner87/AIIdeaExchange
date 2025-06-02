import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface IdeaGrading {
  score: number;
  reasoning: string;
}

export async function gradeIdea(idea: {
  title: string;
  description: string;
  category: string;
  tools: string;
}): Promise<number> {
  try {
    const prompt = `Rate this AI use case idea on a scale of 1.0 to 10.0 (in 0.1 increments) based on:
- Creativity and uniqueness (30%)
- Practical value and feasibility (40%) 
- Clear explanation and specificity (30%)

Idea Details:
Title: ${idea.title}
Description: ${idea.description}
Category: ${idea.category}
Tools: ${idea.tools}

Respond with only a JSON object in this format: { "score": 7.3, "reasoning": "Brief explanation" }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert evaluator of AI use cases. Rate ideas objectively and provide constructive feedback."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    const result = JSON.parse(response.choices[0].message.content || '{"score": 5.0}');
    
    // Ensure score is within bounds and properly formatted
    let score = parseFloat(result.score);
    if (isNaN(score) || score < 1.0) score = 1.0;
    if (score > 10.0) score = 10.0;
    
    // Round to nearest 0.1
    score = Math.round(score * 10) / 10;
    
    return score;
  } catch (error) {
    console.error('Error grading idea with AI:', error);
    // Return a neutral score if AI grading fails
    return 5.0;
  }
}