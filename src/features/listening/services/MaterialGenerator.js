
// Simple service to generate "listening material" from a list of words
// In a real app, this would call an LLM API.

export const MaterialGenerator = {
  generateFromSession: (session) => {
    // 1. Get words from session stats or history? 
    // The session object might not store the full list of words used, 
    // but for now we can generate a generic story or use a placeholder.
    
    // TODO: Ideally we pass the list of words practiced in this session.
    // Since we don't track the exact word objects in session.stats (just counts),
    // we will simulate it.
    
    const templates = [
      {
        title: "The Space Explorer's Diary",
        content: "Today I traveled to a distant planet. The atmosphere was thin, but I could breathe. I met a strange creature..."
      },
      {
        title: "Galactic Market",
        content: "The market was bustling with traders from all over the galaxy. I bought some rare minerals and a new engine part..."
      },
      {
        title: "Lost in the Nebula",
        content: "My navigation system failed. I was drifting in the nebula for days. Finally, I saw a beacon of light..."
      }
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];

    return {
      id: Date.now().toString(),
      title: template.title,
      content: template.content,
      createdAt: Date.now(),
      // In the future, we would embed the practiced words here
      words: [] 
    };
  }
};
