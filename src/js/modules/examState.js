export function calculateCategoryExtremes(breakdown = {}) {
    if (!breakdown || typeof breakdown !== 'object') {
        return { strongestCategory: null, weakestCategory: null, strongestAccuracy: 0, weakestAccuracy: 0 };
    }

    const validEntries = Object.entries(breakdown).filter(([, data]) => {
        const total = Number(data?.total ?? 0);
        const correct = Number(data?.correct ?? 0);
        return Number.isFinite(total) && Number.isFinite(correct) && total > 0;
    });

    if (validEntries.length === 0) {
        return { strongestCategory: null, weakestCategory: null, strongestAccuracy: 0, weakestAccuracy: 0 };
    }

    const categoryScores = validEntries.map(([name, data]) => {
        const total = Number(data?.total ?? 0);
        const correct = Number(data?.correct ?? 0);
        const accuracy = total > 0 ? (correct / total) * 100 : 0;
        return { name, total, correct, accuracy };
    });

    const strongest = categoryScores.reduce((best, current) => {
        if (!best || current.accuracy > best.accuracy) return current;
        return best;
    }, null);

    const hasMixedScores = categoryScores.some(score => score.accuracy !== 100);
    const weakest = hasMixedScores
        ? categoryScores.reduce((worst, current) => {
            if (!worst || current.accuracy < worst.accuracy) return current;
            return worst;
        }, null)
        : null;

    return {
        strongestCategory: strongest ? strongest.name : null,
        weakestCategory: weakest ? weakest.name : null,
        strongestAccuracy: strongest ? strongest.accuracy : 0,
        weakestAccuracy: weakest ? weakest.accuracy : 0
    };
}

export class ExamState {
    constructor(allQuestions) {
        this.allQuestions = allQuestions || [];
        this.questions = [];
        this.currentIndex = 0;
        this.userAnswers = [];
        this.questionResults = [];
    }

    reset(questionCount = 15, selectedModules = null, randomOrder = true) {
        this.currentIndex = 0;
        this.userAnswers = [];
        this.questionResults = [];
        this.generateQuestions(questionCount, selectedModules, randomOrder);
    }

    // Helper: Unbiased Fisher-Yates shuffle
    shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    generateQuestions(count, selectedModules = null, randomOrder = true) {
        // Dynamically group questions by category to avoid missing keys
        const questionsByCategory = {};
        this.allQuestions.forEach(q => {
            if (!q.category) return;
            if (!questionsByCategory[q.category]) {
                questionsByCategory[q.category] = [];
            }
            questionsByCategory[q.category].push(q);
        });

        // Filter valid modules that actually contain questions
        const availableCategories = Object.keys(questionsByCategory).filter(
            cat => questionsByCategory[cat].length > 0
        );

        const modulesToUse = selectedModules && selectedModules.length > 0
            ? selectedModules.filter(cat => questionsByCategory[cat] && questionsByCategory[cat].length > 0)
            : availableCategories;

        const availableQuestions = modulesToUse.reduce((sum, cat) => sum + questionsByCategory[cat].length, 0);

        if (availableQuestions === 0) {
            console.warn('No questions available in selected modules');
            this.questions = [];
            return;
        }

        // Proportional distribution while keeping the total exactly equal to the requested count.
        const distribution = {};
        if (count <= 0) {
            this.questions = [];
            return;
        }

        if (count === 1) {
            distribution[modulesToUse[0]] = 1;
        } else if (modulesToUse.length >= count) {
            modulesToUse.forEach((cat, idx) => {
                distribution[cat] = idx < count ? 1 : 0;
            });
        } else {
            modulesToUse.forEach(cat => {
                const proportion = questionsByCategory[cat].length / availableQuestions;
                distribution[cat] = Math.max(1, Math.round(count * proportion));
            });

            let distributedTotal = Object.values(distribution).reduce((sum, val) => sum + val, 0);
            while (distributedTotal > count) {
                const moduleToAdjust = modulesToUse.find(cat => (distribution[cat] || 0) > 1) || modulesToUse[0];
                if (!moduleToAdjust) break;
                distribution[moduleToAdjust] = Math.max(0, (distribution[moduleToAdjust] || 0) - 1);
                distributedTotal = Object.values(distribution).reduce((sum, val) => sum + val, 0);
                if (distributedTotal <= count) break;
            }

            while (distributedTotal < count) {
                const moduleToAdjust = modulesToUse.find(cat => (distribution[cat] || 0) < questionsByCategory[cat].length) || modulesToUse[0];
                if (!moduleToAdjust) break;
                distribution[moduleToAdjust] = (distribution[moduleToAdjust] || 0) + 1;
                distributedTotal = Object.values(distribution).reduce((sum, val) => sum + val, 0);
                if (distributedTotal >= count) break;
            }
        }

        // Build question list
        this.questions = [];
        modulesToUse.forEach(cat => {
            const catQuestions = questionsByCategory[cat];
            const countFromCat = distribution[cat];

            if (randomOrder) {
                const shuffled = this.shuffle(catQuestions);
                if (countFromCat <= catQuestions.length) {
                    this.questions.push(...shuffled.slice(0, countFromCat));
                } else {
                    for (let i = 0; i < countFromCat; i++) {
                        const randomIndex = Math.floor(Math.random() * catQuestions.length);
                        this.questions.push(catQuestions[randomIndex]);
                    }
                }
            } else {
                if (countFromCat <= catQuestions.length) {
                    this.questions.push(...catQuestions.slice(0, countFromCat));
                } else {
                    for (let i = 0; i < countFromCat; i++) {
                        this.questions.push(catQuestions[i % catQuestions.length]);
                    }
                }
            }
        });

        if (randomOrder) {
            this.questions = this.shuffle(this.questions);
        }
    }

    getCurrentQuestion() {
        return this.questions[this.currentIndex];
    }

    hasAnsweredCurrent() {
        return this.userAnswers[this.currentIndex] !== undefined;
    }

    setAnswer(index) {
        this.userAnswers[this.currentIndex] = index;
        
        const question = this.questions[this.currentIndex];
        const isCorrect = index === question.answer;
        
        // Update by index instead of pushing to avoid duplicate entries on answer updates
        this.questionResults[this.currentIndex] = {
            questionIndex: this.currentIndex,
            question: question,
            userAnswer: index,
            correctAnswer: question.answer,
            isCorrect: isCorrect,
            category: question.category
        };
    }

    nextQuestion() {
        this.currentIndex++;
        return this.currentIndex < this.questions.length;
    }

    previousQuestion() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return true;
        }
        return false;
    }

    calculateResults() {
        const breakdown = {};

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

        const passRatios = {
            Gevaarherkenning: 0.52,
            Kennis: 0.83,
            Inzicht: 0.89
        };

        for (const cat of Object.keys(breakdown)) {
            const data = breakdown[cat];
            const ratio = passRatios[cat] || 0.80;
            data.passLimit = Math.max(1, Math.ceil(data.total * ratio));
        }

        // Calculate overall pass based on 80% overall score
        const totalCorrect = Object.values(breakdown).reduce((sum, data) => sum + data.correct, 0);
        const totalQuestions = Object.values(breakdown).reduce((sum, data) => sum + data.total, 0);
        const overallPassRate = totalQuestions > 0 ? (totalCorrect / totalQuestions) : 0;
        const overallPassed = overallPassRate >= 0.80;

        const categoryExtremes = calculateCategoryExtremes(breakdown);

        return {
            breakdown,
            overallPassed,
            strongestCategory: categoryExtremes.strongestCategory,
            weakestCategory: categoryExtremes.weakestCategory,
            strongestAccuracy: categoryExtremes.strongestAccuracy,
            weakestAccuracy: categoryExtremes.weakestAccuracy
        };
    }
}