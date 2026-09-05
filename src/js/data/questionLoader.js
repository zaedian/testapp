export async function loadQuestions() {
    const questions = [];
    
    try {
        // Dynamically load all question JSON files from the questions directory
        // This approach allows the question pool to grow without code changes
        const questionFiles = [];
        
        // Generate file paths for question1.json through question100.json
        // This covers the current 175 files and allows for future expansion
        for (let i = 1; i <= 175; i++) {
            questionFiles.push(`src/js/data/questions/question${i}.json`);
        }
        
        for (const file of questionFiles) {
            try {
                const response = await fetch(file);
                if (!response.ok) {
                    // Silently skip files that don't exist (404) or fail to load
                    // This allows the loader to work with any number of available questions
                    continue;
                }
                const question = await response.json();
                questions.push(question);
            } catch (e) {
                // Silently skip files that fail to parse
                continue;
            }
        }
        
        console.log(`Loaded ${questions.length} questions from question pool`);
        return questions;
    } catch (error) {
        console.error('Error loading questions:', error);
        return [];
    }
}

// Fallback synchronous export for compatibility
export const examQuestions = [];
