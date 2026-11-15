/* Pixel Leap view sizing. Pure geometry: all dimensions are device pixels. */
(function (root) {
  "use strict";
  function compute(pxW, pxH, dpr, insets) {
    pxW = Math.max(1, Math.round(Number(pxW) || 1));
    pxH = Math.max(1, Math.round(Number(pxH) || 1));
    dpr = Math.max(1, Number(dpr) || 1);
    const insetTop = Math.max(0, Number(insets && insets.top) || 0);
    const insetLeft = Math.max(0, Number(insets && insets.left) || 0);
    const insetRight = Math.max(0, Number(insets && insets.right) || 0);
    const portrait = pxH > pxW;
    const rawBandPx = portrait ? Math.round(pxH * 0.6) : pxH;
    let S;
    if (portrait) S = Math.max(1, Math.min(Math.floor((pxW - insetLeft*dpr - insetRight*dpr) / 176), Math.floor(rawBandPx / 224)));
    else S = Math.max(1, Math.floor(pxH / 224));
    const offY = Math.ceil(insetTop * dpr / S) * S;
    const bandPx = portrait ? Math.max(1, Math.round((pxH - offY) * 0.6)) : Math.max(1, pxH - offY);
    if (portrait) S = Math.max(1, Math.min(S, Math.floor(bandPx / 224)));
    else S = Math.max(1, Math.min(S, Math.floor((pxH - offY) / 224)));
    const w = (pxW - insetLeft*dpr - insetRight*dpr) / S;
    const h = bandPx / S;
    return { S, w, h, offX: Math.floor(insetLeft*dpr + (pxW - insetLeft*dpr - insetRight*dpr - w * S) / 2), offY, bandPx, portrait };
  }
  const PixelView = { compute };
  root.PixelView = PixelView;
  if (typeof module === "object" && module.exports) module.exports = PixelView;
})(typeof globalThis !== "undefined" ? globalThis : this);
