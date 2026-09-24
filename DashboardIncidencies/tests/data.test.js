import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanRows,
  parseCsv,
  sheetCsvUrl,
  normalizeCourse,
  loadSheet,
} from "../src/data.js";

test("l’enllaç normal apunta a Buidat i fixa una sola fila de capçalera", () => {
  assert.match(
    sheetCsvUrl(
      "https://docs.google.com/spreadsheets/d/abc_123/edit?gid=99#gid=99",
    ),
    /sheet=Buidat&headers=1$/,
  );
  assert.throws(() =>
    sheetCsvUrl("https://example.org/spreadsheets/d/abc/edit"),
  );
});

test("el CSV conserva comes, cometes i salts de línia dins de cel·les", () => {
  assert.deepEqual(parseCsv('A,B\r\n"C, D","Una ""cita""\ni més"\r\n'), [
    ["A", "B"],
    ["C, D", 'Una "cita"\ni més'],
  ]);
});

test("neteja dades reals de format, normalitza i informa de files descartades", () => {
  const csv =
    ',Alumne,Curs,Tipus,Quantitat\n,"Cognoms, Nom",3r d\'ESO,Faltes respecte,-\n,Altra persona,1rESO,Absències,62\n,X,2nESO,Tipus nou,2\n,Y,4tESO,,2\n';
  assert.deepEqual(cleanRows(csv), {
    data: [
      {
        student: "Cognoms, Nom",
        course: "3r ESO",
        type: "Falta de respecte",
        quantity: 1,
      },
      {
        student: "Altra persona",
        course: "1r ESO",
        type: "Absències",
        quantity: 62,
      },
    ],
    unknown: [["Tipus nou", 1]],
    missingQuantity: 1,
    invalidRows: 0,
  });
  assert.equal(normalizeCourse("Quart d’ESO"), "4t ESO");
});

test("mostra errors de format i d’accés útils", async () => {
  assert.throws(() => cleanRows("A,B\n1,2"), /columnes Alumne/);
  await assert.rejects(
    loadSheet("https://docs.google.com/spreadsheets/d/abc/edit", async () => ({
      ok: false,
      status: 403,
    })),
    /403/,
  );
});
