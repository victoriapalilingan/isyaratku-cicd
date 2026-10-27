/* =========================================
   ISYARATKU - VISUAL 3D LANDING PAGE
   26 kartu huruf A–Z dalam bidang bergelombang.
   Huruf I-S-Y-A-R-A-T-K-U bergantian "dikenali"
   dan maju ke depan. Hanya dipakai index.html.

   - Tanpa WebGL atau three.js gagal dimuat:
     kartu statis HTML tetap tampil.
   - prefers-reduced-motion: satu frame diam.
   - Render berhenti saat tab tersembunyi atau
     kanvas tidak terlihat.
   ========================================= */

(function () {
    "use strict";

    const stage = document.getElementById("hero3d");
    if (!stage || typeof window.THREE === "undefined") return;

    const THREE = window.THREE;
    const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const WORD = "ISYARATKU".split("");
    const COLS = 6;
    const GAP = 1.22;

    const reduceMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
        return; // WebGL tidak tersedia: fallback HTML tetap tampil
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    stage.appendChild(renderer.domElement);
    stage.classList.add("is-3d");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 15);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd6e4ef, 0.85));

    const key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(-4, 6, 9);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x79a9d4, 0.35);
    rim.position.set(6, -3, 4);
    scene.add(rim);

    /* Kartu: persegi membulat yang diekstrusi dengan bevel */

    function roundedShape(size, radius) {
        const h = size / 2;
        const shape = new THREE.Shape();
        shape.moveTo(-h + radius, -h);
        shape.lineTo(h - radius, -h);
        shape.quadraticCurveTo(h, -h, h, -h + radius);
        shape.lineTo(h, h - radius);
        shape.quadraticCurveTo(h, h, h - radius, h);
        shape.lineTo(-h + radius, h);
        shape.quadraticCurveTo(-h, h, -h, h - radius);
        shape.lineTo(-h, -h + radius);
        shape.quadraticCurveTo(-h, -h, -h + radius, -h);
        return shape;
    }

    const geometry = new THREE.ExtrudeGeometry(roundedShape(1, 0.2), {
        depth: 0.18,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.05,
        bevelSegments: 4,
        curveSegments: 8
    });
    geometry.center();

    // Muka depan memakai koordinat posisi sebagai UV (-0.5..0.5).
    function letterTexture(letter, background, ink) {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;

        const ctx = canvas.getContext("2d");
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = ink;
        ctx.font = "400 168px Georgia, 'Times New Roman', serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letter, size / 2, size / 2 + 8);

        const texture = new THREE.CanvasTexture(canvas);
        texture.encoding = THREE.sRGBEncoding;
        texture.offset.set(0.5, 0.5);
        texture.anisotropy = 4;
        return texture;
    }

    const sideIdle = new THREE.MeshStandardMaterial({
        color: 0xd3dfe8, roughness: 0.6
    });
    const sideActive = new THREE.MeshStandardMaterial({
        color: 0x285f96, roughness: 0.45
    });

    const group = new THREE.Group();
    scene.add(group);

    const rows = Math.ceil(ALPHABET.length / COLS);
    const tiles = ALPHABET.map((letter, index) => {
        const col = index % COLS;
        const row = Math.floor(index / COLS);

        // Baris terakhir (Y, Z) dibuat rata tengah.
        const inRow = row === rows - 1
            ? ALPHABET.length - row * COLS
            : COLS;
        const x = (col - (inRow - 1) / 2) * GAP;
        const y = ((rows - 1) / 2 - row) * GAP;

        const idle = new THREE.MeshStandardMaterial({
            map: letterTexture(letter, "#FFFFFF", "#243D55"),
            roughness: 0.5
        });
        const active = new THREE.MeshStandardMaterial({
            map: letterTexture(letter, "#3979B9", "#FFFFFF"),
            roughness: 0.4,
            emissive: 0x3979b9,
            emissiveIntensity: 0.12
        });

        const mesh = new THREE.Mesh(geometry, [idle, sideIdle]);
        mesh.position.set(x, y, 0);
        group.add(mesh);

        return { letter, mesh, idle, active, x, y, lift: 0 };
    });

    group.rotation.set(-0.32, 0.42, 0.06);

    /* Huruf yang sedang "dikenali" */

    const readout = document.getElementById("heroReadout");
    const readoutLetter = document.getElementById("heroReadoutLetter");
    const readoutValue = document.getElementById("heroReadoutValue");

    let wordIndex = 0;
    let activeTile = null;
    let lastSwitch = -Infinity;

    function activate(letter) {
        if (activeTile) {
            activeTile.mesh.material = [activeTile.idle, sideIdle];
        }

        activeTile = tiles.find(tile => tile.letter === letter) || null;

        if (activeTile) {
            activeTile.mesh.material = [activeTile.active, sideActive];
        }

        if (readout && readoutLetter && readoutValue) {
            readoutLetter.textContent = letter;
            readoutValue.textContent =
                `${(88 + Math.random() * 10).toFixed(1)}%`;
            readout.classList.remove("is-pulse");
            void readout.offsetWidth;
            readout.classList.add("is-pulse");
        }
    }

    /* Kemiringan mengikuti kursor */

    const pointer = { x: 0, y: 0 };
    const tilt = { x: 0, y: 0 };

    if (!reduceMotion) {
        window.addEventListener("pointermove", event => {
            pointer.x = event.clientX / window.innerWidth - 0.5;
            pointer.y = event.clientY / window.innerHeight - 0.5;
        }, { passive: true });
    }

    function resize() {
        const width = stage.clientWidth;
        const height = stage.clientHeight;
        if (!width || !height) return;

        renderer.setSize(width, height, false);
        camera.aspect = width / height;

        // Seluruh grid tetap muat di layar sempit.
        camera.position.z = camera.aspect < 1 ? 15 / camera.aspect * 0.95 : 15;
        camera.updateProjectionMatrix();
    }

    function frame(time) {
        const t = time / 1000;

        if (!reduceMotion && t - lastSwitch > 1.5) {
            lastSwitch = t;
            activate(WORD[wordIndex]);
            wordIndex = (wordIndex + 1) % WORD.length;
        }

        tiles.forEach(tile => {
            const target = tile === activeTile ? 1 : 0;
            tile.lift += (target - tile.lift) * 0.12;

            const wave = Math.sin(t * 1.2 + tile.x * 0.55 + tile.y * 0.8) * 0.22;
            tile.mesh.position.z = wave + tile.lift * 1.1;
            tile.mesh.rotation.x = Math.sin(t * 0.9 + tile.y) * 0.08;
            tile.mesh.rotation.y = Math.cos(t * 0.8 + tile.x) * 0.08 - tile.lift * 0.25;
            tile.mesh.scale.setScalar(1 + tile.lift * 0.12);
        });

        tilt.x += (pointer.y * 0.35 - tilt.x) * 0.05;
        tilt.y += (pointer.x * 0.5 - tilt.y) * 0.05;
        group.rotation.x = -0.32 + tilt.x;
        group.rotation.y = 0.42 + tilt.y;

        renderer.render(scene, camera);
    }

    let running = false;
    let visible = true;
    let rafId = 0;

    function loop(time) {
        frame(time);
        rafId = window.requestAnimationFrame(loop);
    }

    function update() {
        const shouldRun = visible && !document.hidden && !reduceMotion;

        if (shouldRun && !running) {
            running = true;
            rafId = window.requestAnimationFrame(loop);
        } else if (!shouldRun && running) {
            running = false;
            window.cancelAnimationFrame(rafId);
        }
    }

    if ("ResizeObserver" in window) {
        new ResizeObserver(() => {
            resize();
            if (!running) frame(performance.now());
        }).observe(stage);
    } else {
        window.addEventListener("resize", resize);
    }

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            update();
        }).observe(stage);
    }

    document.addEventListener("visibilitychange", update);

    resize();

    if (reduceMotion) {
        activate("A");
        tiles.forEach(tile => { tile.lift = tile === activeTile ? 1 : 0; });
        frame(0);
    } else {
        update();
    }
})();
