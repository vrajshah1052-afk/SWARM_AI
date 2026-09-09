import { useSyncExternalStore } from "react";
import type { Recording } from "./engine";

let recordings: Recording[] = [];
const listeners = new Set<() => void>();

function emit() {
  recordings = [...recordings];
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRecordings() {
  return recordings;
}

export function addRecording(r: Recording) {
  recordings.unshift(r);
  if (recordings.length > 12) recordings.pop();
  emit();
  return r;
}

export function removeRecording(id: string) {
  recordings = recordings.filter((r) => r.id !== id);
  emit();
}

export function useRecordings() {
  return useSyncExternalStore(subscribe, getRecordings, getRecordings);
}

export function newId() {
  return Math.random().toString(36).slice(2, 9);
}
