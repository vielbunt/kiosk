// Erzeugt kiosk-show.html aus dem aktuellen kiosk.html plus vielbunt-loop.
// Die Modi (socialmedia, poster, events, compact, mitmachen, disco) bleiben unveraendert,
// nur die normale Slideshow bekommt zwischen den Slides Animationen aus dem Showreel.
// Aufruf: npm run kiosk   (liegt im Kiosk-Repo, anderer Pfad optional per KIOSK_DIR)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.env.KIOSK_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(join(dir, 'kiosk.html'), 'utf8');
const loop = readFileSync('vielbunt-loop.html');

function patch(from, to) {
  if (!html.includes(from)) throw new Error('Stelle im kiosk.html nicht gefunden:\n' + from);
  html = html.replace(from, () => to);
}

patch('<title>vielbunt Kiosk</title>', '<title>vielbunt Kiosk Show</title>');

// Terminuebersicht markieren, damit die Show sie gezielt zeigen kann
patch(`                const eventSlide = document.createElement('div');
                eventSlide.className = 'slide';`, `                const eventSlide = document.createElement('div');
                eventSlide.className = 'slide';
                eventSlide.dataset.kind = 'events';`);

// nur die normale Slideshow wird ersetzt, "events" und "compact" laufen wie bisher
patch(`                    const [posts, events] = await Promise.all([`, `                    startIntro();
                    const [posts, events] = await Promise.all([`);

patch(`                startSlideshow();
            } catch (error) {`, `                if (eventsOnly) startSlideshow(); else startShow();
            } catch (error) {`);

const show = String.raw`
        // ------------------------------------------------------------------
        // Kiosk Show: jeder Slide steht laenger, danach kommt eine Animation aus
        // vielbunt-loop, jedes dritte Mal stattdessen die Terminuebersicht.
        // URL-Parameter: dauer=Sekunden je Slide (20), uebersicht=Sekunden (30),
        // stil=Liste der Loop-Stile, z. B. stil=pink,nacht
        const SHOW_Q = new URLSearchParams(window.location.search);
        const SLIDE_MS = (Number(SHOW_Q.get('dauer')) || 20) * 1000;
        const OVERVIEW_MS = (Number(SHOW_Q.get('uebersicht')) || 30) * 1000;
        const ANIM_STYLES = (SHOW_Q.get('stil') || 'pink,nacht,verlauf,pink,hell').split(',').map(s => s.trim()).filter(Boolean);

        // Eroeffnung waehrend des Ladens: Punktwand mit der Darmstadt-Skyline in Pink
        const INTRO_SCENE = SHOW_Q.get('intro') || 'punktwand';
        const INTRO_STYLE = 'pink';
        // Vorlauf in Sekunden: so lange steht die Animation beim Einblenden auf ihrem Startbild
        const FADE_LEAD = 0.9;

        let vbFrame = null, vbLayer = null, vbScenes = null;
        let sceneIdx = 0, styleIdx = 0, interCount = 0;
        let content = [], overview = null, ci = 0, phase = 'content', showTimer = null;
        let introTimer = null, introEndsAt = 0, introRunning = false, showStarted = false;

        function loadLoopFrame() {
            const b64 = document.getElementById('vb-loop-b64').textContent.trim();
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            let doc = new TextDecoder().decode(bytes);
            doc = doc.replace('<head>', '<head><script>window.__VB_EMBED = true;<\/script>');
            vbLayer = document.createElement('div');
            vbLayer.className = 'slide vb-anim';
            vbFrame = document.createElement('iframe');
            vbFrame.setAttribute('aria-hidden', 'true');
            vbFrame.setAttribute('tabindex', '-1');
            vbFrame.srcdoc = doc;
            vbLayer.appendChild(vbFrame);
            // ueber das ganze Fenster, unabhaengig vom 16:9-Rahmen der Slides
            // (und ausserhalb von #slides-container, buildSlides leert den Container beim Aufbau)
            document.body.appendChild(vbLayer);
            window.addEventListener('message', (e) => {
                if (!vbFrame || e.source !== vbFrame.contentWindow) return;
                if (e.data && e.data.type === 'vb-bg' && phase === 'anim') {
                    // Raender neben der 16:9-Flaeche nehmen die Farbe der Animation an
                    document.body.style.background = e.data.css;
                    vbLayer.style.background = e.data.css;
                }
                if (e.data && e.data.type === 'vb-ready' && Array.isArray(e.data.scenes)) {
                    // gemischte Reihenfolge, damit nicht jeden Tag dieselbe Szene zuerst kommt
                    const list = e.data.scenes.slice();
                    for (let i = list.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [list[i], list[j]] = [list[j], list[i]];
                    }
                    vbScenes = list;
                    if (introRunning && !showStarted) introNext(true);
                }
            });
        }

        function showOnly(el) {
            document.querySelectorAll('#slides-container .slide').forEach(s => s.classList.toggle('active', s === el));
            if (vbLayer) vbLayer.classList.toggle('active', el === vbLayer);
        }

        function playScene(key, style) {
            vbFrame.contentWindow.postMessage({ type: 'vb-play', scene: key, style, lead: FADE_LEAD }, '*');
            showOnly(vbLayer);
        }

        // Intro: laeuft, bis alles geladen ist; dauert das Laden laenger, folgt die naechste Animation
        function startIntro() {
            loadLoopFrame();
            introRunning = true;
            phase = 'anim';
            showOnly(vbLayer);
        }
        function introNext(first) {
            if (showStarted || !vbScenes) return;
            let sc;
            if (first) {
                sc = vbScenes.find(x => x.key === INTRO_SCENE) || vbScenes[0];
                // die Eroeffnung nicht gleich noch einmal in der Rotation
                vbScenes = vbScenes.filter(x => x !== sc).concat([sc]);
                playScene(sc.key, INTRO_STYLE);
            } else {
                sc = vbScenes[sceneIdx++ % vbScenes.length];
                playScene(sc.key, ANIM_STYLES[styleIdx++ % ANIM_STYLES.length]);
            }
            const ms = (FADE_LEAD + Math.max(5, sc.dur)) * 1000;
            introEndsAt = Date.now() + ms;
            clearTimeout(introTimer);
            introTimer = setTimeout(() => introNext(false), ms);
        }

        function stopAnimationSoon() {
            // erst nach dem Ausblenden anhalten, sonst friert das letzte Bild sichtbar ein
            setTimeout(() => {
                if (phase !== 'anim' && vbFrame && vbFrame.contentWindow) vbFrame.contentWindow.postMessage({ type: 'vb-stop' }, '*');
            }, 1200);
        }

        function advance() {
            clearTimeout(showTimer);
            let wait;
            if (phase === 'content') {
                // Zwischenspiel: jedes dritte Mal die Terminuebersicht
                const wantOverview = overview && interCount % 3 === 2;
                interCount++;
                if (wantOverview) {
                    phase = 'overview';
                    document.body.style.background = '';
                    showOnly(overview);
                    wait = OVERVIEW_MS;
                } else if (vbScenes && vbScenes.length) {
                    phase = 'anim';
                    const sc = vbScenes[sceneIdx++ % vbScenes.length];
                    const style = ANIM_STYLES[styleIdx++ % ANIM_STYLES.length];
                    vbFrame.contentWindow.postMessage({ type: 'vb-play', scene: sc.key, style, lead: FADE_LEAD }, '*');
                    showOnly(vbLayer);
                    wait = (FADE_LEAD + Math.max(5, sc.dur)) * 1000;
                } else {
                    // Animationen noch nicht bereit: direkt zum naechsten Slide
                    phase = 'overview';
                    wait = 0;
                }
            } else {
                phase = 'content';
                ci = (ci + 1) % content.length;
                showOnly(content[ci]);
                document.body.style.background = '';
                stopAnimationSoon();
                wait = SLIDE_MS;
            }
            showTimer = setTimeout(advance, wait);
        }

        function startShow() {
            const all = Array.from(document.querySelectorAll('#slides-container .slide'));
            overview = all.find(s => s.dataset.kind === 'events') || null;
            content = all.filter(s => s !== overview);
            if (!content.length && overview) content = [overview];
            showStarted = true;
            clearTimeout(introTimer);
            if (!vbFrame) loadLoopFrame();
            if (introRunning && introEndsAt > Date.now()) {
                // laufende Eroeffnung zu Ende spielen, danach der erste Slide
                // (buildSlides schaltet den ersten Slide schon aktiv, der wartet noch)
                phase = 'anim';
                ci = -1;
                showOnly(vbLayer);
                showTimer = setTimeout(advance, introEndsAt - Date.now());
            } else {
                ci = 0;
                phase = 'content';
                showOnly(content[0]);
                document.body.style.background = '';
                stopAnimationSoon();
                showTimer = setTimeout(advance, SLIDE_MS);
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight') advance();
                else if (e.key === 'ArrowLeft') {
                    // zum vorherigen Slide springen
                    ci = (ci - 2 + content.length * 2) % content.length;
                    phase = 'overview';
                    advance();
                }
            });
        }

`;
patch(`        // Run
        window.addEventListener('DOMContentLoaded', init);`, show + `        // Run
        window.addEventListener('DOMContentLoaded', init);`);

// Animationsebene fuellt die 16:9-Flaeche wie die anderen Slides
patch('</head>', `    <style>
        .vb-anim { background: #DB3966; z-index: 5; position: fixed; inset: 0; width: 100vw; height: 100vh; }
        body { transition: background-color 0.8s ease; }
        .vb-anim iframe { border: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
    </style>
</head>`);

// vielbunt-loop als Base64 eingebettet, damit nur eine Datei hochgeladen werden muss
patch('</body>', `<script type="text/plain" id="vb-loop-b64">${loop.toString('base64')}</script>
</body>`);

const out = join(dir, 'kiosk-show.html');
writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1024).toFixed(0)} KB`);
