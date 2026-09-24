// A short synthesized click. Off by default; nothing is downloaded.
let context;
let buffer;

export function click(volume = 0.25) {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") context.resume();
    if (!buffer) {
      const length = Math.round(context.sampleRate * 0.014);
      buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800 + Math.random() * 400;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
  } catch {
    // Audio is optional.
  }
}
