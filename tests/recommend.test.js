import { describe, expect, it } from "vitest";
import { buildGenreProfile, buildPeopleProfile, recommend, recommendDetailed, scoreMovie, topProfileGenres } from "../public/js/recommend.js";

const MOVIES = [
  { id: 1, title: "Liked Action 1", year: 2020, genres: ["Action", "Thriller"] },
  { id: 2, title: "Liked Comedy", year: 2019, genres: ["Comedy"] },
  { id: 3, title: "Similar Action", year: 2021, genres: ["Action"] },
  { id: 4, title: "Also Action+Thriller", year: 2018, genres: ["Action", "Thriller"] },
  { id: 5, title: "Unrelated Documentary", year: 2022, genres: ["Documentary"] },
  { id: 6, title: "Newer Similar Action", year: 2022, genres: ["Action"] },
];

describe("buildGenreProfile", () => {
  it("counts genre occurrences across the liked movies", () => {
    const profile = buildGenreProfile([MOVIES[0], MOVIES[1]]);
    expect(profile).toEqual({ Action: 1, Thriller: 1, Comedy: 1 });
  });

  it("returns an empty profile for no liked movies", () => {
    expect(buildGenreProfile([])).toEqual({});
  });
});

describe("scoreMovie", () => {
  it("sums the profile weight of each of the movie's genres", () => {
    const profile = { Action: 3, Thriller: 1 };
    expect(scoreMovie({ genres: ["Action", "Thriller"] }, profile)).toBe(4);
  });

  it("is 0 when none of the movie's genres are in the profile", () => {
    expect(scoreMovie({ genres: ["Horror"] }, { Action: 3 })).toBe(0);
  });
});

describe("recommend", () => {
  it("returns an empty list when nothing is liked", () => {
    expect(recommend(MOVIES, [])).toEqual([]);
  });

  it("never recommends an already-liked movie", () => {
    const results = recommend(MOVIES, [1, 4]);
    expect(results.some((m) => m.id === 1 || m.id === 4)).toBe(false);
  });

  it("ranks movies matching more liked genres higher", () => {
    // Liker un film Action+Thriller doit faire remonter les films
    // Action+Thriller candidats devant les films juste "Action" seul.
    const results = recommend(MOVIES, [1]);
    const ids = results.map((m) => m.id);
    expect(ids.indexOf(4)).toBeLessThan(ids.indexOf(3));
  });

  it("excludes movies with zero genre overlap with the liked profile", () => {
    const results = recommend(MOVIES, [1]);
    expect(results.some((m) => m.id === 5)).toBe(false);
  });

  it("breaks score ties by preferring the more recent movie", () => {
    const results = recommend(MOVIES, [1]);
    const ids = results.filter((m) => m.genres.includes("Action") && !m.genres.includes("Thriller"))
      .map((m) => m.id);
    // 6 (2022) doit passer avant 3 (2021) à score de genre égal.
    expect(ids.indexOf(6)).toBeLessThan(ids.indexOf(3));
  });

  it("respects the topN limit", () => {
    const results = recommend(MOVIES, [1], 1);
    expect(results).toHaveLength(1);
  });
});

describe("topProfileGenres", () => {
  it("returns the most represented genres, most first", () => {
    const profile = { Action: 5, Comedy: 2, Drama: 8 };
    expect(topProfileGenres(profile, 2)).toEqual(["Drama", "Action"]);
  });

  it("returns an empty list for an empty profile", () => {
    expect(topProfileGenres({})).toEqual([]);
  });
});


describe("people profiles", () => {
  it("counts directors and actors case-insensitively", () => {
    const profile = buildPeopleProfile([
      { director: "Ava DuVernay", cast: ["Actor One", "Actor Two"] },
      { directors: ["ava duvernay"], cast: ["Actor Two"] },
    ]);
    expect(profile.directors.get("ava duvernay").count).toBe(2);
    expect(profile.actors.get("actor two").count).toBe(2);
  });
});

describe("recommendDetailed", () => {
  it("returns an explanation for each recommended title", () => {
    const mixed = [
      { id: 1, title: "Liked film", media_type: "movie", year: 2020, genres: ["Action"], director: "Ava DuVernay", cast: ["Actor One"] },
      { id: 2, title: "Liked series", media_type: "tv", year: 2021, genres: ["Drama"], directors: ["Other Director"], cast: ["Actor Two"] },
      { id: 3, title: "Suggested series", media_type: "tv", year: 2023, genres: ["Drama"], directors: ["Ava DuVernay"], cast: ["Actor Three"] },
      { id: 4, title: "Suggested actor film", media_type: "movie", year: 2022, genres: ["Comedy"], cast: ["Actor Two"] },
    ];
    const result = recommendDetailed(mixed, [1, 2], 5);
    expect(result).toHaveLength(2);
    expect(result[0].movie.id).toBe(3);
    expect(result[0].matchedDirectors).toEqual(["Ava DuVernay"]);
    expect(result[0].matchedActors).toEqual([]);
    expect(result[1].matchedActors).toEqual(["Actor Two"]);
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });
});
