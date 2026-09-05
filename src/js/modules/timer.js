export class ExamTimer {
    constructor(timerElementId) {
        this.timerElem = document.getElementById(timerElementId);
        this.interval = null;
        this.remaining = 0;
    }

    start(seconds, onTick, onExpire) {
        this.stop();
        this.remaining = seconds;
        this.timerElem.classList.remove("warning");
        this.timerElem.innerText = `${this.remaining}s`;

        this.interval = setInterval(() => {
            this.remaining--;
            this.timerElem.innerText = `${this.remaining}s`;

            if (this.remaining <= 5) {
                this.timerElem.classList.add("warning");
            }

            if (onTick) onTick(this.remaining);

            if (this.remaining <= 0) {
                this.stop();
                if (onExpire) onExpire();
            }
        }, 1000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}