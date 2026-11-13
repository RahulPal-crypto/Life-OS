import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { connectMediaNative, formatDuration } from '../services/connectMediaNative';

interface VoiceNotePlayerProps {
  mediaUrl: string;
  duration?: number | null;
  isOutgoing: boolean;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  mediaUrl,
  duration = 0,
  isOutgoing,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalDuration = duration && duration > 0 ? duration : 5;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (isPlaying) {
        connectMediaNative.stopAudio();
      }
    };
  }, [isPlaying]);

  const handleTogglePlay = async () => {
    try {
      if (isPlaying) {
        await connectMediaNative.stopAudio();
        setIsPlaying(false);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        await connectMediaNative.playAudio(mediaUrl);
        await connectMediaNative.setAudioSpeed(speed);
        setIsPlaying(true);

        const startTime = Date.now() - playbackSeconds * (1000 / speed);
        timerRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000 * speed;
          if (elapsed >= totalDuration) {
            setIsPlaying(false);
            setPlaybackSeconds(0);
            if (timerRef.current) clearInterval(timerRef.current);
          } else {
            setPlaybackSeconds(Math.floor(elapsed));
          }
        }, 300);
      }
    } catch {
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleToggleSpeed = async () => {
    const nextSpeed: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (isPlaying) {
      await connectMediaNative.setAudioSpeed(nextSpeed);
    }
  };

  // 16 stylized waveform bar heights
  const waveformHeights = [8, 14, 20, 12, 18, 24, 16, 22, 12, 18, 24, 15, 10, 16, 20, 8];
  const progressRatio = Math.min(Math.max(playbackSeconds / totalDuration, 0), 1);
  const activeBarIndex = Math.floor(progressRatio * waveformHeights.length);

  return (
    <View style={[styles.container, isOutgoing ? styles.outgoingBg : styles.incomingBg]}>
      {/* Play/Pause Button */}
      <TouchableOpacity
        style={[styles.playButton, isOutgoing ? styles.playButtonOut : styles.playButtonIn]}
        onPress={handleTogglePlay}
        activeOpacity={0.8}
      >
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
      </TouchableOpacity>

      {/* Waveform Scrubber & Timer */}
      <View style={styles.waveformWrapper}>
        <View style={styles.barsRow}>
          {waveformHeights.map((h, index) => {
            const isFilled = index <= activeBarIndex;
            return (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  { height: h },
                  isFilled
                    ? (isOutgoing ? styles.barFilledOut : styles.barFilledIn)
                    : (isOutgoing ? styles.barEmptyOut : styles.barEmptyIn),
                ]}
              />
            );
          })}
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.timerText, isOutgoing ? styles.textOut : styles.textIn]}>
            {isPlaying ? formatDuration(playbackSeconds) : formatDuration(totalDuration)}
          </Text>
          <Text style={[styles.micIcon, isOutgoing ? styles.textOut : styles.textIn]}>
            🎤 Voice Note
          </Text>
        </View>
      </View>

      {/* Speed Pill (1x, 1.5x, 2x) */}
      <TouchableOpacity
        style={[styles.speedBadge, isOutgoing ? styles.speedBadgeOut : styles.speedBadgeIn]}
        onPress={handleToggleSpeed}
        activeOpacity={0.7}
      >
        <Text style={[styles.speedText, isOutgoing ? styles.speedTextOut : styles.speedTextIn]}>
          {speed}x
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    minWidth: 220,
    maxWidth: 270,
  },
  outgoingBg: {
    backgroundColor: 'transparent',
  },
  incomingBg: {
    backgroundColor: 'transparent',
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  playButtonOut: {
    backgroundColor: '#FFFFFF',
  },
  playButtonIn: {
    backgroundColor: '#7C3AED',
  },
  playIcon: {
    fontSize: 16,
    color: '#6D28D9',
    marginLeft: 2,
  },
  waveformWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 3,
    height: 26,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },
  barFilledOut: {
    backgroundColor: '#EDE9FE',
  },
  barEmptyOut: {
    backgroundColor: 'rgba(237, 233, 254, 0.35)',
  },
  barFilledIn: {
    backgroundColor: '#7C3AED',
  },
  barEmptyIn: {
    backgroundColor: '#D1D5DB',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  micIcon: {
    fontSize: 11,
    fontWeight: '500',
  },
  textOut: {
    color: '#EDE9FE',
  },
  textIn: {
    color: '#6B7280',
  },
  speedBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  speedBadgeOut: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  speedBadgeIn: {
    backgroundColor: '#EDE9FE',
  },
  speedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  speedTextOut: {
    color: '#FFFFFF',
  },
  speedTextIn: {
    color: '#6D28D9',
  },
});
