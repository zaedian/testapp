export class ExamTimer {
    constructor(timerElementOrId) {
        this.timerElem = typeof timerElementOrId === 'string' 
            ? document.getElementById(timerElementOrId) 
            : timerElementOrId;
        this.interval = null;
        this.remaining = 0;
        this.endTime = 0;
        this.isPaused = false;
        this.pausedRemaining = 0;
    }

    start(seconds, onTick, onExpire, warningThreshold = 5) {
        this.stop();

        if (typeof seconds !== 'number' || seconds <= 0) {
            this.remaining = 0;
            this.render(0, warningThreshold);
            if (onTick) onTick(0);
            if (onExpire) onExpire();
            return;
        }

        this.remaining = seconds;
        this.endTime = Date.now() + seconds * 1000;
        this.isPaused = false;

        this.render(this.remaining, warningThreshold);
        if (onTick) onTick(this.remaining);

        this.interval = setInterval(() => {
            if (this.isPaused) return;

            const now = Date.now();
            const newRemaining = Math.max(0, Math.ceil((this.endTime - now) / 1000));

            if (newRemaining !== this.remaining) {
                this.remaining = newRemaining;
                this.render(this.remaining, warningThreshold);
                if (onTick) onTick(this.remaining);

                if (this.remaining <= 0) {
                    this.stop();
                    if (onExpire) onExpire();
                }
            }
        }, 250);
    }

    render(seconds, warningThreshold) {
        if (!this.timerElem) return;

        if (seconds >= 60) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            this.timerElem.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
        } else {
            this.timerElem.innerText = `${seconds}s`;
        }

        if (seconds <= warningThreshold && seconds > 0) {
            this.timerElem.classList.add("warning");
        } else {
            this.timerElem.classList.remove("warning");
        }
    }

    pause() {
        if (this.interval && !this.isPaused) {
            this.isPaused = true;
            this.pausedRemaining = this.remaining;
        }
    }

    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.endTime = Date.now() + this.pausedRemaining * 1000;
        }
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isPaused = false;
        if (this.timerElem) {
            this.timerElem.classList.remove("warning");
        }
    }
}