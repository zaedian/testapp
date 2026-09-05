export class ExamState {
    constructor(allQuestions) {
        this.allQuestions = allQuestions;
        this.questions = [];
        this.currentIndex = 0;
        this.userAnswers = [];
    }

    reset(questionCount = 15, selectedModules = null) {
        this.currentIndex = 0;
        this.userAnswers = [];
        this.generateQuestions(questionCount, selectedModules);
    }

    generateQuestions(count, selectedModules = null) {
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
        const distribution = {};

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

        // Generate questions from each selected module
        this.questions = [];
        modulesToUse.forEach(cat => {
            const catQuestions = questionsByCategory[cat];
            const countFromCat = distribution[cat];

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
        });

        // Shuffle final question list to mix categories
        this.questions = this.questions.sort(() => Math.random() - 0.5);
    }

    getCurrentQuestion() {
        return this.questions[this.currentIndex];
    }

    hasAnsweredCurrent() {
        return this.userAnswers[this.currentIndex] !== undefined;
    }

    setAnswer(index) {
        this.userAnswers[this.currentIndex] = index;
    }

    nextQuestion() {
        this.currentIndex++;
        return this.currentIndex < this.questions.length;
    }

    calculateResults() {
        const breakdown = {
            Gevaarherkenning: { correct: 0, total: 0 },
            Kennis: { correct: 0, total: 0 },
            Inzicht: { correct: 0, total: 0 }
        };

        this.questions.forEach((q, idx) => {
            const cat = q.category;
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

        // Scale pass limits based on custom question count
        const passLimits = {
            Gevaarherkenning: Math.max(1, Math.ceil(officialStructure.Gevaarherkenning.required * scaleFactor)),
            Kennis: Math.max(1, Math.ceil(officialStructure.Kennis.required * scaleFactor)),
            Inzicht: Math.max(1, Math.ceil(officialStructure.Inzicht.required * scaleFactor))
        };

        // Add passLimit to each category
        breakdown.Gevaarherkenning.passLimit = passLimits.Gevaarherkenning;
        breakdown.Kennis.passLimit = passLimits.Kennis;
        breakdown.Inzicht.passLimit = passLimits.Inzicht;

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