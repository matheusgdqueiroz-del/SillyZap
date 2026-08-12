// Generates a seamless WhatsApp-style doodle wallpaper tile.
// Doodles are simple monochrome line icons scattered with edge-wraparound so
// the tile repeats without a visible seam. Run: node gen-doodle.mjs
import { writeFileSync } from 'node:fs';

const TILE = 600;      // tile size in px
const BLEED = 60;      // wraparound bleed distance from edges
const COUNT = 34;      // number of doodles

// Deterministic PRNG (mulberry32) so the pattern is stable across runs.
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rng = mulberry32(20240611);
const rand = (min, max) => min + rng() * (max - min);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

// Each doodle is line art roughly centered in a 0..40 box. Stroke-based so a
// single stroke color + opacity controls the whole look.
const DOODLES = [
    // heart
    `<path d="M20 33 C8 24 4 16 9 11 C13 7 19 9 20 14 C21 9 27 7 31 11 C36 16 32 24 20 33Z"/>`,
    // smiley
    `<circle cx="20" cy="20" r="13"/><circle cx="15" cy="17" r="1.4" fill="currentColor" stroke="none"/><circle cx="25" cy="17" r="1.4" fill="currentColor" stroke="none"/><path d="M13 24 C16 29 24 29 27 24"/>`,
    // sun
    `<circle cx="20" cy="20" r="7"/><path d="M20 4v5M20 31v5M4 20h5M31 20h5M9 9l3.5 3.5M28 28l3.5 3.5M31 9l-3.5 3.5M12 28l-3.5 3.5"/>`,
    // camera
    `<rect x="6" y="13" width="28" height="19" rx="3"/><path d="M15 13l3-5h4l3 5"/><circle cx="20" cy="22" r="6"/>`,
    // phone handset
    `<path d="M12 8 C10 10 9 13 11 18 C14 25 20 31 28 33 C31 33 33 30 33 28 L29 24 L25 26 C21 24 17 20 15 16 L17 12 Z"/>`,
    // coffee cup
    `<path d="M9 14h20v9a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8Z"/><path d="M29 16h3a4 4 0 0 1 0 8h-3"/><path d="M14 6c0 2-2 2-2 4M20 6c0 2-2 2-2 4"/>`,
    // music note
    `<path d="M16 28V9l14-3v16"/><circle cx="12" cy="28" r="4"/><circle cx="26" cy="22" r="4"/>`,
    // star
    `<path d="M20 5l4.5 9.5 10.5 1.5-7.5 7.3 1.8 10.4L20 28.8 10.2 33.7 12 23.3 4.5 16l10.5-1.5Z"/>`,
    // envelope
    `<rect x="6" y="11" width="28" height="19" rx="2"/><path d="M6 13l14 11 14-11"/>`,
    // lightning
    `<path d="M22 4 L11 22 H19 L17 36 L30 16 H21 Z"/>`,
    // balloon
    `<path d="M20 27 C12 27 9 19 9 14 C9 8 14 4 20 4 C26 4 31 8 31 14 C31 19 28 27 20 27Z"/><path d="M20 27l-2 4h4l-2-4M20 31c0 3 3 3 3 6"/>`,
    // gift
    `<rect x="8" y="16" width="24" height="18" rx="2"/><path d="M6 16h28v5H6zM20 16v18"/><path d="M20 16c-6 0-8-9-3-9 4 0 3 9 3 9zM20 16c6 0 8-9 3-9-4 0-3 9-3 9z"/>`,
    // clock
    `<circle cx="20" cy="20" r="13"/><path d="M20 12v8l6 4"/>`,
    // leaf
    `<path d="M8 32 C8 16 20 6 33 7 C34 20 24 32 8 32Z"/><path d="M8 32 C16 24 24 18 31 14"/>`,
    // chat bubble
    `<path d="M6 10h28v16H16l-7 7v-7H6Z"/><path d="M13 16h14M13 21h9"/>`,
    // airplane
    `<path d="M4 22 L36 13 L30 24 L18 24 L13 33 L12 25 Z"/>`,
    // umbrella
    `<path d="M6 20a14 14 0 0 1 28 0 Z"/><path d="M20 6V4M20 20v11a4 4 0 0 1-8 0"/>`,
    // diamond
    `<path d="M11 7h18l6 8-15 19L5 15Z"/><path d="M5 15h30M11 7l6 8M29 7l-6 8M17 15l3 19 3-19"/>`,
    // flower
    `<circle cx="20" cy="20" r="4"/><path d="M20 16c-2-6 4-10 4-10s4 6-1 9M24 20c6-2 10 4 10 4s-6 4-9-1M20 24c2 6-4 10-4 10s-4-6 1-9M16 20c-6 2-10-4-10-4s6-4 9 1"/>`,
    // bell
    `<path d="M11 27 C11 18 12 11 20 11 C28 11 29 18 29 27 L31 30 H9 Z"/><path d="M17 30a3 3 0 0 0 6 0M20 11V7"/>`,
    // paper plane
    `<path d="M5 20 L35 7 L27 34 L19 24 Z"/><path d="M19 24 L35 7"/>`,
    // cloud
    `<path d="M12 28h17a6 6 0 0 0 1-12 8 8 0 0 0-15-2 6 6 0 0 0-3 14Z"/>`,
    // anchor
    `<circle cx="20" cy="9" r="3"/><path d="M20 12v22M11 22H29M11 22c0 7 5 10 9 11M29 22c0 7-5 10-9 11"/>`,
    // key
    `<circle cx="13" cy="13" r="7"/><path d="M18 18l14 14M28 28l4-4M24 32l4-4"/>`,
];

function emit(d, cx, cy, scale, rot, op) {
    return `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${scale.toFixed(3)}) translate(-20 -20)" opacity="${op.toFixed(2)}">${d}</g>`;
}

const groups = [];
for (let i = 0; i < COUNT; i++) {
    const d = pick(DOODLES);
    const cx = rand(0, TILE);
    const cy = rand(0, TILE);
    const scale = rand(0.85, 1.5);
    const rot = rand(-28, 28);
    const op = rand(0.55, 1.0);
    // Place the doodle plus wraparound copies for any edge it bleeds across,
    // guaranteeing a seamless repeat.
    for (const dx of [-TILE, 0, TILE]) {
        for (const dy of [-TILE, 0, TILE]) {
            const x = cx + dx, y = cy + dy;
            if (x < -BLEED || x > TILE + BLEED || y < -BLEED || y > TILE + BLEED) continue;
            groups.push(emit(d, x, y, scale, rot, op));
        }
    }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}">
<g fill="none" stroke="#5b5347" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
${groups.join('\n')}
</g>
</svg>`;

writeFileSync(new URL('./doodle.svg', import.meta.url), svg);
console.log(`doodle.svg written: ${groups.length} doodle instances, ${TILE}x${TILE} tile`);
