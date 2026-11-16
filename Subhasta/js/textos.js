/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Tots els textos, icones de línia, glossari i exemples carregables de Subhasta */

export const TEXTOS = {
  appTitol: 'Subhasta',
  appSubtitol: 'Subhasta anglesa oberta en temps real per a l’aula',
  enllacCurt: 'ja.cat/subhasta',

  // Temes visuals (§9)
  temes: {
    mercat: { nom: 'Mercat', desc: 'Tons vegetals i càlids' },
    llotja: { nom: 'Llotja clara', desc: 'Fons blanc i tinta blava' },
    fosca: { nom: 'Sala fosca', desc: 'Fons fosc pensat per al projector' }
  },

  // Portada / inici
  inici: {
    entrarTitol: 'Entra a una subhasta',
    entrarDesc: 'Escriu el codi de 6 xifres que es mostra a la pantalla de l’aula.',
    codiLabel: 'Codi de la sala (6 xifres)',
    codiPlaceholder: '482 915',
    aliesLabel: 'El teu àlies o nom d’equip',
    aliesPlaceholder: 'Ex.: Anna o Equip 3',
    btnEntrarTerminal: 'Entra per participar',
    btnObrirProjeccio: 'Obre la projecció pública',
    btnCanviAparell: 'Ja hi participava · Tinc un codi de canvi d’aparell',
    codiCanviLabel: 'Codi de canvi d’aparell (4 xifres)',
    codiCanviPlaceholder: '7392',
    btnConfirmarCanvi: 'Recupera la meva cartera',
    orgTitol: 'Espai de l’organitzador',
    orgDesc: 'Prepara els objectes, obre la sala d’espera i dirigeix les licitacions.',
    btnLesMevesSubhastes: 'Les meves subhastes',
    btnNovaSubhasta: 'Crea una subhasta nova',
    btnEntraGoogle: 'Identifica’t amb Google',
    btnAssaigRapid: 'Prova ràpida amb l’exemple «Mercat industrial»'
  },

  // Missatges exactes del terminal (§7)
  terminal: {
    enviant: (imp) => `Enviant l’oferta de ${fmtNum(imp)}…`,
    lideres: (imp, queda) => `Vas primer amb ${fmtNum(imp)}. Si guanyes, et quedaran ${fmtNum(queda)}`,
    superat: (alies, imp) => `T’han superat: ${alies} ofereix ${fmtNum(imp)}`,
    avancat: (minim) => `Algú ha ofert abans. Ara el mínim és ${fmtNum(minim)}`,
    saldoInsuficient: (minim, saldo) => `El mínim és ${fmtNum(minim)} i tens ${fmtNum(saldo)}`,
    aturada: 'Ofertes aturades',
    senseConnexio: 'Sense connexió. Les dades poden ser antigues',
    compra: (unitatNom, imp, queda) => `Has comprat 1 ${unitatNom.toLowerCase()} per ${fmtNum(imp)}. Et queden ${fmtNum(queda)}`,
    esperantSeguent: 'Esperant la unitat següent',
    salaEspera: 'La subhasta començarà aviat. Revisa el repte i el catàleg.',
    carteraDeshabilitada: 'Aquesta cartera ha passat a un altre aparell o ha estat desactivada.'
  },

  // Estats de projecció (§7)
  projeccio: {
    oberta: 'OBERTA',
    aturada: 'OFERTES ATURADES',
    venut: (alies, imp, moneda) => `Venut a ${alies} per ${fmtNum(imp)} ${moneda}`,
    senseVendre: 'Sense vendre',
    sortida: (imp, moneda) => `Sortida: ${fmtNum(imp)} ${moneda}`,
    lidera: (alies) => `Lidera: ${alies}`,
    ofertaMinima: (imp) => `Oferta mínima següent: ${fmtNum(imp)}`,
    ultimesOfertes: 'Últimes ofertes:',
    despres: (nom) => `Després: ${nom}`,
    esperantUnitat: 'Esperant la unitat següent'
  },

  // Glossari per a la sala d'espera i ajuda (§8)
  glossari: [
    {
      terme: 'Subhasta anglesa',
      definicio: 'Subhasta oberta on les ofertes pugen pas a pas i guanya qui fa l’oferta més alta quan es tanca.'
    },
    {
      terme: 'Licitar i oferta (o dita)',
      definicio: 'Oferir un import superior a l’actual per intentar aconseguir la unitat que es ven. En català tradicional, cada oferta també s’anomena «dita».'
    },
    {
      terme: 'Increment mínim',
      definicio: 'Quantitat mínima que cal afegir per superar l’oferta anterior. Totes les ofertes segueixen múltiples d’aquest increment.'
    },
    {
      terme: 'Adjudicar',
      definicio: 'Confirmar la venda de la unitat a la persona o equip que lidera en el moment d’aturar les ofertes.'
    },
    {
      terme: 'Cost d’oportunitat',
      definicio: 'Allò a què renuncies quan gastes una part del pressupost en una unitat i ja no la pots destinar a les següents.'
    }
  ],

  // Tres preguntes de tancament (§4 i §7)
  preguntesReflexio: [
    'Quin objecte s’ha encarit més i per què?',
    'A què has renunciat per fer una compra?',
    'Què canviaries si ho repetíssim?'
  ],

  // Privadesa (§10)
  privadesa: {
    titol: 'Privadesa i conservació de dades',
    resum: 'L’alumnat no introdueix cap dada personal: només un àlies triat per a la sessió i un identificador tècnic anònim. L’organitzador s’identifica amb el seu compte autoritzat. Les dades es desen a Firebase Firestore dins la Unió Europea (regió eur3) i caduquen automàticament al cap de 30 dies de finalitzar la sessió o de l’última activitat.'
  }
};

export function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Math.round(Number(n)).toLocaleString('ca-ES');
}

/* Biblioteca d'icones de línia integrades (sense emojis, traç net i càlid) */
export const ICONES = {
  carbo: {
    nom: 'Carbó',
    svg: '<path d="M5 16l3-8 6-3 5 4 1 7-6 4-9-4z"/><path d="M8 8l6 5 6-2"/><path d="M14 13v7"/>'
  },
  ferro: {
    nom: 'Ferro',
    svg: '<path d="M4 17l3-9h10l3 9H4z"/><path d="M7 12h10"/><path d="M9 8V6h6v2"/>'
  },
  coto: {
    nom: 'Cotó',
    svg: '<path d="M12 21v-6"/><path d="M9 17c-2.5 0-4.5-2-4.5-4.5 0-1.8 1.1-3.4 2.7-4.1C7.6 6.4 9.6 5 12 5s4.4 1.4 4.8 3.4c1.6.7 2.7 2.3 2.7 4.1 0 2.5-2 4.5-4.5 4.5H9z"/>'
  },
  fusta: {
    nom: 'Fusta',
    svg: '<ellipse cx="7" cy="12" rx="3" ry="6"/><path d="M7 6h11c1.7 0 3 2.7 3 6s-1.3 6-3 6H7"/><circle cx="7" cy="12" r="1"/><path d="M12 9h5M13 15h4"/>'
  },
  blat: {
    nom: 'Cereals',
    svg: '<path d="M12 21V5"/><path d="M12 8c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4z"/><path d="M12 12c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4z"/><path d="M12 16c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4z"/><path d="M12 8c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4z"/><path d="M12 12c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4z"/><path d="M12 16c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4z"/>'
  },
  aigua: {
    nom: 'Aigua',
    svg: '<path d="M12 3s7 7.8 7 12.5A7 7 0 0 1 5 15.5C5 10.8 12 3 12 3z"/><path d="M9.5 16.5a3.5 3.5 0 0 0 3.5 2"/>'
  },
  energia: {
    nom: 'Energia',
    svg: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>'
  },
  maquina: {
    nom: 'Maquinària',
    svg: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
  },
  vaixell: {
    nom: 'Comerç marítim',
    svg: '<path d="M3 17h18l-2 4H5l-2-4z"/><path d="M12 4v13"/><path d="M12 5l6 9h-6"/><path d="M12 7l-5 7h5"/>'
  },
  llibre: {
    nom: 'Coneixement',
    svg: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'
  },
  ciutat: {
    nom: 'Infraestructura',
    svg: '<path d="M3 21h18"/><path d="M5 21V8l6-3v16"/><path d="M11 10h8v11"/><path d="M8 10v.01M8 14v.01M15 14v.01M15 17v.01"/>'
  },
  estrella: {
    nom: 'Innovació',
    svg: '<polygon points="12 3 14.8 8.7 21 9.6 16.5 14 17.6 20.2 12 17.3 6.4 20.2 7.5 14 3 9.6 9.2 8.7 12 3"/>'
  }
};

export function renderIconaSvg(clauIcona, imatgeDataUrl = null, classe = 'ic-obj') {
  if (imatgeDataUrl && typeof imatgeDataUrl === 'string' && imatgeDataUrl.startsWith('data:image/')) {
    return `<img class="${classe} ic-obj-img" src="${imatgeDataUrl}" alt="" aria-hidden="true">`;
  }
  const spec = ICONES[clauIcona] || ICONES.carbo;
  return `<svg class="${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${spec.svg}</svg>`;
}

/* Exemple carregable oficial (§4): «Mercat industrial» */
export const EXEMPLE_MERCAT_INDUSTRIAL = {
  titol: 'Mercat industrial',
  repte: 'Sou una fàbrica. Necessiteu carbó, ferro, cotó i fusta per produir. Cada moneda que us sobri també compta.',
  pressupost: 1000,
  moneda: 'monedes',
  increment: 10,
  puntuacioActiva: true,
  bonificacioConjunt: 200,
  objectes: [
    {
      id: 'obj-carbo',
      nom: 'Carbó',
      descripcio: 'Combustible per a les màquines de vapor.',
      icona: 'carbo',
      imatgeDataUrl: null,
      quantitat: 4,
      preuSortida: 20,
      valor: 180
    },
    {
      id: 'obj-ferro',
      nom: 'Ferro',
      descripcio: 'Metall essencial per a telers, calderes i vies.',
      icona: 'ferro',
      imatgeDataUrl: null,
      quantitat: 3,
      preuSortida: 30,
      valor: 210
    },
    {
      id: 'obj-coto',
      nom: 'Cotó',
      descripcio: 'Matèria primera per a la indústria tèxtil.',
      icona: 'coto',
      imatgeDataUrl: null,
      quantitat: 3,
      preuSortida: 20,
      valor: 190
    },
    {
      id: 'obj-fusta',
      nom: 'Fusta',
      descripcio: 'Estructura, embalatge i suport de taller.',
      icona: 'fusta',
      imatgeDataUrl: null,
      quantitat: 4,
      preuSortida: 10,
      valor: 140
    }
  ]
};
