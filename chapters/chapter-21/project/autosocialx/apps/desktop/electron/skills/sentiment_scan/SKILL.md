---
name: sentiment_scan
description: Analyze the sentiment and public opinion around a topic or keyword on social media platforms.
---

# Sentiment Scan Skill

When you are asked to analyze the sentiment or public opinion of a particular keyword or topic, follow these instructions:

## Instructions
1. **Understand the Goal**: Your objective is to determine if the overarching public opinion on a topic is Positive, Negative, or Neutral.
2. **Search for Context**: Since you do not have direct API access for bulk sentiment analysis, use the `web_search` tool to search for recent news, discussions, or trends related to the keyword.
3. **Analyze Results**: Read the search results and identify the predominant tone. Are people complaining? Praising? Or just reporting facts?
4. **Format the Output**: Synthesize the findings into a clear summary:
   - **Topic**: The keyword analyzed.
   - **Overall Sentiment**: (Positive/Negative/Neutral)
   - **Key Themes**: Bullet points of the main talking points or concerns discovered.
   - **Confidence/Note**: Note that this is a qualitative analysis based on recent search results, not a quantitative bulk API scan.
