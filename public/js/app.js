/**
 * Câblage DOM : charge le catalogue, orchestre recherche/filtre/pagination,
 * les likes (persistés en localStorage) et les recommandations. Toute la
 * logique testable (recherche, tri, score, stockage) vit dans catalog.js /
 * recommend.js / likes.js — ce fichier ne fait que le pont avec le DOM.
 */

import {
  collectGenres,
  filterByGenre,
  paginate,
  posterColor,
  posterEmoji,
  searchMovies,
  validateMovies,
} from "./catalog.js";
import { buildGenreProfile, recommend, topProfileGenres } from "./recommend.js";
import { createLikesStore } from "./likes.js";

const PAGE_SIZE = 24;
const RECOMMEND_COUNT = 12;

const likesStore = createLikesStore(window.localStorage);

let allMovies = [];
let moviesById = new Map();

const state = {
  view: "catalog",
  query: "",
  genre: "",
  page: 1,
};

const els = {
  tabs: document.getElementById("tabs"),
  searchInput: document.getElementById("search-input"),
  genreSelect: document.getElementById("genre-select"),
  catalogStatus: document.getElementById("catalog-status"),
  catalogGrid: document.getElementById("catalog-grid"),
  prevPage: document.getElementById("prev-page"),
  nextPage: document.getElementById("next-page"),
  pageIndicator: document.getElementById("page-indicator"),
  favoritesCount: document.getElementById("favorites-count"),
  favoritesStatus: document.getElementById("favorites-status"),
  favoritesGrid: document.getElementById("favorites-grid"),
  recommendExplanation: document.getElementById("recommend-explanation"),
  recommendGrid: document.getElementById("recommend-grid"),
  overlay: document.getElementById("detail-overlay"),
  detailCard: document.getElementById("detail-card"),
};

function syncLikeButton(btn, id) {
  const liked = likesStore.isLiked(id);
  btn.classList.toggle("liked", liked);
  btn.setAttribute("aria-label", liked ? "Retirer des favoris" : "Ajouter aux favoris");
  btn.textContent =
    btn.dataset.withLabel === "true"
      ? liked
        ? "❤️ Dans mes favoris"
        : "🤍 Ajouter aux favoris"
      : liked
        ? "❤"
        : "🤍";
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
    img.alt = "";
    img.loading = "lazy";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.addEventListener("error", () => {
      img.remove();
      poster.textContent = posterEmoji(movie.genres);
    });
    poster.appendChild(img);
  } else {
    poster.textContent = posterEmoji(movie.genres);
  }

  const body = document.createElement("div");
  body.className = "card-body";
  const title = document.createElement("p");
  title.className = "card-title";
  title.textContent = movie.title;
  const year = document.createElement("p");
  year.className = "card-year";
  year.textContent = String(movie.year);
  body.append(title, year);

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

function renderGrid(container, movies) {
  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const movie of movies) {
    fragment.appendChild(createCardElement(movie));
  }
  container.appendChild(fragment);
}

function getFilteredCatalog() {
  let movies = searchMovies(allMovies, state.query);
  movies = filterByGenre(movies, state.genre);
  return movies;
}

function renderCatalog() {
  const filtered = getFilteredCatalog();
  const { items, page, totalPages, totalItems } = paginate(filtered, state.page, PAGE_SIZE);
  state.page = page;
  renderGrid(els.catalogGrid, items);
  els.catalogStatus.textContent =
    totalItems === 0
      ? "Aucun film ne correspond à ta recherche."
      : `${totalItems} film${totalItems > 1 ? "s" : ""} trouvé${totalItems > 1 ? "s" : ""}.`;
  els.pageIndicator.textContent = `Page ${page} / ${totalPages}`;
  els.prevPage.disabled = page <= 1;
  els.nextPage.disabled = page >= totalPages;
}

function renderFavorites() {
  const likedIds = likesStore.getAll();
  const liked = allMovies.filter((movie) => likedIds.has(movie.id));
  renderGrid(els.favoritesGrid, liked);
  els.favoritesStatus.textContent =
    liked.length === 0
      ? "Tu n'as encore liké aucun film. Va dans le Catalogue et clique sur 🤍 pour en ajouter."
      : `${liked.length} film${liked.length > 1 ? "s" : ""} liké${liked.length > 1 ? "s" : ""}.`;
}

function renderRecommend() {
  const likedIds = Array.from(likesStore.getAll());
  const likedMovies = allMovies.filter((movie) => likedIds.includes(movie.id));

  if (likedMovies.length === 0) {
    els.recommendExplanation.textContent =
      "Like quelques films dans le Catalogue pour débloquer des recommandations.";
    renderGrid(els.recommendGrid, []);
    return;
  }

  const profile = buildGenreProfile(likedMovies);
  const topGenres = topProfileGenres(profile, 3);
  const results = recommend(allMovies, likedIds, RECOMMEND_COUNT);

  els.recommendExplanation.textContent =
    results.length === 0
      ? "Pas encore assez de films similaires trouvés — like d'autres films pour affiner."
      : `Basé sur tes genres préférés : ${topGenres.join(", ")}.`;
  renderGrid(els.recommendGrid, results);
}

function openDetail(id) {
  const movie = moviesById.get(id);
  if (!movie) return;

  els.detailCard.innerHTML = "";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "close-btn";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Fermer");
  closeBtn.addEventListener("click", closeDetail);
  els.detailCard.appendChild(closeBtn);

  if (movie.thumbnail) {
    const img = document.createElement("img");
    img.src = movie.thumbnail;
    img.alt = "";
    img.addEventListener("error", () => img.remove());
    els.detailCard.appendChild(img);
  }

  const title = document.createElement("h2");
  title.textContent = `${movie.title} (${movie.year})`;
  els.detailCard.appendChild(title);

  const tags = document.createElement("div");
  tags.className = "genre-tags";
  for (const genre of movie.genres) {
    const tag = document.createElement("span");
    tag.className = "genre-tag";
    tag.textContent = genre;
    tags.appendChild(tag);
  }
  els.detailCard.appendChild(tags);

  const overview = document.createElement("p");
  overview.textContent = movie.extract || "Pas de synopsis disponible.";
  els.detailCard.appendChild(overview);

  if (movie.cast && movie.cast.length > 0) {
    const cast = document.createElement("p");
    cast.textContent = `Avec : ${movie.cast.join(", ")}`;
    els.detailCard.appendChild(cast);
  }

  const likeBtn = document.createElement("button");
  likeBtn.type = "button";
  likeBtn.className = "like-btn detail-like";
  likeBtn.dataset.likeId = String(movie.id);
  likeBtn.dataset.withLabel = "true";
  syncLikeButton(likeBtn, movie.id);
  likeBtn.addEventListener("click", () => toggleLike(movie.id));
  els.detailCard.appendChild(likeBtn);

  if (movie.wiki) {
    const wikiLink = document.createElement("a");
    wikiLink.href = movie.wiki;
    wikiLink.target = "_blank";
    wikiLink.rel = "noopener";
    wikiLink.className = "wiki-link";
    wikiLink.textContent = "Voir sur Wikipedia ↗";
    els.detailCard.appendChild(wikiLink);
  }

  els.overlay.classList.remove("hidden");
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

function wireEvents() {
  els.tabs.addEventListener("click", (event) => {
    const btn = event.target.closest(".tab");
    if (!btn) return;
    setView(btn.dataset.view);
  });

  els.searchInput.addEventListener("input", () => {
    state.query = els.searchInput.value;
    state.page = 1;
    renderCatalog();
  });

  els.genreSelect.addEventListener("change", () => {
    state.genre = els.genreSelect.value;
    state.page = 1;
    renderCatalog();
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

async function init() {
  wireEvents();
  els.catalogStatus.textContent = "Chargement du catalogue…";

  try {
    const response = await fetch("./data/movies.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    allMovies = validateMovies(await response.json());
  } catch (error) {
    els.catalogStatus.textContent =
      "Impossible de charger le catalogue de films. Vérifie ta connexion et réessaie.";
    console.error(error);
    return;
  }

  moviesById = new Map(allMovies.map((movie) => [movie.id, movie]));

  for (const genre of collectGenres(allMovies)) {
    const option = document.createElement("option");
    option.value = genre;
    option.textContent = genre;
    els.genreSelect.appendChild(option);
  }

  els.favoritesCount.textContent = String(likesStore.getAll().size);
  renderCatalog();
}

init();
