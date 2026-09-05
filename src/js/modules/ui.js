export class UIRenderer {
    constructor() {
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

        this.currentLang = "nl";
    }

    setLanguage(lang) {
        this.currentLang = lang;
        const isDutch = lang === "nl";
        this.langIcon.textContent = isDutch ? "🇳🇱" : "🇬🇧";
        this.langText.textContent = isDutch ? "NL" : "EN";
    }

    updateUIText(translations) {
        if (!translations) return;

        // 1. Update text elements with data-i18n attribute
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.dataset.i18n;
            let text = this.getNestedTranslation(translations, key);
            
            // Handle data-i18n-args for placeholder replacement
            if (text && el.dataset.i18nArgs) {
                try {
                    const args = JSON.parse(el.dataset.i18nArgs);
                    text = text.replace(/{(\w+)}/g, (match, param) => args[param] || match);
                } catch (e) {
                    console.warn('Failed to parse i18n args:', e);
                }
            }
            
            if (text) {
                el.textContent = text;
            }
        });

        // 2. Update input placeholder attributes (data-i18n-placeholder)
        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            const text = this.getNestedTranslation(translations, key);
            if (text) {
                el.placeholder = text;
            }
        });

        // Explicit fallback for input placeholders by ID
        const customInput = document.getElementById("custom-question-count");
        if (customInput && translations.menu?.customPlaceholder) {
            customInput.placeholder = translations.menu.customPlaceholder;
        }

        const timeLimitInput = document.getElementById("time-limit-override");
        if (timeLimitInput && translations.menu?.timeLimitPlaceholder) {
            timeLimitInput.placeholder = translations.menu.timeLimitPlaceholder;
        }

        // 3. Update mode buttons text
        document.querySelectorAll(".btn-mode").forEach(btn => {
            const count = btn.dataset.questions;
            btn.textContent = `${count} ${this.currentLang === "nl" ? "Vragen" : "Questions"}`;
        });
    }

    getNestedTranslation(obj, path) {
        return path.split('.').reduce((o, p) => o && o[p], obj);
    }

    setTheme(theme) {
        const isLight = theme === "light";
        if (isLight) {
            document.documentElement.setAttribute("data-theme", "light");
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
        
        // textContent avoids forced layout recalculation triggered by innerText
        this.themeIcon.textContent = isLight ? "🌙" : "☀️";
        this.themeText.textContent = isLight 
            ? (this.currentLang === "nl" ? "Lichte Modus" : "Light Mode")
            : (this.currentLang === "nl" ? "Donkere Modus" : "Dark Mode");
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
        this.progressBar.style.width = `${(currentIndex / totalQuestions) * 100}%`;
        this.currentNum.textContent = currentIndex + 1;
        this.totalNum.textContent = totalQuestions;
        this.categoryBadge.textContent = question.category;
        
        const lang = this.currentLang;
        const scenario = typeof question.scenario === 'object' ? question.scenario[lang] : question.scenario;
        const questionText = typeof question.question === 'object' ? question.question[lang] : question.question;
        const options = typeof question.options === 'object' ? question.options[lang] : question.options;
        
        this.scenarioText.textContent = scenario;
        this.questionText.textContent = questionText;

        this.explanationBox.style.display = "none";
        this.nextBtn.disabled = true;
        
        const finishText = lang === "nl" ? "Examen Beëindigen" : "Finish Exam";
        const nextText = lang === "nl" ? "Volgende Vraag" : "Next Question";
        this.nextBtn.textContent = (currentIndex === totalQuestions - 1) ? finishText : nextText;

        const fragment = document.createDocumentFragment();
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        options.forEach((opt, idx) => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = opt;
            btn.dataset.index = idx;
            btn.dataset.letter = letters[idx] || String.fromCharCode(65 + idx);
            fragment.appendChild(btn);
        });

        this.optionsContainer.replaceChildren(fragment);

        this.optionsContainer.onclick = (e) => {
            const btn = e.target.closest(".option-btn");
            if (btn && !btn.disabled) {
                onSelectOption(Number(btn.dataset.index));
            }
        };
    }

    showAnswerFeedback(selectedIndex, correctIndex, explanation, isTimeout = false) {
        const btns = this.optionsContainer.children;
        for (let idx = 0; idx < btns.length; idx++) {
            const btn = btns[idx];
            btn.disabled = true;
            if (idx === correctIndex) {
                btn.classList.add("correct");
            }
            if (idx === selectedIndex && selectedIndex !== correctIndex) {
                btn.classList.add("incorrect");
            }
        }

        this.explanationBox.replaceChildren();
        
        if (isTimeout) {
            const timeoutSpan = document.createElement("strong");
            timeoutSpan.className = "text-danger";
            timeoutSpan.textContent = this.currentLang === "nl" ? "Tijd Om! " : "Time's Up! ";
            this.explanationBox.appendChild(timeoutSpan);
        }

        const explanationText = typeof explanation === 'object' ? explanation[this.currentLang] : explanation;
        
        const expLabel = document.createElement("strong");
        expLabel.textContent = this.currentLang === "nl" ? "Uitleg: " : "Explanation: ";
        
        this.explanationBox.append(expLabel, explanationText);
        this.explanationBox.style.display = "block";
        this.nextBtn.disabled = false;
    }

    renderResults({ breakdown, overallPassed }) {
        this.progressBar.style.width = "100%";
        
        const fragment = document.createDocumentFragment();
        const lang = this.currentLang;

        for (const [cat, data] of Object.entries(breakdown)) {
            const categoryPassed = data.correct >= data.passLimit;
            const row = document.createElement("tr");

            const statusText = categoryPassed ? (lang === "nl" ? "GESLAAGD" : "PASSED") : (lang === "nl" ? "GEZAKT" : "FAILED");

            row.innerHTML = `
                <td><strong>${cat}</strong></td>
                <td>${data.correct} / ${data.total}</td>
                <td>Min. ${data.passLimit}</td>
                <td class="${categoryPassed ? 'text-success' : 'text-danger'}">
                    ${statusText}
                </td>
            `;
            fragment.appendChild(row);
        }

        this.breakdownBody.replaceChildren(fragment);

        const isPassed = Boolean(overallPassed);
        const passedText = lang === "nl" ? "GESLAAGD" : "PASSED";
        const failedText = lang === "nl" ? "GEZAKT" : "FAILED";
        this.statusBadge.textContent = isPassed ? passedText : failedText;
        this.statusBadge.className = `status-badge ${isPassed ? 'pass' : 'fail'}`;
    }
}