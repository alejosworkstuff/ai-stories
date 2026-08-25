export class SseParser {
    buffer = "";
    dataLines = [];
    eventName;
    eventId;
    retry;
    feed(chunk) {
        this.buffer += chunk;
        const events = [];
        while (true) {
            const lineEnd = this.findLineEnd();
            if (!lineEnd)
                break;
            const line = this.buffer.slice(0, lineEnd.index);
            this.buffer = this.buffer.slice(lineEnd.nextIndex);
            this.consumeLine(line, events);
        }
        return events;
    }
    flush() {
        const events = [];
        if (this.buffer.length > 0) {
            this.consumeLine(this.buffer, events);
            this.buffer = "";
        }
        this.dispatch(events);
        return events;
    }
    findLineEnd() {
        const lineFeed = this.buffer.indexOf("\n");
        const carriageReturn = this.buffer.indexOf("\r");
        const index = [lineFeed, carriageReturn]
            .filter((position) => position >= 0)
            .sort((left, right) => left - right)[0];
        if (index === undefined)
            return undefined;
        if (this.buffer[index] === "\r" && index === this.buffer.length - 1) {
            return undefined;
        }
        const isCrLf = this.buffer[index] === "\r" && this.buffer[index + 1] === "\n";
        return { index, nextIndex: index + (isCrLf ? 2 : 1) };
    }
    consumeLine(line, events) {
        if (line === "") {
            this.dispatch(events);
            return;
        }
        if (line.startsWith(":"))
            return;
        const separator = line.indexOf(":");
        const field = separator === -1 ? line : line.slice(0, separator);
        const valueStart = separator === -1 ? line.length : separator + 1;
        const rawValue = line.slice(valueStart);
        const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
        switch (field) {
            case "data":
                this.dataLines.push(value);
                break;
            case "event":
                this.eventName = value;
                break;
            case "id":
                if (!value.includes("\0"))
                    this.eventId = value;
                break;
            case "retry":
                if (/^\d+$/.test(value))
                    this.retry = Number(value);
                break;
            default:
                break;
        }
    }
    dispatch(events) {
        if (this.dataLines.length === 0 && this.eventName === undefined && this.eventId === undefined && this.retry === undefined) {
            return;
        }
        const event = {};
        if (this.dataLines.length > 0)
            event.data = this.dataLines.join("\n");
        if (this.eventName !== undefined)
            event.event = this.eventName;
        if (this.eventId !== undefined)
            event.id = this.eventId;
        if (this.retry !== undefined)
            event.retry = this.retry;
        events.push(event);
        this.dataLines = [];
        this.eventName = undefined;
        this.eventId = undefined;
        this.retry = undefined;
    }
}
