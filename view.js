/* Pixel Leap view sizing. Pure geometry: all dimensions are device pixels. */
(function (root) {
  "use strict";
  function compute(pxW, pxH, dpr, insets) {
    pxW = Math.max(1, Math.round(Number(pxW) || 1));
    pxH = Math.max(1, Math.round(Number(pxH) || 1));
    dpr = Math.max(1, Number(dpr) || 1);
    const portrait = pxH > pxW;
    const bandPx = portrait ? Math.round(pxH * 0.6) : pxH;
    let S;
    if (portrait) S = Math.max(1, Math.min(Math.floor(pxW / 176), Math.floor(bandPx / 224)));
    else S = Math.max(1, Math.floor(pxH / 224));
    const w = pxW / S;
    const h = bandPx / S;
    return { S, w, h, offX: Math.floor((pxW - w * S) / 2), offY: 0, bandPx, portrait };
  }
  const PixelView = { compute };
  root.PixelView = PixelView;
  if (typeof module === "object" && module.exports) module.exports = PixelView;
})(typeof globalThis !== "undefined" ? globalThis : this);
