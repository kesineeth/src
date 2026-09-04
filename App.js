import { useEffect, useRef, useState } from 'react';
import './App.css';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REF_WIDTH = 520;
const EXPORT_WIDTH = 1200;

// Classic meme look: Impact where available, sans fallback for OSes without it.
const IMPACT_STACK = 'Impact, "Anton", Haettenschweiler, "Franklin Gothic Bold", sans-serif';

const FONTS = [
  { label: 'Impact (classic)', value: IMPACT_STACK },
  { label: 'Anton', value: '"Anton", sans-serif' },
  { label: 'Poppins', value: '"Poppins", sans-serif' },
  { label: 'Inter', value: '"Inter", sans-serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];

function svgDataUrl(inner) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const TEMPLATES = [
  {
    name: 'Sunset',
    url: svgDataUrl(`
      <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FF9A5A"/><stop offset="0.55" stop-color="#FF5C8A"/><stop offset="1" stop-color="#5B2A86"/>
      </linearGradient></defs>
      <rect width="800" height="800" fill="url(#g1)"/>
      <circle cx="400" cy="430" r="140" fill="#FFD166" opacity="0.9"/>
      <rect y="560" width="800" height="240" fill="#1c1030" opacity="0.55"/>
    `),
  },
  {
    name: 'Ocean',
    url: svgDataUrl(`
      <defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0F5E77"/><stop offset="1" stop-color="#1FB3A3"/>
      </linearGradient></defs>
      <rect width="800" height="800" fill="url(#g2)"/>
      <circle cx="150" cy="620" r="26" fill="#ffffff" opacity="0.35"/>
      <circle cx="240" cy="700" r="14" fill="#ffffff" opacity="0.35"/>
      <circle cx="620" cy="150" r="20" fill="#ffffff" opacity="0.3"/>
    `),
  },
  {
    name: 'Grid Paper',
    url: svgDataUrl(`
      <rect width="800" height="800" fill="#FAF7F0"/>
      ${Array.from({ length: 17 })
        .map((_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="800" stroke="#E1D9C6" stroke-width="1"/>`)
        .join('')}
      ${Array.from({ length: 17 })
        .map((_, i) => `<line x1="0" y1="${i * 50}" x2="800" y2="${i * 50}" stroke="#E1D9C6" stroke-width="1"/>`)
        .join('')}
    `),
  },
  {
    name: 'Blank black',
    url: svgDataUrl(`<rect width="800" height="800" fill="#111111"/>`),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 1;
const nextId = () => `layer-${idCounter++}-${Date.now()}`;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function makeTextLayer(overrides = {}) {
  return {
    id: nextId(),
    text: 'YOUR TEXT HERE',
    x: 50,
    y: 10,
    fontSize: 42,
    fontFamily: IMPACT_STACK,
    color: '#ffffff',
    align: 'center',
    opacity: 1,
    outlineColor: '#000000',
    outlineWidth: 4,
    ...overrides,
  };
}

// The classic imgflip default: a template starts with TOP TEXT + BOTTOM TEXT
// already placed, ready to edit.
function defaultLayerPair() {
  return [
    makeTextLayer({ text: 'TOP TEXT', y: 8 }),
    makeTextLayer({ text: 'BOTTOM TEXT', y: 90 }),
  ];
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const [step, setStep] = useState('edit'); // 'edit' | 'result'
  const [bgImage, setBgImage] = useState(null);
  const [aspect, setAspect] = useState(1);
  const [layers, setLayers] = useState([]);
  const [openId, setOpenId] = useState(null); // which text box's controls are expanded
  const [isWorking, setIsWorking] = useState(false);
  const [resultUrl, setResultUrl] = useState(null);

  const stageRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Poppins:wght@700&family=Anton&display=swap';
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }, []);

  function updateLayer(id, patch) {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function deleteLayer(id) {
    setLayers((ls) => ls.filter((l) => l.id !== id));
    if (openId === id) setOpenId(null);
  }

  // --- background image ---------------------------------------------------

  async function applyBackground(src) {
    const img = await loadImage(src);
    setAspect(img.naturalWidth / img.naturalHeight || 1);
    setBgImage(src);
    // Match imgflip: picking a template seeds TOP TEXT / BOTTOM TEXT if the
    // stage is still empty, so there's always something to edit right away.
    setLayers((ls) => (ls.length === 0 ? defaultLayerPair() : ls));
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    await applyBackground(dataUrl);
    e.target.value = '';
  }

  function addTextBox() {
    const layer = makeTextLayer({ text: 'NEW TEXT', y: 50 });
    setLayers((ls) => [...ls, layer]);
    setOpenId(layer.id);
  }

  // --- dragging --------------------------------------------------------

  function startDrag(e, id) {
    e.stopPropagation();
    setOpenId(id);
    const layer = layers.find((l) => l.id === id);
    const rect = stageRef.current.getBoundingClientRect();
    const anchorX = rect.left + (layer.x / 100) * rect.width;
    const anchorY = rect.top + (layer.y / 100) * rect.height;
    dragRef.current = { id, offsetX: e.clientX - anchorX, offsetY: e.clientY - anchorY, rect };
    e.target.setPointerCapture(e.pointerId);
  }

  function onDragMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const xPct = clamp(((e.clientX - drag.rect.left - drag.offsetX) / drag.rect.width) * 100, 0, 100);
    const yPct = clamp(((e.clientY - drag.rect.top - drag.offsetY) / drag.rect.height) * 100, 0, 100);
    setLayers((ls) => ls.map((l) => (l.id === drag.id ? { ...l, x: xPct, y: yPct } : l)));
  }

  function endDrag() {
    dragRef.current = null;
  }

  // --- render + generate -------------------------------------------------

  async function renderToCanvas() {
    if (document.fonts?.ready) await document.fonts.ready;
    const width = EXPORT_WIDTH;
    const height = Math.round(EXPORT_WIDTH / aspect);
    const scale = EXPORT_WIDTH / REF_WIDTH;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const img = await loadImage(bgImage);
    ctx.drawImage(img, 0, 0, width, height);

    layers.forEach((layer) => {
      const x = (layer.x / 100) * width;
      const y = (layer.y / 100) * height;
      const fontSize = layer.fontSize * scale;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.font = `700 ${fontSize}px ${layer.fontFamily}`;
      ctx.textAlign = layer.align;
      ctx.textBaseline = 'middle';
      const text = layer.text.toUpperCase();
      if (layer.outlineWidth > 0) {
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = layer.outlineWidth * scale * 2;
        ctx.strokeStyle = layer.outlineColor;
        ctx.strokeText(text, x, y);
      }
      ctx.fillStyle = layer.color;
      ctx.fillText(text, x, y);
      ctx.restore();
    });

    return canvas;
  }

  async function handleGenerate() {
    if (!bgImage) {
      alert('Pick a template or upload an image first.');
      return;
    }
    setIsWorking(true);
    try {
      const canvas = await renderToCanvas();
      setResultUrl(canvas.toDataURL('image/png'));
      setStep('result');
    } finally {
      setIsWorking(false);
    }
  }

  function downloadResult() {
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = 'meme.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function layerTransform(layer) {
    const alignShift = { left: '0%', center: '-50%', right: '-100%' }[layer.align];
    return `translate(${alignShift}, -50%)`;
  }

  // -------------------------------------------------------------------

  return (
    <div className="App">
      <header className="topbar">
        <h1 className="logo">Meme Generator</h1>
      </header>

      {step === 'edit' && (
        <div className="editor">
          <section className="template-strip">
            <label className="upload-chip">
              Upload new image
              <input type="file" accept="image/*" onChange={handleUpload} hidden />
            </label>
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                className={`template-thumb ${bgImage === t.url ? 'active' : ''}`}
                style={{ backgroundImage: `url(${t.url})` }}
                onClick={() => applyBackground(t.url)}
                title={t.name}
                type="button"
              />
            ))}
          </section>

          <div
            ref={stageRef}
            className="stage"
            style={{ aspectRatio: aspect, maxWidth: REF_WIDTH }}
            onClick={() => setOpenId(null)}
          >
            {bgImage ? (
              <img className="stage-bg" src={bgImage} alt="Meme background" draggable={false} />
            ) : (
              <div className="stage-placeholder">Choose a template above to start</div>
            )}

            {layers.map((layer) => (
              <div
                key={layer.id}
                className={`stage-layer ${layer.id === openId ? 'selected' : ''}`}
                style={{
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  transform: layerTransform(layer),
                  opacity: layer.opacity,
                  fontSize: layer.fontSize,
                  color: layer.color,
                  fontFamily: layer.fontFamily,
                  textAlign: layer.align,
                  WebkitTextStroke: layer.outlineWidth > 0 ? `${layer.outlineWidth}px ${layer.outlineColor}` : undefined,
                  paintOrder: 'stroke fill',
                }}
                onPointerDown={(e) => startDrag(e, layer.id)}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
              >
                {layer.text}
              </div>
            ))}
          </div>

          <section className="textbox-list">
            {layers.map((layer, i) => (
              <div key={layer.id} className="textbox-row">
                <button
                  className="textbox-header"
                  onClick={() => setOpenId(openId === layer.id ? null : layer.id)}
                  type="button"
                >
                  <span>Text box {i + 1}: {layer.text || '(empty)'}</span>
                  <span className="chevron">{openId === layer.id ? '▲' : '▼'}</span>
                </button>

                {openId === layer.id && (
                  <div className="textbox-body">
                    <label>
                      Text
                      <textarea
                        value={layer.text}
                        onChange={(e) => updateLayer(layer.id, { text: e.target.value })}
                        rows={2}
                      />
                    </label>
                    <label>
                      Font
                      <select value={layer.fontFamily} onChange={(e) => updateLayer(layer.id, { fontFamily: e.target.value })}>
                        {FONTS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="field-grid">
                      <label>
                        Alignment
                        <div className="segmented">
                          {['left', 'center', 'right'].map((a) => (
                            <button
                              key={a}
                              type="button"
                              className={layer.align === a ? 'active' : ''}
                              onClick={() => updateLayer(layer.id, { align: a })}
                            >
                              {a}
                            </button>
                          ))}
                        </div>
                      </label>
                      <label>
                        Size ({layer.fontSize}px)
                        <input
                          type="range"
                          min={14}
                          max={96}
                          value={layer.fontSize}
                          onChange={(e) => updateLayer(layer.id, { fontSize: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Opacity ({Math.round(layer.opacity * 100)}%)
                        <input
                          type="range"
                          min={0.1}
                          max={1}
                          step={0.05}
                          value={layer.opacity}
                          onChange={(e) => updateLayer(layer.id, { opacity: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Outline width ({layer.outlineWidth}px)
                        <input
                          type="range"
                          min={0}
                          max={8}
                          value={layer.outlineWidth}
                          onChange={(e) => updateLayer(layer.id, { outlineWidth: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                    <div className="color-row">
                      <label>
                        Text color
                        <input type="color" value={layer.color} onChange={(e) => updateLayer(layer.id, { color: e.target.value })} />
                      </label>
                      <label>
                        Outline color
                        <input
                          type="color"
                          value={layer.outlineColor}
                          onChange={(e) => updateLayer(layer.id, { outlineColor: e.target.value })}
                        />
                      </label>
                    </div>
                    <button className="btn btn-danger" onClick={() => deleteLayer(layer.id)} type="button">
                      Delete this text box
                    </button>
                  </div>
                )}
              </div>
            ))}

            <button className="btn btn-outline btn-block" onClick={addTextBox} type="button">
              + Add Text Box
            </button>
          </section>

          <button className="btn btn-primary btn-generate" onClick={handleGenerate} disabled={isWorking} type="button">
            {isWorking ? 'Generating…' : 'Generate Meme'}
          </button>
        </div>
      )}

      {step === 'result' && (
        <div className="result">
          <img className="result-image" src={resultUrl} alt="Generated meme" />
          <div className="result-actions">
            <button className="btn btn-primary" onClick={downloadResult} type="button">
              Download image
            </button>
            <button className="btn btn-outline" onClick={() => setStep('edit')} type="button">
              Edit meme
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
