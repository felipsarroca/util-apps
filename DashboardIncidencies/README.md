# 📊 Dashboard d'Incidències

Aplicació web per visualitzar i analitzar les incidències del centre **Ramon Pont** de manera clara i interactiva.  
Està dissenyada perquè el professorat pugui veure de forma ràpida l’estat de la classe, els alumnes amb més incidències i l’evolució general.

🌐 Aplicació publicada:  
[https://felipsarroca.github.io/util-apps/DashboardIncidencies/](https://felipsarroca.github.io/util-apps/DashboardIncidencies/)

---

## 🚀 Funcionalitats

- Lectura automàtica de dades des d’un **Google Sheets** (pestanya *Buidat*).
- Visualització en gràfics i taules de:
  - Absències
  - Retards
  - Deures no fets
  - Altres incidències
- Filtres per alumne i per tipus d’incidència.
- Configuració inicial senzilla: només cal enganxar l’URL del full de càlcul.
- Disseny modern i responsiu amb **TailwindCSS** i **Recharts**.

---

## 🛠️ Tecnologies utilitzades

- [Vite](https://vitejs.dev/) (React + TypeScript)
- [TailwindCSS](https://tailwindcss.com/)
- [Recharts](https://recharts.org/)
- [PapaParse](https://www.papaparse.com/) (per processar CSV)
- GitHub Pages (desplegament)

---

## 📋 Requisits

- **Google Sheets** amb una pestanya anomenada `Buidat`.
- El full ha d’estar compartit com a *"Qualsevol amb l’enllaç (lector)"* o publicat al web, perquè l’aplicació hi pugui accedir.
- Node.js ≥ 18 (només necessari si vols recompilar el projecte).

---

## ▶️ Ús

1. Accedeix a l’aplicació:  
   [https://felipsarroca.github.io/util-apps/DashboardIncidencies/](https://felipsarroca.github.io/util-apps/DashboardIncidencies/)

2. A la primera pantalla, enganxa l’URL del teu Google Sheets (pestanya *Buidat*).

3. Desa la configuració i explora els gràfics i taules.

---

## 🔧 Desenvolupament i build

Si vols modificar el projecte:

```bash
# Clona el repositori
git clone https://github.com/felipsarroca/util-apps.git

# Entra a la carpeta del projecte (codi font original)
cd DashboardIncidencies-src

# Instal·la dependències
npm install

# Executa en mode desenvolupament
npm run dev

# Crea el build de producció
npm run build
````

El build resultant es copia a la carpeta:

```
util-apps/DashboardIncidencies/
```

que és la que es publica a GitHub Pages.

---

## 📂 Estructura del projecte

```
DashboardIncidencies-src/   # Codi font amb React + Vite
  ├── src/                  # Components i lògica
  ├── index.html            # Arrel del projecte
  └── vite.config.ts        # Configuració Vite (amb base per GitHub Pages)

util-apps/
  └── DashboardIncidencies/ # Build final publicat (index.html + assets/)
```

---

## ✨ Autoria

Projecte creat per **Felip Sarroca i Gil** per a l’Escola Ramon Pont (Terrassa), amb l’objectiu de facilitar la gestió i seguiment de les incidències del centre educatiu.

```

