// ---------- Parody hero traits and villains ----------
// Plain script loaded before the main game script in game.html. It uses the drawing helpers defined
// there (shape, ellipse, circle, box, shine, eye, OUTLINE, ctx), which are looked up at draw time.
//
// Exports (top-level consts/functions): PARODY_TRAITS, VILLAINS, drawVillain.
// Villains draw in a 48x48 box centered at (24,24) facing LEFT.

// ----- small local helpers (prefixed `ip` so they never collide with game globals) -----
const IP_TAU = Math.PI * 2;

// polygon from [[x,y],...] points
function ipPoly(fill, pts) {
  shape(fill, () => { pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); });
}
// a limb: a fat round-capped line with a dark outline around it
function ipLimb(x0, y0, x1, y1, w, color) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = w + 1.5; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.restore();
}
// a plain stroked curve/line with no outline
function ipStroke(color, w, build) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); build(); ctx.stroke(); ctx.restore();
}
function ipText(str, x, y, size, color) {
  ctx.save(); ctx.fillStyle = color; ctx.font = 'bold ' + size + 'px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y); ctx.restore();
}
// big cartoon eye with a coloured iris (used by lots of characters)
function ipEye(x, y, rx, ry, iris, lookX = 0.4, lookY = 0) {
  ctx.save(); ctx.lineWidth = 1;
  ellipse(x, y, rx, ry, '#fff');
  const px = x + lookX * rx * 0.4, py = y + lookY * ry * 0.4;
  ellipse(px, py, rx * 0.62, ry * 0.7, iris);
  ctx.beginPath(); ctx.ellipse(px + lookX * 0.4, py, rx * 0.3, ry * 0.4, 0, 0, IP_TAU); ctx.fillStyle = '#111'; ctx.fill();
  ctx.beginPath(); ctx.arc(px + rx * 0.18, py - ry * 0.25, rx * 0.16, 0, IP_TAU); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
}
// glowing energy orb: dim when idle (f=0), big/bright/sparkling when charged (f=1)
function ipOrb(x, y, r, col, f, t = 0) {
  const k = Math.max(0, Math.min(1, f));
  ctx.save(); ctx.lineWidth = 0; ctx.fillStyle = col;
  ctx.globalAlpha = 0.18 + 0.3 * k;
  ctx.beginPath(); ctx.arc(x, y, r * (0.9 + 1.1 * k), 0, IP_TAU); ctx.fill();
  ctx.globalAlpha = 0.55 + 0.35 * k;
  ctx.beginPath(); ctx.arc(x, y, r * (0.45 + 0.5 * k), 0, IP_TAU); ctx.fill();
  ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, r * (0.12 + 0.3 * k), 0, IP_TAU); ctx.fill();
  if (k > 0.3) { // crackling sparks around a charged orb
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.globalAlpha = 0.85;
    for (let i = 0; i < 6; i++) {
      const a = t * 5 + i * IP_TAU / 6, r0 = r * (0.9 + k), r1 = r * (1.4 + 1.3 * k);
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
    }
  }
  ctx.restore();
}

// =====================================================================================
// Extra traits for the four existing parody heroes (not redefined here)
// =====================================================================================
const PARODY_TRAITS = {
  'Super Marinara':     { id: 'marinara', weight: 1.0, perk: { id: 'none',       label: 'All-rounder' } },
  'Soggy the Hedgehog': { id: 'soggy',    weight: 0.9, perk: { id: 'glide',      label: 'Rain cloud: falls slower' } },
  'Tax-Man':            { id: 'taxman',   weight: 1.1, perk: { id: 'snack',      label: 'Audit: combos last longer' } },
  'Lunk':               { id: 'lunk',     weight: 1.0, perk: { id: 'kickwindow', label: 'Hero grip: longer wall-kick window' } },
};

// =====================================================================================
// VILLAINS: 48x48 box centered (24,24), facing LEFT. `firing` 0..1 = charge telegraph.
// =====================================================================================
const VILLAINS = {
  // ------------------------------------------------ Big Meatball (vs Super Marinara)
  marinara: {
    name: 'Big Meatball',
    draw(t, firing) {
      const b = Math.sin(t * 2) * 1.6, wob = Math.sin(t * 4) * 0.8;
      ctx.save(); ctx.translate(0, b);
      // spikes all around
      for (let i = 0; i < 12; i++) {
        const a = i * IP_TAU / 12 + 0.2, r0 = 14, r1 = 18.8 + (i % 2) * 1.6 + wob * (i % 2 ? 1 : -1);
        const dx = Math.cos(a), dy = Math.sin(a), px = -dy * 2.6, py = dx * 2.6;
        ipPoly('#7c2d12', [[24 + dx * r0 + px, 27 + dy * r0 + py], [24 + dx * r1, 27 + dy * r1], [24 + dx * r0 - px, 27 + dy * r0 - py]]);
      }
      // the meatball itself
      circle(24, 27, 15, shine(12, 12, 36, 42, '#b45309', '#451a03'));
      ctx.save(); ctx.fillStyle = '#d97706'; ctx.globalAlpha = 0.5;
      for (const [x, y] of [[14, 30], [32, 33], [28, 40], [17, 38], [33, 23]]) { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, IP_TAU); ctx.fill(); }
      ctx.restore();
      // dripping marinara
      shape('#dc2626', () => { ctx.moveTo(12, 19); ctx.quadraticCurveTo(24, 8, 36, 19); ctx.lineTo(34, 21); ctx.lineTo(32.5, 26); ctx.lineTo(30, 21); ctx.lineTo(25, 22); ctx.lineTo(22, 28); ctx.lineTo(20, 21); ctx.lineTo(15, 22); ctx.closePath(); });
      // gold crown with gems
      shape(shine(0, 3, 0, 14, '#fde047', '#ca8a04'), () => { ctx.moveTo(14.5, 14); ctx.lineTo(15.5, 4.5); ctx.lineTo(19.5, 9.5); ctx.lineTo(24, 2.5); ctx.lineTo(28.5, 9.5); ctx.lineTo(32.5, 4.5); ctx.lineTo(33.5, 14); ctx.closePath(); });
      circle(19.5, 11.4, 1.2, '#3b82f6'); circle(24, 9.5, 1.3, '#ef4444'); circle(28.5, 11.4, 1.2, '#3b82f6');
      // furious face
      eye(17.5, 24, 3.6, -0.7); eye(28, 24, 3.6, -0.7);
      ipStroke('#111', 2, () => { ctx.moveTo(12.4, 18.8); ctx.lineTo(21.4, 22); ctx.moveTo(34.6, 18.8); ctx.lineTo(25.4, 22); });
      shape('#450a0a', () => { ctx.ellipse(21, 33, 7.5, 3.6 + firing * 2.4, 0, 0, IP_TAU); });
      ctx.save(); ctx.lineWidth = 0.8;
      ipPoly('#fff', [[15, 31], [17.5, 31.8], [16.2, 34.4]]); ipPoly('#fff', [[21, 30], [24, 30.4], [22.4, 33.6]]); ipPoly('#fff', [[27, 31], [28.4, 33.4], [24.8, 32]]);
      ctx.restore();
      ipOrb(11.5, 33, 6.8, '#f87171', firing, t);                         // tomato-sauce charge in the mouth
      ctx.restore();
    },
  },
  // ------------------------------------------------ Dr. Eggplant (vs Soggy)
  soggy: {
    name: 'Dr. Eggplant',
    draw(t, firing) {
      const b = Math.sin(t * 2) * 1.6, fl = Math.sin(t * 22);
      ctx.save(); ctx.translate(0, b);
      // hover flame under the saucer
      ipPoly('#fb923c', [[19.5, 43], [28.5, 43], [24 + fl, 48 + fl * 0.8]]);
      ipPoly('#fde047', [[21.5, 43], [26.5, 43], [24, 46.5]]);
      // plump eggplant body
      ellipse(24, 21, 11.5, 14.5, shine(12, 6, 36, 36, '#a855f7', '#4c1d95'));
      ellipse(19, 14, 2.4, 4.5, '#c084fc', 0.5);                          // glossy highlight
      // green calyx and stem
      shape('#16a34a', () => { ctx.moveTo(15.5, 9.5); ctx.lineTo(20.5, 8.5); ctx.lineTo(24, 4.5); ctx.lineTo(27.5, 8.5); ctx.lineTo(32.5, 9.5); ctx.lineTo(27, 11.5); ctx.lineTo(24, 12.5); ctx.lineTo(21, 11.5); ctx.closePath(); });
      ipLimb(24, 5, 25.5, 1.2, 2.2, '#15803d');
      // goggles, eyes, curly mustache
      circle(19, 17, 4.6, '#e0f2fe'); circle(28.6, 17, 4.6, '#e0f2fe');
      eye(19, 17, 3.2, -0.7); eye(28.6, 17, 3.2, -0.7);
      ipStroke('#475569', 1.6, () => { ctx.moveTo(23.6, 17); ctx.lineTo(24, 17); });
      ellipse(19, 24, 5.2, 2.2, '#111', -0.3); ellipse(28, 24, 5.2, 2.2, '#111', 0.3);
      ipStroke('#111', 1.2, () => { ctx.moveTo(14, 25.5); ctx.quadraticCurveTo(11.5, 27, 12.6, 22.8); ctx.moveTo(33, 25.5); ctx.quadraticCurveTo(35.5, 27, 34.4, 22.8); });
      // arm lifting a bubbling flask toward the player (left)
      ipLimb(15, 27, 9.5, 29, 3.4, '#7e22ce');
      box(4.5, 21, 3, 5, 1, '#e0f2fe');
      ellipse(6, 30.5, 5.2, 5, '#e0f2fe');
      ellipse(6, 31.8, 4, 3.6, '#84cc16');
      ipOrb(6, 19.5, 7, '#a3e635', firing, t);
      // teacup hover-vehicle with saucer
      ellipse(24, 41.8, 13.5, 2.4, shine(0, 40, 0, 44, '#f8fafc', '#94a3b8'));
      shape(shine(0, 32, 0, 42, '#ffffff', '#cbd5e1'), () => { ctx.moveTo(11.5, 32); ctx.lineTo(36.5, 32); ctx.quadraticCurveTo(35.5, 41.4, 24, 41.4); ctx.quadraticCurveTo(12.5, 41.4, 11.5, 32); ctx.closePath(); });
      ipStroke('#3b82f6', 1.6, () => { ctx.moveTo(12.4, 35); ctx.lineTo(35.6, 35); });
      ipStroke(OUTLINE, 3.4, () => { ctx.arc(37, 36, 3.4, -1.6, 1.6); });
      ipStroke('#f8fafc', 1.8, () => { ctx.arc(37, 36, 3.4, -1.6, 1.6); });
      ctx.restore();
    },
  },
  // ------------------------------------------------ The IRS Ghost (vs Tax-Man)
  taxman: {
    name: 'The IRS Ghost',
    draw(t, firing) {
      const b = Math.sin(t * 2) * 1.6;
      ctx.save(); ctx.translate(0, b);
      // Pac-style ghost: dome head, wavy skirt
      shape(shine(0, 6, 0, 46, '#7dd3fc', '#2563eb'), () => {
        ctx.moveTo(38, 43); ctx.lineTo(38, 20); ctx.arc(24, 20, 14, 0, Math.PI, true); ctx.lineTo(10, 43);
        for (let i = 0; i < 4; i++) {
          const x0 = 10 + i * 7, w = Math.sin(t * 4 + i * 1.7) * 1.4;
          ctx.quadraticCurveTo(x0 + 1.75, 48 + w, x0 + 3.5, 43 - w * 0.5);
          ctx.quadraticCurveTo(x0 + 5.25, 48 - w, x0 + 7, 43 + w * 0.3);
        }
        ctx.closePath();
      });
      // big eyes staring left
      eye(17, 23, 5.2, -0.9); eye(29.5, 23, 5.2, -0.9);
      // green accountant's visor (the Tax-Man's very own)
      ctx.save(); ctx.globalAlpha = 0.9;
      shape(shine(0, 8, 0, 18, '#4ade80', '#15803d'), () => { ctx.moveTo(4, 17); ctx.quadraticCurveTo(10, 10, 22, 8.5); ctx.lineTo(38, 12); ctx.lineTo(38, 17); ctx.quadraticCurveTo(22, 13.5, 4, 19.5); ctx.closePath(); });
      ctx.restore();
      // stubby arm clutching a red-stamped form
      ellipse(14, 34, 4.4, 3, '#7dd3fc', 0.4);
      ctx.save(); ctx.translate(7, 29); ctx.rotate(-0.12);
      box(-6, -9, 13, 17, 1, '#f8fafc');
      ipStroke('#94a3b8', 0.9, () => { for (let y = -6; y < 1; y += 2.4) { ctx.moveTo(-4, y); ctx.lineTo(5, y); } });
      ctx.save(); ctx.translate(0.5, 3.5); ctx.rotate(-0.35);
      box(-5, -2.6, 10, 5.2, 0.8, '#fee2e2'); ipText('DUE', 0, 0.2, 4.4, '#b91c1c');
      ctx.restore();
      ctx.restore();
      ipOrb(7.5, 32.5, 7, '#ef4444', firing, t);                          // stamp glows before it fires
      ctx.restore();
    },
  },
  // ------------------------------------------------ Gluten-dorf (vs Lunk)
  lunk: {
    name: 'Gluten-dorf',
    draw(t, firing) {
      const b = Math.sin(t * 2) * 1.6, hem = Math.sin(t * 3);
      ctx.save(); ctx.translate(0, b);
      // charred robe with ragged hem
      shape(shine(0, 22, 0, 46, '#57534e', '#0c0a09'), () => {
        ctx.moveTo(14, 45); ctx.lineTo(17, 22); ctx.lineTo(33, 22); ctx.lineTo(37, 45);
        ctx.lineTo(33, 42.5 + hem); ctx.lineTo(29, 46); ctx.lineTo(25, 43 - hem); ctx.lineTo(21, 46.5); ctx.lineTo(17.5, 43); ctx.closePath();
      });
      ctx.save(); ctx.fillStyle = '#a16207'; ctx.globalAlpha = 0.55;
      for (const [x, y] of [[20, 30], [30, 33], [25, 38], [33, 40], [19, 41]]) { ctx.beginPath(); ctx.arc(x, y, 1, 0, IP_TAU); ctx.fill(); }
      ctx.restore();
      // far arm
      ipLimb(33, 26, 38, 32, 4.4, '#292524'); circle(39, 33, 2.4, '#78350f');
      // near arm holds the ember staff up and forward (left)
      ipLimb(18, 28, 10, 27, 4.6, '#292524'); circle(9, 26.6, 2.8, '#78350f');
      ipLimb(9, 12, 9.5, 46, 2.2, '#57534e');
      ipPoly('#57534e', [[6, 11], [9, 9], [12, 11], [10.5, 12.5], [9, 11.5], [7.5, 12.5]]);   // prongs cradling the orb
      ipOrb(9, 8.5, 7.5, '#f97316', firing, t);
      // burnt-toast face with a crust edge
      ellipse(25.5, 18, 9, 8.2, '#78350f');
      ellipse(25.5, 18, 7.2, 6.4, shine(0, 12, 0, 24, '#c28a4a', '#7c4a1e'));
      ctx.save(); ctx.fillStyle = '#1c1917'; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(29, 22, 2.2, 0, IP_TAU); ctx.arc(22, 13.5, 1.6, 0, IP_TAU); ctx.fill(); ctx.restore();
      // flour-white beard
      shape('#e7e5e4', () => { ctx.moveTo(18.5, 20); ctx.lineTo(32.5, 20); ctx.lineTo(29.5, 27); ctx.lineTo(25.5, 32); ctx.lineTo(22, 27); ctx.closePath(); });
      // glowing red eyes, scowling
      ctx.save(); ctx.lineWidth = 0; ctx.fillStyle = '#ef4444'; ctx.globalAlpha = 0.35 + firing * 0.5;
      ctx.beginPath(); ctx.arc(22, 16.4, 3.4 + firing * 2, 0, IP_TAU); ctx.arc(29, 16.4, 3.4 + firing * 2, 0, IP_TAU); ctx.fill(); ctx.restore();
      ellipse(22, 16.4, 2, 1.5, firing > 0.5 ? '#fef08a' : '#f87171'); ellipse(29, 16.4, 2, 1.5, firing > 0.5 ? '#fef08a' : '#f87171');
      ipStroke('#111', 1.3, () => { ctx.moveTo(18.4, 13); ctx.lineTo(24, 14.6); ctx.moveTo(32.6, 13); ctx.lineTo(27, 14.6); });
      // pointy wizard hat made of crust
      ellipse(25.5, 11, 12, 2.6, '#44403c');
      shape(shine(0, 0, 0, 11, '#78350f', '#1c1917'), () => { ctx.moveTo(15.5, 11); ctx.quadraticCurveTo(22, 8, 24, 0.8); ctx.quadraticCurveTo(26.6, 7, 35.5, 11); ctx.closePath(); });
      box(18.5, 8, 14, 2, 0.8, '#facc15');
      ctx.restore();
    },
  },
};

// Draw a villain centered at (x,y). Art is authored facing LEFT, and the transform is scale(facing,1):
// facing=1 -> faces left (as drawn), facing=-1 -> mirrored to face right.
function drawVillain(id, x, y, facing, t, firing) {
  const v = VILLAINS[id] || VILLAINS.taxman;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.translate(-24, -24);
  ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = OUTLINE;
  v.draw(t, Math.max(0, Math.min(1, firing || 0)));
  ctx.restore();
}
