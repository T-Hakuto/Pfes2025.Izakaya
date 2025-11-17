// ページを1分ごとに自動更新
setInterval(() => {
  location.reload();
}, 60000); // 60000ミリ秒 = 1分

// シンプルなレンダリング：reservations.json を読み込み、残席を表示する
document.addEventListener('DOMContentLoaded', ()=>{
  const statusList = document.getElementById('status-list');
  const reserveLink = document.getElementById('reserve-link');

  // ここに外部フォームの URL を入れてください（例: Googleフォーム）
  const externalFormUrl = 'https://forms.gle/VsKbDMhrxh1zmqjP9';
  reserveLink.href = externalFormUrl;
  // 外部フォームは新しいタブで開く（安全のため rel を設定）
  reserveLink.target = '_blank';
  reserveLink.rel = 'noopener noreferrer';

  // オプション: Google スプレッドシートを公開(CSV)して使う場合はここに CSV の URL を入れてください。
  // 例: const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/xxxxx/pub?output=csv';
  const SHEET_CSV_URL = '';

  // 汎用的にデータを取得する
  (SHEET_CSV_URL ? fetchSheetCsv(SHEET_CSV_URL) : fetchJson('reservations.json'))
    .then(data=>{ renderStatus(); setDebugInfo(SHEET_CSV_URL ? 'Google Sheet (CSV)' : 'reservations.json', data); })
    .catch(err=>{ statusList.textContent = '予約状況の読み込みに失敗しました。ローカルで開く場合は簡易サーバーで表示してください。'; console.error(err)});

  // debug helper to show what data was loaded
  // デバッグ情報を非表示にする
  function setDebugInfo(source, data) {
    const dbg = document.getElementById('debug-info');
    if (!dbg) return;
    dbg.style.display = 'none'; // デバッグ情報を非表示に設定
  }

  function fetchJson(url){
    // キャッシュ回避のためタイムスタンプを付与
    const u = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
    return fetch(u).then(r=>{ if(!r.ok) throw new Error(url + ' を取得できませんでした'); return r.json(); });
  }

  // Google スプレッドシートを公開(CSV)して使う場合のパーサー
  async function fetchSheetCsv(csvUrl){
    const r = await fetch(csvUrl);
    if(!r.ok) throw new Error('Sheet CSV を取得できませんでした');
    const text = await r.text();
    return parseSheetCsv(text);
  }

  // 想定する CSV のカラム例（ヘッダ行）:
  // date,label,time,capacity,reserved
  // date: 2025-11-01, time: 19:00, capacity: 20, reserved: 3
  function parseSheetCsv(csvText){
    const lines = csvText.trim().split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
    if(lines.length < 2) return {days: []};
    const headers = splitCsvLine(lines[0]);
    const rows = lines.slice(1).map(l=>splitCsvLine(l));
    const items = rows.map(cols=>{
      const obj = {};
      cols.forEach((c,i)=> obj[headers[i] || ('col'+i)] = c);
      return obj;
    });

    // group by date -> days array with slots
    const dayMap = {};
    items.forEach(it=>{
      const date = it.date || it.Date || '';
      const label = it.label || it.Label || date;
      const time = it.time || it.Time || '未設定';
      const capacity = Number(it.capacity || it.Capacity || 0) || 0;
      const reserved = Number(it.reserved || it.Reserved || 0) || 0;
      if(!dayMap[date]) dayMap[date] = {date, label, slots: []};
      dayMap[date].slots.push({time, capacity, reserved});
    });
    const days = Object.values(dayMap).sort((a,b)=>a.date.localeCompare(b.date));
    return {days};
  }

  // CSV 行分割（簡易）
  function splitCsvLine(line){
    // このプロジェクト向けの簡易実装: カンマで分割し、前後の " を剥がす
    return line.split(',').map(s=>{
      s = s.trim();
      if(s.startsWith('"') && s.endsWith('"')) s = s.slice(1,-1);
      return s;
    });
  }

  // --- 以下: 指定されたスプレッドシート（同一スプレッドシート内の複数シート）から
  // I2:R19 を抽出してページ上に表示する処理 ---
  // 設定: スプレッドシートの ID と各シートの gid を指定してください。
  // あなたが出したシート URL の ID:
  const SHEET_ID = '1fwx7R-qcOMpSeHN24kIRfuiwPp1CzEeZRFLzR5YaGZk';

  // 各日ごとのシート gid をここで指定してください（ページに表示します）。
  // 例では day1 にあなたが教えてくれた gid を入れてあります。
  const SHEET_CONFIG = [
    {title: '11/21(金)', gid: '825962963', containerId: 'sheet-day1'},
    {title: '11/22(土)', gid: '689251037', containerId: 'sheet-day2'},
    {title: '11/23(日)', gid: '721235396', containerId: 'sheet-day3'}
  ];

  // 空き状況サマリーが置かれているシートの gid
  const STATUS_SHEET_GID = '749666203';

  // 範囲: I2:R19 -> columns 9..18 (1-based), rows 2..19 (1-based)
  const RANGE = {startRow:2, endRow:19, startCol:9, endCol:18};

  // try to load each configured sheet (if gid is provided)
  // デバッグ用にデータをログ出力
  console.log('SHEET_CONFIG:', SHEET_CONFIG);

  SHEET_CONFIG.forEach((cfg) => {
    const el = document.getElementById(cfg.containerId);
    if (!cfg.gid) {
      el.textContent = `${cfg.title} の gid が未設定です。READMEの手順に従い gid または CSV URL を設定してください。`;
      return;
    }

    // Google Visualization API を使用してデータを取得
    fetchSheetGviz(cfg.gid, 'I2:R19')
      .then((table2d) => {
        console.log(`Data for ${cfg.title}:`, table2d); // デバッグ用
        renderTableForSheet(el, cfg.title, table2d);
      })
      .catch((err) => {
        console.error(err);
        el.textContent = `${cfg.title} の読み込みに失敗しました（公開設定と gid を確認してください）。詳細はコンソールを参照してください。`;
      });
  });

  // 各日付のデータ内容をデバッグ出力
  // Fetch sheet via gviz/tq (JSON wrapped) and parse into 2D array of strings
  async function fetchSheetGviz(gid, rangeA1) {
    const rangeParam = encodeURIComponent(rangeA1);
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}&range=${rangeA1}`;
    const urlC = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
    const res = await fetch(urlC);
    if (!res.ok) throw new Error('gviz endpoint fetch failed');
    const text = await res.text();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('gviz: unexpected response');
    const jsonText = text.slice(start, end + 1);
    const obj = JSON.parse(jsonText);
    const table = obj.table;
    const cols = table.cols || [];
    const rows = table.rows || [];
    const out = [];
    rows.forEach((r) => {
      const rowArr = [];
      for (let i = 0; i < cols.length; i++) {
        const cell = r.c && r.c[i];
        let v = '';
        if (cell) {
          if (cell.f !== undefined) v = cell.f;
          else if (cell.v !== undefined) v = cell.v;
        }
        rowArr.push(v === null ? '' : String(v));
      }
      out.push(rowArr);
    });
    return out;
  }

  function renderStatus() {
    statusList.innerHTML = '';
    const STATUS_RANGE = {
      'sheet-day1': 'H4:H7',
      'sheet-day2': 'H10:H13',
      'sheet-day3': 'H16:H19'
    };
    const loaders = SHEET_CONFIG.map(cfg => {
      const range = STATUS_RANGE[cfg.containerId];
      if(!range) return Promise.resolve({cfg, values: null});
      return fetchSheetGviz(STATUS_SHEET_GID, range)
        .then(values => ({cfg, values}))
        .catch(err => {
          console.error(`Status fetch failed for ${cfg.title}:`, err);
          return {cfg, values: null};
        });
    });

    Promise.all(loaders).then(results => {
      results.forEach(({cfg, values}) => {
        const dayWrap = document.createElement('div');
        dayWrap.className = 'day';

        const title = document.createElement('h3');
        title.textContent = cfg.title;
        dayWrap.appendChild(title);

        const table = document.createElement('table');
        table.className = 'status-table';
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';

        ['全体', '地上テーブル', '地上カウンター', '地下テーブル'].forEach((category, i) => {
          const row = document.createElement('tr');
          row.style.borderBottom = '1px solid #ddd';

          const categoryCell = document.createElement('td');
          categoryCell.textContent = category;
          categoryCell.style.padding = '8px';
          categoryCell.style.textAlign = 'left';
          row.appendChild(categoryCell);

          const statusCell = document.createElement('td');
          statusCell.style.padding = '8px';
          statusCell.style.textAlign = 'center';

          const symbol = values && values[i] && values[i][0] ? values[i][0].trim() : '';
          statusCell.textContent = symbol || 'ー';
          if (symbol === '〇') {
            statusCell.style.backgroundColor = '#b9d08b';
            statusCell.style.color = '#008000';
          } else if (symbol === '△') {
            statusCell.style.backgroundColor = '#ffd27f';
            statusCell.style.color = '#cc7000';
          } else if (symbol === '✕') {
            statusCell.style.backgroundColor = '#f5b2b2';
            statusCell.style.color = '#ff0000';
          }

          row.appendChild(statusCell);
          table.appendChild(row);
        });

        dayWrap.appendChild(table);
        statusList.appendChild(dayWrap);
      });
    });
  }

  // スプレッドシートのデータを解析して必要な形式に変換
  function parseSheetData(table) {
    const data = {};
    SHEET_CONFIG.forEach((cfg, sheetIndex) => {
      const rows = extractRange(table[sheetIndex], RANGE.startRow - 1, RANGE.endRow - 1, RANGE.startCol - 1, RANGE.endCol - 1);
      data[cfg.containerId] = rows.map((row) => row[0]); // 各行の最初の列を取得
    });
    return data;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));
  }

  // renderTableForSheet 関数を定義
  function renderTableForSheet(container, title, table) {
    container.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = title;
    container.appendChild(h);

    const tbl = document.createElement('table');
    tbl.className = 'sheet-table';
    tbl.style.borderCollapse = 'collapse';
    tbl.style.width = '100%';

    const numRows = (RANGE.endRow - RANGE.startRow) + 1;
    const numCols = (RANGE.endCol - RANGE.startCol) + 1;

    for (let i = 0; i < numRows; i++) {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #ddd';

      for (let j = 0; j < numCols; j++) {
        const td = document.createElement('td');
        const cell = (table[i] && table[i][j]) ? table[i][j] : '';
        td.textContent = cell;
        td.style.padding = '8px';
        td.style.textAlign = 'center';

        if (cell === '〇') {
          td.style.backgroundColor = '#b9d08b';
          td.style.color = '#008000';
        } else if (cell === '△') {
          td.style.backgroundColor = '#ffd27f';
          td.style.color = '#cc7000';
        } else if (cell === '✕') {
          td.style.backgroundColor = '#f5b2b2';
          td.style.color = '#ff0000';
        } else if (cell === 'ー') {
          td.style.backgroundColor = 'transparent';
          td.style.color = 'inherit';
        }

        tr.appendChild(td);
      }

      tbl.appendChild(tr);
    }

    container.appendChild(tbl);
  }

  const slides = document.querySelectorAll('.slide');
  const captions = [
    '鉄板でじっくり焼き上げたバターコーン。アツアツをどうぞ！',
    '新鮮な軍艦巻き。お寿司好きにはたまらない一品！'
  ];
  const captionElement = document.querySelector('.hero-caption');

  let slideIndex = 0;

  function showSlides() {
    slides.forEach((slide, index) => {
      slide.style.display = index === slideIndex ? 'block' : 'none';
    });
    captionElement.textContent = captions[slideIndex];
    slideIndex = (slideIndex + 1) % slides.length;
    setTimeout(showSlides, 3000);
  }

  showSlides();
});

document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.card');
  const header = document.querySelector('.site-header');

  function adjustWidth() {
    const screenWidth = window.innerWidth;
    if (screenWidth <= 700) {
      cards.forEach(card => {
        card.style.width = '100%';
        card.style.margin = '0 auto';
      });
      header.style.width = '100%';
    } else {
      cards.forEach(card => {
        card.style.width = '';
        card.style.margin = '';
      });
      header.style.width = '';
    }
  }

  adjustWidth();
  window.addEventListener('resize', adjustWidth);
});
