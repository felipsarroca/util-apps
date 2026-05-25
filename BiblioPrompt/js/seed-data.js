export const INITIAL_DATA = {
  programs: [
    { id: "chatgpt", name: "ChatGPT", icon: "✦", color: "#10a37f" },
    { id: "gemini", name: "Gemini", icon: "✧", color: "#2563eb" },
    { id: "notebooklm", name: "NotebookLM", icon: "▣", color: "#7c3aed" },
    { id: "canva", name: "Canva", icon: "◈", color: "#00a8b5" }
  ],
  prompts: [
    {
      id: "prompt-rubrica",
      title: "Rúbrica d'exposició oral",
      content: "Crea una rúbrica per avaluar una exposició oral de 2n d'ESO sobre civilitzacions antigues. Inclou quatre nivells d'assoliment, criteris clars i llenguatge comprensible per a l'alumnat.",
      programIds: ["chatgpt"],
      categories: ["Rúbrica"],
      tags: ["Socials", "ESO", "Avaluació"],
      notes: "Adaptar els descriptors segons el grup.",
      favorite: true,
      createdAt: "2026-05-25T10:15:00.000Z",
      updatedAt: "2026-05-25T10:15:00.000Z",
      version: 1
    },
    {
      id: "prompt-infografia",
      title: "Infografia del cicle de l'aigua",
      content: "Dissenya una infografia vertical, visual i acolorida sobre el cicle de l'aigua per a alumnat de primària. Inclou evaporació, condensació, precipitació i acumulació.",
      programIds: ["canva"],
      categories: ["Infografia"],
      tags: ["Ciències", "Visual thinking", "A4"],
      notes: "",
      favorite: false,
      createdAt: "2026-05-23T11:00:00.000Z",
      updatedAt: "2026-05-23T11:00:00.000Z",
      version: 1
    },
    {
      id: "prompt-resum",
      title: "Resum guiat d'un document",
      content: "Analitza el document adjunt i prepara un resum estructurat amb idees principals, vocabulari clau i cinc preguntes de comprensió. Diferencia clarament els fets de les interpretacions.",
      programIds: ["notebooklm"],
      categories: ["Resum", "Activitat"],
      tags: ["Comprensió lectora", "ESO"],
      notes: "Útil per preparar materials a partir d'apunts propis.",
      favorite: true,
      createdAt: "2026-05-21T08:30:00.000Z",
      updatedAt: "2026-05-21T08:30:00.000Z",
      version: 1
    },
    {
      id: "prompt-adaptacio",
      title: "Adaptació lingüística A1",
      content: "Reescriu aquest text per a alumnat nouvingut amb nivell A1 de català. Utilitza frases curtes, vocabulari bàsic i una pregunta de comprovació després de cada apartat.",
      programIds: ["gemini"],
      categories: ["Adaptació"],
      tags: ["A1", "NESE", "Llengua"],
      notes: "",
      favorite: false,
      createdAt: "2026-05-20T14:20:00.000Z",
      updatedAt: "2026-05-20T14:20:00.000Z",
      version: 1
    }
  ],
  history: []
};
