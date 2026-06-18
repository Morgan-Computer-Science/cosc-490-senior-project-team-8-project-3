#!/usr/bin/env python3

import argparse
import os
import signal
import sys
import time


def import_avfoundation():
    try:
        from Foundation import NSURL
        from AVFoundation import (
            AVAudioRecorder,
            AVFormatIDKey,
            AVLinearPCMBitDepthKey,
            AVLinearPCMIsBigEndianKey,
            AVLinearPCMIsFloatKey,
            AVNumberOfChannelsKey,
            AVSampleRateKey,
        )
    except ImportError as exc:
        raise SystemExit(
            "Missing macOS audio dependencies. Run: npm run setup:venv"
        ) from exc

    return {
        "NSURL": NSURL,
        "AVAudioRecorder": AVAudioRecorder,
        "AVFormatIDKey": AVFormatIDKey,
        "AVLinearPCMBitDepthKey": AVLinearPCMBitDepthKey,
        "AVLinearPCMIsBigEndianKey": AVLinearPCMIsBigEndianKey,
        "AVLinearPCMIsFloatKey": AVLinearPCMIsFloatKey,
        "AVNumberOfChannelsKey": AVNumberOfChannelsKey,
        "AVSampleRateKey": AVSampleRateKey,
    }


def create_recorder(output_path):
    av = import_avfoundation()
    url = av["NSURL"].fileURLWithPath_(os.path.abspath(output_path))

    # kAudioFormatLinearPCM as a FourCharCode integer, avoiding another framework dependency.
    linear_pcm = 1819304813
    settings = {
        av["AVFormatIDKey"]: linear_pcm,
        av["AVSampleRateKey"]: 16000.0,
        av["AVNumberOfChannelsKey"]: 1,
        av["AVLinearPCMBitDepthKey"]: 16,
        av["AVLinearPCMIsFloatKey"]: False,
        av["AVLinearPCMIsBigEndianKey"]: False,
    }

    result = av["AVAudioRecorder"].alloc().initWithURL_settings_error_(url, settings, None)
    if isinstance(result, tuple):
        recorder, error = result
    else:
        recorder, error = result, None

    if recorder is None:
        raise RuntimeError(f"Could not create audio recorder: {error}")

    return recorder


def main():
    parser = argparse.ArgumentParser(description="Record microphone audio to a WAV file.")
    parser.add_argument("--output", required=True, help="Output .wav path")
    parser.add_argument("--duration", type=float, default=0, help="Optional duration in seconds")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    recorder = create_recorder(args.output)
    stopped = False

    def stop_recording(_signum=None, _frame=None):
      nonlocal stopped
      stopped = True

    signal.signal(signal.SIGINT, stop_recording)
    signal.signal(signal.SIGTERM, stop_recording)

    if not recorder.prepareToRecord():
        raise RuntimeError("Could not prepare microphone recording")
    if not recorder.record():
        raise RuntimeError("Could not start microphone recording")

    try:
        if args.duration and args.duration > 0:
            deadline = time.time() + args.duration
            while time.time() < deadline and not stopped:
                time.sleep(0.1)
        else:
            while not stopped:
                time.sleep(0.1)
    finally:
        recorder.stop()

    print(args.output)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Recording failed: {exc}", file=sys.stderr)
        sys.exit(1)
