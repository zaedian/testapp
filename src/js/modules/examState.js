export class ExamState {
    constructor(allQuestions) {
        this.allQuestions = allQuestions;
        this.questions = [];
        this.currentIndex = 0;
        this.userAnswers = [];
        this.questionResults = []; // Track detailed results for each question
    }

    reset(questionCount = 15, selectedModules = null, randomOrder = true) {
        this.currentIndex = 0;
        this.userAnswers = [];
        this.questionResults = [];
        this.generateQuestions(questionCount, selectedModules, randomOrder);
    }

    generateQuestions(count, selectedModules = null, randomOrder = true) {
        // Group questions by category
        const questionsByCategory = {
            Gevaarherkenning: [],
            Kennis: [],
            Inzicht: []
        };

        this.allQuestions.forEach(q => {
            if (questionsByCategory[q.category]) {
                questionsByCategory[q.category].push(q);
            }
        });

        // If no modules selected, use all available
        const modulesToUse = selectedModules && selectedModules.length > 0
            ? selectedModules
            : Object.keys(questionsByCategory).filter(cat => questionsByCategory[cat].length > 0);

        // Calculate proportional distribution based on selected modules
        const availableQuestions = modulesToUse.reduce((sum, cat) => sum + questionsByCategory[cat].length, 0);
        
        // Handle edge case: no questions available
        if (availableQuestions === 0) {
            console.warn('No questions available in selected modules');
            this.questions = [];
            return;
        }
        
        const distribution = {};

        if (count === 1) {
            // Special case: single question - pick from first available category
            distribution[modulesToUse[0]] = 1;
        } else {
            modulesToUse.forEach(cat => {
                const proportion = questionsByCategory[cat].length / availableQuestions;
                distribution[cat] = Math.max(1, Math.round(count * proportion));
            });

            // Adjust for rounding to match total count
            const distributedTotal = Object.values(distribution).reduce((sum, val) => sum + val, 0);
            if (distributedTotal !== count) {
                const diff = count - distributedTotal;
                const moduleToAdjust = modulesToUse[0];
                distribution[moduleToAdjust] += diff;
            }
        }

        // Generate questions from each selected module
        this.questions = [];
        modulesToUse.forEach(cat => {
            const catQuestions = questionsByCategory[cat];
            const countFromCat = distribution[cat];

            if (randomOrder) {
                // Shuffle and select from this category
                const shuffled = [...catQuestions].sort(() => Math.random() - 0.5);

                if (countFromCat <= catQuestions.length) {
                    // Take first N without repetition
                    this.questions.push(...shuffled.slice(0, countFromCat));
                } else {
                    // For larger counts, allow repetition within category
                    for (let i = 0; i < countFromCat; i++) {
                        const randomIndex = Math.floor(Math.random() * catQuestions.length);
                        this.questions.push(catQuestions[randomIndex]);
                    }
                }
            } else {
                // Sequential: take from start of each category
                if (countFromCat <= catQuestions.length) {
                    this.questions.push(...catQuestions.slice(0, countFromCat));
                } else {
                    // For larger counts, cycle through sequentially
                    for (let i = 0; i < countFromCat; i++) {
                        this.questions.push(catQuestions[i % catQuestions.length]);
                    }
                }
            }
        });

        if (randomOrder) {
            // Shuffle final question list to mix categories
            this.questions = this.questions.sort(() => Math.random() - 0.5);
        }
        // For sequential, keep categories grouped in order
    }

    getCurrentQuestion() {
        return this.questions[this.currentIndex];
    }

    hasAnsweredCurrent() {
        return this.userAnswers[this.currentIndex] !== undefined;
    }

    setAnswer(index) {
        this.userAnswers[this.currentIndex] = index;
        
        // Track detailed result for this question
        const question = this.questions[this.currentIndex];
        const isCorrect = index === question.answer;
        
        this.questionResults.push({
            questionIndex: this.currentIndex,
            question: question,
            userAnswer: index,
            correctAnswer: question.answer,
            isCorrect: isCorrect,
            category: question.category
        });
    }

    nextQuestion() {
        this.currentIndex++;
        return this.currentIndex < this.questions.length;
    }

    calculateResults() {
        const breakdown = {};

        // Only include categories that actually have questions in this exam
        this.questions.forEach((q, idx) => {
            const cat = q.category;
            if (!breakdown[cat]) {
                breakdown[cat] = { correct: 0, total: 0 };
            }
            breakdown[cat].total++;
            if (this.userAnswers[idx] === q.answer) {
                breakdown[cat].correct++;
            }
        });

        // Official CBR exam structure (old format)
        const officialStructure = {
            Gevaarherkenning: { total: 25, required: 13 },
            Kennis: { total: 12, required: 10 },
            Inzicht: { total: 28, required: 25 }
        };
        const officialTotal = 65;
        const customTotal = this.questions.length;
        const scaleFactor = customTotal / officialTotal;

        // Scale pass limits based on custom question count, only for categories used
        for (const cat of Object.keys(breakdown)) {
            if (officialStructure[cat]) {
                breakdown[cat].passLimit = Math.max(1, Math.ceil(officialStructure[cat].required * scaleFactor));
            } else {
                // Fallback for unknown categories
                breakdown[cat].passLimit = Math.ceil(breakdown[cat].total * 0.8);
            }
        }

        let overallPassed = true;
        for (const data of Object.values(breakdown)) {
            if (data.correct < data.passLimit) {
                overallPassed = false;
                break;
            }
        }

        return { breakdown, overallPassed };
    }
}