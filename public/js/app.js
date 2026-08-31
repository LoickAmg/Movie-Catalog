/**
 * Pont DOM du catalogue : chargement, recherche, filtres, pagination,
 * favoris et recommandations. La logique métier reste dans des modules purs.
 */

import {
  collectGenres,
  collectYears,
  filterByGenre,
  filterByType,
  filterByYear,
  mediaLabel,
  mediaTypeOf,
  paginate,
  posterColor,
  posterFallback,
  searchMovies,
  sortCatalog,
  validateMovies,
} from "./catalog.js";
import { buildGenreProfile, recommendDetailed, topProfileGenres } from "./recommend.js";
import { createLikesStore } from "./likes.js";

const PAGE_SIZE = 24;
const RECOMMEND_COUNT = 12;

const likesStore = createLikesStore(window.localStorage);

let allMovies = [];
let moviesById = new Map();

const state = {
  view: "catalog",
  query: "",
  type: "",
  genre: "",
  year: "",
  sort: "recent",
  page: 1,
};

const els = {
  tabs: document.getElementById("tabs"),
  searchInput: document.getElementById("search-input"),
  typeSelect: document.getElementById("type-select"),
  genreSelect: document.getElementById("genre-select"),
  yearSelect: document.getElementById("year-select"),
  sortSelect: document.getElementById("sort-select"),
  catalogStatus: document.getElementById("catalog-status"),
  catalogGrid: document.getElementById("catalog-grid"),
  catalogEmpty: document.getElementById("catalog-empty"),
  prevPage: document.getElementById("prev-page"),
  nextPage: document.getElementById("next-page"),
  pageIndicator: document.getElementById("page-indicator"),
  favoritesCount: document.getElementById("favorites-count"),
  favoritesStatus: document.getElementById("favorites-status"),
  favoritesGrid: document.getElementById("favorites-grid"),
  favoritesEmpty: document.getElementById("favorites-empty"),
  recommendExplanation: document.getElementById("recommend-explanation"),
  recommendGrid: document.getElementById("recommend-grid"),
  recommendEmpty: document.getElementById("recommend-empty"),
  overlay: document.getElementById("detail-overlay"),
  detailCard: document.getElementById("detail-card"),
};

function syncLikeButton(btn, id) {
  const liked = likesStore.isLiked(id);
  btn.classList.toggle("liked", liked);
  btn.setAttribute("aria-label", liked ? "Retirer de ma liste" : "Ajouter à ma liste");
  btn.textContent = liked ? "Dans ma liste" : "Ajouter";
}

function toggleLike(id) {
  likesStore.toggle(id);
  refreshLikeUI();
}

function refreshLikeUI() {
  document.querySelectorAll(".like-btn[data-like-id]").forEach((btn) => {
    syncLikeButton(btn, Number(btn.dataset.likeId));
  });
  els.favoritesCount.textContent = String(likesStore.getAll().size);
  if (state.view === "favorites") renderFavorites();
  if (state.view === "recommend") renderRecommend();
}

function createCardElement(movie) {
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.dataset.id = String(movie.id);
  card.dataset.type = mediaTypeOf(movie);

  const likeBtn = document.createElement("button");
  likeBtn.type = "button";
  likeBtn.className = "like-btn";
  likeBtn.dataset.likeId = String(movie.id);
  syncLikeButton(likeBtn, movie.id);
  likeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleLike(movie.id);
  });

  const poster = document.createElement("div");
  poster.className = "card-poster";
  poster.style.backgroundColor = posterColor(movie.title);

  if (movie.thumbnail) {
    const img = document.createElement("img");
    img.src = movie.thumbnail;
    img.alt = `Affiche de ${movie.title}`;
    img.loading = "lazy";
    img.addEventListener("error", () => {
      img.remove();
      poster.classList.add("fallback-poster");
      poster.textContent = posterFallback(movie.title, mediaTypeOf(movie));
    });
    poster.appendChild(img);
  } else {
    poster.classList.add("fallback-poster");
    poster.textContent = posterFallback(movie.title, mediaTypeOf(movie));
  }

  const body = document.createElement("div");
  body.className = "card-body";

  const type = document.createElement("span");
  type.className = "card-type";
  type.textContent = mediaLabel(movie);

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = movie.title;

  const metadata = document.createElement("p");
  metadata.className = "card-meta";
  const year = movie.year ? String(movie.year) : "Année inconnue";
  const rating = typeof movie.rating === "number" ? ` · ${movie.rating.toFixed(1)}/10` : "";
  metadata.textContent = `${year}${rating}`;

  body.append(type, title, metadata);
  card.append(likeBtn, poster, body);
  card.addEventListener("click", () => openDetail(movie.id));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetail(movie.id);
    }
  });

  return card;
}

function renderGrid(container, movies, explanations = new Map()) {
  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const movie of movies) {
    const card = createCardElement(movie);
    const explanation = explanations.get(movie.id);
    if (explanation) {
      const reason = document.createElement("p");
      reason.className = "recommendation-reason";
      const reasons = [];
      if (explanation.matchedGenres.length) reasons.push(`genres : ${explanation.matchedGenres.join(", ")}`);
      if (explanation.matchedDirectors?.length) reasons.push(`réalisateur${explanation.matchedDirectors.length > 1 ? "s" : ""} : ${explanation.matchedDirectors.join(", ")}`);
      if (explanation.matchedActors?.length) reasons.push(`acteur${explanation.matchedActors.length > 1 ? "s" : ""} : ${explanation.matchedActors.join(", ")}`);
      reason.textContent = `Parce que vous avez aimé — ${reasons.join(" · ")}`;
      card.appendChild(reason);
    }
    fragment.appendChild(card);
  }
  container.appendChild(fragment);
}

function getFilteredCatalog() {
  let movies = searchMovies(allMovies, state.query);
  movies = filterByType(movies, state.type);
  movies = filterByGenre(movies, state.genre);
  movies = filterByYear(movies, state.year);
  return sortCatalog(movies, state.sort);
}

function renderCatalog() {
  const filtered = getFilteredCatalog();
  const { items, page, totalPages, totalItems } = paginate(filtered, state.page, PAGE_SIZE);
  state.page = page;
  renderGrid(els.catalogGrid, items);
  els.catalogEmpty.classList.toggle("hidden", totalItems !== 0);
  const noun = state.type === "movie" ? "film" : state.type === "tv" ? "série" : "titre";
  els.catalogStatus.textContent = `${totalItems.toLocaleString("fr-FR")} ${noun}${totalItems > 1 ? "s" : ""} dans cette sélection.`;
  els.pageIndicator.textContent = `Page ${page} / ${totalPages}`;
  els.prevPage.disabled = page <= 1;
  els.nextPage.disabled = page >= totalPages;
}

function renderFavorites() {
  const likedIds = likesStore.getAll();
  const liked = allMovies.filter((movie) => likedIds.has(movie.id));
  renderGrid(els.favoritesGrid, liked);
  els.favoritesEmpty.classList.toggle("hidden", liked.length !== 0);
  els.favoritesStatus.textContent = liked.length === 0
    ? ""
    : `${liked.length} titre${liked.length > 1 ? "s" : ""} dans votre liste.`;
}

function renderRecommend() {
  const likedIds = Array.from(likesStore.getAll());
  const likedMovies = allMovies.filter((movie) => likedIds.includes(movie.id));
  const hasLikes = likedMovies.length > 0;
  els.recommendEmpty.classList.toggle("hidden", hasLikes);

  if (!hasLikes) {
    els.recommendExplanation.textContent = "";
    renderGrid(els.recommendGrid, []);
    return;
  }

  const profile = buildGenreProfile(likedMovies);
  const topGenres = topProfileGenres(profile, 3);
  const detailed = recommendDetailed(allMovies, likedIds, RECOMMEND_COUNT);
  const results = detailed.map((entry) => entry.movie);
  const explanations = new Map(detailed.map((entry) => [entry.movie.id, entry]));
  els.recommendExplanation.textContent = results.length === 0
    ? "Le catalogue ne contient pas encore assez de titres proches pour affiner la sélection."
    : `Sélection basée sur vos genres favoris : ${topGenres.join(", ")}.`;
  renderGrid(els.recommendGrid, results, explanations);
}

function appendDetailText(parent, label, value, className = "detail-line") {
  if (!value) return;
  const line = document.createElement("p");
  line.className = className;
  const strong = document.createElement("strong");
  strong.textContent = `${label} : `;
  line.append(strong, document.createTextNode(value));
  parent.appendChild(line);
}

function openDetail(id) {
  const movie = moviesById.get(id);
  if (!movie) return;

  els.detailCard.innerHTML = "";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "close-btn";
  closeBtn.textContent = "Fermer";
  closeBtn.addEventListener("click", closeDetail);
  els.detailCard.appendChild(closeBtn);

  if (movie.thumbnail) {
    const img = document.createElement("img");
    img.src = movie.thumbnail;
    img.alt = `Affiche de ${movie.title}`;
    img.addEventListener("error", () => img.remove());
    els.detailCard.appendChild(img);
  }

  const title = document.createElement("h2");
  title.id = "detail-title";
  title.textContent = movie.title;
  els.detailCard.appendChild(title);
  appendDetailText(els.detailCard, "Format", mediaLabel(movie));
  appendDetailText(els.detailCard, "Année", movie.year ? String(movie.year) : "Non renseignée");
  appendDetailText(els.detailCard, "Note", typeof movie.rating === "number" ? `${movie.rating.toFixed(1)}/10` : "Non renseignée");

  const tags = document.createElement("div");
  tags.className = "genre-tags";
  for (const genre of movie.genres) {
    const tag = document.createElement("span");
    tag.className = "genre-tag";
    tag.textContent = genre;
    tags.appendChild(tag);
  }
  els.detailCard.appendChild(tags);

  appendDetailText(els.detailCard, "Synopsis", movie.extract || movie.overview || "Pas de synopsis disponible.", "detail-overview");
  if (movie.cast?.length) appendDetailText(els.detailCard, "Avec", movie.cast.join(", "));
  if (movie.networks?.length) appendDetailText(els.detailCard, "Diffuseur", movie.networks.join(", "));
  if (movie.seasons) appendDetailText(els.detailCard, "Saisons", String(movie.seasons));
  if (movie.episodes) appendDetailText(els.detailCard, "Épisodes", String(movie.episodes));

  const likeBtn = document.createElement("button");
  likeBtn.type = "button";
  likeBtn.className = "like-btn detail-like";
  likeBtn.dataset.likeId = String(movie.id);
  syncLikeButton(likeBtn, movie.id);
  likeBtn.addEventListener("click", () => toggleLike(movie.id));
  els.detailCard.appendChild(likeBtn);

  if (movie.wiki || movie.homepage) {
    const source = document.createElement("a");
    source.href = movie.homepage || movie.wiki;
    source.target = "_blank";
    source.rel = "noopener";
    source.className = "wiki-link";
    source.textContent = "Voir la fiche source";
    els.detailCard.appendChild(source);
  }

  els.overlay.classList.remove("hidden");
  closeBtn.focus();
}

function closeDetail() {
  els.overlay.classList.add("hidden");
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("hidden", section.id !== `view-${view}`);
  });
  if (view === "favorites") renderFavorites();
  if (view === "recommend") renderRecommend();
}

function resetPageAndRender() {
  state.page = 1;
  renderCatalog();
}

function wireEvents() {
  els.tabs.addEventListener("click", (event) => {
    const btn = event.target.closest(".tab");
    if (btn) setView(btn.dataset.view);
  });
  els.searchInput.addEventListener("input", () => {
    state.query = els.searchInput.value;
    resetPageAndRender();
  });
  els.typeSelect.addEventListener("change", () => {
    state.type = els.typeSelect.value;
    resetPageAndRender();
  });
  els.genreSelect.addEventListener("change", () => {
    state.genre = els.genreSelect.value;
    resetPageAndRender();
  });
  els.yearSelect.addEventListener("change", () => {
    state.year = els.yearSelect.value;
    resetPageAndRender();
  });
  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    resetPageAndRender();
  });
  els.prevPage.addEventListener("click", () => {
    state.page -= 1;
    renderCatalog();
  });
  els.nextPage.addEventListener("click", () => {
    state.page += 1;
    renderCatalog();
  });
  els.overlay.addEventListener("click", (event) => {
    if (event.target === els.overlay) closeDetail();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetail();
  });
}

function fillSelect(select, values, labelFor = (value) => value) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = labelFor(value);
    select.appendChild(option);
  }
}

async function fetchCatalog() {
  const sources = ["./data/catalog.json", "./data/movies.json"];
  for (const source of sources) {
    const response = await fetch(source);
    if (response.ok) return { source, data: await response.json() };
  }
  throw new Error("Aucun catalogue local disponible");
}

async function init() {
  wireEvents();
  els.catalogStatus.textContent = "Chargement du catalogue…";
  try {
    const { source, data } = await fetchCatalog();
    allMovies = validateMovies(data);
    document.body.dataset.catalogSource = source.includes("catalog") ? "curated" : "legacy";
  } catch (error) {
    els.catalogStatus.textContent = "Impossible de charger le catalogue local. Consultez la documentation de mise à jour.";
    console.error(error);
    return;
  }

  moviesById = new Map(allMovies.map((movie) => [movie.id, movie]));
  fillSelect(els.genreSelect, collectGenres(allMovies));
  fillSelect(els.yearSelect, collectYears(allMovies));
  els.favoritesCount.textContent = String(likesStore.getAll().size);
  renderCatalog();
}

init();
