/* Recorder protocol v1. Output stays silent; input samples never reach speakers. */
class HomeCallRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.used = 0;
    this.total = 0;
    this.sequence = 0;
    this.ready = false;
    this.stopped = false;
    this.limit = Math.floor(sampleRate * 60);
    this.port.onmessage = ({ data }) => {
      if (data.type === "stop") this.stop("requested");
    };
  }
  flush() {
    if (!this.used) return;
    const samples = this.buffer.slice(0, this.used);
    this.port.postMessage(
      { type: "chunk", sequence: this.sequence++, samples },
      [samples.buffer],
    );
    this.used = 0;
  }
  stop(reason) {
    if (this.stopped) return;
    this.stopped = true;
    this.flush();
    this.port.postMessage({ type: "stopped", total: this.total, reason });
  }
  process(inputs) {
    if (this.stopped) return false;
    const input = inputs[0]?.[0];
    if (!input?.length) return true;
    // Silence is valid input. Do not wait for speech or discard the first quantum.
    if (!this.ready) {
      this.ready = true;
      this.port.postMessage({ type: "ready" });
    }
    let offset = 0;
    while (offset < input.length && this.total < this.limit) {
      const count = Math.min(
        input.length - offset,
        this.buffer.length - this.used,
        this.limit - this.total,
      );
      this.buffer.set(input.subarray(offset, offset + count), this.used);
      offset += count;
      this.used += count;
      this.total += count;
      if (this.used === this.buffer.length) this.flush();
    }
    if (this.total === this.limit) this.stop("limit");
    return !this.stopped;
  }
}
registerProcessor("homecall-recorder-v1", HomeCallRecorder);
