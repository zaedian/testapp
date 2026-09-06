export class UIRenderer {
    constructor(translations = null) {
        // Cache DOM elements once during initialization
        this.views = {
            menu: document.getElementById("menu-view"),
            quiz: document.getElementById("quiz-view"),
            results: document.getElementById("results-view")
        };
        this.progressContainer = document.getElementById("progress-container");
        this.progressBar = document.getElementById("progress-bar");

        this.categoryBadge = document.getElementById("category-badge");
        this.currentNum = document.getElementById("current-num");
        this.totalNum = document.getElementById("total-num");
        this.scenarioText = document.getElementById("scenario-text");
        this.questionText = document.getElementById("question-text");
        this.optionsContainer = document.getElementById("options-container");
        this.explanationBox = document.getElementById("explanation-box");
        this.nextBtn = document.getElementById("next-btn");

        this.breakdownBody = document.getElementById("breakdown-body");
        this.statusBadge = document.getElementById("status-badge");

        this.themeIcon = document.getElementById("theme-icon");
        this.themeText = document.getElementById("theme-text");
        this.langIcon = document.getElementById("lang-icon");
        this.langText = document.getElementById("lang-text");

        this.answersContainer = document.getElementById("answers-container");
        this.toggleAnswersBtn = document.getElementById("toggle-answers-btn");
        this.showAllAnswers = false;

        this.currentLang = "nl";
        this.translations = translations;
        this.optionOrderByQuestionIndex = new Map();
        
        // Optional callback for TTS functionality
        this.onTtsSpeak = null;
    }

    /**
     * Resets internal state between exam sessions
     */
    resetState() {
        this.optionOrderByQuestionIndex.clear();
        this.showAllAnswers = false;
    }

    setTranslations(translations) {
        this.translations = translations;
    }

    setLanguage(lang) {
        this.currentLang = lang;
        const label = lang.toUpperCase();
        if (this.langIcon) this.langIcon.textContent = label;
        if (this.langText) this.langText.textContent = label;
    }

    updateUIText(translations) {
        if (!translations) return;

        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.dataset.i18n;
            let text = this.getNestedTranslation(translations, key);
            
            if (text && el.dataset.i18nArgs) {
                try {
                    const args = JSON.parse(el.dataset.i18nArgs);
                    text = text.replace(/{(\w+)}/g, (match, param) => args[param] || match);
                } catch (e) {
                    console.warn('Failed to parse i18n args:', e);
                }
            }
            if (text) el.textContent = text;
        });

        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            const text = this.getNestedTranslation(translations, key);
            if (text) el.placeholder = text;
        });

        document.querySelectorAll(".btn-mode").forEach(btn => {
            const count = btn.dataset.questions;
            const unit = this.getTranslation("menu.questions", this.currentLang === "nl" ? "Vragen" : "Questions");
            btn.textContent = `${count} ${unit}`;
        });
    }

    getNestedTranslation(obj, path) {
        return path ? path.split('.').reduce((o, p) => o && o[p], obj) : null;
    }

    getTranslation(key, fallback = '') {
        if (!this.translations) return fallback;
        const langData = this.translations[this.currentLang] || {};
        return this.getNestedTranslation(langData, key) || fallback;
    }

    setTheme(theme, lang = this.currentLang) {
        const isLight = theme === "light";
        document.documentElement.setAttribute("data-theme", isLight ? "light" : "dark");
        
        if (this.themeIcon) this.themeIcon.textContent = isLight ? "🌙" : "☀️";
        
        if (this.themeText) {
            const defaultDark = lang === "nl" ? "Donkere Modus" : "Dark Mode";
            const defaultLight = lang === "nl" ? "Lichte Modus" : "Light Mode";
            this.themeText.textContent = isLight 
                ? this.getTranslation("buttons.darkMode", defaultDark)
                : this.getTranslation("buttons.lightMode", defaultLight);
        }
    }

    showView(viewName) {
        Object.entries(this.views).forEach(([name, element]) => {
            if (element) {
                element.classList.toggle("active", name === viewName);
            }
        });
        if (this.progressContainer) {
            this.progressContainer.style.display = viewName === "menu" ? "none" : "block";
        }
    }

    renderQuestion(question, currentIndex, totalQuestions, onSelectOption) {
        if (!question) return;

        if (this.progressBar) {
            this.progressBar.style.width = `${((currentIndex + 1) / totalQuestions) * 100}%`;
        }
        if (this.currentNum) this.currentNum.textContent = currentIndex + 1;
        if (this.totalNum) this.totalNum.textContent = totalQuestions;
        if (this.categoryBadge) this.categoryBadge.textContent = question.category;
        
        const lang = this.currentLang;
        const scenario = typeof question.scenario === 'object' ? question.scenario[lang] : question.scenario;
        const questionText = typeof question.question === 'object' ? question.question[lang] : question.question;
        const options = typeof question.options === 'object' ? question.options[lang] : question.options;

        if (this.scenarioText) {
            const hasScenario = Boolean(scenario && String(scenario).trim());
            this.scenarioText.textContent = hasScenario ? scenario : '';
            this.scenarioText.style.display = hasScenario ? 'block' : 'none';
        }

        if (this.questionText) {
            if (!this.questionText.parentElement || !this.questionText.parentElement.classList.contains('question-title-row')) {
                const row = document.createElement('div');
                row.className = 'question-title-row';
                const parent = this.questionText.parentElement;
                if (parent) {
                    parent.insertBefore(row, this.questionText);
                    row.appendChild(this.questionText);
                }
            }

            const titleRow = this.questionText.parentElement;
            if (titleRow && !titleRow.querySelector('#question-tts-btn')) {
                const questionTtsBtn = document.createElement('button');
                questionTtsBtn.type = 'button';
                questionTtsBtn.id = 'question-tts-btn';
                questionTtsBtn.className = 'control-btn header-read-btn question-tts-btn';
                questionTtsBtn.innerHTML = '<span class="header-read-icon" aria-hidden="true">🔊</span><span class="header-read-state-icon" aria-hidden="true">🔇</span>';
                questionTtsBtn.title = lang === 'nl' ? 'Vraag voorlezen' : 'Read question aloud';
                questionTtsBtn.setAttribute('aria-label', lang === 'nl' ? 'Vraag voorlezen' : 'Read question aloud');
                titleRow.appendChild(questionTtsBtn);
            }

            this.questionText.textContent = questionText || '';
        }

        if (this.explanationBox) {
            this.explanationBox.style.display = "none";
        }

        if (this.nextBtn) {
            this.nextBtn.disabled = true;
            const finishText = this.getTranslation("buttons.finishExam", lang === "nl" ? "Examen Beëindigen" : "Finish Exam");
            const nextText = this.getTranslation("buttons.nextQuestion", lang === "nl" ? "Volgende Vraag" : "Next Question");
            this.nextBtn.textContent = (currentIndex === totalQuestions - 1) ? finishText : nextText;
        }

        // Shuffle options and maintain mapping for this question index
        if (!this.optionOrderByQuestionIndex.has(currentIndex)) {
            const shuffledOptions = options.map((opt, idx) => ({ text: opt, originalIndex: idx }));
            this.shuffleArray(shuffledOptions);
            this.optionOrderByQuestionIndex.set(currentIndex, shuffledOptions);
        }

        const shuffledOptions = this.optionOrderByQuestionIndex.get(currentIndex);
        const fragment = document.createDocumentFragment();
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

        shuffledOptions.forEach((item, idx) => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            const displayLetter = letters[idx] || String.fromCharCode(65 + idx);
            btn.textContent = `${displayLetter}. ${item.text}`;
            btn.dataset.index = item.originalIndex;
            btn.dataset.displayLetter = displayLetter;
            btn.dataset.letter = displayLetter;
            fragment.appendChild(btn);
        });

        if (this.optionsContainer) {
            this.optionsContainer.replaceChildren(fragment);
            this.optionsContainer.onclick = (e) => {
                const btn = e.target.closest(".option-btn");
                if (btn && !btn.disabled) {
                    onSelectOption(Number(btn.dataset.index));
                }
            };
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    showAnswerFeedback(selectedIndex, correctIndex, explanation, isTimeout = false) {
        if (!this.optionsContainer || !this.explanationBox) return;

        const btns = this.optionsContainer.children;
        for (let idx = 0; idx < btns.length; idx++) {
            const btn = btns[idx];
            btn.disabled = true;
            const originalIndex = Number(btn.dataset.index);
            if (originalIndex === correctIndex) {
                btn.classList.add("correct");
            }
            if (originalIndex === selectedIndex && selectedIndex !== correctIndex) {
                btn.classList.add("incorrect");
            }
        }

        this.explanationBox.replaceChildren();
        
        const explanationText = typeof explanation === 'object' ? explanation[this.currentLang] : explanation;

        const labelContainer = document.createElement("div");
        labelContainer.style.display = "flex";
        labelContainer.style.alignItems = "center";
        labelContainer.style.gap = "8px";
        labelContainer.style.flexWrap = "wrap";

        if (isTimeout) {
            const timeoutSpan = document.createElement("strong");
            timeoutSpan.className = "text-danger";
            timeoutSpan.textContent = this.currentLang === "nl" ? "Tijd Om! " : "Time's Up! ";
            labelContainer.appendChild(timeoutSpan);
        }

        const expLabel = document.createElement("strong");
        expLabel.textContent = this.currentLang === "nl" ? "Uitleg: " : "Explanation: ";
        labelContainer.appendChild(expLabel);

        const expTtsBtn = document.createElement("button");
        expTtsBtn.type = "button";
        expTtsBtn.id = "explanation-tts-btn";
        expTtsBtn.className = "control-btn header-read-btn explanation-tts-btn";
        expTtsBtn.innerHTML = '<span class="header-read-icon" aria-hidden="true">🔊</span><span class="header-read-state-icon" aria-hidden="true">🔇</span>';
        expTtsBtn.title = this.currentLang === "nl" ? "Uitleg voorlezen" : "Read explanation aloud";
        expTtsBtn.setAttribute("aria-label", this.currentLang === "nl" ? "Uitleg voorlezen" : "Read explanation aloud");
        labelContainer.appendChild(expTtsBtn);

        const textPara = document.createElement("p");
        textPara.textContent = explanationText;

        this.explanationBox.appendChild(labelContainer);
        this.explanationBox.appendChild(textPara);
        this.explanationBox.style.display = "block";
        
        if (this.nextBtn) this.nextBtn.disabled = false;
    }

    renderResults(resultsData = {}) {
        const {
            breakdown = {},
            overallPassed = false,
            questionResults = [],
            strongestCategory = null,
            weakestCategory = null
        } = resultsData;

        if (this.progressBar) this.progressBar.style.width = "100%";
        
        const lang = this.currentLang;
        const totalQuestions = questionResults.length;
        const correctCount = questionResults.filter(r => r.isCorrect).length;
        const incorrectCount = totalQuestions - correctCount;
        const passRate = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
        const requiredPassRate = 80;
        const isPassed = Boolean(overallPassed);

        const setElementText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setElementText("stat-total", totalQuestions);
        setElementText("stat-correct", correctCount);
        setElementText("stat-incorrect", incorrectCount);
        setElementText("stat-required-rate", `${requiredPassRate}%`);
        setElementText("stat-rate", `${passRate}%`);

        const passedCategories = Object.entries(breakdown).filter(([, data]) => (Number(data?.correct ?? 0)) >= (Number(data?.passLimit ?? 0))).length;
        const totalCategories = Object.keys(breakdown).length;
        setElementText("stat-passed-categories", `${passedCategories}/${totalCategories}`);

        const formatCategoryStat = (categoryName, fallback = "—") => {
            if (!categoryName || !breakdown[categoryName]) return fallback;
            const categoryData = breakdown[categoryName];
            const total = Number(categoryData?.total ?? 0);
            const correct = Number(categoryData?.correct ?? 0);
            const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
            return `${categoryName} (${accuracy}%)`;
        };

        const strongestLabel = this.getTranslation("results.strongestCategoryLabel", lang === "nl" ? "Sterkste categorie:" : "Strongest category:");
        const weakestLabel = this.getTranslation("results.weakestCategoryLabel", lang === "nl" ? "Zwakste categorie:" : "Weakest category:");

        setElementText("stat-strongest-category", formatCategoryStat(strongestCategory, "—"));
        setElementText("stat-weakest-category", formatCategoryStat(weakestCategory, "—"));

        const overviewEl = document.getElementById("results-overview");
        if (overviewEl) {
            const summaryTitle = isPassed
                ? (lang === "nl" ? "Je bent geslaagd" : "You passed the exam")
                : (lang === "nl" ? "Je bent niet geslaagd" : "You did not pass the exam");
            const summaryText = isPassed
                ? (lang === "nl"
                    ? `Je hebt ${passedCategories} van ${totalCategories} categorieën gehaald en voldoet aan de eisen van het examen.`
                    : `You passed ${passedCategories} out of ${totalCategories} categories and met the exam requirements.`)
                : (lang === "nl"
                    ? `Je hebt ${passedCategories} van ${totalCategories} categorieën gehaald. Herhaal de zwakkere categorieën om te slagen.`
                    : `You passed ${passedCategories} out of ${totalCategories} categories. Review the weaker areas before retaking the exam.`);

            overviewEl.innerHTML = `
                <div class="results-overview-card">
                    <h3>${this.escapeHtml(summaryTitle)}</h3>
                    <p class="results-overview-copy">${this.escapeHtml(summaryText)}</p>
                </div>
                <div class="results-overview-card">
                    <h3>${this.escapeHtml(lang === "nl" ? "Samenvatting" : "Summary")}</h3>
                    <ul>
                        <li>${this.escapeHtml(lang === "nl" ? "Jouw score:" : "Your score:")} ${correctCount}/${totalQuestions} (${passRate}%)</li>
                        <li>${this.escapeHtml(strongestLabel)} ${this.escapeHtml(strongestCategory ? formatCategoryStat(strongestCategory, "—") : "—")}</li>
                        <li>${this.escapeHtml(weakestLabel)} ${this.escapeHtml(weakestCategory ? formatCategoryStat(weakestCategory, "—") : "—")}</li>
                    </ul>
                </div>
            `;
        }

        const reasonsEl = document.getElementById("results-reasons");
        if (reasonsEl) {
            const failedCategories = Object.entries(breakdown)
                .filter(([, data]) => (Number(data?.correct ?? 0)) < (Number(data?.passLimit ?? 0)))
                .map(([name, data]) => {
                    const accuracy = Number(data?.total ?? 0) > 0 ? Math.round(((Number(data?.correct ?? 0)) / Number(data?.total ?? 1)) * 100) : 0;
                    return `${name}: ${accuracy}%`;
                });

            const advice = (failedCategories.length > 0)
                ? (lang === "nl"
                    ? `Focus op: ${failedCategories.join(', ')}.`
                    : `Focus on: ${failedCategories.join(', ')}.`)
                : (lang === "nl"
                    ? "Je voldoet aan alle gevraagde categorie-eisen."
                    : "You met the pass requirement for every category.");

            reasonsEl.innerHTML = `
                <div class="results-overview-card">
                    <h3>${this.escapeHtml(lang === "nl" ? "Uitleg van je resultaat" : "Your result explained")}</h3>
                    <p class="results-overview-copy">${this.escapeHtml(advice)}</p>
                </div>
            `;
        }

        // Render breakdown safely without unsafe innerHTML
        if (this.breakdownBody) {
            const fragment = document.createDocumentFragment();
            for (const [cat, data] of Object.entries(breakdown)) {
                const categoryPassed = data.correct >= data.passLimit;
                const row = document.createElement("tr");

                const statusText = categoryPassed 
                    ? this.getTranslation("results.passed", lang === "nl" ? "GESLAAGD" : "PASSED")
                    : this.getTranslation("results.failed", lang === "nl" ? "GEZAKT" : "FAILED");

                row.innerHTML = `
                    <td><strong>${this.escapeHtml(cat)}</strong></td>
                    <td>${data.correct} / ${data.total}</td>
                    <td>Min. ${data.passLimit}</td>
                    <td class="${categoryPassed ? 'text-success' : 'text-danger'}">
                        ${this.escapeHtml(statusText)}
                    </td>
                `;
                fragment.appendChild(row);
            }
            this.breakdownBody.replaceChildren(fragment);
        }

        if (this.statusBadge) {
            const statusText = isPassed 
                ? this.getTranslation("results.passed", lang === "nl" ? "GESLAAGD" : "PASSED")
                : this.getTranslation("results.failed", lang === "nl" ? "GEZAKT" : "FAILED");
            this.statusBadge.textContent = statusText;
            this.statusBadge.className = `status-badge ${isPassed ? 'pass' : 'fail'}`;
        }

        if (this.toggleAnswersBtn) {
            this.showAllAnswers = false;
            this.toggleAnswersBtn.textContent = lang === "nl" ? "Toon Alle Antwoorden" : "Show All Answers";
            this.toggleAnswersBtn.onclick = () => this.toggleAnswerView(questionResults);
        }

        this.renderAnswerCards(questionResults, false);
    }

    toggleAnswerView(questionResults) {
        this.showAllAnswers = !this.showAllAnswers;
        const lang = this.currentLang;
        
        if (this.toggleAnswersBtn) {
            this.toggleAnswersBtn.textContent = this.showAllAnswers 
                ? (lang === "nl" ? "Toon Alleen Foute Antwoorden" : "Show Wrong Answers Only")
                : (lang === "nl" ? "Toon Alle Antwoorden" : "Show All Answers");
        }
        
        this.renderAnswerCards(questionResults, this.showAllAnswers);
    }

    renderAnswerCards(questionResults, showAll) {
        const lang = this.currentLang;
        const noWrongAnswersDiv = document.getElementById("no-wrong-answers");
        const answersToShow = showAll ? questionResults : questionResults.filter(r => !r.isCorrect);
        
        if (answersToShow.length === 0 && !showAll) {
            if (this.answersContainer) this.answersContainer.style.display = "none";
            if (noWrongAnswersDiv) noWrongAnswersDiv.style.display = "block";
            if (this.toggleAnswersBtn) this.toggleAnswersBtn.style.display = "none";
            return;
        }

        if (this.answersContainer) this.answersContainer.style.display = "flex";
        if (noWrongAnswersDiv) noWrongAnswersDiv.style.display = "none";
        if (this.toggleAnswersBtn) this.toggleAnswersBtn.style.display = "block";
        
        const fragment = document.createDocumentFragment();
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

        answersToShow.forEach((result) => {
            const questionCard = document.createElement("div");
            questionCard.className = result.isCorrect ? "answer-card correct" : "answer-card wrong";
            
            const qText = typeof result.question.question === 'object' ? result.question.question[lang] : result.question.question;
            const options = typeof result.question.options === 'object' ? result.question.options[lang] : result.question.options;
            const expText = typeof result.question.explanation === 'object' ? result.question.explanation[lang] : result.question.explanation;
            
            // Resolve actual display letter shown to user during test
            const shuffledOrder = this.optionOrderByQuestionIndex.get(result.questionIndex);
            let userDisplayLetter = '-';
            let correctDisplayLetter = '-';

            if (shuffledOrder) {
                const userPos = shuffledOrder.findIndex(o => o.originalIndex === result.userAnswer);
                const correctPos = shuffledOrder.findIndex(o => o.originalIndex === result.correctAnswer);
                if (userPos !== -1) userDisplayLetter = letters[userPos];
                if (correctPos !== -1) correctDisplayLetter = letters[correctPos];
            } else {
                userDisplayLetter = result.userAnswer !== -1 ? letters[result.userAnswer] : '-';
                correctDisplayLetter = letters[result.correctAnswer];
            }

            const userAnswerText = result.userAnswer !== -1 ? options[result.userAnswer] : '-';
            const correctAnswerText = options[result.correctAnswer];

            questionCard.innerHTML = `
                <div class="answer-card-header">
                    <span class="question-number">${lang === "nl" ? "Vraag" : "Question"} ${result.questionIndex + 1}</span>
                    <span class="category-badge">${this.escapeHtml(result.category)}</span>
                    <span class="status-badge-small ${result.isCorrect ? 'correct' : 'wrong'}">
                        ${result.isCorrect ? (lang === "nl" ? "Juist" : "Correct") : (lang === "nl" ? "Fout" : "Incorrect")}
                    </span>
                </div>
                <div class="answer-card-question">${this.escapeHtml(qText)}</div>
                <div class="answer-card-details">
                    <div class="answer-row ${result.isCorrect ? 'correct' : 'wrong'}">
                        <span class="answer-label">${lang === "nl" ? "Jouw Antwoord:" : "Your Answer:"}</span>
                        <span class="answer-value">${userDisplayLetter}. ${this.escapeHtml(userAnswerText)}</span>
                    </div>
                    <div class="answer-row correct">
                        <span class="answer-label">${lang === "nl" ? "Juiste Antwoord:" : "Correct Answer:"}</span>
                        <span class="answer-value">${correctDisplayLetter}. ${this.escapeHtml(correctAnswerText)}</span>
                    </div>
                </div>
                <div class="answer-card-explanation">
                    <strong>${lang === "nl" ? "Uitleg:" : "Explanation:"}</strong>
                    <span>${this.escapeHtml(expText)}</span>
                </div>
            `;
            
            fragment.appendChild(questionCard);
        });
        
        if (this.answersContainer) this.answersContainer.replaceChildren(fragment);
    }

    escapeHtml(str) {
        if (typeof str !== 'string') return str;
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}