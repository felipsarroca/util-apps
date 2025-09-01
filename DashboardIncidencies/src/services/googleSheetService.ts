export const transformGoogleSheetUrl = (url: string): string | null => {
  const idRegex = /\/d\/(.*?)\//;
  const gidRegex = /gid=([0-9]+)/;

  const idMatch = url.match(idRegex);
  const gidMatch = url.match(gidRegex);

  if (idMatch && idMatch[1] && gidMatch && gidMatch[1]) {
    const id = idMatch[1];
    const gid = gidMatch[1];
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  }
  
  return null;
};

export const fetchSheetData = async (url: string): Promise<string> => {
  const csvUrl = transformGoogleSheetUrl(url);
  
  if (!csvUrl) {
    throw new Error("L'URL del Google Sheet no és vàlida. Assegura't que conté '/d/...' i 'gid=...'.");
  }

  try {
    const response = await fetch(csvUrl);
    if (!response.ok) {
      if (response.status === 400 || response.status === 404) {
         throw new Error("No s'ha pogut accedir a la fulla. Verifica que l'URL és correcta i que la pestanya 'Buidat' existeix.");
      }
      throw new Error(`Error en accedir a la fulla (HTTP ${response.status}).`);
    }
    return await response.text();
  } catch (error) {
    // This often catches CORS errors
    if (error instanceof TypeError) {
       throw new Error("Error de xarxa o CORS. Assegura't que la fulla de càlcul està configurada com a 'Pública a la web' a 'Fitxer > Compartir > Publica a la web'.");
    }
    throw error; // Re-throw other errors
  }
};