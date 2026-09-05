export async function loadQuestions() {
    const questions = [];
    
    try {
        // Load JSON files via fetch for static hosting
        const questionFiles = [
            'src/js/data/questions/question1.json',
            'src/js/data/questions/question2.json',
            'src/js/data/questions/question3.json',
            'src/js/data/questions/question4.json',
            'src/js/data/questions/question5.json',
            'src/js/data/questions/question6.json',
            'src/js/data/questions/question7.json',
            'src/js/data/questions/question8.json',
            'src/js/data/questions/question9.json',
            'src/js/data/questions/question10.json',
            'src/js/data/questions/question11.json',
            'src/js/data/questions/question12.json',
            'src/js/data/questions/question13.json',
            'src/js/data/questions/question14.json',
            'src/js/data/questions/question15.json',
            'src/js/data/questions/question16.json',
            'src/js/data/questions/question17.json',
            'src/js/data/questions/question18.json',
            'src/js/data/questions/question19.json',
            'src/js/data/questions/question20.json',
            'src/js/data/questions/question21.json',
            'src/js/data/questions/question22.json',
            'src/js/data/questions/question23.json',
            'src/js/data/questions/question24.json',
            'src/js/data/questions/question25.json',
            'src/js/data/questions/question26.json',
            'src/js/data/questions/question27.json',
            'src/js/data/questions/question28.json',
            'src/js/data/questions/question29.json',
            'src/js/data/questions/question30.json',
            'src/js/data/questions/question31.json',
            'src/js/data/questions/question32.json',
            'src/js/data/questions/question33.json',
            'src/js/data/questions/question34.json',
            'src/js/data/questions/question35.json',
            'src/js/data/questions/question36.json',
            'src/js/data/questions/question37.json',
            'src/js/data/questions/question38.json',
            'src/js/data/questions/question39.json',
            'src/js/data/questions/question40.json',
            'src/js/data/questions/question41.json',
            'src/js/data/questions/question42.json',
            'src/js/data/questions/question43.json',
            'src/js/data/questions/question44.json',
            'src/js/data/questions/question45.json',
            'src/js/data/questions/question46.json',
            'src/js/data/questions/question47.json',
            'src/js/data/questions/question48.json',
            'src/js/data/questions/question49.json',
            'src/js/data/questions/question50.json',
            'src/js/data/questions/question51.json',
            'src/js/data/questions/question52.json',
            'src/js/data/questions/question53.json',
            'src/js/data/questions/question54.json',
            'src/js/data/questions/question55.json',
            'src/js/data/questions/question56.json',
            'src/js/data/questions/question57.json',
            'src/js/data/questions/question58.json',
            'src/js/data/questions/question59.json',
            'src/js/data/questions/question60.json'
        ];
        
        for (const file of questionFiles) {
            try {
                const response = await fetch(file);
                if (!response.ok) {
                    console.warn(`Failed to load ${file}: ${response.status}`);
                    continue;
                }
                const question = await response.json();
                questions.push(question);
            } catch (e) {
                console.warn(`Failed to load ${file}:`, e);
            }
        }
        
        return questions;
    } catch (error) {
        console.error('Error loading questions:', error);
        return [];
    }
}

// Fallback synchronous export for compatibility
export const examQuestions = [];
