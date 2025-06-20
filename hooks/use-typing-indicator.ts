'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTypingIndicatorOptions {
  onTypingChange: (isTyping: boolean) => void;
  debounceMs?: number;
}

export function useTypingIndicator({ onTypingChange, debounceMs = 1000 }: UseTypingIndicatorOptions) {
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastTypingRef = useRef<number>(0);

  const startTyping = useCallback(() => {
    const now = Date.now();
    lastTypingRef.current = now;

    if (!isTyping) {
      setIsTyping(true);
      onTypingChange(true);
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout to stop typing
    timeoutRef.current = setTimeout(() => {
      // Only stop typing if no new typing events occurred
      if (Date.now() - lastTypingRef.current >= debounceMs) {
        setIsTyping(false);
        onTypingChange(false);
      }
    }, debounceMs);
  }, [isTyping, onTypingChange, debounceMs]);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (isTyping) {
      setIsTyping(false);
      onTypingChange(false);
    }
  }, [isTyping, onTypingChange]);

  const handleKeyPress = useCallback(() => {
    startTyping();
  }, [startTyping]);

  const handleInputChange = useCallback((value: string) => {
    if (value.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
  }, [startTyping, stopTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isTyping,
    startTyping,
    stopTyping,
    handleKeyPress,
    handleInputChange,
  };
}