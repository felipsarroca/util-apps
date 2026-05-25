import { CONFIG } from "./config.js";
import { INITIAL_DATA } from "./seed-data.js";
import { createId } from "./utils.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getLocalData() {
  const stored = localStorage.getItem(CONFIG.localStorageKey);
  if (!stored) {
    const initialData = clone(INITIAL_DATA);
    localStorage.setItem(CONFIG.localStorageKey, JSON.stringify(initialData));
    return initialData;
  }
  return JSON.parse(stored);
}

function saveLocalData(data) {
  localStorage.setItem(CONFIG.localStorageKey, JSON.stringify(data));
}

function jsonpRequest(action) {
  return new Promise((resolve, reject) => {
    const callbackName = `bibliopromptCallback_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const url = new URL(CONFIG.appsScriptUrl);
    const timeout = setTimeout(() => {
      reject(new Error("La resposta de Google Sheets està trigant massa."));
      delete globalThis[callbackName];
      script.remove();
    }, 30000);
    url.searchParams.set("action", action);
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("_", String(Date.now()));

    globalThis[callbackName] = (response) => {
      clearTimeout(timeout);
      if (response.ok) {
        resolve(response.data);
      } else {
        reject(new Error(response.error || "Google Sheets ha retornat un error."));
      }
      delete globalThis[callbackName];
      script.remove();
    };

    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("No s'ha pogut carregar Google Sheets."));
      delete globalThis[callbackName];
      script.remove();
    };

    script.src = url.toString();
    document.body.append(script);
  });
}

async function remoteMutation(action, payload) {
  let requestError;
  try {
    await fetch(CONFIG.appsScriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload })
    });
  } catch (error) {
    // Apps Script may write successfully before a cross-origin redirect is rejected.
    requestError = error;
  }
  // Apps Script may return before a following public read reflects the Sheet update.
  await new Promise((resolve) => setTimeout(resolve, 450));
  const data = await jsonpRequest("getAll");
  const storedPrompt = data.prompts.find((prompt) => prompt.id === payload.id);
  const reflected = action === "deletePrompt"
    ? !storedPrompt
    : action === "setFavorite"
      ? storedPrompt?.favorite === payload.favorite
      : storedPrompt && [
        "title", "content", "notes", "rating", "favorite"
      ].every((key) => storedPrompt[key] === payload[key])
        && JSON.stringify(storedPrompt.programIds || []) === JSON.stringify(payload.programIds || [])
        && JSON.stringify(storedPrompt.categories || []) === JSON.stringify(payload.categories || [])
        && JSON.stringify(storedPrompt.tags || []) === JSON.stringify(payload.tags || []);
  if (!reflected) {
    throw requestError || new Error("Google Sheets no ha confirmat l'operació.");
  }
  return data;
}

export async function loadData() {
  if (CONFIG.useGoogleSheets && CONFIG.appsScriptUrl) {
    return jsonpRequest("getAll");
  }
  return getLocalData();
}

export async function savePrompt(prompt, isNew = false) {
  if (CONFIG.useGoogleSheets && CONFIG.appsScriptUrl) {
    return remoteMutation(isNew ? "createPrompt" : "updatePrompt", prompt);
  }

  const data = getLocalData();
  const now = new Date().toISOString();
  const existingIndex = data.prompts.findIndex((item) => item.id === prompt.id);

  if (existingIndex >= 0) {
    const existing = data.prompts[existingIndex];
    data.history.push({
      ...clone(existing),
      historyId: createId("history"),
      promptId: existing.id,
      replacedAt: now
    });
    data.prompts[existingIndex] = {
      ...prompt,
      createdAt: existing.createdAt,
      updatedAt: now,
      version: existing.version + 1
    };
  } else {
    data.prompts.unshift({
      ...prompt,
      id: createId("prompt"),
      createdAt: now,
      updatedAt: now,
      version: 1
    });
  }

  saveLocalData(data);
  return data;
}

export async function toggleFavorite(id, favorite) {
  if (CONFIG.useGoogleSheets && CONFIG.appsScriptUrl) {
    return remoteMutation("setFavorite", { id, favorite });
  }
  const data = getLocalData();
  const prompt = data.prompts.find((item) => item.id === id);
  if (prompt) {
    const now = new Date().toISOString();
    data.history.push({
      ...clone(prompt),
      historyId: createId("history"),
      promptId: prompt.id,
      replacedAt: now
    });
    prompt.favorite = favorite;
    prompt.updatedAt = now;
    prompt.version += 1;
    saveLocalData(data);
  }
  return data;
}

export async function deletePrompt(id) {
  if (CONFIG.useGoogleSheets && CONFIG.appsScriptUrl) {
    return remoteMutation("deletePrompt", { id });
  }
  const data = getLocalData();
  data.prompts = data.prompts.filter((item) => item.id !== id);
  saveLocalData(data);
  return data;
}
