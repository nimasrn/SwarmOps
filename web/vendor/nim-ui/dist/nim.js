var nn = Object.defineProperty;
var an = (n, l, a) => l in n ? nn(n, l, { enumerable: !0, configurable: !0, writable: !0, value: a }) : n[l] = a;
var Ne = (n, l, a) => an(n, typeof l != "symbol" ? l + "" : l, a);
import { jsx as e, jsxs as r, Fragment as K } from "react/jsx-runtime";
import { forwardRef as Ue, useState as E, useCallback as Z, createContext as xe, useContext as Me, useId as J, Fragment as we, useRef as O, useLayoutEffect as ln, useEffect as j, useMemo as Y, Component as tn, createElement as sn } from "react";
import { Wallet as rn, VolumeX as cn, Volume2 as on, User as dn, Video as mn, Upload as un, TrendingUp as hn, TrendingDown as _n, Trash2 as pn, Sun as fn, Star as Nn, Sparkles as vn, CircleStop as bn, LogOut as gn, Share2 as yn, Settings as kn, Send as wn, Search as Cn, Plus as xn, Play as Mn, Pin as Tn, Pause as Sn, Paperclip as Dn, Moon as zn, Minus as Ln, Mic as An, Menu as $n, Lock as En, Loader as In, Info as Bn, Home as Pn, Heart as Fn, Hash as Rn, Forward as On, Filter as Un, Maximize2 as Kn, SmilePlus as Hn, MessageCircle as Gn, Eye as Wn, ExternalLink as Zn, Pencil as Yn, Download as jn, FileText as Vn, CircleAlert as qn, Copy as Qn, X as Xn, Clock as Jn, ChevronUp as ea, ChevronRight as na, ChevronDown as aa, ChevronLeft as ia, CircleCheck as la, Check as ta, Camera as sa, Calendar as ra, Bookmark as ca, Bell as oa, Users as da, Terminal as ma, Tag as ua, ShieldCheck as ha, Server as _a, Reply as pa, RefreshCw as fa, Package as Na, MoreHorizontal as va, Link2 as ba, Layers as ga, KeyRound as ya, Globe as ka, Database as wa, Cloud as Ca, BarChart3 as xa, ArrowRight as Ma, ArrowLeft as Ta, AlertTriangle as Sa, Activity as Da } from "lucide-react";
import { createPortal as he } from "react-dom";
const v = (...n) => n.filter(Boolean).join(" "), Ke = {
  activity: Da,
  alert: Sa,
  "arrow-back": Ta,
  "arrow-forward": Ma,
  chart: xa,
  cloud: Ca,
  database: wa,
  globe: ka,
  key: ya,
  layers: ga,
  link: ba,
  more: va,
  package: Na,
  refresh: fa,
  reply: pa,
  server: _a,
  shield: ha,
  tag: ua,
  terminal: ma,
  users: da,
  bell: oa,
  bookmark: ca,
  calendar: ra,
  camera: sa,
  check: ta,
  "check-circle": la,
  "chevron-back": ia,
  "chevron-down": aa,
  "chevron-forward": na,
  "chevron-up": ea,
  clock: Jn,
  close: Xn,
  copy: Qn,
  danger: qn,
  document: Vn,
  download: jn,
  edit: Yn,
  external: Zn,
  eye: Wn,
  chat: Gn,
  emoji: Hn,
  expand: Kn,
  filter: Un,
  forward: On,
  hash: Rn,
  heart: Fn,
  home: Pn,
  info: Bn,
  loading: In,
  lock: En,
  menu: $n,
  mic: An,
  minus: Ln,
  moon: zn,
  paperclip: Dn,
  pause: Sn,
  pin: Tn,
  play: Mn,
  plus: xn,
  search: Cn,
  send: wn,
  settings: kn,
  share: yn,
  "sign-out": gn,
  stop: bn,
  sparkle: vn,
  star: Nn,
  sun: fn,
  trash: pn,
  "trend-down": _n,
  "trend-up": hn,
  upload: un,
  video: mn,
  user: dn,
  volume: on,
  "volume-off": cn,
  wallet: rn
}, za = /* @__PURE__ */ new Set([
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
]), Se = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 };
function T({ className: n, label: l, name: a, size: i = "md", tone: t = "default", ...s }) {
  const c = Ke[a];
  return /* @__PURE__ */ e(
    c,
    {
      "aria-hidden": l ? void 0 : !0,
      "aria-label": l,
      className: v("nim-icon", n),
      "data-flip": za.has(a) ? "true" : void 0,
      "data-tone": t === "default" ? void 0 : t,
      focusable: "false",
      height: Se[i],
      role: l ? "img" : void 0,
      strokeWidth: 1.75,
      width: Se[i],
      ...s
    }
  );
}
const tl = Object.keys(Ke), La = { sm: "sm", md: "md", lg: "md" }, U = Ue(function({ className: l, label: a, name: i, size: t = "md", type: s = "button", variant: c = "ghost", ...o }, d) {
  return /* @__PURE__ */ e(
    "button",
    {
      "aria-label": a,
      className: v("nim-icon-button", `nim-icon-button--${c}`, `nim-icon-button--${t}`, l),
      ref: d,
      title: a,
      type: s,
      ...o,
      children: /* @__PURE__ */ e(T, { name: i, size: La[t] })
    }
  );
}), Aa = {
  close: "Close menu",
  collapse: "Collapse",
  expand: "Expand",
  menu: "Open menu",
  nav: "Admin navigation"
};
function sl({
  brand: n,
  children: l,
  className: a,
  collapsible: i = !1,
  contextualFooter: t,
  contextualGroups: s,
  contextualHeader: c,
  contextualValue: o,
  groups: d,
  labels: m,
  navigation: u = "sidebar",
  sidebarFooter: h,
  title: f,
  toolbar: _,
  value: N,
  titleRole: g = "page"
}) {
  const p = { ...Aa, ...m }, [w, y] = E(!1), [D, I] = E(!1), k = g === "scope" ? "div" : "h1", x = (C, $, L) => /* @__PURE__ */ e("nav", { "aria-label": L, className: "nim-admin__nav", children: C.map((A) => /* @__PURE__ */ r("div", { className: "nim-admin__group", children: [
    A.label ? /* @__PURE__ */ r("p", { className: "nim-admin__group-label", children: [
      A.icon ? /* @__PURE__ */ e(T, { name: A.icon, size: "xs" }) : null,
      A.label
    ] }) : null,
    A.items.map((B) => {
      const H = B.key === $, G = /* @__PURE__ */ r(K, { children: [
        B.icon ? /* @__PURE__ */ e(T, { name: B.icon, size: "sm" }) : null,
        /* @__PURE__ */ e("span", { children: B.label })
      ] }), P = {
        "aria-current": H ? "page" : void 0,
        className: "nim-admin__link",
        "data-active": H ? "true" : void 0,
        onClick: () => {
          var M;
          (M = B.onSelect) == null || M.call(B), y(!1);
        },
        // The only text left in the rail is the icon, so the accessible
        // name has to survive the collapse — it is the label, always,
        // not a second string that can drift away from it.
        title: typeof B.label == "string" ? B.label : void 0
      };
      return B.href ? /* @__PURE__ */ e("a", { href: B.href, ...P, children: G }, B.key) : /* @__PURE__ */ e("button", { type: "button", ...P, children: G }, B.key);
    })
  ] }, A.key)) }), b = x(d, N, p.nav), S = s != null && s.length ? x(s, o ?? N, `${p.nav} · current section`) : null;
  return /* @__PURE__ */ r(
    "div",
    {
      className: v("nim-admin", a),
      "data-collapsed": i && D ? "true" : void 0,
      "data-drawer": w ? "open" : void 0,
      "data-navigation": u,
      children: [
        u !== "sections" ? /* @__PURE__ */ r("aside", { className: "nim-admin__sidebar", children: [
          n || i ? /* @__PURE__ */ e("div", { className: "nim-admin__brand", children: n }) : null,
          b,
          h ? /* @__PURE__ */ e("div", { className: "nim-admin__sidebar-foot", children: h }) : null,
          i ? /* @__PURE__ */ r(
            "button",
            {
              "aria-label": D ? p.expand : p.collapse,
              "aria-expanded": !D,
              className: "nim-admin__rail-toggle",
              onClick: () => I((C) => !C),
              type: "button",
              children: [
                /* @__PURE__ */ e(T, { name: D ? "chevron-forward" : "chevron-back", size: "sm" }),
                /* @__PURE__ */ e("span", { children: D ? p.expand : p.collapse })
              ]
            }
          ) : null
        ] }) : null,
        /* @__PURE__ */ r("div", { className: "nim-admin__drawer", hidden: !w, children: [
          /* @__PURE__ */ e("div", { className: "nim-admin__scrim", onClick: () => y(!1) }),
          /* @__PURE__ */ r("div", { className: "nim-admin__drawer-panel", children: [
            /* @__PURE__ */ r("div", { className: "nim-admin__drawer-head", children: [
              n,
              /* @__PURE__ */ e(U, { label: p.close, name: "close", onClick: () => y(!1), size: "sm" })
            ] }),
            b
          ] })
        ] }),
        /* @__PURE__ */ r("div", { className: "nim-admin__workspace", children: [
          /* @__PURE__ */ r("header", { className: "nim-admin__topbar", children: [
            /* @__PURE__ */ e(
              U,
              {
                "aria-expanded": w,
                className: "nim-admin__menu",
                label: p.menu,
                name: "menu",
                onClick: () => y(!0),
                size: "sm"
              }
            ),
            u === "sections" && n ? /* @__PURE__ */ e("div", { className: "nim-admin__masthead-brand", children: n }) : null,
            f ? /* @__PURE__ */ e(k, { className: "nim-admin__title", children: f }) : null,
            _ ? /* @__PURE__ */ e("div", { className: "nim-admin__toolbar", children: _ }) : null
          ] }),
          u === "sections" ? /* @__PURE__ */ e("div", { className: "nim-admin__sections", children: b }) : null,
          S ? /* @__PURE__ */ r("div", { className: "nim-admin__context-layout", children: [
            /* @__PURE__ */ r("aside", { className: "nim-admin__context", children: [
              c ? /* @__PURE__ */ e("div", { className: "nim-admin__context-head", children: c }) : null,
              /* @__PURE__ */ e("div", { className: "nim-admin__context-nav", children: S }),
              t ? /* @__PURE__ */ e("div", { className: "nim-admin__context-foot", children: t }) : null
            ] }),
            /* @__PURE__ */ e("main", { className: "nim-admin__main", children: l })
          ] }) : /* @__PURE__ */ e("main", { className: "nim-admin__main", children: l })
        ] })
      ]
    }
  );
}
function rl({
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
      /* @__PURE__ */ e(T, { name: "chevron-back", size: "sm" }),
      l.label
    ] }) : /* @__PURE__ */ r("button", { className: "nim-detail-header__back", onClick: l.onClick, type: "button", children: [
      /* @__PURE__ */ e(T, { name: "chevron-back", size: "sm" }),
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
function cl({
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
        c.value !== void 0 ? /* @__PURE__ */ r(K, { children: [
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
          children: /* @__PURE__ */ e(T, { name: "close", size: "xs" })
        }
      )
    ] }, c.key)),
    t && a ? /* @__PURE__ */ e("button", { className: "nim-filter-chips__clear", onClick: t, type: "button", children: a }) : null
  ] });
}
function ol({ className: n, empty: l, events: a, locale: i }) {
  const t = new Intl.DateTimeFormat(i, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
  return a.length === 0 ? /* @__PURE__ */ e("div", { className: v("nim-activity", n), children: l }) : /* @__PURE__ */ e("ol", { className: v("nim-activity", n), children: a.map((s) => /* @__PURE__ */ r("li", { className: "nim-activity__item", "data-tone": s.tone, children: [
    /* @__PURE__ */ e("span", { className: "nim-activity__marker", children: s.icon ? /* @__PURE__ */ e(T, { name: s.icon, size: "xs" }) : null }),
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
function dl({ children: n, className: l, width: a = "wide", ...i }) {
  return /* @__PURE__ */ e("div", { className: v("nim-page", l), "data-width": a, ...i, children: n });
}
function ml({
  actions: n,
  caption: l,
  children: a,
  className: i,
  description: t,
  eyebrow: s,
  flush: c = !1,
  footer: o,
  marker: d,
  title: m,
  ...u
}) {
  const h = m || l || t || s || n;
  return /* @__PURE__ */ r("section", { className: v("nim-panel", i), ...u, children: [
    h ? /* @__PURE__ */ r("header", { className: "nim-panel__head", children: [
      d ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-panel__marker", children: d }) : null,
      /* @__PURE__ */ r("div", { className: "nim-panel__heading", children: [
        s ? /* @__PURE__ */ e("p", { className: "nim-panel__eyebrow", children: s }) : null,
        m ? /* @__PURE__ */ r("div", { className: "nim-panel__title-row", children: [
          /* @__PURE__ */ e("h2", { className: "nim-panel__title", children: m }),
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
function ul({ actions: n, children: l, className: a, ...i }) {
  return /* @__PURE__ */ r("div", { className: v("nim-toolbar", a), role: "toolbar", ...i, children: [
    l ? /* @__PURE__ */ e("div", { className: "nim-toolbar__group", children: l }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-toolbar__actions", children: n }) : null
  ] });
}
function hl({
  className: n,
  delta: l,
  deltaDirection: a = "up",
  deltaIntent: i = "more-is-better",
  hint: t,
  source: s,
  unmeasured: c,
  icon: o,
  label: d,
  layout: m = "stacked",
  onClick: u,
  tone: h = "neutral",
  value: f,
  ..._
}) {
  const N = i === "more-is-better" ? a === "up" : a === "down";
  return /* @__PURE__ */ r(
    u ? "button" : "div",
    {
      className: v("nim-metric", u && "nim-metric--interactive", n),
      "data-layout": m === "stacked" ? void 0 : m,
      "data-tone": h === "neutral" ? void 0 : h,
      "data-unmeasured": c ? "true" : void 0,
      onClick: u,
      type: u ? "button" : void 0,
      ..._,
      children: [
        m === "inline" && o ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-metric__glyph", children: /* @__PURE__ */ e(T, { name: o, size: "sm" }) }) : null,
        /* @__PURE__ */ r("span", { className: "nim-metric__label", children: [
          m === "inline" ? null : o ? /* @__PURE__ */ e(T, { name: o, size: "xs" }) : null,
          d
        ] }),
        /* @__PURE__ */ e("span", { className: "nim-metric__value", children: f }),
        l || t ? /* @__PURE__ */ r("span", { className: "nim-metric__foot", children: [
          l ? /* @__PURE__ */ r("span", { className: "nim-metric__delta", "data-intent": N ? "good" : "bad", children: [
            /* @__PURE__ */ e(T, { name: a === "up" ? "trend-up" : "trend-down", size: "xs" }),
            l
          ] }) : null,
          t ? /* @__PURE__ */ e("span", { className: "nim-metric__hint", children: t }) : null,
          s ? /* @__PURE__ */ e("span", { className: "nim-metric__source", children: s }) : null
        ] }) : null
      ]
    }
  );
}
function _l({ children: n, className: l, columns: a = 4, dense: i = !1, ...t }) {
  return /* @__PURE__ */ e(
    "div",
    {
      className: v("nim-metric-grid", l),
      "data-columns": a,
      "data-dense": i ? "true" : void 0,
      ...t,
      children: n
    }
  );
}
function pl({ className: n, columns: l = 2, items: a, ...i }) {
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
        /* @__PURE__ */ e("dd", { className: "nim-facts__value", "data-mono": t.mono ? "true" : void 0, children: t.value })
      ]
    },
    t.key ?? s
  )) });
}
function fl({ align: n = "stretch", children: l, className: a, template: i = "halves", ...t }) {
  return /* @__PURE__ */ e("div", { className: v("nim-columns", a), "data-align": n === "start" ? "start" : void 0, "data-template": i, ...t, children: l });
}
function Nl({ actions: n, className: l, description: a, icon: i, title: t, tone: s = "neutral", ...c }) {
  return /* @__PURE__ */ r("section", { className: v("nim-status-hero", l), "data-tone": s, ...c, children: [
    /* @__PURE__ */ e("span", { className: "nim-status-hero__mark", children: /* @__PURE__ */ e(T, { name: i, size: "xl" }) }),
    /* @__PURE__ */ r("div", { className: "nim-status-hero__copy", children: [
      /* @__PURE__ */ e("strong", { className: "nim-status-hero__title", children: t }),
      a ? /* @__PURE__ */ e("p", { className: "nim-status-hero__description", children: a }) : null
    ] }),
    n ? /* @__PURE__ */ e("div", { className: "nim-status-hero__actions", children: n }) : null
  ] });
}
function vl({
  children: n,
  className: l,
  copiedLabel: a = "Copied",
  copyLabel: i = "Copy",
  label: t,
  wrap: s = !1,
  ...c
}) {
  const [o, d] = E(!1), m = typeof navigator < "u" && !!navigator.clipboard, u = Z(() => {
    navigator.clipboard.writeText(n).then(() => {
      d(!0), window.setTimeout(() => d(!1), 1600);
    });
  }, [n]);
  return /* @__PURE__ */ r("figure", { className: v("nim-code", l), children: [
    t || m ? /* @__PURE__ */ r("figcaption", { className: "nim-code__head", children: [
      t ? /* @__PURE__ */ e("span", { className: "nim-code__label", children: t }) : /* @__PURE__ */ e("span", {}),
      m ? /* @__PURE__ */ r("button", { className: "nim-code__copy", onClick: u, type: "button", children: [
        /* @__PURE__ */ e(T, { name: o ? "check" : "copy", size: "xs" }),
        o ? a : i
      ] }) : null
    ] }) : null,
    /* @__PURE__ */ e("pre", { className: "nim-code__body", "data-wrap": s ? "true" : void 0, tabIndex: 0, ...c, children: n })
  ] });
}
function bl({ children: n, className: l, pulse: a = !1, tone: i = "neutral", ...t }) {
  return /* @__PURE__ */ r("span", { className: v("nim-status", l), "data-tone": i, ...t, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-status__dot", "data-pulse": a ? "true" : void 0 }),
    n
  ] });
}
function gl({ children: n, className: l, size: a = "sm", ...i }) {
  return /* @__PURE__ */ e("code", { className: v("nim-mono", l), "data-size": a, ...i, children: n });
}
function yl({ className: n, href: l, meta: a, onClick: i, title: t }) {
  const s = /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ e("strong", { className: "nim-record__title", children: t }),
    a ? /* @__PURE__ */ e("span", { className: "nim-record__meta", children: a }) : null
  ] });
  return l ? /* @__PURE__ */ e("a", { className: v("nim-record", n), href: l, children: s }) : i ? /* @__PURE__ */ e("button", { className: v("nim-record", n), onClick: i, type: "button", children: s }) : /* @__PURE__ */ e("span", { className: v("nim-record", n), children: s });
}
function kl({ actions: n, children: l, className: a, footer: i, title: t, ...s }) {
  return /* @__PURE__ */ r("section", { className: v("nim-rail", a), ...s, children: [
    /* @__PURE__ */ r("header", { className: "nim-rail__head", children: [
      /* @__PURE__ */ e("h2", { className: "nim-rail__title", children: t }),
      n ? /* @__PURE__ */ e("div", { className: "nim-rail__actions", children: n }) : null
    ] }),
    /* @__PURE__ */ e("div", { className: "nim-rail__body", children: l }),
    i ? /* @__PURE__ */ e("div", { className: "nim-rail__foot", children: i }) : null
  ] });
}
function wl({ children: n, className: l, meta: a, title: i, tone: t = "neutral", ...s }) {
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
function Cl({
  children: n,
  className: l,
  copiedLabel: a = "Copied",
  copyLabel: i = "Copy",
  ...t
}) {
  const [s, c] = E(!1), o = typeof navigator < "u" && !!navigator.clipboard, d = Z(() => {
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
        children: /* @__PURE__ */ e(T, { name: s ? "check" : "copy", size: "xs" })
      }
    ) : null
  ] });
}
function xl({ aside: n, children: l, className: a, ...i }) {
  return /* @__PURE__ */ r("div", { className: v("nim-detail", a), ...i, children: [
    /* @__PURE__ */ e("div", { className: "nim-detail__main", children: l }),
    n ? /* @__PURE__ */ e("aside", { className: "nim-detail__aside", children: n }) : null
  ] });
}
function Ml({
  className: n,
  href: l,
  mark: a,
  name: i,
  nameAccent: t,
  size: s = "md",
  tagline: c,
  ...o
}) {
  const d = /* @__PURE__ */ r(K, { children: [
    a ? /* @__PURE__ */ e("span", { className: "nim-brand__mark", children: a }) : null,
    /* @__PURE__ */ r("span", { className: "nim-brand__text", children: [
      /* @__PURE__ */ r("strong", { className: "nim-brand__name", children: [
        i,
        t ? /* @__PURE__ */ e("span", { className: "nim-brand__name-accent", children: t }) : null
      ] }),
      c ? /* @__PURE__ */ e("small", { className: "nim-brand__tagline", children: c }) : null
    ] })
  ] }), m = v("nim-brand", n);
  return l ? /* @__PURE__ */ e("a", { className: m, "data-size": s, href: l, ...o, children: d }) : /* @__PURE__ */ e("span", { className: m, "data-size": s, ...o, children: d });
}
const $a = {
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
}, Ea = {
  gitea: /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ e("path", { d: "M7 4h7a6 6 0 0 1 0 12h-2" }),
    /* @__PURE__ */ e("circle", { cx: "7", cy: "8", r: "3" }),
    /* @__PURE__ */ e("path", { d: "M12 16v4" })
  ] }),
  github: /* @__PURE__ */ e("path", { d: "M12 2.6a9.4 9.4 0 0 0-3 18.3c.5.1.6-.2.6-.5v-1.7c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.8.8.1-.6.3-1.1.6-1.3-2.1-.2-4.3-1-4.3-4.6 0-1 .4-1.9 1-2.5-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.6.6.6 1 1.5 1 2.5 0 3.6-2.2 4.4-4.3 4.6.3.3.6.9.6 1.8v2.7c0 .3.2.6.7.5A9.4 9.4 0 0 0 12 2.6Z" }),
  gitlab: /* @__PURE__ */ e("path", { d: "m12 21-3.5-10.8H3.3L12 21l8.7-10.8h-5.2L12 21ZM8.5 10.2 6.6 4l-3.3 6.2h5.2Zm7 0L17.4 4l3.3 6.2h-5.2Z" }),
  grafana: /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ e("circle", { cx: "12", cy: "13", r: "5" }),
    /* @__PURE__ */ e("path", { d: "M12 4v4M6 6l2 3M18 6l-2 3" })
  ] }),
  jaeger: /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ e("circle", { cx: "12", cy: "12", r: "8" }),
    /* @__PURE__ */ e("circle", { cx: "12", cy: "12", r: "3" })
  ] }),
  loki: /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ e("path", { d: "M12 3 5 9v9h14V9l-7-6Z" }),
    /* @__PURE__ */ e("path", { d: "M9 18v-5h6v5" })
  ] }),
  mongodb: /* @__PURE__ */ e("path", { d: "M12 2.5c2.6 3.2 5 6 5 10 0 3.4-2.2 6.2-4.3 7.1L12 22l-.7-2.4C9.2 18.7 7 15.9 7 12.5c0-4 2.4-6.8 5-10Z" }),
  postgresql: /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ e("ellipse", { cx: "12", cy: "7", rx: "7", ry: "3.2" }),
    /* @__PURE__ */ e("path", { d: "M5 7v9c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2V7" }),
    /* @__PURE__ */ e("path", { d: "M5 12c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2" })
  ] }),
  prometheus: /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ e("path", { d: "M12 2c2.6 2.8 3.6 5 2.6 7.4C13.8 11.2 12 11.8 12 14" }),
    /* @__PURE__ */ e("circle", { cx: "12", cy: "14", r: "7" }),
    /* @__PURE__ */ e("path", { d: "M8 12h8" })
  ] }),
  redis: /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ e("path", { d: "m12 3 9 4-9 4-9-4 9-4Z" }),
    /* @__PURE__ */ e("path", { d: "m3 12 9 4 9-4M3 17l9 4 9-4" })
  ] }),
  valkey: /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ e("path", { d: "m12 3 9 4-9 4-9-4 9-4Z" }),
    /* @__PURE__ */ e("path", { d: "m3 12 9 4 9-4" })
  ] })
}, Ia = /* @__PURE__ */ new Set(["github", "gitlab", "mongodb"]), Ba = { lg: 32, md: 24, sm: 20 };
function Tl({ className: n, label: l, name: a, size: i = "md", ...t }) {
  const s = Ia.has(a), c = Ba[i];
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
      style: { color: $a[a] },
      viewBox: "0 0 24 24",
      width: c,
      ...t,
      children: Ea[a]
    }
  );
}
function Sl(n) {
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
const X = Ue(function({
  children: l,
  className: a,
  fullWidth: i = !1,
  iconEnd: t,
  iconStart: s,
  size: c = "md",
  variant: o = "primary",
  ...d
}, m) {
  const u = v(
    "nim-button",
    `nim-button--${o}`,
    `nim-button--${c}`,
    i && "nim-button--full",
    a
  ), h = /* @__PURE__ */ r(K, { children: [
    s ? /* @__PURE__ */ e(T, { name: s, size: "sm" }) : null,
    /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
    t ? /* @__PURE__ */ e(T, { name: t, size: "sm" }) : null
  ] });
  if ("href" in d && d.href !== void 0) {
    const { href: p, rel: w, target: y, ...D } = d;
    return /* @__PURE__ */ e(
      "a",
      {
        className: u,
        href: p,
        ref: m,
        rel: y === "_blank" ? w ?? "noreferrer" : w,
        target: y,
        ...D,
        children: h
      }
    );
  }
  const {
    disabled: f = !1,
    loading: _ = !1,
    type: N = "button",
    ...g
  } = d;
  return /* @__PURE__ */ r(
    "button",
    {
      "aria-busy": _ || void 0,
      className: v(u, _ && "nim-button--loading"),
      disabled: f || _,
      ref: m,
      type: N,
      ...g,
      children: [
        _ ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-button__spinner" }) : null,
        _ ? /* @__PURE__ */ r(K, { children: [
          /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
          t ? /* @__PURE__ */ e(T, { name: t, size: "sm" }) : null
        ] }) : h
      ]
    }
  );
});
function Pa({
  actions: n,
  className: l,
  description: a,
  icon: i = "search",
  reason: t = "empty",
  title: s,
  ...c
}) {
  return /* @__PURE__ */ r("div", { className: v("nim-empty", l), "data-reason": t === "empty" ? void 0 : t, ...c, children: [
    /* @__PURE__ */ e("span", { className: "nim-empty__icon", children: /* @__PURE__ */ e(T, { name: i, size: "md" }) }),
    /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: s }),
    a ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-empty__body", children: a }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-empty__actions", children: n }) : null
  ] });
}
const Fa = (n, l) => {
  if (l <= 7) return Array.from({ length: l }, (t, s) => s + 1);
  const a = /* @__PURE__ */ new Set([1, l, n, n - 1, n + 1]);
  n <= 3 && [2, 3, 4].forEach((t) => a.add(t)), n >= l - 2 && [l - 3, l - 2, l - 1].forEach((t) => a.add(t));
  const i = [...a].filter((t) => t >= 1 && t <= l).sort((t, s) => t - s);
  return i.flatMap((t, s) => s > 0 && t - i[s - 1] > 1 ? ["gap", t] : [t]);
};
function Ra({
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
          children: /* @__PURE__ */ e(T, { name: "chevron-back", size: "sm" })
        }
      ),
      Fa(t, s).map(
        (d, m) => d === "gap" ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-pagination__ellipsis", children: "…" }, `gap-${m}`) : /* @__PURE__ */ e(
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
          children: /* @__PURE__ */ e(T, { name: "chevron-forward", size: "sm" })
        }
      )
    ] })
  ] });
}
function De({ caption: n, className: l, columns: a, onSort: i, rowKey: t, rows: s, sort: c }) {
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
            d ? /* @__PURE__ */ e(T, { name: d === "ascending" ? "chevron-up" : "chevron-down", size: "xs" }) : null
          ] }) : o.header
        },
        o.key
      );
    }) }) }),
    /* @__PURE__ */ e("tbody", { children: s.map((o) => /* @__PURE__ */ e("tr", { children: a.map((d) => /* @__PURE__ */ e("td", { className: v(d.numeric && "nim-table__cell--numeric"), children: d.render(o) }, d.key)) }, t(o))) })
  ] }) });
}
function ze({ children: n, className: l, description: a, ...i }) {
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--checkbox", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", type: "checkbox", ...i }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-checkbox__box", children: /* @__PURE__ */ e(T, { name: "check", size: "xs" }) }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      a ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: a }) : null
    ] })
  ] });
}
function Oa({ children: n, className: l, description: a, ...i }) {
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--switch", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", role: "switch", type: "checkbox", ...i }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-switch__track", children: /* @__PURE__ */ e("span", { className: "nim-switch__thumb" }) }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      a ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: a }) : null
    ] })
  ] });
}
function Dl({ children: n, className: l, description: a, ...i }) {
  const t = Me(He);
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
const He = xe(null);
function zl({
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
  const m = J(), u = c ?? `nim-radio-${m}`, h = i ? `${u}-hint` : void 0, f = a ? `${u}-error` : void 0;
  return /* @__PURE__ */ e(He.Provider, { value: { name: u, onChange: o, value: d }, children: /* @__PURE__ */ r(
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
function Ge({ className: n, label: l = "Loading", size: a = "md", ...i }) {
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
function Ua({ className: n, label: l, value: a, ...i }) {
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
function Ka({ className: n, height: l = "1em", radius: a, width: i = "100%", ...t }) {
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
const Ha = (n) => Array.from({ length: n }, (l, a) => ({ __skeleton: a })), Ga = {
  selectAll: "Select all rows",
  selectRow: "Select row"
};
function Ll({
  caption: n,
  className: l,
  columns: a,
  empty: i,
  error: t,
  labels: s,
  loading: c = !1,
  onPageChange: o,
  onRetry: d,
  onSort: m,
  page: u,
  pageCount: h,
  refreshing: f = !1,
  retryLabel: _ = "Try again",
  rowKey: N,
  rows: g,
  selection: p,
  skeletonRows: w = 6,
  sort: y,
  summary: D,
  toolbar: I
}) {
  const k = { ...Ga, ...s }, x = g.length > 0 && p ? g.every((C) => p.isSelected(C)) : !1, b = p ? [
    {
      header: p.onToggleAll ? /* @__PURE__ */ e(
        ze,
        {
          "aria-label": k.selectAll,
          checked: x,
          onChange: (C) => {
            var $;
            return ($ = p.onToggleAll) == null ? void 0 : $.call(p, C.currentTarget.checked);
          }
        }
      ) : /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: k.selectAll }),
      key: "__select",
      render: (C) => {
        var $;
        return /* @__PURE__ */ e(
          ze,
          {
            "aria-label": (($ = p.label) == null ? void 0 : $.call(p, C)) ?? k.selectRow,
            checked: p.isSelected(C),
            onChange: (L) => p.onToggle(C, L.currentTarget.checked)
          }
        );
      },
      width: "2.5rem"
    },
    ...a
  ] : a;
  let S;
  return t ? S = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: /* @__PURE__ */ e(
    Pa,
    {
      actions: d ? /* @__PURE__ */ e(X, { onClick: d, size: "sm", variant: "secondary", children: _ }) : void 0,
      icon: "danger",
      title: t
    }
  ) }) : c ? S = /* @__PURE__ */ e(
    De,
    {
      caption: n,
      columns: b.map((C) => ({
        ...C,
        render: () => /* @__PURE__ */ e(Ka, { height: "0.9em", width: C.numeric ? "3rem" : "70%" }),
        sortable: !1
      })),
      rowKey: (C) => `skeleton-${C.__skeleton}`,
      rows: Ha(w)
    }
  ) : g.length === 0 ? S = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: i }) : S = /* @__PURE__ */ e(
    De,
    {
      caption: n,
      columns: b,
      onSort: m,
      rowKey: N,
      rows: g,
      sort: y
    }
  ), /* @__PURE__ */ r("div", { className: v("nim-data-table", l), "data-refreshing": f ? "true" : void 0, children: [
    I,
    /* @__PURE__ */ r("div", { className: "nim-data-table__body", children: [
      S,
      f ? /* @__PURE__ */ e("span", { className: "nim-data-table__pulse", children: /* @__PURE__ */ e(T, { name: "loading", size: "xs" }) }) : null
    ] }),
    u && h && h > 1 && o ? /* @__PURE__ */ e(Ra, { onChange: o, page: u, pageCount: h, summary: D }) : D ? /* @__PURE__ */ e("p", { className: "nim-data-table__summary", children: D }) : null
  ] });
}
function Al({
  className: n,
  defaultOpen: l = [],
  items: a,
  mode: i = "multiple",
  onOpenChange: t,
  open: s,
  variant: c = "panel"
}) {
  const o = J(), [d, m] = E(l), u = s ?? d, h = (f) => {
    const _ = u.includes(f), N = i === "single" ? _ ? [] : [f] : _ ? u.filter((g) => g !== f) : [...u, f];
    s || m(N), t == null || t(N);
  };
  return /* @__PURE__ */ e("div", { className: v("nim-accordion", `nim-accordion--${c}`, n), children: a.map((f) => {
    const _ = u.includes(f.id), N = `${o}-${f.id}`;
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
            /* @__PURE__ */ e(T, { className: "nim-accordion__chevron", name: "chevron-down", size: "sm" })
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
function Wa({ className: n, items: l, label: a, renderItem: i, value: t }) {
  return /* @__PURE__ */ e("nav", { "aria-label": a, className: v("nim-tab-bar", n), children: /* @__PURE__ */ e("div", { className: "nim-tab-bar__row", style: { "--nim-tab-count": l.length }, children: l.map((s) => {
    const c = s.key === t, o = /* @__PURE__ */ r(K, { children: [
      /* @__PURE__ */ e(T, { name: s.icon, size: s.center ? "lg" : "md" }),
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
function $l({ children: n, className: l, frame: a = "responsive", header: i, tabs: t }) {
  return /* @__PURE__ */ r("div", { className: v("nim-app-shell", l), "data-frame": a === "phone" ? "phone" : void 0, children: [
    i ? /* @__PURE__ */ e("header", { className: "nim-app-shell__header", children: i }) : null,
    /* @__PURE__ */ e("main", { className: "nim-app-shell__content", "data-has-tabs": t ? "true" : void 0, children: n }),
    t ? /* @__PURE__ */ e(Wa, { ...t }) : null
  ] });
}
function ve({
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
      l ? /* @__PURE__ */ e(X, { className: "nim-auth__back", iconStart: "chevron-back", onClick: l.onClick, size: "sm", variant: "ghost", children: l.label }) : null,
      /* @__PURE__ */ e("h1", { className: "nim-auth__title", children: o }),
      c ? /* @__PURE__ */ e("p", { className: "nim-auth__subtitle", children: c }) : null,
      /* @__PURE__ */ e("div", { className: "nim-auth__fields", children: i })
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-auth__foot", children: [
      n ? /* @__PURE__ */ e(
        X,
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
const Za = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((l) => {
  var a;
  return ((a = l[0]) == null ? void 0 : a.toUpperCase()) ?? "";
}).join("");
function de({ className: n, name: l, shape: a = "round", size: i = "md", src: t, ...s }) {
  return /* @__PURE__ */ r(
    "span",
    {
      className: v("nim-avatar", i !== "md" && `nim-avatar--${i}`, a === "square" && "nim-avatar--square", n),
      ...s,
      children: [
        t ? /* @__PURE__ */ e("img", { alt: "", src: t }) : /* @__PURE__ */ e("span", { "aria-hidden": "true", children: Za(l) }),
        /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: l })
      ]
    }
  );
}
function El({
  caption: n,
  className: l,
  initials: a,
  label: i,
  size: t = 96,
  src: s,
  value: c
}) {
  const o = Math.max(4, Math.round(t * 0.05)), d = (t - o) / 2, m = 2 * Math.PI * d, u = Math.min(100, Math.max(0, c)) / 100 * m;
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
              strokeDasharray: `${u} ${m}`,
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
function Ya({
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
function ja({
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
const Va = {
  accent: "sparkle",
  danger: "danger",
  info: "info",
  neutral: "info",
  success: "check-circle",
  warning: "alert"
};
function qa({
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
        /* @__PURE__ */ e(T, { className: "nim-banner__icon", name: i ?? Va[s], size: "sm" }),
        /* @__PURE__ */ r("div", { className: "nim-banner__content", children: [
          t ? /* @__PURE__ */ e("p", { className: "nim-banner__title", children: t }) : null,
          /* @__PURE__ */ e("div", { children: l })
        ] }),
        n ? /* @__PURE__ */ e("div", { className: "nim-banner__action", children: n }) : null
      ]
    }
  );
}
function Il({ className: n, items: l, label: a = "Breadcrumb" }) {
  return /* @__PURE__ */ e("nav", { "aria-label": a, className: v("nim-breadcrumb", n), children: l.map((i, t) => {
    const s = t === l.length - 1;
    return /* @__PURE__ */ r(we, { children: [
      t > 0 ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-breadcrumb__separator", children: /* @__PURE__ */ e(T, { name: "chevron-forward", size: "xs" }) }) : null,
      s || !i.href ? /* @__PURE__ */ e("span", { "aria-current": s ? "page" : void 0, className: "nim-breadcrumb__current", children: i.label }) : /* @__PURE__ */ e("a", { className: "nim-breadcrumb__link", href: i.href, children: i.label })
    ] }, i.label);
  }) });
}
function Bl({
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
function Pl({
  badge: n,
  className: l,
  description: a,
  detail: i,
  disabled: t = !1,
  icon: s,
  name: c,
  onSelect: o,
  selected: d,
  title: m
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
    s ? /* @__PURE__ */ e("span", { className: "nim-option-card__icon", children: /* @__PURE__ */ e(T, { name: s, size: "md" }) }) : null,
    /* @__PURE__ */ r("span", { className: "nim-option-card__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-option-card__title", children: m }),
      a ? /* @__PURE__ */ e("span", { className: "nim-option-card__description", children: a }) : null,
      d && i ? /* @__PURE__ */ e("span", { className: "nim-option-card__detail", children: i }) : null
    ] }),
    n ? /* @__PURE__ */ e("span", { className: "nim-option-card__badge", children: n }) : null,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-option-card__dot" })
  ] });
}
function Fl({ className: n, items: l, title: a, totals: i = [] }) {
  return /* @__PURE__ */ r("section", { className: v("nim-summary", n), children: [
    a ? /* @__PURE__ */ e("h2", { className: "nim-summary__title", children: a }) : null,
    /* @__PURE__ */ e("dl", { className: "nim-summary__lines", children: l.map((t) => /* @__PURE__ */ r("div", { className: "nim-summary__line", children: [
      /* @__PURE__ */ r("dt", { children: [
        /* @__PURE__ */ e("span", { className: "nim-summary__label", children: t.label }),
        t.meta ? /* @__PURE__ */ e("span", { className: "nim-summary__meta", children: t.meta }) : null
      ] }),
      /* @__PURE__ */ e("dd", { className: "nim-summary__value", children: t.value })
    ] }, t.key)) }),
    i.length ? /* @__PURE__ */ r(K, { children: [
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
function Rl({ action: n, className: l, note: a, total: i }) {
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
function We(n, l, { onDismiss: a, open: i }) {
  const [t, s] = E({ left: 0, top: 0 }), c = O(null), o = Z(() => {
    const d = n.current, m = l.current;
    if (!d || !m) return;
    const u = d.getBoundingClientRect(), { height: h, width: f } = m.getBoundingClientRect(), _ = 4, N = 8, g = getComputedStyle(d).direction === "rtl", p = u.bottom + _, y = p + h > window.innerHeight && u.top - _ - h > 0 ? u.top - _ - h : p, D = g ? u.right - f : u.left, I = Math.min(Math.max(D, N), window.innerWidth - f - N);
    s({ left: I, top: y });
  }, [l, n]);
  return ln(() => {
    i && o();
  }, [i, o]), j(() => {
    if (!i) return;
    c.current = document.activeElement;
    const d = (u) => {
      u.key === "Escape" && (u.stopPropagation(), a());
    }, m = (u) => {
      var f, _;
      const h = u.target;
      (f = l.current) != null && f.contains(h) || (_ = n.current) != null && _.contains(h) || a();
    };
    return window.addEventListener("keydown", d), window.addEventListener("pointerdown", m), window.addEventListener("resize", o), window.addEventListener("scroll", o, !0), () => {
      var u, h;
      window.removeEventListener("keydown", d), window.removeEventListener("pointerdown", m), window.removeEventListener("resize", o), window.removeEventListener("scroll", o, !0), (h = (u = c.current) == null ? void 0 : u.focus) == null || h.call(u);
    };
  }, [a, i, l, o, n]), t;
}
const Qa = (n) => n.kind === void 0 || n.kind === "action";
function Le({ children: n, className: l, items: a, label: i }) {
  const [t, s] = E(!1), [c, o] = E(0), d = O(null), m = O(null), u = We(d, m, { onDismiss: () => s(!1), open: t }), f = a.filter(Qa).filter((p) => !p.disabled), _ = () => {
    o(0), s((p) => !p);
  }, N = (p) => {
    s(!1), p.onSelect();
  }, g = (p) => {
    if (f.length !== 0) {
      if (p.key === "ArrowDown" || p.key === "ArrowUp") {
        p.preventDefault();
        const w = p.key === "ArrowDown" ? 1 : -1;
        o((y) => (y + w + f.length) % f.length);
      }
      if (p.key === "Home" && (p.preventDefault(), o(0)), p.key === "End" && (p.preventDefault(), o(f.length - 1)), p.key === "Enter" || p.key === " ") {
        p.preventDefault();
        const w = f[c];
        w && N(w);
      }
    }
  };
  return /* @__PURE__ */ r(K, { children: [
    n({ open: t, ref: d, toggle: _ }),
    t && typeof document < "u" ? he(
      /* @__PURE__ */ e(
        "div",
        {
          "aria-label": i,
          className: v("nim-menu", l),
          onKeyDown: g,
          ref: m,
          role: "menu",
          style: { insetBlockStart: u.top, insetInlineStart: u.left },
          tabIndex: -1,
          children: a.map((p, w) => p.kind === "separator" ? /* @__PURE__ */ e("hr", { className: "nim-menu__separator" }, `sep-${w}`) : p.kind === "heading" ? /* @__PURE__ */ e("p", { className: "nim-menu__label", children: p.label }, `head-${w}`) : /* @__PURE__ */ r(
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
                p.icon ? /* @__PURE__ */ e(T, { className: "nim-menu__icon", name: p.icon, size: "sm" }) : null,
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
function Xa({ children: n, className: l, label: a, onClose: i, open: t, triggerRef: s }) {
  const c = O(null), o = We(s, c, { onDismiss: i, open: t });
  return !t || typeof document > "u" ? null : he(
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
const Ja = {
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
}, ei = ["👍", "❤️", "😂", "😮", "😢", "🙏"], Ae = 1024, ni = 864e5;
function ai(n, l) {
  const a = ["B", "KB", "MB", "GB"];
  let i = n, t = 0;
  for (; i >= Ae && t < a.length - 1; )
    i /= Ae, t += 1;
  return `${new Intl.NumberFormat(l, { maximumFractionDigits: t === 0 ? 0 : 1 }).format(i)} ${a[t]}`;
}
function Ze(n, l) {
  const a = new Intl.NumberFormat(l, { minimumIntegerDigits: 2, useGrouping: !1 }), i = Math.max(0, Math.round(n));
  return `${new Intl.NumberFormat(l).format(Math.floor(i / 60))}:${a.format(i % 60)}`;
}
const ce = (n) => {
  const l = new Date(n);
  return new Date(l.getFullYear(), l.getMonth(), l.getDate()).getTime();
};
function ii({
  attachment: n,
  labels: l,
  locale: a
}) {
  const i = O(null), [t, s] = E(!1), [c, o] = E(0), d = n.duration ?? 0, m = Y(
    () => n.waveform ?? Array.from({ length: 32 }, (h, f) => 0.35 + f * 7 % 11 / 18),
    [n.waveform]
  ), u = d > 0 ? Math.min(1, c / d) : 0;
  return /* @__PURE__ */ r("div", { className: "nim-chat-voice", children: [
    /* @__PURE__ */ e(
      U,
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
        children: m.map((h, f) => /* @__PURE__ */ e(
          "span",
          {
            className: "nim-chat-voice__bar",
            "data-played": f / m.length <= u ? "true" : void 0,
            style: { blockSize: `${Math.round(h * 100)}%` }
          },
          f
        ))
      }
    ),
    /* @__PURE__ */ e("span", { className: "nim-chat-voice__time", children: Ze(t || c ? Math.max(0, d - c) : d, a) }),
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
function li({
  attachment: n,
  labels: l,
  locale: a
}) {
  return n.kind === "voice" ? /* @__PURE__ */ e(ii, { attachment: n, labels: l, locale: a }) : n.kind === "video" ? /* @__PURE__ */ r("figure", { className: "nim-chat-media", children: [
    /* @__PURE__ */ e("video", { controls: !0, playsInline: !0, poster: n.poster, preload: "metadata", src: n.url }),
    n.duration ? /* @__PURE__ */ e("figcaption", { className: "nim-chat-media__meta", children: Ze(n.duration, a) }) : null
  ] }) : n.kind === "image" ? /* @__PURE__ */ e("figure", { className: "nim-chat-media", children: /* @__PURE__ */ e("img", { alt: n.name ?? "", loading: "lazy", src: n.url }) }) : /* @__PURE__ */ r(
    "a",
    {
      className: "nim-chat-file",
      download: n.name,
      href: n.url,
      rel: "noreferrer",
      target: "_blank",
      children: [
        /* @__PURE__ */ e("span", { className: "nim-chat-file__icon", children: /* @__PURE__ */ e(T, { name: "document", size: "md" }) }),
        /* @__PURE__ */ r("span", { className: "nim-chat-file__text", children: [
          /* @__PURE__ */ e("span", { className: "nim-chat-file__name", children: n.name ?? l.download }),
          n.size !== void 0 ? /* @__PURE__ */ e("span", { className: "nim-chat-file__size", children: ai(n.size, a) }) : null
        ] }),
        /* @__PURE__ */ e(T, { className: "nim-chat-file__action", name: "download", size: "sm" })
      ]
    }
  );
}
function ti({
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
function Ol({
  actions: n,
  className: l,
  composer: a,
  footer: i,
  group: t = !1,
  header: s,
  labels: c,
  locale: o,
  messages: d,
  onJump: m,
  onReact: u,
  reactions: h = ei,
  runGap: f = 300,
  typing: _
}) {
  const N = { ...Ja, ...c }, g = O(null), p = O(!0), w = Y(
    () => new Intl.DateTimeFormat(o, { hour: "2-digit", minute: "2-digit" }),
    [o]
  ), y = Y(
    () => new Intl.DateTimeFormat(o, { day: "numeric", month: "long", weekday: "long" }),
    [o]
  ), D = Y(() => {
    const I = ce((/* @__PURE__ */ new Date()).toISOString());
    return d.map((k, x) => {
      const b = d[x - 1], S = d[x + 1], C = k.at ? ce(k.at) : null, $ = b != null && b.at ? ce(b.at) : null, L = C !== null && C !== $ ? C === I ? N.today : C === I - ni ? N.yesterday : y.format(new Date(k.at)) : null, A = (P, M) => {
        var F, W;
        return !!P && !(P != null && P.system) && !M.system && !!(P != null && P.own) == !!M.own && ((F = P == null ? void 0 : P.author) == null ? void 0 : F.name) === ((W = M.author) == null ? void 0 : W.name);
      }, B = (P, M) => !(P != null && P.at) || !M.at || Math.abs(new Date(M.at).getTime() - new Date(P.at).getTime()) <= f * 1e3, H = L !== null || !A(b, k) || !B(b, k), G = !S || (S.at ? ce(S.at) : null) !== C || !A(S, k) || !B(k, S);
      return { divider: L, first: H, last: G, message: k };
    });
  }, [y, d, f, N.today, N.yesterday]);
  return j(() => {
    const I = g.current;
    !I || !p.current || (I.scrollTop = I.scrollHeight);
  }, [d, _]), /* @__PURE__ */ r("section", { className: v("nim-chat", l), children: [
    s ? /* @__PURE__ */ e("header", { className: "nim-chat__header", children: s }) : null,
    /* @__PURE__ */ r(
      "div",
      {
        className: "nim-chat__scroll",
        onScroll: (I) => {
          const k = I.currentTarget;
          p.current = k.scrollHeight - k.scrollTop - k.clientHeight < 48;
        },
        ref: g,
        children: [
          /* @__PURE__ */ e("ol", { "aria-live": "polite", className: "nim-chat__list", children: D.map(({ divider: I, first: k, last: x, message: b }) => {
            var $, L;
            if (b.system)
              return /* @__PURE__ */ r(we, { children: [
                I ? /* @__PURE__ */ e("li", { className: "nim-chat__day", children: I }) : null,
                /* @__PURE__ */ e("li", { className: "nim-chat__system", children: b.text })
              ] }, b.id);
            const S = (n == null ? void 0 : n(b)) ?? [], C = k && !b.own && (t || !!b.author);
            return /* @__PURE__ */ r(we, { children: [
              I ? /* @__PURE__ */ e("li", { className: "nim-chat__day", children: I }) : null,
              /* @__PURE__ */ r(
                "li",
                {
                  className: v("nim-chat-message", b.own && "nim-chat-message--own"),
                  "data-first": k ? "true" : void 0,
                  "data-last": x ? "true" : void 0,
                  id: `nim-message-${b.id}`,
                  children: [
                    b.own ? null : /* @__PURE__ */ e("span", { className: "nim-chat-message__gutter", children: x && b.author ? /* @__PURE__ */ e(de, { name: b.author.name, size: "sm", src: b.author.avatar }) : null }),
                    /* @__PURE__ */ r("div", { className: "nim-chat-message__stack", children: [
                      C && b.author ? /* @__PURE__ */ e("span", { className: "nim-chat-message__author", children: b.author.name }) : null,
                      /* @__PURE__ */ r("div", { className: "nim-chat-message__row", children: [
                        /* @__PURE__ */ r("div", { className: "nim-chat-message__bubble", "data-deleted": b.deleted ? "true" : void 0, children: [
                          b.replyTo ? /* @__PURE__ */ r(
                            "button",
                            {
                              className: "nim-chat-quote",
                              disabled: !m,
                              onClick: () => m == null ? void 0 : m(b.replyTo.id),
                              type: "button",
                              children: [
                                /* @__PURE__ */ e("span", { className: "nim-chat-quote__author", children: b.replyTo.author }),
                                /* @__PURE__ */ e("span", { className: "nim-chat-quote__text", children: b.replyTo.text })
                              ]
                            }
                          ) : null,
                          b.deleted ? /* @__PURE__ */ r("p", { className: "nim-chat-message__text nim-chat-message__text--gone", children: [
                            /* @__PURE__ */ e(T, { name: "trash", size: "xs" }),
                            " ",
                            N.deleted
                          ] }) : /* @__PURE__ */ r(K, { children: [
                            ($ = b.attachments) == null ? void 0 : $.map((A, B) => /* @__PURE__ */ e(
                              li,
                              {
                                attachment: A,
                                labels: N,
                                locale: o
                              },
                              `${b.id}-${B}`
                            )),
                            b.card ? /* @__PURE__ */ e("div", { className: "nim-chat-card", children: b.card }) : null,
                            b.text ? /* @__PURE__ */ e("p", { className: "nim-chat-message__text", children: b.text }) : null
                          ] })
                        ] }),
                        !b.deleted && (S.length > 0 || u) ? /* @__PURE__ */ r("div", { className: "nim-chat-message__tools", children: [
                          u ? /* @__PURE__ */ e(
                            Le,
                            {
                              className: "nim-chat-picker",
                              items: h.map((A) => ({
                                label: A,
                                onSelect: () => u(b, A)
                              })),
                              label: N.react,
                              children: ({ ref: A, toggle: B }) => /* @__PURE__ */ e(
                                U,
                                {
                                  label: N.react,
                                  name: "emoji",
                                  onClick: B,
                                  ref: A,
                                  size: "sm"
                                }
                              )
                            }
                          ) : null,
                          S.length > 0 ? /* @__PURE__ */ e(Le, { items: S, label: N.more, children: ({ ref: A, toggle: B }) => /* @__PURE__ */ e(
                            U,
                            {
                              label: N.more,
                              name: "more",
                              onClick: B,
                              ref: A,
                              size: "sm"
                            }
                          ) }) : null
                        ] }) : null
                      ] }),
                      (L = b.reactions) != null && L.length ? /* @__PURE__ */ e(ti, { labels: N, message: b, onReact: u }) : null,
                      x ? /* @__PURE__ */ r("span", { className: "nim-chat-message__meta", children: [
                        b.at ? /* @__PURE__ */ e("time", { dateTime: b.at, children: w.format(new Date(b.at)) }) : null,
                        b.edited ? /* @__PURE__ */ e("span", { children: N.edited }) : null,
                        b.own && b.status ? /* @__PURE__ */ e("span", { className: "nim-chat-message__status", "data-status": b.status, children: b.status === "sending" ? /* @__PURE__ */ e(Ge, { size: "sm" }) : /* @__PURE__ */ e(
                          T,
                          {
                            label: N[b.status],
                            name: b.status === "failed" ? "danger" : "check-circle",
                            size: "xs"
                          }
                        ) }) : null
                      ] }) : null
                    ] })
                  ]
                }
              )
            ] }, b.id);
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
const si = {
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
function Ul({
  assistant: n,
  className: l,
  composer: a,
  empty: i,
  labels: t,
  onCopy: s,
  onRate: c,
  onRetry: o,
  onStop: d,
  turns: m
}) {
  const u = { ...si, ...t }, h = O(null), f = O(!0), [_, N] = E(null), g = m.some((p) => p.streaming);
  return j(() => {
    const p = h.current;
    !p || !f.current || (p.scrollTop = p.scrollHeight);
  }, [m]), /* @__PURE__ */ r("section", { className: v("nim-assistant", l), children: [
    /* @__PURE__ */ r(
      "div",
      {
        className: "nim-assistant__scroll",
        onScroll: (p) => {
          const w = p.currentTarget;
          f.current = w.scrollHeight - w.scrollTop - w.clientHeight < 48;
        },
        ref: h,
        children: [
          m.length === 0 && i ? /* @__PURE__ */ e("div", { className: "nim-assistant__empty", children: i }) : null,
          /* @__PURE__ */ e("ol", { "aria-live": "polite", className: "nim-assistant__list", children: m.map((p) => {
            var w, y;
            return /* @__PURE__ */ r("li", { className: "nim-turn", "data-role": p.role, children: [
              /* @__PURE__ */ e("span", { className: "nim-turn__mark", children: p.role === "assistant" ? /* @__PURE__ */ e("span", { className: "nim-turn__badge", children: /* @__PURE__ */ e(T, { name: (n == null ? void 0 : n.icon) ?? "sparkle", size: "sm" }) }) : null }),
              /* @__PURE__ */ r("div", { className: "nim-turn__body", children: [
                /* @__PURE__ */ e("span", { className: "nim-turn__who", children: p.role === "assistant" ? (n == null ? void 0 : n.name) ?? u.assistant : u.you }),
                (w = p.steps) != null && w.length ? /* @__PURE__ */ r("div", { className: "nim-turn__steps", children: [
                  /* @__PURE__ */ r(
                    "button",
                    {
                      "aria-expanded": _ === p.id,
                      className: "nim-turn__steps-toggle",
                      onClick: () => N(_ === p.id ? null : p.id),
                      type: "button",
                      children: [
                        /* @__PURE__ */ e(T, { name: _ === p.id ? "chevron-down" : "chevron-forward", size: "xs" }),
                        u.steps,
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
                      children: p.steps.map((D) => /* @__PURE__ */ r("li", { className: "nim-turn__step", "data-status": D.status, children: [
                        /* @__PURE__ */ e(
                          T,
                          {
                            name: D.status === "failed" ? "danger" : D.status === "running" ? "loading" : D.icon ?? "check",
                            size: "xs"
                          }
                        ),
                        /* @__PURE__ */ e("span", { children: D.label }),
                        D.detail ? /* @__PURE__ */ e("span", { className: "nim-turn__step-detail", children: D.detail }) : null
                      ] }, D.label))
                    }
                  )
                ] }) : null,
                /* @__PURE__ */ e("div", { className: "nim-turn__content", "data-streaming": p.streaming ? "true" : void 0, children: p.content }),
                (y = p.sources) != null && y.length ? /* @__PURE__ */ r("ul", { className: "nim-turn__sources", children: [
                  /* @__PURE__ */ e("li", { className: "nim-turn__sources-label", children: u.sources }),
                  p.sources.map((D, I) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r("a", { className: "nim-turn__source", href: D.href, rel: "noreferrer", target: "_blank", children: [
                    /* @__PURE__ */ e("span", { className: "nim-turn__source-index", children: I + 1 }),
                    D.title
                  ] }) }, I))
                ] }) : null,
                p.role === "assistant" && !p.streaming && (s || o || c) ? /* @__PURE__ */ r("div", { className: "nim-turn__actions", children: [
                  s ? /* @__PURE__ */ e(U, { label: u.copy, name: "copy", onClick: () => s(p), size: "sm" }) : null,
                  o ? /* @__PURE__ */ e(U, { label: u.retry, name: "refresh", onClick: () => o(p), size: "sm" }) : null,
                  c ? /* @__PURE__ */ r(K, { children: [
                    /* @__PURE__ */ e(U, { label: u.up, name: "trend-up", onClick: () => c(p, "up"), size: "sm" }),
                    /* @__PURE__ */ e(U, { label: u.down, name: "trend-down", onClick: () => c(p, "down"), size: "sm" })
                  ] }) : null
                ] }) : null
              ] })
            ] }, p.id);
          }) }),
          g && d ? /* @__PURE__ */ e("div", { className: "nim-assistant__stop", children: /* @__PURE__ */ r("button", { className: "nim-assistant__stop-button", onClick: d, type: "button", children: [
            /* @__PURE__ */ e(T, { name: "stop", size: "sm" }),
            u.stop
          ] }) }) : null
        ]
      }
    ),
    a ? /* @__PURE__ */ e("div", { className: "nim-assistant__composer", children: a }) : null
  ] });
}
const be = 600, $e = 8, ri = (n, l) => {
  const a = n / Math.max(1, l), i = 10 ** Math.floor(Math.log10(a || 1)), t = a / i;
  return (t > 5 ? 10 : t > 2 ? 5 : t > 1 ? 2 : 1) * i;
};
function Kl({
  categories: n,
  className: l,
  format: a,
  height: i = 220,
  kind: t = "line",
  legend: s,
  locale: c,
  max: o,
  min: d,
  note: m,
  series: u,
  title: h
}) {
  const f = J(), [_, N] = E(null), g = Y(
    () => a ?? ((b) => new Intl.NumberFormat(c).format(b)),
    [a, c]
  ), p = Y(() => {
    const b = u.flatMap((P) => P.values).filter((P) => P !== null), S = d ?? Math.min(...b, 0), C = o ?? Math.max(...b, 0), $ = t === "bar" ? Math.min(0, S) : S, L = C === $ ? $ + 1 : C, A = ri(L - $, 4), B = Math.floor($ / A) * A, H = Math.ceil(L / A) * A, G = [];
    for (let P = B; P <= H + A / 2; P += A) G.push(Number(P.toFixed(6)));
    return { bottom: B, ticks: G, top: H };
  }, [t, o, d, u]), w = i - $e * 2, y = (b) => $e + w - (b - p.bottom) / (p.top - p.bottom) * w, D = be / Math.max(1, n.length), I = (b) => D * b + D / 2, k = (b, S) => {
    let C = "", $ = !1;
    if (b.forEach((H, G) => {
      if (H === null) {
        $ = !1;
        return;
      }
      C += `${$ ? "L" : "M"}${I(G).toFixed(2)} ${y(H).toFixed(2)}`, $ = !0;
    }), !S || !C) return C;
    const L = b.map((H, G) => H === null ? null : G).filter((H) => H !== null), A = L[0], B = L[L.length - 1];
    return `${C}L${I(B).toFixed(2)} ${y(p.bottom).toFixed(2)}L${I(A).toFixed(2)} ${y(p.bottom).toFixed(2)}Z`;
  }, x = D * 0.62 / u.length;
  return /* @__PURE__ */ r(
    "figure",
    {
      "aria-labelledby": h ? f : void 0,
      className: v("nim-chart", l),
      "data-kind": t,
      children: [
        h || m ? /* @__PURE__ */ r("figcaption", { className: "nim-chart__head", children: [
          h ? /* @__PURE__ */ e("span", { className: "nim-chart__title", id: f, children: h }) : null,
          m ? /* @__PURE__ */ e("span", { className: "nim-chart__note", children: m }) : null
        ] }) : null,
        /* @__PURE__ */ r("div", { className: "nim-chart__frame", children: [
          /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-chart__axis", children: [...p.ticks].reverse().map((b) => /* @__PURE__ */ e("span", { className: "nim-chart__tick", children: g(b) }, b)) }),
          /* @__PURE__ */ r("div", { className: "nim-chart__plot", children: [
            /* @__PURE__ */ r(
              "svg",
              {
                "aria-hidden": "true",
                className: "nim-chart__svg",
                preserveAspectRatio: "none",
                style: { blockSize: `${i}px` },
                viewBox: `0 0 ${be} ${i}`,
                children: [
                  p.ticks.map((b) => /* @__PURE__ */ e(
                    "line",
                    {
                      className: "nim-chart__rule",
                      x1: 0,
                      x2: be,
                      y1: y(b),
                      y2: y(b)
                    },
                    b
                  )),
                  u.map((b, S) => {
                    const C = `var(--nim-series-${b.series ?? S % 6 + 1})`;
                    return t === "bar" ? /* @__PURE__ */ e("g", { children: b.values.map(
                      ($, L) => $ === null ? null : /* @__PURE__ */ e(
                        "rect",
                        {
                          className: "nim-chart__bar",
                          fill: C,
                          height: Math.abs(y($) - y(Math.max(p.bottom, 0))),
                          width: x,
                          x: I(L) - x * u.length / 2 + x * S,
                          y: Math.min(y($), y(Math.max(p.bottom, 0)))
                        },
                        L
                      )
                    ) }, b.label) : /* @__PURE__ */ r("g", { children: [
                      t === "area" ? /* @__PURE__ */ e("path", { className: "nim-chart__area", d: k(b.values, !0), fill: C }) : null,
                      /* @__PURE__ */ e("path", { className: "nim-chart__line", d: k(b.values, !1), stroke: C }),
                      b.values.map(
                        ($, L) => $ === null ? null : /* @__PURE__ */ e(
                          "circle",
                          {
                            className: "nim-chart__dot",
                            cx: I(L),
                            cy: y($),
                            "data-on": _ === L ? "true" : void 0,
                            fill: C,
                            r: 4
                          },
                          L
                        )
                      )
                    ] }, b.label);
                  })
                ]
              }
            ),
            /* @__PURE__ */ r("div", { className: "nim-chart__hits", children: [
              n.map((b, S) => /* @__PURE__ */ e(
                "button",
                {
                  className: "nim-chart__hit",
                  "data-on": _ === S ? "true" : void 0,
                  onBlur: () => N(null),
                  onFocus: () => N(S),
                  onMouseEnter: () => N(S),
                  onMouseLeave: () => N(null),
                  type: "button",
                  children: /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: b })
                },
                S
              )),
              _ !== null ? /* @__PURE__ */ r(
                "div",
                {
                  className: "nim-chart__tip",
                  style: { insetInlineStart: `${(_ + 0.5) / n.length * 100}%` },
                  children: [
                    /* @__PURE__ */ e("span", { className: "nim-chart__tip-label", children: n[_] }),
                    u.map((b, S) => /* @__PURE__ */ r("span", { className: "nim-chart__tip-row", children: [
                      /* @__PURE__ */ e("i", { style: { background: `var(--nim-series-${b.series ?? S % 6 + 1})` } }),
                      /* @__PURE__ */ e("span", { className: "nim-chart__tip-name", children: b.label }),
                      /* @__PURE__ */ e("span", { className: "nim-chart__tip-value", children: b.values[_] === null ? "—" : g(b.values[_]) })
                    ] }, b.label))
                  ]
                }
              ) : null
            ] }),
            /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-chart__categories", children: n.map((b, S) => /* @__PURE__ */ e("span", { className: "nim-chart__category", children: b }, S)) })
          ] })
        ] }),
        s ?? u.length > 1 ? /* @__PURE__ */ e("ul", { "aria-hidden": "true", className: "nim-chart__legend", children: u.map((b, S) => /* @__PURE__ */ r("li", { className: "nim-chart__key", children: [
          /* @__PURE__ */ e("i", { style: { background: `var(--nim-series-${b.series ?? S % 6 + 1})` } }),
          b.label
        ] }, b.label)) }) : null,
        /* @__PURE__ */ r("table", { className: "nim-visually-hidden", children: [
          h ? /* @__PURE__ */ e("caption", { children: h }) : null,
          /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ r("tr", { children: [
            /* @__PURE__ */ e("th", { scope: "col" }),
            u.map((b) => /* @__PURE__ */ e("th", { scope: "col", children: b.label }, b.label))
          ] }) }),
          /* @__PURE__ */ e("tbody", { children: n.map((b, S) => /* @__PURE__ */ r("tr", { children: [
            /* @__PURE__ */ e("th", { scope: "row", children: b }),
            u.map((C) => /* @__PURE__ */ e("td", { children: C.values[S] === null ? "—" : g(C.values[S]) }, C.label))
          ] }, S)) })
        ] })
      ]
    }
  );
}
function Hl({ className: n, label: l, series: a = 1, values: i }) {
  const t = Math.min(...i), c = Math.max(...i) - t || 1, o = i.map((d, m) => {
    const u = m / Math.max(1, i.length - 1) * 100, h = 24 - (d - t) / c * 20 - 2;
    return `${m === 0 ? "M" : "L"}${u.toFixed(2)} ${h.toFixed(2)}`;
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
const Ye = {
  back: "Back to conversations",
  channels: "Conversations",
  compose: "New conversation",
  members: "members",
  muted: "Muted",
  search: "Search conversations",
  unread: "unread"
}, ci = {
  channel: "hash",
  direct: "user",
  group: "users"
};
function oi(n, l) {
  const a = new Date(n), i = /* @__PURE__ */ new Date(), t = new Date(i.getFullYear(), i.getMonth(), i.getDate()).getTime();
  return a.getTime() >= t ? new Intl.DateTimeFormat(l, { hour: "2-digit", minute: "2-digit" }).format(a) : a.getTime() >= t - 6 * 864e5 ? new Intl.DateTimeFormat(l, { weekday: "short" }).format(a) : new Intl.DateTimeFormat(l, { day: "numeric", month: "short" }).format(a);
}
function di({
  activeId: n,
  className: l,
  labels: a,
  locale: i,
  onSelect: t,
  sections: s
}) {
  const c = { ...Ye, ...a }, o = new Intl.NumberFormat(i);
  return /* @__PURE__ */ e("div", { className: v("nim-rooms", l), children: s.map((d) => /* @__PURE__ */ r("section", { className: "nim-rooms__section", children: [
    /* @__PURE__ */ e("p", { className: "nim-rooms__label", children: d.label }),
    /* @__PURE__ */ e("ul", { className: "nim-rooms__list", children: d.items.map((m) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r(
      "button",
      {
        "aria-current": m.id === n ? "true" : void 0,
        className: "nim-room",
        "data-unread": m.unread ? "true" : void 0,
        onClick: () => t == null ? void 0 : t(m),
        type: "button",
        children: [
          /* @__PURE__ */ e("span", { className: "nim-room__face", children: m.kind === "channel" ? /* @__PURE__ */ e("span", { className: "nim-room__glyph", children: /* @__PURE__ */ e(T, { name: "hash", size: "sm" }) }) : /* @__PURE__ */ e(de, { name: m.name, size: "sm", src: m.avatar }) }),
          /* @__PURE__ */ r("span", { className: "nim-room__body", children: [
            /* @__PURE__ */ r("span", { className: "nim-room__top", children: [
              /* @__PURE__ */ r("span", { className: "nim-room__name", children: [
                m.name,
                m.muted ? /* @__PURE__ */ e(T, { className: "nim-room__mute", label: c.muted, name: "volume-off", size: "xs" }) : null
              ] }),
              m.at ? /* @__PURE__ */ e("span", { className: "nim-room__at", children: oi(m.at, i) }) : null
            ] }),
            /* @__PURE__ */ r("span", { className: "nim-room__bottom", children: [
              /* @__PURE__ */ e("span", { className: "nim-room__preview", "data-typing": m.typing ? "true" : void 0, children: m.typing ?? m.preview }),
              m.unread ? /* @__PURE__ */ r(ja, { size: "sm", tone: "solid", variant: m.muted ? "neutral" : "accent", children: [
                o.format(m.unread),
                /* @__PURE__ */ r("span", { className: "nim-visually-hidden", children: [
                  " ",
                  c.unread
                ] })
              ] }) : m.members ? /* @__PURE__ */ r("span", { className: "nim-room__members", children: [
                /* @__PURE__ */ e(T, { name: ci[m.kind], size: "xs" }),
                o.format(m.members)
              ] }) : null
            ] })
          ] })
        ]
      }
    ) }, m.id)) })
  ] }, d.key)) });
}
function Gl({
  activeId: n,
  brand: l,
  children: a,
  className: i,
  labels: t,
  locale: s,
  onBack: c,
  onCompose: o,
  onSelect: d,
  search: m,
  sections: u
}) {
  const h = { ...Ye, ...t };
  return /* @__PURE__ */ r("div", { className: v("nim-messenger", i), "data-open": n ? "true" : void 0, children: [
    /* @__PURE__ */ r("aside", { "aria-label": h.channels, className: "nim-messenger__rail", children: [
      /* @__PURE__ */ r("div", { className: "nim-messenger__rail-head", children: [
        l,
        o ? /* @__PURE__ */ e(U, { label: h.compose, name: "plus", onClick: o, size: "sm", variant: "outline" }) : null
      ] }),
      m ? /* @__PURE__ */ e("div", { className: "nim-messenger__search", children: m }) : null,
      /* @__PURE__ */ e("div", { className: "nim-messenger__rail-scroll", children: /* @__PURE__ */ e(
        di,
        {
          activeId: n,
          labels: t,
          locale: s,
          onSelect: d,
          sections: u
        }
      ) })
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-messenger__thread", children: [
      c ? /* @__PURE__ */ e(
        U,
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
function Wl({ actions: n, avatar: l, className: a, kind: i = "direct", members: t, meta: s, name: c }) {
  return /* @__PURE__ */ r("div", { className: v("nim-room-head", a), children: [
    i === "channel" ? /* @__PURE__ */ e("span", { className: "nim-room__glyph", children: /* @__PURE__ */ e(T, { name: "hash", size: "sm" }) }) : /* @__PURE__ */ e(de, { name: c, size: "md", src: l }),
    /* @__PURE__ */ r("div", { className: "nim-room-head__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-room-head__name", children: c }),
      s ? /* @__PURE__ */ e("span", { className: "nim-room-head__meta", children: s }) : null
    ] }),
    t != null && t.length ? /* @__PURE__ */ e("ul", { className: "nim-facepile", children: t.slice(0, 6).map((o) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ e(de, { name: o.name, size: "sm", src: o.avatar }) }, o.name)) }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-room-head__actions", children: n }) : null
  ] });
}
const mi = {
  map: "Map",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out"
}, ge = (n) => {
  const a = Math.max(-85.05112878, Math.min(85.05112878, n)) * Math.PI / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + a / 2)) / (2 * Math.PI);
}, ui = (n, l) => {
  const a = l.west, i = l.east < l.west ? l.east + 360 : l.east, t = n.lng < a ? n.lng + 360 : n.lng, s = ge(l.north), c = ge(l.south);
  return {
    x: (t - a) / (i - a) * 100,
    y: (ge(n.lat) - s) / (c - s) * 100
  };
};
function Zl({
  attribution: n,
  bounds: l,
  className: a,
  controls: i,
  labels: t,
  markers: s = [],
  onSelect: c,
  onZoom: o,
  ratio: d = 16 / 10,
  tiles: m,
  title: u
}) {
  const h = { ...mi, ...t }, f = J();
  return /* @__PURE__ */ r(
    "section",
    {
      "aria-labelledby": f,
      className: v("nim-map", a),
      style: { aspectRatio: `${d}` },
      children: [
        /* @__PURE__ */ e("h3", { className: "nim-visually-hidden", id: f, children: u }),
        /* @__PURE__ */ e("div", { className: "nim-map__tiles", children: m }),
        /* @__PURE__ */ e("ul", { className: "nim-map__markers", children: s.map((_) => {
          const N = ui(_, l), g = { insetBlockStart: `${N.y}%`, insetInlineStart: `${N.x}%` };
          return /* @__PURE__ */ e("li", { className: "nim-map__marker", "data-self": _.self ? "true" : void 0, style: g, children: c ? /* @__PURE__ */ r("button", { className: "nim-map__pin", "data-tone": _.tone, onClick: () => c(_), type: "button", children: [
            _.self ? /* @__PURE__ */ e("span", { className: "nim-map__dot" }) : /* @__PURE__ */ e(T, { name: "globe", size: "sm" }),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: _.label })
          ] }) : /* @__PURE__ */ r("span", { className: "nim-map__pin", "data-tone": _.tone, children: [
            _.self ? /* @__PURE__ */ e("span", { className: "nim-map__dot" }) : /* @__PURE__ */ e(T, { name: "globe", size: "sm" }),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: _.label })
          ] }) }, _.id);
        }) }),
        o || i ? /* @__PURE__ */ r("div", { className: "nim-map__controls", children: [
          i,
          o ? /* @__PURE__ */ r(K, { children: [
            /* @__PURE__ */ e(U, { label: h.zoomIn, name: "plus", onClick: () => o(1), size: "sm", variant: "solid" }),
            /* @__PURE__ */ e(U, { label: h.zoomOut, name: "minus", onClick: () => o(-1), size: "sm", variant: "solid" })
          ] }) : null
        ] }) : null,
        n ? /* @__PURE__ */ e("p", { className: "nim-map__attribution", children: n }) : null
      ]
    }
  );
}
const hi = {
  fullscreen: "Full screen",
  mute: "Mute",
  pause: "Pause",
  play: "Play",
  rate: "Playback speed",
  seek: "Seek",
  unmute: "Unmute",
  volume: "Volume"
};
function oe(n, l) {
  const a = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0, i = new Intl.NumberFormat(l, { minimumIntegerDigits: 2, useGrouping: !1 }), t = new Intl.NumberFormat(l), s = Math.floor(a / 3600), c = Math.floor(a % 3600 / 60), o = a % 60;
  return s > 0 ? `${t.format(s)}:${i.format(c)}:${i.format(o)}` : `${t.format(c)}:${i.format(o)}`;
}
function Yl({
  autoPlay: n = !1,
  className: l,
  kind: a = "audio",
  labels: i,
  locale: t,
  onError: s,
  poster: c,
  rates: o = [1, 1.5, 2],
  src: d,
  title: m,
  waveform: u
}) {
  const h = { ...hi, ...i }, f = O(null), _ = O(null), [N, g] = E(!1), [p, w] = E(0), [y, D] = E(0), [I, k] = E(0), [x, b] = E(n), [S, C] = E(1), [$, L] = E(1), A = y > 0 ? p / y : 0, B = Y(() => u ?? null, [u]), H = Z(() => {
    const M = f.current;
    M && (M.paused ? M.play() : M.pause());
  }, []);
  j(() => {
    const M = f.current;
    M && (M.playbackRate = $);
  }, [$]);
  const G = (M) => {
    const F = M.buffered;
    k(F.length ? F.end(F.length - 1) : 0);
  }, P = {
    onDurationChange: (M) => D(Number.isFinite(M.currentTarget.duration) ? M.currentTarget.duration : 0),
    onEnded: () => g(!1),
    onPause: () => g(!1),
    onPlay: () => g(!0),
    onProgress: (M) => G(M.currentTarget),
    onTimeUpdate: (M) => w(M.currentTarget.currentTime),
    onVolumeChange: (M) => {
      b(M.currentTarget.muted), C(M.currentTarget.volume);
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
              ref: (M) => {
                f.current = M;
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
              onClick: H,
              type: "button",
              children: N ? null : /* @__PURE__ */ e("span", { className: "nim-player__badge", children: /* @__PURE__ */ e(T, { name: "play", size: "lg" }) })
            }
          )
        ] }) : /* @__PURE__ */ e(
          "audio",
          {
            autoPlay: n,
            preload: "metadata",
            ref: (M) => {
              f.current = M;
            },
            src: d,
            ...P
          }
        ),
        /* @__PURE__ */ r("div", { className: "nim-player__transport", children: [
          /* @__PURE__ */ e(
            U,
            {
              label: N ? h.pause : h.play,
              name: N ? "pause" : "play",
              onClick: H,
              size: "md",
              variant: "solid"
            }
          ),
          /* @__PURE__ */ r("div", { className: "nim-player__track", children: [
            m ? /* @__PURE__ */ e("span", { className: "nim-player__title", children: m }) : null,
            /* @__PURE__ */ r("div", { className: "nim-player__rail", "data-wave": B ? "true" : void 0, children: [
              B ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__wave", children: B.map((M, F) => /* @__PURE__ */ e(
                "i",
                {
                  "data-played": F / B.length <= A ? "true" : void 0,
                  style: { blockSize: `${Math.max(8, Math.round(M * 100))}%` }
                },
                F
              )) }) : /* @__PURE__ */ r(K, { children: [
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__buffer", style: { inlineSize: `${y ? I / y * 100 : 0}%` } }),
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__played", style: { inlineSize: `${A * 100}%` } })
              ] }),
              /* @__PURE__ */ e(
                "input",
                {
                  "aria-label": h.seek,
                  "aria-valuetext": `${oe(p, t)} / ${oe(y, t)}`,
                  className: "nim-player__seek",
                  max: y || 0,
                  min: 0,
                  onChange: (M) => {
                    const F = Number(M.target.value);
                    w(F), f.current && (f.current.currentTime = F);
                  },
                  step: "any",
                  type: "range",
                  value: p
                }
              )
            ] }),
            /* @__PURE__ */ r("span", { className: "nim-player__times", children: [
              /* @__PURE__ */ e("time", { children: oe(p, t) }),
              /* @__PURE__ */ e("time", { children: oe(y, t) })
            ] })
          ] }),
          /* @__PURE__ */ r("div", { className: "nim-player__side", children: [
            o.length > 1 ? /* @__PURE__ */ r(
              "button",
              {
                "aria-label": h.rate,
                className: "nim-player__rate",
                onClick: () => L(o[(o.indexOf($) + 1) % o.length] ?? 1),
                type: "button",
                children: [
                  new Intl.NumberFormat(t).format($),
                  "×"
                ]
              }
            ) : null,
            /* @__PURE__ */ e(
              U,
              {
                label: x ? h.unmute : h.mute,
                name: x || S === 0 ? "volume-off" : "volume",
                onClick: () => {
                  const M = f.current;
                  M && (M.muted = !M.muted);
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
                onChange: (M) => {
                  const F = f.current;
                  F && (F.volume = Number(M.target.value), F.muted = Number(M.target.value) === 0);
                },
                step: 0.05,
                type: "range",
                value: x ? 0 : S
              }
            ),
            a === "video" ? /* @__PURE__ */ e(
              U,
              {
                label: h.fullscreen,
                name: "expand",
                onClick: () => {
                  var M, F;
                  document.fullscreenElement ? document.exitFullscreen() : (F = (M = _.current) == null ? void 0 : M.requestFullscreen) == null || F.call(M);
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
const _i = {
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
}, pi = () => {
  var n;
  return typeof navigator < "u" && typeof window < "u" && "MediaRecorder" in window && !!((n = navigator.mediaDevices) != null && n.getUserMedia);
}, fi = (n) => n.type.startsWith("video/") ? "video" : n.type.startsWith("image/") ? "image" : "file";
function jl({
  accept: n,
  allow: l,
  className: a,
  disabled: i = !1,
  labels: t,
  onCancelReply: s,
  onFiles: c,
  onSend: o,
  onTyping: d,
  placeholder: m,
  replyTo: u
}) {
  const h = { ..._i, ...t }, f = { file: !0, video: !0, voice: !0, ...l }, [_, N] = E(""), [g, p] = E([]), [w, y] = E(!1), [D, I] = E(0), [k] = E(pi), x = O([]), b = O(null), S = O(null), C = O(null), $ = O(0), L = O([]), A = O(null), B = Z(() => {
    var z;
    (z = C.current) == null || z.stream.getTracks().forEach((R) => R.stop()), C.current = null;
  }, []);
  j(() => B, [B]), j(() => {
    var z;
    u && ((z = A.current) == null || z.focus());
  }, [u]), j(() => {
    if (!w) return;
    const z = window.setInterval(() => I((Date.now() - $.current) / 1e3), 200);
    return () => window.clearInterval(z);
  }, [w]);
  const H = Z(
    (z) => {
      if (!(z != null && z.length)) return;
      const R = Array.from(z);
      x.current = [...x.current, ...R], p((q) => [
        ...q,
        ...R.map((Q) => ({
          kind: fi(Q),
          name: Q.name,
          size: Q.size,
          url: URL.createObjectURL(Q)
        }))
      ]);
    },
    []
  ), G = Z(async () => {
    try {
      const z = await navigator.mediaDevices.getUserMedia({ audio: !0 }), R = new MediaRecorder(z);
      L.current = [], R.ondataavailable = (q) => {
        q.data.size && L.current.push(q.data);
      }, R.onstop = () => {
        const q = new Blob(L.current, { type: R.mimeType }), Q = new File([q], "voice-message", { type: R.mimeType });
        x.current = [...x.current, Q], p((re) => [
          ...re,
          {
            duration: (Date.now() - $.current) / 1e3,
            kind: "voice",
            size: q.size,
            url: URL.createObjectURL(q)
          }
        ]), B();
      }, C.current = R, R.start(), $.current = Date.now(), I(0), y(!0);
    } catch {
      y(!1), B();
    }
  }, [B]), P = Z(
    (z) => {
      const R = C.current;
      y(!1), R && (z || (R.onstop = B), R.stop());
    },
    [B]
  ), M = (z) => {
    p((R) => (URL.revokeObjectURL(R[z].url), R.filter((q, Q) => Q !== z))), x.current = x.current.filter((R, q) => q !== z);
  }, F = () => {
    var z;
    !_.trim() && g.length === 0 || (o({ attachments: g, text: _.trim() }), c == null || c(x.current), x.current = [], p([]), N(""), (z = A.current) == null || z.focus());
  }, W = !_.trim() && g.length === 0;
  return /* @__PURE__ */ r("div", { className: v("nim-composer", a), children: [
    u ? /* @__PURE__ */ r("div", { className: "nim-composer__reply", children: [
      /* @__PURE__ */ e(T, { className: "nim-composer__reply-mark", name: "reply", size: "sm" }),
      /* @__PURE__ */ r("span", { className: "nim-composer__reply-text", children: [
        /* @__PURE__ */ r("span", { className: "nim-composer__reply-author", children: [
          h.replyingTo,
          " ",
          u.author
        ] }),
        /* @__PURE__ */ e("span", { className: "nim-composer__reply-quote", children: u.text })
      ] }),
      /* @__PURE__ */ e(U, { label: h.cancelReply, name: "close", onClick: s, size: "sm" })
    ] }) : null,
    g.length ? /* @__PURE__ */ e("ul", { className: "nim-composer__tray", children: g.map((z, R) => /* @__PURE__ */ r("li", { className: "nim-composer__chip", children: [
      /* @__PURE__ */ e(
        T,
        {
          name: z.kind === "voice" ? "mic" : z.kind === "video" ? "video" : z.kind === "image" ? "camera" : "document",
          size: "xs"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-composer__chip-name", children: z.name ?? h.record }),
      /* @__PURE__ */ e(
        U,
        {
          label: h.discard,
          name: "close",
          onClick: () => M(R),
          size: "sm"
        }
      )
    ] }, z.url)) }) : null,
    /* @__PURE__ */ e("div", { className: "nim-composer__row", children: w ? /* @__PURE__ */ r("div", { className: "nim-composer__recording", role: "status", children: [
      /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-composer__pulse" }),
      /* @__PURE__ */ e("span", { className: "nim-composer__recording-label", children: h.recording }),
      /* @__PURE__ */ r("span", { className: "nim-composer__elapsed", children: [
        D.toFixed(1),
        "s"
      ] }),
      /* @__PURE__ */ e(
        U,
        {
          label: h.cancel,
          name: "close",
          onClick: () => P(!1),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e(
        U,
        {
          label: h.stop,
          name: "stop",
          onClick: () => P(!0),
          size: "sm",
          variant: "solid"
        }
      )
    ] }) : /* @__PURE__ */ r(K, { children: [
      f.file ? /* @__PURE__ */ e(
        U,
        {
          disabled: i,
          label: h.attach,
          name: "paperclip",
          onClick: () => {
            var z;
            return (z = b.current) == null ? void 0 : z.click();
          },
          size: "sm"
        }
      ) : null,
      f.video ? /* @__PURE__ */ e(
        U,
        {
          disabled: i,
          label: h.video,
          name: "video",
          onClick: () => {
            var z;
            return (z = S.current) == null ? void 0 : z.click();
          },
          size: "sm"
        }
      ) : null,
      /* @__PURE__ */ e(
        "textarea",
        {
          className: "nim-composer__input",
          disabled: i,
          onChange: (z) => {
            N(z.target.value), d == null || d();
          },
          onKeyDown: (z) => {
            z.key === "Enter" && !z.shiftKey && (z.preventDefault(), F());
          },
          placeholder: m,
          ref: A,
          rows: 1,
          value: _
        }
      ),
      f.voice && k && W ? /* @__PURE__ */ e(
        U,
        {
          disabled: i,
          label: h.record,
          name: "mic",
          onClick: () => void G(),
          size: "sm"
        }
      ) : /* @__PURE__ */ e(
        U,
        {
          disabled: i || W,
          label: h.send,
          name: "send",
          onClick: F,
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
        onChange: (z) => {
          H(z.target.files), z.target.value = "";
        },
        ref: b,
        tabIndex: -1,
        type: "file"
      }
    ),
    /* @__PURE__ */ e(
      "input",
      {
        accept: "video/*",
        className: "nim-visually-hidden",
        onChange: (z) => {
          H(z.target.files), z.target.value = "";
        },
        ref: S,
        tabIndex: -1,
        type: "file"
      }
    )
  ] });
}
function Ni({
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
  const m = !!t;
  return /* @__PURE__ */ r(
    "span",
    {
      className: v("nim-chip", m && "nim-chip--interactive", l),
      "data-selected": o || void 0,
      "data-tone": d === "neutral" ? void 0 : d,
      children: [
        m ? /* @__PURE__ */ r(
          "button",
          {
            "aria-pressed": o,
            className: "nim-chip__body",
            disabled: a,
            onClick: t,
            type: "button",
            children: [
              i ? /* @__PURE__ */ e(T, { name: i, size: "xs" }) : null,
              n
            ]
          }
        ) : /* @__PURE__ */ r("span", { className: "nim-chip__body", children: [
          i ? /* @__PURE__ */ e(T, { name: i, size: "xs" }) : null,
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
            children: /* @__PURE__ */ e(T, { name: "close", size: "xs" })
          }
        ) : null
      ]
    }
  );
}
function Vl({
  className: n,
  disabled: l = !1,
  error: a,
  hint: i,
  label: t,
  onChange: s,
  placeholder: c,
  removeLabel: o = "Remove",
  separators: d = ["Enter", ",", "Tab"],
  validate: m,
  values: u
}) {
  const [h, f] = E(""), _ = () => {
    const g = h.trim();
    if (g && !(m && !m(g))) {
      if (u.includes(g)) {
        f("");
        return;
      }
      s([...u, g]), f("");
    }
  }, N = (g) => {
    if (d.includes(g.key)) {
      if (g.key === "Tab" && !h.trim()) return;
      g.preventDefault(), _();
      return;
    }
    g.key === "Backspace" && !h && u.length > 0 && s(u.slice(0, -1));
  };
  return /* @__PURE__ */ r("div", { className: v("nim-field", a && "nim-field--invalid", n), children: [
    t ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: t }) : null,
    /* @__PURE__ */ r("div", { className: "nim-chip-input", "data-disabled": l || void 0, children: [
      u.map((g) => /* @__PURE__ */ e(
        Ni,
        {
          disabled: l,
          onRemove: () => s(u.filter((p) => p !== g)),
          removeLabel: `${o} ${g}`,
          children: g
        },
        g
      )),
      /* @__PURE__ */ e(
        "input",
        {
          "aria-invalid": a ? !0 : void 0,
          "aria-label": t,
          className: "nim-chip-input__field",
          disabled: l,
          onBlur: _,
          onChange: (g) => f(g.target.value),
          onKeyDown: N,
          placeholder: u.length === 0 ? c : void 0,
          value: h
        }
      )
    ] }),
    a ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: a }) : null,
    i && !a ? /* @__PURE__ */ e("p", { className: "nim-field__hint", children: i }) : null
  ] });
}
function ql({ className: n, layout: l = "rows", rows: a }) {
  return /* @__PURE__ */ e("dl", { className: v("nim-data-list", `nim-data-list--${l}`, n), children: a.map((i) => /* @__PURE__ */ r("div", { className: "nim-data-list__row", children: [
    /* @__PURE__ */ e("dt", { className: "nim-data-list__label", children: i.label }),
    /* @__PURE__ */ e("dd", { className: v("nim-data-list__value", i.mono && "nim-data-list__value--mono"), children: i.value ?? /* @__PURE__ */ e("span", { className: "nim-data-list__empty", children: "—" }) })
  ] }, i.id)) });
}
function Ql({
  className: n,
  commands: l,
  emptyLabel: a = (o) => `Nothing matches “${o}”.`,
  label: i,
  onClose: t,
  open: s,
  placeholder: c = "Search…"
}) {
  const o = O(null), d = O(null), m = O(null), [u, h] = E(""), [f, _] = E(0), N = Y(() => vi(l, u), [l, u]), g = N.filter((k) => !k.disabled), p = g[Math.min(f, Math.max(g.length - 1, 0))];
  j(() => {
    var x;
    const k = o.current;
    k && (s && !k.open && (k.showModal(), (x = m.current) == null || x.focus()), !s && k.open && k.close());
  }, [s]), j(() => {
    const k = o.current;
    if (!k) return;
    const x = () => {
      h(""), _(0), t();
    };
    return k.addEventListener("close", x), () => k.removeEventListener("close", x);
  }, [t]), j(() => {
    var k, x;
    (x = (k = d.current) == null ? void 0 : k.querySelector('[data-active="true"]')) == null || x.scrollIntoView({ block: "nearest" });
  }, [f, u]);
  const w = (k) => {
    !k || k.disabled || (t(), k.onRun());
  }, y = (k) => {
    g.length && (k.key === "ArrowDown" ? (k.preventDefault(), _((x) => (x + 1) % g.length)) : k.key === "ArrowUp" ? (k.preventDefault(), _((x) => (x - 1 + g.length) % g.length)) : k.key === "Home" ? (k.preventDefault(), _(0)) : k.key === "End" ? (k.preventDefault(), _(g.length - 1)) : k.key === "Enter" && (k.preventDefault(), w(p)));
  }, D = !u.trim();
  let I;
  return /* @__PURE__ */ r(
    "dialog",
    {
      "aria-label": i,
      className: v("nim-palette", n),
      onClick: (k) => {
        k.target === o.current && t();
      },
      ref: o,
      children: [
        /* @__PURE__ */ r("div", { className: "nim-palette__field", children: [
          /* @__PURE__ */ e(T, { name: "search", size: "sm" }),
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
              onChange: (k) => {
                h(k.target.value), _(0);
              },
              onKeyDown: y,
              placeholder: c,
              role: "combobox",
              spellCheck: !1,
              ref: m,
              value: u
            }
          )
        ] }),
        /* @__PURE__ */ e("div", { className: "nim-palette__list", id: "nim-palette-list", ref: d, role: "listbox", children: N.length ? N.map((k) => {
          const x = D && k.group && k.group !== I ? k.group : void 0;
          I = k.group;
          const b = k === p;
          return /* @__PURE__ */ r("div", { children: [
            x ? /* @__PURE__ */ e("p", { className: "nim-palette__group", role: "presentation", children: x }) : null,
            /* @__PURE__ */ r(
              "button",
              {
                "aria-selected": b,
                className: "nim-palette__row",
                "data-active": b ? "true" : void 0,
                disabled: k.disabled,
                id: `${k.id}-palette-row`,
                onClick: () => w(k),
                onMouseMove: () => {
                  const S = g.indexOf(k);
                  S >= 0 && S !== f && _(S);
                },
                role: "option",
                type: "button",
                children: [
                  /* @__PURE__ */ e(T, { name: k.icon ?? "chevron-forward", size: "sm" }),
                  /* @__PURE__ */ r("span", { className: "nim-palette__text", children: [
                    /* @__PURE__ */ e("span", { className: "nim-palette__label", children: k.label }),
                    k.hint ? /* @__PURE__ */ e("span", { className: "nim-palette__hint", children: k.hint }) : null
                  ] }),
                  k.shortcut ? /* @__PURE__ */ e("kbd", { className: "nim-palette__shortcut", children: k.shortcut }) : null
                ]
              }
            )
          ] }, k.id);
        }) : /* @__PURE__ */ e("p", { className: "nim-palette__empty", children: a(u) }) })
      ]
    }
  );
}
function vi(n, l) {
  const a = l.trim().toLowerCase();
  if (!a) return n;
  const i = [];
  for (const t of n) {
    const s = t.label.toLowerCase(), c = `${t.group ?? ""} ${t.keywords ?? ""}`.toLowerCase(), o = s.startsWith(a) ? 0 : s.includes(` ${a}`) ? 1 : s.includes(a) ? 2 : c.includes(a) ? 3 : -1;
    o >= 0 && i.push({ command: t, rank: o });
  }
  return i.sort((t, s) => t.rank - s.rank).map((t) => t.command);
}
function ee({ children: n, className: l, error: a, hint: i, id: t, label: s, required: c }) {
  const o = J(), d = t ?? `nim-${o}`, m = i ? `${d}-hint` : void 0, u = a ? `${d}-error` : void 0, h = [u, m].filter(Boolean).join(" ") || void 0;
  return /* @__PURE__ */ r("div", { className: v("nim-field", a && "nim-field--invalid", l), children: [
    s ? /* @__PURE__ */ r("label", { className: "nim-field__label", htmlFor: d, children: [
      s,
      c ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    n({ control: d, describedBy: h }),
    a ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: u, children: a }) : null,
    i && !a ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: m, children: i }) : null
  ] });
}
function Xl({ children: n, ...l }) {
  return /* @__PURE__ */ e(ee, { ...l, children: () => n });
}
function bi({ className: n, error: l, hint: a, iconEnd: i, iconStart: t, id: s, label: c, required: o, ...d }) {
  return /* @__PURE__ */ e(ee, { error: l, hint: a, id: s, label: c, required: o, children: ({ control: m, describedBy: u }) => /* @__PURE__ */ r(
    "div",
    {
      className: v(
        "nim-input-shell",
        t && "nim-input-shell--has-start",
        i && "nim-input-shell--has-end"
      ),
      children: [
        t ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--start", children: /* @__PURE__ */ e(T, { name: t, size: "sm" }) }) : null,
        /* @__PURE__ */ e(
          "input",
          {
            "aria-describedby": u,
            "aria-invalid": l ? !0 : void 0,
            className: v("nim-input", n),
            id: m,
            required: o,
            ...d
          }
        ),
        i ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(T, { name: i, size: "sm" }) }) : null
      ]
    }
  ) });
}
function Jl({ className: n, error: l, hint: a, id: i, label: t, required: s, rows: c = 4, ...o }) {
  return /* @__PURE__ */ e(ee, { error: l, hint: a, id: i, label: t, required: s, children: ({ control: d, describedBy: m }) => /* @__PURE__ */ e(
    "textarea",
    {
      "aria-describedby": m,
      "aria-invalid": l ? !0 : void 0,
      className: v("nim-textarea", n),
      id: d,
      required: s,
      rows: c,
      ...o
    }
  ) });
}
function et({
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
  return /* @__PURE__ */ e(ee, { error: l, hint: a, id: i, label: t, required: o, children: ({ control: m, describedBy: u }) => /* @__PURE__ */ r("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
    /* @__PURE__ */ r(
      "select",
      {
        "aria-describedby": u,
        "aria-invalid": l ? !0 : void 0,
        className: v("nim-select", n),
        id: m,
        required: o,
        ...d,
        children: [
          c ? /* @__PURE__ */ e("option", { value: "", disabled: !0, children: c }) : null,
          s.map((h) => /* @__PURE__ */ e("option", { disabled: h.disabled, value: h.value, children: h.label }, h.value))
        ]
      }
    ),
    /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(T, { name: "chevron-down", size: "sm" }) })
  ] }) });
}
function nt({
  ariaLabel: n,
  className: l,
  emptyState: a,
  error: i,
  hint: t,
  id: s,
  label: c,
  onChange: o,
  options: d,
  placeholder: m,
  required: u,
  value: h
}) {
  const f = J(), _ = d.find((C) => C.value === h) ?? null, [N, g] = E(""), [p, w] = E(!1), [y, D] = E(0), I = O(null), k = Y(() => {
    const C = N.trim().toLowerCase();
    return C ? d.filter(($) => $.label.toLowerCase().includes(C)) : d;
  }, [d, N]), x = (C) => {
    o(C.value), g(""), w(!1);
  }, b = (C) => {
    if (C.key === "Escape") {
      g(""), w(!1);
      return;
    }
    if (!p && (C.key === "ArrowDown" || C.key === "ArrowUp")) {
      w(!0);
      return;
    }
    if (C.key === "ArrowDown" || C.key === "ArrowUp") {
      C.preventDefault();
      const $ = C.key === "ArrowDown" ? 1 : -1, L = k.filter((A) => !A.disabled);
      if (L.length === 0) return;
      D((A) => (A + $ + L.length) % L.length);
    }
    if (C.key === "Enter") {
      const L = k.filter((A) => !A.disabled)[y];
      L && (C.preventDefault(), x(L));
    }
  }, S = k.filter((C) => !C.disabled);
  return /* @__PURE__ */ e(ee, { className: l, error: i, hint: t, id: s, label: c, required: u, children: ({ control: C, describedBy: $ }) => /* @__PURE__ */ r("div", { className: "nim-combobox", children: [
    /* @__PURE__ */ r("div", { className: v("nim-input-shell", "nim-input-shell--has-end"), children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-label": n ?? c,
          "aria-autocomplete": "list",
          "aria-controls": p ? f : void 0,
          "aria-describedby": $,
          "aria-expanded": p,
          className: "nim-input",
          id: C,
          onBlur: () => window.setTimeout(() => w(!1), 120),
          onChange: (L) => {
            g(L.target.value), D(0), w(!0);
          },
          onFocus: () => w(!0),
          onKeyDown: b,
          placeholder: m,
          ref: I,
          role: "combobox",
          value: p ? N : (_ == null ? void 0 : _.label) ?? ""
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(T, { name: "chevron-down", size: "sm" }) })
    ] }),
    p ? /* @__PURE__ */ e("div", { className: "nim-combobox__list", id: f, role: "listbox", children: S.length === 0 ? /* @__PURE__ */ e("div", { className: "nim-combobox__empty", children: a ? a(N) : `Nothing matches “${N}”.` }) : k.map((L) => /* @__PURE__ */ r(
      "button",
      {
        "aria-selected": S.indexOf(L) === y,
        className: "nim-combobox__option",
        disabled: L.disabled,
        onClick: () => x(L),
        onPointerEnter: () => D(S.indexOf(L)),
        role: "option",
        type: "button",
        children: [
          /* @__PURE__ */ e("span", { children: L.label }),
          L.meta ? /* @__PURE__ */ e("span", { className: "nim-combobox__meta", children: L.meta }) : null
        ]
      },
      L.value
    )) }) : null
  ] }) });
}
const je = xe(null);
function at({
  children: n,
  className: l,
  defaultColorway: a = "vermilion",
  defaultScheme: i = "light",
  defaultStyle: t = "ledger",
  direction: s = "ltr",
  locale: c,
  syncDocument: o = !0
}) {
  const [d, m] = E(t), [u, h] = E(a), [f, _] = E(i);
  j(() => {
    if (!o || typeof document > "u") return;
    const g = document.documentElement;
    g.dataset.nimStyle = d, g.dataset.nimColorway = u, f === "system" ? delete g.dataset.nimScheme : g.dataset.nimScheme = f, g.dir = s, c && (g.lang = c);
  }, [u, s, c, f, d, o]);
  const N = Y(
    () => ({ colorway: u, direction: s, locale: c, scheme: f, setColorway: h, setScheme: _, setStyle: m, style: d }),
    [u, s, c, f, d]
  );
  return /* @__PURE__ */ e(je.Provider, { value: N, children: /* @__PURE__ */ e(
    "div",
    {
      className: v("nim-root", l),
      "data-nim-colorway": u,
      "data-nim-scheme": f === "system" ? void 0 : f,
      "data-nim-style": d,
      dir: s,
      lang: c,
      children: n
    }
  ) });
}
function _e() {
  const n = Me(je);
  if (!n) throw new Error("useNim must be used inside <NimProvider>");
  return n;
}
function it() {
  const { scheme: n, setScheme: l } = _e();
  return Z(() => l(n === "dark" ? "light" : "dark"), [n, l]);
}
const me = 864e5, gi = Date.UTC(622, 2, 22), yi = 365.2422, ie = (n) => n.toISOString().slice(0, 10), le = (n) => /* @__PURE__ */ new Date(`${n}T00:00:00Z`), pe = () => ie(/* @__PURE__ */ new Date()), ki = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
  year: "numeric"
});
function ne(n, l) {
  const a = le(n);
  if (l === "gregory")
    return { day: a.getUTCDate(), month: a.getUTCMonth() + 1, year: a.getUTCFullYear() };
  const i = ki.formatToParts(a), t = (s) => {
    var c;
    return Number(((c = i.find((o) => o.type === s)) == null ? void 0 : c.value) ?? "0");
  };
  return { day: t("day"), month: t("month"), year: t("year") };
}
const Ee = (n) => n.year * 1e4 + n.month * 100 + n.day;
function te(n, l) {
  if (l === "gregory")
    return ie(new Date(Date.UTC(n.year, n.month - 1, n.day)));
  const a = Math.floor((n.year - 1) * yi) + (n.month <= 7 ? (n.month - 1) * 31 : 186 + (n.month - 7) * 30) + n.day - 1;
  let i = new Date(gi + a * me);
  const t = Ee(n);
  for (let s = 0; s < 40; s += 1) {
    const c = ne(ie(i), "persian"), o = Ee(c);
    if (o === t) break;
    const d = (n.year - c.year) * 365 + (n.month - c.month) * 30 + (n.day - c.day);
    i = new Date(i.getTime() + (d === 0 ? o < t ? 1 : -1 : d) * me);
  }
  return ie(i);
}
function wi(n, l) {
  const a = ne(n, l);
  return te({ ...a, day: 1 }, l);
}
function Ie(n, l, a) {
  const i = ne(n, a), t = i.year * 12 + (i.month - 1) + l, s = Math.floor(t / 12), c = t % 12 + 1, o = Ve(s, c, a);
  return te({ day: Math.min(i.day, o), month: c, year: s }, a);
}
function Ve(n, l, a) {
  const i = le(te({ day: 1, month: l, year: n }, a)).getTime(), t = l === 12 ? 1 : l + 1, s = l === 12 ? n + 1 : n, c = le(te({ day: 1, month: t, year: s }, a)).getTime();
  return Math.round((c - i) / me);
}
const ye = (n, l) => ie(new Date(le(n).getTime() + l * me)), Ci = (n) => le(n).getUTCDay();
function xi(n, l) {
  const a = n ?? "en";
  return a.includes("-u-ca-") || a.includes("-u-") ? a : `${a}-u-ca-${l}`;
}
const Te = (n) => n != null && n.startsWith("fa") ? "persian" : "gregory", Mi = (n) => n === "persian" ? 6 : 1, Be = /* @__PURE__ */ new Map();
function Ti(n) {
  const l = n ?? "en", a = Be.get(l);
  if (a) return a;
  const i = new Intl.NumberFormat(l, { useGrouping: !1 }), t = Array.from({ length: 10 }, (s, c) => i.format(c));
  return Be.set(l, t), t;
}
function Ce(n, l, a) {
  const i = ne(n, a), t = Ti(l), s = (c, o = 1) => String(c).padStart(o, "0").replace(/\d/g, (d) => t[Number(d)]);
  return `${s(i.year)}/${s(i.month, 2)}/${s(i.day, 2)}`;
}
function Si(n, l) {
  const i = Di(n).match(/\d+/g);
  if (!i || i.length < 3) return null;
  const [t, s, c] = i.map(Number);
  if (s < 1 || s > 12 || c < 1 || c > Ve(t, s, l)) return null;
  const o = te({ day: c, month: s, year: t }, l), d = ne(o, l);
  return d.year === t && d.month === s && d.day === c ? o : null;
}
function Di(n) {
  let l = "";
  for (const a of n) {
    const i = a.codePointAt(0) ?? 0;
    i >= 1776 && i <= 1785 ? l += String.fromCodePoint(i - 1776 + 48) : i >= 1632 && i <= 1641 ? l += String.fromCodePoint(i - 1632 + 48) : l += a;
  }
  return l;
}
const Pe = {
  next: "Next month",
  previous: "Previous month"
};
function qe({
  className: n,
  marked: l = [],
  max: a,
  min: i,
  month: t,
  onMonthChange: s,
  onSelect: c,
  system: o,
  value: d,
  weekStart: m
}) {
  const { locale: u } = _e(), h = o ?? Te(u), f = m ?? Mi(h), _ = pe(), N = xi(u, h), g = Y(
    () => new Intl.DateTimeFormat(N, { month: "long", timeZone: "UTC", year: "numeric" }),
    [N]
  ), p = Y(() => new Intl.NumberFormat(u), [u]), w = Y(
    () => new Intl.DateTimeFormat(N, { timeZone: "UTC", weekday: "short" }),
    [N]
  ), y = wi(t, h), D = ne(y, h).month, I = Y(() => {
    const x = (Ci(y) - f + 7) % 7, b = ye(y, -x);
    return Array.from({ length: 42 }, (S, C) => {
      const $ = ye(b, C), L = ne($, h);
      return { date: $, day: L.day, outside: L.month !== D };
    });
  }, [y, D, h, f]), k = Y(() => {
    const x = "2024-01-07";
    return Array.from({ length: 7 }, (b, S) => ({
      key: `${f}-${S}`,
      label: w.format(/* @__PURE__ */ new Date(`${ye(x, (f + S) % 7)}T00:00:00Z`))
    }));
  }, [f, w]);
  return /* @__PURE__ */ r("div", { className: v("nim-calendar", n), children: [
    /* @__PURE__ */ r("div", { className: "nim-calendar__header", children: [
      /* @__PURE__ */ e(
        U,
        {
          label: Pe.previous,
          name: "chevron-back",
          onClick: () => s(Ie(y, -1, h)),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-calendar__month", children: g.format(/* @__PURE__ */ new Date(`${y}T00:00:00Z`)) }),
      /* @__PURE__ */ e(
        U,
        {
          label: Pe.next,
          name: "chevron-forward",
          onClick: () => s(Ie(y, 1, h)),
          size: "sm"
        }
      )
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-calendar__grid", role: "grid", children: [
      k.map((x) => /* @__PURE__ */ e("span", { className: "nim-calendar__weekday", children: x.label }, x.key)),
      I.map((x) => /* @__PURE__ */ e(
        "button",
        {
          "aria-selected": x.date === d,
          className: v(
            "nim-calendar__day",
            x.outside && "nim-calendar__day--outside",
            x.date === _ && "nim-calendar__day--today",
            l.includes(x.date) && "nim-calendar__day--marked"
          ),
          disabled: i !== void 0 && x.date < i || a !== void 0 && x.date > a,
          onClick: () => c(x.date),
          role: "gridcell",
          type: "button",
          children: p.format(x.day)
        },
        x.date
      ))
    ] })
  ] });
}
function Qe({
  calendar: n,
  describedBy: l,
  id: a,
  invalid: i,
  locale: t,
  onChange: s,
  value: c
}) {
  const [o, d] = E(null);
  if (n === "gregory")
    return /* @__PURE__ */ e(
      "input",
      {
        "aria-describedby": l,
        "aria-invalid": i ? !0 : void 0,
        className: "nim-input",
        id: a,
        onChange: (u) => s(u.target.value),
        type: "date",
        value: c
      }
    );
  const m = o ?? (c ? Ce(c, t, n) : "");
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
      onChange: (u) => {
        d(u.target.value);
        const h = Si(u.target.value, n);
        h ? s(h) : u.target.value.trim() === "" && s("");
      },
      placeholder: Ce(pe(), t, n),
      type: "text",
      value: m
    }
  );
}
function lt({
  error: n,
  hint: l,
  id: a,
  label: i,
  onChange: t,
  required: s,
  value: c,
  ...o
}) {
  const { locale: d } = _e(), m = o.system ?? Te(d), [u, h] = E(c || pe());
  return /* @__PURE__ */ e(ee, { error: n, hint: l, id: a, label: i, required: s, children: ({ control: f, describedBy: _ }) => /* @__PURE__ */ r("div", { className: "nim-stack nim-stack--tight", children: [
    /* @__PURE__ */ e(
      Qe,
      {
        calendar: m,
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
      qe,
      {
        ...o,
        month: u,
        onMonthChange: h,
        onSelect: (N) => {
          t(N), h(N);
        },
        system: m,
        value: c
      }
    )
  ] }) });
}
function tt({
  error: n,
  hint: l,
  id: a,
  label: i,
  labels: t,
  onChange: s,
  required: c,
  showEquivalent: o,
  value: d,
  ...m
}) {
  const { locale: u } = _e(), h = m.system ?? Te(u), [f, _] = E(!1), [N, g] = E(d || pe()), p = O(null), w = { clear: "Clear date", open: "Open calendar", ...t }, y = o ?? h === "persian", D = h === "persian" ? "gregory" : "persian";
  return /* @__PURE__ */ e(ee, { error: n, hint: l, id: a, label: i, required: c, children: ({ control: I, describedBy: k }) => /* @__PURE__ */ r("div", { className: "nim-date-picker", children: [
    /* @__PURE__ */ r("div", { className: "nim-date-picker__group", children: [
      /* @__PURE__ */ e(
        Qe,
        {
          calendar: h,
          describedBy: k,
          id: I,
          invalid: !!n,
          locale: u,
          onChange: (x) => {
            s(x), x && g(x);
          },
          value: d
        }
      ),
      d ? /* @__PURE__ */ e(
        U,
        {
          label: w.clear,
          name: "close",
          onClick: () => s(""),
          size: "sm"
        }
      ) : null,
      /* @__PURE__ */ e(
        U,
        {
          "aria-expanded": f,
          label: w.open,
          name: "calendar",
          onClick: () => _((x) => !x),
          ref: p,
          size: "sm"
        }
      )
    ] }),
    y && d ? /* @__PURE__ */ r("p", { className: "nim-date-picker__equivalent", children: [
      /* @__PURE__ */ e(T, { name: "calendar", size: "xs" }),
      /* @__PURE__ */ e("span", { dir: D === "gregory" ? "ltr" : void 0, children: Ce(d, u, D) })
    ] }) : null,
    /* @__PURE__ */ e(
      Xa,
      {
        label: i ?? w.open,
        onClose: () => _(!1),
        open: f,
        triggerRef: p,
        children: /* @__PURE__ */ e(
          qe,
          {
            ...m,
            month: N,
            onMonthChange: g,
            onSelect: (x) => {
              s(x), g(x), _(!1);
            },
            system: h,
            value: d
          }
        )
      }
    )
  ] }) });
}
function st({
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
  const m = O(null);
  return j(() => {
    const u = m.current;
    u && (o && !u.open && u.showModal(), !o && u.open && u.close());
  }, [o]), j(() => {
    const u = m.current;
    if (!u || t) return;
    const h = (f) => f.preventDefault();
    return u.addEventListener("cancel", h), () => u.removeEventListener("cancel", h);
  }, [t]), j(() => {
    const u = m.current;
    if (!u) return;
    const h = () => c();
    return u.addEventListener("close", h), () => u.removeEventListener("close", h);
  }, [c]), /* @__PURE__ */ r(
    "dialog",
    {
      className: v("nim-dialog", l),
      onClick: (u) => {
        t && u.target === m.current && c();
      },
      ref: m,
      children: [
        /* @__PURE__ */ r("div", { className: "nim-dialog__header", children: [
          /* @__PURE__ */ r("div", { children: [
            /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: d }),
            i ? /* @__PURE__ */ e("p", { className: "nim-caption", children: i }) : null
          ] }),
          t ? /* @__PURE__ */ e(U, { label: a, name: "close", onClick: c, size: "sm" }) : null
        ] }),
        /* @__PURE__ */ e("div", { className: "nim-dialog__body", children: n }),
        s ? /* @__PURE__ */ e("div", { className: "nim-dialog__footer", children: s }) : null
      ]
    }
  );
}
function rt({ caveat: n, className: l, links: a, resolution: i, ...t }) {
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
function ct({ children: n, className: l, title: a, ...i }) {
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
function ot({ caption: n, className: l, lines: a, summary: i, ...t }) {
  const s = a.filter((m) => m.kind === "added").length, c = a.filter((m) => m.kind === "removed").length, o = i ?? `${s} line${s === 1 ? "" : "s"} added, ${c} removed`, d = { added: "added", context: "", removed: "removed" };
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
      a.map((m, u) => /* @__PURE__ */ r("span", { className: "nim-diff__line", "data-kind": m.kind, children: [
        d[m.kind] ? /* @__PURE__ */ r("span", { className: "nim-visually-hidden", children: [
          d[m.kind],
          ": "
        ] }) : null,
        /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-diff__marker", children: m.kind === "added" ? "+" : m.kind === "removed" ? "−" : " " }),
        /* @__PURE__ */ e("span", { className: "nim-diff__text", children: m.text })
      ] }, u))
    ] })
  ] });
}
function dt({ className: n, commands: l, costlyIndex: a, note: i, ...t }) {
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
function mt({ children: n, className: l, note: a, ...i }) {
  return /* @__PURE__ */ r("div", { className: v("nim-decide", l), ...i, children: [
    a ? /* @__PURE__ */ e("p", { className: "nim-decide__note", children: a }) : null,
    /* @__PURE__ */ e("div", { className: "nim-decide__actions", children: n })
  ] });
}
class ut extends tn {
  constructor() {
    super(...arguments);
    Ne(this, "state", { error: null });
    Ne(this, "reset", () => {
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
function ht({
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
function _t({ caption: n, className: l, entries: a, ...i }) {
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
function pt({
  className: n,
  detail: l,
  label: a,
  percent: i,
  tone: t = "accent",
  value: s,
  ...c
}) {
  const o = typeof i == "number", d = Math.min(100, Math.max(0, i ?? 0)), m = typeof a == "string" ? a : void 0;
  return /* @__PURE__ */ r("div", { className: v("nim-resource-meter", n), "data-tone": t, ...c, children: [
    /* @__PURE__ */ r("div", { className: "nim-resource-meter__head", children: [
      /* @__PURE__ */ e("span", { className: "nim-resource-meter__label", children: a }),
      /* @__PURE__ */ e("span", { className: "nim-resource-meter__value", children: s })
    ] }),
    o ? /* @__PURE__ */ e(
      "div",
      {
        "aria-label": m,
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
function ft({
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
  const m = O(0), [u, h] = E(!1), f = (_) => {
    _.preventDefault(), _.stopPropagation();
  };
  return /* @__PURE__ */ r("div", { className: v("nim-field", t && "nim-field--invalid", a), children: [
    /* @__PURE__ */ r(
      "label",
      {
        className: "nim-file-drop",
        "data-over": u || void 0,
        "data-disabled": i || void 0,
        onDragEnter: (_) => {
          f(_), m.current += 1, i || h(!0);
        },
        onDragLeave: (_) => {
          f(_), m.current -= 1, m.current <= 0 && h(!1);
        },
        onDragOver: f,
        onDrop: (_) => {
          if (f(_), m.current = 0, h(!1), i) return;
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
          /* @__PURE__ */ e(T, { className: "nim-file-drop__icon", name: "upload", size: "lg" }),
          /* @__PURE__ */ e("span", { className: "nim-file-drop__label", children: s }),
          d ? /* @__PURE__ */ e("span", { className: "nim-file-drop__prompt", children: d }) : null,
          l ? /* @__PURE__ */ e("span", { className: "nim-file-drop__caption", children: l }) : null
        ]
      }
    ),
    t ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: t }) : null
  ] });
}
function Nt({ children: n, className: l, ...a }) {
  return /* @__PURE__ */ e("div", { className: v("nim-app-frame", l), ...a, children: n });
}
function vt({
  as: n = "div",
  children: l,
  className: a,
  gap: i = "md",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-stack", i !== "md" && `nim-stack--${i}`, a), ...t, children: l });
}
function bt({
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
function zi({ children: n, className: l, plain: a = !1, ...i }) {
  return /* @__PURE__ */ e("div", { className: v("nim-list", a && "nim-list--plain", l), ...i, children: n });
}
function Li({
  className: n,
  href: l,
  leading: a,
  onClick: i,
  rel: t,
  subtitle: s,
  target: c,
  title: o,
  trailing: d,
  ...m
}) {
  const u = !!(l || i), h = /* @__PURE__ */ r(K, { children: [
    a ? /* @__PURE__ */ e("span", { className: "nim-list-row__leading", children: a }) : null,
    /* @__PURE__ */ r("span", { className: "nim-list-row__content", children: [
      /* @__PURE__ */ e("span", { className: "nim-list-row__title", children: o }),
      s ? /* @__PURE__ */ e("span", { className: "nim-list-row__subtitle", children: s }) : null
    ] }),
    d ? /* @__PURE__ */ e("span", { className: "nim-list-row__trailing", children: d }) : null,
    u && !d ? /* @__PURE__ */ e(T, { className: "nim-list-row__chevron", name: "chevron-forward", size: "sm" }) : null
  ] }), f = v("nim-list-row", u && "nim-list-row--interactive", n);
  return l ? /* @__PURE__ */ e(
    "a",
    {
      className: f,
      href: l,
      rel: c === "_blank" ? t ?? "noreferrer" : t,
      target: c,
      ...m,
      children: h
    }
  ) : i ? /* @__PURE__ */ e("button", { className: f, onClick: i, type: "button", ...m, children: h }) : /* @__PURE__ */ e("div", { className: f, ...m, children: h });
}
const Ai = {
  back: "Back",
  dot: (n) => `Slide ${n + 1}`
};
function gt({
  brand: n,
  className: l,
  finishLabel: a,
  footnote: i,
  labels: t,
  nextLabel: s,
  onDone: c,
  onSkip: o,
  onStep: d,
  skipLabel: m,
  slides: u
}) {
  var w;
  const [h, f] = E(0), _ = { ...Ai, ...t }, N = u[Math.min(h, u.length - 1)], g = h === u.length - 1, p = Z(
    (y) => {
      f(y), d == null || d(y);
    },
    [d]
  );
  return /* @__PURE__ */ r("section", { className: v("nim-onboarding", l), children: [
    /* @__PURE__ */ r("header", { className: "nim-onboarding__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-onboarding__brand", children: n }),
      m ? /* @__PURE__ */ e(
        X,
        {
          iconEnd: "chevron-forward",
          onClick: o ?? c,
          size: "sm",
          variant: "ghost",
          children: m
        }
      ) : null
    ] }),
    /* @__PURE__ */ r("div", { "aria-live": "polite", className: "nim-onboarding__stage", children: [
      N.art ? /* @__PURE__ */ e("div", { className: "nim-onboarding__art", children: N.art }) : null,
      N.proof ? /* @__PURE__ */ r("div", { className: "nim-onboarding__proof", children: [
        N.proof.icon ? /* @__PURE__ */ e("span", { className: "nim-onboarding__proof-icon", children: N.proof.icon }) : null,
        /* @__PURE__ */ r("span", { className: "nim-onboarding__proof-text", children: [
          /* @__PURE__ */ e("span", { className: "nim-onboarding__proof-title", children: N.proof.title }),
          (w = N.proof.points) != null && w.length ? /* @__PURE__ */ e("span", { className: "nim-onboarding__proof-points", children: N.proof.points.join(" · ") }) : null
        ] })
      ] }) : null
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-onboarding__copy", children: [
      N.label ? /* @__PURE__ */ e("span", { className: "nim-onboarding__chip", children: N.label }) : null,
      /* @__PURE__ */ e("h1", { className: "nim-onboarding__title", children: N.title }),
      N.body ? /* @__PURE__ */ e("p", { className: "nim-onboarding__body", children: N.body }) : null
    ] }),
    /* @__PURE__ */ r("footer", { className: "nim-onboarding__controls", children: [
      /* @__PURE__ */ e("div", { className: "nim-onboarding__dots", children: u.map((y, D) => /* @__PURE__ */ e(
        "button",
        {
          "aria-current": D === h ? "step" : void 0,
          "aria-label": _.dot(D),
          className: "nim-onboarding__dot",
          onClick: () => p(D),
          type: "button"
        },
        y.id
      )) }),
      /* @__PURE__ */ r("div", { className: "nim-onboarding__cta", children: [
        h > 0 ? /* @__PURE__ */ e(
          U,
          {
            label: _.back,
            name: "chevron-back",
            onClick: () => p(h - 1),
            size: "lg",
            variant: "outline"
          }
        ) : null,
        /* @__PURE__ */ e(
          X,
          {
            fullWidth: !0,
            iconEnd: g ? "arrow-forward" : void 0,
            onClick: () => g ? c() : p(h + 1),
            size: "lg",
            variant: "accent",
            children: g ? a : s
          }
        )
      ] }),
      i ? /* @__PURE__ */ e("p", { className: "nim-onboarding__footnote", children: i }) : null
    ] })
  ] });
}
const $i = "AD:376 AE:971 AF:93 AG:1268 AI:1264 AL:355 AM:374 AO:244 AQ:672 AR:54 AS:1684 AT:43 AU:61 AW:297 AX:358 AZ:994 BA:387 BB:1246 BD:880 BE:32 BF:226 BG:359 BH:973 BI:257 BJ:229 BL:590 BM:1441 BN:673 BO:591 BQ:599 BR:55 BS:1242 BT:975 BW:267 BY:375 BZ:501 CA:1 CC:61 CD:243 CF:236 CG:242 CH:41 CI:225 CK:682 CL:56 CM:237 CN:86 CO:57 CR:506 CU:53 CV:238 CW:599 CX:61 CY:357 CZ:420 DE:49 DJ:253 DK:45 DM:1767 DO:1809 DZ:213 EC:593 EE:372 EG:20 EH:212 ER:291 ES:34 ET:251 FI:358 FJ:679 FK:500 FM:691 FO:298 FR:33 GA:241 GB:44 GD:1473 GE:995 GF:594 GG:44 GH:233 GI:350 GL:299 GM:220 GN:224 GP:590 GQ:240 GR:30 GT:502 GU:1671 GW:245 GY:592 HK:852 HN:504 HR:385 HT:509 HU:36 ID:62 IE:353 IL:972 IM:44 IN:91 IO:246 IQ:964 IR:98 IS:354 IT:39 JE:44 JM:1876 JO:962 JP:81 KE:254 KG:996 KH:855 KI:686 KM:269 KN:1869 KP:850 KR:82 KW:965 KY:1345 KZ:7 LA:856 LB:961 LC:1758 LI:423 LK:94 LR:231 LS:266 LT:370 LU:352 LV:371 LY:218 MA:212 MC:377 MD:373 ME:382 MF:590 MG:261 MH:692 MK:389 ML:223 MM:95 MN:976 MO:853 MP:1670 MQ:596 MR:222 MS:1664 MT:356 MU:230 MV:960 MW:265 MX:52 MY:60 MZ:258 NA:264 NC:687 NE:227 NF:672 NG:234 NI:505 NL:31 NO:47 NP:977 NR:674 NU:683 NZ:64 OM:968 PA:507 PE:51 PF:689 PG:675 PH:63 PK:92 PL:48 PM:508 PR:1787 PS:970 PT:351 PW:680 PY:595 QA:974 RE:262 RO:40 RS:381 RU:7 RW:250 SA:966 SB:677 SC:248 SD:249 SE:46 SG:65 SH:290 SI:386 SJ:47 SK:421 SL:232 SM:378 SN:221 SO:252 SR:597 SS:211 ST:239 SV:503 SX:1721 SY:963 SZ:268 TC:1649 TD:235 TG:228 TH:66 TJ:992 TK:690 TL:670 TM:993 TN:216 TO:676 TR:90 TT:1868 TV:688 TW:886 TZ:255 UA:380 UG:256 US:1 UY:598 UZ:998 VA:39 VC:1784 VE:58 VG:1284 VI:1340 VN:84 VU:678 WF:681 WS:685 YE:967 YT:262 ZA:27 ZM:260 ZW:263";
function Ei(n) {
  return String.fromCodePoint(...[...n].map((l) => 127462 + l.charCodeAt(0) - 65));
}
const ue = $i.split(" ").map((n) => {
  const [l, a] = n.split(":");
  return { dial: a, flag: Ei(l), iso2: l };
}), Ii = new Map(ue.map((n) => [n.iso2, n]));
function Xe(n) {
  return Ii.get(n.toUpperCase());
}
function yt(n) {
  const l = n.replace(/\D/g, "");
  let a;
  for (const i of ue)
    l.startsWith(i.dial) && (!a || i.dial.length > a.dial.length) && (a = i);
  return a;
}
const Fe = /* @__PURE__ */ new Map();
function Bi(n) {
  const l = Fe.get(n);
  if (l) return l;
  let a;
  try {
    const i = new Intl.DisplayNames([n], { type: "region" });
    a = (t) => i.of(t) ?? t;
  } catch {
    a = (i) => i;
  }
  return Fe.set(n, a), a;
}
function se(n) {
  let l = "";
  for (const a of n) {
    const i = a.codePointAt(0) ?? 0;
    i >= 1776 && i <= 1785 ? l += String.fromCodePoint(i - 1776 + 48) : i >= 1632 && i <= 1641 ? l += String.fromCodePoint(i - 1632 + 48) : a >= "0" && a <= "9" && (l += a);
  }
  return l;
}
function Pi({
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
  const m = O(null), u = d.slice(0, s).split(""), h = Z((p) => {
    var y, D;
    const w = (y = m.current) == null ? void 0 : y.querySelectorAll("input");
    (D = w == null ? void 0 : w[Math.max(0, Math.min(p, w.length - 1))]) == null || D.focus();
  }, []);
  j(() => {
    n && h(0);
  }, [n, h]);
  const f = Z(
    (p, w) => {
      const y = p.slice(0, s);
      c(y), y.length === s ? o == null || o(y) : h(w);
    },
    [h, s, c, o]
  ), _ = Z(
    (p, w) => {
      const y = se(w);
      if (!y) return;
      const D = (d.slice(0, p) + y).slice(0, s);
      f(D, D.length);
    },
    [f, s, d]
  ), N = Z(
    (p, w) => {
      if (w.key === "Backspace") {
        w.preventDefault();
        const y = d[p] ? p : p - 1;
        if (y < 0) return;
        c(d.slice(0, y) + d.slice(y + 1)), h(y);
      } else w.key === "ArrowLeft" ? h(p - 1) : w.key === "ArrowRight" && h(p + 1);
    },
    [h, c, d]
  ), g = Z(
    (p) => {
      const w = se(p.clipboardData.getData("text"));
      w && (p.preventDefault(), f(w.slice(0, s), w.length));
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
        onPaste: g,
        ref: m,
        role: "group",
        children: Array.from({ length: s }, (p, w) => /* @__PURE__ */ e(
          "input",
          {
            "aria-invalid": i ? !0 : void 0,
            "aria-label": a ? a(w) : `${t} ${w + 1}`,
            autoComplete: w === 0 ? "one-time-code" : "off",
            className: "nim-otp__box",
            "data-filled": u[w] ? "true" : void 0,
            enterKeyHint: "done",
            inputMode: "numeric",
            onChange: (y) => _(w, y.target.value),
            onFocus: (y) => y.currentTarget.select(),
            onKeyDown: (y) => N(w, y),
            type: "text",
            value: u[w] ?? ""
          },
          w
        ))
      }
    ),
    i ? /* @__PURE__ */ e("p", { className: "nim-otp__error", role: "alert", children: i }) : null
  ] });
}
const Fi = {
  hide: "Hide password",
  show: "Show password",
  strength: (n) => `Password strength: ${n}`
}, Re = ["weak", "fair", "good", "strong"];
function Ri({
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
  const [m, u] = E(!1), h = { ...Fi, ...s };
  return /* @__PURE__ */ e(ee, { error: l, hint: a, id: i, label: t, required: c, children: ({ control: f, describedBy: _ }) => /* @__PURE__ */ r(K, { children: [
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
          type: m ? "text" : "password"
        }
      ),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-controls": f,
          "aria-label": m ? h.hide : h.show,
          "aria-pressed": m,
          className: "nim-password__toggle",
          onClick: () => u((N) => !N),
          type: "button",
          children: /* @__PURE__ */ e(T, { name: "eye", size: "sm" })
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
        children: Re.map((N, g) => /* @__PURE__ */ e(
          "span",
          {
            className: "nim-password__step",
            "data-on": g <= Re.indexOf(o) ? "true" : void 0
          },
          N
        ))
      }
    ) : null
  ] }) });
}
function kt(n) {
  if (n.length < 8) return "weak";
  const l = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((a) => a.test(n)).length;
  return n.length >= 14 && l >= 3 ? "strong" : n.length >= 10 && l >= 2 ? "good" : "fair";
}
const Oi = {
  noMatch: "No country matches",
  pickCountry: "Country code",
  search: "Search countries"
};
function Ui({
  className: n,
  country: l,
  error: a,
  hint: i,
  id: t,
  label: s,
  labels: c,
  locale: o,
  onChange: d,
  onCountryChange: m,
  onSubmit: u,
  placeholder: h,
  priority: f = [],
  required: _,
  value: N
}) {
  const g = J(), p = t ?? `nim-${g}`, w = i ? `${p}-hint` : void 0, y = a ? `${p}-error` : void 0, D = { ...Oi, ...c }, [I, k] = E(!1), [x, b] = E(""), S = O(null), C = O(null), $ = O(null), L = o ?? (typeof document > "u" ? "en" : document.documentElement.lang || "en"), A = Y(() => Bi(L), [L]), B = Xe(l) ?? ue[0], H = Y(() => {
    const M = new Intl.Collator(L), F = ue.map((z) => ({ ...z, name: A(z.iso2) })), W = (z) => {
      const R = f.indexOf(z);
      return R === -1 ? f.length : R;
    };
    return F.sort(
      (z, R) => W(z.iso2) - W(R.iso2) || M.compare(z.name, R.name)
    );
  }, [A, f, L]), G = Y(() => {
    const M = x.trim().toLocaleLowerCase(L);
    if (!M) return H;
    const F = se(M);
    return H.filter(
      (W) => W.name.toLocaleLowerCase(L).includes(M) || W.iso2.toLowerCase().includes(M) || (F ? W.dial.startsWith(F) : !1)
    );
  }, [H, x, L]);
  j(() => {
    var W;
    if (!I) return;
    (W = $.current) == null || W.focus();
    const M = (z) => {
      var R;
      (R = S.current) != null && R.contains(z.target) || k(!1);
    }, F = (z) => {
      var R;
      z.key === "Escape" && (k(!1), (R = C.current) == null || R.focus());
    };
    return document.addEventListener("mousedown", M), document.addEventListener("keydown", F), () => {
      document.removeEventListener("mousedown", M), document.removeEventListener("keydown", F);
    };
  }, [I]);
  const P = (M) => {
    var F;
    m(M), k(!1), b(""), (F = C.current) == null || F.focus();
  };
  return /* @__PURE__ */ r("div", { className: v("nim-field", a && "nim-field--invalid", n), children: [
    s ? /* @__PURE__ */ r("label", { className: "nim-field__label", htmlFor: p, children: [
      s,
      _ ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    /* @__PURE__ */ r("div", { className: "nim-phone", ref: S, children: [
      /* @__PURE__ */ r("div", { className: "nim-phone__shell", dir: "ltr", children: [
        /* @__PURE__ */ r(
          "button",
          {
            "aria-expanded": I,
            "aria-haspopup": "listbox",
            "aria-label": `${D.pickCountry}: ${A(B.iso2)} +${B.dial}`,
            className: "nim-phone__country",
            onClick: () => k((M) => !M),
            ref: C,
            type: "button",
            children: [
              /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-phone__flag", children: B.flag }),
              /* @__PURE__ */ r("span", { className: "nim-phone__dial", children: [
                "+",
                B.dial
              ] }),
              /* @__PURE__ */ e(T, { className: "nim-phone__caret", name: "chevron-down", size: "xs" })
            ]
          }
        ),
        /* @__PURE__ */ e(
          "input",
          {
            "aria-describedby": [y, w].filter(Boolean).join(" ") || void 0,
            "aria-invalid": a ? !0 : void 0,
            autoComplete: "tel-national",
            className: "nim-phone__input",
            enterKeyHint: "go",
            id: p,
            inputMode: "tel",
            onChange: (M) => d(se(M.target.value)),
            onKeyDown: (M) => {
              M.key === "Enter" && (u == null || u());
            },
            placeholder: h,
            required: _,
            type: "tel",
            value: N
          }
        )
      ] }),
      I ? /* @__PURE__ */ r("div", { className: "nim-phone__picker", children: [
        /* @__PURE__ */ r("div", { className: "nim-phone__search", children: [
          /* @__PURE__ */ e(T, { name: "search", size: "sm" }),
          /* @__PURE__ */ e(
            "input",
            {
              "aria-label": D.search,
              className: "nim-phone__search-input",
              onChange: (M) => b(M.target.value),
              placeholder: D.search,
              ref: $,
              type: "search",
              value: x
            }
          )
        ] }),
        /* @__PURE__ */ r("ul", { className: "nim-phone__list", role: "listbox", children: [
          G.map((M) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r(
            "button",
            {
              "aria-selected": M.iso2 === B.iso2,
              className: "nim-phone__option",
              onClick: () => P(M.iso2),
              role: "option",
              type: "button",
              children: [
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-phone__flag", children: M.flag }),
                /* @__PURE__ */ e("span", { className: "nim-phone__name", children: M.name }),
                /* @__PURE__ */ r("span", { className: "nim-phone__option-dial", dir: "ltr", children: [
                  "+",
                  M.dial
                ] })
              ]
            }
          ) }, M.iso2)),
          G.length === 0 ? /* @__PURE__ */ e("li", { className: "nim-phone__empty", children: D.noMatch }) : null
        ] })
      ] }) : null
    ] }),
    a ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: y, children: a }) : null,
    i && !a ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: w, children: i }) : null
  ] });
}
function Ki(n, l) {
  var i;
  return `+${((i = Xe(n)) == null ? void 0 : i.dial) ?? ""}${se(l).replace(/^0+/, "")}`;
}
const Hi = {
  excluded: "minus",
  included: "check",
  pending: "clock"
};
function Gi({
  badge: n,
  className: l,
  features: a = [],
  icon: i,
  name: t,
  onSelect: s,
  price: c,
  priceCaption: o,
  secondary: d,
  selected: m = !1,
  tagline: u
}) {
  const h = /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ r("div", { className: "nim-plan__top", children: [
      i ? /* @__PURE__ */ e("span", { className: "nim-plan__icon", children: /* @__PURE__ */ e(T, { name: i, size: "md" }) }) : null,
      /* @__PURE__ */ r("div", { className: "nim-plan__heading", children: [
        /* @__PURE__ */ e("span", { className: "nim-plan__name", children: t }),
        u ? /* @__PURE__ */ e("span", { className: "nim-plan__tagline", children: u }) : null
      ] }),
      n ? /* @__PURE__ */ e("span", { className: "nim-plan__badge", children: n }) : null,
      s ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-plan__radio", children: m ? /* @__PURE__ */ e(T, { name: "check", size: "xs" }) : null }) : null
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
      const g = _.state ?? "included";
      return /* @__PURE__ */ r("li", { className: "nim-plan__feature", "data-state": g, children: [
        /* @__PURE__ */ e(T, { name: Hi[g], size: "xs" }),
        /* @__PURE__ */ e("span", { className: "nim-plan__feature-label", children: _.label }),
        _.note ? /* @__PURE__ */ e("span", { className: "nim-plan__feature-note", children: _.note }) : null
      ] }, N);
    }) }) : null
  ] }), f = v("nim-plan", m && "nim-plan--selected", l);
  return s ? /* @__PURE__ */ e("button", { "aria-pressed": m, className: f, onClick: s, type: "button", children: h }) : /* @__PURE__ */ e("article", { className: f, children: h });
}
function Wi({
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
const Zi = {
  cycle: "Billing period",
  monthly: "Per month",
  price: "This package"
};
function wt({
  className: n,
  cycle: l,
  cycles: a = [],
  defaultCycle: i,
  defaultPlan: t,
  labels: s,
  note: c,
  onCycleChange: o,
  onPlanChange: d,
  onSubmit: m,
  plan: u,
  plans: h,
  submitLabel: f
}) {
  var b, S;
  const _ = { ...Zi, ...s }, [N, g] = E(i ?? ((b = a[0]) == null ? void 0 : b.id) ?? ""), [p, w] = E(t ?? ((S = h[0]) == null ? void 0 : S.id) ?? ""), y = l ?? N, D = u ?? p, I = (C) => {
    w(C), d == null || d(C);
  }, k = (C) => {
    g(C), o == null || o(C);
  }, x = a.find((C) => C.id === y);
  return /* @__PURE__ */ r("section", { className: v("nim-plan-picker", n), children: [
    a.length > 1 ? /* @__PURE__ */ r("div", { className: "nim-plan-picker__cycles", children: [
      /* @__PURE__ */ e(
        Wi,
        {
          fullWidth: !0,
          label: _.cycle,
          onChange: k,
          options: a.map((C) => ({ label: C.label, value: C.id })),
          value: y
        }
      ),
      x != null && x.note ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__save", children: x.note }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-plan-picker__plans", children: h.map(({ id: C, prices: $, ...L }) => {
      const A = $[y] ?? Object.values($)[0];
      return /* @__PURE__ */ sn(
        Gi,
        {
          ...L,
          key: C,
          onSelect: () => I(C),
          price: (A == null ? void 0 : A.price) ?? "",
          priceCaption: _.price,
          secondary: (A == null ? void 0 : A.monthly) === void 0 ? void 0 : { caption: _.monthly, value: A.monthly },
          selected: C === D
        }
      );
    }) }),
    f ? /* @__PURE__ */ r("div", { className: "nim-plan-picker__foot", children: [
      /* @__PURE__ */ e(
        X,
        {
          fullWidth: !0,
          onClick: () => m == null ? void 0 : m(D, y),
          size: "lg",
          variant: "accent",
          children: f
        }
      ),
      c ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__note", children: c }) : null
    ] }) : null
  ] });
}
function Yi({
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
function Ct({
  className: n,
  footer: l,
  sections: a = [],
  ...i
}) {
  return /* @__PURE__ */ r("div", { className: v("nim-profile-screen", n), children: [
    /* @__PURE__ */ e(Ya, { ...i }),
    a.map((t) => /* @__PURE__ */ r("section", { className: "nim-profile-screen__section", children: [
      t.title ? /* @__PURE__ */ e(Yi, { description: t.description, title: t.title }) : null,
      /* @__PURE__ */ e(zi, { children: t.rows.map((s) => /* @__PURE__ */ e(
        Li,
        {
          className: v(s.danger && "nim-list-row--danger"),
          href: s.href,
          leading: s.icon ? /* @__PURE__ */ e(T, { name: s.icon, size: "md" }) : void 0,
          onClick: s.onToggle ? void 0 : s.onSelect,
          subtitle: s.subtitle,
          title: s.label,
          trailing: s.onToggle ? (
            // The row's own title names the switch, so the control
            // carries the name rather than repeating the text beside
            // itself. A toggle row is a div, never a button — a switch
            // inside a button is two controls in one target.
            /* @__PURE__ */ e(
              Oa,
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
function xt({
  className: n,
  count: l = 5,
  label: a,
  onChange: i,
  readOnly: t = !1,
  size: s = "md",
  value: c
}) {
  const o = J(), [d, m] = E(null), u = d ?? c;
  return t || !i ? /* @__PURE__ */ e(
    "span",
    {
      "aria-label": `${a}: ${c}/${l}`,
      className: v("nim-rating", `nim-rating--${s}`, "nim-rating--static", n),
      role: "img",
      children: Array.from({ length: l }, (h, f) => /* @__PURE__ */ e(Oe, { fill: Math.min(Math.max(c - f, 0), 1) }, f))
    }
  ) : /* @__PURE__ */ r(
    "fieldset",
    {
      className: v("nim-rating", `nim-rating--${s}`, n),
      onMouseLeave: () => m(null),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-visually-hidden", children: a }),
        Array.from({ length: l }, (h, f) => {
          const _ = f + 1;
          return /* @__PURE__ */ r("label", { className: "nim-rating__star", onMouseEnter: () => m(_), children: [
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
            /* @__PURE__ */ e(Oe, { fill: Math.min(Math.max(u - f, 0), 1) })
          ] }, _);
        })
      ]
    }
  );
}
function Oe({ fill: n }) {
  return /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "nim-rating__glyph", children: [
    /* @__PURE__ */ e(T, { className: "nim-rating__outline", name: "star", size: "md" }),
    /* @__PURE__ */ e("span", { className: "nim-rating__fill", style: { inlineSize: `${n * 100}%` }, children: /* @__PURE__ */ e(T, { name: "star", size: "md" }) })
  ] });
}
const ji = {
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
}, ke = (n, l) => n instanceof Error && n.message.trim() ? n.message.trim() : l;
function Mt({
  brand: n,
  className: l,
  codeLength: a = 5,
  copy: i,
  defaultCountry: t = "IR",
  defaultMethod: s = "code",
  footer: c,
  methods: o = ["code", "password"],
  onPasswordSignIn: d,
  onRequestCode: m,
  onVerifyCode: u,
  priority: h = ["IR", "AE", "TR", "DE", "US", "GB"],
  resendSeconds: f = 60
}) {
  const _ = { ...ji, ...i }, [N, g] = E(
    o.includes(s) ? s : o[0]
  ), [p, w] = E(!1), [y, D] = E(t), [I, k] = E(""), [x, b] = E(""), [S, C] = E(""), [$, L] = E(""), [A, B] = E(!1), [H, G] = E(""), [P, M] = E(0), F = O(!1);
  j(() => {
    if (P <= 0) return;
    const V = window.setTimeout(() => M((ae) => ae - 1), 1e3);
    return () => window.clearTimeout(V);
  }, [P]);
  const W = Ki(y, I), z = I.replace(/\D/g, "").length >= 6, R = Z(
    async (V = !1) => {
      if (!(A || !V && !z)) {
        B(!0), G("");
        try {
          await (m == null ? void 0 : m(W)), w(!0), b(""), M(f);
        } catch (ae) {
          G(ke(ae, _.sendCode));
        } finally {
          B(!1);
        }
      }
    },
    [A, W, m, z, f, _.sendCode]
  ), q = Z(
    async (V) => {
      if (!(F.current || V.length !== a)) {
        F.current = !0, B(!0), G("");
        try {
          await (u == null ? void 0 : u(W, V));
        } catch (ae) {
          G(ke(ae, _.verify)), b("");
        } finally {
          F.current = !1, B(!1);
        }
      }
    },
    [a, W, u, _.verify]
  ), Q = Z(async () => {
    if (!(A || !S.trim() || !$)) {
      B(!0), G("");
      try {
        await (d == null ? void 0 : d(S.trim(), $));
      } catch (V) {
        G(ke(V, _.signIn));
      } finally {
        B(!1);
      }
    }
  }, [A, S, d, $, _.signIn]), re = o.length > 1 ? /* @__PURE__ */ e(
    X,
    {
      onClick: () => {
        g(N === "code" ? "password" : "code"), G("");
      },
      size: "sm",
      variant: "ghost",
      children: N === "code" ? _.usePassword : _.usePhone
    }
  ) : null, fe = H ? /* @__PURE__ */ e(qa, { tone: "danger", children: H }) : null;
  return N === "password" ? /* @__PURE__ */ r(
    ve,
    {
      action: {
        disabled: !S.trim() || !$,
        label: _.signIn,
        loading: A,
        onClick: () => void Q()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ r(K, { children: [
        re,
        c
      ] }),
      subtitle: _.passwordSubtitle,
      title: _.passwordTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          bi,
          {
            autoComplete: "username",
            label: _.identifierLabel,
            onChange: (V) => C(V.target.value),
            type: "email",
            value: S
          }
        ),
        /* @__PURE__ */ e(
          Ri,
          {
            autoComplete: "current-password",
            label: _.passwordLabel,
            onChange: (V) => L(V.target.value),
            onKeyDown: (V) => {
              V.key === "Enter" && Q();
            },
            value: $
          }
        )
      ]
    }
  ) : p ? /* @__PURE__ */ r(
    ve,
    {
      action: {
        disabled: x.length !== a,
        label: _.verify,
        loading: A,
        onClick: () => void q(x)
      },
      back: {
        label: _.back,
        onClick: () => {
          w(!1), b(""), G("");
        }
      },
      className: l,
      footer: /* @__PURE__ */ r(K, { children: [
        P > 0 ? /* @__PURE__ */ e("p", { children: _.resendIn(P) }) : /* @__PURE__ */ e(X, { onClick: () => void R(!0), size: "sm", variant: "ghost", children: _.resend }),
        c
      ] }),
      subtitle: _.codeSubtitle(W),
      title: _.codeTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          Pi,
          {
            autoFocus: !0,
            label: _.codeLabel,
            length: a,
            onChange: b,
            onComplete: (V) => void q(V),
            value: x
          }
        )
      ]
    }
  ) : /* @__PURE__ */ r(
    ve,
    {
      action: {
        disabled: !z,
        label: _.sendCode,
        loading: A,
        onClick: () => void R()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ r(K, { children: [
        re,
        c
      ] }),
      subtitle: _.phoneSubtitle,
      title: _.phoneTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          Ui,
          {
            country: y,
            label: _.phoneLabel,
            onChange: k,
            onCountryChange: D,
            onSubmit: () => void R(),
            priority: h,
            value: I
          }
        )
      ]
    }
  );
}
function Tt({ children: n, className: l, closeLabel: a = "Close", footer: i, onClose: t, open: s, title: c }) {
  const o = O(null), d = O(null), m = J();
  return j(() => {
    var f;
    if (!s) return;
    d.current = document.activeElement;
    const u = document.body.style.overflow;
    document.body.style.overflow = "hidden", (f = o.current) == null || f.focus();
    const h = (_) => {
      var w, y;
      if (_.key === "Escape" && t(), _.key !== "Tab") return;
      const N = (w = o.current) == null ? void 0 : w.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!(N != null && N.length)) {
        _.preventDefault(), (y = o.current) == null || y.focus();
        return;
      }
      const g = N[0], p = N[N.length - 1];
      _.shiftKey && document.activeElement === g ? (_.preventDefault(), p.focus()) : !_.shiftKey && document.activeElement === p && (_.preventDefault(), g.focus());
    };
    return window.addEventListener("keydown", h), () => {
      var _, N;
      document.body.style.overflow = u, window.removeEventListener("keydown", h), (N = (_ = d.current) == null ? void 0 : _.focus) == null || N.call(_);
    };
  }, [t, s]), !s || typeof document > "u" ? null : he(
    /* @__PURE__ */ r(K, { children: [
      /* @__PURE__ */ e("div", { className: "nim-sheet__scrim", onClick: t }),
      /* @__PURE__ */ r(
        "div",
        {
          "aria-label": c ? void 0 : a,
          "aria-labelledby": c ? m : void 0,
          "aria-modal": "true",
          className: v("nim-sheet__panel", l),
          ref: o,
          role: "dialog",
          tabIndex: -1,
          children: [
            /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-sheet__handle" }),
            c ? /* @__PURE__ */ r("div", { className: "nim-sheet__header", children: [
              /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", id: m, children: c }),
              /* @__PURE__ */ e(U, { label: a, name: "close", onClick: t, size: "sm" })
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
function St({
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
    t ? /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-inline", style: { justifyContent: "space-between" }, children: t.map((m) => /* @__PURE__ */ e("span", { className: "nim-caption", children: m }, m)) }) : null
  ] });
}
function Dt({ className: n, delta: l, deltaDirection: a = "up", label: i, unit: t, value: s, ...c }) {
  return /* @__PURE__ */ r("div", { className: v("nim-stat", n), ...c, children: [
    /* @__PURE__ */ r("p", { className: "nim-stat__value", children: [
      s,
      t ? /* @__PURE__ */ e("span", { className: "nim-stat__unit", children: t }) : null
    ] }),
    /* @__PURE__ */ e("p", { className: "nim-label nim-stat__label", children: i }),
    l ? /* @__PURE__ */ r("p", { className: "nim-stat__delta", "data-direction": a, children: [
      /* @__PURE__ */ e(T, { name: a === "up" ? "trend-up" : "trend-down", size: "xs" }),
      l
    ] }) : null
  ] });
}
function zt({ className: n, label: l = "Stages", stages: a }) {
  return /* @__PURE__ */ e("ol", { "aria-label": l, className: v("nim-stages", n), children: a.map((i, t) => {
    const s = /* @__PURE__ */ r(K, { children: [
      /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-stages__marker", children: i.status === "done" ? /* @__PURE__ */ e(T, { name: "check", size: "xs" }) : i.status === "blocked" ? /* @__PURE__ */ e(T, { name: "close", size: "xs" }) : t + 1 }),
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
function Lt({
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
  const m = (u) => Math.min(Math.max(u, s), t);
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
      onKeyDown: (u) => {
        u.key === "ArrowUp" && (u.preventDefault(), c(m(d + o))), u.key === "ArrowDown" && (u.preventDefault(), c(m(d - o)));
      },
      children: [
        /* @__PURE__ */ e(
          "button",
          {
            "aria-label": l,
            className: "nim-stepper__button",
            disabled: d <= s,
            onClick: () => c(m(d - o)),
            tabIndex: -1,
            type: "button",
            children: /* @__PURE__ */ e(T, { name: "minus", size: "sm" })
          }
        ),
        /* @__PURE__ */ e("span", { className: "nim-stepper__value", children: d }),
        /* @__PURE__ */ e(
          "button",
          {
            "aria-label": a,
            className: "nim-stepper__button",
            disabled: d >= t,
            onClick: () => c(m(d + o)),
            tabIndex: -1,
            type: "button",
            children: /* @__PURE__ */ e(T, { name: "plus", size: "sm" })
          }
        )
      ]
    }
  );
}
const Vi = {
  of: (n, l) => `${n} of ${l} steps`,
  status: {
    active: "In progress",
    done: "Done",
    failed: "Failed",
    pending: "Waiting",
    skipped: "Skipped"
  }
}, qi = {
  done: "check",
  failed: "close",
  pending: "clock",
  skipped: "minus"
};
function At({
  action: n,
  caption: l,
  className: a,
  labels: i,
  steps: t,
  title: s,
  value: c
}) {
  const o = { ...Vi, ...i }, d = t.filter((h) => h.status === "done" || h.status === "skipped").length, m = c ?? (t.length ? Math.round(d / t.length * 100) : 0), u = t.some((h) => h.status === "failed");
  return /* @__PURE__ */ r(
    "section",
    {
      "aria-live": "polite",
      className: v("nim-task", u && "nim-task--failed", a),
      children: [
        /* @__PURE__ */ r("header", { className: "nim-task__head", children: [
          s ? /* @__PURE__ */ e("h2", { className: "nim-task__title", children: s }) : null,
          l ? /* @__PURE__ */ e("p", { className: "nim-task__caption", children: l }) : null,
          /* @__PURE__ */ e(Ua, { label: o.of(d, t.length), value: m })
        ] }),
        /* @__PURE__ */ e("ol", { className: "nim-task__steps", children: t.map((h) => /* @__PURE__ */ r("li", { className: "nim-task__step", "data-status": h.status, children: [
          /* @__PURE__ */ e("span", { className: "nim-task__marker", children: h.status === "active" ? /* @__PURE__ */ e(Ge, { size: "sm" }) : /* @__PURE__ */ e(T, { name: qi[h.status], size: "xs" }) }),
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
function $t({ className: n, density: l = "default", entries: a }) {
  return /* @__PURE__ */ e("ol", { className: v("nim-timeline", l === "compact" && "nim-timeline--compact", n), children: a.map((i) => /* @__PURE__ */ r("li", { className: "nim-timeline__entry", "data-tone": i.tone, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-timeline__marker", children: i.icon ? /* @__PURE__ */ e(T, { name: i.icon, size: "xs" }) : /* @__PURE__ */ e("span", { className: "nim-timeline__dot" }) }),
    /* @__PURE__ */ r("div", { className: "nim-timeline__content", children: [
      /* @__PURE__ */ r("div", { className: "nim-timeline__head", children: [
        /* @__PURE__ */ e("span", { className: "nim-timeline__title", children: i.title }),
        i.time ? /* @__PURE__ */ e("time", { className: "nim-timeline__time", children: i.time }) : null
      ] }),
      i.body && l !== "compact" ? /* @__PURE__ */ e("div", { className: "nim-timeline__body", children: i.body }) : null
    ] })
  ] }, i.id)) });
}
function Et({ className: n, label: l, onChange: a, options: i, value: t, ...s }) {
  const c = O(null), o = (d) => {
    var _, N;
    const m = d.key === "ArrowRight" ? 1 : d.key === "ArrowLeft" ? -1 : 0;
    if (m === 0) return;
    d.preventDefault();
    const u = i.filter((g) => !g.disabled), h = u.findIndex((g) => g.value === t), f = u[(h + m + u.length) % u.length];
    f && (a(f.value), (N = (_ = c.current) == null ? void 0 : _.querySelector(`[data-value="${f.value}"]`)) == null || N.focus());
  };
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": l,
      className: v("nim-tabs", n),
      onKeyDown: o,
      ref: c,
      role: "tablist",
      ...s,
      children: i.map((d) => /* @__PURE__ */ r(
        "button",
        {
          "aria-selected": d.value === t,
          className: "nim-tab",
          "data-value": d.value,
          disabled: d.disabled,
          onClick: () => a(d.value),
          role: "tab",
          tabIndex: d.value === t ? 0 : -1,
          type: "button",
          children: [
            d.label,
            d.count === void 0 ? null : /* @__PURE__ */ e("span", { className: "nim-tab__count", children: d.count })
          ]
        },
        d.value
      ))
    }
  );
}
const Je = xe(null), Qi = {
  accent: "sparkle",
  danger: "danger",
  neutral: "info",
  success: "check-circle"
};
function It({ children: n }) {
  const [l, a] = E([]), i = O(0), t = Z((o) => {
    a((d) => d.filter((m) => m.id !== o));
  }, []), s = Z(
    (o) => {
      const d = i.current++;
      a((u) => [...u, { ...o, id: d }]);
      const m = o.duration ?? 4e3;
      m > 0 && window.setTimeout(() => t(d), m);
    },
    [t]
  ), c = Y(() => s, [s]);
  return /* @__PURE__ */ r(Je.Provider, { value: c, children: [
    n,
    typeof document < "u" ? he(
      /* @__PURE__ */ e("div", { "aria-live": "polite", className: "nim-toast-stack", children: l.map((o) => /* @__PURE__ */ r("div", { className: v("nim-toast", `nim-toast--${o.tone ?? "neutral"}`), children: [
        /* @__PURE__ */ e(T, { className: "nim-toast__icon", name: Qi[o.tone ?? "neutral"], size: "sm" }),
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
function Bt() {
  const n = Me(Je);
  if (!n) throw new Error("useToast must be used inside <ToastProvider>");
  return n;
}
function Pt({ children: n, className: l, label: a }) {
  return /* @__PURE__ */ r("span", { className: v("nim-tooltip", l), children: [
    n,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-tooltip__bubble", role: "tooltip", children: a })
  ] });
}
const Xi = {
  back: "Back",
  close: "Close",
  step: (n, l) => `Step ${n + 1} of ${l}`
};
function Ft({
  className: n,
  continueLabel: l,
  finishLabel: a,
  labels: i,
  onClose: t,
  onDone: s,
  onStep: c,
  steps: o
}) {
  const d = { ...Xi, ...i }, [m, u] = E(0), h = o[Math.min(m, o.length - 1)], f = m === o.length - 1, _ = Z(
    (N) => {
      u(N), c == null || c(N);
    },
    [c]
  );
  return /* @__PURE__ */ r("section", { className: v("nim-wizard", n), children: [
    /* @__PURE__ */ r("header", { className: "nim-wizard__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: m > 0 ? /* @__PURE__ */ e(U, { label: d.back, name: "chevron-back", onClick: () => _(m - 1), size: "sm" }) : null }),
      /* @__PURE__ */ e("ol", { "aria-label": d.step(m, o.length), className: "nim-wizard__dots", children: o.map((N, g) => /* @__PURE__ */ e(
        "li",
        {
          className: "nim-wizard__dot",
          "data-done": g < m ? "true" : void 0,
          "data-on": g === m ? "true" : void 0
        },
        N.id
      )) }),
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: t ? /* @__PURE__ */ e(U, { label: d.close, name: "close", onClick: t, size: "sm" }) : null })
    ] }),
    h.question ? /* @__PURE__ */ r("div", { className: "nim-wizard__ask", children: [
      /* @__PURE__ */ e("h1", { className: "nim-wizard__question", children: h.question }),
      h.subtitle ? /* @__PURE__ */ e("p", { className: "nim-wizard__subtitle", children: h.subtitle }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-wizard__content", children: h.content }),
    /* @__PURE__ */ e("footer", { className: "nim-wizard__foot", children: /* @__PURE__ */ e(
      X,
      {
        disabled: h.canContinue === !1,
        fullWidth: !0,
        onClick: () => f ? s() : _(m + 1),
        size: "lg",
        variant: "accent",
        children: h.continueLabel ?? (f ? a : l)
      }
    ) })
  ] });
}
function Rt({
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
    i(s.includes(d) ? s.filter((m) => m !== d) : [...s, d]);
  };
  return /* @__PURE__ */ e("div", { className: v("nim-choice-grid", n), role: a ? "group" : "radiogroup", children: t.map((d) => {
    const m = s.includes(d.id);
    return /* @__PURE__ */ r(
      "button",
      {
        "aria-checked": m,
        className: "nim-choice-grid__tile",
        "data-on": m ? "true" : void 0,
        disabled: d.disabled || c && !m,
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
const en = (n = "default") => n === "default" ? void 0 : `nim-text--${n}`;
function Ji({
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
Ji.Line = function({
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
function Ot({
  as: n = "h2",
  children: l,
  className: a,
  size: i = "lg",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-title", i === "md" && "nim-title--md", a), ...t, children: l });
}
function Ut({
  as: n = "p",
  children: l,
  className: a,
  size: i = "md",
  tone: t,
  ...s
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-body", i === "sm" && "nim-body--sm", en(t), a), ...s, children: l });
}
function Kt({ as: n = "span", children: l, className: a, ...i }) {
  return /* @__PURE__ */ e(n, { className: v("nim-label", a), ...i, children: l });
}
function Ht({ as: n = "p", children: l, className: a, tone: i, ...t }) {
  return /* @__PURE__ */ e(n, { className: v("nim-caption", en(i), a), ...t, children: l });
}
function Gt({ className: n, ...l }) {
  return /* @__PURE__ */ e("hr", { className: v("nim-rule", n), ...l });
}
export {
  Al as Accordion,
  Rl as ActionBar,
  ol as ActivityFeed,
  sl as AdminShell,
  Nt as AppFrame,
  $l as AppShell,
  Ul as AssistantThread,
  ve as AuthScreen,
  de as Avatar,
  El as AvatarRing,
  ja as Badge,
  qa as Banner,
  Ut as Body,
  Ml as Brand,
  Tl as BrandMark,
  Il as Breadcrumb,
  X as Button,
  ue as COUNTRIES,
  qe as Calendar,
  Ht as Caption,
  Bl as Card,
  rt as CausalChain,
  ct as Caveat,
  Kl as Chart,
  Ol as Chat,
  jl as ChatComposer,
  ze as Checkbox,
  Ni as Chip,
  Vl as ChipInput,
  Rt as ChoiceGrid,
  vl as CodeBlock,
  fl as Columns,
  nt as Combobox,
  dt as CommandList,
  Ql as CommandPalette,
  di as ConversationList,
  Cl as CopyChip,
  ql as DataList,
  Ll as DataTable,
  lt as DateField,
  tt as DatePicker,
  mt as DecideBar,
  rl as DetailHeader,
  xl as DetailLayout,
  st as Dialog,
  ot as Diff,
  Ji as Display,
  Pa as EmptyState,
  ut as ErrorBoundary,
  ht as EvidenceLedger,
  _t as EvidenceTrail,
  pl as Facts,
  Xl as Field,
  ft as FileDrop,
  cl as FilterChips,
  T as Icon,
  U as IconButton,
  bt as Inline,
  bi as Input,
  Kt as Label,
  zi as List,
  Li as ListRow,
  Zl as MapView,
  Yl as MediaPlayer,
  Le as Menu,
  Gl as Messenger,
  hl as Metric,
  _l as MetricGrid,
  gl as Mono,
  at as NimProvider,
  gt as Onboarding,
  Pl as OptionCard,
  Fl as OrderSummary,
  Pi as OtpInput,
  dl as Page,
  Ra as Pagination,
  ml as Panel,
  Ri as PasswordField,
  Ui as PhoneField,
  Gi as PlanCard,
  wt as PlanPicker,
  Xa as Popover,
  Ya as ProfileHeader,
  Ct as ProfileScreen,
  Ua as Progress,
  Dl as Radio,
  zl as RadioGroup,
  kl as Rail,
  wl as RailSection,
  xt as Rating,
  yl as RecordLink,
  pt as ResourceMeter,
  Wl as RoomHeader,
  Gt as Rule,
  Yi as SectionHeader,
  Wi as Segmented,
  et as Select,
  Tt as Sheet,
  Mt as SignInFlow,
  Ka as Skeleton,
  St as Slider,
  Hl as Sparkline,
  Ge as Spinner,
  vt as Stack,
  zt as StageTrack,
  Dt as Stat,
  bl as StatusDot,
  Nl as StatusHero,
  Lt as Stepper,
  Oa as Switch,
  Wa as TabBar,
  De as Table,
  Et as Tabs,
  At as TaskProgress,
  Jl as Textarea,
  $t as Timeline,
  Ot as Title,
  It as ToastProvider,
  ul as Toolbar,
  Pt as Tooltip,
  Ft as Wizard,
  ye as addDays,
  Ie as addMonths,
  Sl as brandFor,
  v as cn,
  yt as countryByDial,
  Xe as countryByIso2,
  Bi as countryNamer,
  Ce as formatNumeric,
  te as fromParts,
  tl as iconNames,
  Ve as monthLength,
  Si as parseNumeric,
  ne as partsOf,
  kt as scorePassword,
  wi as startOfMonth,
  se as toAsciiDigits,
  Ki as toE164,
  pe as todayIso,
  _e as useNim,
  it as useSchemeToggle,
  Bt as useToast
};
