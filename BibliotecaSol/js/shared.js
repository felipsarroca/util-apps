(function () {
  const BOOKS_KEY = "bibliotecaSol.books";
  const USERS_KEY = "bibliotecaSol.users";
  const SESSION_KEY = "bibliotecaSol.session";
  const OPTIONS_KEY = "bibliotecaSol.options";
  let booksCache = null;
  let optionsCache = null;
  let dataSource = "local";

  const seedUsers = [
    {
      id: "usuari-alumnat",
      nom: "Alumnat",
      cognoms: "Biblioteca",
      email: "alumnat@ramonpont.cat",
      rol: "lector",
      created_at: "2026-05-06"
    },
    {
      id: "usuari-biblioteca",
      nom: "Biblioteca",
      cognoms: "Escola Ramon Pont",
      email: "biblioteca@ramonpont.cat",
      password: "bibliotecasol",
      rol: "editor",
      created_at: "2026-05-06"
    }
  ];

  const seedOptions = {
    nivell_recomanat: ["3-5 anys", "6-8 anys", "9-11 anys", "12-14 anys", "15-16 anys", "Mestres"],
    tematica: ["Aventura", "Ciència", "Coneixements", "Convivència", "Emocions", "Fantasia", "Història", "Misteri", "Natura"],
    genere: ["Àlbum il·lustrat", "Còmic", "Divulgació", "Narrativa", "Novel·la curta", "Poesia", "Teatre"],
    ubicacio: ["Biblioteca central", "Prestatgeria A1", "Prestatgeria A2", "Prestatgeria B1", "Prestatgeria B2", "Prestatgeria C1", "Prestatgeria C2", "Racó infantil", "Zona ESO"]
  };

  const seedBooks = [
    {
      id: "llibre-1",
      titol: "El secret del pati gran",
      autor: "Laia Muntaner",
      editorial: "Pont Blau",
      isbn: "9788400000011",
      any_publicacio: 2021,
      llengua: "Català",
      nivell_recomanat: "9-11 anys",
      tematica: "Misteri",
      genere: "Narrativa",
      resum: "Una colla d'alumnes investiga unes pistes amagades al pati de l'escola.",
      ubicacio: "Prestatgeria A1",
      exemplars: 4,
      disponibles: 2,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-2",
      titol: "La nena que escoltava els arbres",
      autor: "Marta Soler",
      editorial: "Llum de Paper",
      isbn: "9788400000028",
      any_publicacio: 2019,
      llengua: "Català",
      nivell_recomanat: "6-8 anys",
      tematica: "Natura",
      genere: "Narrativa",
      resum: "Un conte sobre la cura dels arbres i la descoberta del bosc proper.",
      ubicacio: "Prestatgeria B2",
      exemplars: 3,
      disponibles: 3,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-3",
      titol: "Manual petit dels invents impossibles",
      autor: "Oriol Cerdà",
      editorial: "Enginy",
      isbn: "9788400000035",
      any_publicacio: 2022,
      llengua: "Català",
      nivell_recomanat: "12-14 anys",
      tematica: "Ciència",
      genere: "Divulgació",
      resum: "Propostes i curiositats per entendre la creativitat científica.",
      ubicacio: "Prestatgeria C1",
      exemplars: 2,
      disponibles: 1,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-4",
      titol: "El drac que no volia fer por",
      autor: "Núria Cases",
      editorial: "Tres Pins",
      isbn: "9788400000042",
      any_publicacio: 2018,
      llengua: "Català",
      nivell_recomanat: "3-5 anys",
      tematica: "Emocions",
      genere: "Àlbum il·lustrat",
      resum: "Un drac amable aprèn a explicar com se sent sense espantar ningú.",
      ubicacio: "Racó infantil",
      exemplars: 5,
      disponibles: 4,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-5",
      titol: "Quan el barri parla",
      autor: "Samira El Amrani",
      editorial: "Camins",
      isbn: "9788400000059",
      any_publicacio: 2020,
      llengua: "Català",
      nivell_recomanat: "12-14 anys",
      tematica: "Convivència",
      genere: "Narrativa",
      resum: "Relats breus sobre amistat, veïnatge i diversitat cultural.",
      ubicacio: "Zona ESO",
      exemplars: 6,
      disponibles: 2,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-6",
      titol: "Poemes per a dies de pluja",
      autor: "Jordi Clariana",
      editorial: "Versos Menuts",
      isbn: "9788400000066",
      any_publicacio: 2017,
      llengua: "Català",
      nivell_recomanat: "9-11 anys",
      tematica: "Emocions",
      genere: "Poesia",
      resum: "Poemes curts per llegir en veu alta i treballar imatges poètiques.",
      ubicacio: "Prestatgeria A2",
      exemplars: 3,
      disponibles: 1,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-7",
      titol: "La ciutat sota la sorra",
      autor: "Clara Vidal",
      editorial: "Horitzó",
      isbn: "9788400000073",
      any_publicacio: 2023,
      llengua: "Català",
      nivell_recomanat: "15-16 anys",
      tematica: "Aventura",
      genere: "Narrativa",
      resum: "Una expedició escolar descobreix restes d'una ciutat antiga.",
      ubicacio: "Zona ESO",
      exemplars: 4,
      disponibles: 0,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-8",
      titol: "Història ràpida de les coses quotidianes",
      autor: "Pau Mercader",
      editorial: "Temps Viu",
      isbn: "9788400000080",
      any_publicacio: 2021,
      llengua: "Català",
      nivell_recomanat: "12-14 anys",
      tematica: "Història",
      genere: "Divulgació",
      resum: "Explica l'origen d'objectes comuns com el llapis, el pa o la bicicleta.",
      ubicacio: "Prestatgeria C2",
      exemplars: 2,
      disponibles: 2,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-9",
      titol: "Berta i el mapa de les preguntes",
      autor: "Eva Sanchis",
      editorial: "Lletra Clara",
      isbn: "9788400000097",
      any_publicacio: 2016,
      llengua: "Català",
      nivell_recomanat: "6-8 anys",
      tematica: "Aventura",
      genere: "Narrativa",
      resum: "La Berta descobreix que cada pregunta pot obrir un camí nou.",
      ubicacio: "Prestatgeria B1",
      exemplars: 4,
      disponibles: 3,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-10",
      titol: "Còmic de la classe invisible",
      autor: "Nil Ferrer",
      editorial: "Vinyetes",
      isbn: "9788400000103",
      any_publicacio: 2024,
      llengua: "Català",
      nivell_recomanat: "9-11 anys",
      tematica: "Fantasia",
      genere: "Còmic",
      resum: "Una classe sencera es torna invisible durant una excursió al museu.",
      ubicacio: "Prestatgeria A2",
      exemplars: 5,
      disponibles: 5,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-11",
      titol: "El laboratori de les paraules",
      autor: "Helena Puig",
      editorial: "Tinta Nova",
      isbn: "9788400000110",
      any_publicacio: 2020,
      llengua: "Català",
      nivell_recomanat: "Mestres",
      tematica: "Coneixements",
      genere: "Divulgació",
      resum: "Recursos per treballar lectura, escriptura i oralitat a l'aula.",
      ubicacio: "Biblioteca central",
      exemplars: 2,
      disponibles: 1,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-12",
      titol: "La lluna dins la motxilla",
      autor: "Mariona Prat",
      editorial: "Tres Pins",
      isbn: "9788400000127",
      any_publicacio: 2015,
      llengua: "Català",
      nivell_recomanat: "3-5 anys",
      tematica: "Fantasia",
      genere: "Àlbum il·lustrat",
      resum: "Una nena vol guardar la lluna per no tenir por de la nit.",
      ubicacio: "Racó infantil",
      exemplars: 4,
      disponibles: 2,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-13",
      titol: "Set enigmes per al divendres",
      autor: "Marc Rovira",
      editorial: "Intriga",
      isbn: "9788400000134",
      any_publicacio: 2022,
      llengua: "Català",
      nivell_recomanat: "12-14 anys",
      tematica: "Misteri",
      genere: "Novel·la curta",
      resum: "Set casos breus per resoldre amb observació i lògica.",
      ubicacio: "Zona ESO",
      exemplars: 3,
      disponibles: 1,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-14",
      titol: "Animals que canvien el món",
      autor: "Irene Costa",
      editorial: "Natura Oberta",
      isbn: "9788400000141",
      any_publicacio: 2021,
      llengua: "Català",
      nivell_recomanat: "9-11 anys",
      tematica: "Natura",
      genere: "Divulgació",
      resum: "Una guia de fauna amb exemples de cooperació, adaptació i equilibri.",
      ubicacio: "Prestatgeria C1",
      exemplars: 3,
      disponibles: 3,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-15",
      titol: "El teatre dels objectes perduts",
      autor: "Arnau Bellver",
      editorial: "Escena",
      isbn: "9788400000158",
      any_publicacio: 2018,
      llengua: "Català",
      nivell_recomanat: "9-11 anys",
      tematica: "Convivència",
      genere: "Teatre",
      resum: "Peces breus per representar a classe sobre objectes i records.",
      ubicacio: "Prestatgeria A1",
      exemplars: 2,
      disponibles: 0,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-16",
      titol: "A la recerca del nombre perdut",
      autor: "Gemma Font",
      editorial: "Enginy",
      isbn: "9788400000165",
      any_publicacio: 2019,
      llengua: "Català",
      nivell_recomanat: "12-14 anys",
      tematica: "Ciència",
      genere: "Narrativa",
      resum: "Una aventura matemàtica amb pistes, patrons i codis secrets.",
      ubicacio: "Prestatgeria C2",
      exemplars: 4,
      disponibles: 2,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-17",
      titol: "El quadern de la Mei",
      autor: "Lina Serra",
      editorial: "Camins",
      isbn: "9788400000172",
      any_publicacio: 2023,
      llengua: "Català",
      nivell_recomanat: "15-16 anys",
      tematica: "Convivència",
      genere: "Narrativa",
      resum: "Diari fictici d'una alumna nouvinguda que descobreix una nova ciutat.",
      ubicacio: "Zona ESO",
      exemplars: 5,
      disponibles: 4,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-18",
      titol: "Cançons per llegir baixet",
      autor: "Roser Vila",
      editorial: "Versos Menuts",
      isbn: "9788400000189",
      any_publicacio: 2016,
      llengua: "Català",
      nivell_recomanat: "6-8 anys",
      tematica: "Emocions",
      genere: "Poesia",
      resum: "Poemes musicals per llegir, memoritzar i recitar en grup.",
      ubicacio: "Prestatgeria B1",
      exemplars: 3,
      disponibles: 2,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-19",
      titol: "La porta del temps romà",
      autor: "Pol Rius",
      editorial: "Temps Viu",
      isbn: "9788400000196",
      any_publicacio: 2020,
      llengua: "Català",
      nivell_recomanat: "12-14 anys",
      tematica: "Història",
      genere: "Aventura",
      resum: "Un grup d'amics viatja a una ciutat romana i ha de trobar el camí de tornada.",
      ubicacio: "Prestatgeria C2",
      exemplars: 4,
      disponibles: 1,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-20",
      titol: "Cinc minuts abans del pati",
      autor: "Aina Casals",
      editorial: "Lletra Clara",
      isbn: "9788400000202",
      any_publicacio: 2021,
      llengua: "Català",
      nivell_recomanat: "9-11 anys",
      tematica: "Convivència",
      genere: "Narrativa",
      resum: "Històries curtes situades a l'escola abans, durant i després del pati.",
      ubicacio: "Prestatgeria A1",
      exemplars: 6,
      disponibles: 5,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-21",
      titol: "Petita guia del cel nocturn",
      autor: "Biel Andreu",
      editorial: "Natura Oberta",
      isbn: "9788400000219",
      any_publicacio: 2022,
      llengua: "Català",
      nivell_recomanat: "9-11 anys",
      tematica: "Ciència",
      genere: "Divulgació",
      resum: "Introducció clara a constel·lacions, planetes i observació del cel.",
      ubicacio: "Prestatgeria C1",
      exemplars: 3,
      disponibles: 0,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-22",
      titol: "El club de les paraules valentes",
      autor: "Txell Marín",
      editorial: "Tinta Nova",
      isbn: "9788400000226",
      any_publicacio: 2024,
      llengua: "Català",
      nivell_recomanat: "12-14 anys",
      tematica: "Emocions",
      genere: "Narrativa",
      resum: "Una novel·la sobre expressar opinions, posar límits i cuidar l'amistat.",
      ubicacio: "Zona ESO",
      exemplars: 5,
      disponibles: 3,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-23",
      titol: "La gran cursa dels cargols",
      autor: "Pere Llop",
      editorial: "Tres Pins",
      isbn: "9788400000233",
      any_publicacio: 2017,
      llengua: "Català",
      nivell_recomanat: "3-5 anys",
      tematica: "Natura",
      genere: "Àlbum il·lustrat",
      resum: "Un conte humorístic sobre paciència, ritmes diferents i cooperació.",
      ubicacio: "Racó infantil",
      exemplars: 4,
      disponibles: 4,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-24",
      titol: "Misteri a la biblioteca tancada",
      autor: "Sílvia Noguera",
      editorial: "Intriga",
      isbn: "9788400000240",
      any_publicacio: 2021,
      llengua: "Català",
      nivell_recomanat: "15-16 anys",
      tematica: "Misteri",
      genere: "Narrativa",
      resum: "Un cas ambientat en una biblioteca on desapareix un llibre antic.",
      ubicacio: "Zona ESO",
      exemplars: 3,
      disponibles: 2,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-25",
      titol: "La recepta de la calma",
      autor: "Noa Pastor",
      editorial: "Llum de Paper",
      isbn: "9788400000257",
      any_publicacio: 2020,
      llengua: "Català",
      nivell_recomanat: "6-8 anys",
      tematica: "Emocions",
      genere: "Àlbum il·lustrat",
      resum: "Un conte per identificar nervis, respiració i estratègies de calma.",
      ubicacio: "Prestatgeria B1",
      exemplars: 5,
      disponibles: 3,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-26",
      titol: "Viatge al centre de l'hort",
      autor: "Toni Mestre",
      editorial: "Natura Oberta",
      isbn: "9788400000264",
      any_publicacio: 2019,
      llengua: "Català",
      nivell_recomanat: "6-8 anys",
      tematica: "Natura",
      genere: "Divulgació",
      resum: "Explica el cicle de les plantes i la vida amagada sota terra.",
      ubicacio: "Prestatgeria B2",
      exemplars: 3,
      disponibles: 1,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-27",
      titol: "La màquina dels somnis curts",
      autor: "Carme Oliva",
      editorial: "Horitzó",
      isbn: "9788400000271",
      any_publicacio: 2023,
      llengua: "Català",
      nivell_recomanat: "9-11 anys",
      tematica: "Fantasia",
      genere: "Novel·la curta",
      resum: "Una màquina transforma els somnis en petites aventures inesperades.",
      ubicacio: "Prestatgeria A2",
      exemplars: 4,
      disponibles: 2,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-28",
      titol: "Dones que van obrir camí",
      autor: "Laia Ferrús",
      editorial: "Temps Viu",
      isbn: "9788400000288",
      any_publicacio: 2022,
      llengua: "Català",
      nivell_recomanat: "12-14 anys",
      tematica: "Història",
      genere: "Divulgació",
      resum: "Biografies breus de dones rellevants en ciència, art, política i educació.",
      ubicacio: "Prestatgeria C2",
      exemplars: 4,
      disponibles: 4,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-29",
      titol: "La colla del pont vell",
      autor: "Iu Mas",
      editorial: "Pont Blau",
      isbn: "9788400000295",
      any_publicacio: 2018,
      llengua: "Català",
      nivell_recomanat: "12-14 anys",
      tematica: "Aventura",
      genere: "Narrativa",
      resum: "Una colla investiga la història d'un pont i d'un antic camí del barri.",
      ubicacio: "Zona ESO",
      exemplars: 5,
      disponibles: 5,
      actiu: true,
      created_at: "2026-05-06"
    },
    {
      id: "llibre-30",
      titol: "Aula 13: missió impossible",
      autor: "Bruna Pallarès",
      editorial: "Vinyetes",
      isbn: "9788400000301",
      any_publicacio: 2024,
      llengua: "Català",
      nivell_recomanat: "15-16 anys",
      tematica: "Misteri",
      genere: "Còmic",
      resum: "Un còmic d'humor i misteri ambientat en una aula plena de pistes falses.",
      ubicacio: "Zona ESO",
      exemplars: 6,
      disponibles: 2,
      actiu: true,
      created_at: "2026-05-06"
    }
  ];

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function ensureBooks() {
    const existing = readJson(BOOKS_KEY, null);
    if (!Array.isArray(existing) || existing.length === 3) {
      writeJson(BOOKS_KEY, seedBooks);
      return seedBooks;
    }
    return existing;
  }

  function ensureUsers() {
    const existing = readJson(USERS_KEY, []);
    const users = Array.isArray(existing) ? existing : [];
    let changed = false;

    seedUsers.forEach((seedUser) => {
      const index = users.findIndex((user) => normalize(user.email) === normalize(seedUser.email));
      if (index === -1) {
        users.push(seedUser);
        changed = true;
      } else {
        users[index] = { ...users[index], ...seedUser };
        changed = true;
      }
    });

    if (changed) writeJson(USERS_KEY, users);
    return users;
  }

  function ensureOptions() {
    const existing = readJson(OPTIONS_KEY, {});
    const options = { ...seedOptions, ...(existing && typeof existing === "object" ? existing : {}) };

    Object.keys(seedOptions).forEach((key) => {
      const combined = [...seedOptions[key], ...(Array.isArray(options[key]) ? options[key] : [])];
      options[key] = uniqueSorted(combined);
    });

    writeJson(OPTIONS_KEY, options);
    return options;
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function getBooks() {
    const books = booksCache || ensureBooks();
    return books.filter((book) => book.actiu !== false);
  }

  function saveBooks(books) {
    booksCache = books;
    writeJson(BOOKS_KEY, books);
  }

  function getUsers() {
    return ensureUsers();
  }

  function saveUsers(users) {
    writeJson(USERS_KEY, users);
  }

  function getOptions(field) {
    const options = optionsCache || ensureOptions();
    return options[field] || [];
  }

  function addOption(field, value) {
    const cleanValue = String(value || "").trim();
    if (!cleanValue) return;

    const options = optionsCache || ensureOptions();
    options[field] = uniqueSorted([...(options[field] || []), cleanValue]);
    optionsCache = options;
    writeJson(OPTIONS_KEY, options);
  }

  function uniqueSorted(values) {
    const map = new Map();
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .forEach((value) => map.set(normalize(value), value));
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "ca"));
  }

  function getSession() {
    try {
      const value = sessionStorage.getItem(SESSION_KEY);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    updateAccessState();
    window.dispatchEvent(new CustomEvent("bibliotecaSol:sessionchange"));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (window.BibliotecaSolSupabase) window.BibliotecaSolSupabase.signOut();
    updateAccessState();
    window.dispatchEvent(new CustomEvent("bibliotecaSol:sessionchange"));
  }

  function isAllowedEmail(email) {
    const domain = (window.BIBLIOTECA_SOL_CONFIG || {}).allowedEmailDomain || "@ramonpont.cat";
    return normalize(email).endsWith(normalize(domain));
  }

  function isManagerEmail(email) {
    return normalize(email) === normalize("biblioteca@ramonpont.cat");
  }

  function findUser(email) {
    return getUsers().find((item) => normalize(item.email) === normalize(email));
  }

  function createReader(email) {
    const users = getUsers();
    const cleanEmail = String(email || "").trim();
    const name = cleanEmail.split("@")[0] || "Usuari";
    const user = {
      id: `usuari-${Date.now()}`,
      nom: titleCase(name.replace(/[._-]+/g, " ")),
      cognoms: "",
      email: cleanEmail,
      rol: "lector",
      created_at: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);
    return user;
  }

  function titleCase(value) {
    return String(value)
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  function setSessionFromUser(user) {
    setSession({
      id: user.id,
      nom: user.nom,
      cognoms: user.cognoms || "",
      email: user.email,
      rol: user.rol
    });
  }

  async function initData() {
    booksCache = ensureBooks();
    optionsCache = ensureOptions();

    if (!window.BibliotecaSolSupabase || !window.BibliotecaSolSupabase.isConfigured()) {
      dataSource = "local";
      return;
    }

    try {
      const [remoteBooks, remoteOptions] = await Promise.all([
        window.BibliotecaSolSupabase.listBooks(),
        window.BibliotecaSolSupabase.listOptions()
      ]);
      booksCache = remoteBooks;
      optionsCache = { ...optionsCache, ...remoteOptions };
      dataSource = "supabase";
      window.dispatchEvent(new CustomEvent("bibliotecaSol:dataready"));
    } catch (error) {
      dataSource = "local";
      console.warn("No s'han pogut carregar les dades de Supabase. Es fa servir localStorage.", error);
    }
  }

  async function loginWithCredentials(email, password) {
    const cleanEmail = String(email || "").trim();
    if (!isAllowedEmail(cleanEmail)) {
      return { ok: false, type: "error", message: "Només es poden utilitzar correus acabats en @ramonpont.cat." };
    }

    if (isManagerEmail(cleanEmail)) {
      const user = findUser(cleanEmail);
      if (!password) {
        return { ok: false, type: "password", message: "Introdueix la contrasenya de gestor." };
      }
      if (!user || user.rol !== "editor" || user.password !== password) {
        return { ok: false, type: "error", message: "Correu de gestor o contrasenya incorrectes." };
      }
      if (dataSource === "supabase" && window.BibliotecaSolSupabase) {
        try {
          await window.BibliotecaSolSupabase.signInWithPassword(cleanEmail, password);
        } catch (error) {
          return { ok: false, type: "error", message: "No s'ha pogut autenticar el gestor a Supabase." };
        }
      }
      await registerRemoteAccess(cleanEmail);
      setSessionFromUser(user);
      return { ok: true, role: "editor", message: "Has iniciat sessió com a gestor." };
    }

    const existingUser = findUser(cleanEmail);
    if (existingUser && (existingUser.rol === "editor" || existingUser.rol === "administrador")) {
      return { ok: false, type: "error", message: "Aquest usuari té permisos de gestor. Cal entrar amb contrasenya." };
    }

    const remoteUser = await registerRemoteAccess(cleanEmail);
    setSessionFromUser(remoteUser || existingUser || createReader(cleanEmail));
    return { ok: true, role: "lector", message: "Has iniciat sessió com a usuari." };
  }

  async function registerRemoteAccess(email) {
    if (dataSource !== "supabase" || !window.BibliotecaSolSupabase) return null;
    try {
      return await window.BibliotecaSolSupabase.registerAccess(email);
    } catch (error) {
      console.warn("No s'ha pogut registrar l'acces a Supabase.", error);
      return null;
    }
  }

  async function reserveBooks(bookIds, email) {
    if (!Array.isArray(bookIds) || !bookIds.length) {
      return { ok: false, message: "No has seleccionat cap llibre." };
    }
    if (!isAllowedEmail(email)) {
      return { ok: false, message: "Cal entrar amb un correu @ramonpont.cat per fer reserves." };
    }
    if (dataSource !== "supabase" || !window.BibliotecaSolSupabase) {
      return { ok: false, type: "local", message: "Supabase encara no esta configurat. De moment envia la sol·licitud per correu." };
    }

    try {
      await Promise.all(bookIds.map((bookId) => window.BibliotecaSolSupabase.reserveBook(bookId, email)));
      return { ok: true, message: "Reserva registrada correctament." };
    } catch (error) {
      return { ok: false, message: error.message || "No s'ha pogut registrar la reserva." };
    }
  }

  function getPostLoginUrl(session) {
    return canManageCatalog(session) ? "editor.html" : "cataleg.html";
  }

  function goToPostLoginPage() {
    const session = getSession();
    if (!session) return;
    window.location.href = getPostLoginUrl(session);
  }

  function getBookStats(books) {
    return books.reduce(
      (stats, book) => {
        stats.books += 1;
        stats.copies += Number(book.exemplars || 0);
        stats.available += Number(book.disponibles || 0);
        return stats;
      },
      { books: 0, copies: 0, available: 0 }
    );
  }

  function createBookCard(book) {
    const available = Number(book.disponibles || 0);
    const total = Number(book.exemplars || 0);
    const statusClass = available > 0 ? "available" : "unavailable";
    const statusText = available > 0 ? `${available} disponibles` : "No disponible";
    const article = document.createElement("article");
    article.className = "book-row";
    article.innerHTML = `
      <div class="book-main">
        <h3>${escapeHtml(book.titol)}</h3>
        <span class="book-kicker">${escapeHtml(book.editorial || "Editorial pendent")}${book.isbn ? ` · ISBN ${escapeHtml(book.isbn)}` : ""}</span>
      </div>
      <p class="book-author">${escapeHtml(book.autor)}</p>
      <span class="compact-cell">${escapeHtml(book.nivell_recomanat || "Pendent")}</span>
      <span class="compact-cell">${escapeHtml(book.tematica || "Pendent")}</span>
      <span class="compact-cell">${escapeHtml(book.genere || "Pendent")}</span>
      <div class="availability compact ${statusClass}">
        <span class="availability-dot"></span>
        <span>${escapeHtml(available > 0 ? `${available}/${total}` : "No")}</span>
      </div>
      <div class="location-stack">
        <span class="book-location">${escapeHtml(book.ubicacio || "Ubicació pendent")}</span>
        <span class="book-year">${escapeHtml(book.any_publicacio || "")}</span>
      </div>
    `;
    return article;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function canManageCatalog(session) {
    return Boolean(session && isManagerEmail(session.email) && (session.rol === "editor" || session.rol === "administrador"));
  }

  function updateAccessLink() {
    const session = getSession();
    document.querySelectorAll('.main-nav a[href="login.html"]').forEach((link) => {
      if (!session) {
        link.textContent = "Accés";
        link.title = "Accés";
        link.className = "button button-small icon-login";
        delete link.dataset.logout;
        return;
      }

      const isEditor = canManageCatalog(session);
      link.textContent = session.nom || "Sessió";
      link.title = `${session.email} (${session.rol}). Clica per sortir.`;
      link.className = `button button-small session-pill ${isEditor ? "session-editor icon-editor" : "session-reader icon-user"}`;
      link.dataset.logout = "true";
    });
  }

  function updateRoleVisibility() {
    const canEdit = canManageCatalog(getSession());
    document.querySelectorAll("[data-editor-only]").forEach((element) => {
      element.hidden = !canEdit;
    });
    document.querySelectorAll("[data-reader-only]").forEach((element) => {
      element.hidden = canEdit;
    });
  }

  function redirectIfManagerRequired() {
    if (!document.body.dataset.requiresManager) return;
    if (canManageCatalog(getSession())) return;
    window.location.replace("login.html#gestor");
  }

  function updateAccessState() {
    updateAccessLink();
    updateRoleVisibility();
  }

  function initAccessForms() {
    createAccessDialog();
    document.querySelectorAll(".main-nav a[href='login.html']").forEach((link) => {
      link.addEventListener("click", (event) => {
        if (link.dataset.logout === "true") return;
        event.preventDefault();
        openAccessDialog();
      });
    });

    const homeForm = document.getElementById("home-login-form");
    if (homeForm) {
      homeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(homeForm));
        const result = await loginWithCredentials(data.email, "");
        if (result.type === "password") {
          openAccessDialog(data.email);
          return;
        }
        showInlineMessage("home-login-message", result.message, result.ok ? "success" : "error");
        if (result.ok) {
          goToPostLoginPage();
        }
      });
    }
  }

  function createAccessDialog() {
    if (document.getElementById("access-dialog")) return;

    const dialog = document.createElement("dialog");
    dialog.id = "access-dialog";
    dialog.className = "access-dialog";
    dialog.innerHTML = `
      <form id="access-dialog-form" class="access-dialog-card" method="dialog">
        <button class="dialog-close icon-clear" type="button" aria-label="Tancar"></button>
        <img src="assets/logo-sol.svg" alt="" width="56" height="56">
        <div>
          <h2>Accés a la biblioteca</h2>
          <p>Escriu el correu del centre. Si és el compte de biblioteca, et demanarà la contrasenya de gestor.</p>
        </div>
        <label>
          Correu electrònic
          <input name="email" type="email" autocomplete="email" required placeholder="nom@ramonpont.cat">
        </label>
        <label id="access-password-field" hidden>
          Contrasenya de gestor
          <input name="password" type="password" autocomplete="current-password">
        </label>
        <button class="button icon-login" type="submit">Entrar</button>
        <p id="access-dialog-message" class="form-message" role="status"></p>
      </form>
    `;
    document.body.appendChild(dialog);

    const form = dialog.querySelector("#access-dialog-form");
    const emailInput = form.elements.email;
    const passwordField = dialog.querySelector("#access-password-field");
    const passwordInput = form.elements.password;

    dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    emailInput.addEventListener("input", () => {
      const manager = isManagerEmail(emailInput.value);
      passwordField.hidden = !manager;
      passwordInput.required = manager;
      if (!manager) passwordInput.value = "";
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const result = await loginWithCredentials(emailInput.value, passwordInput.value);
      if (result.type === "password") {
        passwordField.hidden = false;
        passwordInput.required = true;
        passwordInput.focus();
        showInlineMessage("access-dialog-message", result.message, "error");
        return;
      }
      showInlineMessage("access-dialog-message", result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setTimeout(goToPostLoginPage, 150);
      }
    });
  }

  function openAccessDialog(email) {
    const dialog = document.getElementById("access-dialog");
    if (!dialog) return;
    const form = dialog.querySelector("#access-dialog-form");
    const emailInput = form.elements.email;
    const passwordField = dialog.querySelector("#access-password-field");
    const passwordInput = form.elements.password;
    showInlineMessage("access-dialog-message", "", "");
    if (email) emailInput.value = email;
    const manager = isManagerEmail(emailInput.value);
    passwordField.hidden = !manager;
    passwordInput.required = manager;
    if (!manager) passwordInput.value = "";
    dialog.showModal();
    (manager ? passwordInput : emailInput).focus();
  }

  function showInlineMessage(id, text, type) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = text || "";
    element.className = `form-message ${type || ""}`.trim();
  }

  const ready = new Promise((resolve) => {
    document.addEventListener("DOMContentLoaded", async () => {
    localStorage.removeItem(SESSION_KEY);
    await initData();
    ensureUsers();
    updateAccessState();
    redirectIfManagerRequired();
    initAccessForms();
    document.addEventListener("click", (event) => {
      const logoutLink = event.target.closest("[data-logout='true']");
      if (!logoutLink) return;
      event.preventDefault();
      clearSession();
      if (window.location.pathname.endsWith("editor.html")) {
        window.location.href = "login.html";
      }
    });
    resolve();
  });
  });

  window.BibliotecaSol = {
    normalize,
    getBooks,
    saveBooks,
    getUsers,
    saveUsers,
    getOptions,
    addOption,
    getSession,
    setSession,
    clearSession,
    ready,
    canManageCatalog,
    isManagerEmail,
    loginWithCredentials,
    reserveBooks,
    goToPostLoginPage,
    openAccessDialog,
    isAllowedEmail,
    getBookStats,
    createBookCard,
    escapeHtml
  };
})();
