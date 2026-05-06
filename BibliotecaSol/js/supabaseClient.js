(function () {
  const config = window.BIBLIOTECA_SOL_CONFIG || {};
  const TOKEN_KEY = "bibliotecaSol.supabaseAccessToken";
  let accessToken = sessionStorage.getItem(TOKEN_KEY) || "";

  function getHeaders(prefer) {
    const headers = {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${accessToken || config.supabaseAnonKey}`,
      "Content-Type": "application/json"
    };
    if (prefer) headers.Prefer = prefer;
    return headers;
  }

  async function request(path, options = {}) {
    if (!window.BibliotecaSolSupabase.isConfigured()) {
      throw new Error("Supabase no esta configurat.");
    }

    const response = await fetch(`${config.supabaseUrl}${path}`, {
      ...options,
      headers: {
        ...getHeaders(options.prefer),
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      let message = `Error de Supabase (${response.status})`;
      try {
        const payload = await response.json();
        message = payload.message || payload.error || message;
      } catch (error) {
        message = await response.text();
      }
      throw new Error(message);
    }

    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function invokeFunction(name, body) {
    if (!window.BibliotecaSolSupabase.isConfigured()) return null;

    const response = await fetch(`${config.supabaseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body || {})
    });

    if (!response.ok) {
      let message = `Error de funcio Supabase (${response.status})`;
      try {
        const payload = await response.json();
        message = payload.error || payload.message || message;
      } catch (error) {
        message = await response.text();
      }
      throw new Error(message);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function dbBookToApp(book) {
    return {
      id: book.id,
      titol: book.title,
      autor: book.author,
      editorial: book.publisher || "",
      isbn: book.isbn || "",
      any_publicacio: book.publication_year || "",
      llengua: book.language || "Català",
      nivell_recomanat: book.recommended_level || "",
      tematica: book.topic || "",
      genere: book.genre || "",
      resum: book.summary || "",
      ubicacio: book.location || "",
      exemplars: Number(book.total_copies || 0),
      disponibles: Number(book.available_copies || 0),
      actiu: book.active !== false,
      created_at: book.created_at,
      updated_at: book.updated_at
    };
  }

  function appBookToDb(book) {
    return {
      title: book.titol,
      author: book.autor,
      publisher: book.editorial || null,
      isbn: book.isbn || null,
      publication_year: book.any_publicacio ? Number(book.any_publicacio) : null,
      language: book.llengua || "Català",
      recommended_level: book.nivell_recomanat || null,
      topic: book.tematica || null,
      genre: book.genere || null,
      summary: book.resum || null,
      location: book.ubicacio || null,
      total_copies: Number(book.exemplars || 0),
      available_copies: Number(book.disponibles || 0),
      active: book.actiu !== false
    };
  }

  function dbReservationToApp(row) {
    const book = row.books || {};
    return {
      id: row.id,
      bookId: row.book_id,
      userEmail: row.user_email,
      status: row.status,
      requestedAt: row.requested_at,
      resolvedAt: row.resolved_at,
      notes: row.notes || "",
      book: dbBookToApp({
        id: row.book_id,
        title: book.title || "",
        author: book.author || "",
        publisher: book.publisher || "",
        isbn: book.isbn || "",
        publication_year: book.publication_year || "",
        language: book.language || "Català",
        recommended_level: book.recommended_level || "",
        topic: book.topic || "",
        genre: book.genre || "",
        summary: book.summary || "",
        location: book.location || "",
        total_copies: book.total_copies || 0,
        available_copies: book.available_copies || 0,
        active: book.active !== false
      })
    };
  }

  function dbLoanToApp(row) {
    const book = row.books || {};
    return {
      id: row.id,
      bookId: row.book_id,
      reservationId: row.reservation_id,
      userEmail: row.user_email,
      status: row.status,
      loanedAt: row.loaned_at,
      dueAt: row.due_at,
      returnedAt: row.returned_at,
      notes: row.notes || "",
      book: dbBookToApp({
        id: row.book_id,
        title: book.title || "",
        author: book.author || "",
        publisher: book.publisher || "",
        isbn: book.isbn || "",
        publication_year: book.publication_year || "",
        language: book.language || "Català",
        recommended_level: book.recommended_level || "",
        topic: book.topic || "",
        genre: book.genre || "",
        summary: book.summary || "",
        location: book.location || "",
        total_copies: book.total_copies || 0,
        available_copies: book.available_copies || 0,
        active: book.active !== false
      })
    };
  }

  function dbReturnToApp(row) {
    const book = row.books || {};
    return {
      id: row.id,
      loanId: row.loan_id,
      bookId: row.book_id,
      userEmail: row.user_email,
      returnedAt: row.returned_at,
      conditionNotes: row.condition_notes || "",
      book: {
        titol: book.title || "",
        autor: book.author || "",
        ubicacio: book.location || ""
      }
    };
  }

  const optionFieldMap = {
    recommended_level: "nivell_recomanat",
    topic: "tematica",
    genre: "genere",
    location: "ubicacio"
  };

  window.BibliotecaSolSupabase = {
    isConfigured() {
      return Boolean(config.supabaseUrl && config.supabaseAnonKey);
    },
    getConfig() {
      return {
        url: config.supabaseUrl,
        anonKey: config.supabaseAnonKey
      };
    },
    async listBooks() {
      const rows = await request("/rest/v1/books?select=*&active=eq.true&order=title.asc");
      return rows.map(dbBookToApp);
    },
    async listOptions() {
      const rows = await request("/rest/v1/book_options?select=field_name,value&order=field_name.asc,value.asc");
      return rows.reduce((options, row) => {
        const field = optionFieldMap[row.field_name];
        if (!field) return options;
        options[field] = options[field] || [];
        options[field].push(row.value);
        return options;
      }, {});
    },
    async registerAccess(email) {
      const user = await request("/rest/v1/rpc/register_access", {
        method: "POST",
        body: JSON.stringify({
          user_email: email,
          user_agent_text: navigator.userAgent
        })
      });
      return {
        id: user.id,
        nom: user.display_name || String(user.email).split("@")[0],
        cognoms: "",
        email: user.email,
        rol: user.role === "gestor" ? "editor" : user.role
      };
    },
    async signInWithPassword(email, password) {
      const session = await request("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      accessToken = session.access_token || "";
      if (accessToken) sessionStorage.setItem(TOKEN_KEY, accessToken);
      return session;
    },
    signOut() {
      accessToken = "";
      sessionStorage.removeItem(TOKEN_KEY);
    },
    async reserveBook(bookId, email, note) {
      const reservation = await request("/rest/v1/rpc/reserve_book", {
        method: "POST",
        body: JSON.stringify({
          target_book_id: bookId,
          input_user_email: email,
          note: note || null
        })
      });
      if (reservation && reservation.id) {
        invokeFunction("notify-reservation", { reservation_id: reservation.id }).catch((error) => {
          console.warn("No s'ha pogut enviar l'avis de reserva.", error);
        });
      }
      return reservation;
    },
    async saveBook(book) {
      const payload = appBookToDb(book);
      if (book.id && /^[0-9a-f-]{36}$/i.test(book.id)) {
        const rows = await request(`/rest/v1/books?id=eq.${encodeURIComponent(book.id)}&select=*`, {
          method: "PATCH",
          prefer: "return=representation",
          body: JSON.stringify(payload)
        });
        return dbBookToApp(rows[0]);
      }

      const rows = await request("/rest/v1/books?select=*", {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify(payload)
      });
      return dbBookToApp(rows[0]);
    },
    async archiveBook(bookId) {
      await request(`/rest/v1/books?id=eq.${encodeURIComponent(bookId)}`, {
        method: "PATCH",
        body: JSON.stringify({ active: false })
      });
    },
    async listReservations() {
      const rows = await request("/rest/v1/reservations?select=*,books(*)&status=in.(pendent,acceptada)&order=requested_at.asc");
      return rows.map(dbReservationToApp);
    },
    async updateReservationStatus(reservationId, status) {
      const rows = await request(`/rest/v1/reservations?id=eq.${encodeURIComponent(reservationId)}&select=*`, {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify({
          status,
          resolved_at: new Date().toISOString()
        })
      });
      return rows[0];
    },
    async listLoans(status) {
      const filter = status ? `&status=eq.${encodeURIComponent(status)}` : "";
      const rows = await request(`/rest/v1/loans?select=*,books(*)&order=loaned_at.desc${filter}`);
      return rows.map(dbLoanToApp);
    },
    async listReturns() {
      const rows = await request("/rest/v1/returns?select=*,books(*)&order=returned_at.desc&limit=80");
      return rows.map(dbReturnToApp);
    },
    async registerLoan(bookId, userEmail, managerEmail, reservationId, dueAt) {
      const row = await request("/rest/v1/rpc/register_loan", {
        method: "POST",
        body: JSON.stringify({
          target_book_id: bookId,
          target_user_email: userEmail,
          manager_email: managerEmail,
          target_reservation_id: reservationId || null,
          due_date: dueAt || null
        })
      });
      return dbLoanToApp(row);
    },
    async registerReturn(loanId, managerEmail, conditionNote) {
      const row = await request("/rest/v1/rpc/register_return", {
        method: "POST",
        body: JSON.stringify({
          target_loan_id: loanId,
          manager_email: managerEmail,
          condition_note: conditionNote || null
        })
      });
      return dbReturnToApp(row);
    },
    async renewLoan(loanId, dueAt, note) {
      const rows = await request(`/rest/v1/loans?id=eq.${encodeURIComponent(loanId)}&select=*,books(*)`, {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify({
          due_at: dueAt,
          notes: note || null
        })
      });
      return dbLoanToApp(rows[0]);
    }
  };
})();
