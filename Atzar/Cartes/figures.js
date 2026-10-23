/* Figures de les cartes (SVG de 100 × 150): sota, cavall i rei de la baralla espanyola,
   i valet, reina i rei de doble cap de la francesa. */
(() => {
  "use strict";
  const C = {
    ink: "#2b2118",
    skin: "#f6d2ae",
    cheek: "#e9a68a",
    gold: "#e7b53b",
    goldDark: "#b07f1c",
    red: "#c8372d",
    blue: "#2e5c9e",
    green: "#3d7f4a",
    white: "#fffdf6",
    beard: "#ece6d8",
    hair: "#7a4b22",
    blond: "#e2b04a",
    horse: "#efe7d6",
    steel: "#cfdde3",
  };
  // Colors de la roba de cada pal: [principal, secundari].
  const DRESS = {
    oros: [C.red, C.blue],
    copes: [C.blue, C.red],
    espases: [C.green, C.red],
    bastos: [C.red, C.green],
    cors: [C.red, C.blue],
    diamants: [C.blue, C.red],
    piques: [C.blue, C.red],
    trevols: [C.red, C.green],
  };
  const LINE = `stroke="${C.ink}" stroke-width=".7" stroke-linejoin="round" stroke-linecap="round"`;
  const ermine = (pts) => pts.map(([x, y]) => `<path d="M${x} ${y}v1.8" stroke="${C.ink}" stroke-width=".9"/>`).join("");

  function face(cx, cy, { beard = false, smile = true, hair = C.hair, long = false } = {}) {
    return `
      ${long ? `<path d="M${cx - 9} ${cy - 3}C${cx - 12} ${cy + 8} ${cx - 11} ${cy + 18} ${cx - 8} ${cy + 22}H${cx + 8}C${cx + 11} ${cy + 18} ${cx + 12} ${cy + 8} ${cx + 9} ${cy - 3}Z" fill="${hair}" ${LINE}/>` : ""}
      <path d="M${cx - 8.5} ${cy}c0 6.5 3.6 10.5 8.5 10.5s8.5-4 8.5-10.5c0-6.2-3.6-9.5-8.5-9.5s-8.5 3.3-8.5 9.5z" fill="${C.skin}" ${LINE}/>
      <path d="M${cx - 8.5} ${cy + 0.5}c0-7 3.8-10.5 8.5-10.5s8.5 3.5 8.5 10.5c-1.2-3.6-3.5-5.2-8.5-5.4-5 .2-7.3 1.8-8.5 5.4z" fill="${hair}" ${LINE}/>
      <circle cx="${cx - 5.2}" cy="${cy + 4.6}" r="1.6" fill="${C.cheek}" opacity=".55"/><circle cx="${cx + 5.2}" cy="${cy + 4.6}" r="1.6" fill="${C.cheek}" opacity=".55"/>
      <path d="M${cx - 5} ${cy - 0.2}q1.6-1 3.2 0M${cx + 1.8} ${cy - 0.2}q1.6-1 3.2 0" fill="none" ${LINE}/>
      <circle cx="${cx - 3.4}" cy="${cy + 1.6}" r=".85" fill="${C.ink}"/><circle cx="${cx + 3.4}" cy="${cy + 1.6}" r=".85" fill="${C.ink}"/>
      <path d="M${cx} ${cy + 1.8}l-.9 3.6h1.6" fill="none" ${LINE}/>
      ${
        beard
          ? `<path d="M${cx - 8.2} ${cy + 2.5}c.4 8 3.5 13 8.2 13.5 4.7-.5 7.8-5.5 8.2-13.5-1.6 3.5-3.6 5.4-5 5.6-1.2-1.3-2-1.6-3.2-1.6s-2 .3-3.2 1.6c-1.4-.2-3.4-2.1-5-5.6z" fill="${C.beard}" ${LINE}/><path d="M${cx - 3.2} ${cy + 7.6}q3.2 1.6 6.4 0" fill="none" ${LINE}/>`
          : smile
            ? `<path d="M${cx - 2.4} ${cy + 7}q2.4 1.8 4.8 0" fill="none" ${LINE}/>`
            : `<path d="M${cx - 2} ${cy + 7.2}h4" fill="none" ${LINE}/>`
      }`;
  }
  function crown(cx, y, w = 20, h = 11) {
    const l = cx - w / 2,
      r = cx + w / 2;
    return `<path d="M${l} ${y + h}V${y + 2}l${w * 0.2} ${h * 0.45} ${w * 0.3} -${h * 0.7} ${w * 0.3} ${h * 0.7} ${w * 0.2} -${h * 0.45}V${y + h}z" fill="${C.gold}" ${LINE}/>
      <rect x="${l}" y="${y + h - 3}" width="${w}" height="3.2" fill="${C.goldDark}" ${LINE}/>
      <circle cx="${cx}" cy="${y + h - 1.4}" r="1.2" fill="${C.red}"/><circle cx="${l + w * 0.22}" cy="${y + h - 1.4}" r=".9" fill="${C.blue}"/><circle cx="${r - w * 0.22}" cy="${y + h - 1.4}" r=".9" fill="${C.blue}"/>
      <circle cx="${l}" cy="${y + 2}" r="1" fill="${C.gold}" ${LINE}/><circle cx="${cx}" cy="${y - h * 0.4 + 2}" r="1.2" fill="${C.gold}" ${LINE}/><circle cx="${r}" cy="${y + 2}" r="1" fill="${C.gold}" ${LINE}/>`;
  }
  // L'objecte del pal a la mà: espases i bastos, llargs i inclinats; oros i copes, a l'altura del pit.
  function held(use, suit, x, y, size, tilt = 0) {
    return `<g transform="rotate(${tilt} ${x} ${y})">${use(`suit-${suit}`, x, y, size)}</g>`;
  }
  const long = (suit) => suit === "espases" || suit === "bastos";

  /* Baralla espanyola: figures de cos sencer. */
  function spanish(rank, suit, use) {
    const [main, second] = DRESS[suit];
    if (rank === 12) {
      const item = long(suit) ? held(use, suit, 71, 60, 34, 12) : held(use, suit, 70, 66, 19);
      return `
        <path d="M33 53Q50 47 67 53L79 133Q50 139 21 133Z" fill="${second}" ${LINE}/>
        <path d="M38 55Q50 51 62 55L70 132Q50 136 30 132Z" fill="${main}" ${LINE}/>
        <path d="M46.5 58H53.5L55.5 132.5Q50 133.4 44.5 132.5Z" fill="${C.gold}" ${LINE}/>
        <g fill="${C.red}">${[70, 80, 100, 110, 121].map((y) => `<path d="M50 ${y - 2.2}l2 2.2-2 2.2-2-2.2z"/>`).join("")}</g>
        <path d="M35.5 86H64.5L65 91H35Z" fill="${C.gold}" ${LINE}/>
        <rect x="47.5" y="85.4" width="5" height="6.2" rx="1" fill="${C.goldDark}" ${LINE}/>
        <path d="M33 53Q50 63 67 53L68 59Q50 71 32 59Z" fill="${C.white}" ${LINE}/>${ermine([[38, 59], [44, 62.5], [50, 64], [56, 62.5], [62, 59]])}
        <path d="M37 57Q28 69 30 85L36 85Q36 71 41 62Z" fill="${main}" ${LINE}/><circle cx="33" cy="87.5" r="3.2" fill="${C.skin}" ${LINE}/>
        ${item}
        <path d="M63 57Q72 63 71 75L65 76Q66 67 59 62Z" fill="${main}" ${LINE}/><circle cx="68.5" cy="77" r="3.2" fill="${C.skin}" ${LINE}/>
        <ellipse cx="44" cy="134.5" rx="5" ry="2.3" fill="${C.ink}"/><ellipse cx="56" cy="134.5" rx="5" ry="2.3" fill="${C.ink}"/>
        ${face(50, 39, { beard: true })}
        ${crown(50, 20, 20, 12)}`;
    }
    if (rank === 10) {
      const item = long(suit) ? held(use, suit, 29, 74, 36, -14) : held(use, suit, 30, 74, 20);
      return `
        <path d="M41.5 98H47.5L47 131H42Z" fill="${second}" ${LINE}/><path d="M52.5 98H58.5L58 131H53Z" fill="${C.gold}" ${LINE}/>
        <ellipse cx="44" cy="133" rx="5" ry="2.4" fill="${C.ink}"/><ellipse cx="56" cy="133" rx="5" ry="2.4" fill="${C.ink}"/>
        <path d="M38 55Q50 50 62 55L67 99Q50 104 33 99Z" fill="${main}" ${LINE}/>
        <path d="M33.4 95Q50 100 66.6 95L67 99Q50 104 33 99Z" fill="${C.gold}" ${LINE}/>
        <path d="M44 56L50 66 56 56" fill="none" stroke="${C.gold}" stroke-width="2"/>
        <path d="M36 77H64L64.4 81.5H35.6Z" fill="${C.gold}" ${LINE}/>
        <path d="M41 53Q50 58 59 53L60 57Q50 62 40 57Z" fill="${C.white}" ${LINE}/>
        <path d="M38.5 57Q31 67 32 79L38 78Q37.5 69 43 62Z" fill="${second}" ${LINE}/><circle cx="35" cy="80.5" r="3" fill="${C.skin}" ${LINE}/>
        ${item}
        <path d="M61.5 57Q70 65 66 78L61 76Q63.5 68 57 62Z" fill="${second}" ${LINE}/><circle cx="63.5" cy="78.5" r="3" fill="${C.skin}" ${LINE}/>
        ${face(50, 40, { hair: C.hair })}
        <path d="M37.5 33Q50 24 62.5 33Q50 30 37.5 33Z" fill="${second}" ${LINE}/>
        <ellipse cx="50" cy="31.5" rx="11.5" ry="3.6" fill="${second}" ${LINE}/>
        <path d="M58 30Q68 24 66 13" fill="none" stroke="${C.white}" stroke-width="2.4" stroke-linecap="round"/><path d="M58 30Q68 24 66 13" fill="none" stroke="${C.ink}" stroke-width=".5"/>`;
    }
    // Cavall: genet amb l'objecte enlaire sobre un cavall que camina cap a l'esquerra.
    const item = long(suit) ? held(use, suit, 72, 40, 32, 18) : held(use, suit, 73, 44, 18);
    return `
      <path d="M79 84C88 88 89 102 85 112C83 104 82 96 77 92Z" fill="${C.hair}" ${LINE}/>
      <path d="M66 100L64 126H69L72 101ZM74 98L76 124H81L80 97Z" fill="${C.horse}" ${LINE}/>
      <path d="M30 98L27 125H32L36 100ZM39 100L40 126H45L46 100Z" fill="${C.horse}" ${LINE}/>
      <path d="M26 124h7v4h-7zM39 125h7v4h-7zM63 125h7v4h-7zM75 123h7v4h-7z" fill="${C.ink}"/>
      <path d="M28 88C28 80 36 77 48 78L70 78C80 78 83 86 81 94C80 100 75 104 67 104L38 104C31 104 28 98 28 92Z" fill="${C.horse}" ${LINE}/>
      <path d="M34 86C29 77 27 68 29 58L40 55C41 64 43 72 47 79Z" fill="${C.horse}" ${LINE}/>
      <path d="M29 58C25 56 18 60 14 67C13 70 15 73 18 72.5L27 71C31 69.5 35 65 37 58Z" fill="${C.horse}" ${LINE}/>
      <path d="M32 56L34 48.5L37.5 56Z" fill="${C.horse}" ${LINE}/>
      <path d="M38 55C41 62 43 70 47 77L44 79C40 72 38 64 35 56Z" fill="${C.hair}" ${LINE}/>
      <circle cx="25.5" cy="62" r=".9" fill="${C.ink}"/><path d="M15.5 69.5q1.5-.6 2.6.4" fill="none" ${LINE}/>
      <path d="M17 66L36 74" fill="none" stroke="${C.goldDark}" stroke-width="1.1"/>
      <path d="M44 80H70L72 96Q57 101 42 96Z" fill="${second}" ${LINE}/>
      <path d="M42 96Q57 101 72 96" fill="none" stroke="${C.gold}" stroke-width="1.8"/>
      <path d="M50 82L48 98H53L56 84Z" fill="${main}" ${LINE}/><ellipse cx="50" cy="99.5" rx="3.6" ry="1.8" fill="${C.ink}"/>
      <path d="M48 58Q56 54 64 58L66 84H46Z" fill="${main}" ${LINE}/>
      <path d="M46 78H66V82H46Z" fill="${C.gold}" ${LINE}/>
      <path d="M49 58Q46 66 40 70L42 74Q50 70 53 62Z" fill="${main}" ${LINE}/><circle cx="40.5" cy="72" r="2.6" fill="${C.skin}" ${LINE}/>
      <path d="M41 72L30 64" stroke="${C.goldDark}" stroke-width="1"/>
      ${item}
      <path d="M62 59Q69 55 71 49L67 47Q64 52 59 54Z" fill="${main}" ${LINE}/><circle cx="70" cy="47" r="2.6" fill="${C.skin}" ${LINE}/>
      ${face(56, 45, { hair: C.hair })}
      <ellipse cx="56" cy="37" rx="12" ry="2.6" fill="${second}" ${LINE}/>
      <path d="M49 37Q50 28 56 28Q62 28 63 37Z" fill="${second}" ${LINE}/>
      <path d="M49.5 34.5H62.5" stroke="${C.gold}" stroke-width="1.4"/>`;
  }

  /* Baralla francesa: mitja figura i la mateixa capgirada, separades per una diagonal. */
  function french(rank, suit, use, color) {
    const [main, second] = DRESS[suit];
    let half;
    if (rank === 13) {
      half = `
        <path d="M30 18L36 70" stroke="${C.steel}" stroke-width="2.6" stroke-linecap="round"/><path d="M30 18L36 70" stroke="${C.ink}" stroke-width=".5"/>
        <path d="M27 58.5L39 57" stroke="${C.gold}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M15 84L16 62Q24 52 38 50H62Q76 52 84 62L85 84Z" fill="${main}" ${LINE}/>
        <path d="M47 52H53L56 84H44Z" fill="${C.gold}" ${LINE}/>
        <path d="M15.5 64Q32 68 37 84H15Z" fill="${second}" ${LINE}/><path d="M84.5 64Q68 68 63 84H85Z" fill="${second}" ${LINE}/>
        <path d="M36 51Q50 61 64 51L66 56Q50 68 34 56Z" fill="${C.white}" ${LINE}/>${ermine([[40, 56], [46, 59.5], [54, 59.5], [60, 56]])}
        <circle cx="36" cy="66" r="3" fill="${C.skin}" ${LINE}/>
        ${face(50, 35, { beard: true, hair: C.blond })}
        ${crown(50, 15, 22, 12)}`;
    } else if (rank === 12) {
      half = `
        <path d="M15 84L16 62Q24 52 38 50H62Q76 52 84 62L85 84Z" fill="${main}" ${LINE}/>
        <path d="M39 52Q50 62 61 52L64 84H36Z" fill="${second}" ${LINE}/>
        <path d="M41 54Q50 63 59 54" fill="none" stroke="${C.gold}" stroke-width="1.6"/>
        <path d="M44 62H56M45 67H55M46 72H54" stroke="${C.gold}" stroke-width="1"/>
        <path d="M66 68L69 50" stroke="${C.green}" stroke-width="1.4"/><path d="M67.5 58q4-2 5 1q-3 2-5-1z" fill="${C.green}" ${LINE}/>
        <circle cx="69.3" cy="48" r="3.6" fill="${C.red}" ${LINE}/><path d="M67.5 47.5q1.8-1.6 3.6 0q-1.8 1.8-3.6 0z" fill="none" ${LINE}/>
        <circle cx="65.5" cy="68.5" r="3" fill="${C.skin}" ${LINE}/>
        ${face(50, 35, { long: true, hair: C.blond })}
        <path d="M40.5 31Q50 22 59.5 31" fill="none" stroke="${C.white}" stroke-width="1.6"/>
        ${crown(50, 17, 16, 9)}`;
    } else {
      half = `
        <path d="M70 14L64 70" stroke="${C.hair}" stroke-width="2" stroke-linecap="round"/>
        <path d="M70 14L76 18L74 26L68 26Z" fill="${C.steel}" ${LINE}/>
        <path d="M15 84L16 62Q24 52 38 50H62Q76 52 84 62L85 84Z" fill="${main}" ${LINE}/>
        <path d="M40 52H60V84H40Z" fill="${C.gold}" ${LINE}/>
        <path d="M40 58H60M40 64H60M40 70H60M40 76H60" stroke="${second}" stroke-width="1.6"/>
        <path d="M40 52Q50 60 60 52" fill="${C.white}" ${LINE}/>
        <circle cx="64.5" cy="66" r="3" fill="${C.skin}" ${LINE}/>
        ${face(50, 36, { hair: C.hair })}
        <path d="M37 30Q38 19 50 19Q62 19 63 30Z" fill="${second}" ${LINE}/>
        <path d="M37 30H63L64 32.5H36Z" fill="${C.gold}" ${LINE}/>
        <path d="M60 22Q70 16 74 22" fill="none" stroke="${C.white}" stroke-width="2.6" stroke-linecap="round"/>`;
    }
    const pip = use(`suit-${suit}`, 25, 26, 10),
      clip = `fr-${rank}-${suit}`;
    // Reduïda perquè els índexs de les cantonades quedin fora del marc.
    return `<g transform="translate(50 75) scale(.82) translate(-50 -75)">
      <rect x="15" y="13" width="70" height="124" rx="3" fill="${C.white}" stroke="${color}" stroke-width="1.4"/>
      <clipPath id="${clip}"><path d="M15 13H85V69L15 81Z"/></clipPath>
      <g clip-path="url(#${clip})">${half}${pip}</g>
      <g transform="rotate(180 50 75)"><g clip-path="url(#${clip})">${half}${pip}</g></g>
      <path d="M15 81L85 69" stroke="${color}" stroke-width="1.4"/>
      <rect x="15" y="13" width="70" height="124" rx="3" fill="none" stroke="${color}" stroke-width="1.4"/>
    </g>`;
  }

  window.CartesFigures = { spanish, french };
})();
