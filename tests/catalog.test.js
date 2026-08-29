import { describe, expect, it } from "vitest";
import {
  collectGenres,
  filterByGenre,
  paginate,
  posterColor,
  posterEmoji,
  searchMovies,
  validateMovies,
} from "../public/js/catalog.js";

const MOVIES = [
  { id: 1, title: "The Matrix", genres: ["Action", "Science Fiction"], cast: ["Keanu Reeves"] },
  { id: 2, title: "Notting Hill", genres: ["Romance", "Comedy"], cast: ["Julia Roberts"] },
  { id: 3, title: "Matrix Reloaded", genres: ["Action"], cast: ["Carrie-Anne Moss"] },
];

describe("validateMovies", () => {
  it("accepts the required movie shape", () => {
    expect(validateMovies(MOVIES)).toEqual(MOVIES);
  });

  it("rejects malformed records instead of failing later in the UI", () => {
    expect(() => validateMovies([{ id: 1, title: "", genres: [] }])).toThrow("titre manquant");
    expect(() => validateMovies([{ id: "1", title: "Film", genres: [] }])).toThrow("id manquant");
    expect(() => validateMovies([{ id: 1, title: "Film", genres: [42] }])).toThrow("genres invalides");
  });
});

describe("searchMovies", () => {
  it("matches by title, case-insensitive", () => {
    expect(searchMovies(MOVIES, "matrix")).toHaveLength(2);
    expect(searchMovies(MOVIES, "MATRIX")).toHaveLength(2);
  });

  it("matches by cast member name", () => {
    const result = searchMovies(MOVIES, "julia roberts");
    expect(result).toEqual([MOVIES[1]]);
  });

  it("returns everything for an empty query", () => {
    expect(searchMovies(MOVIES, "")).toEqual(MOVIES);
    expect(searchMovies(MOVIES, "   ")).toEqual(MOVIES);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchMovies(MOVIES, "nonexistent")).toEqual([]);
  });
});

describe("filterByGenre", () => {
  it("keeps only movies containing the given genre", () => {
    expect(filterByGenre(MOVIES, "Action")).toHaveLength(2);
    expect(filterByGenre(MOVIES, "Romance")).toEqual([MOVIES[1]]);
  });

  it("returns everything when no genre is given", () => {
    expect(filterByGenre(MOVIES, null)).toEqual(MOVIES);
    expect(filterByGenre(MOVIES, "")).toEqual(MOVIES);
  });
});

describe("collectGenres", () => {
  it("returns the sorted set of unique genres across all movies", () => {
    expect(collectGenres(MOVIES)).toEqual(["Action", "Comedy", "Romance", "Science Fiction"]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it("slices the correct page", () => {
    const result = paginate(items, 1, 10);
    expect(result.items).toEqual(items.slice(0, 10));
    expect(result.totalPages).toBe(3);
    expect(result.totalItems).toBe(25);
  });

  it("returns the last (partial) page correctly", () => {
    const result = paginate(items, 3, 10);
    expect(result.items).toEqual(items.slice(20, 25));
  });

  it("clamps a page number below 1 up to 1", () => {
    expect(paginate(items, -5, 10).page).toBe(1);
  });

  it("clamps a page number beyond the last page down to the last page", () => {
    const result = paginate(items, 999, 10);
    expect(result.page).toBe(3);
    expect(result.items).toEqual(items.slice(20, 25));
  });

  it("handles an empty list without dividing by zero", () => {
    const result = paginate([], 1, 10);
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(1);
  });
});

describe("posterColor", () => {
  it("is deterministic for the same title", () => {
    expect(posterColor("Inception")).toBe(posterColor("Inception"));
  });

  it("differs for different titles (in general)", () => {
    expect(posterColor("Inception")).not.toBe(posterColor("The Matrix"));
  });

  it("returns a valid hsl() string", () => {
    expect(posterColor("Anything")).toMatch(/^hsl\(\d+, 45%, 28%\)$/);
  });
});

describe("posterEmoji", () => {
  it("returns a genre-specific emoji when recognized", () => {
    expect(posterEmoji(["Horror"])).toBe("👻");
  });

  it("falls back to a generic clapperboard for unknown/empty genres", () => {
    expect(posterEmoji([])).toBe("🎬");
    expect(posterEmoji(["TotallyMadeUpGenre"])).toBe("🎬");
  });
});
