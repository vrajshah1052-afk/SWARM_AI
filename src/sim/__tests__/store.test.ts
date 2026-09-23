import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Recording } from "../engine";
import {
  addRecording,
  getRecordings,
  newId,
  removeRecording,
  subscribe,
} from "../store";

function fakeRecording(id?: string): Recording {
  return {
    id: id ?? newId(),
    name: "test",
    createdAt: Date.now(),
    params: {} as Recording["params"],
    frames: [],
    foodSites: [],
    nest: { x: 100, y: 63 },
    history: [],
  };
}

describe("recordings store", () => {
  beforeEach(() => {
    // Wipe anything left over from earlier tests.
    for (const r of getRecordings()) removeRecording(r.id);
  });

  it("addRecording places new items at the front", () => {
    addRecording(fakeRecording("a"));
    addRecording(fakeRecording("b"));
    const [first, second] = getRecordings();
    expect(first?.id).toBe("b");
    expect(second?.id).toBe("a");
  });

  it("caps the store at 12 recordings", () => {
    for (let i = 0; i < 20; i++) addRecording(fakeRecording(`r${i}`));
    expect(getRecordings().length).toBe(12);
  });

  it("removeRecording drops the matching id", () => {
    addRecording(fakeRecording("keep"));
    addRecording(fakeRecording("drop"));
    removeRecording("drop");
    expect(getRecordings().map((r) => r.id)).toEqual(["keep"]);
  });

  it("subscribers are notified on add and remove", () => {
    const fn = vi.fn();
    const unsub = subscribe(fn);
    addRecording(fakeRecording("x"));
    removeRecording("x");
    expect(fn).toHaveBeenCalledTimes(2);
    unsub();
    addRecording(fakeRecording("y"));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("newId produces unique ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId()));
    expect(ids.size).toBe(200);
  });
});
