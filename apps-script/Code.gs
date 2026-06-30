/**
 * Test de Inteligencia CHC — Servidor (Google Apps Script)
 * ---------------------------------------------------------
 * Web App que sirve un test de CI adaptativo (CAT) basado en la teoría
 * Cattell–Horn–Carroll, puntuado con Teoría de Respuesta al Ítem (IRT, 3PL),
 * normado por edad y convertido a escala CI (media 100, desviación 15).
 *
 * Persistencia: guarda cada resultado en una hoja de cálculo de Google Sheets.
 * Si la hoja/columnas no existen, las crea automáticamente.
 *
 * Cómo se localiza la hoja de cálculo (en este orden):
 *   1) Si el script está ENLAZADO a una hoja (container-bound): usa la activa.
 *   2) Si existe una propiedad de script 'SPREADSHEET_ID': la usa.
 *   3) Si no, crea una hoja nueva llamada "Resultados Test CHC" y guarda su ID.
 *
 * Puedes fijar manualmente una hoja existente ejecutando setSpreadsheetId('ID').
 */

// ----------------------------------------------------------------------------
// Configuración
// ----------------------------------------------------------------------------
var CFG = {
  SPREADSHEET_NAME: 'Resultados Test CHC',
  SHEET_RESULTS: 'Resultados',
  SHEET_DETAIL: 'Respuestas_Detalle',
  PROP_SPREADSHEET_ID: 'SPREADSHEET_ID'
};

var RESULT_HEADERS = [
  'Marca temporal', 'ID Sesión', 'Nombre', 'Edad', 'Género',
  'CI Total', 'Error Estándar', 'IC95 Inferior', 'IC95 Superior',
  'Percentil', 'Clasificación',
  'Índice Gf (Fluida)', 'Índice Gc (Cristalizada)', 'Índice Gwm (Mem. Trabajo)',
  'Índice Gs (Velocidad)', 'Índice Gv (Visoespacial)',
  'Theta (θ)', 'Ítems Administrados', 'Tiempo Total (s)',
  'Fortalezas', 'Debilidades', 'Detalle (JSON)'
];

var DETAIL_HEADERS = [
  'Marca temporal', 'ID Sesión', 'N° Ítem', 'Dominio', 'Tipo',
  'Dificultad (b)', 'Discriminación (a)', 'Correcto', 'Tiempo (ms)',
  'θ tras el ítem', 'EE tras el ítem'
];

// ----------------------------------------------------------------------------
// Punto de entrada de la Web App
// ----------------------------------------------------------------------------
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Test de Inteligencia CHC')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Permite incluir archivos HTML parciales (CSS / JS) dentro de Index.html. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ----------------------------------------------------------------------------
// Localización / creación de la hoja de cálculo
// ----------------------------------------------------------------------------
function getResultsSpreadsheet_() {
  // 1) Script enlazado a una hoja.
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {
    // Standalone: no hay hoja activa, se continúa.
  }

  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(CFG.PROP_SPREADSHEET_ID);

  // 2) ID guardado previamente.
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      // El ID guardado ya no es válido; se recreará.
      props.deleteProperty(CFG.PROP_SPREADSHEET_ID);
    }
  }

  // 3) Crear una hoja nueva y recordar su ID.
  var ss = SpreadsheetApp.create(CFG.SPREADSHEET_NAME);
  props.setProperty(CFG.PROP_SPREADSHEET_ID, ss.getId());
  return ss;
}

/** Devuelve (o crea) una hoja con la cabecera indicada. */
function getOrCreateSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  // Garantiza que la fila de cabecera exista y coincida.
  var needHeader = sheet.getLastRow() === 0;
  if (!needHeader) {
    var firstCell = sheet.getRange(1, 1).getValue();
    needHeader = !firstCell;
  }
  if (needHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold')
      .setBackground('#1a237e')
      .setFontColor('#ffffff')
      .setVerticalAlignment('middle');
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 28);
  }
  return sheet;
}

// ----------------------------------------------------------------------------
// Guardado de resultados (llamado desde el cliente vía google.script.run)
// ----------------------------------------------------------------------------
/**
 * @param {Object} payload Resultado completo del test.
 * @return {Object} { ok: true, spreadsheetUrl, spreadsheetId, row }
 */
function saveResult(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    // Si no se obtiene el lock, igual intentamos escribir (mejor que perder el dato).
  }

  try {
    var ss = getResultsSpreadsheet_();
    var resSheet = getOrCreateSheet_(ss, CFG.SHEET_RESULTS, RESULT_HEADERS);
    var detSheet = getOrCreateSheet_(ss, CFG.SHEET_DETAIL, DETAIL_HEADERS);

    var ts = new Date();
    var p = payload || {};
    var d = p.domains || {};
    var sid = p.sessionId || Utilities.getUuid();

    var row = [
      ts,
      sid,
      p.name || '',
      p.age || '',
      p.gender || '',
      numOrBlank_(p.iq),
      numOrBlank_(p.se),
      numOrBlank_(p.ciLow),
      numOrBlank_(p.ciHigh),
      numOrBlank_(p.percentile),
      p.classification || '',
      indexOrBlank_(d.Gf),
      indexOrBlank_(d.Gc),
      indexOrBlank_(d.Gwm),
      indexOrBlank_(d.Gs),
      indexOrBlank_(d.Gv),
      numOrBlank_(p.theta),
      numOrBlank_(p.itemsAdministered),
      numOrBlank_(p.totalTimeSec),
      (p.strengths || []).join(', '),
      (p.weaknesses || []).join(', '),
      JSON.stringify(p.detail || {})
    ];
    resSheet.appendRow(row);

    // Detalle por ítem (una fila por ítem respondido).
    var items = (p.detail && p.detail.items) || [];
    if (items.length) {
      var detailRows = items.map(function (it, i) {
        return [
          ts, sid, i + 1,
          it.domain || '', it.type || '',
          numOrBlank_(it.b), numOrBlank_(it.a),
          it.correct ? 'Sí' : 'No',
          numOrBlank_(it.timeMs),
          numOrBlank_(it.thetaAfter),
          numOrBlank_(it.seAfter)
        ];
      });
      detSheet.getRange(detSheet.getLastRow() + 1, 1, detailRows.length, DETAIL_HEADERS.length)
        .setValues(detailRows);
    }

    return {
      ok: true,
      spreadsheetUrl: ss.getUrl(),
      spreadsheetId: ss.getId(),
      row: resSheet.getLastRow()
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function numOrBlank_(v) {
  return (v === null || v === undefined || v === '' || isNaN(v)) ? '' : Number(v);
}
function indexOrBlank_(dom) {
  return (dom && dom.index != null && !isNaN(dom.index)) ? Number(dom.index) : '';
}

// ----------------------------------------------------------------------------
// Utilidades administrativas (ejecutar manualmente desde el editor)
// ----------------------------------------------------------------------------
/** Fija manualmente la hoja de cálculo donde se guardarán los resultados. */
function setSpreadsheetId(id) {
  PropertiesService.getScriptProperties().setProperty(CFG.PROP_SPREADSHEET_ID, id);
  return 'OK: SPREADSHEET_ID = ' + id;
}

/** Crea la hoja y su formato de inmediato; devuelve la URL para abrirla. */
function setupSpreadsheet() {
  var ss = getResultsSpreadsheet_();
  getOrCreateSheet_(ss, CFG.SHEET_RESULTS, RESULT_HEADERS);
  getOrCreateSheet_(ss, CFG.SHEET_DETAIL, DETAIL_HEADERS);
  Logger.log('Hoja lista: ' + ss.getUrl());
  return ss.getUrl();
}

/** Devuelve la URL de la hoja activa de resultados (diagnóstico). */
function getSpreadsheetUrl() {
  var ss = getResultsSpreadsheet_();
  return ss.getUrl();
}
