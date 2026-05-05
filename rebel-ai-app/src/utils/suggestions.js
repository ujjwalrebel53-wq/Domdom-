// Smart follow-up chips after AI replies — context aware
export function getFollowUpSuggestions(aiReply) {
  const r = aiReply.toLowerCase();

  if (r.match(/function|code|class|const|def |import |```/)) {
    return ['Explain this code', 'Add error handling', 'Optimize it', 'Write tests for it'];
  }
  if (r.match(/step \d|first|second|third|next step/)) {
    return ['Give me more detail', 'How long will this take?', 'What could go wrong?'];
  }
  if (r.match(/math|equation|formula|solve|calculate/)) {
    return ['Show step by step', 'Give another example', 'What is the formula?'];
  }
  if (r.match(/error|bug|fix|issue|problem/)) {
    return ['How do I debug this?', 'What causes this?', 'Give me an example fix'];
  }
  if (r.match(/definition|means|refer to|called/)) {
    return ['Give me an example', 'Explain simply', 'Related concepts?'];
  }
  if (r.match(/history|past|century|year|war|king/)) {
    return ['Tell me more', 'What happened next?', 'Why was this important?'];
  }
  if (r.match(/recipe|ingredient|cook|food|dish/)) {
    return ['Add nutritional info', 'Easier version?', 'Vegetarian alternative?'];
  }
  return ['Tell me more', 'Can you elaborate?', 'Give an example', 'Summarize that'];
}

// Suggested prompt cards — shown on empty chat (ChatGPT style)
export const WELCOME_PROMPTS = [
  { emoji: '💡', title: 'Explain a concept', subtitle: 'What is quantum computing?', category: 'learn' },
  { emoji: '🧑‍💻', title: 'Write some code', subtitle: 'Build a REST API in Node.js', category: 'code' },
  { emoji: '✍️', title: 'Write for me', subtitle: 'Draft a professional email', category: 'write' },
  { emoji: '🧮', title: 'Solve a problem', subtitle: 'Help me with this math problem', category: 'math' },
  { emoji: '🎨', title: 'Creative ideas', subtitle: 'Give me startup ideas for 2025', category: 'creative' },
  { emoji: '🔍', title: 'Research topic', subtitle: 'Explain black holes simply', category: 'research' },
];
