var sn = Object.defineProperty;
var rn = (n, l, a) => l in n ? sn(n, l, { enumerable: !0, configurable: !0, writable: !0, value: a }) : n[l] = a;
var ge = (n, l, a) => rn(n, typeof l != "symbol" ? l + "" : l, a);
import { jsx as e, jsxs as r, Fragment as Y } from "react/jsx-runtime";
import { forwardRef as Ge, useState as A, useRef as K, useId as ne, useCallback as q, useEffect as X, createContext as Se, useContext as De, Fragment as Me, useLayoutEffect as cn, useMemo as J, Component as on, createElement as dn } from "react";
import { Wallet as mn, VolumeX as un, Volume2 as hn, User as _n, Video as pn, Upload as fn, TrendingUp as Nn, TrendingDown as vn, Trash2 as bn, Sun as gn, Star as yn, Sparkles as kn, CircleStop as wn, LogOut as Cn, Share2 as xn, Settings as Mn, Send as Tn, Search as Sn, Plus as Dn, Play as En, Pin as An, Pause as zn, Paperclip as $n, Moon as Ln, Minus as In, Mic as Bn, Menu as Pn, Lock as Fn, Loader as Rn, Info as On, Home as Un, Heart as Hn, Hash as Kn, Forward as Wn, Filter as Gn, Maximize2 as Zn, SmilePlus as jn, MessageCircle as Yn, Eye as Vn, ExternalLink as qn, Pencil as Qn, Download as Xn, FileText as Jn, CircleAlert as ea, Copy as na, X as aa, Clock as ia, ChevronUp as la, ChevronRight as ta, ChevronDown as sa, ChevronLeft as ra, CircleCheck as ca, Check as oa, Camera as da, Calendar as ma, Bookmark as ua, Bell as ha, Users as _a, Terminal as pa, Tag as fa, ShieldCheck as Na, Server as va, Reply as ba, RefreshCw as ga, Package as ya, MoreHorizontal as ka, Link2 as wa, PanelRight as Ca, Layers as xa, KeyRound as Ma, Globe as Ta, Database as Sa, Cloud as Da, BarChart3 as Ea, ArrowRight as Aa, ArrowLeft as za, AlertTriangle as $a, Activity as La } from "lucide-react";
import { createPortal as Ne } from "react-dom";
const v = (...n) => n.filter(Boolean).join(" "), Ze = {
  activity: La,
  alert: $a,
  "arrow-back": za,
  "arrow-forward": Aa,
  chart: Ea,
  cloud: Da,
  database: Sa,
  globe: Ta,
  key: Ma,
  layers: xa,
  inspector: Ca,
  link: wa,
  more: ka,
  package: ya,
  refresh: ga,
  reply: ba,
  server: va,
  shield: Na,
  tag: fa,
  terminal: pa,
  users: _a,
  bell: ha,
  bookmark: ua,
  calendar: ma,
  camera: da,
  check: oa,
  "check-circle": ca,
  "chevron-back": ra,
  "chevron-down": sa,
  "chevron-forward": ta,
  "chevron-up": la,
  clock: ia,
  close: aa,
  copy: na,
  danger: ea,
  document: Jn,
  download: Xn,
  edit: Qn,
  external: qn,
  eye: Vn,
  chat: Yn,
  emoji: jn,
  expand: Zn,
  filter: Gn,
  forward: Wn,
  hash: Kn,
  heart: Hn,
  home: Un,
  info: On,
  loading: Rn,
  lock: Fn,
  menu: Pn,
  mic: Bn,
  minus: In,
  moon: Ln,
  paperclip: $n,
  pause: zn,
  pin: An,
  play: En,
  plus: Dn,
  search: Sn,
  send: Tn,
  settings: Mn,
  share: xn,
  "sign-out": Cn,
  stop: wn,
  sparkle: kn,
  star: yn,
  sun: gn,
  trash: bn,
  "trend-down": vn,
  "trend-up": Nn,
  upload: fn,
  video: pn,
  user: _n,
  volume: hn,
  "volume-off": un,
  wallet: mn
}, Ia = /* @__PURE__ */ new Set([
  "arrow-back",
  "arrow-forward",
  "chevron-back",
  "chevron-forward",
  "external",
  "forward",
  "reply",
  "send",
  "share",
  "sign-out"
]), ze = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 };
function D({ className: n, label: l, name: a, size: i = "md", tone: t = "default", ...s }) {
  const c = Ze[a];
  return /* @__PURE__ */ e(
    c,
    {
      "aria-hidden": l ? void 0 : !0,
      "aria-label": l,
      className: v("nim-icon", n),
      "data-flip": Ia.has(a) ? "true" : void 0,
      "data-tone": t === "default" ? void 0 : t,
      focusable: "false",
      height: ze[i],
      role: l ? "img" : void 0,
      strokeWidth: 1.75,
      width: ze[i],
      ...s
    }
  );
}
const dl = Object.keys(Ze), Ba = { sm: "sm", md: "md", lg: "md" }, G = Ge(function({ className: l, label: a, name: i, size: t = "md", type: s = "button", variant: c = "ghost", ...o }, d) {
  return /* @__PURE__ */ e(
    "button",
    {
      "aria-label": a,
      className: v("nim-icon-button", `nim-icon-button--${c}`, `nim-icon-button--${t}`, l),
      ref: d,
      title: a,
      type: s,
      ...o,
      children: /* @__PURE__ */ e(D, { name: i, size: Ba[t] })
    }
  );
}), Pa = {
  close: "Close menu",
  collapse: "Collapse",
  expand: "Expand",
  menu: "Open menu",
  nav: "Admin navigation"
};
function ml({
  brand: n,
  children: l,
  className: a,
  collapsible: i = !1,
  contextualFooter: t,
  contextualGroups: s,
  contextualHeader: c,
  contextualValue: o,
  groups: d,
  labels: u,
  navigation: m = "sidebar",
  locationKey: h,
  sidebarFooter: f,
  sidebarHeader: _,
  title: N,
  toolbar: b,
  value: p,
  titleRole: y = "page",
  viewport: k = !1
}) {
  const S = { ...Pa, ...u }, [z, g] = A(!1), [C, x] = A(!1), I = K(null), M = K(null), F = ne(), $ = q(() => g(!1), []), L = y === "scope" ? "div" : "h1";
  X($, [$, o, h, p]), X(() => {
    const P = I.current;
    if (!P || (z && !P.open && P.showModal(), !z && P.open && P.close(), !z)) return;
    const w = M.current, O = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const W = new ResizeObserver(() => {
      w && getComputedStyle(w).display === "none" && g(!1);
    });
    return w != null && w.parentElement && W.observe(w.parentElement), () => {
      W.disconnect(), document.body.style.overflow = O, w == null || w.focus();
    };
  }, [z]);
  const B = (P, w, O) => /* @__PURE__ */ e("nav", { "aria-label": O, className: "nim-admin__nav", children: P.map((W) => /* @__PURE__ */ r("div", { className: "nim-admin__group", children: [
    W.label ? /* @__PURE__ */ r("p", { className: "nim-admin__group-label", children: [
      W.icon ? /* @__PURE__ */ e(D, { name: W.icon, size: "xs" }) : null,
      W.label
    ] }) : null,
    W.items.map((T) => {
      const R = T.key === w, E = /* @__PURE__ */ r(Y, { children: [
        T.icon ? /* @__PURE__ */ e(D, { name: T.icon, size: "sm" }) : null,
        /* @__PURE__ */ e("span", { children: T.label })
      ] }), U = {
        "aria-current": R ? m === "nested" && P === d ? "location" : "page" : void 0,
        className: "nim-admin__link",
        "data-active": R ? "true" : void 0,
        onClick: () => {
          var V;
          (V = T.onSelect) == null || V.call(T), g(!1);
        },
        // The only text left in the rail is the icon, so the accessible
        // name has to survive the collapse — it is the label, always,
        // not a second string that can drift away from it.
        title: typeof T.label == "string" ? T.label : void 0
      }, H = T.href ? /* @__PURE__ */ e("a", { href: T.href, ...U, children: E }) : /* @__PURE__ */ e("button", { type: "button", ...U, children: E });
      return /* @__PURE__ */ r("div", { className: "nim-admin__nav-item", children: [
        H,
        m === "nested" && P === d && R && (s != null && s.length) ? /* @__PURE__ */ e("div", { className: "nim-admin__nested", children: B(s, o ?? p, `${S.nav} · current section`) }) : null
      ] }, T.key);
    })
  ] }, W.key)) }), Q = B(d, p, S.nav), j = m !== "nested" && (s != null && s.length) ? B(s, o ?? p, `${S.nav} · current section`) : null;
  return /* @__PURE__ */ r(
    "div",
    {
      className: v("nim-admin", a),
      "data-collapsed": i && C ? "true" : void 0,
      "data-drawer": z ? "open" : void 0,
      "data-navigation": m,
      "data-viewport": k ? "true" : void 0,
      children: [
        m !== "sections" ? /* @__PURE__ */ r("aside", { className: "nim-admin__sidebar", children: [
          n || i ? /* @__PURE__ */ e("div", { className: "nim-admin__brand", children: n }) : null,
          _ ? /* @__PURE__ */ e("div", { className: "nim-admin__sidebar-head", children: _ }) : null,
          Q,
          f ? /* @__PURE__ */ e("div", { className: "nim-admin__sidebar-foot", children: f }) : null,
          i ? /* @__PURE__ */ r(
            "button",
            {
              "aria-label": C ? S.expand : S.collapse,
              "aria-expanded": !C,
              className: "nim-admin__rail-toggle",
              onClick: () => x((P) => !P),
              type: "button",
              children: [
                /* @__PURE__ */ e(D, { name: C ? "chevron-forward" : "chevron-back", size: "sm" }),
                /* @__PURE__ */ e("span", { children: C ? S.expand : S.collapse })
              ]
            }
          ) : null
        ] }) : null,
        /* @__PURE__ */ e("dialog", { "aria-label": S.nav, className: "nim-admin__drawer", id: F, onCancel: $, onClose: $, onClick: (P) => {
          P.target === P.currentTarget && $();
        }, ref: I, children: /* @__PURE__ */ r("div", { className: "nim-admin__drawer-panel", children: [
          /* @__PURE__ */ r("div", { className: "nim-admin__drawer-head", children: [
            n,
            /* @__PURE__ */ e(G, { label: S.close, name: "close", onClick: () => g(!1), size: "sm" })
          ] }),
          _ ? /* @__PURE__ */ e("div", { className: "nim-admin__sidebar-head", children: _ }) : null,
          Q,
          f ? /* @__PURE__ */ e("div", { className: "nim-admin__sidebar-foot", children: f }) : null
        ] }) }),
        /* @__PURE__ */ r("div", { className: "nim-admin__workspace", children: [
          /* @__PURE__ */ r("header", { className: "nim-admin__topbar", children: [
            /* @__PURE__ */ e(
              G,
              {
                "aria-expanded": z,
                "aria-controls": F,
                className: "nim-admin__menu",
                label: S.menu,
                name: "menu",
                onClick: () => g(!0),
                ref: M,
                size: "sm"
              }
            ),
            m === "sections" && n ? /* @__PURE__ */ e("div", { className: "nim-admin__masthead-brand", children: n }) : null,
            N ? /* @__PURE__ */ e(L, { className: "nim-admin__title", children: N }) : null,
            b ? /* @__PURE__ */ e("div", { className: "nim-admin__toolbar", children: b }) : null
          ] }),
          m === "sections" ? /* @__PURE__ */ e("div", { className: "nim-admin__sections", children: Q }) : null,
          j ? /* @__PURE__ */ r("div", { className: "nim-admin__context-layout", children: [
            /* @__PURE__ */ r("aside", { className: "nim-admin__context", children: [
              c ? /* @__PURE__ */ e("div", { className: "nim-admin__context-head", children: c }) : null,
              /* @__PURE__ */ e("div", { className: "nim-admin__context-nav", children: j }),
              t ? /* @__PURE__ */ e("div", { className: "nim-admin__context-foot", children: t }) : null
            ] }),
            /* @__PURE__ */ e("main", { className: "nim-admin__main", children: l })
          ] }) : /* @__PURE__ */ e("main", { className: "nim-admin__main", children: l })
        ] })
      ]
    }
  );
}
function ul({
  actions: n,
  back: l,
  className: a,
  meta: i,
  status: t,
  subtitle: s,
  title: c
}) {
  return /* @__PURE__ */ r("header", { className: v("nim-detail-header", a), children: [
    l ? l.href ? /* @__PURE__ */ r("a", { className: "nim-detail-header__back", href: l.href, children: [
      /* @__PURE__ */ e(D, { name: "chevron-back", size: "sm" }),
      l.label
    ] }) : /* @__PURE__ */ r("button", { className: "nim-detail-header__back", onClick: l.onClick, type: "button", children: [
      /* @__PURE__ */ e(D, { name: "chevron-back", size: "sm" }),
      l.label
    ] }) : null,
    /* @__PURE__ */ r("div", { className: "nim-detail-header__row", children: [
      /* @__PURE__ */ r("div", { className: "nim-detail-header__text", children: [
        /* @__PURE__ */ r("div", { className: "nim-detail-header__headline", children: [
          /* @__PURE__ */ e("h1", { className: "nim-detail-header__title", children: c }),
          t ? /* @__PURE__ */ e("span", { className: "nim-detail-header__status", children: t }) : null
        ] }),
        s ? /* @__PURE__ */ e("p", { className: "nim-detail-header__subtitle", children: s }) : null,
        i ? /* @__PURE__ */ e("div", { className: "nim-detail-header__meta", children: i }) : null
      ] }),
      n ? /* @__PURE__ */ e("div", { className: "nim-detail-header__actions", children: n }) : null
    ] })
  ] });
}
function hl({
  chips: n,
  className: l,
  clearLabel: a,
  labels: i,
  onClearAll: t
}) {
  if (n.length === 0) return null;
  const s = {
    remove: (c) => `Remove filter ${c}`,
    toolbar: "Active filters",
    ...i
  };
  return /* @__PURE__ */ r("div", { "aria-label": s.toolbar, className: v("nim-filter-chips", l), role: "toolbar", children: [
    n.map((c) => /* @__PURE__ */ r("span", { className: "nim-filter-chip", children: [
      /* @__PURE__ */ r("span", { className: "nim-filter-chip__label", children: [
        c.label,
        c.value !== void 0 ? /* @__PURE__ */ r(Y, { children: [
          ": ",
          c.value
        ] }) : null
      ] }),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": s.remove(typeof c.label == "string" ? c.label : c.key),
          className: "nim-filter-chip__remove",
          onClick: c.onRemove,
          type: "button",
          children: /* @__PURE__ */ e(D, { name: "close", size: "xs" })
        }
      )
    ] }, c.key)),
    t && a ? /* @__PURE__ */ e("button", { className: "nim-filter-chips__clear", onClick: t, type: "button", children: a }) : null
  ] });
}
function _l({ className: n, empty: l, events: a, locale: i }) {
  const t = new Intl.DateTimeFormat(i, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
  return a.length === 0 ? /* @__PURE__ */ e("div", { className: v("nim-activity", n), children: l }) : /* @__PURE__ */ e("ol", { className: v("nim-activity", n), children: a.map((s) => /* @__PURE__ */ r("li", { className: "nim-activity__item", "data-tone": s.tone, children: [
    /* @__PURE__ */ e("span", { className: "nim-activity__marker", children: s.icon ? /* @__PURE__ */ e(D, { name: s.icon, size: "xs" }) : null }),
    /* @__PURE__ */ r("div", { className: "nim-activity__body", children: [
      /* @__PURE__ */ r("p", { className: "nim-activity__action", children: [
        s.actor ? /* @__PURE__ */ e("strong", { children: s.actor }) : null,
        " ",
        s.action,
        " ",
        s.target ? /* @__PURE__ */ e("span", { className: "nim-activity__target", children: s.target }) : null
      ] }),
      s.at ? /* @__PURE__ */ e("time", { className: "nim-activity__time", dateTime: s.at, children: t.format(new Date(s.at)) }) : null
    ] })
  ] }, s.id)) });
}
function pl({ children: n, className: l, width: a = "wide", ...i }) {
  return /* @__PURE__ */ e("div", { className: v("nim-page", l), "data-width": a, ...i, children: n });
}
function fl({
  actions: n,
  caption: l,
  children: a,
  className: i,
  description: t,
  eyebrow: s,
  flush: c = !1,
  footer: o,
  marker: d,
  title: u,
  variant: m = "framed",
  ...h
}) {
  const f = u || l || t || s || n;
  return /* @__PURE__ */ r("section", { className: v("nim-panel", i), "data-variant": m, ...h, children: [
    f ? /* @__PURE__ */ r("header", { className: "nim-panel__head", children: [
      d ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-panel__marker", children: d }) : null,
      /* @__PURE__ */ r("div", { className: "nim-panel__heading", children: [
        s ? /* @__PURE__ */ e("p", { className: "nim-panel__eyebrow", children: s }) : null,
        u ? /* @__PURE__ */ r("div", { className: "nim-panel__title-row", children: [
          /* @__PURE__ */ e("h2", { className: "nim-panel__title", children: u }),
          l ? /* @__PURE__ */ e("p", { className: "nim-panel__caption", children: l }) : null
        ] }) : null,
        t ? /* @__PURE__ */ e("p", { className: "nim-panel__description", children: t }) : null
      ] }),
      n ? /* @__PURE__ */ e("div", { className: "nim-panel__actions", children: n }) : null
    ] }) : null,
    a ? /* @__PURE__ */ e("div", { className: "nim-panel__body", "data-flush": c ? "true" : void 0, children: a }) : null,
    o ? /* @__PURE__ */ e("div", { className: "nim-panel__foot", children: o }) : null
  ] });
}
function Nl({ actions: n, children: l, className: a, ...i }) {
  return /* @__PURE__ */ r("div", { className: v("nim-toolbar", a), role: "toolbar", ...i, children: [
    l ? /* @__PURE__ */ e("div", { className: "nim-toolbar__group", children: l }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-toolbar__actions", children: n }) : null
  ] });
}
function vl({
  className: n,
  delta: l,
  deltaDirection: a = "up",
  deltaIntent: i = "more-is-better",
  hint: t,
  source: s,
  unmeasured: c,
  icon: o,
  label: d,
  layout: u = "stacked",
  onClick: m,
  tone: h = "neutral",
  value: f,
  ..._
}) {
  const N = i === "more-is-better" ? a === "up" : a === "down";
  return /* @__PURE__ */ r(
    m ? "button" : "div",
    {
      className: v("nim-metric", m && "nim-metric--interactive", n),
      "data-layout": u === "stacked" ? void 0 : u,
      "data-tone": h === "neutral" ? void 0 : h,
      "data-unmeasured": c ? "true" : void 0,
      onClick: m,
      type: m ? "button" : void 0,
      ..._,
      children: [
        u === "inline" && o ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-metric__glyph", children: /* @__PURE__ */ e(D, { name: o, size: "sm" }) }) : null,
        /* @__PURE__ */ r("span", { className: "nim-metric__label", children: [
          u === "inline" ? null : o ? /* @__PURE__ */ e(D, { name: o, size: "xs" }) : null,
          d
        ] }),
        /* @__PURE__ */ e("span", { className: "nim-metric__value", children: f }),
        l || t ? /* @__PURE__ */ r("span", { className: "nim-metric__foot", children: [
          l ? /* @__PURE__ */ r("span", { className: "nim-metric__delta", "data-intent": N ? "good" : "bad", children: [
            /* @__PURE__ */ e(D, { name: a === "up" ? "trend-up" : "trend-down", size: "xs" }),
            l
          ] }) : null,
          t ? /* @__PURE__ */ e("span", { className: "nim-metric__hint", children: t }) : null,
          s ? /* @__PURE__ */ e("span", { className: "nim-metric__source", children: s }) : null
        ] }) : null
      ]
    }
  );
}
function bl({ children: n, className: l, columns: a = 4, dense: i = !1, presentation: t = "tiles", ...s }) {
  return /* @__PURE__ */ e(
    "div",
    {
      className: v("nim-metric-grid", l),
      "data-columns": a,
      "data-dense": i ? "true" : void 0,
      "data-presentation": t,
      ...s,
      children: n
    }
  );
}
function gl({ className: n, columns: l = 2, items: a, ...i }) {
  return /* @__PURE__ */ e("dl", { className: v("nim-facts", n), "data-columns": l, ...i, children: a.map((t, s) => /* @__PURE__ */ r(
    "div",
    {
      className: "nim-facts__item",
      "data-unmeasured": t.unmeasured ? "true" : void 0,
      children: [
        /* @__PURE__ */ r("dt", { className: "nim-facts__label", children: [
          t.label,
          t.source || t.why ? /* @__PURE__ */ e("span", { className: "nim-facts__source", children: t.unmeasured ? t.why : t.source }) : null
        ] }),
        /* @__PURE__ */ e("dd", { className: "nim-facts__value", "data-mono": t.mono ? "true" : void 0, children: t.mono ? /* @__PURE__ */ e("bdi", { dir: "ltr", children: t.value }) : t.value })
      ]
    },
    t.key ?? s
  )) });
}
function yl({ align: n = "stretch", children: l, className: a, template: i = "halves", ...t }) {
  return /* @__PURE__ */ e("div", { className: v("nim-columns", a), "data-align": n === "start" ? "start" : void 0, "data-template": i, ...t, children: l });
}
function kl({ actions: n, className: l, description: a, icon: i, title: t, tone: s = "neutral", ...c }) {
  return /* @__PURE__ */ r("section", { className: v("nim-status-hero", l), "data-tone": s, ...c, children: [
    /* @__PURE__ */ e("span", { className: "nim-status-hero__mark", children: /* @__PURE__ */ e(D, { name: i, size: "xl" }) }),
    /* @__PURE__ */ r("div", { className: "nim-status-hero__copy", children: [
      /* @__PURE__ */ e("strong", { className: "nim-status-hero__title", children: t }),
      a ? /* @__PURE__ */ e("p", { className: "nim-status-hero__description", children: a }) : null
    ] }),
    n ? /* @__PURE__ */ e("div", { className: "nim-status-hero__actions", children: n }) : null
  ] });
}
function wl({
  children: n,
  className: l,
  copiedLabel: a = "Copied",
  copyLabel: i = "Copy",
  label: t,
  wrap: s = !1,
  ...c
}) {
  const [o, d] = A(!1), u = typeof navigator < "u" && !!navigator.clipboard, m = q(() => {
    navigator.clipboard.writeText(n).then(() => {
      d(!0), window.setTimeout(() => d(!1), 1600);
    });
  }, [n]);
  return /* @__PURE__ */ r("figure", { className: v("nim-code", l), children: [
    t || u ? /* @__PURE__ */ r("figcaption", { className: "nim-code__head", children: [
      t ? /* @__PURE__ */ e("span", { className: "nim-code__label", children: t }) : /* @__PURE__ */ e("span", {}),
      u ? /* @__PURE__ */ r("button", { className: "nim-code__copy", onClick: m, type: "button", children: [
        /* @__PURE__ */ e(D, { name: o ? "check" : "copy", size: "xs" }),
        o ? a : i
      ] }) : null
    ] }) : null,
    /* @__PURE__ */ e("pre", { className: "nim-code__body", "data-wrap": s ? "true" : void 0, tabIndex: 0, ...c, children: n })
  ] });
}
function Cl({ children: n, className: l, pulse: a = !1, tone: i = "neutral", ...t }) {
  return /* @__PURE__ */ r("span", { className: v("nim-status", l), "data-tone": i, ...t, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-status__dot", "data-pulse": a ? "true" : void 0 }),
    n
  ] });
}
function xl({ children: n, className: l, size: a = "sm", ...i }) {
  return /* @__PURE__ */ e("code", { className: v("nim-mono", l), "data-size": a, dir: "ltr", ...i, children: n });
}
function Ml({ className: n, href: l, meta: a, onClick: i, title: t }) {
  const s = /* @__PURE__ */ r(Y, { children: [
    /* @__PURE__ */ e("strong", { className: "nim-record__title", children: t }),
    a ? /* @__PURE__ */ e("span", { className: "nim-record__meta", children: a }) : null
  ] });
  return l ? /* @__PURE__ */ e("a", { className: v("nim-record", n), href: l, children: s }) : i ? /* @__PURE__ */ e("button", { className: v("nim-record", n), onClick: i, type: "button", children: s }) : /* @__PURE__ */ e("span", { className: v("nim-record", n), children: s });
}
function Tl({ actions: n, children: l, className: a, footer: i, title: t, ...s }) {
  return /* @__PURE__ */ r("section", { className: v("nim-rail", a), ...s, children: [
    /* @__PURE__ */ r("header", { className: "nim-rail__head", children: [
      /* @__PURE__ */ e("h2", { className: "nim-rail__title", children: t }),
      n ? /* @__PURE__ */ e("div", { className: "nim-rail__actions", children: n }) : null
    ] }),
    /* @__PURE__ */ e("div", { className: "nim-rail__body", children: l }),
    i ? /* @__PURE__ */ e("div", { className: "nim-rail__foot", children: i }) : null
  ] });
}
function Sl({ children: n, className: l, meta: a, title: i, tone: t = "neutral", ...s }) {
  return /* @__PURE__ */ r(
    "div",
    {
      className: v("nim-rail__section", l),
      "data-tone": t === "neutral" ? void 0 : t,
      ...s,
      children: [
        i ? /* @__PURE__ */ r("p", { className: "nim-rail__section-head", children: [
          /* @__PURE__ */ e("span", { className: "nim-rail__section-title", children: i }),
          a ? /* @__PURE__ */ e("span", { className: "nim-rail__section-meta", children: a }) : null
        ] }) : null,
        n
      ]
    }
  );
}
function Dl({
  children: n,
  className: l,
  copiedLabel: a = "Copied",
  copyLabel: i = "Copy",
  ...t
}) {
  const [s, c] = A(!1), o = typeof navigator < "u" && !!navigator.clipboard, d = q(() => {
    navigator.clipboard.writeText(n).then(() => {
      c(!0), window.setTimeout(() => c(!1), 1600);
    });
  }, [n]);
  return /* @__PURE__ */ r("span", { className: v("nim-copy-chip", l), ...t, children: [
    /* @__PURE__ */ e("span", { className: "nim-copy-chip__value", children: n }),
    o ? /* @__PURE__ */ e(
      "button",
      {
        "aria-label": s ? a : `${i} ${n}`,
        className: "nim-copy-chip__button",
        onClick: d,
        type: "button",
        children: /* @__PURE__ */ e(D, { name: s ? "check" : "copy", size: "xs" })
      }
    ) : null
  ] });
}
function El({ aside: n, children: l, className: a, ...i }) {
  return /* @__PURE__ */ r("div", { className: v("nim-detail", a), ...i, children: [
    /* @__PURE__ */ e("div", { className: "nim-detail__main", children: l }),
    n ? /* @__PURE__ */ e("aside", { className: "nim-detail__aside", children: n }) : null
  ] });
}
function Al({
  className: n,
  href: l,
  mark: a,
  name: i,
  nameAccent: t,
  size: s = "md",
  tagline: c,
  ...o
}) {
  const d = /* @__PURE__ */ r(Y, { children: [
    a ? /* @__PURE__ */ e("span", { className: "nim-brand__mark", children: a }) : null,
    /* @__PURE__ */ r("span", { className: "nim-brand__text", children: [
      /* @__PURE__ */ r("strong", { className: "nim-brand__name", children: [
        i,
        t ? /* @__PURE__ */ e("span", { className: "nim-brand__name-accent", children: t }) : null
      ] }),
      c ? /* @__PURE__ */ e("small", { className: "nim-brand__tagline", children: c }) : null
    ] })
  ] }), u = v("nim-brand", n);
  return l ? /* @__PURE__ */ e("a", { className: u, "data-size": s, href: l, ...o, children: d }) : /* @__PURE__ */ e("span", { className: u, "data-size": s, ...o, children: d });
}
const Fa = {
  gitea: "#609926",
  github: "currentColor",
  gitlab: "#e24329",
  grafana: "#f46800",
  jaeger: "#60d0e4",
  loki: "#f9c916",
  mongodb: "#4faa41",
  postgresql: "#31648c",
  prometheus: "#e6522c",
  redis: "#d82c20",
  valkey: "#ff4438"
}, Ra = {
  gitea: /* @__PURE__ */ r(Y, { children: [
    /* @__PURE__ */ e("path", { d: "M7 4h7a6 6 0 0 1 0 12h-2" }),
    /* @__PURE__ */ e("circle", { cx: "7", cy: "8", r: "3" }),
    /* @__PURE__ */ e("path", { d: "M12 16v4" })
  ] }),
  github: /* @__PURE__ */ e("path", { d: "M12 2.6a9.4 9.4 0 0 0-3 18.3c.5.1.6-.2.6-.5v-1.7c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.8.8.1-.6.3-1.1.6-1.3-2.1-.2-4.3-1-4.3-4.6 0-1 .4-1.9 1-2.5-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.6.6.6 1 1.5 1 2.5 0 3.6-2.2 4.4-4.3 4.6.3.3.6.9.6 1.8v2.7c0 .3.2.6.7.5A9.4 9.4 0 0 0 12 2.6Z" }),
  gitlab: /* @__PURE__ */ e("path", { d: "m12 21-3.5-10.8H3.3L12 21l8.7-10.8h-5.2L12 21ZM8.5 10.2 6.6 4l-3.3 6.2h5.2Zm7 0L17.4 4l3.3 6.2h-5.2Z" }),
  grafana: /* @__PURE__ */ r(Y, { children: [
    /* @__PURE__ */ e("circle", { cx: "12", cy: "13", r: "5" }),
    /* @__PURE__ */ e("path", { d: "M12 4v4M6 6l2 3M18 6l-2 3" })
  ] }),
  jaeger: /* @__PURE__ */ r(Y, { children: [
    /* @__PURE__ */ e("circle", { cx: "12", cy: "12", r: "8" }),
    /* @__PURE__ */ e("circle", { cx: "12", cy: "12", r: "3" })
  ] }),
  loki: /* @__PURE__ */ r(Y, { children: [
    /* @__PURE__ */ e("path", { d: "M12 3 5 9v9h14V9l-7-6Z" }),
    /* @__PURE__ */ e("path", { d: "M9 18v-5h6v5" })
  ] }),
  mongodb: /* @__PURE__ */ e("path", { d: "M12 2.5c2.6 3.2 5 6 5 10 0 3.4-2.2 6.2-4.3 7.1L12 22l-.7-2.4C9.2 18.7 7 15.9 7 12.5c0-4 2.4-6.8 5-10Z" }),
  postgresql: /* @__PURE__ */ r(Y, { children: [
    /* @__PURE__ */ e("ellipse", { cx: "12", cy: "7", rx: "7", ry: "3.2" }),
    /* @__PURE__ */ e("path", { d: "M5 7v9c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2V7" }),
    /* @__PURE__ */ e("path", { d: "M5 12c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2" })
  ] }),
  prometheus: /* @__PURE__ */ r(Y, { children: [
    /* @__PURE__ */ e("path", { d: "M12 2c2.6 2.8 3.6 5 2.6 7.4C13.8 11.2 12 11.8 12 14" }),
    /* @__PURE__ */ e("circle", { cx: "12", cy: "14", r: "7" }),
    /* @__PURE__ */ e("path", { d: "M8 12h8" })
  ] }),
  redis: /* @__PURE__ */ r(Y, { children: [
    /* @__PURE__ */ e("path", { d: "m12 3 9 4-9 4-9-4 9-4Z" }),
    /* @__PURE__ */ e("path", { d: "m3 12 9 4 9-4M3 17l9 4 9-4" })
  ] }),
  valkey: /* @__PURE__ */ r(Y, { children: [
    /* @__PURE__ */ e("path", { d: "m12 3 9 4-9 4-9-4 9-4Z" }),
    /* @__PURE__ */ e("path", { d: "m3 12 9 4 9-4" })
  ] })
}, Oa = /* @__PURE__ */ new Set(["github", "gitlab", "mongodb"]), Ua = { lg: 32, md: 24, sm: 20 };
function zl({ className: n, label: l, name: a, size: i = "md", ...t }) {
  const s = Oa.has(a), c = Ua[i];
  return /* @__PURE__ */ e(
    "svg",
    {
      "aria-hidden": l ? void 0 : !0,
      "aria-label": l,
      className: v("nim-brand-mark", n),
      fill: s ? "currentColor" : "none",
      height: c,
      role: l ? "img" : void 0,
      stroke: s ? "none" : "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 1.6,
      style: { color: Fa[a] },
      viewBox: "0 0 24 24",
      width: c,
      ...t,
      children: Ra[a]
    }
  );
}
function $l(n) {
  const l = n.toLowerCase();
  return {
    forgejo: "gitea",
    gitea: "gitea",
    github: "github",
    gitlab: "gitlab",
    grafana: "grafana",
    jaeger: "jaeger",
    loki: "loki",
    mongo: "mongodb",
    mongodb: "mongodb",
    postgres: "postgresql",
    postgresql: "postgresql",
    prometheus: "prometheus",
    redis: "redis",
    valkey: "valkey"
  }[l];
}
const le = Ge(function({
  children: l,
  className: a,
  fullWidth: i = !1,
  iconEnd: t,
  iconStart: s,
  size: c = "md",
  variant: o = "primary",
  ...d
}, u) {
  const m = v(
    "nim-button",
    `nim-button--${o}`,
    `nim-button--${c}`,
    i && "nim-button--full",
    a
  ), h = /* @__PURE__ */ r(Y, { children: [
    s ? /* @__PURE__ */ e(D, { name: s, size: "sm" }) : null,
    /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
    t ? /* @__PURE__ */ e(D, { name: t, size: "sm" }) : null
  ] });
  if ("href" in d && d.href !== void 0) {
    const { href: p, rel: y, target: k, ...S } = d;
    return /* @__PURE__ */ e(
      "a",
      {
        className: m,
        href: p,
        ref: u,
        rel: k === "_blank" ? y ?? "noreferrer" : y,
        target: k,
        ...S,
        children: h
      }
    );
  }
  const {
    disabled: f = !1,
    loading: _ = !1,
    type: N = "button",
    ...b
  } = d;
  return /* @__PURE__ */ r(
    "button",
    {
      "aria-busy": _ || void 0,
      className: v(m, _ && "nim-button--loading"),
      disabled: f || _,
      ref: u,
      type: N,
      ...b,
      children: [
        _ ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-button__spinner" }) : null,
        _ ? /* @__PURE__ */ r(Y, { children: [
          /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
          t ? /* @__PURE__ */ e(D, { name: t, size: "sm" }) : null
        ] }) : h
      ]
    }
  );
});
function Ha({
  actions: n,
  className: l,
  description: a,
  icon: i = "search",
  reason: t = "empty",
  title: s,
  ...c
}) {
  return /* @__PURE__ */ r("div", { className: v("nim-empty", l), "data-reason": t === "empty" ? void 0 : t, ...c, children: [
    /* @__PURE__ */ e("span", { className: "nim-empty__icon", children: /* @__PURE__ */ e(D, { name: i, size: "md" }) }),
    /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: s }),
    a ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-empty__body", children: a }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-empty__actions", children: n }) : null
  ] });
}
const Ka = (n, l) => {
  if (l <= 7) return Array.from({ length: l }, (t, s) => s + 1);
  const a = /* @__PURE__ */ new Set([1, l, n, n - 1, n + 1]);
  n <= 3 && [2, 3, 4].forEach((t) => a.add(t)), n >= l - 2 && [l - 3, l - 2, l - 1].forEach((t) => a.add(t));
  const i = [...a].filter((t) => t >= 1 && t <= l).sort((t, s) => t - s);
  return i.flatMap((t, s) => s > 0 && t - i[s - 1] > 1 ? ["gap", t] : [t]);
};
function Wa({
  className: n,
  label: l = "Pagination",
  nextLabel: a = "Next page",
  onChange: i,
  page: t,
  pageCount: s,
  previousLabel: c = "Previous page",
  summary: o
}) {
  return /* @__PURE__ */ r("nav", { "aria-label": l, className: v("nim-pagination", n), children: [
    o ? /* @__PURE__ */ e("p", { className: "nim-pagination__summary", children: o }) : /* @__PURE__ */ e("span", {}),
    /* @__PURE__ */ r("div", { className: "nim-pagination__list", children: [
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": c,
          className: "nim-pagination__item",
          disabled: t <= 1,
          onClick: () => i(t - 1),
          type: "button",
          children: /* @__PURE__ */ e(D, { name: "chevron-back", size: "sm" })
        }
      ),
      Ka(t, s).map(
        (d, u) => d === "gap" ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-pagination__ellipsis", children: "…" }, `gap-${u}`) : /* @__PURE__ */ e(
          "button",
          {
            "aria-current": d === t ? "page" : void 0,
            className: "nim-pagination__item",
            onClick: () => i(d),
            type: "button",
            children: d
          },
          d
        )
      ),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": a,
          className: "nim-pagination__item",
          disabled: t >= s,
          onClick: () => i(t + 1),
          type: "button",
          children: /* @__PURE__ */ e(D, { name: "chevron-forward", size: "sm" })
        }
      )
    ] })
  ] });
}
function $e({ caption: n, className: l, columns: a, onSort: i, rowKey: t, rows: s, sort: c }) {
  return /* @__PURE__ */ e("div", { className: v("nim-table-wrap", l), children: /* @__PURE__ */ r("table", { className: "nim-table", children: [
    n ? /* @__PURE__ */ e("caption", { className: "nim-caption", children: n }) : null,
    /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ e("tr", { children: a.map((o) => {
      const d = (c == null ? void 0 : c.key) === o.key ? c.direction : void 0;
      return /* @__PURE__ */ e(
        "th",
        {
          "aria-sort": d,
          className: v(o.numeric && "nim-table__cell--numeric"),
          scope: "col",
          style: o.width ? { inlineSize: o.width } : void 0,
          children: o.sortable && i ? /* @__PURE__ */ r("button", { className: "nim-table__sort", onClick: () => i(o.key), type: "button", children: [
            o.header,
            d ? /* @__PURE__ */ e(D, { name: d === "ascending" ? "chevron-up" : "chevron-down", size: "xs" }) : null
          ] }) : o.header
        },
        o.key
      );
    }) }) }),
    /* @__PURE__ */ e("tbody", { children: s.map((o) => /* @__PURE__ */ e("tr", { children: a.map((d) => /* @__PURE__ */ e("td", { className: v(d.numeric && "nim-table__cell--numeric"), children: d.render(o) }, d.key)) }, t(o))) })
  ] }) });
}
function Le({ children: n, className: l, description: a, ...i }) {
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--checkbox", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", type: "checkbox", ...i }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-checkbox__box", children: /* @__PURE__ */ e(D, { name: "check", size: "xs" }) }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      a ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: a }) : null
    ] })
  ] });
}
function Ga({ children: n, className: l, description: a, ...i }) {
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--switch", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", role: "switch", type: "checkbox", ...i }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-switch__track", children: /* @__PURE__ */ e("span", { className: "nim-switch__thumb" }) }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      a ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: a }) : null
    ] })
  ] });
}
function Ll({ children: n, className: l, description: a, ...i }) {
  const t = De(je);
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--radio", l), children: [
    /* @__PURE__ */ e(
      "input",
      {
        ...i,
        checked: t ? t.value === i.value : i.checked,
        className: "nim-choice__input",
        name: (t == null ? void 0 : t.name) ?? i.name,
        onChange: (s) => {
          var c;
          t == null || t.onChange(s.target.value), (c = i.onChange) == null || c.call(i, s);
        },
        type: "radio"
      }
    ),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-radio__mark" }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      a ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: a }) : null
    ] })
  ] });
}
const je = Se(null);
function Il({
  children: n,
  className: l,
  error: a,
  hint: i,
  label: t,
  layout: s = "stack",
  name: c,
  onChange: o,
  value: d
}) {
  const u = ne(), m = c ?? `nim-radio-${u}`, h = i ? `${m}-hint` : void 0, f = a ? `${m}-error` : void 0;
  return /* @__PURE__ */ e(je.Provider, { value: { name: m, onChange: o, value: d }, children: /* @__PURE__ */ r(
    "fieldset",
    {
      "aria-describedby": [f, h].filter(Boolean).join(" ") || void 0,
      "aria-invalid": a ? !0 : void 0,
      className: v("nim-radio-group", a && "nim-radio-group--invalid", l),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-radio-group__legend", children: t }),
        /* @__PURE__ */ e("div", { className: v("nim-radio-group__options", `nim-radio-group__options--${s}`), children: n }),
        a ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: f, children: a }) : null,
        i && !a ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: h, children: i }) : null
      ]
    }
  ) });
}
function Ye({ className: n, label: l = "Loading", size: a = "md", ...i }) {
  return /* @__PURE__ */ e(
    "span",
    {
      className: v("nim-spinner", a !== "md" && `nim-spinner--${a}`, n),
      role: "status",
      ...i,
      children: /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: l })
    }
  );
}
function Za({ className: n, label: l, value: a, ...i }) {
  const t = a === void 0, s = t ? 0 : Math.min(100, Math.max(0, a));
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": l,
      "aria-valuemax": 100,
      "aria-valuemin": 0,
      "aria-valuenow": t ? void 0 : s,
      className: v("nim-progress", t && "nim-progress--indeterminate", n),
      role: "progressbar",
      ...i,
      children: /* @__PURE__ */ e("div", { className: "nim-progress__fill", style: t ? void 0 : { inlineSize: `${s}%` } })
    }
  );
}
function ja({ className: n, height: l = "1em", radius: a, width: i = "100%", ...t }) {
  return /* @__PURE__ */ e(
    "span",
    {
      "aria-hidden": "true",
      className: v("nim-skeleton", n),
      style: { blockSize: l, borderRadius: a, inlineSize: i },
      ...t
    }
  );
}
const Ya = (n) => Array.from({ length: n }, (l, a) => ({ __skeleton: a })), Va = {
  selectAll: "Select all rows",
  selectRow: "Select row"
};
function Bl({
  caption: n,
  className: l,
  columns: a,
  empty: i,
  error: t,
  labels: s,
  loading: c = !1,
  onPageChange: o,
  onRetry: d,
  onSort: u,
  page: m,
  pageCount: h,
  refreshing: f = !1,
  retryLabel: _ = "Try again",
  rowKey: N,
  rows: b,
  selection: p,
  skeletonRows: y = 6,
  sort: k,
  summary: S,
  toolbar: z
}) {
  const g = { ...Va, ...s }, C = b.length > 0 && p ? b.every((M) => p.isSelected(M)) : !1, x = p ? [
    {
      header: p.onToggleAll ? /* @__PURE__ */ e(
        Le,
        {
          "aria-label": g.selectAll,
          checked: C,
          onChange: (M) => {
            var F;
            return (F = p.onToggleAll) == null ? void 0 : F.call(p, M.currentTarget.checked);
          }
        }
      ) : /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: g.selectAll }),
      key: "__select",
      render: (M) => {
        var F;
        return /* @__PURE__ */ e(
          Le,
          {
            "aria-label": ((F = p.label) == null ? void 0 : F.call(p, M)) ?? g.selectRow,
            checked: p.isSelected(M),
            onChange: ($) => p.onToggle(M, $.currentTarget.checked)
          }
        );
      },
      width: "2.5rem"
    },
    ...a
  ] : a;
  let I;
  return t ? I = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: /* @__PURE__ */ e(
    Ha,
    {
      actions: d ? /* @__PURE__ */ e(le, { onClick: d, size: "sm", variant: "secondary", children: _ }) : void 0,
      icon: "danger",
      title: t
    }
  ) }) : c ? I = /* @__PURE__ */ e(
    $e,
    {
      caption: n,
      columns: x.map((M) => ({
        ...M,
        render: () => /* @__PURE__ */ e(ja, { height: "0.9em", width: M.numeric ? "3rem" : "70%" }),
        sortable: !1
      })),
      rowKey: (M) => `skeleton-${M.__skeleton}`,
      rows: Ya(y)
    }
  ) : b.length === 0 ? I = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: i }) : I = /* @__PURE__ */ e(
    $e,
    {
      caption: n,
      columns: x,
      onSort: u,
      rowKey: N,
      rows: b,
      sort: k
    }
  ), /* @__PURE__ */ r("div", { className: v("nim-data-table", l), "data-refreshing": f ? "true" : void 0, children: [
    z,
    /* @__PURE__ */ r("div", { className: "nim-data-table__body", children: [
      I,
      f ? /* @__PURE__ */ e("span", { className: "nim-data-table__pulse", children: /* @__PURE__ */ e(D, { name: "loading", size: "xs" }) }) : null
    ] }),
    m && h && h > 1 && o ? /* @__PURE__ */ e(Wa, { onChange: o, page: m, pageCount: h, summary: S }) : S ? /* @__PURE__ */ e("p", { className: "nim-data-table__summary", children: S }) : null
  ] });
}
function Pl({
  className: n,
  defaultOpen: l = [],
  items: a,
  mode: i = "multiple",
  onOpenChange: t,
  open: s,
  variant: c = "panel"
}) {
  const o = ne(), [d, u] = A(l), m = s ?? d, h = (f) => {
    const _ = m.includes(f), N = i === "single" ? _ ? [] : [f] : _ ? m.filter((b) => b !== f) : [...m, f];
    s || u(N), t == null || t(N);
  };
  return /* @__PURE__ */ e("div", { className: v("nim-accordion", `nim-accordion--${c}`, n), children: a.map((f) => {
    const _ = m.includes(f.id), N = `${o}-${f.id}`;
    return /* @__PURE__ */ r("div", { className: "nim-accordion__item", "data-open": _ || void 0, children: [
      /* @__PURE__ */ r(
        "button",
        {
          "aria-controls": N,
          "aria-expanded": _,
          className: "nim-accordion__trigger",
          disabled: f.disabled,
          id: `${N}-trigger`,
          onClick: () => h(f.id),
          type: "button",
          children: [
            /* @__PURE__ */ e("span", { className: "nim-accordion__title", children: f.title }),
            f.meta ? /* @__PURE__ */ e("span", { className: "nim-accordion__meta", children: f.meta }) : null,
            /* @__PURE__ */ e(D, { className: "nim-accordion__chevron", name: "chevron-down", size: "sm" })
          ]
        }
      ),
      /* @__PURE__ */ e(
        "div",
        {
          "aria-labelledby": `${N}-trigger`,
          className: "nim-accordion__panel",
          id: N,
          role: "region",
          children: /* @__PURE__ */ e(
            "div",
            {
              className: "nim-accordion__panel-inner",
              inert: !_,
              children: f.content
            }
          )
        }
      )
    ] }, f.id);
  }) });
}
function qa({ className: n, items: l, label: a, renderItem: i, value: t }) {
  return /* @__PURE__ */ e("nav", { "aria-label": a, className: v("nim-tab-bar", n), children: /* @__PURE__ */ e("div", { className: "nim-tab-bar__row", style: { "--nim-tab-count": l.length }, children: l.map((s) => {
    const c = s.key === t, o = /* @__PURE__ */ r(Y, { children: [
      /* @__PURE__ */ e(D, { name: s.icon, size: s.center ? "lg" : "md" }),
      /* @__PURE__ */ e("span", { className: "nim-tab-bar__label", children: s.label })
    ] }), d = {
      "aria-current": c ? "page" : void 0,
      "aria-label": s.fullLabel ?? s.label,
      className: v("nim-tab-bar__item", s.center && "nim-tab-bar__item--center"),
      "data-active": c ? "true" : void 0
    };
    return i ? /* @__PURE__ */ e("div", { className: "nim-tab-bar__slot", children: i(s, o, d) }, s.key) : s.href ? /* @__PURE__ */ e("a", { href: s.href, ...d, children: o }, s.key) : /* @__PURE__ */ e("button", { onClick: s.onSelect, type: "button", ...d, children: o }, s.key);
  }) }) });
}
function Fl({ children: n, className: l, frame: a = "responsive", header: i, tabs: t }) {
  return /* @__PURE__ */ r("div", { className: v("nim-app-shell", l), "data-frame": a === "phone" ? "phone" : void 0, children: [
    i ? /* @__PURE__ */ e("header", { className: "nim-app-shell__header", children: i }) : null,
    /* @__PURE__ */ e("main", { className: "nim-app-shell__content", "data-has-tabs": t ? "true" : void 0, children: n }),
    t ? /* @__PURE__ */ e(qa, { ...t }) : null
  ] });
}
function ye({
  action: n,
  back: l,
  brand: a,
  children: i,
  className: t,
  footer: s,
  subtitle: c,
  title: o
}) {
  return /* @__PURE__ */ r("section", { className: v("nim-auth", t), children: [
    a ? /* @__PURE__ */ e("div", { className: "nim-auth__brand", children: a }) : null,
    /* @__PURE__ */ r("div", { className: "nim-auth__body", children: [
      l ? /* @__PURE__ */ e(le, { className: "nim-auth__back", iconStart: "chevron-back", onClick: l.onClick, size: "sm", variant: "ghost", children: l.label }) : null,
      /* @__PURE__ */ e("h1", { className: "nim-auth__title", children: o }),
      c ? /* @__PURE__ */ e("p", { className: "nim-auth__subtitle", children: c }) : null,
      /* @__PURE__ */ e("div", { className: "nim-auth__fields", children: i })
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-auth__foot", children: [
      n ? /* @__PURE__ */ e(
        le,
        {
          disabled: n.disabled,
          fullWidth: !0,
          loading: n.loading,
          onClick: n.onClick,
          size: "lg",
          variant: "accent",
          children: n.label
        }
      ) : null,
      s ? /* @__PURE__ */ e("div", { className: "nim-auth__footer", children: s }) : null
    ] })
  ] });
}
const Qa = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((l) => {
  var a;
  return ((a = l[0]) == null ? void 0 : a.toUpperCase()) ?? "";
}).join("");
function _e({ className: n, name: l, shape: a = "round", size: i = "md", src: t, ...s }) {
  return /* @__PURE__ */ r(
    "span",
    {
      className: v("nim-avatar", i !== "md" && `nim-avatar--${i}`, a === "square" && "nim-avatar--square", n),
      ...s,
      children: [
        t ? /* @__PURE__ */ e("img", { alt: "", src: t }) : /* @__PURE__ */ e("span", { "aria-hidden": "true", children: Qa(l) }),
        /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: l })
      ]
    }
  );
}
function Rl({
  caption: n,
  className: l,
  initials: a,
  label: i,
  size: t = 96,
  src: s,
  value: c
}) {
  const o = Math.max(4, Math.round(t * 0.05)), d = (t - o) / 2, u = 2 * Math.PI * d, m = Math.min(100, Math.max(0, c)) / 100 * u;
  return /* @__PURE__ */ r(
    "div",
    {
      "aria-label": i,
      className: v("nim-avatar-ring", l),
      role: "img",
      style: { "--nim-ring-size": `${t}px`, "--nim-ring-stroke": `${o}px` },
      children: [
        /* @__PURE__ */ r("svg", { "aria-hidden": "true", className: "nim-avatar-ring__arc", viewBox: `0 0 ${t} ${t}`, children: [
          /* @__PURE__ */ e(
            "circle",
            {
              className: "nim-avatar-ring__track",
              cx: t / 2,
              cy: t / 2,
              fill: "none",
              r: d,
              strokeWidth: o
            }
          ),
          /* @__PURE__ */ e(
            "circle",
            {
              className: "nim-avatar-ring__fill",
              cx: t / 2,
              cy: t / 2,
              fill: "none",
              r: d,
              strokeDasharray: `${m} ${u}`,
              strokeLinecap: "round",
              strokeWidth: o
            }
          )
        ] }),
        /* @__PURE__ */ r("span", { className: "nim-avatar-ring__face", children: [
          s ? /* @__PURE__ */ e("img", { alt: "", className: "nim-avatar-ring__image", src: s }) : /* @__PURE__ */ e("span", { className: "nim-avatar-ring__initials", children: a }),
          n && !s ? /* @__PURE__ */ e("span", { className: "nim-avatar-ring__caption", children: n }) : null
        ] })
      ]
    }
  );
}
function Xa({
  actions: n,
  avatar: l,
  chips: a,
  className: i,
  eyebrow: t,
  name: s,
  stats: c = []
}) {
  return /* @__PURE__ */ r("section", { className: v("nim-profile-header", i), children: [
    /* @__PURE__ */ r("div", { className: "nim-profile-header__identity", children: [
      l,
      /* @__PURE__ */ r("div", { className: "nim-profile-header__who", children: [
        t ? /* @__PURE__ */ e("p", { className: "nim-profile-header__eyebrow", children: t }) : null,
        /* @__PURE__ */ e("h1", { className: "nim-profile-header__name", children: s }),
        a ? /* @__PURE__ */ e("div", { className: "nim-profile-header__chips", children: a }) : null
      ] })
    ] }),
    c.length ? /* @__PURE__ */ e("dl", { className: "nim-profile-header__stats", children: c.map((o, d) => /* @__PURE__ */ r("div", { className: "nim-profile-header__stat", children: [
      /* @__PURE__ */ e("dt", { className: "nim-profile-header__stat-label", children: o.label }),
      /* @__PURE__ */ e("dd", { className: "nim-profile-header__stat-value", children: o.value })
    ] }, d)) }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-profile-header__actions", children: n }) : null
  ] });
}
function Ja({
  children: n,
  className: l,
  dot: a = !1,
  pill: i = !1,
  size: t = "md",
  tone: s = "soft",
  variant: c = "neutral",
  ...o
}) {
  return /* @__PURE__ */ r(
    "span",
    {
      className: v(
        "nim-badge",
        `nim-badge--${c}`,
        `nim-badge--${s}`,
        t === "sm" && "nim-badge--sm",
        i && "nim-badge--pill",
        l
      ),
      ...o,
      children: [
        a ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-badge__dot" }) : null,
        n
      ]
    }
  );
}
const ei = {
  accent: "sparkle",
  danger: "danger",
  info: "info",
  neutral: "info",
  success: "check-circle",
  warning: "alert"
};
function ni({
  action: n,
  children: l,
  className: a,
  icon: i,
  title: t,
  tone: s = "neutral",
  ...c
}) {
  return /* @__PURE__ */ r(
    "div",
    {
      className: v("nim-banner", `nim-banner--${s}`, a),
      role: s === "danger" ? "alert" : "status",
      ...c,
      children: [
        /* @__PURE__ */ e(D, { className: "nim-banner__icon", name: i ?? ei[s], size: "sm" }),
        /* @__PURE__ */ r("div", { className: "nim-banner__content", children: [
          t ? /* @__PURE__ */ e("p", { className: "nim-banner__title", children: t }) : null,
          /* @__PURE__ */ e("div", { children: l })
        ] }),
        n ? /* @__PURE__ */ e("div", { className: "nim-banner__action", children: n }) : null
      ]
    }
  );
}
function Ol({ className: n, items: l, label: a = "Breadcrumb" }) {
  return /* @__PURE__ */ e("nav", { "aria-label": a, className: v("nim-breadcrumb", n), children: l.map((i, t) => {
    const s = t === l.length - 1;
    return /* @__PURE__ */ r(Me, { children: [
      t > 0 ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-breadcrumb__separator", children: /* @__PURE__ */ e(D, { name: "chevron-forward", size: "xs" }) }) : null,
      s || !i.href ? /* @__PURE__ */ e("span", { "aria-current": s ? "page" : void 0, className: "nim-breadcrumb__current", children: i.label }) : /* @__PURE__ */ e("a", { className: "nim-breadcrumb__link", href: i.href, children: i.label })
    ] }, i.label);
  }) });
}
function Ul({
  as: n = "article",
  children: l,
  className: a,
  footer: i,
  header: t,
  interactive: s = !1,
  padding: c = "md",
  variant: o = "default",
  ...d
}) {
  return /* @__PURE__ */ r(
    n,
    {
      className: v(
        "nim-card",
        `nim-card--${o}`,
        `nim-card--pad-${c}`,
        s && "nim-card--interactive",
        a
      ),
      ...d,
      children: [
        t ? /* @__PURE__ */ e("div", { className: "nim-card__header", children: t }) : null,
        l,
        i ? /* @__PURE__ */ e("div", { className: "nim-card__footer", children: i }) : null
      ]
    }
  );
}
function Hl({
  badge: n,
  className: l,
  description: a,
  detail: i,
  disabled: t = !1,
  icon: s,
  name: c,
  onSelect: o,
  selected: d,
  title: u
}) {
  return /* @__PURE__ */ r("label", { className: v("nim-option-card", d && "nim-option-card--selected", l), children: [
    /* @__PURE__ */ e(
      "input",
      {
        checked: d,
        className: "nim-option-card__input",
        disabled: t,
        name: c,
        onChange: o,
        type: "radio"
      }
    ),
    s ? /* @__PURE__ */ e("span", { className: "nim-option-card__icon", children: /* @__PURE__ */ e(D, { name: s, size: "md" }) }) : null,
    /* @__PURE__ */ r("span", { className: "nim-option-card__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-option-card__title", children: u }),
      a ? /* @__PURE__ */ e("span", { className: "nim-option-card__description", children: a }) : null,
      d && i ? /* @__PURE__ */ e("span", { className: "nim-option-card__detail", children: i }) : null
    ] }),
    n ? /* @__PURE__ */ e("span", { className: "nim-option-card__badge", children: n }) : null,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-option-card__dot" })
  ] });
}
function Kl({ className: n, items: l, title: a, totals: i = [] }) {
  return /* @__PURE__ */ r("section", { className: v("nim-summary", n), children: [
    a ? /* @__PURE__ */ e("h2", { className: "nim-summary__title", children: a }) : null,
    /* @__PURE__ */ e("dl", { className: "nim-summary__lines", children: l.map((t) => /* @__PURE__ */ r("div", { className: "nim-summary__line", children: [
      /* @__PURE__ */ r("dt", { children: [
        /* @__PURE__ */ e("span", { className: "nim-summary__label", children: t.label }),
        t.meta ? /* @__PURE__ */ e("span", { className: "nim-summary__meta", children: t.meta }) : null
      ] }),
      /* @__PURE__ */ e("dd", { className: "nim-summary__value", children: t.value })
    ] }, t.key)) }),
    i.length ? /* @__PURE__ */ r(Y, { children: [
      /* @__PURE__ */ e("hr", { className: "nim-summary__rule" }),
      /* @__PURE__ */ e("dl", { className: "nim-summary__lines nim-summary__lines--totals", children: i.map((t) => /* @__PURE__ */ r(
        "div",
        {
          className: "nim-summary__line",
          "data-emphasis": t.emphasis ? "true" : void 0,
          children: [
            /* @__PURE__ */ e("dt", { children: /* @__PURE__ */ e("span", { className: "nim-summary__label", children: t.label }) }),
            /* @__PURE__ */ e("dd", { className: "nim-summary__value", children: t.value })
          ]
        },
        t.key
      )) })
    ] }) : null
  ] });
}
function Wl({ action: n, className: l, note: a, total: i }) {
  return /* @__PURE__ */ r("div", { className: v("nim-action-bar", l), children: [
    /* @__PURE__ */ r("div", { className: "nim-action-bar__row", children: [
      i ? /* @__PURE__ */ r("div", { className: "nim-action-bar__total", children: [
        /* @__PURE__ */ e("span", { className: "nim-action-bar__total-label", children: i.label }),
        /* @__PURE__ */ e("strong", { className: "nim-action-bar__total-value", children: i.value })
      ] }) : null,
      /* @__PURE__ */ e("div", { className: "nim-action-bar__action", children: n })
    ] }),
    a ? /* @__PURE__ */ e("p", { className: "nim-action-bar__note", children: a }) : null
  ] });
}
function Ve(n, l, { onDismiss: a, open: i }) {
  const [t, s] = A({ left: 0, top: 0 }), c = K(null), o = q(() => {
    const d = n.current, u = l.current;
    if (!d || !u) return;
    const m = d.getBoundingClientRect(), { height: h, width: f } = u.getBoundingClientRect(), _ = 4, N = 8, b = getComputedStyle(d).direction === "rtl", p = m.bottom + _, k = p + h > window.innerHeight && m.top - _ - h > 0 ? m.top - _ - h : p, S = b ? m.right - f : m.left, z = Math.min(Math.max(S, N), window.innerWidth - f - N);
    s({ left: z, top: k });
  }, [l, n]);
  return cn(() => {
    i && o();
  }, [i, o]), X(() => {
    if (!i) return;
    c.current = document.activeElement;
    const d = (m) => {
      m.key === "Escape" && (m.stopPropagation(), a());
    }, u = (m) => {
      var f, _;
      const h = m.target;
      (f = l.current) != null && f.contains(h) || (_ = n.current) != null && _.contains(h) || a();
    };
    return window.addEventListener("keydown", d), window.addEventListener("pointerdown", u), window.addEventListener("resize", o), window.addEventListener("scroll", o, !0), () => {
      var m, h;
      window.removeEventListener("keydown", d), window.removeEventListener("pointerdown", u), window.removeEventListener("resize", o), window.removeEventListener("scroll", o, !0), (h = (m = c.current) == null ? void 0 : m.focus) == null || h.call(m);
    };
  }, [a, i, l, o, n]), t;
}
const ai = (n) => n.kind === void 0 || n.kind === "action";
function Ie({ children: n, className: l, items: a, label: i }) {
  const [t, s] = A(!1), [c, o] = A(0), d = K(null), u = K(null), m = Ve(d, u, { onDismiss: () => s(!1), open: t }), f = a.filter(ai).filter((p) => !p.disabled), _ = () => {
    o(0), s((p) => !p);
  }, N = (p) => {
    s(!1), p.onSelect();
  }, b = (p) => {
    if (f.length !== 0) {
      if (p.key === "ArrowDown" || p.key === "ArrowUp") {
        p.preventDefault();
        const y = p.key === "ArrowDown" ? 1 : -1;
        o((k) => (k + y + f.length) % f.length);
      }
      if (p.key === "Home" && (p.preventDefault(), o(0)), p.key === "End" && (p.preventDefault(), o(f.length - 1)), p.key === "Enter" || p.key === " ") {
        p.preventDefault();
        const y = f[c];
        y && N(y);
      }
    }
  };
  return /* @__PURE__ */ r(Y, { children: [
    n({ open: t, ref: d, toggle: _ }),
    t && typeof document < "u" ? Ne(
      /* @__PURE__ */ e(
        "div",
        {
          "aria-label": i,
          className: v("nim-menu", l),
          onKeyDown: b,
          ref: u,
          role: "menu",
          style: { insetBlockStart: m.top, insetInlineStart: m.left },
          tabIndex: -1,
          children: a.map((p, y) => p.kind === "separator" ? /* @__PURE__ */ e("hr", { className: "nim-menu__separator" }, `sep-${y}`) : p.kind === "heading" ? /* @__PURE__ */ e("p", { className: "nim-menu__label", children: p.label }, `head-${y}`) : /* @__PURE__ */ r(
            "button",
            {
              className: v("nim-menu__item", p.danger && "nim-menu__item--danger"),
              "data-active": f.indexOf(p) === c ? "true" : void 0,
              disabled: p.disabled,
              onClick: () => N(p),
              onPointerEnter: () => o(f.indexOf(p)),
              role: "menuitem",
              type: "button",
              children: [
                p.icon ? /* @__PURE__ */ e(D, { className: "nim-menu__icon", name: p.icon, size: "sm" }) : null,
                /* @__PURE__ */ e("span", { children: p.label }),
                p.shortcut ? /* @__PURE__ */ e("span", { className: "nim-menu__shortcut", children: p.shortcut }) : null
              ]
            },
            p.label
          ))
        }
      ),
      document.body
    ) : null
  ] });
}
function ii({ children: n, className: l, label: a, onClose: i, open: t, triggerRef: s }) {
  const c = K(null), o = Ve(s, c, { onDismiss: i, open: t });
  return !t || typeof document > "u" ? null : Ne(
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": a,
        className: v("nim-popover", l),
        ref: c,
        role: "dialog",
        style: { insetBlockStart: o.top, insetInlineStart: o.left },
        children: n
      }
    ),
    document.body
  );
}
const li = {
  deleted: "Message deleted",
  download: "Download",
  edited: "edited",
  failed: "Not delivered",
  more: "Message actions",
  pause: "Pause",
  play: "Play",
  react: "Add a reaction",
  read: "Read",
  reply: "Reply",
  sending: "Sending",
  sent: "Sent",
  today: "Today",
  typing: "is typing",
  voiceMessage: "Voice message",
  yesterday: "Yesterday"
}, ti = ["👍", "❤️", "😂", "😮", "😢", "🙏"], Be = 1024, si = 864e5;
function ri(n, l) {
  const a = ["B", "KB", "MB", "GB"];
  let i = n, t = 0;
  for (; i >= Be && t < a.length - 1; )
    i /= Be, t += 1;
  return `${new Intl.NumberFormat(l, { maximumFractionDigits: t === 0 ? 0 : 1 }).format(i)} ${a[t]}`;
}
function qe(n, l) {
  const a = new Intl.NumberFormat(l, { minimumIntegerDigits: 2, useGrouping: !1 }), i = Math.max(0, Math.round(n));
  return `${new Intl.NumberFormat(l).format(Math.floor(i / 60))}:${a.format(i % 60)}`;
}
const ue = (n) => {
  const l = new Date(n);
  return new Date(l.getFullYear(), l.getMonth(), l.getDate()).getTime();
};
function ci({
  attachment: n,
  labels: l,
  locale: a
}) {
  const i = K(null), [t, s] = A(!1), [c, o] = A(0), d = n.duration ?? 0, u = J(
    () => n.waveform ?? Array.from({ length: 32 }, (h, f) => 0.35 + f * 7 % 11 / 18),
    [n.waveform]
  ), m = d > 0 ? Math.min(1, c / d) : 0;
  return /* @__PURE__ */ r("div", { className: "nim-chat-voice", children: [
    /* @__PURE__ */ e(
      G,
      {
        label: t ? l.pause : l.play,
        name: t ? "pause" : "play",
        onClick: () => {
          const h = i.current;
          h && (h.paused ? h.play() : h.pause());
        },
        size: "sm",
        variant: "solid"
      }
    ),
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": l.voiceMessage,
        className: "nim-chat-voice__wave",
        "aria-hidden": "true",
        children: u.map((h, f) => /* @__PURE__ */ e(
          "span",
          {
            className: "nim-chat-voice__bar",
            "data-played": f / u.length <= m ? "true" : void 0,
            style: { blockSize: `${Math.round(h * 100)}%` }
          },
          f
        ))
      }
    ),
    /* @__PURE__ */ e("span", { className: "nim-chat-voice__time", children: qe(t || c ? Math.max(0, d - c) : d, a) }),
    /* @__PURE__ */ e(
      "audio",
      {
        onEnded: () => {
          s(!1), o(0);
        },
        onPause: () => s(!1),
        onPlay: () => s(!0),
        onTimeUpdate: (h) => o(h.currentTarget.currentTime),
        preload: "metadata",
        ref: i,
        src: n.url
      }
    )
  ] });
}
function oi({
  attachment: n,
  labels: l,
  locale: a
}) {
  return n.kind === "voice" ? /* @__PURE__ */ e(ci, { attachment: n, labels: l, locale: a }) : n.kind === "video" ? /* @__PURE__ */ r("figure", { className: "nim-chat-media", children: [
    /* @__PURE__ */ e("video", { controls: !0, playsInline: !0, poster: n.poster, preload: "metadata", src: n.url }),
    n.duration ? /* @__PURE__ */ e("figcaption", { className: "nim-chat-media__meta", children: qe(n.duration, a) }) : null
  ] }) : n.kind === "image" ? /* @__PURE__ */ e("figure", { className: "nim-chat-media", children: /* @__PURE__ */ e("img", { alt: n.name ?? "", loading: "lazy", src: n.url }) }) : /* @__PURE__ */ r(
    "a",
    {
      className: "nim-chat-file",
      download: n.name,
      href: n.url,
      rel: "noreferrer",
      target: "_blank",
      children: [
        /* @__PURE__ */ e("span", { className: "nim-chat-file__icon", children: /* @__PURE__ */ e(D, { name: "document", size: "md" }) }),
        /* @__PURE__ */ r("span", { className: "nim-chat-file__text", children: [
          /* @__PURE__ */ e("span", { className: "nim-chat-file__name", children: n.name ?? l.download }),
          n.size !== void 0 ? /* @__PURE__ */ e("span", { className: "nim-chat-file__size", children: ri(n.size, a) }) : null
        ] }),
        /* @__PURE__ */ e(D, { className: "nim-chat-file__action", name: "download", size: "sm" })
      ]
    }
  );
}
function di({
  labels: n,
  message: l,
  onReact: a
}) {
  var i;
  return /* @__PURE__ */ e("ul", { className: "nim-chat-reactions", children: (i = l.reactions) == null ? void 0 : i.map((t) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r(
    "button",
    {
      "aria-pressed": t.mine ? "true" : "false",
      className: "nim-chat-reaction",
      disabled: !a,
      onClick: () => a == null ? void 0 : a(l, t.emoji),
      type: "button",
      children: [
        /* @__PURE__ */ e("span", { "aria-hidden": "true", children: t.emoji }),
        /* @__PURE__ */ e("span", { className: "nim-chat-reaction__count", children: t.count }),
        /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: n.react })
      ]
    }
  ) }, t.emoji)) });
}
function Gl({
  actions: n,
  className: l,
  composer: a,
  footer: i,
  group: t = !1,
  header: s,
  labels: c,
  locale: o,
  messages: d,
  onJump: u,
  onReact: m,
  reactions: h = ti,
  runGap: f = 300,
  typing: _
}) {
  const N = { ...li, ...c }, b = K(null), p = K(!0), y = J(
    () => new Intl.DateTimeFormat(o, { hour: "2-digit", minute: "2-digit" }),
    [o]
  ), k = J(
    () => new Intl.DateTimeFormat(o, { day: "numeric", month: "long", weekday: "long" }),
    [o]
  ), S = J(() => {
    const z = ue((/* @__PURE__ */ new Date()).toISOString());
    return d.map((g, C) => {
      const x = d[C - 1], I = d[C + 1], M = g.at ? ue(g.at) : null, F = x != null && x.at ? ue(x.at) : null, $ = M !== null && M !== F ? M === z ? N.today : M === z - si ? N.yesterday : k.format(new Date(g.at)) : null, L = (P, w) => {
        var O, W;
        return !!P && !(P != null && P.system) && !w.system && !!(P != null && P.own) == !!w.own && ((O = P == null ? void 0 : P.author) == null ? void 0 : O.name) === ((W = w.author) == null ? void 0 : W.name);
      }, B = (P, w) => !(P != null && P.at) || !w.at || Math.abs(new Date(w.at).getTime() - new Date(P.at).getTime()) <= f * 1e3, Q = $ !== null || !L(x, g) || !B(x, g), j = !I || (I.at ? ue(I.at) : null) !== M || !L(I, g) || !B(g, I);
      return { divider: $, first: Q, last: j, message: g };
    });
  }, [k, d, f, N.today, N.yesterday]);
  return X(() => {
    const z = b.current;
    !z || !p.current || (z.scrollTop = z.scrollHeight);
  }, [d, _]), /* @__PURE__ */ r("section", { className: v("nim-chat", l), children: [
    s ? /* @__PURE__ */ e("header", { className: "nim-chat__header", children: s }) : null,
    /* @__PURE__ */ r(
      "div",
      {
        className: "nim-chat__scroll",
        onScroll: (z) => {
          const g = z.currentTarget;
          p.current = g.scrollHeight - g.scrollTop - g.clientHeight < 48;
        },
        ref: b,
        children: [
          /* @__PURE__ */ e("ol", { "aria-live": "polite", className: "nim-chat__list", children: S.map(({ divider: z, first: g, last: C, message: x }) => {
            var F, $;
            if (x.system)
              return /* @__PURE__ */ r(Me, { children: [
                z ? /* @__PURE__ */ e("li", { className: "nim-chat__day", children: z }) : null,
                /* @__PURE__ */ e("li", { className: "nim-chat__system", children: x.text })
              ] }, x.id);
            const I = (n == null ? void 0 : n(x)) ?? [], M = g && !x.own && (t || !!x.author);
            return /* @__PURE__ */ r(Me, { children: [
              z ? /* @__PURE__ */ e("li", { className: "nim-chat__day", children: z }) : null,
              /* @__PURE__ */ r(
                "li",
                {
                  className: v("nim-chat-message", x.own && "nim-chat-message--own"),
                  "data-first": g ? "true" : void 0,
                  "data-last": C ? "true" : void 0,
                  id: `nim-message-${x.id}`,
                  children: [
                    x.own ? null : /* @__PURE__ */ e("span", { className: "nim-chat-message__gutter", children: C && x.author ? /* @__PURE__ */ e(_e, { name: x.author.name, size: "sm", src: x.author.avatar }) : null }),
                    /* @__PURE__ */ r("div", { className: "nim-chat-message__stack", children: [
                      M && x.author ? /* @__PURE__ */ e("span", { className: "nim-chat-message__author", children: x.author.name }) : null,
                      /* @__PURE__ */ r("div", { className: "nim-chat-message__row", children: [
                        /* @__PURE__ */ r("div", { className: "nim-chat-message__bubble", "data-deleted": x.deleted ? "true" : void 0, children: [
                          x.replyTo ? /* @__PURE__ */ r(
                            "button",
                            {
                              className: "nim-chat-quote",
                              disabled: !u,
                              onClick: () => u == null ? void 0 : u(x.replyTo.id),
                              type: "button",
                              children: [
                                /* @__PURE__ */ e("span", { className: "nim-chat-quote__author", children: x.replyTo.author }),
                                /* @__PURE__ */ e("span", { className: "nim-chat-quote__text", children: x.replyTo.text })
                              ]
                            }
                          ) : null,
                          x.deleted ? /* @__PURE__ */ r("p", { className: "nim-chat-message__text nim-chat-message__text--gone", children: [
                            /* @__PURE__ */ e(D, { name: "trash", size: "xs" }),
                            " ",
                            N.deleted
                          ] }) : /* @__PURE__ */ r(Y, { children: [
                            (F = x.attachments) == null ? void 0 : F.map((L, B) => /* @__PURE__ */ e(
                              oi,
                              {
                                attachment: L,
                                labels: N,
                                locale: o
                              },
                              `${x.id}-${B}`
                            )),
                            x.card ? /* @__PURE__ */ e("div", { className: "nim-chat-card", children: x.card }) : null,
                            x.text ? /* @__PURE__ */ e("p", { className: "nim-chat-message__text", children: x.text }) : null
                          ] })
                        ] }),
                        !x.deleted && (I.length > 0 || m) ? /* @__PURE__ */ r("div", { className: "nim-chat-message__tools", children: [
                          m ? /* @__PURE__ */ e(
                            Ie,
                            {
                              className: "nim-chat-picker",
                              items: h.map((L) => ({
                                label: L,
                                onSelect: () => m(x, L)
                              })),
                              label: N.react,
                              children: ({ ref: L, toggle: B }) => /* @__PURE__ */ e(
                                G,
                                {
                                  label: N.react,
                                  name: "emoji",
                                  onClick: B,
                                  ref: L,
                                  size: "sm"
                                }
                              )
                            }
                          ) : null,
                          I.length > 0 ? /* @__PURE__ */ e(Ie, { items: I, label: N.more, children: ({ ref: L, toggle: B }) => /* @__PURE__ */ e(
                            G,
                            {
                              label: N.more,
                              name: "more",
                              onClick: B,
                              ref: L,
                              size: "sm"
                            }
                          ) }) : null
                        ] }) : null
                      ] }),
                      ($ = x.reactions) != null && $.length ? /* @__PURE__ */ e(di, { labels: N, message: x, onReact: m }) : null,
                      C ? /* @__PURE__ */ r("span", { className: "nim-chat-message__meta", children: [
                        x.at ? /* @__PURE__ */ e("time", { dateTime: x.at, children: y.format(new Date(x.at)) }) : null,
                        x.edited ? /* @__PURE__ */ e("span", { children: N.edited }) : null,
                        x.own && x.status ? /* @__PURE__ */ e("span", { className: "nim-chat-message__status", "data-status": x.status, children: x.status === "sending" ? /* @__PURE__ */ e(Ye, { size: "sm" }) : /* @__PURE__ */ e(
                          D,
                          {
                            label: N[x.status],
                            name: x.status === "failed" ? "danger" : "check-circle",
                            size: "xs"
                          }
                        ) }) : null
                      ] }) : null
                    ] })
                  ]
                }
              )
            ] }, x.id);
          }) }),
          _ ? /* @__PURE__ */ r("p", { className: "nim-chat__typing", children: [
            typeof _ == "string" ? `${_} ${N.typing}` : N.typing,
            /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "nim-chat__dots", children: [
              /* @__PURE__ */ e("i", {}),
              /* @__PURE__ */ e("i", {}),
              /* @__PURE__ */ e("i", {})
            ] })
          ] }) : null,
          i ? /* @__PURE__ */ e("div", { className: "nim-chat__footer", children: i }) : null
        ]
      }
    ),
    a ? /* @__PURE__ */ e("div", { className: "nim-chat__composer", children: a }) : null
  ] });
}
const mi = {
  assistant: "Assistant",
  copy: "Copy",
  down: "Bad answer",
  retry: "Try again",
  sources: "Sources",
  steps: "Steps",
  stop: "Stop",
  up: "Good answer",
  you: "You"
};
function Zl({
  assistant: n,
  className: l,
  composer: a,
  empty: i,
  labels: t,
  onCopy: s,
  onRate: c,
  onRetry: o,
  onStop: d,
  turns: u
}) {
  const m = { ...mi, ...t }, h = K(null), f = K(!0), [_, N] = A(null), b = u.some((p) => p.streaming);
  return X(() => {
    const p = h.current;
    !p || !f.current || (p.scrollTop = p.scrollHeight);
  }, [u]), /* @__PURE__ */ r("section", { className: v("nim-assistant", l), children: [
    /* @__PURE__ */ r(
      "div",
      {
        className: "nim-assistant__scroll",
        onScroll: (p) => {
          const y = p.currentTarget;
          f.current = y.scrollHeight - y.scrollTop - y.clientHeight < 48;
        },
        ref: h,
        children: [
          u.length === 0 && i ? /* @__PURE__ */ e("div", { className: "nim-assistant__empty", children: i }) : null,
          /* @__PURE__ */ e("ol", { "aria-live": "polite", className: "nim-assistant__list", children: u.map((p) => {
            var y, k;
            return /* @__PURE__ */ r("li", { className: "nim-turn", "data-role": p.role, children: [
              /* @__PURE__ */ e("span", { className: "nim-turn__mark", children: p.role === "assistant" ? /* @__PURE__ */ e("span", { className: "nim-turn__badge", children: /* @__PURE__ */ e(D, { name: (n == null ? void 0 : n.icon) ?? "sparkle", size: "sm" }) }) : null }),
              /* @__PURE__ */ r("div", { className: "nim-turn__body", children: [
                /* @__PURE__ */ e("span", { className: "nim-turn__who", children: p.role === "assistant" ? (n == null ? void 0 : n.name) ?? m.assistant : m.you }),
                (y = p.steps) != null && y.length ? /* @__PURE__ */ r("div", { className: "nim-turn__steps", children: [
                  /* @__PURE__ */ r(
                    "button",
                    {
                      "aria-expanded": _ === p.id,
                      className: "nim-turn__steps-toggle",
                      onClick: () => N(_ === p.id ? null : p.id),
                      type: "button",
                      children: [
                        /* @__PURE__ */ e(D, { name: _ === p.id ? "chevron-down" : "chevron-forward", size: "xs" }),
                        m.steps,
                        /* @__PURE__ */ e("span", { className: "nim-turn__steps-count", children: p.steps.length })
                      ]
                    }
                  ),
                  /* @__PURE__ */ e(
                    "ul",
                    {
                      className: "nim-turn__step-list",
                      hidden: _ !== p.id,
                      inert: _ !== p.id,
                      children: p.steps.map((S) => /* @__PURE__ */ r("li", { className: "nim-turn__step", "data-status": S.status, children: [
                        /* @__PURE__ */ e(
                          D,
                          {
                            name: S.status === "failed" ? "danger" : S.status === "running" ? "loading" : S.icon ?? "check",
                            size: "xs"
                          }
                        ),
                        /* @__PURE__ */ e("span", { children: S.label }),
                        S.detail ? /* @__PURE__ */ e("span", { className: "nim-turn__step-detail", children: S.detail }) : null
                      ] }, S.label))
                    }
                  )
                ] }) : null,
                /* @__PURE__ */ e("div", { className: "nim-turn__content", "data-streaming": p.streaming ? "true" : void 0, children: p.content }),
                (k = p.sources) != null && k.length ? /* @__PURE__ */ r("ul", { className: "nim-turn__sources", children: [
                  /* @__PURE__ */ e("li", { className: "nim-turn__sources-label", children: m.sources }),
                  p.sources.map((S, z) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r("a", { className: "nim-turn__source", href: S.href, rel: "noreferrer", target: "_blank", children: [
                    /* @__PURE__ */ e("span", { className: "nim-turn__source-index", children: z + 1 }),
                    S.title
                  ] }) }, z))
                ] }) : null,
                p.role === "assistant" && !p.streaming && (s || o || c) ? /* @__PURE__ */ r("div", { className: "nim-turn__actions", children: [
                  s ? /* @__PURE__ */ e(G, { label: m.copy, name: "copy", onClick: () => s(p), size: "sm" }) : null,
                  o ? /* @__PURE__ */ e(G, { label: m.retry, name: "refresh", onClick: () => o(p), size: "sm" }) : null,
                  c ? /* @__PURE__ */ r(Y, { children: [
                    /* @__PURE__ */ e(G, { label: m.up, name: "trend-up", onClick: () => c(p, "up"), size: "sm" }),
                    /* @__PURE__ */ e(G, { label: m.down, name: "trend-down", onClick: () => c(p, "down"), size: "sm" })
                  ] }) : null
                ] }) : null
              ] })
            ] }, p.id);
          }) }),
          b && d ? /* @__PURE__ */ e("div", { className: "nim-assistant__stop", children: /* @__PURE__ */ r("button", { className: "nim-assistant__stop-button", onClick: d, type: "button", children: [
            /* @__PURE__ */ e(D, { name: "stop", size: "sm" }),
            m.stop
          ] }) }) : null
        ]
      }
    ),
    a ? /* @__PURE__ */ e("div", { className: "nim-assistant__composer", children: a }) : null
  ] });
}
const ke = 600, Pe = 8, ui = (n, l) => {
  const a = n / Math.max(1, l), i = 10 ** Math.floor(Math.log10(a || 1)), t = a / i;
  return (t > 5 ? 10 : t > 2 ? 5 : t > 1 ? 2 : 1) * i;
};
function jl({
  categories: n,
  className: l,
  dataTableLabel: a,
  hideDataTableLabel: i = "Hide data table",
  noSampleLabel: t = "No sample",
  description: s,
  footer: c,
  format: o,
  formatCategory: d,
  height: u = 220,
  kind: m = "line",
  legend: h,
  locale: f,
  max: _,
  maxXLabels: N,
  min: b,
  note: p,
  series: y,
  title: k,
  value: S
}) {
  const z = ne(), [g, C] = A(null), [x, I] = A(0), [M, F] = A(!1), $ = ne(), L = J(
    () => o ?? ((E) => new Intl.NumberFormat(f).format(E)),
    [o, f]
  ), B = J(() => {
    const E = y.flatMap((te) => te.values).filter((te) => te !== null && Number.isFinite(te)), U = b ?? Math.min(...E, 0), H = _ ?? Math.max(...E, 0), V = m === "bar" ? Math.min(0, U) : U, Z = H === V ? V + 1 : H, ee = ui(Z - V, 4), ae = Math.floor(V / ee) * ee, ie = Math.ceil(Z / ee) * ee, Ae = [];
    for (let te = ae; te <= ie + ee / 2; te += ee) Ae.push(Number(te.toFixed(6)));
    return { bottom: ae, ticks: Ae, top: ie };
  }, [m, _, b, y]), Q = u - Pe * 2, j = (E) => Pe + Q - (E - B.bottom) / (B.top - B.bottom) * Q, P = ke / Math.max(1, n.length), w = (E) => P * E + P / 2, O = (E, U) => {
    let H = "", V = null, Z = 0;
    const ee = () => {
      U && V !== null && (H += `L${w(Z).toFixed(2)} ${j(B.bottom).toFixed(2)}L${w(V).toFixed(2)} ${j(B.bottom).toFixed(2)}Z`), V = null;
    };
    return E.forEach((ae, ie) => {
      if (ae === null || !Number.isFinite(ae)) {
        ee();
        return;
      }
      H += `${V === null ? "M" : "L"}${w(ie).toFixed(2)} ${j(ae).toFixed(2)}`, V ?? (V = ie), Z = ie;
    }), ee(), H;
  }, W = Math.min(n.length, Math.max(2, Math.floor(N ?? n.length))), T = Array.from({ length: W }, (E, U) => Math.round(U * (n.length - 1) / Math.max(1, W - 1))), R = P * 0.62 / y.length;
  return /* @__PURE__ */ r(
    "figure",
    {
      "aria-labelledby": k ? z : void 0,
      className: v("nim-chart", l),
      "data-kind": m,
      children: [
        k || p || s || S ? /* @__PURE__ */ r("figcaption", { className: "nim-chart__head", children: [
          k ? /* @__PURE__ */ e("span", { className: "nim-chart__title", id: z, children: k }) : null,
          p ? /* @__PURE__ */ e("span", { className: "nim-chart__note", children: p }) : null,
          s ? /* @__PURE__ */ e("span", { className: "nim-chart__description", children: s }) : null,
          S ? /* @__PURE__ */ e("span", { className: "nim-chart__value", children: /* @__PURE__ */ e("bdi", { children: S }) }) : null
        ] }) : null,
        /* @__PURE__ */ r("div", { className: "nim-chart__frame", children: [
          /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-chart__axis", style: { blockSize: `${u}px` }, children: [...B.ticks].reverse().map((E) => /* @__PURE__ */ e("span", { className: "nim-chart__tick", children: /* @__PURE__ */ e("bdi", { children: L(E) }) }, E)) }),
          /* @__PURE__ */ r("div", { className: "nim-chart__plot", children: [
            /* @__PURE__ */ r(
              "svg",
              {
                "aria-hidden": "true",
                className: "nim-chart__svg",
                preserveAspectRatio: "none",
                style: { blockSize: `${u}px` },
                viewBox: `0 0 ${ke} ${u}`,
                children: [
                  B.ticks.map((E) => /* @__PURE__ */ e(
                    "line",
                    {
                      className: "nim-chart__rule",
                      x1: 0,
                      x2: ke,
                      y1: j(E),
                      y2: j(E)
                    },
                    E
                  )),
                  y.map((E, U) => {
                    const H = `var(--nim-series-${E.series ?? U % 6 + 1})`;
                    return m === "bar" ? /* @__PURE__ */ e("g", { children: E.values.map(
                      (V, Z) => V === null || !Number.isFinite(V) ? null : /* @__PURE__ */ e(
                        "rect",
                        {
                          className: "nim-chart__bar",
                          fill: H,
                          height: Math.abs(j(V) - j(Math.max(B.bottom, 0))),
                          width: R,
                          x: w(Z) - R * y.length / 2 + R * U,
                          y: Math.min(j(V), j(Math.max(B.bottom, 0)))
                        },
                        Z
                      )
                    ) }, E.label) : /* @__PURE__ */ r("g", { children: [
                      m === "area" ? /* @__PURE__ */ e("path", { className: "nim-chart__area", d: O(E.values, !0), fill: H }) : null,
                      /* @__PURE__ */ e("path", { className: "nim-chart__line", d: O(E.values, !1), stroke: H }),
                      E.values.map(
                        (V, Z) => V === null || !Number.isFinite(V) ? null : /* @__PURE__ */ e(
                          "circle",
                          {
                            className: "nim-chart__dot",
                            cx: w(Z),
                            cy: j(V),
                            "data-on": g === Z ? "true" : void 0,
                            fill: H,
                            r: 4
                          },
                          Z
                        )
                      )
                    ] }, E.label);
                  })
                ]
              }
            ),
            /* @__PURE__ */ r("div", { className: "nim-chart__hits", children: [
              n.map((E, U) => /* @__PURE__ */ e(
                "button",
                {
                  className: "nim-chart__hit",
                  "data-on": g === U ? "true" : void 0,
                  tabIndex: U === Math.min(x, n.length - 1) ? 0 : -1,
                  onBlur: () => C(null),
                  onFocus: () => {
                    C(U), I(U);
                  },
                  onKeyDown: (H) => {
                    var ae, ie;
                    const V = getComputedStyle(H.currentTarget).direction === "rtl", Z = H.key === "ArrowRight" ? V ? -1 : 1 : H.key === "ArrowLeft" ? V ? 1 : -1 : 0;
                    if (!Z && H.key !== "Home" && H.key !== "End") return;
                    H.preventDefault();
                    const ee = H.key === "Home" ? 0 : H.key === "End" ? n.length - 1 : Math.max(0, Math.min(n.length - 1, U + Z));
                    (ie = (ae = H.currentTarget.parentElement) == null ? void 0 : ae.querySelectorAll(".nim-chart__hit")[ee]) == null || ie.focus();
                  },
                  onMouseEnter: () => C(U),
                  onMouseLeave: () => C(null),
                  type: "button",
                  children: /* @__PURE__ */ r("span", { className: "nim-visually-hidden", children: [
                    E,
                    y.map((H) => `, ${H.label}: ${H.values[U] == null || !Number.isFinite(H.values[U]) ? t : L(H.values[U])}`).join("")
                  ] })
                },
                U
              )),
              g !== null ? /* @__PURE__ */ r(
                "div",
                {
                  className: "nim-chart__tip",
                  style: { insetInlineStart: `${(g + 0.5) / n.length * 100}%` },
                  children: [
                    /* @__PURE__ */ e("span", { className: "nim-chart__tip-label", children: n[g] }),
                    y.map((E, U) => /* @__PURE__ */ r("span", { className: "nim-chart__tip-row", children: [
                      /* @__PURE__ */ e("i", { style: { background: `var(--nim-series-${E.series ?? U % 6 + 1})` } }),
                      /* @__PURE__ */ e("span", { className: "nim-chart__tip-name", children: E.label }),
                      /* @__PURE__ */ e("span", { className: "nim-chart__tip-value", children: /* @__PURE__ */ e("bdi", { children: E.values[g] == null || !Number.isFinite(E.values[g]) ? "—" : L(E.values[g]) }) })
                    ] }, E.label))
                  ]
                }
              ) : null
            ] }),
            /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-chart__categories", "data-sparse": N ? "true" : void 0, children: T.map((E) => /* @__PURE__ */ e("span", { className: "nim-chart__category", style: N ? { insetInlineStart: `${(E + 0.5) / Math.max(1, n.length) * 100}%` } : void 0, children: d ? d(n[E], E) : n[E] }, E)) })
          ] })
        ] }),
        h ?? y.length > 1 ? /* @__PURE__ */ e("ul", { "aria-hidden": "true", className: "nim-chart__legend", children: y.map((E, U) => /* @__PURE__ */ r("li", { className: "nim-chart__key", children: [
          /* @__PURE__ */ e("i", { style: { background: `var(--nim-series-${E.series ?? U % 6 + 1})` } }),
          E.label
        ] }, E.label)) }) : null,
        c ? /* @__PURE__ */ e("div", { className: "nim-chart__note", children: c }) : null,
        a ? /* @__PURE__ */ e("button", { type: "button", className: "nim-chart__data-toggle", "aria-controls": $, "aria-expanded": M, onClick: () => F(!M), children: M ? i : a }) : null,
        /* @__PURE__ */ e("div", { className: M ? "nim-chart__data" : "nim-visually-hidden", id: $, children: /* @__PURE__ */ r("table", { children: [
          k ? /* @__PURE__ */ e("caption", { children: k }) : null,
          /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ r("tr", { children: [
            /* @__PURE__ */ e("th", { scope: "col" }),
            y.map((E) => /* @__PURE__ */ e("th", { scope: "col", children: E.label }, E.label))
          ] }) }),
          /* @__PURE__ */ e("tbody", { children: n.map((E, U) => /* @__PURE__ */ r("tr", { children: [
            /* @__PURE__ */ e("th", { scope: "row", children: E }),
            y.map((H) => /* @__PURE__ */ e("td", { children: /* @__PURE__ */ e("bdi", { children: H.values[U] == null || !Number.isFinite(H.values[U]) ? "—" : L(H.values[U]) }) }, H.label))
          ] }, U)) })
        ] }) })
      ]
    }
  );
}
function Yl({ className: n, label: l, series: a = 1, values: i }) {
  const t = Math.min(...i), c = Math.max(...i) - t || 1, o = i.map((d, u) => {
    const m = u / Math.max(1, i.length - 1) * 100, h = 24 - (d - t) / c * 20 - 2;
    return `${u === 0 ? "M" : "L"}${m.toFixed(2)} ${h.toFixed(2)}`;
  }).join("");
  return /* @__PURE__ */ r(
    "svg",
    {
      className: v("nim-sparkline", n),
      preserveAspectRatio: "none",
      role: "img",
      viewBox: "0 0 100 24",
      children: [
        /* @__PURE__ */ e("title", { children: l }),
        /* @__PURE__ */ e("path", { d: o, stroke: `var(--nim-series-${a})` })
      ]
    }
  );
}
const Qe = {
  back: "Back to conversations",
  channels: "Conversations",
  compose: "New conversation",
  members: "members",
  muted: "Muted",
  search: "Search conversations",
  unread: "unread"
}, hi = {
  channel: "hash",
  direct: "user",
  group: "users"
};
function _i(n, l) {
  const a = new Date(n), i = /* @__PURE__ */ new Date(), t = new Date(i.getFullYear(), i.getMonth(), i.getDate()).getTime();
  return a.getTime() >= t ? new Intl.DateTimeFormat(l, { hour: "2-digit", minute: "2-digit" }).format(a) : a.getTime() >= t - 6 * 864e5 ? new Intl.DateTimeFormat(l, { weekday: "short" }).format(a) : new Intl.DateTimeFormat(l, { day: "numeric", month: "short" }).format(a);
}
function pi({
  activeId: n,
  className: l,
  labels: a,
  locale: i,
  onSelect: t,
  sections: s
}) {
  const c = { ...Qe, ...a }, o = new Intl.NumberFormat(i);
  return /* @__PURE__ */ e("div", { className: v("nim-rooms", l), children: s.map((d) => /* @__PURE__ */ r("section", { className: "nim-rooms__section", children: [
    /* @__PURE__ */ e("p", { className: "nim-rooms__label", children: d.label }),
    /* @__PURE__ */ e("ul", { className: "nim-rooms__list", children: d.items.map((u) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r(
      "button",
      {
        "aria-current": u.id === n ? "true" : void 0,
        className: "nim-room",
        "data-unread": u.unread ? "true" : void 0,
        onClick: () => t == null ? void 0 : t(u),
        type: "button",
        children: [
          /* @__PURE__ */ e("span", { className: "nim-room__face", children: u.kind === "channel" ? /* @__PURE__ */ e("span", { className: "nim-room__glyph", children: /* @__PURE__ */ e(D, { name: "hash", size: "sm" }) }) : /* @__PURE__ */ e(_e, { name: u.name, size: "sm", src: u.avatar }) }),
          /* @__PURE__ */ r("span", { className: "nim-room__body", children: [
            /* @__PURE__ */ r("span", { className: "nim-room__top", children: [
              /* @__PURE__ */ r("span", { className: "nim-room__name", children: [
                u.name,
                u.muted ? /* @__PURE__ */ e(D, { className: "nim-room__mute", label: c.muted, name: "volume-off", size: "xs" }) : null
              ] }),
              u.at ? /* @__PURE__ */ e("span", { className: "nim-room__at", children: _i(u.at, i) }) : null
            ] }),
            /* @__PURE__ */ r("span", { className: "nim-room__bottom", children: [
              /* @__PURE__ */ e("span", { className: "nim-room__preview", "data-typing": u.typing ? "true" : void 0, children: u.typing ?? u.preview }),
              u.unread ? /* @__PURE__ */ r(Ja, { size: "sm", tone: "solid", variant: u.muted ? "neutral" : "accent", children: [
                o.format(u.unread),
                /* @__PURE__ */ r("span", { className: "nim-visually-hidden", children: [
                  " ",
                  c.unread
                ] })
              ] }) : u.members ? /* @__PURE__ */ r("span", { className: "nim-room__members", children: [
                /* @__PURE__ */ e(D, { name: hi[u.kind], size: "xs" }),
                o.format(u.members)
              ] }) : null
            ] })
          ] })
        ]
      }
    ) }, u.id)) })
  ] }, d.key)) });
}
function Vl({
  activeId: n,
  brand: l,
  children: a,
  className: i,
  labels: t,
  locale: s,
  onBack: c,
  onCompose: o,
  onSelect: d,
  search: u,
  sections: m
}) {
  const h = { ...Qe, ...t };
  return /* @__PURE__ */ r("div", { className: v("nim-messenger", i), "data-open": n ? "true" : void 0, children: [
    /* @__PURE__ */ r("aside", { "aria-label": h.channels, className: "nim-messenger__rail", children: [
      /* @__PURE__ */ r("div", { className: "nim-messenger__rail-head", children: [
        l,
        o ? /* @__PURE__ */ e(G, { label: h.compose, name: "plus", onClick: o, size: "sm", variant: "outline" }) : null
      ] }),
      u ? /* @__PURE__ */ e("div", { className: "nim-messenger__search", children: u }) : null,
      /* @__PURE__ */ e("div", { className: "nim-messenger__rail-scroll", children: /* @__PURE__ */ e(
        pi,
        {
          activeId: n,
          labels: t,
          locale: s,
          onSelect: d,
          sections: m
        }
      ) })
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-messenger__thread", children: [
      c ? /* @__PURE__ */ e(
        G,
        {
          className: "nim-messenger__back",
          label: h.back,
          name: "chevron-back",
          onClick: c,
          size: "sm"
        }
      ) : null,
      a
    ] })
  ] });
}
function ql({ actions: n, avatar: l, className: a, kind: i = "direct", members: t, meta: s, name: c }) {
  return /* @__PURE__ */ r("div", { className: v("nim-room-head", a), children: [
    i === "channel" ? /* @__PURE__ */ e("span", { className: "nim-room__glyph", children: /* @__PURE__ */ e(D, { name: "hash", size: "sm" }) }) : /* @__PURE__ */ e(_e, { name: c, size: "md", src: l }),
    /* @__PURE__ */ r("div", { className: "nim-room-head__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-room-head__name", children: c }),
      s ? /* @__PURE__ */ e("span", { className: "nim-room-head__meta", children: s }) : null
    ] }),
    t != null && t.length ? /* @__PURE__ */ e("ul", { className: "nim-facepile", children: t.slice(0, 6).map((o) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ e(_e, { name: o.name, size: "sm", src: o.avatar }) }, o.name)) }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-room-head__actions", children: n }) : null
  ] });
}
const fi = {
  map: "Map",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out"
}, we = (n) => {
  const a = Math.max(-85.05112878, Math.min(85.05112878, n)) * Math.PI / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + a / 2)) / (2 * Math.PI);
}, Ni = (n, l) => {
  const a = l.west, i = l.east < l.west ? l.east + 360 : l.east, t = n.lng < a ? n.lng + 360 : n.lng, s = we(l.north), c = we(l.south);
  return {
    x: (t - a) / (i - a) * 100,
    y: (we(n.lat) - s) / (c - s) * 100
  };
};
function Ql({
  attribution: n,
  bounds: l,
  className: a,
  controls: i,
  labels: t,
  markers: s = [],
  onSelect: c,
  onZoom: o,
  ratio: d = 16 / 10,
  tiles: u,
  title: m
}) {
  const h = { ...fi, ...t }, f = ne();
  return /* @__PURE__ */ r(
    "section",
    {
      "aria-labelledby": f,
      className: v("nim-map", a),
      style: { aspectRatio: `${d}` },
      children: [
        /* @__PURE__ */ e("h3", { className: "nim-visually-hidden", id: f, children: m }),
        /* @__PURE__ */ e("div", { className: "nim-map__tiles", children: u }),
        /* @__PURE__ */ e("ul", { className: "nim-map__markers", children: s.map((_) => {
          const N = Ni(_, l), b = { insetBlockStart: `${N.y}%`, insetInlineStart: `${N.x}%` };
          return /* @__PURE__ */ e("li", { className: "nim-map__marker", "data-self": _.self ? "true" : void 0, style: b, children: c ? /* @__PURE__ */ r("button", { className: "nim-map__pin", "data-tone": _.tone, onClick: () => c(_), type: "button", children: [
            _.self ? /* @__PURE__ */ e("span", { className: "nim-map__dot" }) : /* @__PURE__ */ e(D, { name: "globe", size: "sm" }),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: _.label })
          ] }) : /* @__PURE__ */ r("span", { className: "nim-map__pin", "data-tone": _.tone, children: [
            _.self ? /* @__PURE__ */ e("span", { className: "nim-map__dot" }) : /* @__PURE__ */ e(D, { name: "globe", size: "sm" }),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: _.label })
          ] }) }, _.id);
        }) }),
        o || i ? /* @__PURE__ */ r("div", { className: "nim-map__controls", children: [
          i,
          o ? /* @__PURE__ */ r(Y, { children: [
            /* @__PURE__ */ e(G, { label: h.zoomIn, name: "plus", onClick: () => o(1), size: "sm", variant: "solid" }),
            /* @__PURE__ */ e(G, { label: h.zoomOut, name: "minus", onClick: () => o(-1), size: "sm", variant: "solid" })
          ] }) : null
        ] }) : null,
        n ? /* @__PURE__ */ e("p", { className: "nim-map__attribution", children: n }) : null
      ]
    }
  );
}
const vi = {
  fullscreen: "Full screen",
  mute: "Mute",
  pause: "Pause",
  play: "Play",
  rate: "Playback speed",
  seek: "Seek",
  unmute: "Unmute",
  volume: "Volume"
};
function he(n, l) {
  const a = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0, i = new Intl.NumberFormat(l, { minimumIntegerDigits: 2, useGrouping: !1 }), t = new Intl.NumberFormat(l), s = Math.floor(a / 3600), c = Math.floor(a % 3600 / 60), o = a % 60;
  return s > 0 ? `${t.format(s)}:${i.format(c)}:${i.format(o)}` : `${t.format(c)}:${i.format(o)}`;
}
function Xl({
  autoPlay: n = !1,
  className: l,
  kind: a = "audio",
  labels: i,
  locale: t,
  onError: s,
  poster: c,
  rates: o = [1, 1.5, 2],
  src: d,
  title: u,
  waveform: m
}) {
  const h = { ...vi, ...i }, f = K(null), _ = K(null), [N, b] = A(!1), [p, y] = A(0), [k, S] = A(0), [z, g] = A(0), [C, x] = A(n), [I, M] = A(1), [F, $] = A(1), L = k > 0 ? p / k : 0, B = J(() => m ?? null, [m]), Q = q(() => {
    const w = f.current;
    w && (w.paused ? w.play() : w.pause());
  }, []);
  X(() => {
    const w = f.current;
    w && (w.playbackRate = F);
  }, [F]);
  const j = (w) => {
    const O = w.buffered;
    g(O.length ? O.end(O.length - 1) : 0);
  }, P = {
    onDurationChange: (w) => S(Number.isFinite(w.currentTarget.duration) ? w.currentTarget.duration : 0),
    onEnded: () => b(!1),
    onPause: () => b(!1),
    onPlay: () => b(!0),
    onProgress: (w) => j(w.currentTarget),
    onTimeUpdate: (w) => y(w.currentTarget.currentTime),
    onVolumeChange: (w) => {
      x(w.currentTarget.muted), M(w.currentTarget.volume);
    },
    onError: s
  };
  return /* @__PURE__ */ r(
    "div",
    {
      className: v("nim-player", l),
      "data-kind": a,
      "data-playing": N ? "true" : void 0,
      ref: _,
      children: [
        a === "video" ? /* @__PURE__ */ r("div", { className: "nim-player__stage", children: [
          /* @__PURE__ */ e(
            "video",
            {
              autoPlay: n,
              className: "nim-player__video",
              muted: n,
              playsInline: !0,
              poster: c,
              preload: "metadata",
              ref: (w) => {
                f.current = w;
              },
              src: d,
              ...P
            }
          ),
          /* @__PURE__ */ e(
            "button",
            {
              "aria-label": N ? h.pause : h.play,
              className: "nim-player__surface",
              onClick: Q,
              type: "button",
              children: N ? null : /* @__PURE__ */ e("span", { className: "nim-player__badge", children: /* @__PURE__ */ e(D, { name: "play", size: "lg" }) })
            }
          )
        ] }) : /* @__PURE__ */ e(
          "audio",
          {
            autoPlay: n,
            preload: "metadata",
            ref: (w) => {
              f.current = w;
            },
            src: d,
            ...P
          }
        ),
        /* @__PURE__ */ r("div", { className: "nim-player__transport", children: [
          /* @__PURE__ */ e(
            G,
            {
              label: N ? h.pause : h.play,
              name: N ? "pause" : "play",
              onClick: Q,
              size: "md",
              variant: "solid"
            }
          ),
          /* @__PURE__ */ r("div", { className: "nim-player__track", children: [
            u ? /* @__PURE__ */ e("span", { className: "nim-player__title", children: u }) : null,
            /* @__PURE__ */ r("div", { className: "nim-player__rail", "data-wave": B ? "true" : void 0, children: [
              B ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__wave", children: B.map((w, O) => /* @__PURE__ */ e(
                "i",
                {
                  "data-played": O / B.length <= L ? "true" : void 0,
                  style: { blockSize: `${Math.max(8, Math.round(w * 100))}%` }
                },
                O
              )) }) : /* @__PURE__ */ r(Y, { children: [
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__buffer", style: { inlineSize: `${k ? z / k * 100 : 0}%` } }),
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__played", style: { inlineSize: `${L * 100}%` } })
              ] }),
              /* @__PURE__ */ e(
                "input",
                {
                  "aria-label": h.seek,
                  "aria-valuetext": `${he(p, t)} / ${he(k, t)}`,
                  className: "nim-player__seek",
                  max: k || 0,
                  min: 0,
                  onChange: (w) => {
                    const O = Number(w.target.value);
                    y(O), f.current && (f.current.currentTime = O);
                  },
                  step: "any",
                  type: "range",
                  value: p
                }
              )
            ] }),
            /* @__PURE__ */ r("span", { className: "nim-player__times", children: [
              /* @__PURE__ */ e("time", { children: he(p, t) }),
              /* @__PURE__ */ e("time", { children: he(k, t) })
            ] })
          ] }),
          /* @__PURE__ */ r("div", { className: "nim-player__side", children: [
            o.length > 1 ? /* @__PURE__ */ r(
              "button",
              {
                "aria-label": h.rate,
                className: "nim-player__rate",
                onClick: () => $(o[(o.indexOf(F) + 1) % o.length] ?? 1),
                type: "button",
                children: [
                  new Intl.NumberFormat(t).format(F),
                  "×"
                ]
              }
            ) : null,
            /* @__PURE__ */ e(
              G,
              {
                label: C ? h.unmute : h.mute,
                name: C || I === 0 ? "volume-off" : "volume",
                onClick: () => {
                  const w = f.current;
                  w && (w.muted = !w.muted);
                },
                size: "sm"
              }
            ),
            /* @__PURE__ */ e(
              "input",
              {
                "aria-label": h.volume,
                className: "nim-player__volume",
                max: 1,
                min: 0,
                onChange: (w) => {
                  const O = f.current;
                  O && (O.volume = Number(w.target.value), O.muted = Number(w.target.value) === 0);
                },
                step: 0.05,
                type: "range",
                value: C ? 0 : I
              }
            ),
            a === "video" ? /* @__PURE__ */ e(
              G,
              {
                label: h.fullscreen,
                name: "expand",
                onClick: () => {
                  var w, O;
                  document.fullscreenElement ? document.exitFullscreen() : (O = (w = _.current) == null ? void 0 : w.requestFullscreen) == null || O.call(w);
                },
                size: "sm"
              }
            ) : null
          ] })
        ] })
      ]
    }
  );
}
const bi = {
  attach: "Attach a file",
  cancel: "Cancel recording",
  cancelReply: "Cancel reply",
  replyingTo: "Replying to",
  discard: "Remove attachment",
  record: "Record a voice message",
  recording: "Recording",
  send: "Send",
  stop: "Stop and attach",
  video: "Attach a video"
}, gi = () => {
  var n;
  return typeof navigator < "u" && typeof window < "u" && "MediaRecorder" in window && !!((n = navigator.mediaDevices) != null && n.getUserMedia);
}, yi = (n) => n.type.startsWith("video/") ? "video" : n.type.startsWith("image/") ? "image" : "file";
function Jl({
  accept: n,
  allow: l,
  className: a,
  disabled: i = !1,
  labels: t,
  onCancelReply: s,
  onFiles: c,
  onSend: o,
  onTyping: d,
  placeholder: u,
  replyTo: m
}) {
  const h = { ...bi, ...t }, f = { file: !0, video: !0, voice: !0, ...l }, [_, N] = A(""), [b, p] = A([]), [y, k] = A(!1), [S, z] = A(0), [g] = A(gi), C = K([]), x = K(null), I = K(null), M = K(null), F = K(0), $ = K([]), L = K(null), B = q(() => {
    var T;
    (T = M.current) == null || T.stream.getTracks().forEach((R) => R.stop()), M.current = null;
  }, []);
  X(() => B, [B]), X(() => {
    var T;
    m && ((T = L.current) == null || T.focus());
  }, [m]), X(() => {
    if (!y) return;
    const T = window.setInterval(() => z((Date.now() - F.current) / 1e3), 200);
    return () => window.clearInterval(T);
  }, [y]);
  const Q = q(
    (T) => {
      if (!(T != null && T.length)) return;
      const R = Array.from(T);
      C.current = [...C.current, ...R], p((E) => [
        ...E,
        ...R.map((U) => ({
          kind: yi(U),
          name: U.name,
          size: U.size,
          url: URL.createObjectURL(U)
        }))
      ]);
    },
    []
  ), j = q(async () => {
    try {
      const T = await navigator.mediaDevices.getUserMedia({ audio: !0 }), R = new MediaRecorder(T);
      $.current = [], R.ondataavailable = (E) => {
        E.data.size && $.current.push(E.data);
      }, R.onstop = () => {
        const E = new Blob($.current, { type: R.mimeType }), U = new File([E], "voice-message", { type: R.mimeType });
        C.current = [...C.current, U], p((H) => [
          ...H,
          {
            duration: (Date.now() - F.current) / 1e3,
            kind: "voice",
            size: E.size,
            url: URL.createObjectURL(E)
          }
        ]), B();
      }, M.current = R, R.start(), F.current = Date.now(), z(0), k(!0);
    } catch {
      k(!1), B();
    }
  }, [B]), P = q(
    (T) => {
      const R = M.current;
      k(!1), R && (T || (R.onstop = B), R.stop());
    },
    [B]
  ), w = (T) => {
    p((R) => (URL.revokeObjectURL(R[T].url), R.filter((E, U) => U !== T))), C.current = C.current.filter((R, E) => E !== T);
  }, O = () => {
    var T;
    !_.trim() && b.length === 0 || (o({ attachments: b, text: _.trim() }), c == null || c(C.current), C.current = [], p([]), N(""), (T = L.current) == null || T.focus());
  }, W = !_.trim() && b.length === 0;
  return /* @__PURE__ */ r("div", { className: v("nim-composer", a), children: [
    m ? /* @__PURE__ */ r("div", { className: "nim-composer__reply", children: [
      /* @__PURE__ */ e(D, { className: "nim-composer__reply-mark", name: "reply", size: "sm" }),
      /* @__PURE__ */ r("span", { className: "nim-composer__reply-text", children: [
        /* @__PURE__ */ r("span", { className: "nim-composer__reply-author", children: [
          h.replyingTo,
          " ",
          m.author
        ] }),
        /* @__PURE__ */ e("span", { className: "nim-composer__reply-quote", children: m.text })
      ] }),
      /* @__PURE__ */ e(G, { label: h.cancelReply, name: "close", onClick: s, size: "sm" })
    ] }) : null,
    b.length ? /* @__PURE__ */ e("ul", { className: "nim-composer__tray", children: b.map((T, R) => /* @__PURE__ */ r("li", { className: "nim-composer__chip", children: [
      /* @__PURE__ */ e(
        D,
        {
          name: T.kind === "voice" ? "mic" : T.kind === "video" ? "video" : T.kind === "image" ? "camera" : "document",
          size: "xs"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-composer__chip-name", children: T.name ?? h.record }),
      /* @__PURE__ */ e(
        G,
        {
          label: h.discard,
          name: "close",
          onClick: () => w(R),
          size: "sm"
        }
      )
    ] }, T.url)) }) : null,
    /* @__PURE__ */ e("div", { className: "nim-composer__row", children: y ? /* @__PURE__ */ r("div", { className: "nim-composer__recording", role: "status", children: [
      /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-composer__pulse" }),
      /* @__PURE__ */ e("span", { className: "nim-composer__recording-label", children: h.recording }),
      /* @__PURE__ */ r("span", { className: "nim-composer__elapsed", children: [
        S.toFixed(1),
        "s"
      ] }),
      /* @__PURE__ */ e(
        G,
        {
          label: h.cancel,
          name: "close",
          onClick: () => P(!1),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e(
        G,
        {
          label: h.stop,
          name: "stop",
          onClick: () => P(!0),
          size: "sm",
          variant: "solid"
        }
      )
    ] }) : /* @__PURE__ */ r(Y, { children: [
      f.file ? /* @__PURE__ */ e(
        G,
        {
          disabled: i,
          label: h.attach,
          name: "paperclip",
          onClick: () => {
            var T;
            return (T = x.current) == null ? void 0 : T.click();
          },
          size: "sm"
        }
      ) : null,
      f.video ? /* @__PURE__ */ e(
        G,
        {
          disabled: i,
          label: h.video,
          name: "video",
          onClick: () => {
            var T;
            return (T = I.current) == null ? void 0 : T.click();
          },
          size: "sm"
        }
      ) : null,
      /* @__PURE__ */ e(
        "textarea",
        {
          className: "nim-composer__input",
          disabled: i,
          onChange: (T) => {
            N(T.target.value), d == null || d();
          },
          onKeyDown: (T) => {
            T.key === "Enter" && !T.shiftKey && (T.preventDefault(), O());
          },
          placeholder: u,
          ref: L,
          rows: 1,
          value: _
        }
      ),
      f.voice && g && W ? /* @__PURE__ */ e(
        G,
        {
          disabled: i,
          label: h.record,
          name: "mic",
          onClick: () => void j(),
          size: "sm"
        }
      ) : /* @__PURE__ */ e(
        G,
        {
          disabled: i || W,
          label: h.send,
          name: "send",
          onClick: O,
          size: "sm",
          variant: "solid"
        }
      )
    ] }) }),
    /* @__PURE__ */ e(
      "input",
      {
        accept: n,
        className: "nim-visually-hidden",
        multiple: !0,
        onChange: (T) => {
          Q(T.target.files), T.target.value = "";
        },
        ref: x,
        tabIndex: -1,
        type: "file"
      }
    ),
    /* @__PURE__ */ e(
      "input",
      {
        accept: "video/*",
        className: "nim-visually-hidden",
        onChange: (T) => {
          Q(T.target.files), T.target.value = "";
        },
        ref: I,
        tabIndex: -1,
        type: "file"
      }
    )
  ] });
}
function ki({
  children: n,
  className: l,
  disabled: a = !1,
  icon: i,
  onClick: t,
  onRemove: s,
  removeLabel: c = "Remove",
  selected: o = !1,
  tone: d = "neutral"
}) {
  const u = !!t;
  return /* @__PURE__ */ r(
    "span",
    {
      className: v("nim-chip", u && "nim-chip--interactive", l),
      "data-selected": o || void 0,
      "data-tone": d === "neutral" ? void 0 : d,
      children: [
        u ? /* @__PURE__ */ r(
          "button",
          {
            "aria-pressed": o,
            className: "nim-chip__body",
            disabled: a,
            onClick: t,
            type: "button",
            children: [
              i ? /* @__PURE__ */ e(D, { name: i, size: "xs" }) : null,
              n
            ]
          }
        ) : /* @__PURE__ */ r("span", { className: "nim-chip__body", children: [
          i ? /* @__PURE__ */ e(D, { name: i, size: "xs" }) : null,
          n
        ] }),
        s ? /* @__PURE__ */ e(
          "button",
          {
            "aria-label": c,
            className: "nim-chip__remove",
            disabled: a,
            onClick: s,
            type: "button",
            children: /* @__PURE__ */ e(D, { name: "close", size: "xs" })
          }
        ) : null
      ]
    }
  );
}
function et({
  className: n,
  disabled: l = !1,
  error: a,
  hint: i,
  label: t,
  onChange: s,
  placeholder: c,
  removeLabel: o = "Remove",
  separators: d = ["Enter", ",", "Tab"],
  validate: u,
  values: m
}) {
  const [h, f] = A(""), _ = () => {
    const b = h.trim();
    if (b && !(u && !u(b))) {
      if (m.includes(b)) {
        f("");
        return;
      }
      s([...m, b]), f("");
    }
  }, N = (b) => {
    if (d.includes(b.key)) {
      if (b.key === "Tab" && !h.trim()) return;
      b.preventDefault(), _();
      return;
    }
    b.key === "Backspace" && !h && m.length > 0 && s(m.slice(0, -1));
  };
  return /* @__PURE__ */ r("div", { className: v("nim-field", a && "nim-field--invalid", n), children: [
    t ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: t }) : null,
    /* @__PURE__ */ r("div", { className: "nim-chip-input", "data-disabled": l || void 0, children: [
      m.map((b) => /* @__PURE__ */ e(
        ki,
        {
          disabled: l,
          onRemove: () => s(m.filter((p) => p !== b)),
          removeLabel: `${o} ${b}`,
          children: b
        },
        b
      )),
      /* @__PURE__ */ e(
        "input",
        {
          "aria-invalid": a ? !0 : void 0,
          "aria-label": t,
          className: "nim-chip-input__field",
          disabled: l,
          onBlur: _,
          onChange: (b) => f(b.target.value),
          onKeyDown: N,
          placeholder: m.length === 0 ? c : void 0,
          value: h
        }
      )
    ] }),
    a ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: a }) : null,
    i && !a ? /* @__PURE__ */ e("p", { className: "nim-field__hint", children: i }) : null
  ] });
}
function nt({ className: n, layout: l = "rows", rows: a }) {
  return /* @__PURE__ */ e("dl", { className: v("nim-data-list", `nim-data-list--${l}`, n), children: a.map((i) => /* @__PURE__ */ r("div", { className: "nim-data-list__row", children: [
    /* @__PURE__ */ e("dt", { className: "nim-data-list__label", children: i.label }),
    /* @__PURE__ */ e("dd", { className: v("nim-data-list__value", i.mono && "nim-data-list__value--mono"), children: i.value ?? /* @__PURE__ */ e("span", { className: "nim-data-list__empty", children: "—" }) })
  ] }, i.id)) });
}
function at({
  className: n,
  commands: l,
  emptyLabel: a = (o) => `Nothing matches “${o}”.`,
  label: i,
  onClose: t,
  open: s,
  placeholder: c = "Search…"
}) {
  const o = K(null), d = K(null), u = K(null), [m, h] = A(""), [f, _] = A(0), N = J(() => wi(l, m), [l, m]), b = N.filter((g) => !g.disabled), p = b[Math.min(f, Math.max(b.length - 1, 0))];
  X(() => {
    var C;
    const g = o.current;
    g && (s && !g.open && (g.showModal(), (C = u.current) == null || C.focus()), !s && g.open && g.close());
  }, [s]), X(() => {
    const g = o.current;
    if (!g) return;
    const C = () => {
      h(""), _(0), t();
    };
    return g.addEventListener("close", C), () => g.removeEventListener("close", C);
  }, [t]), X(() => {
    var g, C;
    (C = (g = d.current) == null ? void 0 : g.querySelector('[data-active="true"]')) == null || C.scrollIntoView({ block: "nearest" });
  }, [f, m]);
  const y = (g) => {
    !g || g.disabled || (t(), g.onRun());
  }, k = (g) => {
    b.length && (g.key === "ArrowDown" ? (g.preventDefault(), _((C) => (C + 1) % b.length)) : g.key === "ArrowUp" ? (g.preventDefault(), _((C) => (C - 1 + b.length) % b.length)) : g.key === "Home" ? (g.preventDefault(), _(0)) : g.key === "End" ? (g.preventDefault(), _(b.length - 1)) : g.key === "Enter" && (g.preventDefault(), y(p)));
  }, S = !m.trim();
  let z;
  return /* @__PURE__ */ r(
    "dialog",
    {
      "aria-label": i,
      className: v("nim-palette", n),
      onClick: (g) => {
        g.target === o.current && t();
      },
      ref: o,
      children: [
        /* @__PURE__ */ r("div", { className: "nim-palette__field", children: [
          /* @__PURE__ */ e(D, { name: "search", size: "sm" }),
          /* @__PURE__ */ e(
            "input",
            {
              "aria-activedescendant": p ? `${p.id}-palette-row` : void 0,
              "aria-autocomplete": "list",
              "aria-controls": "nim-palette-list",
              "aria-expanded": !0,
              "aria-label": i,
              autoComplete: "off",
              className: "nim-palette__input",
              onChange: (g) => {
                h(g.target.value), _(0);
              },
              onKeyDown: k,
              placeholder: c,
              role: "combobox",
              spellCheck: !1,
              ref: u,
              value: m
            }
          )
        ] }),
        /* @__PURE__ */ e("div", { className: "nim-palette__list", id: "nim-palette-list", ref: d, role: "listbox", children: N.length ? N.map((g) => {
          const C = S && g.group && g.group !== z ? g.group : void 0;
          z = g.group;
          const x = g === p;
          return /* @__PURE__ */ r("div", { children: [
            C ? /* @__PURE__ */ e("p", { className: "nim-palette__group", role: "presentation", children: C }) : null,
            /* @__PURE__ */ r(
              "button",
              {
                "aria-selected": x,
                className: "nim-palette__row",
                "data-active": x ? "true" : void 0,
                disabled: g.disabled,
                id: `${g.id}-palette-row`,
                onClick: () => y(g),
                onMouseMove: () => {
                  const I = b.indexOf(g);
                  I >= 0 && I !== f && _(I);
                },
                role: "option",
                type: "button",
                children: [
                  /* @__PURE__ */ e(D, { name: g.icon ?? "chevron-forward", size: "sm" }),
                  /* @__PURE__ */ r("span", { className: "nim-palette__text", children: [
                    /* @__PURE__ */ e("span", { className: "nim-palette__label", children: g.label }),
                    g.hint ? /* @__PURE__ */ e("span", { className: "nim-palette__hint", children: g.hint }) : null
                  ] }),
                  g.shortcut ? /* @__PURE__ */ e("kbd", { className: "nim-palette__shortcut", children: g.shortcut }) : null
                ]
              }
            )
          ] }, g.id);
        }) : /* @__PURE__ */ e("p", { className: "nim-palette__empty", children: a(m) }) })
      ]
    }
  );
}
function wi(n, l) {
  const a = l.trim().toLowerCase();
  if (!a) return n;
  const i = [];
  for (const t of n) {
    const s = t.label.toLowerCase(), c = `${t.group ?? ""} ${t.keywords ?? ""}`.toLowerCase(), o = s.startsWith(a) ? 0 : s.includes(` ${a}`) ? 1 : s.includes(a) ? 2 : c.includes(a) ? 3 : -1;
    o >= 0 && i.push({ command: t, rank: o });
  }
  return i.sort((t, s) => t.rank - s.rank).map((t) => t.command);
}
function se({ children: n, className: l, error: a, hint: i, id: t, label: s, required: c }) {
  const o = ne(), d = t ?? `nim-${o}`, u = i ? `${d}-hint` : void 0, m = a ? `${d}-error` : void 0, h = [m, u].filter(Boolean).join(" ") || void 0;
  return /* @__PURE__ */ r("div", { className: v("nim-field", a && "nim-field--invalid", l), children: [
    s ? /* @__PURE__ */ r("label", { className: "nim-field__label", htmlFor: d, children: [
      s,
      c ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    n({ control: d, describedBy: h }),
    a ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: m, children: a }) : null,
    i && !a ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: u, children: i }) : null
  ] });
}
function it({ children: n, ...l }) {
  return /* @__PURE__ */ e(se, { ...l, children: () => n });
}
function Ci({ className: n, error: l, hint: a, iconEnd: i, iconStart: t, id: s, label: c, required: o, ...d }) {
  return /* @__PURE__ */ e(se, { error: l, hint: a, id: s, label: c, required: o, children: ({ control: u, describedBy: m }) => /* @__PURE__ */ r(
    "div",
    {
      className: v(
        "nim-input-shell",
        t && "nim-input-shell--has-start",
        i && "nim-input-shell--has-end"
      ),
      children: [
        t ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--start", children: /* @__PURE__ */ e(D, { name: t, size: "sm" }) }) : null,
        /* @__PURE__ */ e(
          "input",
          {
            "aria-describedby": m,
            "aria-invalid": l ? !0 : void 0,
            className: v("nim-input", n),
            id: u,
            required: o,
            ...d
          }
        ),
        i ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(D, { name: i, size: "sm" }) }) : null
      ]
    }
  ) });
}
function lt({ className: n, error: l, hint: a, id: i, label: t, required: s, rows: c = 4, ...o }) {
  return /* @__PURE__ */ e(se, { error: l, hint: a, id: i, label: t, required: s, children: ({ control: d, describedBy: u }) => /* @__PURE__ */ e(
    "textarea",
    {
      "aria-describedby": u,
      "aria-invalid": l ? !0 : void 0,
      className: v("nim-textarea", n),
      id: d,
      required: s,
      rows: c,
      ...o
    }
  ) });
}
function tt({
  className: n,
  error: l,
  hint: a,
  id: i,
  label: t,
  options: s,
  placeholder: c,
  required: o,
  ...d
}) {
  return /* @__PURE__ */ e(se, { error: l, hint: a, id: i, label: t, required: o, children: ({ control: u, describedBy: m }) => /* @__PURE__ */ r("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
    /* @__PURE__ */ r(
      "select",
      {
        "aria-describedby": m,
        "aria-invalid": l ? !0 : void 0,
        className: v("nim-select", n),
        id: u,
        required: o,
        ...d,
        children: [
          c ? /* @__PURE__ */ e("option", { value: "", disabled: !0, children: c }) : null,
          s.map((h) => /* @__PURE__ */ e("option", { disabled: h.disabled, value: h.value, children: h.label }, h.value))
        ]
      }
    ),
    /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(D, { name: "chevron-down", size: "sm" }) })
  ] }) });
}
function st({
  ariaLabel: n,
  className: l,
  emptyState: a,
  error: i,
  hint: t,
  id: s,
  label: c,
  onChange: o,
  options: d,
  placeholder: u,
  required: m,
  value: h
}) {
  const f = ne(), _ = d.find((M) => M.value === h) ?? null, [N, b] = A(""), [p, y] = A(!1), [k, S] = A(0), z = K(null), g = J(() => {
    const M = N.trim().toLowerCase();
    return M ? d.filter((F) => F.label.toLowerCase().includes(M)) : d;
  }, [d, N]), C = (M) => {
    o(M.value), b(""), y(!1);
  }, x = (M) => {
    if (M.key === "Escape") {
      b(""), y(!1);
      return;
    }
    if (!p && (M.key === "ArrowDown" || M.key === "ArrowUp")) {
      y(!0);
      return;
    }
    if (M.key === "ArrowDown" || M.key === "ArrowUp") {
      M.preventDefault();
      const F = M.key === "ArrowDown" ? 1 : -1, $ = g.filter((L) => !L.disabled);
      if ($.length === 0) return;
      S((L) => (L + F + $.length) % $.length);
    }
    if (M.key === "Enter") {
      const $ = g.filter((L) => !L.disabled)[k];
      $ && (M.preventDefault(), C($));
    }
  }, I = g.filter((M) => !M.disabled);
  return /* @__PURE__ */ e(se, { className: l, error: i, hint: t, id: s, label: c, required: m, children: ({ control: M, describedBy: F }) => /* @__PURE__ */ r("div", { className: "nim-combobox", children: [
    /* @__PURE__ */ r("div", { className: v("nim-input-shell", "nim-input-shell--has-end"), children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-label": n ?? c,
          "aria-autocomplete": "list",
          "aria-controls": p ? f : void 0,
          "aria-describedby": F,
          "aria-expanded": p,
          className: "nim-input",
          id: M,
          onBlur: () => window.setTimeout(() => y(!1), 120),
          onChange: ($) => {
            b($.target.value), S(0), y(!0);
          },
          onFocus: () => y(!0),
          onKeyDown: x,
          placeholder: u,
          ref: z,
          role: "combobox",
          value: p ? N : (_ == null ? void 0 : _.label) ?? ""
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(D, { name: "chevron-down", size: "sm" }) })
    ] }),
    p ? /* @__PURE__ */ e("div", { className: "nim-combobox__list", id: f, role: "listbox", children: I.length === 0 ? /* @__PURE__ */ e("div", { className: "nim-combobox__empty", children: a ? a(N) : `Nothing matches “${N}”.` }) : g.map(($) => /* @__PURE__ */ r(
      "button",
      {
        "aria-selected": I.indexOf($) === k,
        className: "nim-combobox__option",
        disabled: $.disabled,
        onClick: () => C($),
        onPointerEnter: () => S(I.indexOf($)),
        role: "option",
        type: "button",
        children: [
          /* @__PURE__ */ e("span", { children: $.label }),
          $.meta ? /* @__PURE__ */ e("span", { className: "nim-combobox__meta", children: $.meta }) : null
        ]
      },
      $.value
    )) }) : null
  ] }) });
}
const Xe = Se(null);
function rt({
  children: n,
  className: l,
  defaultColorway: a = "vermilion",
  defaultScheme: i = "light",
  defaultStyle: t = "ledger",
  direction: s = "ltr",
  locale: c,
  syncDocument: o = !0
}) {
  const [d, u] = A(t), [m, h] = A(a), [f, _] = A(i);
  X(() => {
    if (!o || typeof document > "u") return;
    const b = document.documentElement;
    b.dataset.nimStyle = d, b.dataset.nimColorway = m, f === "system" ? delete b.dataset.nimScheme : b.dataset.nimScheme = f, b.dir = s, c && (b.lang = c);
  }, [m, s, c, f, d, o]);
  const N = J(
    () => ({ colorway: m, direction: s, locale: c, scheme: f, setColorway: h, setScheme: _, setStyle: u, style: d }),
    [m, s, c, f, d]
  );
  return /* @__PURE__ */ e(Xe.Provider, { value: N, children: /* @__PURE__ */ e(
    "div",
    {
      className: v("nim-root", l),
      "data-nim-colorway": m,
      "data-nim-scheme": f === "system" ? void 0 : f,
      "data-nim-style": d,
      dir: s,
      lang: c,
      children: n
    }
  ) });
}
function ve() {
  const n = De(Xe);
  if (!n) throw new Error("useNim must be used inside <NimProvider>");
  return n;
}
function ct() {
  const { scheme: n, setScheme: l } = ve();
  return q(() => l(n === "dark" ? "light" : "dark"), [n, l]);
}
const pe = 864e5, xi = Date.UTC(622, 2, 22), Mi = 365.2422, ce = (n) => n.toISOString().slice(0, 10), oe = (n) => /* @__PURE__ */ new Date(`${n}T00:00:00Z`), be = () => ce(/* @__PURE__ */ new Date()), Ti = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
  year: "numeric"
});
function re(n, l) {
  const a = oe(n);
  if (l === "gregory")
    return { day: a.getUTCDate(), month: a.getUTCMonth() + 1, year: a.getUTCFullYear() };
  const i = Ti.formatToParts(a), t = (s) => {
    var c;
    return Number(((c = i.find((o) => o.type === s)) == null ? void 0 : c.value) ?? "0");
  };
  return { day: t("day"), month: t("month"), year: t("year") };
}
const Fe = (n) => n.year * 1e4 + n.month * 100 + n.day;
function de(n, l) {
  if (l === "gregory")
    return ce(new Date(Date.UTC(n.year, n.month - 1, n.day)));
  const a = Math.floor((n.year - 1) * Mi) + (n.month <= 7 ? (n.month - 1) * 31 : 186 + (n.month - 7) * 30) + n.day - 1;
  let i = new Date(xi + a * pe);
  const t = Fe(n);
  for (let s = 0; s < 40; s += 1) {
    const c = re(ce(i), "persian"), o = Fe(c);
    if (o === t) break;
    const d = (n.year - c.year) * 365 + (n.month - c.month) * 30 + (n.day - c.day);
    i = new Date(i.getTime() + (d === 0 ? o < t ? 1 : -1 : d) * pe);
  }
  return ce(i);
}
function Si(n, l) {
  const a = re(n, l);
  return de({ ...a, day: 1 }, l);
}
function Re(n, l, a) {
  const i = re(n, a), t = i.year * 12 + (i.month - 1) + l, s = Math.floor(t / 12), c = t % 12 + 1, o = Je(s, c, a);
  return de({ day: Math.min(i.day, o), month: c, year: s }, a);
}
function Je(n, l, a) {
  const i = oe(de({ day: 1, month: l, year: n }, a)).getTime(), t = l === 12 ? 1 : l + 1, s = l === 12 ? n + 1 : n, c = oe(de({ day: 1, month: t, year: s }, a)).getTime();
  return Math.round((c - i) / pe);
}
const Ce = (n, l) => ce(new Date(oe(n).getTime() + l * pe)), Di = (n) => oe(n).getUTCDay();
function Ei(n, l) {
  const a = n ?? "en";
  return a.includes("-u-ca-") || a.includes("-u-") ? a : `${a}-u-ca-${l}`;
}
const Ee = (n) => n != null && n.startsWith("fa") ? "persian" : "gregory", Ai = (n) => n === "persian" ? 6 : 1, Oe = /* @__PURE__ */ new Map();
function zi(n) {
  const l = n ?? "en", a = Oe.get(l);
  if (a) return a;
  const i = new Intl.NumberFormat(l, { useGrouping: !1 }), t = Array.from({ length: 10 }, (s, c) => i.format(c));
  return Oe.set(l, t), t;
}
function Te(n, l, a) {
  const i = re(n, a), t = zi(l), s = (c, o = 1) => String(c).padStart(o, "0").replace(/\d/g, (d) => t[Number(d)]);
  return `${s(i.year)}/${s(i.month, 2)}/${s(i.day, 2)}`;
}
function $i(n, l) {
  const i = Li(n).match(/\d+/g);
  if (!i || i.length < 3) return null;
  const [t, s, c] = i.map(Number);
  if (s < 1 || s > 12 || c < 1 || c > Je(t, s, l)) return null;
  const o = de({ day: c, month: s, year: t }, l), d = re(o, l);
  return d.year === t && d.month === s && d.day === c ? o : null;
}
function Li(n) {
  let l = "";
  for (const a of n) {
    const i = a.codePointAt(0) ?? 0;
    i >= 1776 && i <= 1785 ? l += String.fromCodePoint(i - 1776 + 48) : i >= 1632 && i <= 1641 ? l += String.fromCodePoint(i - 1632 + 48) : l += a;
  }
  return l;
}
const Ue = {
  next: "Next month",
  previous: "Previous month"
};
function en({
  className: n,
  marked: l = [],
  max: a,
  min: i,
  month: t,
  onMonthChange: s,
  onSelect: c,
  system: o,
  value: d,
  weekStart: u
}) {
  const { locale: m } = ve(), h = o ?? Ee(m), f = u ?? Ai(h), _ = be(), N = Ei(m, h), b = J(
    () => new Intl.DateTimeFormat(N, { month: "long", timeZone: "UTC", year: "numeric" }),
    [N]
  ), p = J(() => new Intl.NumberFormat(m), [m]), y = J(
    () => new Intl.DateTimeFormat(N, { timeZone: "UTC", weekday: "short" }),
    [N]
  ), k = Si(t, h), S = re(k, h).month, z = J(() => {
    const C = (Di(k) - f + 7) % 7, x = Ce(k, -C);
    return Array.from({ length: 42 }, (I, M) => {
      const F = Ce(x, M), $ = re(F, h);
      return { date: F, day: $.day, outside: $.month !== S };
    });
  }, [k, S, h, f]), g = J(() => {
    const C = "2024-01-07";
    return Array.from({ length: 7 }, (x, I) => ({
      key: `${f}-${I}`,
      label: y.format(/* @__PURE__ */ new Date(`${Ce(C, (f + I) % 7)}T00:00:00Z`))
    }));
  }, [f, y]);
  return /* @__PURE__ */ r("div", { className: v("nim-calendar", n), children: [
    /* @__PURE__ */ r("div", { className: "nim-calendar__header", children: [
      /* @__PURE__ */ e(
        G,
        {
          label: Ue.previous,
          name: "chevron-back",
          onClick: () => s(Re(k, -1, h)),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-calendar__month", children: b.format(/* @__PURE__ */ new Date(`${k}T00:00:00Z`)) }),
      /* @__PURE__ */ e(
        G,
        {
          label: Ue.next,
          name: "chevron-forward",
          onClick: () => s(Re(k, 1, h)),
          size: "sm"
        }
      )
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-calendar__grid", role: "grid", children: [
      g.map((C) => /* @__PURE__ */ e("span", { className: "nim-calendar__weekday", children: C.label }, C.key)),
      z.map((C) => /* @__PURE__ */ e(
        "button",
        {
          "aria-selected": C.date === d,
          className: v(
            "nim-calendar__day",
            C.outside && "nim-calendar__day--outside",
            C.date === _ && "nim-calendar__day--today",
            l.includes(C.date) && "nim-calendar__day--marked"
          ),
          disabled: i !== void 0 && C.date < i || a !== void 0 && C.date > a,
          onClick: () => c(C.date),
          role: "gridcell",
          type: "button",
          children: p.format(C.day)
        },
        C.date
      ))
    ] })
  ] });
}
function nn({
  calendar: n,
  describedBy: l,
  id: a,
  invalid: i,
  locale: t,
  onChange: s,
  value: c
}) {
  const [o, d] = A(null);
  if (n === "gregory")
    return /* @__PURE__ */ e(
      "input",
      {
        "aria-describedby": l,
        "aria-invalid": i ? !0 : void 0,
        className: "nim-input",
        id: a,
        onChange: (m) => s(m.target.value),
        type: "date",
        value: c
      }
    );
  const u = o ?? (c ? Te(c, t, n) : "");
  return /* @__PURE__ */ e(
    "input",
    {
      "aria-describedby": l,
      "aria-invalid": i ? !0 : void 0,
      className: "nim-input",
      dir: "ltr",
      id: a,
      inputMode: "numeric",
      onBlur: () => d(null),
      onChange: (m) => {
        d(m.target.value);
        const h = $i(m.target.value, n);
        h ? s(h) : m.target.value.trim() === "" && s("");
      },
      placeholder: Te(be(), t, n),
      type: "text",
      value: u
    }
  );
}
function ot({
  error: n,
  hint: l,
  id: a,
  label: i,
  onChange: t,
  required: s,
  value: c,
  ...o
}) {
  const { locale: d } = ve(), u = o.system ?? Ee(d), [m, h] = A(c || be());
  return /* @__PURE__ */ e(se, { error: n, hint: l, id: a, label: i, required: s, children: ({ control: f, describedBy: _ }) => /* @__PURE__ */ r("div", { className: "nim-stack nim-stack--tight", children: [
    /* @__PURE__ */ e(
      nn,
      {
        calendar: u,
        describedBy: _,
        id: f,
        invalid: !!n,
        locale: d,
        onChange: (N) => {
          t(N), N && h(N);
        },
        value: c
      }
    ),
    /* @__PURE__ */ e(
      en,
      {
        ...o,
        month: m,
        onMonthChange: h,
        onSelect: (N) => {
          t(N), h(N);
        },
        system: u,
        value: c
      }
    )
  ] }) });
}
function dt({
  error: n,
  hint: l,
  id: a,
  label: i,
  labels: t,
  onChange: s,
  required: c,
  showEquivalent: o,
  value: d,
  ...u
}) {
  const { locale: m } = ve(), h = u.system ?? Ee(m), [f, _] = A(!1), [N, b] = A(d || be()), p = K(null), y = { clear: "Clear date", open: "Open calendar", ...t }, k = o ?? h === "persian", S = h === "persian" ? "gregory" : "persian";
  return /* @__PURE__ */ e(se, { error: n, hint: l, id: a, label: i, required: c, children: ({ control: z, describedBy: g }) => /* @__PURE__ */ r("div", { className: "nim-date-picker", children: [
    /* @__PURE__ */ r("div", { className: "nim-date-picker__group", children: [
      /* @__PURE__ */ e(
        nn,
        {
          calendar: h,
          describedBy: g,
          id: z,
          invalid: !!n,
          locale: m,
          onChange: (C) => {
            s(C), C && b(C);
          },
          value: d
        }
      ),
      d ? /* @__PURE__ */ e(
        G,
        {
          label: y.clear,
          name: "close",
          onClick: () => s(""),
          size: "sm"
        }
      ) : null,
      /* @__PURE__ */ e(
        G,
        {
          "aria-expanded": f,
          label: y.open,
          name: "calendar",
          onClick: () => _((C) => !C),
          ref: p,
          size: "sm"
        }
      )
    ] }),
    k && d ? /* @__PURE__ */ r("p", { className: "nim-date-picker__equivalent", children: [
      /* @__PURE__ */ e(D, { name: "calendar", size: "xs" }),
      /* @__PURE__ */ e("span", { dir: S === "gregory" ? "ltr" : void 0, children: Te(d, m, S) })
    ] }) : null,
    /* @__PURE__ */ e(
      ii,
      {
        label: i ?? y.open,
        onClose: () => _(!1),
        open: f,
        triggerRef: p,
        children: /* @__PURE__ */ e(
          en,
          {
            ...u,
            month: N,
            onMonthChange: b,
            onSelect: (C) => {
              s(C), b(C), _(!1);
            },
            system: h,
            value: d
          }
        )
      }
    )
  ] }) });
}
function mt({
  children: n,
  className: l,
  closeLabel: a = "Close",
  description: i,
  dismissible: t = !0,
  footer: s,
  onClose: c,
  open: o,
  title: d
}) {
  const u = K(null);
  return X(() => {
    const m = u.current;
    m && (o && !m.open && m.showModal(), !o && m.open && m.close());
  }, [o]), X(() => {
    const m = u.current;
    if (!m || t) return;
    const h = (f) => f.preventDefault();
    return m.addEventListener("cancel", h), () => m.removeEventListener("cancel", h);
  }, [t]), X(() => {
    const m = u.current;
    if (!m) return;
    const h = () => c();
    return m.addEventListener("close", h), () => m.removeEventListener("close", h);
  }, [c]), /* @__PURE__ */ r(
    "dialog",
    {
      className: v("nim-dialog", l),
      onClick: (m) => {
        t && m.target === u.current && c();
      },
      ref: u,
      children: [
        /* @__PURE__ */ r("div", { className: "nim-dialog__header", children: [
          /* @__PURE__ */ r("div", { children: [
            /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: d }),
            i ? /* @__PURE__ */ e("p", { className: "nim-caption", children: i }) : null
          ] }),
          t ? /* @__PURE__ */ e(G, { label: a, name: "close", onClick: c, size: "sm" }) : null
        ] }),
        /* @__PURE__ */ e("div", { className: "nim-dialog__body", children: n }),
        s ? /* @__PURE__ */ e("div", { className: "nim-dialog__footer", children: s }) : null
      ]
    }
  );
}
function ut({ caveat: n, className: l, links: a, resolution: i, ...t }) {
  return /* @__PURE__ */ r("div", { className: v("nim-causal", l), children: [
    /* @__PURE__ */ e("ol", { className: "nim-causal__list", ...t, children: a.map((s, c) => /* @__PURE__ */ r(
      "li",
      {
        className: "nim-causal__link",
        "data-lead": c === 0 ? "true" : void 0,
        "data-tone": s.tone ?? "neutral",
        "data-unevidenced": s.evidence ? void 0 : "true",
        children: [
          /* @__PURE__ */ r("div", { "aria-hidden": "true", className: "nim-causal__rail", children: [
            /* @__PURE__ */ e("span", { className: "nim-causal__node" }),
            c < a.length - 1 ? /* @__PURE__ */ e("span", { className: "nim-causal__thread" }) : null
          ] }),
          /* @__PURE__ */ r("div", { className: "nim-causal__body", children: [
            s.step ? /* @__PURE__ */ e("span", { className: "nim-causal__step", children: s.step }) : null,
            /* @__PURE__ */ e("p", { className: "nim-causal__claim", children: s.claim }),
            s.evidence || s.source ? /* @__PURE__ */ r("p", { className: "nim-causal__proof", children: [
              s.evidence ? /* @__PURE__ */ e("span", { className: "nim-causal__evidence", children: s.evidence }) : null,
              s.source ? /* @__PURE__ */ e("span", { className: "nim-causal__source", children: s.source }) : null
            ] }) : null
          ] })
        ]
      },
      c
    )) }),
    i ? /* @__PURE__ */ e("div", { className: "nim-causal__resolution", children: i }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-causal__caveat", children: n }) : null
  ] });
}
function ht({ children: n, className: l, title: a, ...i }) {
  return /* @__PURE__ */ r("div", { className: v("nim-caveat", l), ...i, children: [
    /* @__PURE__ */ r("svg", { "aria-hidden": "true", className: "nim-caveat__glyph", viewBox: "0 0 24 24", children: [
      /* @__PURE__ */ e("circle", { cx: "12", cy: "12", r: "9" }),
      /* @__PURE__ */ e("path", { d: "M12 8v5" }),
      /* @__PURE__ */ e("path", { d: "M12 16.5v.5" })
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-caveat__body", children: [
      a ? /* @__PURE__ */ e("p", { className: "nim-caveat__title", children: a }) : null,
      /* @__PURE__ */ e("div", { className: "nim-caveat__detail", children: n })
    ] })
  ] });
}
function _t({ caption: n, className: l, lines: a, summary: i, ...t }) {
  const s = a.filter((u) => u.kind === "added").length, c = a.filter((u) => u.kind === "removed").length, o = i ?? `${s} line${s === 1 ? "" : "s"} added, ${c} removed`, d = { added: "added", context: "", removed: "removed" };
  return /* @__PURE__ */ r("figure", { className: v("nim-diff", l), ...t, children: [
    n ? /* @__PURE__ */ r("figcaption", { className: "nim-diff__caption", children: [
      /* @__PURE__ */ e("span", { children: n }),
      /* @__PURE__ */ r("span", { className: "nim-diff__tally", children: [
        /* @__PURE__ */ r("span", { className: "nim-diff__tally-add", children: [
          "+",
          s
        ] }),
        /* @__PURE__ */ r("span", { className: "nim-diff__tally-del", children: [
          "−",
          c
        ] })
      ] })
    ] }) : null,
    /* @__PURE__ */ r("pre", { className: "nim-diff__body", children: [
      /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: o }),
      a.map((u, m) => /* @__PURE__ */ r("span", { className: "nim-diff__line", "data-kind": u.kind, children: [
        d[u.kind] ? /* @__PURE__ */ r("span", { className: "nim-visually-hidden", children: [
          d[u.kind],
          ": "
        ] }) : null,
        /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-diff__marker", children: u.kind === "added" ? "+" : u.kind === "removed" ? "−" : " " }),
        /* @__PURE__ */ e("span", { className: "nim-diff__text", children: u.text })
      ] }, m))
    ] })
  ] });
}
function pt({ className: n, commands: l, costlyIndex: a, note: i, ...t }) {
  return /* @__PURE__ */ r("div", { className: v("nim-commands", n), ...t, children: [
    /* @__PURE__ */ e("ol", { className: "nim-commands__list", children: l.map((s, c) => /* @__PURE__ */ e(
      "li",
      {
        className: "nim-commands__item",
        "data-costly": c === a ? "true" : void 0,
        children: s
      },
      s
    )) }),
    i ? /* @__PURE__ */ e("p", { className: "nim-commands__note", children: i }) : null
  ] });
}
function ft({ children: n, className: l, note: a, ...i }) {
  return /* @__PURE__ */ r("div", { className: v("nim-decide", l), ...i, children: [
    a ? /* @__PURE__ */ e("p", { className: "nim-decide__note", children: a }) : null,
    /* @__PURE__ */ e("div", { className: "nim-decide__actions", children: n })
  ] });
}
class Nt extends on {
  constructor() {
    super(...arguments);
    ge(this, "state", { error: null });
    ge(this, "reset", () => {
      this.setState({ error: null });
    });
  }
  static getDerivedStateFromError(a) {
    return { error: a };
  }
  componentDidCatch(a, i) {
    var t, s;
    (s = (t = this.props).onError) == null || s.call(t, a, i);
  }
  componentDidUpdate(a) {
    this.state.error && a.resetKey !== this.props.resetKey && this.reset();
  }
  render() {
    const { error: a } = this.state;
    return a ? this.props.fallback ? this.props.fallback(a, this.reset) : /* @__PURE__ */ r("div", { className: v("nim-boundary", this.props.className), role: "alert", children: [
      /* @__PURE__ */ e("p", { className: "nim-boundary__title", children: "This screen stopped rendering" }),
      /* @__PURE__ */ e("p", { className: "nim-boundary__body", children: "The rest of the application is unaffected — the failure is contained to this region, and everything around it still works." }),
      /* @__PURE__ */ e("pre", { className: "nim-boundary__detail", children: a.message }),
      /* @__PURE__ */ e("button", { className: "nim-button nim-button--secondary nim-button--sm", onClick: this.reset, type: "button", children: "Try this screen again" })
    ] }) : this.props.children;
  }
}
function vt({
  absent: n,
  className: l,
  coverage: a,
  labels: i,
  measured: t,
  ...s
}) {
  return /* @__PURE__ */ r("div", { className: v("nim-ledger", l), ...s, children: [
    /* @__PURE__ */ r("section", { className: "nim-ledger__col", "data-kind": "measured", children: [
      /* @__PURE__ */ r("header", { className: "nim-ledger__head", children: [
        /* @__PURE__ */ e("span", { children: (i == null ? void 0 : i.measured) ?? "Measured" }),
        a ? /* @__PURE__ */ e("span", { className: "nim-ledger__coverage", children: a }) : null
      ] }),
      /* @__PURE__ */ e("dl", { className: "nim-ledger__rows", children: t.map((c, o) => /* @__PURE__ */ r("div", { className: "nim-ledger__row", children: [
        /* @__PURE__ */ r("dt", { children: [
          c.label,
          /* @__PURE__ */ e("span", { className: "nim-ledger__meta", children: c.source })
        ] }),
        /* @__PURE__ */ e("dd", { children: c.value })
      ] }, o)) })
    ] }),
    /* @__PURE__ */ r("section", { className: "nim-ledger__col", "data-kind": "absent", children: [
      /* @__PURE__ */ r("header", { className: "nim-ledger__head", children: [
        /* @__PURE__ */ e("span", { children: (i == null ? void 0 : i.absent) ?? "Not evidence" }),
        /* @__PURE__ */ e("span", { className: "nim-ledger__coverage", children: (i == null ? void 0 : i.excluded) ?? "excluded from every figure" })
      ] }),
      /* @__PURE__ */ e("dl", { className: "nim-ledger__rows", children: n.map((c, o) => /* @__PURE__ */ r("div", { className: "nim-ledger__row", children: [
        /* @__PURE__ */ r("dt", { children: [
          c.label,
          /* @__PURE__ */ e("span", { className: "nim-ledger__meta", children: c.why })
        ] }),
        /* @__PURE__ */ e("dd", { children: c.value })
      ] }, o)) })
    ] })
  ] });
}
function bt({ caption: n, className: l, entries: a, ...i }) {
  return /* @__PURE__ */ r("section", { className: v("nim-trail", l), ...i, children: [
    n ? /* @__PURE__ */ e("p", { className: "nim-trail__caption", children: n }) : null,
    /* @__PURE__ */ e("dl", { className: "nim-trail__rows", children: a.map((t, s) => /* @__PURE__ */ r("div", { className: "nim-trail__row", children: [
      /* @__PURE__ */ r("dt", { children: [
        t.label,
        /* @__PURE__ */ e("span", { className: "nim-trail__source", children: t.source })
      ] }),
      /* @__PURE__ */ e("dd", { className: "nim-trail__age", children: t.age })
    ] }, s)) })
  ] });
}
function gt({
  className: n,
  detail: l,
  label: a,
  percent: i,
  tone: t = "accent",
  value: s,
  ...c
}) {
  const o = typeof i == "number", d = Math.min(100, Math.max(0, i ?? 0)), u = typeof a == "string" ? a : void 0;
  return /* @__PURE__ */ r("div", { className: v("nim-resource-meter", n), "data-tone": t, ...c, children: [
    /* @__PURE__ */ r("div", { className: "nim-resource-meter__head", children: [
      /* @__PURE__ */ e("span", { className: "nim-resource-meter__label", children: a }),
      /* @__PURE__ */ e("span", { className: "nim-resource-meter__value", children: s })
    ] }),
    o ? /* @__PURE__ */ e(
      "div",
      {
        "aria-label": u,
        "aria-valuemax": 100,
        "aria-valuemin": 0,
        "aria-valuenow": d,
        className: "nim-resource-meter__track",
        role: "meter",
        children: /* @__PURE__ */ e("span", { className: "nim-resource-meter__fill", style: { inlineSize: `${d}%` } })
      }
    ) : null,
    l ? /* @__PURE__ */ e("span", { className: "nim-resource-meter__detail", children: l }) : null
  ] });
}
function yt({
  accept: n,
  caption: l,
  className: a,
  disabled: i = !1,
  error: t,
  label: s,
  multiple: c = !1,
  onFiles: o,
  prompt: d
}) {
  const u = K(0), [m, h] = A(!1), f = (_) => {
    _.preventDefault(), _.stopPropagation();
  };
  return /* @__PURE__ */ r("div", { className: v("nim-field", t && "nim-field--invalid", a), children: [
    /* @__PURE__ */ r(
      "label",
      {
        className: "nim-file-drop",
        "data-over": m || void 0,
        "data-disabled": i || void 0,
        onDragEnter: (_) => {
          f(_), u.current += 1, i || h(!0);
        },
        onDragLeave: (_) => {
          f(_), u.current -= 1, u.current <= 0 && h(!1);
        },
        onDragOver: f,
        onDrop: (_) => {
          if (f(_), u.current = 0, h(!1), i) return;
          const N = Array.from(_.dataTransfer.files);
          N.length > 0 && o(c ? N : N.slice(0, 1));
        },
        children: [
          /* @__PURE__ */ e(
            "input",
            {
              accept: n,
              className: "nim-choice__input",
              disabled: i,
              multiple: c,
              onChange: (_) => {
                const N = Array.from(_.target.files ?? []);
                N.length > 0 && o(N), _.target.value = "";
              },
              type: "file"
            }
          ),
          /* @__PURE__ */ e(D, { className: "nim-file-drop__icon", name: "upload", size: "lg" }),
          /* @__PURE__ */ e("span", { className: "nim-file-drop__label", children: s }),
          d ? /* @__PURE__ */ e("span", { className: "nim-file-drop__prompt", children: d }) : null,
          l ? /* @__PURE__ */ e("span", { className: "nim-file-drop__caption", children: l }) : null
        ]
      }
    ),
    t ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: t }) : null
  ] });
}
function kt({ children: n, className: l, ...a }) {
  return /* @__PURE__ */ e("div", { className: v("nim-app-frame", l), ...a, children: n });
}
function wt({
  as: n = "div",
  children: l,
  className: a,
  gap: i = "md",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-stack", i !== "md" && `nim-stack--${i}`, a), ...t, children: l });
}
function Ct({
  as: n = "div",
  children: l,
  className: a,
  gap: i = "md",
  wrap: t = !0,
  ...s
}) {
  return /* @__PURE__ */ e(
    n,
    {
      className: v("nim-inline", i !== "md" && `nim-inline--${i}`, !t && "nim-inline--nowrap", a),
      ...s,
      children: l
    }
  );
}
function Ii({ children: n, className: l, plain: a = !1, ...i }) {
  return /* @__PURE__ */ e("div", { className: v("nim-list", a && "nim-list--plain", l), ...i, children: n });
}
function Bi({
  className: n,
  href: l,
  leading: a,
  onClick: i,
  rel: t,
  subtitle: s,
  target: c,
  title: o,
  trailing: d,
  ...u
}) {
  const m = !!(l || i), h = /* @__PURE__ */ r(Y, { children: [
    a ? /* @__PURE__ */ e("span", { className: "nim-list-row__leading", children: a }) : null,
    /* @__PURE__ */ r("span", { className: "nim-list-row__content", children: [
      /* @__PURE__ */ e("span", { className: "nim-list-row__title", children: o }),
      s ? /* @__PURE__ */ e("span", { className: "nim-list-row__subtitle", children: s }) : null
    ] }),
    d ? /* @__PURE__ */ e("span", { className: "nim-list-row__trailing", children: d }) : null,
    m && !d ? /* @__PURE__ */ e(D, { className: "nim-list-row__chevron", name: "chevron-forward", size: "sm" }) : null
  ] }), f = v("nim-list-row", m && "nim-list-row--interactive", n);
  return l ? /* @__PURE__ */ e(
    "a",
    {
      className: f,
      href: l,
      rel: c === "_blank" ? t ?? "noreferrer" : t,
      target: c,
      ...u,
      children: h
    }
  ) : i ? /* @__PURE__ */ e("button", { className: f, onClick: i, type: "button", ...u, children: h }) : /* @__PURE__ */ e("div", { className: f, ...u, children: h });
}
const Pi = {
  back: "Back",
  dot: (n) => `Slide ${n + 1}`
};
function xt({
  brand: n,
  className: l,
  finishLabel: a,
  footnote: i,
  labels: t,
  nextLabel: s,
  onDone: c,
  onSkip: o,
  onStep: d,
  skipLabel: u,
  slides: m
}) {
  var y;
  const [h, f] = A(0), _ = { ...Pi, ...t }, N = m[Math.min(h, m.length - 1)], b = h === m.length - 1, p = q(
    (k) => {
      f(k), d == null || d(k);
    },
    [d]
  );
  return /* @__PURE__ */ r("section", { className: v("nim-onboarding", l), children: [
    /* @__PURE__ */ r("header", { className: "nim-onboarding__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-onboarding__brand", children: n }),
      u ? /* @__PURE__ */ e(
        le,
        {
          iconEnd: "chevron-forward",
          onClick: o ?? c,
          size: "sm",
          variant: "ghost",
          children: u
        }
      ) : null
    ] }),
    /* @__PURE__ */ r("div", { "aria-live": "polite", className: "nim-onboarding__stage", children: [
      N.art ? /* @__PURE__ */ e("div", { className: "nim-onboarding__art", children: N.art }) : null,
      N.proof ? /* @__PURE__ */ r("div", { className: "nim-onboarding__proof", children: [
        N.proof.icon ? /* @__PURE__ */ e("span", { className: "nim-onboarding__proof-icon", children: N.proof.icon }) : null,
        /* @__PURE__ */ r("span", { className: "nim-onboarding__proof-text", children: [
          /* @__PURE__ */ e("span", { className: "nim-onboarding__proof-title", children: N.proof.title }),
          (y = N.proof.points) != null && y.length ? /* @__PURE__ */ e("span", { className: "nim-onboarding__proof-points", children: N.proof.points.join(" · ") }) : null
        ] })
      ] }) : null
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-onboarding__copy", children: [
      N.label ? /* @__PURE__ */ e("span", { className: "nim-onboarding__chip", children: N.label }) : null,
      /* @__PURE__ */ e("h1", { className: "nim-onboarding__title", children: N.title }),
      N.body ? /* @__PURE__ */ e("p", { className: "nim-onboarding__body", children: N.body }) : null
    ] }),
    /* @__PURE__ */ r("footer", { className: "nim-onboarding__controls", children: [
      /* @__PURE__ */ e("div", { className: "nim-onboarding__dots", children: m.map((k, S) => /* @__PURE__ */ e(
        "button",
        {
          "aria-current": S === h ? "step" : void 0,
          "aria-label": _.dot(S),
          className: "nim-onboarding__dot",
          onClick: () => p(S),
          type: "button"
        },
        k.id
      )) }),
      /* @__PURE__ */ r("div", { className: "nim-onboarding__cta", children: [
        h > 0 ? /* @__PURE__ */ e(
          G,
          {
            label: _.back,
            name: "chevron-back",
            onClick: () => p(h - 1),
            size: "lg",
            variant: "outline"
          }
        ) : null,
        /* @__PURE__ */ e(
          le,
          {
            fullWidth: !0,
            iconEnd: b ? "arrow-forward" : void 0,
            onClick: () => b ? c() : p(h + 1),
            size: "lg",
            variant: "accent",
            children: b ? a : s
          }
        )
      ] }),
      i ? /* @__PURE__ */ e("p", { className: "nim-onboarding__footnote", children: i }) : null
    ] })
  ] });
}
const Fi = "AD:376 AE:971 AF:93 AG:1268 AI:1264 AL:355 AM:374 AO:244 AQ:672 AR:54 AS:1684 AT:43 AU:61 AW:297 AX:358 AZ:994 BA:387 BB:1246 BD:880 BE:32 BF:226 BG:359 BH:973 BI:257 BJ:229 BL:590 BM:1441 BN:673 BO:591 BQ:599 BR:55 BS:1242 BT:975 BW:267 BY:375 BZ:501 CA:1 CC:61 CD:243 CF:236 CG:242 CH:41 CI:225 CK:682 CL:56 CM:237 CN:86 CO:57 CR:506 CU:53 CV:238 CW:599 CX:61 CY:357 CZ:420 DE:49 DJ:253 DK:45 DM:1767 DO:1809 DZ:213 EC:593 EE:372 EG:20 EH:212 ER:291 ES:34 ET:251 FI:358 FJ:679 FK:500 FM:691 FO:298 FR:33 GA:241 GB:44 GD:1473 GE:995 GF:594 GG:44 GH:233 GI:350 GL:299 GM:220 GN:224 GP:590 GQ:240 GR:30 GT:502 GU:1671 GW:245 GY:592 HK:852 HN:504 HR:385 HT:509 HU:36 ID:62 IE:353 IL:972 IM:44 IN:91 IO:246 IQ:964 IR:98 IS:354 IT:39 JE:44 JM:1876 JO:962 JP:81 KE:254 KG:996 KH:855 KI:686 KM:269 KN:1869 KP:850 KR:82 KW:965 KY:1345 KZ:7 LA:856 LB:961 LC:1758 LI:423 LK:94 LR:231 LS:266 LT:370 LU:352 LV:371 LY:218 MA:212 MC:377 MD:373 ME:382 MF:590 MG:261 MH:692 MK:389 ML:223 MM:95 MN:976 MO:853 MP:1670 MQ:596 MR:222 MS:1664 MT:356 MU:230 MV:960 MW:265 MX:52 MY:60 MZ:258 NA:264 NC:687 NE:227 NF:672 NG:234 NI:505 NL:31 NO:47 NP:977 NR:674 NU:683 NZ:64 OM:968 PA:507 PE:51 PF:689 PG:675 PH:63 PK:92 PL:48 PM:508 PR:1787 PS:970 PT:351 PW:680 PY:595 QA:974 RE:262 RO:40 RS:381 RU:7 RW:250 SA:966 SB:677 SC:248 SD:249 SE:46 SG:65 SH:290 SI:386 SJ:47 SK:421 SL:232 SM:378 SN:221 SO:252 SR:597 SS:211 ST:239 SV:503 SX:1721 SY:963 SZ:268 TC:1649 TD:235 TG:228 TH:66 TJ:992 TK:690 TL:670 TM:993 TN:216 TO:676 TR:90 TT:1868 TV:688 TW:886 TZ:255 UA:380 UG:256 US:1 UY:598 UZ:998 VA:39 VC:1784 VE:58 VG:1284 VI:1340 VN:84 VU:678 WF:681 WS:685 YE:967 YT:262 ZA:27 ZM:260 ZW:263";
function Ri(n) {
  return String.fromCodePoint(...[...n].map((l) => 127462 + l.charCodeAt(0) - 65));
}
const fe = Fi.split(" ").map((n) => {
  const [l, a] = n.split(":");
  return { dial: a, flag: Ri(l), iso2: l };
}), Oi = new Map(fe.map((n) => [n.iso2, n]));
function an(n) {
  return Oi.get(n.toUpperCase());
}
function Mt(n) {
  const l = n.replace(/\D/g, "");
  let a;
  for (const i of fe)
    l.startsWith(i.dial) && (!a || i.dial.length > a.dial.length) && (a = i);
  return a;
}
const He = /* @__PURE__ */ new Map();
function Ui(n) {
  const l = He.get(n);
  if (l) return l;
  let a;
  try {
    const i = new Intl.DisplayNames([n], { type: "region" });
    a = (t) => i.of(t) ?? t;
  } catch {
    a = (i) => i;
  }
  return He.set(n, a), a;
}
function me(n) {
  let l = "";
  for (const a of n) {
    const i = a.codePointAt(0) ?? 0;
    i >= 1776 && i <= 1785 ? l += String.fromCodePoint(i - 1776 + 48) : i >= 1632 && i <= 1641 ? l += String.fromCodePoint(i - 1632 + 48) : a >= "0" && a <= "9" && (l += a);
  }
  return l;
}
function Hi({
  autoFocus: n = !1,
  className: l,
  digitLabel: a,
  error: i,
  label: t,
  length: s = 5,
  onChange: c,
  onComplete: o,
  value: d
}) {
  const u = K(null), m = d.slice(0, s).split(""), h = q((p) => {
    var k, S;
    const y = (k = u.current) == null ? void 0 : k.querySelectorAll("input");
    (S = y == null ? void 0 : y[Math.max(0, Math.min(p, y.length - 1))]) == null || S.focus();
  }, []);
  X(() => {
    n && h(0);
  }, [n, h]);
  const f = q(
    (p, y) => {
      const k = p.slice(0, s);
      c(k), k.length === s ? o == null || o(k) : h(y);
    },
    [h, s, c, o]
  ), _ = q(
    (p, y) => {
      const k = me(y);
      if (!k) return;
      const S = (d.slice(0, p) + k).slice(0, s);
      f(S, S.length);
    },
    [f, s, d]
  ), N = q(
    (p, y) => {
      if (y.key === "Backspace") {
        y.preventDefault();
        const k = d[p] ? p : p - 1;
        if (k < 0) return;
        c(d.slice(0, k) + d.slice(k + 1)), h(k);
      } else y.key === "ArrowLeft" ? h(p - 1) : y.key === "ArrowRight" && h(p + 1);
    },
    [h, c, d]
  ), b = q(
    (p) => {
      const y = me(p.clipboardData.getData("text"));
      y && (p.preventDefault(), f(y.slice(0, s), y.length));
    },
    [f, s]
  );
  return /* @__PURE__ */ r("div", { className: v("nim-otp", i && "nim-otp--invalid", l), children: [
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": t,
        className: "nim-otp__boxes",
        dir: "ltr",
        onPaste: b,
        ref: u,
        role: "group",
        children: Array.from({ length: s }, (p, y) => /* @__PURE__ */ e(
          "input",
          {
            "aria-invalid": i ? !0 : void 0,
            "aria-label": a ? a(y) : `${t} ${y + 1}`,
            autoComplete: y === 0 ? "one-time-code" : "off",
            className: "nim-otp__box",
            "data-filled": m[y] ? "true" : void 0,
            enterKeyHint: "done",
            inputMode: "numeric",
            onChange: (k) => _(y, k.target.value),
            onFocus: (k) => k.currentTarget.select(),
            onKeyDown: (k) => N(y, k),
            type: "text",
            value: m[y] ?? ""
          },
          y
        ))
      }
    ),
    i ? /* @__PURE__ */ e("p", { className: "nim-otp__error", role: "alert", children: i }) : null
  ] });
}
const Ki = {
  hide: "Hide password",
  show: "Show password",
  strength: (n) => `Password strength: ${n}`
}, Ke = ["weak", "fair", "good", "strong"];
function Wi({
  className: n,
  error: l,
  hint: a,
  id: i,
  label: t,
  labels: s,
  required: c,
  strength: o,
  ...d
}) {
  const [u, m] = A(!1), h = { ...Ki, ...s };
  return /* @__PURE__ */ e(se, { error: l, hint: a, id: i, label: t, required: c, children: ({ control: f, describedBy: _ }) => /* @__PURE__ */ r(Y, { children: [
    /* @__PURE__ */ r("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-describedby": _,
          "aria-invalid": l ? !0 : void 0,
          autoComplete: d.autoComplete ?? "current-password",
          className: v("nim-input", n),
          id: f,
          required: c,
          ...d,
          type: u ? "text" : "password"
        }
      ),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-controls": f,
          "aria-label": u ? h.hide : h.show,
          "aria-pressed": u,
          className: "nim-password__toggle",
          onClick: () => m((N) => !N),
          type: "button",
          children: /* @__PURE__ */ e(D, { name: "eye", size: "sm" })
        }
      )
    ] }),
    o ? /* @__PURE__ */ e(
      "div",
      {
        "aria-label": h.strength(o),
        className: "nim-password__meter",
        "data-level": o,
        role: "img",
        children: Ke.map((N, b) => /* @__PURE__ */ e(
          "span",
          {
            className: "nim-password__step",
            "data-on": b <= Ke.indexOf(o) ? "true" : void 0
          },
          N
        ))
      }
    ) : null
  ] }) });
}
function Tt(n) {
  if (n.length < 8) return "weak";
  const l = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((a) => a.test(n)).length;
  return n.length >= 14 && l >= 3 ? "strong" : n.length >= 10 && l >= 2 ? "good" : "fair";
}
const Gi = {
  noMatch: "No country matches",
  pickCountry: "Country code",
  search: "Search countries"
};
function Zi({
  className: n,
  country: l,
  error: a,
  hint: i,
  id: t,
  label: s,
  labels: c,
  locale: o,
  onChange: d,
  onCountryChange: u,
  onSubmit: m,
  placeholder: h,
  priority: f = [],
  required: _,
  value: N
}) {
  const b = ne(), p = t ?? `nim-${b}`, y = i ? `${p}-hint` : void 0, k = a ? `${p}-error` : void 0, S = { ...Gi, ...c }, [z, g] = A(!1), [C, x] = A(""), I = K(null), M = K(null), F = K(null), $ = o ?? (typeof document > "u" ? "en" : document.documentElement.lang || "en"), L = J(() => Ui($), [$]), B = an(l) ?? fe[0], Q = J(() => {
    const w = new Intl.Collator($), O = fe.map((T) => ({ ...T, name: L(T.iso2) })), W = (T) => {
      const R = f.indexOf(T);
      return R === -1 ? f.length : R;
    };
    return O.sort(
      (T, R) => W(T.iso2) - W(R.iso2) || w.compare(T.name, R.name)
    );
  }, [L, f, $]), j = J(() => {
    const w = C.trim().toLocaleLowerCase($);
    if (!w) return Q;
    const O = me(w);
    return Q.filter(
      (W) => W.name.toLocaleLowerCase($).includes(w) || W.iso2.toLowerCase().includes(w) || (O ? W.dial.startsWith(O) : !1)
    );
  }, [Q, C, $]);
  X(() => {
    var W;
    if (!z) return;
    (W = F.current) == null || W.focus();
    const w = (T) => {
      var R;
      (R = I.current) != null && R.contains(T.target) || g(!1);
    }, O = (T) => {
      var R;
      T.key === "Escape" && (g(!1), (R = M.current) == null || R.focus());
    };
    return document.addEventListener("mousedown", w), document.addEventListener("keydown", O), () => {
      document.removeEventListener("mousedown", w), document.removeEventListener("keydown", O);
    };
  }, [z]);
  const P = (w) => {
    var O;
    u(w), g(!1), x(""), (O = M.current) == null || O.focus();
  };
  return /* @__PURE__ */ r("div", { className: v("nim-field", a && "nim-field--invalid", n), children: [
    s ? /* @__PURE__ */ r("label", { className: "nim-field__label", htmlFor: p, children: [
      s,
      _ ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    /* @__PURE__ */ r("div", { className: "nim-phone", ref: I, children: [
      /* @__PURE__ */ r("div", { className: "nim-phone__shell", dir: "ltr", children: [
        /* @__PURE__ */ r(
          "button",
          {
            "aria-expanded": z,
            "aria-haspopup": "listbox",
            "aria-label": `${S.pickCountry}: ${L(B.iso2)} +${B.dial}`,
            className: "nim-phone__country",
            onClick: () => g((w) => !w),
            ref: M,
            type: "button",
            children: [
              /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-phone__flag", children: B.flag }),
              /* @__PURE__ */ r("span", { className: "nim-phone__dial", children: [
                "+",
                B.dial
              ] }),
              /* @__PURE__ */ e(D, { className: "nim-phone__caret", name: "chevron-down", size: "xs" })
            ]
          }
        ),
        /* @__PURE__ */ e(
          "input",
          {
            "aria-describedby": [k, y].filter(Boolean).join(" ") || void 0,
            "aria-invalid": a ? !0 : void 0,
            autoComplete: "tel-national",
            className: "nim-phone__input",
            enterKeyHint: "go",
            id: p,
            inputMode: "tel",
            onChange: (w) => d(me(w.target.value)),
            onKeyDown: (w) => {
              w.key === "Enter" && (m == null || m());
            },
            placeholder: h,
            required: _,
            type: "tel",
            value: N
          }
        )
      ] }),
      z ? /* @__PURE__ */ r("div", { className: "nim-phone__picker", children: [
        /* @__PURE__ */ r("div", { className: "nim-phone__search", children: [
          /* @__PURE__ */ e(D, { name: "search", size: "sm" }),
          /* @__PURE__ */ e(
            "input",
            {
              "aria-label": S.search,
              className: "nim-phone__search-input",
              onChange: (w) => x(w.target.value),
              placeholder: S.search,
              ref: F,
              type: "search",
              value: C
            }
          )
        ] }),
        /* @__PURE__ */ r("ul", { className: "nim-phone__list", role: "listbox", children: [
          j.map((w) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r(
            "button",
            {
              "aria-selected": w.iso2 === B.iso2,
              className: "nim-phone__option",
              onClick: () => P(w.iso2),
              role: "option",
              type: "button",
              children: [
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-phone__flag", children: w.flag }),
                /* @__PURE__ */ e("span", { className: "nim-phone__name", children: w.name }),
                /* @__PURE__ */ r("span", { className: "nim-phone__option-dial", dir: "ltr", children: [
                  "+",
                  w.dial
                ] })
              ]
            }
          ) }, w.iso2)),
          j.length === 0 ? /* @__PURE__ */ e("li", { className: "nim-phone__empty", children: S.noMatch }) : null
        ] })
      ] }) : null
    ] }),
    a ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: k, children: a }) : null,
    i && !a ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: y, children: i }) : null
  ] });
}
function ji(n, l) {
  var i;
  return `+${((i = an(n)) == null ? void 0 : i.dial) ?? ""}${me(l).replace(/^0+/, "")}`;
}
const Yi = {
  excluded: "minus",
  included: "check",
  pending: "clock"
};
function Vi({
  badge: n,
  className: l,
  features: a = [],
  icon: i,
  name: t,
  onSelect: s,
  price: c,
  priceCaption: o,
  secondary: d,
  selected: u = !1,
  tagline: m
}) {
  const h = /* @__PURE__ */ r(Y, { children: [
    /* @__PURE__ */ r("div", { className: "nim-plan__top", children: [
      i ? /* @__PURE__ */ e("span", { className: "nim-plan__icon", children: /* @__PURE__ */ e(D, { name: i, size: "md" }) }) : null,
      /* @__PURE__ */ r("div", { className: "nim-plan__heading", children: [
        /* @__PURE__ */ e("span", { className: "nim-plan__name", children: t }),
        m ? /* @__PURE__ */ e("span", { className: "nim-plan__tagline", children: m }) : null
      ] }),
      n ? /* @__PURE__ */ e("span", { className: "nim-plan__badge", children: n }) : null,
      s ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-plan__radio", children: u ? /* @__PURE__ */ e(D, { name: "check", size: "xs" }) : null }) : null
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-plan__price-box", children: [
      /* @__PURE__ */ r("div", { children: [
        o ? /* @__PURE__ */ e("span", { className: "nim-plan__price-caption", children: o }) : null,
        /* @__PURE__ */ e("strong", { className: "nim-plan__price", children: c })
      ] }),
      d ? /* @__PURE__ */ r("div", { className: "nim-plan__secondary", children: [
        /* @__PURE__ */ e("span", { className: "nim-plan__price-caption", children: d.caption }),
        /* @__PURE__ */ e("strong", { className: "nim-plan__secondary-value", children: d.value })
      ] }) : null
    ] }),
    a.length ? /* @__PURE__ */ e("ul", { className: "nim-plan__features", children: a.map((_, N) => {
      const b = _.state ?? "included";
      return /* @__PURE__ */ r("li", { className: "nim-plan__feature", "data-state": b, children: [
        /* @__PURE__ */ e(D, { name: Yi[b], size: "xs" }),
        /* @__PURE__ */ e("span", { className: "nim-plan__feature-label", children: _.label }),
        _.note ? /* @__PURE__ */ e("span", { className: "nim-plan__feature-note", children: _.note }) : null
      ] }, N);
    }) }) : null
  ] }), f = v("nim-plan", u && "nim-plan--selected", l);
  return s ? /* @__PURE__ */ e("button", { "aria-pressed": u, className: f, onClick: s, type: "button", children: h }) : /* @__PURE__ */ e("article", { className: f, children: h });
}
function qi({
  className: n,
  fullWidth: l = !1,
  label: a,
  onChange: i,
  options: t,
  value: s,
  ...c
}) {
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": a,
      className: v("nim-segmented", l && "nim-segmented--full", n),
      role: "tablist",
      ...c,
      children: t.map((o) => /* @__PURE__ */ e(
        "button",
        {
          "aria-selected": o.value === s,
          className: "nim-segmented__option",
          disabled: o.disabled,
          onClick: () => i(o.value),
          role: "tab",
          type: "button",
          children: o.label
        },
        o.value
      ))
    }
  );
}
const Qi = {
  cycle: "Billing period",
  monthly: "Per month",
  price: "This package"
};
function St({
  className: n,
  cycle: l,
  cycles: a = [],
  defaultCycle: i,
  defaultPlan: t,
  labels: s,
  note: c,
  onCycleChange: o,
  onPlanChange: d,
  onSubmit: u,
  plan: m,
  plans: h,
  submitLabel: f
}) {
  var x, I;
  const _ = { ...Qi, ...s }, [N, b] = A(i ?? ((x = a[0]) == null ? void 0 : x.id) ?? ""), [p, y] = A(t ?? ((I = h[0]) == null ? void 0 : I.id) ?? ""), k = l ?? N, S = m ?? p, z = (M) => {
    y(M), d == null || d(M);
  }, g = (M) => {
    b(M), o == null || o(M);
  }, C = a.find((M) => M.id === k);
  return /* @__PURE__ */ r("section", { className: v("nim-plan-picker", n), children: [
    a.length > 1 ? /* @__PURE__ */ r("div", { className: "nim-plan-picker__cycles", children: [
      /* @__PURE__ */ e(
        qi,
        {
          fullWidth: !0,
          label: _.cycle,
          onChange: g,
          options: a.map((M) => ({ label: M.label, value: M.id })),
          value: k
        }
      ),
      C != null && C.note ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__save", children: C.note }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-plan-picker__plans", children: h.map(({ id: M, prices: F, ...$ }) => {
      const L = F[k] ?? Object.values(F)[0];
      return /* @__PURE__ */ dn(
        Vi,
        {
          ...$,
          key: M,
          onSelect: () => z(M),
          price: (L == null ? void 0 : L.price) ?? "",
          priceCaption: _.price,
          secondary: (L == null ? void 0 : L.monthly) === void 0 ? void 0 : { caption: _.monthly, value: L.monthly },
          selected: M === S
        }
      );
    }) }),
    f ? /* @__PURE__ */ r("div", { className: "nim-plan-picker__foot", children: [
      /* @__PURE__ */ e(
        le,
        {
          fullWidth: !0,
          onClick: () => u == null ? void 0 : u(S, k),
          size: "lg",
          variant: "accent",
          children: f
        }
      ),
      c ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__note", children: c }) : null
    ] }) : null
  ] });
}
function Xi({
  action: n,
  className: l,
  description: a,
  eyebrow: i,
  title: t,
  ...s
}) {
  return /* @__PURE__ */ r("header", { className: v("nim-section-header", l), ...s, children: [
    /* @__PURE__ */ r("div", { children: [
      i ? /* @__PURE__ */ e("p", { className: "nim-label nim-section-header__eyebrow", children: i }) : null,
      /* @__PURE__ */ e("h2", { className: "nim-title nim-title--md", children: t }),
      a ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-section-header__description", children: a }) : null
    ] }),
    n ? /* @__PURE__ */ e("div", { className: "nim-section-header__action", children: n }) : null
  ] });
}
function Dt({
  className: n,
  footer: l,
  sections: a = [],
  ...i
}) {
  return /* @__PURE__ */ r("div", { className: v("nim-profile-screen", n), children: [
    /* @__PURE__ */ e(Xa, { ...i }),
    a.map((t) => /* @__PURE__ */ r("section", { className: "nim-profile-screen__section", children: [
      t.title ? /* @__PURE__ */ e(Xi, { description: t.description, title: t.title }) : null,
      /* @__PURE__ */ e(Ii, { children: t.rows.map((s) => /* @__PURE__ */ e(
        Bi,
        {
          className: v(s.danger && "nim-list-row--danger"),
          href: s.href,
          leading: s.icon ? /* @__PURE__ */ e(D, { name: s.icon, size: "md" }) : void 0,
          onClick: s.onToggle ? void 0 : s.onSelect,
          subtitle: s.subtitle,
          title: s.label,
          trailing: s.onToggle ? (
            // The row's own title names the switch, so the control
            // carries the name rather than repeating the text beside
            // itself. A toggle row is a div, never a button — a switch
            // inside a button is two controls in one target.
            /* @__PURE__ */ e(
              Ga,
              {
                "aria-label": typeof s.label == "string" ? s.label : void 0,
                checked: s.checked ?? !1,
                onChange: (c) => {
                  var o;
                  return (o = s.onToggle) == null ? void 0 : o.call(s, c.target.checked);
                },
                children: ""
              }
            )
          ) : s.value !== void 0 ? /* @__PURE__ */ e("span", { className: "nim-profile-screen__value", children: s.value }) : void 0
        },
        s.key
      )) })
    ] }, t.key)),
    l ? /* @__PURE__ */ e("div", { className: "nim-profile-screen__footer", children: l }) : null
  ] });
}
function Et({
  className: n,
  count: l = 5,
  label: a,
  onChange: i,
  readOnly: t = !1,
  size: s = "md",
  value: c
}) {
  const o = ne(), [d, u] = A(null), m = d ?? c;
  return t || !i ? /* @__PURE__ */ e(
    "span",
    {
      "aria-label": `${a}: ${c}/${l}`,
      className: v("nim-rating", `nim-rating--${s}`, "nim-rating--static", n),
      role: "img",
      children: Array.from({ length: l }, (h, f) => /* @__PURE__ */ e(We, { fill: Math.min(Math.max(c - f, 0), 1) }, f))
    }
  ) : /* @__PURE__ */ r(
    "fieldset",
    {
      className: v("nim-rating", `nim-rating--${s}`, n),
      onMouseLeave: () => u(null),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-visually-hidden", children: a }),
        Array.from({ length: l }, (h, f) => {
          const _ = f + 1;
          return /* @__PURE__ */ r("label", { className: "nim-rating__star", onMouseEnter: () => u(_), children: [
            /* @__PURE__ */ e(
              "input",
              {
                checked: c === _,
                className: "nim-choice__input",
                name: o,
                onChange: () => i(_),
                type: "radio",
                value: _
              }
            ),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: _ }),
            /* @__PURE__ */ e(We, { fill: Math.min(Math.max(m - f, 0), 1) })
          ] }, _);
        })
      ]
    }
  );
}
function We({ fill: n }) {
  return /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "nim-rating__glyph", children: [
    /* @__PURE__ */ e(D, { className: "nim-rating__outline", name: "star", size: "md" }),
    /* @__PURE__ */ e("span", { className: "nim-rating__fill", style: { inlineSize: `${n * 100}%` }, children: /* @__PURE__ */ e(D, { name: "star", size: "md" }) })
  ] });
}
const Ji = {
  back: "Back",
  codeLabel: "Verification code",
  codeSubtitle: (n) => `Enter the code we sent to ${n}`,
  codeTitle: "Verification code",
  identifierLabel: "Email",
  passwordLabel: "Password",
  passwordSubtitle: "Use the email and password on your account.",
  passwordTitle: "Sign in with a password",
  phoneLabel: "Mobile number",
  phoneSubtitle: "Enter your mobile number. We will text you a code — no password.",
  phoneTitle: "Welcome",
  resend: "Send the code again",
  resendIn: (n) => `You can ask for a new code in ${n}s`,
  sendCode: "Send code",
  signIn: "Sign in",
  usePassword: "Sign in with a password instead",
  usePhone: "Sign in with a code instead",
  verify: "Verify and sign in"
}, xe = (n, l) => n instanceof Error && n.message.trim() ? n.message.trim() : l;
function At({
  brand: n,
  className: l,
  codeLength: a = 5,
  copy: i,
  defaultCountry: t = "IR",
  defaultMethod: s = "code",
  footer: c,
  methods: o = ["code", "password"],
  onPasswordSignIn: d,
  onRequestCode: u,
  onVerifyCode: m,
  priority: h = ["IR", "AE", "TR", "DE", "US", "GB"],
  resendSeconds: f = 60
}) {
  const _ = { ...Ji, ...i }, [N, b] = A(
    o.includes(s) ? s : o[0]
  ), [p, y] = A(!1), [k, S] = A(t), [z, g] = A(""), [C, x] = A(""), [I, M] = A(""), [F, $] = A(""), [L, B] = A(!1), [Q, j] = A(""), [P, w] = A(0), O = K(!1);
  X(() => {
    if (P <= 0) return;
    const Z = window.setTimeout(() => w((ee) => ee - 1), 1e3);
    return () => window.clearTimeout(Z);
  }, [P]);
  const W = ji(k, z), T = z.replace(/\D/g, "").length >= 6, R = q(
    async (Z = !1) => {
      if (!(L || !Z && !T)) {
        B(!0), j("");
        try {
          await (u == null ? void 0 : u(W)), y(!0), x(""), w(f);
        } catch (ee) {
          j(xe(ee, _.sendCode));
        } finally {
          B(!1);
        }
      }
    },
    [L, W, u, T, f, _.sendCode]
  ), E = q(
    async (Z) => {
      if (!(O.current || Z.length !== a)) {
        O.current = !0, B(!0), j("");
        try {
          await (m == null ? void 0 : m(W, Z));
        } catch (ee) {
          j(xe(ee, _.verify)), x("");
        } finally {
          O.current = !1, B(!1);
        }
      }
    },
    [a, W, m, _.verify]
  ), U = q(async () => {
    if (!(L || !I.trim() || !F)) {
      B(!0), j("");
      try {
        await (d == null ? void 0 : d(I.trim(), F));
      } catch (Z) {
        j(xe(Z, _.signIn));
      } finally {
        B(!1);
      }
    }
  }, [L, I, d, F, _.signIn]), H = o.length > 1 ? /* @__PURE__ */ e(
    le,
    {
      onClick: () => {
        b(N === "code" ? "password" : "code"), j("");
      },
      size: "sm",
      variant: "ghost",
      children: N === "code" ? _.usePassword : _.usePhone
    }
  ) : null, V = Q ? /* @__PURE__ */ e(ni, { tone: "danger", children: Q }) : null;
  return N === "password" ? /* @__PURE__ */ r(
    ye,
    {
      action: {
        disabled: !I.trim() || !F,
        label: _.signIn,
        loading: L,
        onClick: () => void U()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ r(Y, { children: [
        H,
        c
      ] }),
      subtitle: _.passwordSubtitle,
      title: _.passwordTitle,
      children: [
        V,
        /* @__PURE__ */ e(
          Ci,
          {
            autoComplete: "username",
            label: _.identifierLabel,
            onChange: (Z) => M(Z.target.value),
            type: "email",
            value: I
          }
        ),
        /* @__PURE__ */ e(
          Wi,
          {
            autoComplete: "current-password",
            label: _.passwordLabel,
            onChange: (Z) => $(Z.target.value),
            onKeyDown: (Z) => {
              Z.key === "Enter" && U();
            },
            value: F
          }
        )
      ]
    }
  ) : p ? /* @__PURE__ */ r(
    ye,
    {
      action: {
        disabled: C.length !== a,
        label: _.verify,
        loading: L,
        onClick: () => void E(C)
      },
      back: {
        label: _.back,
        onClick: () => {
          y(!1), x(""), j("");
        }
      },
      className: l,
      footer: /* @__PURE__ */ r(Y, { children: [
        P > 0 ? /* @__PURE__ */ e("p", { children: _.resendIn(P) }) : /* @__PURE__ */ e(le, { onClick: () => void R(!0), size: "sm", variant: "ghost", children: _.resend }),
        c
      ] }),
      subtitle: _.codeSubtitle(W),
      title: _.codeTitle,
      children: [
        V,
        /* @__PURE__ */ e(
          Hi,
          {
            autoFocus: !0,
            label: _.codeLabel,
            length: a,
            onChange: x,
            onComplete: (Z) => void E(Z),
            value: C
          }
        )
      ]
    }
  ) : /* @__PURE__ */ r(
    ye,
    {
      action: {
        disabled: !T,
        label: _.sendCode,
        loading: L,
        onClick: () => void R()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ r(Y, { children: [
        H,
        c
      ] }),
      subtitle: _.phoneSubtitle,
      title: _.phoneTitle,
      children: [
        V,
        /* @__PURE__ */ e(
          Zi,
          {
            country: k,
            label: _.phoneLabel,
            onChange: g,
            onCountryChange: S,
            onSubmit: () => void R(),
            priority: h,
            value: z
          }
        )
      ]
    }
  );
}
function zt({ children: n, className: l, closeLabel: a = "Close", footer: i, onClose: t, open: s, title: c }) {
  const o = K(null), d = K(null), u = ne(), m = K(t);
  return X(() => {
    m.current = t;
  }, [t]), X(() => {
    var _;
    if (!s) return;
    d.current = document.activeElement;
    const h = document.body.style.overflow;
    document.body.style.overflow = "hidden", (_ = o.current) == null || _.focus();
    const f = (N) => {
      var k, S;
      if (N.key === "Escape" && m.current(), N.key !== "Tab") return;
      const b = (k = o.current) == null ? void 0 : k.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!(b != null && b.length)) {
        N.preventDefault(), (S = o.current) == null || S.focus();
        return;
      }
      const p = b[0], y = b[b.length - 1];
      N.shiftKey && (document.activeElement === p || document.activeElement === o.current) ? (N.preventDefault(), y.focus()) : !N.shiftKey && document.activeElement === y && (N.preventDefault(), p.focus());
    };
    return window.addEventListener("keydown", f), () => {
      var N, b;
      document.body.style.overflow = h, window.removeEventListener("keydown", f), (b = (N = d.current) == null ? void 0 : N.focus) == null || b.call(N);
    };
  }, [s]), !s || typeof document > "u" ? null : Ne(
    /* @__PURE__ */ r(Y, { children: [
      /* @__PURE__ */ e("div", { className: "nim-sheet__scrim", onClick: t }),
      /* @__PURE__ */ r(
        "div",
        {
          "aria-label": c ? void 0 : a,
          "aria-labelledby": c ? u : void 0,
          "aria-modal": "true",
          className: v("nim-sheet__panel", l),
          ref: o,
          role: "dialog",
          tabIndex: -1,
          children: [
            /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-sheet__handle" }),
            c ? /* @__PURE__ */ r("div", { className: "nim-sheet__header", children: [
              /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", id: u, children: c }),
              /* @__PURE__ */ e(G, { label: a, name: "close", onClick: t, size: "sm" })
            ] }) : null,
            /* @__PURE__ */ e("div", { className: "nim-sheet__body", children: n }),
            i ? /* @__PURE__ */ e("div", { className: "nim-sheet__footer", children: i }) : null
          ]
        }
      )
    ] }),
    document.body
  );
}
function $t({
  className: n,
  label: l,
  max: a = 100,
  min: i = 0,
  scale: t,
  step: s = 1,
  value: c,
  ...o
}) {
  const d = a === i ? 0 : (c - i) / (a - i) * 100;
  return /* @__PURE__ */ r("div", { className: "nim-field", children: [
    l ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: l }) : null,
    /* @__PURE__ */ e(
      "input",
      {
        "aria-label": l,
        className: v("nim-slider", n),
        max: a,
        min: i,
        step: s,
        style: { "--nim-slider-progress": `${d}%` },
        type: "range",
        value: c,
        ...o
      }
    ),
    t ? /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-inline", style: { justifyContent: "space-between" }, children: t.map((u) => /* @__PURE__ */ e("span", { className: "nim-caption", children: u }, u)) }) : null
  ] });
}
function Lt({ className: n, delta: l, deltaDirection: a = "up", label: i, unit: t, value: s, ...c }) {
  return /* @__PURE__ */ r("div", { className: v("nim-stat", n), ...c, children: [
    /* @__PURE__ */ r("p", { className: "nim-stat__value", children: [
      s,
      t ? /* @__PURE__ */ e("span", { className: "nim-stat__unit", children: t }) : null
    ] }),
    /* @__PURE__ */ e("p", { className: "nim-label nim-stat__label", children: i }),
    l ? /* @__PURE__ */ r("p", { className: "nim-stat__delta", "data-direction": a, children: [
      /* @__PURE__ */ e(D, { name: a === "up" ? "trend-up" : "trend-down", size: "xs" }),
      l
    ] }) : null
  ] });
}
function It({ className: n, label: l = "Stages", stages: a }) {
  return /* @__PURE__ */ e("ol", { "aria-label": l, className: v("nim-stages", n), children: a.map((i, t) => {
    const s = /* @__PURE__ */ r(Y, { children: [
      /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-stages__marker", children: i.status === "done" ? /* @__PURE__ */ e(D, { name: "check", size: "xs" }) : i.status === "blocked" ? /* @__PURE__ */ e(D, { name: "close", size: "xs" }) : t + 1 }),
      /* @__PURE__ */ r("span", { className: "nim-stages__text", children: [
        /* @__PURE__ */ e("span", { className: "nim-stages__label", children: i.label }),
        i.caption ? /* @__PURE__ */ e("span", { className: "nim-stages__caption", children: i.caption }) : null
      ] })
    ] });
    return /* @__PURE__ */ e(
      "li",
      {
        "aria-current": i.status === "active" ? "step" : void 0,
        className: "nim-stages__stage",
        "data-status": i.status,
        children: i.onSelect ? /* @__PURE__ */ e("button", { className: "nim-stages__body", onClick: i.onSelect, type: "button", children: s }) : /* @__PURE__ */ e("span", { className: "nim-stages__body", children: s })
      },
      i.id
    );
  }) });
}
function Bt({
  className: n,
  decrementLabel: l = "Decrease",
  incrementLabel: a = "Increase",
  label: i,
  max: t = Number.MAX_SAFE_INTEGER,
  min: s = 0,
  onChange: c,
  step: o = 1,
  value: d
}) {
  const u = (m) => Math.min(Math.max(m, s), t);
  return /* @__PURE__ */ r(
    "div",
    {
      "aria-label": i,
      "aria-valuemax": t,
      "aria-valuemin": s,
      "aria-valuenow": d,
      className: v("nim-stepper", n),
      role: "spinbutton",
      tabIndex: 0,
      onKeyDown: (m) => {
        m.key === "ArrowUp" && (m.preventDefault(), c(u(d + o))), m.key === "ArrowDown" && (m.preventDefault(), c(u(d - o)));
      },
      children: [
        /* @__PURE__ */ e(
          "button",
          {
            "aria-label": l,
            className: "nim-stepper__button",
            disabled: d <= s,
            onClick: () => c(u(d - o)),
            tabIndex: -1,
            type: "button",
            children: /* @__PURE__ */ e(D, { name: "minus", size: "sm" })
          }
        ),
        /* @__PURE__ */ e("span", { className: "nim-stepper__value", children: d }),
        /* @__PURE__ */ e(
          "button",
          {
            "aria-label": a,
            className: "nim-stepper__button",
            disabled: d >= t,
            onClick: () => c(u(d + o)),
            tabIndex: -1,
            type: "button",
            children: /* @__PURE__ */ e(D, { name: "plus", size: "sm" })
          }
        )
      ]
    }
  );
}
const el = {
  of: (n, l) => `${n} of ${l} steps`,
  status: {
    active: "In progress",
    done: "Done",
    failed: "Failed",
    pending: "Waiting",
    skipped: "Skipped"
  }
}, nl = {
  done: "check",
  failed: "close",
  pending: "clock",
  skipped: "minus"
};
function Pt({
  action: n,
  caption: l,
  className: a,
  labels: i,
  steps: t,
  title: s,
  value: c
}) {
  const o = { ...el, ...i }, d = t.filter((h) => h.status === "done" || h.status === "skipped").length, u = c ?? (t.length ? Math.round(d / t.length * 100) : 0), m = t.some((h) => h.status === "failed");
  return /* @__PURE__ */ r(
    "section",
    {
      "aria-live": "polite",
      className: v("nim-task", m && "nim-task--failed", a),
      children: [
        /* @__PURE__ */ r("header", { className: "nim-task__head", children: [
          s ? /* @__PURE__ */ e("h2", { className: "nim-task__title", children: s }) : null,
          l ? /* @__PURE__ */ e("p", { className: "nim-task__caption", children: l }) : null,
          /* @__PURE__ */ e(Za, { label: o.of(d, t.length), value: u })
        ] }),
        /* @__PURE__ */ e("ol", { className: "nim-task__steps", children: t.map((h) => /* @__PURE__ */ r("li", { className: "nim-task__step", "data-status": h.status, children: [
          /* @__PURE__ */ e("span", { className: "nim-task__marker", children: h.status === "active" ? /* @__PURE__ */ e(Ye, { size: "sm" }) : /* @__PURE__ */ e(D, { name: nl[h.status], size: "xs" }) }),
          /* @__PURE__ */ r("span", { className: "nim-task__step-text", children: [
            /* @__PURE__ */ e("span", { className: "nim-task__step-label", children: h.label }),
            /* @__PURE__ */ e("span", { className: "nim-task__step-detail", children: h.detail ?? o.status[h.status] })
          ] })
        ] }, h.id)) }),
        n ? /* @__PURE__ */ e("div", { className: "nim-task__action", children: n }) : null
      ]
    }
  );
}
function Ft({ className: n, density: l = "default", entries: a }) {
  return /* @__PURE__ */ e("ol", { className: v("nim-timeline", l === "compact" && "nim-timeline--compact", n), children: a.map((i) => /* @__PURE__ */ r("li", { className: "nim-timeline__entry", "data-tone": i.tone, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-timeline__marker", children: i.icon ? /* @__PURE__ */ e(D, { name: i.icon, size: "xs" }) : /* @__PURE__ */ e("span", { className: "nim-timeline__dot" }) }),
    /* @__PURE__ */ r("div", { className: "nim-timeline__content", children: [
      /* @__PURE__ */ r("div", { className: "nim-timeline__head", children: [
        /* @__PURE__ */ e("span", { className: "nim-timeline__title", children: i.title }),
        i.time ? /* @__PURE__ */ e("time", { className: "nim-timeline__time", children: i.time }) : null
      ] }),
      i.body && l !== "compact" ? /* @__PURE__ */ e("div", { className: "nim-timeline__body", children: i.body }) : null
    ] })
  ] }, i.id)) });
}
function Rt({ className: n, label: l, onChange: a, options: i, panelId: t, value: s, ...c }) {
  const o = K(null), d = ne(), u = (m) => {
    var p, y;
    const h = o.current && getComputedStyle(o.current).direction === "rtl" ? -1 : 1, f = (m.key === "ArrowRight" ? 1 : m.key === "ArrowLeft" ? -1 : 0) * h;
    if (f === 0 && m.key !== "Home" && m.key !== "End") return;
    m.preventDefault();
    const _ = i.filter((k) => !k.disabled), N = _.findIndex((k) => k.value === s), b = m.key === "Home" ? _[0] : m.key === "End" ? _.at(-1) : _[(N + f + _.length) % _.length];
    b && (a(b.value), (y = Array.from(((p = o.current) == null ? void 0 : p.querySelectorAll('[role="tab"]')) ?? []).find((k) => k.dataset.value === b.value)) == null || y.focus());
  };
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": l,
      className: v("nim-tabs", n),
      onKeyDown: u,
      ref: o,
      role: "tablist",
      ...c,
      children: i.map((m) => /* @__PURE__ */ r(
        "button",
        {
          "aria-selected": m.value === s,
          "aria-controls": t,
          id: `${t ?? d}-tab-${m.value}`,
          className: "nim-tab",
          "data-value": m.value,
          disabled: m.disabled,
          onClick: () => a(m.value),
          role: "tab",
          tabIndex: m.value === s ? 0 : -1,
          type: "button",
          children: [
            m.label,
            m.count === void 0 ? null : /* @__PURE__ */ e("span", { className: "nim-tab__count", children: m.count })
          ]
        },
        m.value
      ))
    }
  );
}
const ln = Se(null), al = {
  accent: "sparkle",
  danger: "danger",
  neutral: "info",
  success: "check-circle"
};
function Ot({ children: n }) {
  const [l, a] = A([]), i = K(0), t = q((o) => {
    a((d) => d.filter((u) => u.id !== o));
  }, []), s = q(
    (o) => {
      const d = i.current++;
      a((m) => [...m, { ...o, id: d }]);
      const u = o.duration ?? 4e3;
      u > 0 && window.setTimeout(() => t(d), u);
    },
    [t]
  ), c = J(() => s, [s]);
  return /* @__PURE__ */ r(ln.Provider, { value: c, children: [
    n,
    typeof document < "u" ? Ne(
      /* @__PURE__ */ e("div", { "aria-live": "polite", className: "nim-toast-stack", children: l.map((o) => /* @__PURE__ */ r("div", { className: v("nim-toast", `nim-toast--${o.tone ?? "neutral"}`), children: [
        /* @__PURE__ */ e(D, { className: "nim-toast__icon", name: al[o.tone ?? "neutral"], size: "sm" }),
        /* @__PURE__ */ e("span", { className: "nim-toast__message", children: o.message }),
        o.action ? /* @__PURE__ */ e(
          "button",
          {
            className: "nim-toast__action",
            onClick: () => {
              var d;
              (d = o.action) == null || d.onPress(), t(o.id);
            },
            type: "button",
            children: o.action.label
          }
        ) : null
      ] }, o.id)) }),
      document.body
    ) : null
  ] });
}
function Ut() {
  const n = De(ln);
  if (!n) throw new Error("useToast must be used inside <ToastProvider>");
  return n;
}
function Ht({ children: n, className: l, label: a }) {
  return /* @__PURE__ */ r("span", { className: v("nim-tooltip", l), children: [
    n,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-tooltip__bubble", role: "tooltip", children: a })
  ] });
}
const il = {
  back: "Back",
  close: "Close",
  step: (n, l) => `Step ${n + 1} of ${l}`
};
function Kt({
  className: n,
  continueLabel: l,
  finishLabel: a,
  labels: i,
  onClose: t,
  onDone: s,
  onStep: c,
  steps: o
}) {
  const d = { ...il, ...i }, [u, m] = A(0), h = o[Math.min(u, o.length - 1)], f = u === o.length - 1, _ = q(
    (N) => {
      m(N), c == null || c(N);
    },
    [c]
  );
  return /* @__PURE__ */ r("section", { className: v("nim-wizard", n), children: [
    /* @__PURE__ */ r("header", { className: "nim-wizard__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: u > 0 ? /* @__PURE__ */ e(G, { label: d.back, name: "chevron-back", onClick: () => _(u - 1), size: "sm" }) : null }),
      /* @__PURE__ */ e("ol", { "aria-label": d.step(u, o.length), className: "nim-wizard__dots", children: o.map((N, b) => /* @__PURE__ */ e(
        "li",
        {
          className: "nim-wizard__dot",
          "data-done": b < u ? "true" : void 0,
          "data-on": b === u ? "true" : void 0
        },
        N.id
      )) }),
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: t ? /* @__PURE__ */ e(G, { label: d.close, name: "close", onClick: t, size: "sm" }) : null })
    ] }),
    h.question ? /* @__PURE__ */ r("div", { className: "nim-wizard__ask", children: [
      /* @__PURE__ */ e("h1", { className: "nim-wizard__question", children: h.question }),
      h.subtitle ? /* @__PURE__ */ e("p", { className: "nim-wizard__subtitle", children: h.subtitle }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-wizard__content", children: h.content }),
    /* @__PURE__ */ e("footer", { className: "nim-wizard__foot", children: /* @__PURE__ */ e(
      le,
      {
        disabled: h.canContinue === !1,
        fullWidth: !0,
        onClick: () => f ? s() : _(u + 1),
        size: "lg",
        variant: "accent",
        children: h.continueLabel ?? (f ? a : l)
      }
    ) })
  ] });
}
function Wt({
  className: n,
  max: l,
  multiple: a = !1,
  onChange: i,
  options: t,
  selected: s
}) {
  const c = a && l !== void 0 && s.length >= l, o = (d) => {
    if (!a) {
      i([d]);
      return;
    }
    i(s.includes(d) ? s.filter((u) => u !== d) : [...s, d]);
  };
  return /* @__PURE__ */ e("div", { className: v("nim-choice-grid", n), role: a ? "group" : "radiogroup", children: t.map((d) => {
    const u = s.includes(d.id);
    return /* @__PURE__ */ r(
      "button",
      {
        "aria-checked": u,
        className: "nim-choice-grid__tile",
        "data-on": u ? "true" : void 0,
        disabled: d.disabled || c && !u,
        onClick: () => o(d.id),
        role: a ? "checkbox" : "radio",
        type: "button",
        children: [
          d.icon ? /* @__PURE__ */ e("span", { className: "nim-choice-grid__icon", children: d.icon }) : null,
          /* @__PURE__ */ e("span", { className: "nim-choice-grid__label", children: d.label })
        ]
      },
      d.id
    );
  }) });
}
const tn = (n = "default") => n === "default" ? void 0 : `nim-text--${n}`;
function ll({
  as: n = "h1",
  children: l,
  className: a,
  size: i = "md",
  ...t
}) {
  return /* @__PURE__ */ e(
    n,
    {
      className: v(
        "nim-display",
        i === "lg" && "nim-display--lg",
        i === "xl" && "nim-display--xl",
        a
      ),
      ...t,
      children: l
    }
  );
}
ll.Line = function({
  children: l,
  accent: a,
  indent: i,
  className: t,
  ...s
}) {
  return /* @__PURE__ */ e(
    "span",
    {
      className: v("nim-display__line", a && "nim-display__accent", t),
      "data-indent": i ? "true" : void 0,
      ...s,
      children: l
    }
  );
};
function Gt({
  as: n = "h2",
  children: l,
  className: a,
  size: i = "lg",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-title", i === "md" && "nim-title--md", a), ...t, children: l });
}
function Zt({
  as: n = "p",
  children: l,
  className: a,
  size: i = "md",
  tone: t,
  ...s
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-body", i === "sm" && "nim-body--sm", tn(t), a), ...s, children: l });
}
function jt({ as: n = "span", children: l, className: a, ...i }) {
  return /* @__PURE__ */ e(n, { className: v("nim-label", a), ...i, children: l });
}
function Yt({ as: n = "p", children: l, className: a, tone: i, ...t }) {
  return /* @__PURE__ */ e(n, { className: v("nim-caption", tn(i), a), ...t, children: l });
}
function Vt({ className: n, ...l }) {
  return /* @__PURE__ */ e("hr", { className: v("nim-rule", n), ...l });
}
export {
  Pl as Accordion,
  Wl as ActionBar,
  _l as ActivityFeed,
  ml as AdminShell,
  kt as AppFrame,
  Fl as AppShell,
  Zl as AssistantThread,
  ye as AuthScreen,
  _e as Avatar,
  Rl as AvatarRing,
  Ja as Badge,
  ni as Banner,
  Zt as Body,
  Al as Brand,
  zl as BrandMark,
  Ol as Breadcrumb,
  le as Button,
  fe as COUNTRIES,
  en as Calendar,
  Yt as Caption,
  Ul as Card,
  ut as CausalChain,
  ht as Caveat,
  jl as Chart,
  Gl as Chat,
  Jl as ChatComposer,
  Le as Checkbox,
  ki as Chip,
  et as ChipInput,
  Wt as ChoiceGrid,
  wl as CodeBlock,
  yl as Columns,
  st as Combobox,
  pt as CommandList,
  at as CommandPalette,
  pi as ConversationList,
  Dl as CopyChip,
  nt as DataList,
  Bl as DataTable,
  ot as DateField,
  dt as DatePicker,
  ft as DecideBar,
  ul as DetailHeader,
  El as DetailLayout,
  mt as Dialog,
  _t as Diff,
  ll as Display,
  Ha as EmptyState,
  Nt as ErrorBoundary,
  vt as EvidenceLedger,
  bt as EvidenceTrail,
  gl as Facts,
  it as Field,
  yt as FileDrop,
  hl as FilterChips,
  D as Icon,
  G as IconButton,
  Ct as Inline,
  Ci as Input,
  jt as Label,
  Ii as List,
  Bi as ListRow,
  Ql as MapView,
  Xl as MediaPlayer,
  Ie as Menu,
  Vl as Messenger,
  vl as Metric,
  bl as MetricGrid,
  xl as Mono,
  rt as NimProvider,
  xt as Onboarding,
  Hl as OptionCard,
  Kl as OrderSummary,
  Hi as OtpInput,
  pl as Page,
  Wa as Pagination,
  fl as Panel,
  Wi as PasswordField,
  Zi as PhoneField,
  Vi as PlanCard,
  St as PlanPicker,
  ii as Popover,
  Xa as ProfileHeader,
  Dt as ProfileScreen,
  Za as Progress,
  Ll as Radio,
  Il as RadioGroup,
  Tl as Rail,
  Sl as RailSection,
  Et as Rating,
  Ml as RecordLink,
  gt as ResourceMeter,
  ql as RoomHeader,
  Vt as Rule,
  Xi as SectionHeader,
  qi as Segmented,
  tt as Select,
  zt as Sheet,
  At as SignInFlow,
  ja as Skeleton,
  $t as Slider,
  Yl as Sparkline,
  Ye as Spinner,
  wt as Stack,
  It as StageTrack,
  Lt as Stat,
  Cl as StatusDot,
  kl as StatusHero,
  Bt as Stepper,
  Ga as Switch,
  qa as TabBar,
  $e as Table,
  Rt as Tabs,
  Pt as TaskProgress,
  lt as Textarea,
  Ft as Timeline,
  Gt as Title,
  Ot as ToastProvider,
  Nl as Toolbar,
  Ht as Tooltip,
  Kt as Wizard,
  Ce as addDays,
  Re as addMonths,
  $l as brandFor,
  v as cn,
  Mt as countryByDial,
  an as countryByIso2,
  Ui as countryNamer,
  Te as formatNumeric,
  de as fromParts,
  dl as iconNames,
  Je as monthLength,
  $i as parseNumeric,
  re as partsOf,
  Tt as scorePassword,
  Si as startOfMonth,
  me as toAsciiDigits,
  ji as toE164,
  be as todayIso,
  ve as useNim,
  ct as useSchemeToggle,
  Ut as useToast
};
