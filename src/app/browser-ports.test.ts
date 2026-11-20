// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserAlerts, type AlertsEnv } from './alerts';
import { createBrowserWakeLock } from './wakeLock';

interface FakeOscillator {
  type?: string;
  frequency: { value?: number };
  connected: FakeGain | null;
  startedAt?: number;
  stoppedAt?: number;
  connect(node: FakeGain): void;
  start(t: number): void;
  stop(t: number): void;
}
interface FakeGain {
  gain: { value?: number };
  connected: unknown;
  connect(node: unknown): void;
}

function fakeAudio(options: { resume?: () => Promise<void>; throwOnConstruct?: boolean } = {}) {
  const log = {
    constructions: 0,
    resumes: 0,
    oscillators: [] as FakeOscillator[],
    gains: [] as FakeGain[],
    context: null as FakeContext | null,
  };
  const destination = { name: 'destination' };
  class FakeContext {
    state: 'suspended' | 'running' = 'suspended';
    currentTime = 5;
    destination = destination;
    constructor() {
      if (options.throwOnConstruct) throw new Error('no audio');
      log.constructions += 1;
      log.context = this;
    }
    resume(): Promise<void> {
      log.resumes += 1;
      if (options.resume) return options.resume();
      this.state = 'running';
      return Promise.resolve();
    }
    createOscillator(): FakeOscillator {
      const oscillator: FakeOscillator = {
        frequency: {},
        connected: null,
        connect(node) {
          oscillator.connected = node;
        },
        start(t) {
          oscillator.startedAt = t;
        },
        stop(t) {
          oscillator.stoppedAt = t;
        },
      };
      log.oscillators.push(oscillator);
      return oscillator;
    }
    createGain(): FakeGain {
      const gain: FakeGain = {
        gain: {},
        connected: null,
        connect(node) {
          gain.connected = node;
        },
      };
      log.gains.push(gain);
      return gain;
    }
  }
  return { log, destination, Context: FakeContext as unknown as new () => AudioContext };
}

describe('createBrowserAlerts', () => {
  it('never throws without AudioContext and vibrate', () => {
    const alerts = createBrowserAlerts(() => ({}));
    expect(() => {
      alerts.unlock();
      alerts.restWarning();
      alerts.restEnd();
    }).not.toThrow();
  });

  it('plays tones and vibrates as specified', () => {
    const audio = fakeAudio();
    const vibrate = vi.fn(() => true);
    const alerts = createBrowserAlerts(() => ({ AudioContext: audio.Context, vibrate }));

    alerts.restWarning();
    expect(audio.log.constructions).toBe(0);
    expect(audio.log.oscillators).toHaveLength(0);

    alerts.restEnd();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenLastCalledWith([400, 100, 400]);
    expect(audio.log.constructions).toBe(0);
    expect(audio.log.oscillators).toHaveLength(0);

    alerts.unlock();
    alerts.unlock();
    expect(audio.log.constructions).toBe(1);
    expect(audio.log.resumes).toBe(1);

    alerts.restWarning();
    expect(audio.log.oscillators).toHaveLength(1);
    const [short] = audio.log.oscillators;
    expect(short!.type).toBe('sine');
    expect(short!.frequency.value).toBe(880);
    expect(short!.startedAt).toBe(5);
    expect(short!.stoppedAt).toBe(5.2);
    expect(short!.connected).toBe(audio.log.gains[0]);
    expect(audio.log.gains[0]!.gain.value).toBe(0.3);
    expect(audio.log.gains[0]!.connected).toBe(audio.destination);

    alerts.restEnd();
    expect(audio.log.oscillators).toHaveLength(2);
    expect(audio.log.oscillators[1]!.stoppedAt).toBe(5.8);
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(vibrate).toHaveBeenLastCalledWith([400, 100, 400]);

    audio.log.context!.state = 'suspended';
    alerts.restWarning();
    expect(audio.log.resumes).toBe(2);
    expect(audio.log.oscillators).toHaveLength(2);

    alerts.restWarning();
    expect(audio.log.oscillators).toHaveLength(3);
  });

  it('survives a throwing AudioContext constructor', () => {
    const audio = fakeAudio({ throwOnConstruct: true });
    const alerts = createBrowserAlerts(() => ({ AudioContext: audio.Context }));
    expect(() => {
      alerts.unlock();
      alerts.restWarning();
    }).not.toThrow();
    expect(audio.log.oscillators).toHaveLength(0);
  });

  it('survives a throwing vibrate', () => {
    const env: AlertsEnv = {
      vibrate: () => {
        throw new Error('blocked');
      },
    };
    const alerts = createBrowserAlerts(() => env);
    expect(() => alerts.restEnd()).not.toThrow();
  });

  describe('rejecting resume', () => {
    const unhandled = vi.fn();
    afterEach(() => {
      process.off('unhandledRejection', unhandled);
      unhandled.mockReset();
    });

    it('does not throw and reports no unhandled rejection', async () => {
      process.on('unhandledRejection', unhandled);
      const audio = fakeAudio({ resume: () => Promise.reject(new Error('denied')) });
      const alerts = createBrowserAlerts(() => ({ AudioContext: audio.Context }));
      expect(() => alerts.unlock()).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(unhandled).not.toHaveBeenCalled();
    });
  });
});

describe('createBrowserWakeLock', () => {
  it('resolves null without the API', async () => {
    await expect(createBrowserWakeLock(() => ({})).request()).resolves.toBeNull();
    await expect(createBrowserWakeLock(() => undefined).request()).resolves.toBeNull();
  });

  it('resolves null when the request is rejected', async () => {
    const wakeLock = {
      request: () => Promise.reject(new DOMException('no', 'NotAllowedError')),
    } as unknown as WakeLock;
    await expect(createBrowserWakeLock(() => ({ wakeLock })).request()).resolves.toBeNull();
  });

  it('requests a screen lock and releases the sentinel', async () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ release }));
    const wakeLock = { request } as unknown as WakeLock;
    const handle = await createBrowserWakeLock(() => ({ wakeLock })).request();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');
    await handle!.release();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
