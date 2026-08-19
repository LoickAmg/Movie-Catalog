import { describe, expect, it } from "vitest";
import { createLikesStore, createMemoryStorage } from "../public/js/likes.js";

describe("createLikesStore", () => {
  it("starts with no likes", () => {
    const store = createLikesStore(createMemoryStorage());
    expect(store.getAll().size).toBe(0);
    expect(store.isLiked(1)).toBe(false);
  });

  it("toggle adds a like and returns true", () => {
    const store = createLikesStore(createMemoryStorage());
    const result = store.toggle(42);
    expect(result).toBe(true);
    expect(store.isLiked(42)).toBe(true);
  });

  it("toggling twice removes the like and returns false", () => {
    const store = createLikesStore(createMemoryStorage());
    store.toggle(42);
    const result = store.toggle(42);
    expect(result).toBe(false);
    expect(store.isLiked(42)).toBe(false);
  });

  it("persists likes across store instances sharing the same storage", () => {
    const storage = createMemoryStorage();
    createLikesStore(storage).toggle(7);
    const secondStore = createLikesStore(storage);
    expect(secondStore.isLiked(7)).toBe(true);
  });

  it("clear removes all likes", () => {
    const store = createLikesStore(createMemoryStorage());
    store.toggle(1);
    store.toggle(2);
    store.clear();
    expect(store.getAll().size).toBe(0);
  });

  it("recovers gracefully from corrupted stored JSON", () => {
    const storage = createMemoryStorage();
    storage.setItem("movie-catalog:likes", "{not valid json");
    const store = createLikesStore(storage);
    expect(store.getAll().size).toBe(0);
  });

  it("recovers gracefully when storage throws (e.g. private browsing quota)", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    };
    const store = createLikesStore(throwingStorage);
    expect(() => store.toggle(1)).not.toThrow();
    expect(store.getAll().size).toBe(0);
  });
});
