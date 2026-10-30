const data = window.SCENE_DATA;
const $ = id => document.getElementById(id);
const stage = $("stage");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let selected = 0, elapsed = 0, lastFrame = performance.now();
let playing = true, ready = false, renderToken = 0, ambient = [];
let stageHeight = 1;
new ResizeObserver(() => {
  stageHeight = stage.clientHeight;
}).observe(stage);

const marble = (x = 0, y = 0, size = 100) =>
  '<svg x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" viewBox="100 100 470 470"><image href="' + data.marbles + '" width="1254" height="1254"/></svg>';

function boardMarkup() {
  let parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 967 1626" role="img" aria-label="Tablero de ejemplo"><defs><filter id="halo"><feGaussianBlur stdDeviation="8"/></filter></defs>'];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if ((row < 2 || row > 4) && (col < 2 || col > 4)) continue;
      const x = 99 + col * 131, y = 226 + row * 131;
      const occupied = (row < 2 && col === 3) || (row === 2 && (col === 2 || col === 4));
      if (!occupied) parts.push('<circle cx="' + x + '" cy="' + y + '" r="50" fill="none" stroke="#af9985" stroke-width="3.6" opacity=".83"/>');
      else {
        if (row === 0) parts.push('<circle cx="' + x + '" cy="' + y + '" r="57" fill="none" stroke="#ffd56a" stroke-width="18" opacity=".67" filter="url(#halo)"/><circle cx="' + x + '" cy="' + y + '" r="57" fill="none" stroke="#fff2b7" stroke-width="6"/>');
        parts.push(marble(x - 53, y - 53, 106));
      }
    }
  }
  parts.push("</svg>");
  return parts.join("");
}
$("board").innerHTML = boardMarkup();
$("objective-marble").innerHTML = marble(0, 0, 100);
$("dragon").src = data.dragon;

function addSprite(placement, container, type, index) {
  const [id, x, y, width, profile] = placement;
  const sprite = data.sprites[id];
  const visibleFraction = (sprite.solid_bbox[2] - sprite.solid_bbox[0]) / sprite.width;
  const fullWidth = width / visibleFraction;
  const pin = document.createElement("div");
  pin.className = "pin " + type;
  pin.dataset.asset = id;
  pin.style.left = x + "%"; pin.style.top = y + "%"; pin.style.width = fullWidth + "%";
  pin.style.transform = "translate(" + (-sprite.pivot[0] * 100) + "%," + (-sprite.pivot[1] * 100) + "%)";
  pin.style.setProperty("--pivot-x", sprite.pivot[0] * 100 + "%");
  pin.style.setProperty("--pivot-y", sprite.pivot[1] * 100 + "%");
  const body = document.createElement("img"); body.src = sprite.file; body.alt = sprite.name; body.draggable = false;
  pin.append(body); container.append(pin);
  return { pin, body, profile, index, sprite };
}

const cache = new Map();
function preload(src) {
  if (!cache.has(src)) {
    const image = new Image(); image.src = src;
    cache.set(src, image.decode());
  }
  return cache.get(src);
}

async function mountScene() {
  const token = ++renderToken, scene = data.scenes[selected];
  ready = false; $("loading").hidden = false;
  $("title").textContent = scene.title; $("number").textContent = String(scene.chapter).padStart(2, "0");
  $("chapter").value = selected;
  $("background").src = scene.background; $("background").alt = "Fondo de " + scene.title;
  $("download-background").href = scene.background;
  $("foreground").src = scene.foreground;
  $("ambient").replaceChildren();
  ambient = (scene.ambient || []).map((p, i) => addSprite(p, $("ambient"), "ambient", i));

  document.querySelectorAll(".thumb").forEach(b => b.setAttribute("aria-current", String(Number(b.dataset.index) === selected)));
  const sources = [scene.background, scene.foreground, data.dragon, data.marbles, ...ambient.map(a => a.sprite.file)];
  try {
    await Promise.all(sources.map(preload));
    if (token !== renderToken) return;
    stageHeight = stage.clientHeight;
    ready = true; $("loading").hidden = true;
  } catch {
    if (token !== renderToken) return;
    $("loading").textContent = "No se ha podido cargar una capa. Recarga la página.";
  }
}

for (const [index, scene] of data.scenes.entries()) {
  const option = document.createElement("option"); option.value = index;
  option.textContent = String(scene.chapter).padStart(2, "0") + " · " + scene.title; $("chapter").append(option);
  const button = document.createElement("button"); button.className = "thumb"; button.dataset.index = index;
  button.setAttribute("aria-label", scene.chapter + " · " + scene.title); button.title = scene.title;
  const image = document.createElement("img"); image.src = scene.background; image.alt = scene.title; image.loading = "lazy";
  const number = document.createElement("span"); number.textContent = String(scene.chapter).padStart(2, "0");
  button.append(image, number); button.onclick = () => { selected = index; mountScene(); };
  $("thumbnails").append(button);
}
$("chapter").onchange = () => { selected = Number($("chapter").value); mountScene(); };
function setPlaying(value) {
  playing = value; $("pause").textContent = playing ? "Pausar ambiente" : "Continuar ambiente";
  $("pause").setAttribute("aria-pressed", String(!playing));
}
$("pause").onclick = () => setPlaying(!playing);
$("environment-only").onchange = () => stage.classList.toggle("environment-only", $("environment-only").checked);
$("front-visible").onchange = () => stage.classList.toggle("hide-front", !$("front-visible").checked);
document.addEventListener("visibilitychange", () => { lastFrame = performance.now(); });

function frame(now) {
  const delta = Math.min(200, now - lastFrame); lastFrame = now;
  if (playing && !document.hidden && ready) elapsed += delta;
  for (const item of ambient) {
    const t = elapsed / 1000 + item.index * 1.4;
    if (reducedMotion) continue;
    if (item.profile === "rotate") item.body.style.transform = "rotate(" + (t * 6 % 360).toFixed(2) + "deg)";
    else item.body.style.transform = "translateY(" + (.32 / 100 * stageHeight * Math.sin(t * .8)).toFixed(2) + "px) rotate(" + (.7 * Math.sin(t * .6)).toFixed(2) + "deg)";
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
mountScene();
