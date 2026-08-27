import { jsx as e, jsxs as r, Fragment as G } from "react/jsx-runtime";
import { forwardRef as Oe, useState as L, useCallback as Z, createContext as Ce, useContext as xe, useId as J, Fragment as ke, useRef as U, useLayoutEffect as en, useEffect as V, useMemo as Y, createElement as nn } from "react";
import { Wallet as an, VolumeX as ln, Volume2 as tn, User as sn, Video as rn, Upload as cn, TrendingUp as on, TrendingDown as dn, Trash2 as mn, Sun as un, Star as hn, Sparkles as pn, CircleStop as _n, LogOut as fn, Share2 as Nn, Settings as bn, Send as vn, Search as gn, Plus as yn, Play as kn, Pin as wn, Pause as Cn, Paperclip as xn, Moon as Mn, Minus as Tn, Mic as Sn, Menu as zn, Lock as Dn, Loader as An, Info as Ln, Home as $n, Heart as En, Hash as In, Forward as Bn, Filter as Pn, Maximize2 as Fn, SmilePlus as Rn, MessageCircle as On, Eye as Un, ExternalLink as Gn, Pencil as Hn, Download as Kn, FileText as Wn, CircleAlert as Zn, Copy as Yn, X as jn, Clock as Vn, ChevronUp as qn, ChevronRight as Qn, ChevronDown as Xn, ChevronLeft as Jn, CircleCheck as ea, Check as na, Camera as aa, Calendar as ia, Bookmark as la, Bell as ta, Users as sa, Terminal as ra, Tag as ca, ShieldCheck as oa, Server as da, Reply as ma, RefreshCw as ua, Package as ha, MoreHorizontal as pa, Link2 as _a, Layers as fa, KeyRound as Na, Globe as ba, Database as va, Cloud as ga, BarChart3 as ya, ArrowRight as ka, ArrowLeft as wa, AlertTriangle as Ca, Activity as xa } from "lucide-react";
import { createPortal as he } from "react-dom";
const v = (...n) => n.filter(Boolean).join(" "), Ue = {
  activity: xa,
  alert: Ca,
  "arrow-back": wa,
  "arrow-forward": ka,
  chart: ya,
  cloud: ga,
  database: va,
  globe: ba,
  key: Na,
  layers: fa,
  link: _a,
  more: pa,
  package: ha,
  refresh: ua,
  reply: ma,
  server: da,
  shield: oa,
  tag: ca,
  terminal: ra,
  users: sa,
  bell: ta,
  bookmark: la,
  calendar: ia,
  camera: aa,
  check: na,
  "check-circle": ea,
  "chevron-back": Jn,
  "chevron-down": Xn,
  "chevron-forward": Qn,
  "chevron-up": qn,
  clock: Vn,
  close: jn,
  copy: Yn,
  danger: Zn,
  document: Wn,
  download: Kn,
  edit: Hn,
  external: Gn,
  eye: Un,
  chat: On,
  emoji: Rn,
  expand: Fn,
  filter: Pn,
  forward: Bn,
  hash: In,
  heart: En,
  home: $n,
  info: Ln,
  loading: An,
  lock: Dn,
  menu: zn,
  mic: Sn,
  minus: Tn,
  moon: Mn,
  paperclip: xn,
  pause: Cn,
  pin: wn,
  play: kn,
  plus: yn,
  search: gn,
  send: vn,
  settings: bn,
  share: Nn,
  "sign-out": fn,
  stop: _n,
  sparkle: pn,
  star: hn,
  sun: un,
  trash: mn,
  "trend-down": dn,
  "trend-up": on,
  upload: cn,
  video: rn,
  user: sn,
  volume: tn,
  "volume-off": ln,
  wallet: an
}, Ma = /* @__PURE__ */ new Set([
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
]), Te = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 };
function M({ className: n, label: l, name: i, size: a = "md", tone: t = "default", ...s }) {
  const d = Ue[i];
  return /* @__PURE__ */ e(
    d,
    {
      "aria-hidden": l ? void 0 : !0,
      "aria-label": l,
      className: v("nim-icon", n),
      "data-flip": Ma.has(i) ? "true" : void 0,
      "data-tone": t === "default" ? void 0 : t,
      focusable: "false",
      height: Te[a],
      role: l ? "img" : void 0,
      strokeWidth: 1.75,
      width: Te[a],
      ...s
    }
  );
}
const Ji = Object.keys(Ue), Ta = { sm: "sm", md: "md", lg: "md" }, O = Oe(function({ className: l, label: i, name: a, size: t = "md", type: s = "button", variant: d = "ghost", ...o }, c) {
  return /* @__PURE__ */ e(
    "button",
    {
      "aria-label": i,
      className: v("nim-icon-button", `nim-icon-button--${d}`, `nim-icon-button--${t}`, l),
      ref: c,
      title: i,
      type: s,
      ...o,
      children: /* @__PURE__ */ e(M, { name: a, size: Ta[t] })
    }
  );
}), Sa = {
  close: "Close menu",
  collapse: "Collapse",
  expand: "Expand",
  menu: "Open menu",
  nav: "Admin navigation"
};
function el({
  brand: n,
  children: l,
  className: i,
  collapsible: a = !1,
  groups: t,
  labels: s,
  navigation: d = "sidebar",
  sidebarFooter: o,
  title: c,
  toolbar: m,
  value: u,
  titleRole: h = "page"
}) {
  const _ = { ...Sa, ...s }, [p, N] = L(!1), [g, f] = L(!1), w = h === "scope" ? "div" : "h1", y = /* @__PURE__ */ e("nav", { "aria-label": _.nav, className: "nim-admin__nav", children: t.map((z) => /* @__PURE__ */ r("div", { className: "nim-admin__group", children: [
    /* @__PURE__ */ r("p", { className: "nim-admin__group-label", children: [
      z.icon ? /* @__PURE__ */ e(M, { name: z.icon, size: "xs" }) : null,
      z.label
    ] }),
    z.items.map((D) => {
      const I = D.key === u, T = /* @__PURE__ */ r(G, { children: [
        D.icon ? /* @__PURE__ */ e(M, { name: D.icon, size: "sm" }) : null,
        /* @__PURE__ */ e("span", { children: D.label })
      ] }), b = {
        "aria-current": I ? "page" : void 0,
        className: "nim-admin__link",
        "data-active": I ? "true" : void 0,
        onClick: () => {
          var k;
          (k = D.onSelect) == null || k.call(D), N(!1);
        },
        // The only text left in the rail is the icon, so the accessible
        // name has to survive the collapse — it is the label, always,
        // not a second string that can drift away from it.
        title: typeof D.label == "string" ? D.label : void 0
      };
      return D.href ? /* @__PURE__ */ e("a", { href: D.href, ...b, children: T }, D.key) : /* @__PURE__ */ e("button", { type: "button", ...b, children: T }, D.key);
    })
  ] }, z.key)) });
  return /* @__PURE__ */ r(
    "div",
    {
      className: v("nim-admin", i),
      "data-collapsed": a && g ? "true" : void 0,
      "data-drawer": p ? "open" : void 0,
      "data-navigation": d,
      children: [
        d === "sidebar" ? /* @__PURE__ */ r("aside", { className: "nim-admin__sidebar", children: [
          n || a ? /* @__PURE__ */ e("div", { className: "nim-admin__brand", children: n }) : null,
          y,
          o ? /* @__PURE__ */ e("div", { className: "nim-admin__sidebar-foot", children: o }) : null,
          a ? /* @__PURE__ */ r(
            "button",
            {
              "aria-label": g ? _.expand : _.collapse,
              "aria-expanded": !g,
              className: "nim-admin__rail-toggle",
              onClick: () => f((z) => !z),
              type: "button",
              children: [
                /* @__PURE__ */ e(M, { name: g ? "chevron-forward" : "chevron-back", size: "sm" }),
                /* @__PURE__ */ e("span", { children: g ? _.expand : _.collapse })
              ]
            }
          ) : null
        ] }) : null,
        /* @__PURE__ */ r("div", { className: "nim-admin__drawer", hidden: !p, children: [
          /* @__PURE__ */ e("div", { className: "nim-admin__scrim", onClick: () => N(!1) }),
          /* @__PURE__ */ r("div", { className: "nim-admin__drawer-panel", children: [
            /* @__PURE__ */ r("div", { className: "nim-admin__drawer-head", children: [
              n,
              /* @__PURE__ */ e(O, { label: _.close, name: "close", onClick: () => N(!1), size: "sm" })
            ] }),
            y
          ] })
        ] }),
        /* @__PURE__ */ r("div", { className: "nim-admin__workspace", children: [
          /* @__PURE__ */ r("header", { className: "nim-admin__topbar", children: [
            /* @__PURE__ */ e(
              O,
              {
                "aria-expanded": p,
                className: "nim-admin__menu",
                label: _.menu,
                name: "menu",
                onClick: () => N(!0),
                size: "sm"
              }
            ),
            d === "sections" && n ? /* @__PURE__ */ e("div", { className: "nim-admin__masthead-brand", children: n }) : null,
            c ? /* @__PURE__ */ e(w, { className: "nim-admin__title", children: c }) : null,
            m ? /* @__PURE__ */ e("div", { className: "nim-admin__toolbar", children: m }) : null
          ] }),
          d === "sections" ? /* @__PURE__ */ e("div", { className: "nim-admin__sections", children: y }) : null,
          /* @__PURE__ */ e("main", { className: "nim-admin__main", children: l })
        ] })
      ]
    }
  );
}
function nl({
  actions: n,
  back: l,
  className: i,
  meta: a,
  status: t,
  subtitle: s,
  title: d
}) {
  return /* @__PURE__ */ r("header", { className: v("nim-detail-header", i), children: [
    l ? l.href ? /* @__PURE__ */ r("a", { className: "nim-detail-header__back", href: l.href, children: [
      /* @__PURE__ */ e(M, { name: "chevron-back", size: "sm" }),
      l.label
    ] }) : /* @__PURE__ */ r("button", { className: "nim-detail-header__back", onClick: l.onClick, type: "button", children: [
      /* @__PURE__ */ e(M, { name: "chevron-back", size: "sm" }),
      l.label
    ] }) : null,
    /* @__PURE__ */ r("div", { className: "nim-detail-header__row", children: [
      /* @__PURE__ */ r("div", { className: "nim-detail-header__text", children: [
        /* @__PURE__ */ r("div", { className: "nim-detail-header__headline", children: [
          /* @__PURE__ */ e("h1", { className: "nim-detail-header__title", children: d }),
          t ? /* @__PURE__ */ e("span", { className: "nim-detail-header__status", children: t }) : null
        ] }),
        s ? /* @__PURE__ */ e("p", { className: "nim-detail-header__subtitle", children: s }) : null,
        a ? /* @__PURE__ */ e("p", { className: "nim-detail-header__meta", children: a }) : null
      ] }),
      n ? /* @__PURE__ */ e("div", { className: "nim-detail-header__actions", children: n }) : null
    ] })
  ] });
}
function al({
  chips: n,
  className: l,
  clearLabel: i,
  labels: a,
  onClearAll: t
}) {
  if (n.length === 0) return null;
  const s = {
    remove: (d) => `Remove filter ${d}`,
    toolbar: "Active filters",
    ...a
  };
  return /* @__PURE__ */ r("div", { "aria-label": s.toolbar, className: v("nim-filter-chips", l), role: "toolbar", children: [
    n.map((d) => /* @__PURE__ */ r("span", { className: "nim-filter-chip", children: [
      /* @__PURE__ */ r("span", { className: "nim-filter-chip__label", children: [
        d.label,
        d.value !== void 0 ? /* @__PURE__ */ r(G, { children: [
          ": ",
          d.value
        ] }) : null
      ] }),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": s.remove(typeof d.label == "string" ? d.label : d.key),
          className: "nim-filter-chip__remove",
          onClick: d.onRemove,
          type: "button",
          children: /* @__PURE__ */ e(M, { name: "close", size: "xs" })
        }
      )
    ] }, d.key)),
    t && i ? /* @__PURE__ */ e("button", { className: "nim-filter-chips__clear", onClick: t, type: "button", children: i }) : null
  ] });
}
function il({ className: n, empty: l, events: i, locale: a }) {
  const t = new Intl.DateTimeFormat(a, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
  return i.length === 0 ? /* @__PURE__ */ e("div", { className: v("nim-activity", n), children: l }) : /* @__PURE__ */ e("ol", { className: v("nim-activity", n), children: i.map((s) => /* @__PURE__ */ r("li", { className: "nim-activity__item", "data-tone": s.tone, children: [
    /* @__PURE__ */ e("span", { className: "nim-activity__marker", children: s.icon ? /* @__PURE__ */ e(M, { name: s.icon, size: "xs" }) : null }),
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
function ll({ children: n, className: l, width: i = "wide", ...a }) {
  return /* @__PURE__ */ e("div", { className: v("nim-page", l), "data-width": i, ...a, children: n });
}
function tl({
  actions: n,
  caption: l,
  children: i,
  className: a,
  description: t,
  eyebrow: s,
  flush: d = !1,
  footer: o,
  marker: c,
  title: m,
  ...u
}) {
  const h = m || l || t || s || n;
  return /* @__PURE__ */ r("section", { className: v("nim-panel", a), ...u, children: [
    h ? /* @__PURE__ */ r("header", { className: "nim-panel__head", children: [
      c ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-panel__marker", children: c }) : null,
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
    i ? /* @__PURE__ */ e("div", { className: "nim-panel__body", "data-flush": d ? "true" : void 0, children: i }) : null,
    o ? /* @__PURE__ */ e("div", { className: "nim-panel__foot", children: o }) : null
  ] });
}
function sl({ actions: n, children: l, className: i, ...a }) {
  return /* @__PURE__ */ r("div", { className: v("nim-toolbar", i), role: "toolbar", ...a, children: [
    l ? /* @__PURE__ */ e("div", { className: "nim-toolbar__group", children: l }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-toolbar__actions", children: n }) : null
  ] });
}
function rl({
  className: n,
  delta: l,
  deltaDirection: i = "up",
  deltaIntent: a = "more-is-better",
  hint: t,
  icon: s,
  label: d,
  layout: o = "stacked",
  onClick: c,
  tone: m = "neutral",
  value: u,
  ...h
}) {
  const _ = a === "more-is-better" ? i === "up" : i === "down";
  return /* @__PURE__ */ r(
    c ? "button" : "div",
    {
      className: v("nim-metric", c && "nim-metric--interactive", n),
      "data-layout": o === "stacked" ? void 0 : o,
      "data-tone": m === "neutral" ? void 0 : m,
      onClick: c,
      type: c ? "button" : void 0,
      ...h,
      children: [
        o === "inline" && s ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-metric__glyph", children: /* @__PURE__ */ e(M, { name: s, size: "sm" }) }) : null,
        /* @__PURE__ */ r("span", { className: "nim-metric__label", children: [
          o === "inline" ? null : s ? /* @__PURE__ */ e(M, { name: s, size: "xs" }) : null,
          d
        ] }),
        /* @__PURE__ */ e("span", { className: "nim-metric__value", children: u }),
        l || t ? /* @__PURE__ */ r("span", { className: "nim-metric__foot", children: [
          l ? /* @__PURE__ */ r("span", { className: "nim-metric__delta", "data-intent": _ ? "good" : "bad", children: [
            /* @__PURE__ */ e(M, { name: i === "up" ? "trend-up" : "trend-down", size: "xs" }),
            l
          ] }) : null,
          t ? /* @__PURE__ */ e("span", { className: "nim-metric__hint", children: t }) : null
        ] }) : null
      ]
    }
  );
}
function cl({ children: n, className: l, columns: i = 4, dense: a = !1, ...t }) {
  return /* @__PURE__ */ e(
    "div",
    {
      className: v("nim-metric-grid", l),
      "data-columns": i,
      "data-dense": a ? "true" : void 0,
      ...t,
      children: n
    }
  );
}
function ol({ className: n, columns: l = 2, items: i, ...a }) {
  return /* @__PURE__ */ e("dl", { className: v("nim-facts", n), "data-columns": l, ...a, children: i.map((t, s) => /* @__PURE__ */ r("div", { className: "nim-facts__item", children: [
    /* @__PURE__ */ e("dt", { className: "nim-facts__label", children: t.label }),
    /* @__PURE__ */ e("dd", { className: "nim-facts__value", "data-mono": t.mono ? "true" : void 0, children: t.value })
  ] }, t.key ?? s)) });
}
function dl({ children: n, className: l, template: i = "halves", ...a }) {
  return /* @__PURE__ */ e("div", { className: v("nim-columns", l), "data-template": i, ...a, children: n });
}
function ml({
  children: n,
  className: l,
  copiedLabel: i = "Copied",
  copyLabel: a = "Copy",
  label: t,
  wrap: s = !1,
  ...d
}) {
  const [o, c] = L(!1), m = typeof navigator < "u" && !!navigator.clipboard, u = Z(() => {
    navigator.clipboard.writeText(n).then(() => {
      c(!0), window.setTimeout(() => c(!1), 1600);
    });
  }, [n]);
  return /* @__PURE__ */ r("figure", { className: v("nim-code", l), children: [
    t || m ? /* @__PURE__ */ r("figcaption", { className: "nim-code__head", children: [
      t ? /* @__PURE__ */ e("span", { className: "nim-code__label", children: t }) : /* @__PURE__ */ e("span", {}),
      m ? /* @__PURE__ */ r("button", { className: "nim-code__copy", onClick: u, type: "button", children: [
        /* @__PURE__ */ e(M, { name: o ? "check" : "copy", size: "xs" }),
        o ? i : a
      ] }) : null
    ] }) : null,
    /* @__PURE__ */ e("pre", { className: "nim-code__body", "data-wrap": s ? "true" : void 0, tabIndex: 0, ...d, children: n })
  ] });
}
function ul({ children: n, className: l, pulse: i = !1, tone: a = "neutral", ...t }) {
  return /* @__PURE__ */ r("span", { className: v("nim-status", l), "data-tone": a, ...t, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-status__dot", "data-pulse": i ? "true" : void 0 }),
    n
  ] });
}
function hl({ children: n, className: l, size: i = "sm", ...a }) {
  return /* @__PURE__ */ e("code", { className: v("nim-mono", l), "data-size": i, ...a, children: n });
}
function pl({ className: n, href: l, meta: i, onClick: a, title: t }) {
  const s = /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ e("strong", { className: "nim-record__title", children: t }),
    i ? /* @__PURE__ */ e("span", { className: "nim-record__meta", children: i }) : null
  ] });
  return l ? /* @__PURE__ */ e("a", { className: v("nim-record", n), href: l, children: s }) : a ? /* @__PURE__ */ e("button", { className: v("nim-record", n), onClick: a, type: "button", children: s }) : /* @__PURE__ */ e("span", { className: v("nim-record", n), children: s });
}
function _l({ actions: n, children: l, className: i, footer: a, title: t, ...s }) {
  return /* @__PURE__ */ r("section", { className: v("nim-rail", i), ...s, children: [
    /* @__PURE__ */ r("header", { className: "nim-rail__head", children: [
      /* @__PURE__ */ e("h2", { className: "nim-rail__title", children: t }),
      n ? /* @__PURE__ */ e("div", { className: "nim-rail__actions", children: n }) : null
    ] }),
    /* @__PURE__ */ e("div", { className: "nim-rail__body", children: l }),
    a ? /* @__PURE__ */ e("div", { className: "nim-rail__foot", children: a }) : null
  ] });
}
function fl({ children: n, className: l, meta: i, title: a, tone: t = "neutral", ...s }) {
  return /* @__PURE__ */ r(
    "div",
    {
      className: v("nim-rail__section", l),
      "data-tone": t === "neutral" ? void 0 : t,
      ...s,
      children: [
        a ? /* @__PURE__ */ r("p", { className: "nim-rail__section-head", children: [
          /* @__PURE__ */ e("span", { className: "nim-rail__section-title", children: a }),
          i ? /* @__PURE__ */ e("span", { className: "nim-rail__section-meta", children: i }) : null
        ] }) : null,
        n
      ]
    }
  );
}
function Nl({
  children: n,
  className: l,
  copiedLabel: i = "Copied",
  copyLabel: a = "Copy",
  ...t
}) {
  const [s, d] = L(!1), o = typeof navigator < "u" && !!navigator.clipboard, c = Z(() => {
    navigator.clipboard.writeText(n).then(() => {
      d(!0), window.setTimeout(() => d(!1), 1600);
    });
  }, [n]);
  return /* @__PURE__ */ r("span", { className: v("nim-copy-chip", l), ...t, children: [
    /* @__PURE__ */ e("span", { className: "nim-copy-chip__value", children: n }),
    o ? /* @__PURE__ */ e(
      "button",
      {
        "aria-label": s ? i : `${a} ${n}`,
        className: "nim-copy-chip__button",
        onClick: c,
        type: "button",
        children: /* @__PURE__ */ e(M, { name: s ? "check" : "copy", size: "xs" })
      }
    ) : null
  ] });
}
function bl({ aside: n, children: l, className: i, ...a }) {
  return /* @__PURE__ */ r("div", { className: v("nim-detail", i), ...a, children: [
    /* @__PURE__ */ e("div", { className: "nim-detail__main", children: l }),
    n ? /* @__PURE__ */ e("aside", { className: "nim-detail__aside", children: n }) : null
  ] });
}
function vl({
  className: n,
  href: l,
  mark: i,
  name: a,
  nameAccent: t,
  size: s = "md",
  tagline: d,
  ...o
}) {
  const c = /* @__PURE__ */ r(G, { children: [
    i ? /* @__PURE__ */ e("span", { className: "nim-brand__mark", children: i }) : null,
    /* @__PURE__ */ r("span", { className: "nim-brand__text", children: [
      /* @__PURE__ */ r("strong", { className: "nim-brand__name", children: [
        a,
        t ? /* @__PURE__ */ e("span", { className: "nim-brand__name-accent", children: t }) : null
      ] }),
      d ? /* @__PURE__ */ e("small", { className: "nim-brand__tagline", children: d }) : null
    ] })
  ] }), m = v("nim-brand", n);
  return l ? /* @__PURE__ */ e("a", { className: m, "data-size": s, href: l, ...o, children: c }) : /* @__PURE__ */ e("span", { className: m, "data-size": s, ...o, children: c });
}
const za = {
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
}, Da = {
  gitea: /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ e("path", { d: "M7 4h7a6 6 0 0 1 0 12h-2" }),
    /* @__PURE__ */ e("circle", { cx: "7", cy: "8", r: "3" }),
    /* @__PURE__ */ e("path", { d: "M12 16v4" })
  ] }),
  github: /* @__PURE__ */ e("path", { d: "M12 2.6a9.4 9.4 0 0 0-3 18.3c.5.1.6-.2.6-.5v-1.7c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.8.8.1-.6.3-1.1.6-1.3-2.1-.2-4.3-1-4.3-4.6 0-1 .4-1.9 1-2.5-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.6.6.6 1 1.5 1 2.5 0 3.6-2.2 4.4-4.3 4.6.3.3.6.9.6 1.8v2.7c0 .3.2.6.7.5A9.4 9.4 0 0 0 12 2.6Z" }),
  gitlab: /* @__PURE__ */ e("path", { d: "m12 21-3.5-10.8H3.3L12 21l8.7-10.8h-5.2L12 21ZM8.5 10.2 6.6 4l-3.3 6.2h5.2Zm7 0L17.4 4l3.3 6.2h-5.2Z" }),
  grafana: /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ e("circle", { cx: "12", cy: "13", r: "5" }),
    /* @__PURE__ */ e("path", { d: "M12 4v4M6 6l2 3M18 6l-2 3" })
  ] }),
  jaeger: /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ e("circle", { cx: "12", cy: "12", r: "8" }),
    /* @__PURE__ */ e("circle", { cx: "12", cy: "12", r: "3" })
  ] }),
  loki: /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ e("path", { d: "M12 3 5 9v9h14V9l-7-6Z" }),
    /* @__PURE__ */ e("path", { d: "M9 18v-5h6v5" })
  ] }),
  mongodb: /* @__PURE__ */ e("path", { d: "M12 2.5c2.6 3.2 5 6 5 10 0 3.4-2.2 6.2-4.3 7.1L12 22l-.7-2.4C9.2 18.7 7 15.9 7 12.5c0-4 2.4-6.8 5-10Z" }),
  postgresql: /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ e("ellipse", { cx: "12", cy: "7", rx: "7", ry: "3.2" }),
    /* @__PURE__ */ e("path", { d: "M5 7v9c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2V7" }),
    /* @__PURE__ */ e("path", { d: "M5 12c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2" })
  ] }),
  prometheus: /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ e("path", { d: "M12 2c2.6 2.8 3.6 5 2.6 7.4C13.8 11.2 12 11.8 12 14" }),
    /* @__PURE__ */ e("circle", { cx: "12", cy: "14", r: "7" }),
    /* @__PURE__ */ e("path", { d: "M8 12h8" })
  ] }),
  redis: /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ e("path", { d: "m12 3 9 4-9 4-9-4 9-4Z" }),
    /* @__PURE__ */ e("path", { d: "m3 12 9 4 9-4M3 17l9 4 9-4" })
  ] }),
  valkey: /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ e("path", { d: "m12 3 9 4-9 4-9-4 9-4Z" }),
    /* @__PURE__ */ e("path", { d: "m3 12 9 4 9-4" })
  ] })
}, Aa = /* @__PURE__ */ new Set(["github", "gitlab", "mongodb"]), La = { lg: 32, md: 24, sm: 20 };
function gl({ className: n, label: l, name: i, size: a = "md", ...t }) {
  const s = Aa.has(i), d = La[a];
  return /* @__PURE__ */ e(
    "svg",
    {
      "aria-hidden": l ? void 0 : !0,
      "aria-label": l,
      className: v("nim-brand-mark", n),
      fill: s ? "currentColor" : "none",
      height: d,
      role: l ? "img" : void 0,
      stroke: s ? "none" : "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 1.6,
      style: { color: za[i] },
      viewBox: "0 0 24 24",
      width: d,
      ...t,
      children: Da[i]
    }
  );
}
function yl(n) {
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
const X = Oe(function({
  children: l,
  className: i,
  fullWidth: a = !1,
  iconEnd: t,
  iconStart: s,
  size: d = "md",
  variant: o = "primary",
  ...c
}, m) {
  const u = v(
    "nim-button",
    `nim-button--${o}`,
    `nim-button--${d}`,
    a && "nim-button--full",
    i
  ), h = /* @__PURE__ */ r(G, { children: [
    s ? /* @__PURE__ */ e(M, { name: s, size: "sm" }) : null,
    /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
    t ? /* @__PURE__ */ e(M, { name: t, size: "sm" }) : null
  ] });
  if ("href" in c && c.href !== void 0) {
    const { href: f, rel: w, target: y, ...z } = c;
    return /* @__PURE__ */ e(
      "a",
      {
        className: u,
        href: f,
        ref: m,
        rel: y === "_blank" ? w ?? "noreferrer" : w,
        target: y,
        ...z,
        children: h
      }
    );
  }
  const {
    disabled: _ = !1,
    loading: p = !1,
    type: N = "button",
    ...g
  } = c;
  return /* @__PURE__ */ r(
    "button",
    {
      "aria-busy": p || void 0,
      className: v(u, p && "nim-button--loading"),
      disabled: _ || p,
      ref: m,
      type: N,
      ...g,
      children: [
        p ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-button__spinner" }) : null,
        p ? /* @__PURE__ */ r(G, { children: [
          /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
          t ? /* @__PURE__ */ e(M, { name: t, size: "sm" }) : null
        ] }) : h
      ]
    }
  );
});
function $a({ actions: n, className: l, description: i, icon: a = "search", title: t, ...s }) {
  return /* @__PURE__ */ r("div", { className: v("nim-empty", l), ...s, children: [
    /* @__PURE__ */ e("span", { className: "nim-empty__icon", children: /* @__PURE__ */ e(M, { name: a, size: "md" }) }),
    /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: t }),
    i ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-empty__body", children: i }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-empty__actions", children: n }) : null
  ] });
}
const Ea = (n, l) => {
  if (l <= 7) return Array.from({ length: l }, (t, s) => s + 1);
  const i = /* @__PURE__ */ new Set([1, l, n, n - 1, n + 1]);
  n <= 3 && [2, 3, 4].forEach((t) => i.add(t)), n >= l - 2 && [l - 3, l - 2, l - 1].forEach((t) => i.add(t));
  const a = [...i].filter((t) => t >= 1 && t <= l).sort((t, s) => t - s);
  return a.flatMap((t, s) => s > 0 && t - a[s - 1] > 1 ? ["gap", t] : [t]);
};
function Ia({
  className: n,
  label: l = "Pagination",
  nextLabel: i = "Next page",
  onChange: a,
  page: t,
  pageCount: s,
  previousLabel: d = "Previous page",
  summary: o
}) {
  return /* @__PURE__ */ r("nav", { "aria-label": l, className: v("nim-pagination", n), children: [
    o ? /* @__PURE__ */ e("p", { className: "nim-pagination__summary", children: o }) : /* @__PURE__ */ e("span", {}),
    /* @__PURE__ */ r("div", { className: "nim-pagination__list", children: [
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": d,
          className: "nim-pagination__item",
          disabled: t <= 1,
          onClick: () => a(t - 1),
          type: "button",
          children: /* @__PURE__ */ e(M, { name: "chevron-back", size: "sm" })
        }
      ),
      Ea(t, s).map(
        (c, m) => c === "gap" ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-pagination__ellipsis", children: "…" }, `gap-${m}`) : /* @__PURE__ */ e(
          "button",
          {
            "aria-current": c === t ? "page" : void 0,
            className: "nim-pagination__item",
            onClick: () => a(c),
            type: "button",
            children: c
          },
          c
        )
      ),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": i,
          className: "nim-pagination__item",
          disabled: t >= s,
          onClick: () => a(t + 1),
          type: "button",
          children: /* @__PURE__ */ e(M, { name: "chevron-forward", size: "sm" })
        }
      )
    ] })
  ] });
}
function Se({ caption: n, className: l, columns: i, onSort: a, rowKey: t, rows: s, sort: d }) {
  return /* @__PURE__ */ e("div", { className: v("nim-table-wrap", l), children: /* @__PURE__ */ r("table", { className: "nim-table", children: [
    n ? /* @__PURE__ */ e("caption", { className: "nim-caption", children: n }) : null,
    /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ e("tr", { children: i.map((o) => {
      const c = (d == null ? void 0 : d.key) === o.key ? d.direction : void 0;
      return /* @__PURE__ */ e(
        "th",
        {
          "aria-sort": c,
          className: v(o.numeric && "nim-table__cell--numeric"),
          scope: "col",
          style: o.width ? { inlineSize: o.width } : void 0,
          children: o.sortable && a ? /* @__PURE__ */ r("button", { className: "nim-table__sort", onClick: () => a(o.key), type: "button", children: [
            o.header,
            c ? /* @__PURE__ */ e(M, { name: c === "ascending" ? "chevron-up" : "chevron-down", size: "xs" }) : null
          ] }) : o.header
        },
        o.key
      );
    }) }) }),
    /* @__PURE__ */ e("tbody", { children: s.map((o) => /* @__PURE__ */ e("tr", { children: i.map((c) => /* @__PURE__ */ e("td", { className: v(c.numeric && "nim-table__cell--numeric"), children: c.render(o) }, c.key)) }, t(o))) })
  ] }) });
}
function ze({ children: n, className: l, description: i, ...a }) {
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--checkbox", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", type: "checkbox", ...a }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-checkbox__box", children: /* @__PURE__ */ e(M, { name: "check", size: "xs" }) }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
function Ba({ children: n, className: l, description: i, ...a }) {
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--switch", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", role: "switch", type: "checkbox", ...a }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-switch__track", children: /* @__PURE__ */ e("span", { className: "nim-switch__thumb" }) }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
function kl({ children: n, className: l, description: i, ...a }) {
  const t = xe(Ge);
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--radio", l), children: [
    /* @__PURE__ */ e(
      "input",
      {
        ...a,
        checked: t ? t.value === a.value : a.checked,
        className: "nim-choice__input",
        name: (t == null ? void 0 : t.name) ?? a.name,
        onChange: (s) => {
          var d;
          t == null || t.onChange(s.target.value), (d = a.onChange) == null || d.call(a, s);
        },
        type: "radio"
      }
    ),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-radio__mark" }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
const Ge = Ce(null);
function wl({
  children: n,
  className: l,
  error: i,
  hint: a,
  label: t,
  layout: s = "stack",
  name: d,
  onChange: o,
  value: c
}) {
  const m = J(), u = d ?? `nim-radio-${m}`, h = a ? `${u}-hint` : void 0, _ = i ? `${u}-error` : void 0;
  return /* @__PURE__ */ e(Ge.Provider, { value: { name: u, onChange: o, value: c }, children: /* @__PURE__ */ r(
    "fieldset",
    {
      "aria-describedby": [_, h].filter(Boolean).join(" ") || void 0,
      "aria-invalid": i ? !0 : void 0,
      className: v("nim-radio-group", i && "nim-radio-group--invalid", l),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-radio-group__legend", children: t }),
        /* @__PURE__ */ e("div", { className: v("nim-radio-group__options", `nim-radio-group__options--${s}`), children: n }),
        i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: _, children: i }) : null,
        a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: h, children: a }) : null
      ]
    }
  ) });
}
function He({ className: n, label: l = "Loading", size: i = "md", ...a }) {
  return /* @__PURE__ */ e(
    "span",
    {
      className: v("nim-spinner", i !== "md" && `nim-spinner--${i}`, n),
      role: "status",
      ...a,
      children: /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: l })
    }
  );
}
function Pa({ className: n, label: l, value: i, ...a }) {
  const t = i === void 0, s = t ? 0 : Math.min(100, Math.max(0, i));
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": l,
      "aria-valuemax": 100,
      "aria-valuemin": 0,
      "aria-valuenow": t ? void 0 : s,
      className: v("nim-progress", t && "nim-progress--indeterminate", n),
      role: "progressbar",
      ...a,
      children: /* @__PURE__ */ e("div", { className: "nim-progress__fill", style: t ? void 0 : { inlineSize: `${s}%` } })
    }
  );
}
function Fa({ className: n, height: l = "1em", radius: i, width: a = "100%", ...t }) {
  return /* @__PURE__ */ e(
    "span",
    {
      "aria-hidden": "true",
      className: v("nim-skeleton", n),
      style: { blockSize: l, borderRadius: i, inlineSize: a },
      ...t
    }
  );
}
const Ra = (n) => Array.from({ length: n }, (l, i) => ({ __skeleton: i })), Oa = {
  selectAll: "Select all rows",
  selectRow: "Select row"
};
function Cl({
  caption: n,
  className: l,
  columns: i,
  empty: a,
  error: t,
  labels: s,
  loading: d = !1,
  onPageChange: o,
  onRetry: c,
  onSort: m,
  page: u,
  pageCount: h,
  refreshing: _ = !1,
  retryLabel: p = "Try again",
  rowKey: N,
  rows: g,
  selection: f,
  skeletonRows: w = 6,
  sort: y,
  summary: z,
  toolbar: D
}) {
  const I = { ...Oa, ...s }, T = g.length > 0 && f ? g.every((x) => f.isSelected(x)) : !1, b = f ? [
    {
      header: f.onToggleAll ? /* @__PURE__ */ e(
        ze,
        {
          "aria-label": I.selectAll,
          checked: T,
          onChange: (x) => {
            var S;
            return (S = f.onToggleAll) == null ? void 0 : S.call(f, x.currentTarget.checked);
          }
        }
      ) : /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: I.selectAll }),
      key: "__select",
      render: (x) => {
        var S;
        return /* @__PURE__ */ e(
          ze,
          {
            "aria-label": ((S = f.label) == null ? void 0 : S.call(f, x)) ?? I.selectRow,
            checked: f.isSelected(x),
            onChange: ($) => f.onToggle(x, $.currentTarget.checked)
          }
        );
      },
      width: "2.5rem"
    },
    ...i
  ] : i;
  let k;
  return t ? k = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: /* @__PURE__ */ e(
    $a,
    {
      actions: c ? /* @__PURE__ */ e(X, { onClick: c, size: "sm", variant: "secondary", children: p }) : void 0,
      icon: "danger",
      title: t
    }
  ) }) : d ? k = /* @__PURE__ */ e(
    Se,
    {
      caption: n,
      columns: b.map((x) => ({
        ...x,
        render: () => /* @__PURE__ */ e(Fa, { height: "0.9em", width: x.numeric ? "3rem" : "70%" }),
        sortable: !1
      })),
      rowKey: (x) => `skeleton-${x.__skeleton}`,
      rows: Ra(w)
    }
  ) : g.length === 0 ? k = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: a }) : k = /* @__PURE__ */ e(
    Se,
    {
      caption: n,
      columns: b,
      onSort: m,
      rowKey: N,
      rows: g,
      sort: y
    }
  ), /* @__PURE__ */ r("div", { className: v("nim-data-table", l), "data-refreshing": _ ? "true" : void 0, children: [
    D,
    /* @__PURE__ */ r("div", { className: "nim-data-table__body", children: [
      k,
      _ ? /* @__PURE__ */ e("span", { className: "nim-data-table__pulse", children: /* @__PURE__ */ e(M, { name: "loading", size: "xs" }) }) : null
    ] }),
    u && h && h > 1 && o ? /* @__PURE__ */ e(Ia, { onChange: o, page: u, pageCount: h, summary: z }) : z ? /* @__PURE__ */ e("p", { className: "nim-data-table__summary", children: z }) : null
  ] });
}
function xl({
  className: n,
  defaultOpen: l = [],
  items: i,
  mode: a = "multiple",
  onOpenChange: t,
  open: s,
  variant: d = "panel"
}) {
  const o = J(), [c, m] = L(l), u = s ?? c, h = (_) => {
    const p = u.includes(_), N = a === "single" ? p ? [] : [_] : p ? u.filter((g) => g !== _) : [...u, _];
    s || m(N), t == null || t(N);
  };
  return /* @__PURE__ */ e("div", { className: v("nim-accordion", `nim-accordion--${d}`, n), children: i.map((_) => {
    const p = u.includes(_.id), N = `${o}-${_.id}`;
    return /* @__PURE__ */ r("div", { className: "nim-accordion__item", "data-open": p || void 0, children: [
      /* @__PURE__ */ r(
        "button",
        {
          "aria-controls": N,
          "aria-expanded": p,
          className: "nim-accordion__trigger",
          disabled: _.disabled,
          id: `${N}-trigger`,
          onClick: () => h(_.id),
          type: "button",
          children: [
            /* @__PURE__ */ e("span", { className: "nim-accordion__title", children: _.title }),
            _.meta ? /* @__PURE__ */ e("span", { className: "nim-accordion__meta", children: _.meta }) : null,
            /* @__PURE__ */ e(M, { className: "nim-accordion__chevron", name: "chevron-down", size: "sm" })
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
              inert: p ? void 0 : "",
              children: _.content
            }
          )
        }
      )
    ] }, _.id);
  }) });
}
function Ua({ className: n, items: l, label: i, renderItem: a, value: t }) {
  return /* @__PURE__ */ e("nav", { "aria-label": i, className: v("nim-tab-bar", n), children: /* @__PURE__ */ e("div", { className: "nim-tab-bar__row", style: { "--nim-tab-count": l.length }, children: l.map((s) => {
    const d = s.key === t, o = /* @__PURE__ */ r(G, { children: [
      /* @__PURE__ */ e(M, { name: s.icon, size: s.center ? "lg" : "md" }),
      /* @__PURE__ */ e("span", { className: "nim-tab-bar__label", children: s.label })
    ] }), c = {
      "aria-current": d ? "page" : void 0,
      "aria-label": s.fullLabel ?? s.label,
      className: v("nim-tab-bar__item", s.center && "nim-tab-bar__item--center"),
      "data-active": d ? "true" : void 0
    };
    return a ? /* @__PURE__ */ e("div", { className: "nim-tab-bar__slot", children: a(s, o, c) }, s.key) : s.href ? /* @__PURE__ */ e("a", { href: s.href, ...c, children: o }, s.key) : /* @__PURE__ */ e("button", { onClick: s.onSelect, type: "button", ...c, children: o }, s.key);
  }) }) });
}
function Ml({ children: n, className: l, frame: i = "responsive", header: a, tabs: t }) {
  return /* @__PURE__ */ r("div", { className: v("nim-app-shell", l), "data-frame": i === "phone" ? "phone" : void 0, children: [
    a ? /* @__PURE__ */ e("header", { className: "nim-app-shell__header", children: a }) : null,
    /* @__PURE__ */ e("main", { className: "nim-app-shell__content", "data-has-tabs": t ? "true" : void 0, children: n }),
    t ? /* @__PURE__ */ e(Ua, { ...t }) : null
  ] });
}
function Ne({
  action: n,
  back: l,
  brand: i,
  children: a,
  className: t,
  footer: s,
  subtitle: d,
  title: o
}) {
  return /* @__PURE__ */ r("section", { className: v("nim-auth", t), children: [
    i ? /* @__PURE__ */ e("div", { className: "nim-auth__brand", children: i }) : null,
    /* @__PURE__ */ r("div", { className: "nim-auth__body", children: [
      l ? /* @__PURE__ */ e(X, { className: "nim-auth__back", iconStart: "chevron-back", onClick: l.onClick, size: "sm", variant: "ghost", children: l.label }) : null,
      /* @__PURE__ */ e("h1", { className: "nim-auth__title", children: o }),
      d ? /* @__PURE__ */ e("p", { className: "nim-auth__subtitle", children: d }) : null,
      /* @__PURE__ */ e("div", { className: "nim-auth__fields", children: a })
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
const Ga = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((l) => {
  var i;
  return ((i = l[0]) == null ? void 0 : i.toUpperCase()) ?? "";
}).join("");
function de({ className: n, name: l, shape: i = "round", size: a = "md", src: t, ...s }) {
  return /* @__PURE__ */ r(
    "span",
    {
      className: v("nim-avatar", a !== "md" && `nim-avatar--${a}`, i === "square" && "nim-avatar--square", n),
      ...s,
      children: [
        t ? /* @__PURE__ */ e("img", { alt: "", src: t }) : /* @__PURE__ */ e("span", { "aria-hidden": "true", children: Ga(l) }),
        /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: l })
      ]
    }
  );
}
function Tl({
  caption: n,
  className: l,
  initials: i,
  label: a,
  size: t = 96,
  src: s,
  value: d
}) {
  const o = Math.max(4, Math.round(t * 0.05)), c = (t - o) / 2, m = 2 * Math.PI * c, u = Math.min(100, Math.max(0, d)) / 100 * m;
  return /* @__PURE__ */ r(
    "div",
    {
      "aria-label": a,
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
              r: c,
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
              r: c,
              strokeDasharray: `${u} ${m}`,
              strokeLinecap: "round",
              strokeWidth: o
            }
          )
        ] }),
        /* @__PURE__ */ r("span", { className: "nim-avatar-ring__face", children: [
          s ? /* @__PURE__ */ e("img", { alt: "", className: "nim-avatar-ring__image", src: s }) : /* @__PURE__ */ e("span", { className: "nim-avatar-ring__initials", children: i }),
          n && !s ? /* @__PURE__ */ e("span", { className: "nim-avatar-ring__caption", children: n }) : null
        ] })
      ]
    }
  );
}
function Ha({
  actions: n,
  avatar: l,
  chips: i,
  className: a,
  eyebrow: t,
  name: s,
  stats: d = []
}) {
  return /* @__PURE__ */ r("section", { className: v("nim-profile-header", a), children: [
    /* @__PURE__ */ r("div", { className: "nim-profile-header__identity", children: [
      l,
      /* @__PURE__ */ r("div", { className: "nim-profile-header__who", children: [
        t ? /* @__PURE__ */ e("p", { className: "nim-profile-header__eyebrow", children: t }) : null,
        /* @__PURE__ */ e("h1", { className: "nim-profile-header__name", children: s }),
        i ? /* @__PURE__ */ e("div", { className: "nim-profile-header__chips", children: i }) : null
      ] })
    ] }),
    d.length ? /* @__PURE__ */ e("dl", { className: "nim-profile-header__stats", children: d.map((o, c) => /* @__PURE__ */ r("div", { className: "nim-profile-header__stat", children: [
      /* @__PURE__ */ e("dt", { className: "nim-profile-header__stat-label", children: o.label }),
      /* @__PURE__ */ e("dd", { className: "nim-profile-header__stat-value", children: o.value })
    ] }, c)) }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-profile-header__actions", children: n }) : null
  ] });
}
function Ka({
  children: n,
  className: l,
  dot: i = !1,
  pill: a = !1,
  size: t = "md",
  tone: s = "soft",
  variant: d = "neutral",
  ...o
}) {
  return /* @__PURE__ */ r(
    "span",
    {
      className: v(
        "nim-badge",
        `nim-badge--${d}`,
        `nim-badge--${s}`,
        t === "sm" && "nim-badge--sm",
        a && "nim-badge--pill",
        l
      ),
      ...o,
      children: [
        i ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-badge__dot" }) : null,
        n
      ]
    }
  );
}
const Wa = {
  accent: "sparkle",
  danger: "danger",
  info: "info",
  neutral: "info",
  success: "check-circle",
  warning: "alert"
};
function Za({
  action: n,
  children: l,
  className: i,
  icon: a,
  title: t,
  tone: s = "neutral",
  ...d
}) {
  return /* @__PURE__ */ r(
    "div",
    {
      className: v("nim-banner", `nim-banner--${s}`, i),
      role: s === "danger" ? "alert" : "status",
      ...d,
      children: [
        /* @__PURE__ */ e(M, { className: "nim-banner__icon", name: a ?? Wa[s], size: "sm" }),
        /* @__PURE__ */ r("div", { className: "nim-banner__content", children: [
          t ? /* @__PURE__ */ e("p", { className: "nim-banner__title", children: t }) : null,
          /* @__PURE__ */ e("div", { children: l })
        ] }),
        n ? /* @__PURE__ */ e("div", { className: "nim-banner__action", children: n }) : null
      ]
    }
  );
}
function Sl({ className: n, items: l, label: i = "Breadcrumb" }) {
  return /* @__PURE__ */ e("nav", { "aria-label": i, className: v("nim-breadcrumb", n), children: l.map((a, t) => {
    const s = t === l.length - 1;
    return /* @__PURE__ */ r(ke, { children: [
      t > 0 ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-breadcrumb__separator", children: /* @__PURE__ */ e(M, { name: "chevron-forward", size: "xs" }) }) : null,
      s || !a.href ? /* @__PURE__ */ e("span", { "aria-current": s ? "page" : void 0, className: "nim-breadcrumb__current", children: a.label }) : /* @__PURE__ */ e("a", { className: "nim-breadcrumb__link", href: a.href, children: a.label })
    ] }, a.label);
  }) });
}
function zl({
  as: n = "article",
  children: l,
  className: i,
  footer: a,
  header: t,
  interactive: s = !1,
  padding: d = "md",
  variant: o = "default",
  ...c
}) {
  return /* @__PURE__ */ r(
    n,
    {
      className: v(
        "nim-card",
        `nim-card--${o}`,
        `nim-card--pad-${d}`,
        s && "nim-card--interactive",
        i
      ),
      ...c,
      children: [
        t ? /* @__PURE__ */ e("div", { className: "nim-card__header", children: t }) : null,
        l,
        a ? /* @__PURE__ */ e("div", { className: "nim-card__footer", children: a }) : null
      ]
    }
  );
}
function Dl({
  badge: n,
  className: l,
  description: i,
  detail: a,
  disabled: t = !1,
  icon: s,
  name: d,
  onSelect: o,
  selected: c,
  title: m
}) {
  return /* @__PURE__ */ r("label", { className: v("nim-option-card", c && "nim-option-card--selected", l), children: [
    /* @__PURE__ */ e(
      "input",
      {
        checked: c,
        className: "nim-option-card__input",
        disabled: t,
        name: d,
        onChange: o,
        type: "radio"
      }
    ),
    s ? /* @__PURE__ */ e("span", { className: "nim-option-card__icon", children: /* @__PURE__ */ e(M, { name: s, size: "md" }) }) : null,
    /* @__PURE__ */ r("span", { className: "nim-option-card__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-option-card__title", children: m }),
      i ? /* @__PURE__ */ e("span", { className: "nim-option-card__description", children: i }) : null,
      c && a ? /* @__PURE__ */ e("span", { className: "nim-option-card__detail", children: a }) : null
    ] }),
    n ? /* @__PURE__ */ e("span", { className: "nim-option-card__badge", children: n }) : null,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-option-card__dot" })
  ] });
}
function Al({ className: n, items: l, title: i, totals: a = [] }) {
  return /* @__PURE__ */ r("section", { className: v("nim-summary", n), children: [
    i ? /* @__PURE__ */ e("h2", { className: "nim-summary__title", children: i }) : null,
    /* @__PURE__ */ e("dl", { className: "nim-summary__lines", children: l.map((t) => /* @__PURE__ */ r("div", { className: "nim-summary__line", children: [
      /* @__PURE__ */ r("dt", { children: [
        /* @__PURE__ */ e("span", { className: "nim-summary__label", children: t.label }),
        t.meta ? /* @__PURE__ */ e("span", { className: "nim-summary__meta", children: t.meta }) : null
      ] }),
      /* @__PURE__ */ e("dd", { className: "nim-summary__value", children: t.value })
    ] }, t.key)) }),
    a.length ? /* @__PURE__ */ r(G, { children: [
      /* @__PURE__ */ e("hr", { className: "nim-summary__rule" }),
      /* @__PURE__ */ e("dl", { className: "nim-summary__lines nim-summary__lines--totals", children: a.map((t) => /* @__PURE__ */ r(
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
function Ll({ action: n, className: l, note: i, total: a }) {
  return /* @__PURE__ */ r("div", { className: v("nim-action-bar", l), children: [
    /* @__PURE__ */ r("div", { className: "nim-action-bar__row", children: [
      a ? /* @__PURE__ */ r("div", { className: "nim-action-bar__total", children: [
        /* @__PURE__ */ e("span", { className: "nim-action-bar__total-label", children: a.label }),
        /* @__PURE__ */ e("strong", { className: "nim-action-bar__total-value", children: a.value })
      ] }) : null,
      /* @__PURE__ */ e("div", { className: "nim-action-bar__action", children: n })
    ] }),
    i ? /* @__PURE__ */ e("p", { className: "nim-action-bar__note", children: i }) : null
  ] });
}
function Ke(n, l, { onDismiss: i, open: a }) {
  const [t, s] = L({ left: 0, top: 0 }), d = U(null), o = Z(() => {
    const c = n.current, m = l.current;
    if (!c || !m) return;
    const u = c.getBoundingClientRect(), { height: h, width: _ } = m.getBoundingClientRect(), p = 4, N = 8, g = getComputedStyle(c).direction === "rtl", f = u.bottom + p, y = f + h > window.innerHeight && u.top - p - h > 0 ? u.top - p - h : f, z = g ? u.right - _ : u.left, D = Math.min(Math.max(z, N), window.innerWidth - _ - N);
    s({ left: D, top: y });
  }, [l, n]);
  return en(() => {
    a && o();
  }, [a, o]), V(() => {
    if (!a) return;
    d.current = document.activeElement;
    const c = (u) => {
      u.key === "Escape" && (u.stopPropagation(), i());
    }, m = (u) => {
      var _, p;
      const h = u.target;
      (_ = l.current) != null && _.contains(h) || (p = n.current) != null && p.contains(h) || i();
    };
    return window.addEventListener("keydown", c), window.addEventListener("pointerdown", m), window.addEventListener("resize", o), window.addEventListener("scroll", o, !0), () => {
      var u, h;
      window.removeEventListener("keydown", c), window.removeEventListener("pointerdown", m), window.removeEventListener("resize", o), window.removeEventListener("scroll", o, !0), (h = (u = d.current) == null ? void 0 : u.focus) == null || h.call(u);
    };
  }, [i, a, l, o, n]), t;
}
const Ya = (n) => n.kind === void 0 || n.kind === "action";
function De({ children: n, className: l, items: i, label: a }) {
  const [t, s] = L(!1), [d, o] = L(0), c = U(null), m = U(null), u = Ke(c, m, { onDismiss: () => s(!1), open: t }), _ = i.filter(Ya).filter((f) => !f.disabled), p = () => {
    o(0), s((f) => !f);
  }, N = (f) => {
    s(!1), f.onSelect();
  }, g = (f) => {
    if (_.length !== 0) {
      if (f.key === "ArrowDown" || f.key === "ArrowUp") {
        f.preventDefault();
        const w = f.key === "ArrowDown" ? 1 : -1;
        o((y) => (y + w + _.length) % _.length);
      }
      if (f.key === "Home" && (f.preventDefault(), o(0)), f.key === "End" && (f.preventDefault(), o(_.length - 1)), f.key === "Enter" || f.key === " ") {
        f.preventDefault();
        const w = _[d];
        w && N(w);
      }
    }
  };
  return /* @__PURE__ */ r(G, { children: [
    n({ open: t, ref: c, toggle: p }),
    t && typeof document < "u" ? he(
      /* @__PURE__ */ e(
        "div",
        {
          "aria-label": a,
          className: v("nim-menu", l),
          onKeyDown: g,
          ref: m,
          role: "menu",
          style: { insetBlockStart: u.top, insetInlineStart: u.left },
          tabIndex: -1,
          children: i.map((f, w) => f.kind === "separator" ? /* @__PURE__ */ e("hr", { className: "nim-menu__separator" }, `sep-${w}`) : f.kind === "heading" ? /* @__PURE__ */ e("p", { className: "nim-menu__label", children: f.label }, `head-${w}`) : /* @__PURE__ */ r(
            "button",
            {
              className: v("nim-menu__item", f.danger && "nim-menu__item--danger"),
              "data-active": _.indexOf(f) === d ? "true" : void 0,
              disabled: f.disabled,
              onClick: () => N(f),
              onPointerEnter: () => o(_.indexOf(f)),
              role: "menuitem",
              type: "button",
              children: [
                f.icon ? /* @__PURE__ */ e(M, { className: "nim-menu__icon", name: f.icon, size: "sm" }) : null,
                /* @__PURE__ */ e("span", { children: f.label }),
                f.shortcut ? /* @__PURE__ */ e("span", { className: "nim-menu__shortcut", children: f.shortcut }) : null
              ]
            },
            f.label
          ))
        }
      ),
      document.body
    ) : null
  ] });
}
function ja({ children: n, className: l, label: i, onClose: a, open: t, triggerRef: s }) {
  const d = U(null), o = Ke(s, d, { onDismiss: a, open: t });
  return !t || typeof document > "u" ? null : he(
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": i,
        className: v("nim-popover", l),
        ref: d,
        role: "dialog",
        style: { insetBlockStart: o.top, insetInlineStart: o.left },
        children: n
      }
    ),
    document.body
  );
}
const Va = {
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
}, qa = ["👍", "❤️", "😂", "😮", "😢", "🙏"], Ae = 1024, Qa = 864e5;
function Xa(n, l) {
  const i = ["B", "KB", "MB", "GB"];
  let a = n, t = 0;
  for (; a >= Ae && t < i.length - 1; )
    a /= Ae, t += 1;
  return `${new Intl.NumberFormat(l, { maximumFractionDigits: t === 0 ? 0 : 1 }).format(a)} ${i[t]}`;
}
function We(n, l) {
  const i = new Intl.NumberFormat(l, { minimumIntegerDigits: 2, useGrouping: !1 }), a = Math.max(0, Math.round(n));
  return `${new Intl.NumberFormat(l).format(Math.floor(a / 60))}:${i.format(a % 60)}`;
}
const ce = (n) => {
  const l = new Date(n);
  return new Date(l.getFullYear(), l.getMonth(), l.getDate()).getTime();
};
function Ja({
  attachment: n,
  labels: l,
  locale: i
}) {
  const a = U(null), [t, s] = L(!1), [d, o] = L(0), c = n.duration ?? 0, m = Y(
    () => n.waveform ?? Array.from({ length: 32 }, (h, _) => 0.35 + _ * 7 % 11 / 18),
    [n.waveform]
  ), u = c > 0 ? Math.min(1, d / c) : 0;
  return /* @__PURE__ */ r("div", { className: "nim-chat-voice", children: [
    /* @__PURE__ */ e(
      O,
      {
        label: t ? l.pause : l.play,
        name: t ? "pause" : "play",
        onClick: () => {
          const h = a.current;
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
        children: m.map((h, _) => /* @__PURE__ */ e(
          "span",
          {
            className: "nim-chat-voice__bar",
            "data-played": _ / m.length <= u ? "true" : void 0,
            style: { blockSize: `${Math.round(h * 100)}%` }
          },
          _
        ))
      }
    ),
    /* @__PURE__ */ e("span", { className: "nim-chat-voice__time", children: We(t || d ? Math.max(0, c - d) : c, i) }),
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
        ref: a,
        src: n.url
      }
    )
  ] });
}
function ei({
  attachment: n,
  labels: l,
  locale: i
}) {
  return n.kind === "voice" ? /* @__PURE__ */ e(Ja, { attachment: n, labels: l, locale: i }) : n.kind === "video" ? /* @__PURE__ */ r("figure", { className: "nim-chat-media", children: [
    /* @__PURE__ */ e("video", { controls: !0, playsInline: !0, poster: n.poster, preload: "metadata", src: n.url }),
    n.duration ? /* @__PURE__ */ e("figcaption", { className: "nim-chat-media__meta", children: We(n.duration, i) }) : null
  ] }) : n.kind === "image" ? /* @__PURE__ */ e("figure", { className: "nim-chat-media", children: /* @__PURE__ */ e("img", { alt: n.name ?? "", loading: "lazy", src: n.url }) }) : /* @__PURE__ */ r(
    "a",
    {
      className: "nim-chat-file",
      download: n.name,
      href: n.url,
      rel: "noreferrer",
      target: "_blank",
      children: [
        /* @__PURE__ */ e("span", { className: "nim-chat-file__icon", children: /* @__PURE__ */ e(M, { name: "document", size: "md" }) }),
        /* @__PURE__ */ r("span", { className: "nim-chat-file__text", children: [
          /* @__PURE__ */ e("span", { className: "nim-chat-file__name", children: n.name ?? l.download }),
          n.size !== void 0 ? /* @__PURE__ */ e("span", { className: "nim-chat-file__size", children: Xa(n.size, i) }) : null
        ] }),
        /* @__PURE__ */ e(M, { className: "nim-chat-file__action", name: "download", size: "sm" })
      ]
    }
  );
}
function ni({
  labels: n,
  message: l,
  onReact: i
}) {
  var a;
  return /* @__PURE__ */ e("ul", { className: "nim-chat-reactions", children: (a = l.reactions) == null ? void 0 : a.map((t) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r(
    "button",
    {
      "aria-pressed": t.mine ? "true" : "false",
      className: "nim-chat-reaction",
      disabled: !i,
      onClick: () => i == null ? void 0 : i(l, t.emoji),
      type: "button",
      children: [
        /* @__PURE__ */ e("span", { "aria-hidden": "true", children: t.emoji }),
        /* @__PURE__ */ e("span", { className: "nim-chat-reaction__count", children: t.count }),
        /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: n.react })
      ]
    }
  ) }, t.emoji)) });
}
function $l({
  actions: n,
  className: l,
  composer: i,
  footer: a,
  group: t = !1,
  header: s,
  labels: d,
  locale: o,
  messages: c,
  onJump: m,
  onReact: u,
  reactions: h = qa,
  runGap: _ = 300,
  typing: p
}) {
  const N = { ...Va, ...d }, g = U(null), f = U(!0), w = Y(
    () => new Intl.DateTimeFormat(o, { hour: "2-digit", minute: "2-digit" }),
    [o]
  ), y = Y(
    () => new Intl.DateTimeFormat(o, { day: "numeric", month: "long", weekday: "long" }),
    [o]
  ), z = Y(() => {
    const D = ce((/* @__PURE__ */ new Date()).toISOString());
    return c.map((I, T) => {
      const b = c[T - 1], k = c[T + 1], x = I.at ? ce(I.at) : null, S = b != null && b.at ? ce(b.at) : null, $ = x !== null && x !== S ? x === D ? N.today : x === D - Qa ? N.yesterday : y.format(new Date(I.at)) : null, E = (R, C) => {
        var P, W;
        return !!R && !(R != null && R.system) && !C.system && !!(R != null && R.own) == !!C.own && ((P = R == null ? void 0 : R.author) == null ? void 0 : P.name) === ((W = C.author) == null ? void 0 : W.name);
      }, B = (R, C) => !(R != null && R.at) || !C.at || Math.abs(new Date(C.at).getTime() - new Date(R.at).getTime()) <= _ * 1e3, H = $ !== null || !E(b, I) || !B(b, I), K = !k || (k.at ? ce(k.at) : null) !== x || !E(k, I) || !B(I, k);
      return { divider: $, first: H, last: K, message: I };
    });
  }, [y, c, _, N.today, N.yesterday]);
  return V(() => {
    const D = g.current;
    !D || !f.current || (D.scrollTop = D.scrollHeight);
  }, [c, p]), /* @__PURE__ */ r("section", { className: v("nim-chat", l), children: [
    s ? /* @__PURE__ */ e("header", { className: "nim-chat__header", children: s }) : null,
    /* @__PURE__ */ r(
      "div",
      {
        className: "nim-chat__scroll",
        onScroll: (D) => {
          const I = D.currentTarget;
          f.current = I.scrollHeight - I.scrollTop - I.clientHeight < 48;
        },
        ref: g,
        children: [
          /* @__PURE__ */ e("ol", { "aria-live": "polite", className: "nim-chat__list", children: z.map(({ divider: D, first: I, last: T, message: b }) => {
            var S, $;
            if (b.system)
              return /* @__PURE__ */ r(ke, { children: [
                D ? /* @__PURE__ */ e("li", { className: "nim-chat__day", children: D }) : null,
                /* @__PURE__ */ e("li", { className: "nim-chat__system", children: b.text })
              ] }, b.id);
            const k = (n == null ? void 0 : n(b)) ?? [], x = I && !b.own && (t || !!b.author);
            return /* @__PURE__ */ r(ke, { children: [
              D ? /* @__PURE__ */ e("li", { className: "nim-chat__day", children: D }) : null,
              /* @__PURE__ */ r(
                "li",
                {
                  className: v("nim-chat-message", b.own && "nim-chat-message--own"),
                  "data-first": I ? "true" : void 0,
                  "data-last": T ? "true" : void 0,
                  id: `nim-message-${b.id}`,
                  children: [
                    b.own ? null : /* @__PURE__ */ e("span", { className: "nim-chat-message__gutter", children: T && b.author ? /* @__PURE__ */ e(de, { name: b.author.name, size: "sm", src: b.author.avatar }) : null }),
                    /* @__PURE__ */ r("div", { className: "nim-chat-message__stack", children: [
                      x && b.author ? /* @__PURE__ */ e("span", { className: "nim-chat-message__author", children: b.author.name }) : null,
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
                            /* @__PURE__ */ e(M, { name: "trash", size: "xs" }),
                            " ",
                            N.deleted
                          ] }) : /* @__PURE__ */ r(G, { children: [
                            (S = b.attachments) == null ? void 0 : S.map((E, B) => /* @__PURE__ */ e(
                              ei,
                              {
                                attachment: E,
                                labels: N,
                                locale: o
                              },
                              `${b.id}-${B}`
                            )),
                            b.card ? /* @__PURE__ */ e("div", { className: "nim-chat-card", children: b.card }) : null,
                            b.text ? /* @__PURE__ */ e("p", { className: "nim-chat-message__text", children: b.text }) : null
                          ] })
                        ] }),
                        !b.deleted && (k.length > 0 || u) ? /* @__PURE__ */ r("div", { className: "nim-chat-message__tools", children: [
                          u ? /* @__PURE__ */ e(
                            De,
                            {
                              className: "nim-chat-picker",
                              items: h.map((E) => ({
                                label: E,
                                onSelect: () => u(b, E)
                              })),
                              label: N.react,
                              children: ({ ref: E, toggle: B }) => /* @__PURE__ */ e(
                                O,
                                {
                                  label: N.react,
                                  name: "emoji",
                                  onClick: B,
                                  ref: E,
                                  size: "sm"
                                }
                              )
                            }
                          ) : null,
                          k.length > 0 ? /* @__PURE__ */ e(De, { items: k, label: N.more, children: ({ ref: E, toggle: B }) => /* @__PURE__ */ e(
                            O,
                            {
                              label: N.more,
                              name: "more",
                              onClick: B,
                              ref: E,
                              size: "sm"
                            }
                          ) }) : null
                        ] }) : null
                      ] }),
                      ($ = b.reactions) != null && $.length ? /* @__PURE__ */ e(ni, { labels: N, message: b, onReact: u }) : null,
                      T ? /* @__PURE__ */ r("span", { className: "nim-chat-message__meta", children: [
                        b.at ? /* @__PURE__ */ e("time", { dateTime: b.at, children: w.format(new Date(b.at)) }) : null,
                        b.edited ? /* @__PURE__ */ e("span", { children: N.edited }) : null,
                        b.own && b.status ? /* @__PURE__ */ e("span", { className: "nim-chat-message__status", "data-status": b.status, children: b.status === "sending" ? /* @__PURE__ */ e(He, { size: "sm" }) : /* @__PURE__ */ e(
                          M,
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
          p ? /* @__PURE__ */ r("p", { className: "nim-chat__typing", children: [
            typeof p == "string" ? `${p} ${N.typing}` : N.typing,
            /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "nim-chat__dots", children: [
              /* @__PURE__ */ e("i", {}),
              /* @__PURE__ */ e("i", {}),
              /* @__PURE__ */ e("i", {})
            ] })
          ] }) : null,
          a ? /* @__PURE__ */ e("div", { className: "nim-chat__footer", children: a }) : null
        ]
      }
    ),
    i ? /* @__PURE__ */ e("div", { className: "nim-chat__composer", children: i }) : null
  ] });
}
const ai = {
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
function El({
  assistant: n,
  className: l,
  composer: i,
  empty: a,
  labels: t,
  onCopy: s,
  onRate: d,
  onRetry: o,
  onStop: c,
  turns: m
}) {
  const u = { ...ai, ...t }, h = U(null), _ = U(!0), [p, N] = L(null), g = m.some((f) => f.streaming);
  return V(() => {
    const f = h.current;
    !f || !_.current || (f.scrollTop = f.scrollHeight);
  }, [m]), /* @__PURE__ */ r("section", { className: v("nim-assistant", l), children: [
    /* @__PURE__ */ r(
      "div",
      {
        className: "nim-assistant__scroll",
        onScroll: (f) => {
          const w = f.currentTarget;
          _.current = w.scrollHeight - w.scrollTop - w.clientHeight < 48;
        },
        ref: h,
        children: [
          m.length === 0 && a ? /* @__PURE__ */ e("div", { className: "nim-assistant__empty", children: a }) : null,
          /* @__PURE__ */ e("ol", { "aria-live": "polite", className: "nim-assistant__list", children: m.map((f) => {
            var w, y;
            return /* @__PURE__ */ r("li", { className: "nim-turn", "data-role": f.role, children: [
              /* @__PURE__ */ e("span", { className: "nim-turn__mark", children: f.role === "assistant" ? /* @__PURE__ */ e("span", { className: "nim-turn__badge", children: /* @__PURE__ */ e(M, { name: (n == null ? void 0 : n.icon) ?? "sparkle", size: "sm" }) }) : null }),
              /* @__PURE__ */ r("div", { className: "nim-turn__body", children: [
                /* @__PURE__ */ e("span", { className: "nim-turn__who", children: f.role === "assistant" ? (n == null ? void 0 : n.name) ?? u.assistant : u.you }),
                (w = f.steps) != null && w.length ? /* @__PURE__ */ r("div", { className: "nim-turn__steps", children: [
                  /* @__PURE__ */ r(
                    "button",
                    {
                      "aria-expanded": p === f.id,
                      className: "nim-turn__steps-toggle",
                      onClick: () => N(p === f.id ? null : f.id),
                      type: "button",
                      children: [
                        /* @__PURE__ */ e(M, { name: p === f.id ? "chevron-down" : "chevron-forward", size: "xs" }),
                        u.steps,
                        /* @__PURE__ */ e("span", { className: "nim-turn__steps-count", children: f.steps.length })
                      ]
                    }
                  ),
                  /* @__PURE__ */ e(
                    "ul",
                    {
                      className: "nim-turn__step-list",
                      hidden: p !== f.id,
                      inert: p === f.id ? void 0 : "",
                      children: f.steps.map((z) => /* @__PURE__ */ r("li", { className: "nim-turn__step", "data-status": z.status, children: [
                        /* @__PURE__ */ e(
                          M,
                          {
                            name: z.status === "failed" ? "danger" : z.status === "running" ? "loading" : z.icon ?? "check",
                            size: "xs"
                          }
                        ),
                        /* @__PURE__ */ e("span", { children: z.label }),
                        z.detail ? /* @__PURE__ */ e("span", { className: "nim-turn__step-detail", children: z.detail }) : null
                      ] }, z.label))
                    }
                  )
                ] }) : null,
                /* @__PURE__ */ e("div", { className: "nim-turn__content", "data-streaming": f.streaming ? "true" : void 0, children: f.content }),
                (y = f.sources) != null && y.length ? /* @__PURE__ */ r("ul", { className: "nim-turn__sources", children: [
                  /* @__PURE__ */ e("li", { className: "nim-turn__sources-label", children: u.sources }),
                  f.sources.map((z, D) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r("a", { className: "nim-turn__source", href: z.href, rel: "noreferrer", target: "_blank", children: [
                    /* @__PURE__ */ e("span", { className: "nim-turn__source-index", children: D + 1 }),
                    z.title
                  ] }) }, D))
                ] }) : null,
                f.role === "assistant" && !f.streaming && (s || o || d) ? /* @__PURE__ */ r("div", { className: "nim-turn__actions", children: [
                  s ? /* @__PURE__ */ e(O, { label: u.copy, name: "copy", onClick: () => s(f), size: "sm" }) : null,
                  o ? /* @__PURE__ */ e(O, { label: u.retry, name: "refresh", onClick: () => o(f), size: "sm" }) : null,
                  d ? /* @__PURE__ */ r(G, { children: [
                    /* @__PURE__ */ e(O, { label: u.up, name: "trend-up", onClick: () => d(f, "up"), size: "sm" }),
                    /* @__PURE__ */ e(O, { label: u.down, name: "trend-down", onClick: () => d(f, "down"), size: "sm" })
                  ] }) : null
                ] }) : null
              ] })
            ] }, f.id);
          }) }),
          g && c ? /* @__PURE__ */ e("div", { className: "nim-assistant__stop", children: /* @__PURE__ */ r("button", { className: "nim-assistant__stop-button", onClick: c, type: "button", children: [
            /* @__PURE__ */ e(M, { name: "stop", size: "sm" }),
            u.stop
          ] }) }) : null
        ]
      }
    ),
    i ? /* @__PURE__ */ e("div", { className: "nim-assistant__composer", children: i }) : null
  ] });
}
const be = 600, Le = 8, ii = (n, l) => {
  const i = n / Math.max(1, l), a = 10 ** Math.floor(Math.log10(i || 1)), t = i / a;
  return (t > 5 ? 10 : t > 2 ? 5 : t > 1 ? 2 : 1) * a;
};
function Il({
  categories: n,
  className: l,
  format: i,
  height: a = 220,
  kind: t = "line",
  legend: s,
  locale: d,
  max: o,
  min: c,
  note: m,
  series: u,
  title: h
}) {
  const _ = J(), [p, N] = L(null), g = Y(
    () => i ?? ((b) => new Intl.NumberFormat(d).format(b)),
    [i, d]
  ), f = Y(() => {
    const b = u.flatMap((R) => R.values).filter((R) => R !== null), k = c ?? Math.min(...b, 0), x = o ?? Math.max(...b, 0), S = t === "bar" ? Math.min(0, k) : k, $ = x === S ? S + 1 : x, E = ii($ - S, 4), B = Math.floor(S / E) * E, H = Math.ceil($ / E) * E, K = [];
    for (let R = B; R <= H + E / 2; R += E) K.push(Number(R.toFixed(6)));
    return { bottom: B, ticks: K, top: H };
  }, [t, o, c, u]), w = a - Le * 2, y = (b) => Le + w - (b - f.bottom) / (f.top - f.bottom) * w, z = be / Math.max(1, n.length), D = (b) => z * b + z / 2, I = (b, k) => {
    let x = "", S = !1;
    if (b.forEach((H, K) => {
      if (H === null) {
        S = !1;
        return;
      }
      x += `${S ? "L" : "M"}${D(K).toFixed(2)} ${y(H).toFixed(2)}`, S = !0;
    }), !k || !x) return x;
    const $ = b.map((H, K) => H === null ? null : K).filter((H) => H !== null), E = $[0], B = $[$.length - 1];
    return `${x}L${D(B).toFixed(2)} ${y(f.bottom).toFixed(2)}L${D(E).toFixed(2)} ${y(f.bottom).toFixed(2)}Z`;
  }, T = z * 0.62 / u.length;
  return /* @__PURE__ */ r(
    "figure",
    {
      "aria-labelledby": h ? _ : void 0,
      className: v("nim-chart", l),
      "data-kind": t,
      children: [
        h || m ? /* @__PURE__ */ r("figcaption", { className: "nim-chart__head", children: [
          h ? /* @__PURE__ */ e("span", { className: "nim-chart__title", id: _, children: h }) : null,
          m ? /* @__PURE__ */ e("span", { className: "nim-chart__note", children: m }) : null
        ] }) : null,
        /* @__PURE__ */ r("div", { className: "nim-chart__frame", children: [
          /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-chart__axis", children: [...f.ticks].reverse().map((b) => /* @__PURE__ */ e("span", { className: "nim-chart__tick", children: g(b) }, b)) }),
          /* @__PURE__ */ r("div", { className: "nim-chart__plot", children: [
            /* @__PURE__ */ r(
              "svg",
              {
                "aria-hidden": "true",
                className: "nim-chart__svg",
                preserveAspectRatio: "none",
                style: { blockSize: `${a}px` },
                viewBox: `0 0 ${be} ${a}`,
                children: [
                  f.ticks.map((b) => /* @__PURE__ */ e(
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
                  u.map((b, k) => {
                    const x = `var(--nim-series-${b.series ?? k % 6 + 1})`;
                    return t === "bar" ? /* @__PURE__ */ e("g", { children: b.values.map(
                      (S, $) => S === null ? null : /* @__PURE__ */ e(
                        "rect",
                        {
                          className: "nim-chart__bar",
                          fill: x,
                          height: Math.abs(y(S) - y(Math.max(f.bottom, 0))),
                          width: T,
                          x: D($) - T * u.length / 2 + T * k,
                          y: Math.min(y(S), y(Math.max(f.bottom, 0)))
                        },
                        $
                      )
                    ) }, b.label) : /* @__PURE__ */ r("g", { children: [
                      t === "area" ? /* @__PURE__ */ e("path", { className: "nim-chart__area", d: I(b.values, !0), fill: x }) : null,
                      /* @__PURE__ */ e("path", { className: "nim-chart__line", d: I(b.values, !1), stroke: x }),
                      b.values.map(
                        (S, $) => S === null ? null : /* @__PURE__ */ e(
                          "circle",
                          {
                            className: "nim-chart__dot",
                            cx: D($),
                            cy: y(S),
                            "data-on": p === $ ? "true" : void 0,
                            fill: x,
                            r: 4
                          },
                          $
                        )
                      )
                    ] }, b.label);
                  })
                ]
              }
            ),
            /* @__PURE__ */ r("div", { className: "nim-chart__hits", children: [
              n.map((b, k) => /* @__PURE__ */ e(
                "button",
                {
                  className: "nim-chart__hit",
                  "data-on": p === k ? "true" : void 0,
                  onBlur: () => N(null),
                  onFocus: () => N(k),
                  onMouseEnter: () => N(k),
                  onMouseLeave: () => N(null),
                  type: "button",
                  children: /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: b })
                },
                k
              )),
              p !== null ? /* @__PURE__ */ r(
                "div",
                {
                  className: "nim-chart__tip",
                  style: { insetInlineStart: `${(p + 0.5) / n.length * 100}%` },
                  children: [
                    /* @__PURE__ */ e("span", { className: "nim-chart__tip-label", children: n[p] }),
                    u.map((b, k) => /* @__PURE__ */ r("span", { className: "nim-chart__tip-row", children: [
                      /* @__PURE__ */ e("i", { style: { background: `var(--nim-series-${b.series ?? k % 6 + 1})` } }),
                      /* @__PURE__ */ e("span", { className: "nim-chart__tip-name", children: b.label }),
                      /* @__PURE__ */ e("span", { className: "nim-chart__tip-value", children: b.values[p] === null ? "—" : g(b.values[p]) })
                    ] }, b.label))
                  ]
                }
              ) : null
            ] }),
            /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-chart__categories", children: n.map((b, k) => /* @__PURE__ */ e("span", { className: "nim-chart__category", children: b }, k)) })
          ] })
        ] }),
        s ?? u.length > 1 ? /* @__PURE__ */ e("ul", { "aria-hidden": "true", className: "nim-chart__legend", children: u.map((b, k) => /* @__PURE__ */ r("li", { className: "nim-chart__key", children: [
          /* @__PURE__ */ e("i", { style: { background: `var(--nim-series-${b.series ?? k % 6 + 1})` } }),
          b.label
        ] }, b.label)) }) : null,
        /* @__PURE__ */ r("table", { className: "nim-visually-hidden", children: [
          h ? /* @__PURE__ */ e("caption", { children: h }) : null,
          /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ r("tr", { children: [
            /* @__PURE__ */ e("th", { scope: "col" }),
            u.map((b) => /* @__PURE__ */ e("th", { scope: "col", children: b.label }, b.label))
          ] }) }),
          /* @__PURE__ */ e("tbody", { children: n.map((b, k) => /* @__PURE__ */ r("tr", { children: [
            /* @__PURE__ */ e("th", { scope: "row", children: b }),
            u.map((x) => /* @__PURE__ */ e("td", { children: x.values[k] === null ? "—" : g(x.values[k]) }, x.label))
          ] }, k)) })
        ] })
      ]
    }
  );
}
function Bl({ className: n, label: l, series: i = 1, values: a }) {
  const t = Math.min(...a), d = Math.max(...a) - t || 1, o = a.map((c, m) => {
    const u = m / Math.max(1, a.length - 1) * 100, h = 24 - (c - t) / d * 20 - 2;
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
        /* @__PURE__ */ e("path", { d: o, stroke: `var(--nim-series-${i})` })
      ]
    }
  );
}
const Ze = {
  back: "Back to conversations",
  channels: "Conversations",
  compose: "New conversation",
  members: "members",
  muted: "Muted",
  search: "Search conversations",
  unread: "unread"
}, li = {
  channel: "hash",
  direct: "user",
  group: "users"
};
function ti(n, l) {
  const i = new Date(n), a = /* @__PURE__ */ new Date(), t = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  return i.getTime() >= t ? new Intl.DateTimeFormat(l, { hour: "2-digit", minute: "2-digit" }).format(i) : i.getTime() >= t - 6 * 864e5 ? new Intl.DateTimeFormat(l, { weekday: "short" }).format(i) : new Intl.DateTimeFormat(l, { day: "numeric", month: "short" }).format(i);
}
function si({
  activeId: n,
  className: l,
  labels: i,
  locale: a,
  onSelect: t,
  sections: s
}) {
  const d = { ...Ze, ...i }, o = new Intl.NumberFormat(a);
  return /* @__PURE__ */ e("div", { className: v("nim-rooms", l), children: s.map((c) => /* @__PURE__ */ r("section", { className: "nim-rooms__section", children: [
    /* @__PURE__ */ e("p", { className: "nim-rooms__label", children: c.label }),
    /* @__PURE__ */ e("ul", { className: "nim-rooms__list", children: c.items.map((m) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r(
      "button",
      {
        "aria-current": m.id === n ? "true" : void 0,
        className: "nim-room",
        "data-unread": m.unread ? "true" : void 0,
        onClick: () => t == null ? void 0 : t(m),
        type: "button",
        children: [
          /* @__PURE__ */ e("span", { className: "nim-room__face", children: m.kind === "channel" ? /* @__PURE__ */ e("span", { className: "nim-room__glyph", children: /* @__PURE__ */ e(M, { name: "hash", size: "sm" }) }) : /* @__PURE__ */ e(de, { name: m.name, size: "sm", src: m.avatar }) }),
          /* @__PURE__ */ r("span", { className: "nim-room__body", children: [
            /* @__PURE__ */ r("span", { className: "nim-room__top", children: [
              /* @__PURE__ */ r("span", { className: "nim-room__name", children: [
                m.name,
                m.muted ? /* @__PURE__ */ e(M, { className: "nim-room__mute", label: d.muted, name: "volume-off", size: "xs" }) : null
              ] }),
              m.at ? /* @__PURE__ */ e("span", { className: "nim-room__at", children: ti(m.at, a) }) : null
            ] }),
            /* @__PURE__ */ r("span", { className: "nim-room__bottom", children: [
              /* @__PURE__ */ e("span", { className: "nim-room__preview", "data-typing": m.typing ? "true" : void 0, children: m.typing ?? m.preview }),
              m.unread ? /* @__PURE__ */ r(Ka, { size: "sm", tone: "solid", variant: m.muted ? "neutral" : "accent", children: [
                o.format(m.unread),
                /* @__PURE__ */ r("span", { className: "nim-visually-hidden", children: [
                  " ",
                  d.unread
                ] })
              ] }) : m.members ? /* @__PURE__ */ r("span", { className: "nim-room__members", children: [
                /* @__PURE__ */ e(M, { name: li[m.kind], size: "xs" }),
                o.format(m.members)
              ] }) : null
            ] })
          ] })
        ]
      }
    ) }, m.id)) })
  ] }, c.key)) });
}
function Pl({
  activeId: n,
  brand: l,
  children: i,
  className: a,
  labels: t,
  locale: s,
  onBack: d,
  onCompose: o,
  onSelect: c,
  search: m,
  sections: u
}) {
  const h = { ...Ze, ...t };
  return /* @__PURE__ */ r("div", { className: v("nim-messenger", a), "data-open": n ? "true" : void 0, children: [
    /* @__PURE__ */ r("aside", { "aria-label": h.channels, className: "nim-messenger__rail", children: [
      /* @__PURE__ */ r("div", { className: "nim-messenger__rail-head", children: [
        l,
        o ? /* @__PURE__ */ e(O, { label: h.compose, name: "plus", onClick: o, size: "sm", variant: "outline" }) : null
      ] }),
      m ? /* @__PURE__ */ e("div", { className: "nim-messenger__search", children: m }) : null,
      /* @__PURE__ */ e("div", { className: "nim-messenger__rail-scroll", children: /* @__PURE__ */ e(
        si,
        {
          activeId: n,
          labels: t,
          locale: s,
          onSelect: c,
          sections: u
        }
      ) })
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-messenger__thread", children: [
      d ? /* @__PURE__ */ e(
        O,
        {
          className: "nim-messenger__back",
          label: h.back,
          name: "chevron-back",
          onClick: d,
          size: "sm"
        }
      ) : null,
      i
    ] })
  ] });
}
function Fl({ actions: n, avatar: l, className: i, kind: a = "direct", members: t, meta: s, name: d }) {
  return /* @__PURE__ */ r("div", { className: v("nim-room-head", i), children: [
    a === "channel" ? /* @__PURE__ */ e("span", { className: "nim-room__glyph", children: /* @__PURE__ */ e(M, { name: "hash", size: "sm" }) }) : /* @__PURE__ */ e(de, { name: d, size: "md", src: l }),
    /* @__PURE__ */ r("div", { className: "nim-room-head__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-room-head__name", children: d }),
      s ? /* @__PURE__ */ e("span", { className: "nim-room-head__meta", children: s }) : null
    ] }),
    t != null && t.length ? /* @__PURE__ */ e("ul", { className: "nim-facepile", children: t.slice(0, 6).map((o) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ e(de, { name: o.name, size: "sm", src: o.avatar }) }, o.name)) }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-room-head__actions", children: n }) : null
  ] });
}
const ri = {
  map: "Map",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out"
}, ve = (n) => {
  const i = Math.max(-85.05112878, Math.min(85.05112878, n)) * Math.PI / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + i / 2)) / (2 * Math.PI);
}, ci = (n, l) => {
  const i = l.west, a = l.east < l.west ? l.east + 360 : l.east, t = n.lng < i ? n.lng + 360 : n.lng, s = ve(l.north), d = ve(l.south);
  return {
    x: (t - i) / (a - i) * 100,
    y: (ve(n.lat) - s) / (d - s) * 100
  };
};
function Rl({
  attribution: n,
  bounds: l,
  className: i,
  controls: a,
  labels: t,
  markers: s = [],
  onSelect: d,
  onZoom: o,
  ratio: c = 16 / 10,
  tiles: m,
  title: u
}) {
  const h = { ...ri, ...t }, _ = J();
  return /* @__PURE__ */ r(
    "section",
    {
      "aria-labelledby": _,
      className: v("nim-map", i),
      style: { aspectRatio: `${c}` },
      children: [
        /* @__PURE__ */ e("h3", { className: "nim-visually-hidden", id: _, children: u }),
        /* @__PURE__ */ e("div", { className: "nim-map__tiles", children: m }),
        /* @__PURE__ */ e("ul", { className: "nim-map__markers", children: s.map((p) => {
          const N = ci(p, l), g = { insetBlockStart: `${N.y}%`, insetInlineStart: `${N.x}%` };
          return /* @__PURE__ */ e("li", { className: "nim-map__marker", "data-self": p.self ? "true" : void 0, style: g, children: d ? /* @__PURE__ */ r("button", { className: "nim-map__pin", "data-tone": p.tone, onClick: () => d(p), type: "button", children: [
            p.self ? /* @__PURE__ */ e("span", { className: "nim-map__dot" }) : /* @__PURE__ */ e(M, { name: "globe", size: "sm" }),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: p.label })
          ] }) : /* @__PURE__ */ r("span", { className: "nim-map__pin", "data-tone": p.tone, children: [
            p.self ? /* @__PURE__ */ e("span", { className: "nim-map__dot" }) : /* @__PURE__ */ e(M, { name: "globe", size: "sm" }),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: p.label })
          ] }) }, p.id);
        }) }),
        o || a ? /* @__PURE__ */ r("div", { className: "nim-map__controls", children: [
          a,
          o ? /* @__PURE__ */ r(G, { children: [
            /* @__PURE__ */ e(O, { label: h.zoomIn, name: "plus", onClick: () => o(1), size: "sm", variant: "solid" }),
            /* @__PURE__ */ e(O, { label: h.zoomOut, name: "minus", onClick: () => o(-1), size: "sm", variant: "solid" })
          ] }) : null
        ] }) : null,
        n ? /* @__PURE__ */ e("p", { className: "nim-map__attribution", children: n }) : null
      ]
    }
  );
}
const oi = {
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
  const i = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0, a = new Intl.NumberFormat(l, { minimumIntegerDigits: 2, useGrouping: !1 }), t = new Intl.NumberFormat(l), s = Math.floor(i / 3600), d = Math.floor(i % 3600 / 60), o = i % 60;
  return s > 0 ? `${t.format(s)}:${a.format(d)}:${a.format(o)}` : `${t.format(d)}:${a.format(o)}`;
}
function Ol({
  autoPlay: n = !1,
  className: l,
  kind: i = "audio",
  labels: a,
  locale: t,
  onError: s,
  poster: d,
  rates: o = [1, 1.5, 2],
  src: c,
  title: m,
  waveform: u
}) {
  const h = { ...oi, ...a }, _ = U(null), p = U(null), [N, g] = L(!1), [f, w] = L(0), [y, z] = L(0), [D, I] = L(0), [T, b] = L(n), [k, x] = L(1), [S, $] = L(1), E = y > 0 ? f / y : 0, B = Y(() => u ?? null, [u]), H = Z(() => {
    const C = _.current;
    C && (C.paused ? C.play() : C.pause());
  }, []);
  V(() => {
    const C = _.current;
    C && (C.playbackRate = S);
  }, [S]);
  const K = (C) => {
    const P = C.buffered;
    I(P.length ? P.end(P.length - 1) : 0);
  }, R = {
    onDurationChange: (C) => z(Number.isFinite(C.currentTarget.duration) ? C.currentTarget.duration : 0),
    onEnded: () => g(!1),
    onPause: () => g(!1),
    onPlay: () => g(!0),
    onProgress: (C) => K(C.currentTarget),
    onTimeUpdate: (C) => w(C.currentTarget.currentTime),
    onVolumeChange: (C) => {
      b(C.currentTarget.muted), x(C.currentTarget.volume);
    },
    onError: s
  };
  return /* @__PURE__ */ r(
    "div",
    {
      className: v("nim-player", l),
      "data-kind": i,
      "data-playing": N ? "true" : void 0,
      ref: p,
      children: [
        i === "video" ? /* @__PURE__ */ r("div", { className: "nim-player__stage", children: [
          /* @__PURE__ */ e(
            "video",
            {
              autoPlay: n,
              className: "nim-player__video",
              muted: n,
              playsInline: !0,
              poster: d,
              preload: "metadata",
              ref: (C) => {
                _.current = C;
              },
              src: c,
              ...R
            }
          ),
          /* @__PURE__ */ e(
            "button",
            {
              "aria-label": N ? h.pause : h.play,
              className: "nim-player__surface",
              onClick: H,
              type: "button",
              children: N ? null : /* @__PURE__ */ e("span", { className: "nim-player__badge", children: /* @__PURE__ */ e(M, { name: "play", size: "lg" }) })
            }
          )
        ] }) : /* @__PURE__ */ e(
          "audio",
          {
            autoPlay: n,
            preload: "metadata",
            ref: (C) => {
              _.current = C;
            },
            src: c,
            ...R
          }
        ),
        /* @__PURE__ */ r("div", { className: "nim-player__transport", children: [
          /* @__PURE__ */ e(
            O,
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
              B ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__wave", children: B.map((C, P) => /* @__PURE__ */ e(
                "i",
                {
                  "data-played": P / B.length <= E ? "true" : void 0,
                  style: { blockSize: `${Math.max(8, Math.round(C * 100))}%` }
                },
                P
              )) }) : /* @__PURE__ */ r(G, { children: [
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__buffer", style: { inlineSize: `${y ? D / y * 100 : 0}%` } }),
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__played", style: { inlineSize: `${E * 100}%` } })
              ] }),
              /* @__PURE__ */ e(
                "input",
                {
                  "aria-label": h.seek,
                  "aria-valuetext": `${oe(f, t)} / ${oe(y, t)}`,
                  className: "nim-player__seek",
                  max: y || 0,
                  min: 0,
                  onChange: (C) => {
                    const P = Number(C.target.value);
                    w(P), _.current && (_.current.currentTime = P);
                  },
                  step: "any",
                  type: "range",
                  value: f
                }
              )
            ] }),
            /* @__PURE__ */ r("span", { className: "nim-player__times", children: [
              /* @__PURE__ */ e("time", { children: oe(f, t) }),
              /* @__PURE__ */ e("time", { children: oe(y, t) })
            ] })
          ] }),
          /* @__PURE__ */ r("div", { className: "nim-player__side", children: [
            o.length > 1 ? /* @__PURE__ */ r(
              "button",
              {
                "aria-label": h.rate,
                className: "nim-player__rate",
                onClick: () => $(o[(o.indexOf(S) + 1) % o.length] ?? 1),
                type: "button",
                children: [
                  new Intl.NumberFormat(t).format(S),
                  "×"
                ]
              }
            ) : null,
            /* @__PURE__ */ e(
              O,
              {
                label: T ? h.unmute : h.mute,
                name: T || k === 0 ? "volume-off" : "volume",
                onClick: () => {
                  const C = _.current;
                  C && (C.muted = !C.muted);
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
                onChange: (C) => {
                  const P = _.current;
                  P && (P.volume = Number(C.target.value), P.muted = Number(C.target.value) === 0);
                },
                step: 0.05,
                type: "range",
                value: T ? 0 : k
              }
            ),
            i === "video" ? /* @__PURE__ */ e(
              O,
              {
                label: h.fullscreen,
                name: "expand",
                onClick: () => {
                  var C, P;
                  document.fullscreenElement ? document.exitFullscreen() : (P = (C = p.current) == null ? void 0 : C.requestFullscreen) == null || P.call(C);
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
const di = {
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
}, mi = () => {
  var n;
  return typeof navigator < "u" && typeof window < "u" && "MediaRecorder" in window && !!((n = navigator.mediaDevices) != null && n.getUserMedia);
}, ui = (n) => n.type.startsWith("video/") ? "video" : n.type.startsWith("image/") ? "image" : "file";
function Ul({
  accept: n,
  allow: l,
  className: i,
  disabled: a = !1,
  labels: t,
  onCancelReply: s,
  onFiles: d,
  onSend: o,
  onTyping: c,
  placeholder: m,
  replyTo: u
}) {
  const h = { ...di, ...t }, _ = { file: !0, video: !0, voice: !0, ...l }, [p, N] = L(""), [g, f] = L([]), [w, y] = L(!1), [z, D] = L(0), [I] = L(mi), T = U([]), b = U(null), k = U(null), x = U(null), S = U(0), $ = U([]), E = U(null), B = Z(() => {
    var A;
    (A = x.current) == null || A.stream.getTracks().forEach((F) => F.stop()), x.current = null;
  }, []);
  V(() => B, [B]), V(() => {
    var A;
    u && ((A = E.current) == null || A.focus());
  }, [u]), V(() => {
    if (!w) return;
    const A = window.setInterval(() => D((Date.now() - S.current) / 1e3), 200);
    return () => window.clearInterval(A);
  }, [w]);
  const H = Z(
    (A) => {
      if (!(A != null && A.length)) return;
      const F = Array.from(A);
      T.current = [...T.current, ...F], f((q) => [
        ...q,
        ...F.map((Q) => ({
          kind: ui(Q),
          name: Q.name,
          size: Q.size,
          url: URL.createObjectURL(Q)
        }))
      ]);
    },
    []
  ), K = Z(async () => {
    try {
      const A = await navigator.mediaDevices.getUserMedia({ audio: !0 }), F = new MediaRecorder(A);
      $.current = [], F.ondataavailable = (q) => {
        q.data.size && $.current.push(q.data);
      }, F.onstop = () => {
        const q = new Blob($.current, { type: F.mimeType }), Q = new File([q], "voice-message", { type: F.mimeType });
        T.current = [...T.current, Q], f((re) => [
          ...re,
          {
            duration: (Date.now() - S.current) / 1e3,
            kind: "voice",
            size: q.size,
            url: URL.createObjectURL(q)
          }
        ]), B();
      }, x.current = F, F.start(), S.current = Date.now(), D(0), y(!0);
    } catch {
      y(!1), B();
    }
  }, [B]), R = Z(
    (A) => {
      const F = x.current;
      y(!1), F && (A || (F.onstop = B), F.stop());
    },
    [B]
  ), C = (A) => {
    f((F) => (URL.revokeObjectURL(F[A].url), F.filter((q, Q) => Q !== A))), T.current = T.current.filter((F, q) => q !== A);
  }, P = () => {
    var A;
    !p.trim() && g.length === 0 || (o({ attachments: g, text: p.trim() }), d == null || d(T.current), T.current = [], f([]), N(""), (A = E.current) == null || A.focus());
  }, W = !p.trim() && g.length === 0;
  return /* @__PURE__ */ r("div", { className: v("nim-composer", i), children: [
    u ? /* @__PURE__ */ r("div", { className: "nim-composer__reply", children: [
      /* @__PURE__ */ e(M, { className: "nim-composer__reply-mark", name: "reply", size: "sm" }),
      /* @__PURE__ */ r("span", { className: "nim-composer__reply-text", children: [
        /* @__PURE__ */ r("span", { className: "nim-composer__reply-author", children: [
          h.replyingTo,
          " ",
          u.author
        ] }),
        /* @__PURE__ */ e("span", { className: "nim-composer__reply-quote", children: u.text })
      ] }),
      /* @__PURE__ */ e(O, { label: h.cancelReply, name: "close", onClick: s, size: "sm" })
    ] }) : null,
    g.length ? /* @__PURE__ */ e("ul", { className: "nim-composer__tray", children: g.map((A, F) => /* @__PURE__ */ r("li", { className: "nim-composer__chip", children: [
      /* @__PURE__ */ e(
        M,
        {
          name: A.kind === "voice" ? "mic" : A.kind === "video" ? "video" : A.kind === "image" ? "camera" : "document",
          size: "xs"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-composer__chip-name", children: A.name ?? h.record }),
      /* @__PURE__ */ e(
        O,
        {
          label: h.discard,
          name: "close",
          onClick: () => C(F),
          size: "sm"
        }
      )
    ] }, A.url)) }) : null,
    /* @__PURE__ */ e("div", { className: "nim-composer__row", children: w ? /* @__PURE__ */ r("div", { className: "nim-composer__recording", role: "status", children: [
      /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-composer__pulse" }),
      /* @__PURE__ */ e("span", { className: "nim-composer__recording-label", children: h.recording }),
      /* @__PURE__ */ r("span", { className: "nim-composer__elapsed", children: [
        z.toFixed(1),
        "s"
      ] }),
      /* @__PURE__ */ e(
        O,
        {
          label: h.cancel,
          name: "close",
          onClick: () => R(!1),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e(
        O,
        {
          label: h.stop,
          name: "stop",
          onClick: () => R(!0),
          size: "sm",
          variant: "solid"
        }
      )
    ] }) : /* @__PURE__ */ r(G, { children: [
      _.file ? /* @__PURE__ */ e(
        O,
        {
          disabled: a,
          label: h.attach,
          name: "paperclip",
          onClick: () => {
            var A;
            return (A = b.current) == null ? void 0 : A.click();
          },
          size: "sm"
        }
      ) : null,
      _.video ? /* @__PURE__ */ e(
        O,
        {
          disabled: a,
          label: h.video,
          name: "video",
          onClick: () => {
            var A;
            return (A = k.current) == null ? void 0 : A.click();
          },
          size: "sm"
        }
      ) : null,
      /* @__PURE__ */ e(
        "textarea",
        {
          className: "nim-composer__input",
          disabled: a,
          onChange: (A) => {
            N(A.target.value), c == null || c();
          },
          onKeyDown: (A) => {
            A.key === "Enter" && !A.shiftKey && (A.preventDefault(), P());
          },
          placeholder: m,
          ref: E,
          rows: 1,
          value: p
        }
      ),
      _.voice && I && W ? /* @__PURE__ */ e(
        O,
        {
          disabled: a,
          label: h.record,
          name: "mic",
          onClick: () => void K(),
          size: "sm"
        }
      ) : /* @__PURE__ */ e(
        O,
        {
          disabled: a || W,
          label: h.send,
          name: "send",
          onClick: P,
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
        onChange: (A) => {
          H(A.target.files), A.target.value = "";
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
        onChange: (A) => {
          H(A.target.files), A.target.value = "";
        },
        ref: k,
        tabIndex: -1,
        type: "file"
      }
    )
  ] });
}
function hi({
  children: n,
  className: l,
  disabled: i = !1,
  icon: a,
  onClick: t,
  onRemove: s,
  removeLabel: d = "Remove",
  selected: o = !1,
  tone: c = "neutral"
}) {
  const m = !!t;
  return /* @__PURE__ */ r(
    "span",
    {
      className: v("nim-chip", m && "nim-chip--interactive", l),
      "data-selected": o || void 0,
      "data-tone": c === "neutral" ? void 0 : c,
      children: [
        m ? /* @__PURE__ */ r(
          "button",
          {
            "aria-pressed": o,
            className: "nim-chip__body",
            disabled: i,
            onClick: t,
            type: "button",
            children: [
              a ? /* @__PURE__ */ e(M, { name: a, size: "xs" }) : null,
              n
            ]
          }
        ) : /* @__PURE__ */ r("span", { className: "nim-chip__body", children: [
          a ? /* @__PURE__ */ e(M, { name: a, size: "xs" }) : null,
          n
        ] }),
        s ? /* @__PURE__ */ e(
          "button",
          {
            "aria-label": d,
            className: "nim-chip__remove",
            disabled: i,
            onClick: s,
            type: "button",
            children: /* @__PURE__ */ e(M, { name: "close", size: "xs" })
          }
        ) : null
      ]
    }
  );
}
function Gl({
  className: n,
  disabled: l = !1,
  error: i,
  hint: a,
  label: t,
  onChange: s,
  placeholder: d,
  removeLabel: o = "Remove",
  separators: c = ["Enter", ",", "Tab"],
  validate: m,
  values: u
}) {
  const [h, _] = L(""), p = () => {
    const g = h.trim();
    if (g && !(m && !m(g))) {
      if (u.includes(g)) {
        _("");
        return;
      }
      s([...u, g]), _("");
    }
  }, N = (g) => {
    if (c.includes(g.key)) {
      if (g.key === "Tab" && !h.trim()) return;
      g.preventDefault(), p();
      return;
    }
    g.key === "Backspace" && !h && u.length > 0 && s(u.slice(0, -1));
  };
  return /* @__PURE__ */ r("div", { className: v("nim-field", i && "nim-field--invalid", n), children: [
    t ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: t }) : null,
    /* @__PURE__ */ r("div", { className: "nim-chip-input", "data-disabled": l || void 0, children: [
      u.map((g) => /* @__PURE__ */ e(
        hi,
        {
          disabled: l,
          onRemove: () => s(u.filter((f) => f !== g)),
          removeLabel: `${o} ${g}`,
          children: g
        },
        g
      )),
      /* @__PURE__ */ e(
        "input",
        {
          "aria-invalid": i ? !0 : void 0,
          "aria-label": t,
          className: "nim-chip-input__field",
          disabled: l,
          onBlur: p,
          onChange: (g) => _(g.target.value),
          onKeyDown: N,
          placeholder: u.length === 0 ? d : void 0,
          value: h
        }
      )
    ] }),
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", children: a }) : null
  ] });
}
function Hl({ className: n, layout: l = "rows", rows: i }) {
  return /* @__PURE__ */ e("dl", { className: v("nim-data-list", `nim-data-list--${l}`, n), children: i.map((a) => /* @__PURE__ */ r("div", { className: "nim-data-list__row", children: [
    /* @__PURE__ */ e("dt", { className: "nim-data-list__label", children: a.label }),
    /* @__PURE__ */ e("dd", { className: v("nim-data-list__value", a.mono && "nim-data-list__value--mono"), children: a.value ?? /* @__PURE__ */ e("span", { className: "nim-data-list__empty", children: "—" }) })
  ] }, a.id)) });
}
function ee({ children: n, className: l, error: i, hint: a, id: t, label: s, required: d }) {
  const o = J(), c = t ?? `nim-${o}`, m = a ? `${c}-hint` : void 0, u = i ? `${c}-error` : void 0, h = [u, m].filter(Boolean).join(" ") || void 0;
  return /* @__PURE__ */ r("div", { className: v("nim-field", i && "nim-field--invalid", l), children: [
    s ? /* @__PURE__ */ r("label", { className: "nim-field__label", htmlFor: c, children: [
      s,
      d ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    n({ control: c, describedBy: h }),
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: u, children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: m, children: a }) : null
  ] });
}
function Kl({ children: n, ...l }) {
  return /* @__PURE__ */ e(ee, { ...l, children: () => n });
}
function pi({ className: n, error: l, hint: i, iconEnd: a, iconStart: t, id: s, label: d, required: o, ...c }) {
  return /* @__PURE__ */ e(ee, { error: l, hint: i, id: s, label: d, required: o, children: ({ control: m, describedBy: u }) => /* @__PURE__ */ r(
    "div",
    {
      className: v(
        "nim-input-shell",
        t && "nim-input-shell--has-start",
        a && "nim-input-shell--has-end"
      ),
      children: [
        t ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--start", children: /* @__PURE__ */ e(M, { name: t, size: "sm" }) }) : null,
        /* @__PURE__ */ e(
          "input",
          {
            "aria-describedby": u,
            "aria-invalid": l ? !0 : void 0,
            className: v("nim-input", n),
            id: m,
            required: o,
            ...c
          }
        ),
        a ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(M, { name: a, size: "sm" }) }) : null
      ]
    }
  ) });
}
function Wl({ className: n, error: l, hint: i, id: a, label: t, required: s, rows: d = 4, ...o }) {
  return /* @__PURE__ */ e(ee, { error: l, hint: i, id: a, label: t, required: s, children: ({ control: c, describedBy: m }) => /* @__PURE__ */ e(
    "textarea",
    {
      "aria-describedby": m,
      "aria-invalid": l ? !0 : void 0,
      className: v("nim-textarea", n),
      id: c,
      required: s,
      rows: d,
      ...o
    }
  ) });
}
function Zl({
  className: n,
  error: l,
  hint: i,
  id: a,
  label: t,
  options: s,
  placeholder: d,
  required: o,
  ...c
}) {
  return /* @__PURE__ */ e(ee, { error: l, hint: i, id: a, label: t, required: o, children: ({ control: m, describedBy: u }) => /* @__PURE__ */ r("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
    /* @__PURE__ */ r(
      "select",
      {
        "aria-describedby": u,
        "aria-invalid": l ? !0 : void 0,
        className: v("nim-select", n),
        id: m,
        required: o,
        ...c,
        children: [
          d ? /* @__PURE__ */ e("option", { value: "", disabled: !0, children: d }) : null,
          s.map((h) => /* @__PURE__ */ e("option", { disabled: h.disabled, value: h.value, children: h.label }, h.value))
        ]
      }
    ),
    /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(M, { name: "chevron-down", size: "sm" }) })
  ] }) });
}
function Yl({
  className: n,
  emptyState: l,
  error: i,
  hint: a,
  id: t,
  label: s,
  onChange: d,
  options: o,
  placeholder: c,
  required: m,
  value: u
}) {
  const h = J(), _ = o.find((k) => k.value === u) ?? null, [p, N] = L(""), [g, f] = L(!1), [w, y] = L(0), z = U(null), D = Y(() => {
    const k = p.trim().toLowerCase();
    return k ? o.filter((x) => x.label.toLowerCase().includes(k)) : o;
  }, [o, p]), I = (k) => {
    d(k.value), N(""), f(!1);
  }, T = (k) => {
    if (k.key === "Escape") {
      N(""), f(!1);
      return;
    }
    if (!g && (k.key === "ArrowDown" || k.key === "ArrowUp")) {
      f(!0);
      return;
    }
    if (k.key === "ArrowDown" || k.key === "ArrowUp") {
      k.preventDefault();
      const x = k.key === "ArrowDown" ? 1 : -1, S = D.filter(($) => !$.disabled);
      if (S.length === 0) return;
      y(($) => ($ + x + S.length) % S.length);
    }
    if (k.key === "Enter") {
      const S = D.filter(($) => !$.disabled)[w];
      S && (k.preventDefault(), I(S));
    }
  }, b = D.filter((k) => !k.disabled);
  return /* @__PURE__ */ e(ee, { className: n, error: i, hint: a, id: t, label: s, required: m, children: ({ control: k, describedBy: x }) => /* @__PURE__ */ r("div", { className: "nim-combobox", children: [
    /* @__PURE__ */ r("div", { className: v("nim-input-shell", "nim-input-shell--has-end"), children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-autocomplete": "list",
          "aria-controls": g ? h : void 0,
          "aria-describedby": x,
          "aria-expanded": g,
          className: "nim-input",
          id: k,
          onBlur: () => window.setTimeout(() => f(!1), 120),
          onChange: (S) => {
            N(S.target.value), y(0), f(!0);
          },
          onFocus: () => f(!0),
          onKeyDown: T,
          placeholder: c,
          ref: z,
          role: "combobox",
          value: g ? p : (_ == null ? void 0 : _.label) ?? ""
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(M, { name: "chevron-down", size: "sm" }) })
    ] }),
    g ? /* @__PURE__ */ e("div", { className: "nim-combobox__list", id: h, role: "listbox", children: b.length === 0 ? /* @__PURE__ */ e("div", { className: "nim-combobox__empty", children: l ? l(p) : `Nothing matches “${p}”.` }) : D.map((S) => /* @__PURE__ */ r(
      "button",
      {
        "aria-selected": b.indexOf(S) === w,
        className: "nim-combobox__option",
        disabled: S.disabled,
        onClick: () => I(S),
        onPointerEnter: () => y(b.indexOf(S)),
        role: "option",
        type: "button",
        children: [
          /* @__PURE__ */ e("span", { children: S.label }),
          S.meta ? /* @__PURE__ */ e("span", { className: "nim-combobox__meta", children: S.meta }) : null
        ]
      },
      S.value
    )) }) : null
  ] }) });
}
const Ye = Ce(null);
function jl({
  children: n,
  className: l,
  defaultColorway: i = "vermilion",
  defaultScheme: a = "light",
  defaultStyle: t = "ledger",
  direction: s = "ltr",
  locale: d,
  syncDocument: o = !0
}) {
  const [c, m] = L(t), [u, h] = L(i), [_, p] = L(a);
  V(() => {
    if (!o || typeof document > "u") return;
    const g = document.documentElement;
    g.dataset.nimStyle = c, g.dataset.nimColorway = u, _ === "system" ? delete g.dataset.nimScheme : g.dataset.nimScheme = _, g.dir = s, d && (g.lang = d);
  }, [u, s, d, _, c, o]);
  const N = Y(
    () => ({ colorway: u, direction: s, locale: d, scheme: _, setColorway: h, setScheme: p, setStyle: m, style: c }),
    [u, s, d, _, c]
  );
  return /* @__PURE__ */ e(Ye.Provider, { value: N, children: /* @__PURE__ */ e(
    "div",
    {
      className: v("nim-root", l),
      "data-nim-colorway": u,
      "data-nim-scheme": _ === "system" ? void 0 : _,
      "data-nim-style": c,
      dir: s,
      lang: d,
      children: n
    }
  ) });
}
function pe() {
  const n = xe(Ye);
  if (!n) throw new Error("useNim must be used inside <NimProvider>");
  return n;
}
function Vl() {
  const { scheme: n, setScheme: l } = pe();
  return Z(() => l(n === "dark" ? "light" : "dark"), [n, l]);
}
const me = 864e5, _i = Date.UTC(622, 2, 22), fi = 365.2422, ie = (n) => n.toISOString().slice(0, 10), le = (n) => /* @__PURE__ */ new Date(`${n}T00:00:00Z`), _e = () => ie(/* @__PURE__ */ new Date()), Ni = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
  year: "numeric"
});
function ne(n, l) {
  const i = le(n);
  if (l === "gregory")
    return { day: i.getUTCDate(), month: i.getUTCMonth() + 1, year: i.getUTCFullYear() };
  const a = Ni.formatToParts(i), t = (s) => {
    var d;
    return Number(((d = a.find((o) => o.type === s)) == null ? void 0 : d.value) ?? "0");
  };
  return { day: t("day"), month: t("month"), year: t("year") };
}
const $e = (n) => n.year * 1e4 + n.month * 100 + n.day;
function te(n, l) {
  if (l === "gregory")
    return ie(new Date(Date.UTC(n.year, n.month - 1, n.day)));
  const i = Math.floor((n.year - 1) * fi) + (n.month <= 7 ? (n.month - 1) * 31 : 186 + (n.month - 7) * 30) + n.day - 1;
  let a = new Date(_i + i * me);
  const t = $e(n);
  for (let s = 0; s < 40; s += 1) {
    const d = ne(ie(a), "persian"), o = $e(d);
    if (o === t) break;
    const c = (n.year - d.year) * 365 + (n.month - d.month) * 30 + (n.day - d.day);
    a = new Date(a.getTime() + (c === 0 ? o < t ? 1 : -1 : c) * me);
  }
  return ie(a);
}
function bi(n, l) {
  const i = ne(n, l);
  return te({ ...i, day: 1 }, l);
}
function Ee(n, l, i) {
  const a = ne(n, i), t = a.year * 12 + (a.month - 1) + l, s = Math.floor(t / 12), d = t % 12 + 1, o = je(s, d, i);
  return te({ day: Math.min(a.day, o), month: d, year: s }, i);
}
function je(n, l, i) {
  const a = le(te({ day: 1, month: l, year: n }, i)).getTime(), t = l === 12 ? 1 : l + 1, s = l === 12 ? n + 1 : n, d = le(te({ day: 1, month: t, year: s }, i)).getTime();
  return Math.round((d - a) / me);
}
const ge = (n, l) => ie(new Date(le(n).getTime() + l * me)), vi = (n) => le(n).getUTCDay();
function gi(n, l) {
  const i = n ?? "en";
  return i.includes("-u-ca-") || i.includes("-u-") ? i : `${i}-u-ca-${l}`;
}
const Me = (n) => n != null && n.startsWith("fa") ? "persian" : "gregory", yi = (n) => n === "persian" ? 6 : 1, Ie = /* @__PURE__ */ new Map();
function ki(n) {
  const l = n ?? "en", i = Ie.get(l);
  if (i) return i;
  const a = new Intl.NumberFormat(l, { useGrouping: !1 }), t = Array.from({ length: 10 }, (s, d) => a.format(d));
  return Ie.set(l, t), t;
}
function we(n, l, i) {
  const a = ne(n, i), t = ki(l), s = (d, o = 1) => String(d).padStart(o, "0").replace(/\d/g, (c) => t[Number(c)]);
  return `${s(a.year)}/${s(a.month, 2)}/${s(a.day, 2)}`;
}
function wi(n, l) {
  const a = Ci(n).match(/\d+/g);
  if (!a || a.length < 3) return null;
  const [t, s, d] = a.map(Number);
  if (s < 1 || s > 12 || d < 1 || d > je(t, s, l)) return null;
  const o = te({ day: d, month: s, year: t }, l), c = ne(o, l);
  return c.year === t && c.month === s && c.day === d ? o : null;
}
function Ci(n) {
  let l = "";
  for (const i of n) {
    const a = i.codePointAt(0) ?? 0;
    a >= 1776 && a <= 1785 ? l += String.fromCodePoint(a - 1776 + 48) : a >= 1632 && a <= 1641 ? l += String.fromCodePoint(a - 1632 + 48) : l += i;
  }
  return l;
}
const Be = {
  next: "Next month",
  previous: "Previous month"
};
function Ve({
  className: n,
  marked: l = [],
  max: i,
  min: a,
  month: t,
  onMonthChange: s,
  onSelect: d,
  system: o,
  value: c,
  weekStart: m
}) {
  const { locale: u } = pe(), h = o ?? Me(u), _ = m ?? yi(h), p = _e(), N = gi(u, h), g = Y(
    () => new Intl.DateTimeFormat(N, { month: "long", timeZone: "UTC", year: "numeric" }),
    [N]
  ), f = Y(() => new Intl.NumberFormat(u), [u]), w = Y(
    () => new Intl.DateTimeFormat(N, { timeZone: "UTC", weekday: "short" }),
    [N]
  ), y = bi(t, h), z = ne(y, h).month, D = Y(() => {
    const T = (vi(y) - _ + 7) % 7, b = ge(y, -T);
    return Array.from({ length: 42 }, (k, x) => {
      const S = ge(b, x), $ = ne(S, h);
      return { date: S, day: $.day, outside: $.month !== z };
    });
  }, [y, z, h, _]), I = Y(() => {
    const T = "2024-01-07";
    return Array.from({ length: 7 }, (b, k) => ({
      key: `${_}-${k}`,
      label: w.format(/* @__PURE__ */ new Date(`${ge(T, (_ + k) % 7)}T00:00:00Z`))
    }));
  }, [_, w]);
  return /* @__PURE__ */ r("div", { className: v("nim-calendar", n), children: [
    /* @__PURE__ */ r("div", { className: "nim-calendar__header", children: [
      /* @__PURE__ */ e(
        O,
        {
          label: Be.previous,
          name: "chevron-back",
          onClick: () => s(Ee(y, -1, h)),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-calendar__month", children: g.format(/* @__PURE__ */ new Date(`${y}T00:00:00Z`)) }),
      /* @__PURE__ */ e(
        O,
        {
          label: Be.next,
          name: "chevron-forward",
          onClick: () => s(Ee(y, 1, h)),
          size: "sm"
        }
      )
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-calendar__grid", role: "grid", children: [
      I.map((T) => /* @__PURE__ */ e("span", { className: "nim-calendar__weekday", children: T.label }, T.key)),
      D.map((T) => /* @__PURE__ */ e(
        "button",
        {
          "aria-selected": T.date === c,
          className: v(
            "nim-calendar__day",
            T.outside && "nim-calendar__day--outside",
            T.date === p && "nim-calendar__day--today",
            l.includes(T.date) && "nim-calendar__day--marked"
          ),
          disabled: a !== void 0 && T.date < a || i !== void 0 && T.date > i,
          onClick: () => d(T.date),
          role: "gridcell",
          type: "button",
          children: f.format(T.day)
        },
        T.date
      ))
    ] })
  ] });
}
function qe({
  calendar: n,
  describedBy: l,
  id: i,
  invalid: a,
  locale: t,
  onChange: s,
  value: d
}) {
  const [o, c] = L(null);
  if (n === "gregory")
    return /* @__PURE__ */ e(
      "input",
      {
        "aria-describedby": l,
        "aria-invalid": a ? !0 : void 0,
        className: "nim-input",
        id: i,
        onChange: (u) => s(u.target.value),
        type: "date",
        value: d
      }
    );
  const m = o ?? (d ? we(d, t, n) : "");
  return /* @__PURE__ */ e(
    "input",
    {
      "aria-describedby": l,
      "aria-invalid": a ? !0 : void 0,
      className: "nim-input",
      dir: "ltr",
      id: i,
      inputMode: "numeric",
      onBlur: () => c(null),
      onChange: (u) => {
        c(u.target.value);
        const h = wi(u.target.value, n);
        h ? s(h) : u.target.value.trim() === "" && s("");
      },
      placeholder: we(_e(), t, n),
      type: "text",
      value: m
    }
  );
}
function ql({
  error: n,
  hint: l,
  id: i,
  label: a,
  onChange: t,
  required: s,
  value: d,
  ...o
}) {
  const { locale: c } = pe(), m = o.system ?? Me(c), [u, h] = L(d || _e());
  return /* @__PURE__ */ e(ee, { error: n, hint: l, id: i, label: a, required: s, children: ({ control: _, describedBy: p }) => /* @__PURE__ */ r("div", { className: "nim-stack nim-stack--tight", children: [
    /* @__PURE__ */ e(
      qe,
      {
        calendar: m,
        describedBy: p,
        id: _,
        invalid: !!n,
        locale: c,
        onChange: (N) => {
          t(N), N && h(N);
        },
        value: d
      }
    ),
    /* @__PURE__ */ e(
      Ve,
      {
        ...o,
        month: u,
        onMonthChange: h,
        onSelect: (N) => {
          t(N), h(N);
        },
        system: m,
        value: d
      }
    )
  ] }) });
}
function Ql({
  error: n,
  hint: l,
  id: i,
  label: a,
  labels: t,
  onChange: s,
  required: d,
  showEquivalent: o,
  value: c,
  ...m
}) {
  const { locale: u } = pe(), h = m.system ?? Me(u), [_, p] = L(!1), [N, g] = L(c || _e()), f = U(null), w = { clear: "Clear date", open: "Open calendar", ...t }, y = o ?? h === "persian", z = h === "persian" ? "gregory" : "persian";
  return /* @__PURE__ */ e(ee, { error: n, hint: l, id: i, label: a, required: d, children: ({ control: D, describedBy: I }) => /* @__PURE__ */ r("div", { className: "nim-date-picker", children: [
    /* @__PURE__ */ r("div", { className: "nim-date-picker__group", children: [
      /* @__PURE__ */ e(
        qe,
        {
          calendar: h,
          describedBy: I,
          id: D,
          invalid: !!n,
          locale: u,
          onChange: (T) => {
            s(T), T && g(T);
          },
          value: c
        }
      ),
      c ? /* @__PURE__ */ e(
        O,
        {
          label: w.clear,
          name: "close",
          onClick: () => s(""),
          size: "sm"
        }
      ) : null,
      /* @__PURE__ */ e(
        O,
        {
          "aria-expanded": _,
          label: w.open,
          name: "calendar",
          onClick: () => p((T) => !T),
          ref: f,
          size: "sm"
        }
      )
    ] }),
    y && c ? /* @__PURE__ */ r("p", { className: "nim-date-picker__equivalent", children: [
      /* @__PURE__ */ e(M, { name: "calendar", size: "xs" }),
      /* @__PURE__ */ e("span", { dir: z === "gregory" ? "ltr" : void 0, children: we(c, u, z) })
    ] }) : null,
    /* @__PURE__ */ e(
      ja,
      {
        label: a ?? w.open,
        onClose: () => p(!1),
        open: _,
        triggerRef: f,
        children: /* @__PURE__ */ e(
          Ve,
          {
            ...m,
            month: N,
            onMonthChange: g,
            onSelect: (T) => {
              s(T), g(T), p(!1);
            },
            system: h,
            value: c
          }
        )
      }
    )
  ] }) });
}
function Xl({
  children: n,
  className: l,
  closeLabel: i = "Close",
  description: a,
  dismissible: t = !0,
  footer: s,
  onClose: d,
  open: o,
  title: c
}) {
  const m = U(null);
  return V(() => {
    const u = m.current;
    u && (o && !u.open && u.showModal(), !o && u.open && u.close());
  }, [o]), V(() => {
    const u = m.current;
    if (!u || t) return;
    const h = (_) => _.preventDefault();
    return u.addEventListener("cancel", h), () => u.removeEventListener("cancel", h);
  }, [t]), V(() => {
    const u = m.current;
    if (!u) return;
    const h = () => d();
    return u.addEventListener("close", h), () => u.removeEventListener("close", h);
  }, [d]), /* @__PURE__ */ r(
    "dialog",
    {
      className: v("nim-dialog", l),
      onClick: (u) => {
        t && u.target === m.current && d();
      },
      ref: m,
      children: [
        /* @__PURE__ */ r("div", { className: "nim-dialog__header", children: [
          /* @__PURE__ */ r("div", { children: [
            /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: c }),
            a ? /* @__PURE__ */ e("p", { className: "nim-caption", children: a }) : null
          ] }),
          t ? /* @__PURE__ */ e(O, { label: i, name: "close", onClick: d, size: "sm" }) : null
        ] }),
        /* @__PURE__ */ e("div", { className: "nim-dialog__body", children: n }),
        s ? /* @__PURE__ */ e("div", { className: "nim-dialog__footer", children: s }) : null
      ]
    }
  );
}
function Jl({
  className: n,
  detail: l,
  label: i,
  percent: a,
  tone: t = "accent",
  value: s,
  ...d
}) {
  const o = typeof a == "number", c = Math.min(100, Math.max(0, a ?? 0)), m = typeof i == "string" ? i : void 0;
  return /* @__PURE__ */ r("div", { className: v("nim-resource-meter", n), "data-tone": t, ...d, children: [
    /* @__PURE__ */ r("div", { className: "nim-resource-meter__head", children: [
      /* @__PURE__ */ e("span", { className: "nim-resource-meter__label", children: i }),
      /* @__PURE__ */ e("span", { className: "nim-resource-meter__value", children: s })
    ] }),
    o ? /* @__PURE__ */ e(
      "div",
      {
        "aria-label": m,
        "aria-valuemax": 100,
        "aria-valuemin": 0,
        "aria-valuenow": c,
        className: "nim-resource-meter__track",
        role: "meter",
        children: /* @__PURE__ */ e("span", { className: "nim-resource-meter__fill", style: { inlineSize: `${c}%` } })
      }
    ) : null,
    l ? /* @__PURE__ */ e("span", { className: "nim-resource-meter__detail", children: l }) : null
  ] });
}
function et({
  accept: n,
  caption: l,
  className: i,
  disabled: a = !1,
  error: t,
  label: s,
  multiple: d = !1,
  onFiles: o,
  prompt: c
}) {
  const m = U(0), [u, h] = L(!1), _ = (p) => {
    p.preventDefault(), p.stopPropagation();
  };
  return /* @__PURE__ */ r("div", { className: v("nim-field", t && "nim-field--invalid", i), children: [
    /* @__PURE__ */ r(
      "label",
      {
        className: "nim-file-drop",
        "data-over": u || void 0,
        "data-disabled": a || void 0,
        onDragEnter: (p) => {
          _(p), m.current += 1, a || h(!0);
        },
        onDragLeave: (p) => {
          _(p), m.current -= 1, m.current <= 0 && h(!1);
        },
        onDragOver: _,
        onDrop: (p) => {
          if (_(p), m.current = 0, h(!1), a) return;
          const N = Array.from(p.dataTransfer.files);
          N.length > 0 && o(d ? N : N.slice(0, 1));
        },
        children: [
          /* @__PURE__ */ e(
            "input",
            {
              accept: n,
              className: "nim-choice__input",
              disabled: a,
              multiple: d,
              onChange: (p) => {
                const N = Array.from(p.target.files ?? []);
                N.length > 0 && o(N), p.target.value = "";
              },
              type: "file"
            }
          ),
          /* @__PURE__ */ e(M, { className: "nim-file-drop__icon", name: "upload", size: "lg" }),
          /* @__PURE__ */ e("span", { className: "nim-file-drop__label", children: s }),
          c ? /* @__PURE__ */ e("span", { className: "nim-file-drop__prompt", children: c }) : null,
          l ? /* @__PURE__ */ e("span", { className: "nim-file-drop__caption", children: l }) : null
        ]
      }
    ),
    t ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: t }) : null
  ] });
}
function nt({ children: n, className: l, ...i }) {
  return /* @__PURE__ */ e("div", { className: v("nim-app-frame", l), ...i, children: n });
}
function at({
  as: n = "div",
  children: l,
  className: i,
  gap: a = "md",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-stack", a !== "md" && `nim-stack--${a}`, i), ...t, children: l });
}
function it({
  as: n = "div",
  children: l,
  className: i,
  gap: a = "md",
  wrap: t = !0,
  ...s
}) {
  return /* @__PURE__ */ e(
    n,
    {
      className: v("nim-inline", a !== "md" && `nim-inline--${a}`, !t && "nim-inline--nowrap", i),
      ...s,
      children: l
    }
  );
}
function xi({ children: n, className: l, plain: i = !1, ...a }) {
  return /* @__PURE__ */ e("div", { className: v("nim-list", i && "nim-list--plain", l), ...a, children: n });
}
function Mi({
  className: n,
  href: l,
  leading: i,
  onClick: a,
  rel: t,
  subtitle: s,
  target: d,
  title: o,
  trailing: c,
  ...m
}) {
  const u = !!(l || a), h = /* @__PURE__ */ r(G, { children: [
    i ? /* @__PURE__ */ e("span", { className: "nim-list-row__leading", children: i }) : null,
    /* @__PURE__ */ r("span", { className: "nim-list-row__content", children: [
      /* @__PURE__ */ e("span", { className: "nim-list-row__title", children: o }),
      s ? /* @__PURE__ */ e("span", { className: "nim-list-row__subtitle", children: s }) : null
    ] }),
    c ? /* @__PURE__ */ e("span", { className: "nim-list-row__trailing", children: c }) : null,
    u && !c ? /* @__PURE__ */ e(M, { className: "nim-list-row__chevron", name: "chevron-forward", size: "sm" }) : null
  ] }), _ = v("nim-list-row", u && "nim-list-row--interactive", n);
  return l ? /* @__PURE__ */ e(
    "a",
    {
      className: _,
      href: l,
      rel: d === "_blank" ? t ?? "noreferrer" : t,
      target: d,
      ...m,
      children: h
    }
  ) : a ? /* @__PURE__ */ e("button", { className: _, onClick: a, type: "button", ...m, children: h }) : /* @__PURE__ */ e("div", { className: _, ...m, children: h });
}
const Ti = {
  back: "Back",
  dot: (n) => `Slide ${n + 1}`
};
function lt({
  brand: n,
  className: l,
  finishLabel: i,
  footnote: a,
  labels: t,
  nextLabel: s,
  onDone: d,
  onSkip: o,
  onStep: c,
  skipLabel: m,
  slides: u
}) {
  var w;
  const [h, _] = L(0), p = { ...Ti, ...t }, N = u[Math.min(h, u.length - 1)], g = h === u.length - 1, f = Z(
    (y) => {
      _(y), c == null || c(y);
    },
    [c]
  );
  return /* @__PURE__ */ r("section", { className: v("nim-onboarding", l), children: [
    /* @__PURE__ */ r("header", { className: "nim-onboarding__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-onboarding__brand", children: n }),
      m ? /* @__PURE__ */ e(
        X,
        {
          iconEnd: "chevron-forward",
          onClick: o ?? d,
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
      /* @__PURE__ */ e("div", { className: "nim-onboarding__dots", children: u.map((y, z) => /* @__PURE__ */ e(
        "button",
        {
          "aria-current": z === h ? "step" : void 0,
          "aria-label": p.dot(z),
          className: "nim-onboarding__dot",
          onClick: () => f(z),
          type: "button"
        },
        y.id
      )) }),
      /* @__PURE__ */ r("div", { className: "nim-onboarding__cta", children: [
        h > 0 ? /* @__PURE__ */ e(
          O,
          {
            label: p.back,
            name: "chevron-back",
            onClick: () => f(h - 1),
            size: "lg",
            variant: "outline"
          }
        ) : null,
        /* @__PURE__ */ e(
          X,
          {
            fullWidth: !0,
            iconEnd: g ? "arrow-forward" : void 0,
            onClick: () => g ? d() : f(h + 1),
            size: "lg",
            variant: "accent",
            children: g ? i : s
          }
        )
      ] }),
      a ? /* @__PURE__ */ e("p", { className: "nim-onboarding__footnote", children: a }) : null
    ] })
  ] });
}
const Si = "AD:376 AE:971 AF:93 AG:1268 AI:1264 AL:355 AM:374 AO:244 AQ:672 AR:54 AS:1684 AT:43 AU:61 AW:297 AX:358 AZ:994 BA:387 BB:1246 BD:880 BE:32 BF:226 BG:359 BH:973 BI:257 BJ:229 BL:590 BM:1441 BN:673 BO:591 BQ:599 BR:55 BS:1242 BT:975 BW:267 BY:375 BZ:501 CA:1 CC:61 CD:243 CF:236 CG:242 CH:41 CI:225 CK:682 CL:56 CM:237 CN:86 CO:57 CR:506 CU:53 CV:238 CW:599 CX:61 CY:357 CZ:420 DE:49 DJ:253 DK:45 DM:1767 DO:1809 DZ:213 EC:593 EE:372 EG:20 EH:212 ER:291 ES:34 ET:251 FI:358 FJ:679 FK:500 FM:691 FO:298 FR:33 GA:241 GB:44 GD:1473 GE:995 GF:594 GG:44 GH:233 GI:350 GL:299 GM:220 GN:224 GP:590 GQ:240 GR:30 GT:502 GU:1671 GW:245 GY:592 HK:852 HN:504 HR:385 HT:509 HU:36 ID:62 IE:353 IL:972 IM:44 IN:91 IO:246 IQ:964 IR:98 IS:354 IT:39 JE:44 JM:1876 JO:962 JP:81 KE:254 KG:996 KH:855 KI:686 KM:269 KN:1869 KP:850 KR:82 KW:965 KY:1345 KZ:7 LA:856 LB:961 LC:1758 LI:423 LK:94 LR:231 LS:266 LT:370 LU:352 LV:371 LY:218 MA:212 MC:377 MD:373 ME:382 MF:590 MG:261 MH:692 MK:389 ML:223 MM:95 MN:976 MO:853 MP:1670 MQ:596 MR:222 MS:1664 MT:356 MU:230 MV:960 MW:265 MX:52 MY:60 MZ:258 NA:264 NC:687 NE:227 NF:672 NG:234 NI:505 NL:31 NO:47 NP:977 NR:674 NU:683 NZ:64 OM:968 PA:507 PE:51 PF:689 PG:675 PH:63 PK:92 PL:48 PM:508 PR:1787 PS:970 PT:351 PW:680 PY:595 QA:974 RE:262 RO:40 RS:381 RU:7 RW:250 SA:966 SB:677 SC:248 SD:249 SE:46 SG:65 SH:290 SI:386 SJ:47 SK:421 SL:232 SM:378 SN:221 SO:252 SR:597 SS:211 ST:239 SV:503 SX:1721 SY:963 SZ:268 TC:1649 TD:235 TG:228 TH:66 TJ:992 TK:690 TL:670 TM:993 TN:216 TO:676 TR:90 TT:1868 TV:688 TW:886 TZ:255 UA:380 UG:256 US:1 UY:598 UZ:998 VA:39 VC:1784 VE:58 VG:1284 VI:1340 VN:84 VU:678 WF:681 WS:685 YE:967 YT:262 ZA:27 ZM:260 ZW:263";
function zi(n) {
  return String.fromCodePoint(...[...n].map((l) => 127462 + l.charCodeAt(0) - 65));
}
const ue = Si.split(" ").map((n) => {
  const [l, i] = n.split(":");
  return { dial: i, flag: zi(l), iso2: l };
}), Di = new Map(ue.map((n) => [n.iso2, n]));
function Qe(n) {
  return Di.get(n.toUpperCase());
}
function tt(n) {
  const l = n.replace(/\D/g, "");
  let i;
  for (const a of ue)
    l.startsWith(a.dial) && (!i || a.dial.length > i.dial.length) && (i = a);
  return i;
}
const Pe = /* @__PURE__ */ new Map();
function Ai(n) {
  const l = Pe.get(n);
  if (l) return l;
  let i;
  try {
    const a = new Intl.DisplayNames([n], { type: "region" });
    i = (t) => a.of(t) ?? t;
  } catch {
    i = (a) => a;
  }
  return Pe.set(n, i), i;
}
function se(n) {
  let l = "";
  for (const i of n) {
    const a = i.codePointAt(0) ?? 0;
    a >= 1776 && a <= 1785 ? l += String.fromCodePoint(a - 1776 + 48) : a >= 1632 && a <= 1641 ? l += String.fromCodePoint(a - 1632 + 48) : i >= "0" && i <= "9" && (l += i);
  }
  return l;
}
function Li({
  autoFocus: n = !1,
  className: l,
  digitLabel: i,
  error: a,
  label: t,
  length: s = 5,
  onChange: d,
  onComplete: o,
  value: c
}) {
  const m = U(null), u = c.slice(0, s).split(""), h = Z((f) => {
    var y, z;
    const w = (y = m.current) == null ? void 0 : y.querySelectorAll("input");
    (z = w == null ? void 0 : w[Math.max(0, Math.min(f, w.length - 1))]) == null || z.focus();
  }, []);
  V(() => {
    n && h(0);
  }, [n, h]);
  const _ = Z(
    (f, w) => {
      const y = f.slice(0, s);
      d(y), y.length === s ? o == null || o(y) : h(w);
    },
    [h, s, d, o]
  ), p = Z(
    (f, w) => {
      const y = se(w);
      if (!y) return;
      const z = (c.slice(0, f) + y).slice(0, s);
      _(z, z.length);
    },
    [_, s, c]
  ), N = Z(
    (f, w) => {
      if (w.key === "Backspace") {
        w.preventDefault();
        const y = c[f] ? f : f - 1;
        if (y < 0) return;
        d(c.slice(0, y) + c.slice(y + 1)), h(y);
      } else w.key === "ArrowLeft" ? h(f - 1) : w.key === "ArrowRight" && h(f + 1);
    },
    [h, d, c]
  ), g = Z(
    (f) => {
      const w = se(f.clipboardData.getData("text"));
      w && (f.preventDefault(), _(w.slice(0, s), w.length));
    },
    [_, s]
  );
  return /* @__PURE__ */ r("div", { className: v("nim-otp", a && "nim-otp--invalid", l), children: [
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": t,
        className: "nim-otp__boxes",
        dir: "ltr",
        onPaste: g,
        ref: m,
        role: "group",
        children: Array.from({ length: s }, (f, w) => /* @__PURE__ */ e(
          "input",
          {
            "aria-invalid": a ? !0 : void 0,
            "aria-label": i ? i(w) : `${t} ${w + 1}`,
            autoComplete: w === 0 ? "one-time-code" : "off",
            className: "nim-otp__box",
            "data-filled": u[w] ? "true" : void 0,
            enterKeyHint: "done",
            inputMode: "numeric",
            onChange: (y) => p(w, y.target.value),
            onFocus: (y) => y.currentTarget.select(),
            onKeyDown: (y) => N(w, y),
            type: "text",
            value: u[w] ?? ""
          },
          w
        ))
      }
    ),
    a ? /* @__PURE__ */ e("p", { className: "nim-otp__error", role: "alert", children: a }) : null
  ] });
}
const $i = {
  hide: "Hide password",
  show: "Show password",
  strength: (n) => `Password strength: ${n}`
}, Fe = ["weak", "fair", "good", "strong"];
function Ei({
  className: n,
  error: l,
  hint: i,
  id: a,
  label: t,
  labels: s,
  required: d,
  strength: o,
  ...c
}) {
  const [m, u] = L(!1), h = { ...$i, ...s };
  return /* @__PURE__ */ e(ee, { error: l, hint: i, id: a, label: t, required: d, children: ({ control: _, describedBy: p }) => /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ r("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-describedby": p,
          "aria-invalid": l ? !0 : void 0,
          autoComplete: c.autoComplete ?? "current-password",
          className: v("nim-input", n),
          id: _,
          required: d,
          ...c,
          type: m ? "text" : "password"
        }
      ),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-controls": _,
          "aria-label": m ? h.hide : h.show,
          "aria-pressed": m,
          className: "nim-password__toggle",
          onClick: () => u((N) => !N),
          type: "button",
          children: /* @__PURE__ */ e(M, { name: "eye", size: "sm" })
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
        children: Fe.map((N, g) => /* @__PURE__ */ e(
          "span",
          {
            className: "nim-password__step",
            "data-on": g <= Fe.indexOf(o) ? "true" : void 0
          },
          N
        ))
      }
    ) : null
  ] }) });
}
function st(n) {
  if (n.length < 8) return "weak";
  const l = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((i) => i.test(n)).length;
  return n.length >= 14 && l >= 3 ? "strong" : n.length >= 10 && l >= 2 ? "good" : "fair";
}
const Ii = {
  noMatch: "No country matches",
  pickCountry: "Country code",
  search: "Search countries"
};
function Bi({
  className: n,
  country: l,
  error: i,
  hint: a,
  id: t,
  label: s,
  labels: d,
  locale: o,
  onChange: c,
  onCountryChange: m,
  onSubmit: u,
  placeholder: h,
  priority: _ = [],
  required: p,
  value: N
}) {
  const g = J(), f = t ?? `nim-${g}`, w = a ? `${f}-hint` : void 0, y = i ? `${f}-error` : void 0, z = { ...Ii, ...d }, [D, I] = L(!1), [T, b] = L(""), k = U(null), x = U(null), S = U(null), $ = o ?? (typeof document > "u" ? "en" : document.documentElement.lang || "en"), E = Y(() => Ai($), [$]), B = Qe(l) ?? ue[0], H = Y(() => {
    const C = new Intl.Collator($), P = ue.map((A) => ({ ...A, name: E(A.iso2) })), W = (A) => {
      const F = _.indexOf(A);
      return F === -1 ? _.length : F;
    };
    return P.sort(
      (A, F) => W(A.iso2) - W(F.iso2) || C.compare(A.name, F.name)
    );
  }, [E, _, $]), K = Y(() => {
    const C = T.trim().toLocaleLowerCase($);
    if (!C) return H;
    const P = se(C);
    return H.filter(
      (W) => W.name.toLocaleLowerCase($).includes(C) || W.iso2.toLowerCase().includes(C) || (P ? W.dial.startsWith(P) : !1)
    );
  }, [H, T, $]);
  V(() => {
    var W;
    if (!D) return;
    (W = S.current) == null || W.focus();
    const C = (A) => {
      var F;
      (F = k.current) != null && F.contains(A.target) || I(!1);
    }, P = (A) => {
      var F;
      A.key === "Escape" && (I(!1), (F = x.current) == null || F.focus());
    };
    return document.addEventListener("mousedown", C), document.addEventListener("keydown", P), () => {
      document.removeEventListener("mousedown", C), document.removeEventListener("keydown", P);
    };
  }, [D]);
  const R = (C) => {
    var P;
    m(C), I(!1), b(""), (P = x.current) == null || P.focus();
  };
  return /* @__PURE__ */ r("div", { className: v("nim-field", i && "nim-field--invalid", n), children: [
    s ? /* @__PURE__ */ r("label", { className: "nim-field__label", htmlFor: f, children: [
      s,
      p ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    /* @__PURE__ */ r("div", { className: "nim-phone", ref: k, children: [
      /* @__PURE__ */ r("div", { className: "nim-phone__shell", dir: "ltr", children: [
        /* @__PURE__ */ r(
          "button",
          {
            "aria-expanded": D,
            "aria-haspopup": "listbox",
            "aria-label": `${z.pickCountry}: ${E(B.iso2)} +${B.dial}`,
            className: "nim-phone__country",
            onClick: () => I((C) => !C),
            ref: x,
            type: "button",
            children: [
              /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-phone__flag", children: B.flag }),
              /* @__PURE__ */ r("span", { className: "nim-phone__dial", children: [
                "+",
                B.dial
              ] }),
              /* @__PURE__ */ e(M, { className: "nim-phone__caret", name: "chevron-down", size: "xs" })
            ]
          }
        ),
        /* @__PURE__ */ e(
          "input",
          {
            "aria-describedby": [y, w].filter(Boolean).join(" ") || void 0,
            "aria-invalid": i ? !0 : void 0,
            autoComplete: "tel-national",
            className: "nim-phone__input",
            enterKeyHint: "go",
            id: f,
            inputMode: "tel",
            onChange: (C) => c(se(C.target.value)),
            onKeyDown: (C) => {
              C.key === "Enter" && (u == null || u());
            },
            placeholder: h,
            required: p,
            type: "tel",
            value: N
          }
        )
      ] }),
      D ? /* @__PURE__ */ r("div", { className: "nim-phone__picker", children: [
        /* @__PURE__ */ r("div", { className: "nim-phone__search", children: [
          /* @__PURE__ */ e(M, { name: "search", size: "sm" }),
          /* @__PURE__ */ e(
            "input",
            {
              "aria-label": z.search,
              className: "nim-phone__search-input",
              onChange: (C) => b(C.target.value),
              placeholder: z.search,
              ref: S,
              type: "search",
              value: T
            }
          )
        ] }),
        /* @__PURE__ */ r("ul", { className: "nim-phone__list", role: "listbox", children: [
          K.map((C) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r(
            "button",
            {
              "aria-selected": C.iso2 === B.iso2,
              className: "nim-phone__option",
              onClick: () => R(C.iso2),
              role: "option",
              type: "button",
              children: [
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-phone__flag", children: C.flag }),
                /* @__PURE__ */ e("span", { className: "nim-phone__name", children: C.name }),
                /* @__PURE__ */ r("span", { className: "nim-phone__option-dial", dir: "ltr", children: [
                  "+",
                  C.dial
                ] })
              ]
            }
          ) }, C.iso2)),
          K.length === 0 ? /* @__PURE__ */ e("li", { className: "nim-phone__empty", children: z.noMatch }) : null
        ] })
      ] }) : null
    ] }),
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: y, children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: w, children: a }) : null
  ] });
}
function Pi(n, l) {
  var a;
  return `+${((a = Qe(n)) == null ? void 0 : a.dial) ?? ""}${se(l).replace(/^0+/, "")}`;
}
const Fi = {
  excluded: "minus",
  included: "check",
  pending: "clock"
};
function Ri({
  badge: n,
  className: l,
  features: i = [],
  icon: a,
  name: t,
  onSelect: s,
  price: d,
  priceCaption: o,
  secondary: c,
  selected: m = !1,
  tagline: u
}) {
  const h = /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ r("div", { className: "nim-plan__top", children: [
      a ? /* @__PURE__ */ e("span", { className: "nim-plan__icon", children: /* @__PURE__ */ e(M, { name: a, size: "md" }) }) : null,
      /* @__PURE__ */ r("div", { className: "nim-plan__heading", children: [
        /* @__PURE__ */ e("span", { className: "nim-plan__name", children: t }),
        u ? /* @__PURE__ */ e("span", { className: "nim-plan__tagline", children: u }) : null
      ] }),
      n ? /* @__PURE__ */ e("span", { className: "nim-plan__badge", children: n }) : null,
      s ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-plan__radio", children: m ? /* @__PURE__ */ e(M, { name: "check", size: "xs" }) : null }) : null
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-plan__price-box", children: [
      /* @__PURE__ */ r("div", { children: [
        o ? /* @__PURE__ */ e("span", { className: "nim-plan__price-caption", children: o }) : null,
        /* @__PURE__ */ e("strong", { className: "nim-plan__price", children: d })
      ] }),
      c ? /* @__PURE__ */ r("div", { className: "nim-plan__secondary", children: [
        /* @__PURE__ */ e("span", { className: "nim-plan__price-caption", children: c.caption }),
        /* @__PURE__ */ e("strong", { className: "nim-plan__secondary-value", children: c.value })
      ] }) : null
    ] }),
    i.length ? /* @__PURE__ */ e("ul", { className: "nim-plan__features", children: i.map((p, N) => {
      const g = p.state ?? "included";
      return /* @__PURE__ */ r("li", { className: "nim-plan__feature", "data-state": g, children: [
        /* @__PURE__ */ e(M, { name: Fi[g], size: "xs" }),
        /* @__PURE__ */ e("span", { className: "nim-plan__feature-label", children: p.label }),
        p.note ? /* @__PURE__ */ e("span", { className: "nim-plan__feature-note", children: p.note }) : null
      ] }, N);
    }) }) : null
  ] }), _ = v("nim-plan", m && "nim-plan--selected", l);
  return s ? /* @__PURE__ */ e("button", { "aria-pressed": m, className: _, onClick: s, type: "button", children: h }) : /* @__PURE__ */ e("article", { className: _, children: h });
}
function Oi({
  className: n,
  fullWidth: l = !1,
  label: i,
  onChange: a,
  options: t,
  value: s,
  ...d
}) {
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": i,
      className: v("nim-segmented", l && "nim-segmented--full", n),
      role: "tablist",
      ...d,
      children: t.map((o) => /* @__PURE__ */ e(
        "button",
        {
          "aria-selected": o.value === s,
          className: "nim-segmented__option",
          disabled: o.disabled,
          onClick: () => a(o.value),
          role: "tab",
          type: "button",
          children: o.label
        },
        o.value
      ))
    }
  );
}
const Ui = {
  cycle: "Billing period",
  monthly: "Per month",
  price: "This package"
};
function rt({
  className: n,
  cycle: l,
  cycles: i = [],
  defaultCycle: a,
  defaultPlan: t,
  labels: s,
  note: d,
  onCycleChange: o,
  onPlanChange: c,
  onSubmit: m,
  plan: u,
  plans: h,
  submitLabel: _
}) {
  var b, k;
  const p = { ...Ui, ...s }, [N, g] = L(a ?? ((b = i[0]) == null ? void 0 : b.id) ?? ""), [f, w] = L(t ?? ((k = h[0]) == null ? void 0 : k.id) ?? ""), y = l ?? N, z = u ?? f, D = (x) => {
    w(x), c == null || c(x);
  }, I = (x) => {
    g(x), o == null || o(x);
  }, T = i.find((x) => x.id === y);
  return /* @__PURE__ */ r("section", { className: v("nim-plan-picker", n), children: [
    i.length > 1 ? /* @__PURE__ */ r("div", { className: "nim-plan-picker__cycles", children: [
      /* @__PURE__ */ e(
        Oi,
        {
          fullWidth: !0,
          label: p.cycle,
          onChange: I,
          options: i.map((x) => ({ label: x.label, value: x.id })),
          value: y
        }
      ),
      T != null && T.note ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__save", children: T.note }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-plan-picker__plans", children: h.map(({ id: x, prices: S, ...$ }) => {
      const E = S[y] ?? Object.values(S)[0];
      return /* @__PURE__ */ nn(
        Ri,
        {
          ...$,
          key: x,
          onSelect: () => D(x),
          price: (E == null ? void 0 : E.price) ?? "",
          priceCaption: p.price,
          secondary: (E == null ? void 0 : E.monthly) === void 0 ? void 0 : { caption: p.monthly, value: E.monthly },
          selected: x === z
        }
      );
    }) }),
    _ ? /* @__PURE__ */ r("div", { className: "nim-plan-picker__foot", children: [
      /* @__PURE__ */ e(
        X,
        {
          fullWidth: !0,
          onClick: () => m == null ? void 0 : m(z, y),
          size: "lg",
          variant: "accent",
          children: _
        }
      ),
      d ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__note", children: d }) : null
    ] }) : null
  ] });
}
function Gi({
  action: n,
  className: l,
  description: i,
  eyebrow: a,
  title: t,
  ...s
}) {
  return /* @__PURE__ */ r("header", { className: v("nim-section-header", l), ...s, children: [
    /* @__PURE__ */ r("div", { children: [
      a ? /* @__PURE__ */ e("p", { className: "nim-label nim-section-header__eyebrow", children: a }) : null,
      /* @__PURE__ */ e("h2", { className: "nim-title nim-title--md", children: t }),
      i ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-section-header__description", children: i }) : null
    ] }),
    n ? /* @__PURE__ */ e("div", { className: "nim-section-header__action", children: n }) : null
  ] });
}
function ct({
  className: n,
  footer: l,
  sections: i = [],
  ...a
}) {
  return /* @__PURE__ */ r("div", { className: v("nim-profile-screen", n), children: [
    /* @__PURE__ */ e(Ha, { ...a }),
    i.map((t) => /* @__PURE__ */ r("section", { className: "nim-profile-screen__section", children: [
      t.title ? /* @__PURE__ */ e(Gi, { description: t.description, title: t.title }) : null,
      /* @__PURE__ */ e(xi, { children: t.rows.map((s) => /* @__PURE__ */ e(
        Mi,
        {
          className: v(s.danger && "nim-list-row--danger"),
          href: s.href,
          leading: s.icon ? /* @__PURE__ */ e(M, { name: s.icon, size: "md" }) : void 0,
          onClick: s.onToggle ? void 0 : s.onSelect,
          subtitle: s.subtitle,
          title: s.label,
          trailing: s.onToggle ? (
            // The row's own title names the switch, so the control
            // carries the name rather than repeating the text beside
            // itself. A toggle row is a div, never a button — a switch
            // inside a button is two controls in one target.
            /* @__PURE__ */ e(
              Ba,
              {
                "aria-label": typeof s.label == "string" ? s.label : void 0,
                checked: s.checked ?? !1,
                onChange: (d) => {
                  var o;
                  return (o = s.onToggle) == null ? void 0 : o.call(s, d.target.checked);
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
function ot({
  className: n,
  count: l = 5,
  label: i,
  onChange: a,
  readOnly: t = !1,
  size: s = "md",
  value: d
}) {
  const o = J(), [c, m] = L(null), u = c ?? d;
  return t || !a ? /* @__PURE__ */ e(
    "span",
    {
      "aria-label": `${i}: ${d}/${l}`,
      className: v("nim-rating", `nim-rating--${s}`, "nim-rating--static", n),
      role: "img",
      children: Array.from({ length: l }, (h, _) => /* @__PURE__ */ e(Re, { fill: Math.min(Math.max(d - _, 0), 1) }, _))
    }
  ) : /* @__PURE__ */ r(
    "fieldset",
    {
      className: v("nim-rating", `nim-rating--${s}`, n),
      onMouseLeave: () => m(null),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-visually-hidden", children: i }),
        Array.from({ length: l }, (h, _) => {
          const p = _ + 1;
          return /* @__PURE__ */ r("label", { className: "nim-rating__star", onMouseEnter: () => m(p), children: [
            /* @__PURE__ */ e(
              "input",
              {
                checked: d === p,
                className: "nim-choice__input",
                name: o,
                onChange: () => a(p),
                type: "radio",
                value: p
              }
            ),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: p }),
            /* @__PURE__ */ e(Re, { fill: Math.min(Math.max(u - _, 0), 1) })
          ] }, p);
        })
      ]
    }
  );
}
function Re({ fill: n }) {
  return /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "nim-rating__glyph", children: [
    /* @__PURE__ */ e(M, { className: "nim-rating__outline", name: "star", size: "md" }),
    /* @__PURE__ */ e("span", { className: "nim-rating__fill", style: { inlineSize: `${n * 100}%` }, children: /* @__PURE__ */ e(M, { name: "star", size: "md" }) })
  ] });
}
const Hi = {
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
}, ye = (n, l) => n instanceof Error && n.message.trim() ? n.message.trim() : l;
function dt({
  brand: n,
  className: l,
  codeLength: i = 5,
  copy: a,
  defaultCountry: t = "IR",
  defaultMethod: s = "code",
  footer: d,
  methods: o = ["code", "password"],
  onPasswordSignIn: c,
  onRequestCode: m,
  onVerifyCode: u,
  priority: h = ["IR", "AE", "TR", "DE", "US", "GB"],
  resendSeconds: _ = 60
}) {
  const p = { ...Hi, ...a }, [N, g] = L(
    o.includes(s) ? s : o[0]
  ), [f, w] = L(!1), [y, z] = L(t), [D, I] = L(""), [T, b] = L(""), [k, x] = L(""), [S, $] = L(""), [E, B] = L(!1), [H, K] = L(""), [R, C] = L(0), P = U(!1);
  V(() => {
    if (R <= 0) return;
    const j = window.setTimeout(() => C((ae) => ae - 1), 1e3);
    return () => window.clearTimeout(j);
  }, [R]);
  const W = Pi(y, D), A = D.replace(/\D/g, "").length >= 6, F = Z(
    async (j = !1) => {
      if (!(E || !j && !A)) {
        B(!0), K("");
        try {
          await (m == null ? void 0 : m(W)), w(!0), b(""), C(_);
        } catch (ae) {
          K(ye(ae, p.sendCode));
        } finally {
          B(!1);
        }
      }
    },
    [E, W, m, A, _, p.sendCode]
  ), q = Z(
    async (j) => {
      if (!(P.current || j.length !== i)) {
        P.current = !0, B(!0), K("");
        try {
          await (u == null ? void 0 : u(W, j));
        } catch (ae) {
          K(ye(ae, p.verify)), b("");
        } finally {
          P.current = !1, B(!1);
        }
      }
    },
    [i, W, u, p.verify]
  ), Q = Z(async () => {
    if (!(E || !k.trim() || !S)) {
      B(!0), K("");
      try {
        await (c == null ? void 0 : c(k.trim(), S));
      } catch (j) {
        K(ye(j, p.signIn));
      } finally {
        B(!1);
      }
    }
  }, [E, k, c, S, p.signIn]), re = o.length > 1 ? /* @__PURE__ */ e(
    X,
    {
      onClick: () => {
        g(N === "code" ? "password" : "code"), K("");
      },
      size: "sm",
      variant: "ghost",
      children: N === "code" ? p.usePassword : p.usePhone
    }
  ) : null, fe = H ? /* @__PURE__ */ e(Za, { tone: "danger", children: H }) : null;
  return N === "password" ? /* @__PURE__ */ r(
    Ne,
    {
      action: {
        disabled: !k.trim() || !S,
        label: p.signIn,
        loading: E,
        onClick: () => void Q()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ r(G, { children: [
        re,
        d
      ] }),
      subtitle: p.passwordSubtitle,
      title: p.passwordTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          pi,
          {
            autoComplete: "username",
            label: p.identifierLabel,
            onChange: (j) => x(j.target.value),
            type: "email",
            value: k
          }
        ),
        /* @__PURE__ */ e(
          Ei,
          {
            autoComplete: "current-password",
            label: p.passwordLabel,
            onChange: (j) => $(j.target.value),
            onKeyDown: (j) => {
              j.key === "Enter" && Q();
            },
            value: S
          }
        )
      ]
    }
  ) : f ? /* @__PURE__ */ r(
    Ne,
    {
      action: {
        disabled: T.length !== i,
        label: p.verify,
        loading: E,
        onClick: () => void q(T)
      },
      back: {
        label: p.back,
        onClick: () => {
          w(!1), b(""), K("");
        }
      },
      className: l,
      footer: /* @__PURE__ */ r(G, { children: [
        R > 0 ? /* @__PURE__ */ e("p", { children: p.resendIn(R) }) : /* @__PURE__ */ e(X, { onClick: () => void F(!0), size: "sm", variant: "ghost", children: p.resend }),
        d
      ] }),
      subtitle: p.codeSubtitle(W),
      title: p.codeTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          Li,
          {
            autoFocus: !0,
            label: p.codeLabel,
            length: i,
            onChange: b,
            onComplete: (j) => void q(j),
            value: T
          }
        )
      ]
    }
  ) : /* @__PURE__ */ r(
    Ne,
    {
      action: {
        disabled: !A,
        label: p.sendCode,
        loading: E,
        onClick: () => void F()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ r(G, { children: [
        re,
        d
      ] }),
      subtitle: p.phoneSubtitle,
      title: p.phoneTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          Bi,
          {
            country: y,
            label: p.phoneLabel,
            onChange: I,
            onCountryChange: z,
            onSubmit: () => void F(),
            priority: h,
            value: D
          }
        )
      ]
    }
  );
}
function mt({ children: n, className: l, closeLabel: i = "Close", footer: a, onClose: t, open: s, title: d }) {
  const o = U(null), c = U(null);
  return V(() => {
    var h;
    if (!s) return;
    c.current = document.activeElement;
    const m = document.body.style.overflow;
    document.body.style.overflow = "hidden", (h = o.current) == null || h.focus();
    const u = (_) => {
      _.key === "Escape" && t();
    };
    return window.addEventListener("keydown", u), () => {
      var _, p;
      document.body.style.overflow = m, window.removeEventListener("keydown", u), (p = (_ = c.current) == null ? void 0 : _.focus) == null || p.call(_);
    };
  }, [t, s]), !s || typeof document > "u" ? null : he(
    /* @__PURE__ */ r(G, { children: [
      /* @__PURE__ */ e("div", { className: "nim-sheet__scrim", onClick: t }),
      /* @__PURE__ */ r(
        "div",
        {
          "aria-label": typeof d == "string" ? d : i,
          "aria-modal": "true",
          className: v("nim-sheet__panel", l),
          ref: o,
          role: "dialog",
          tabIndex: -1,
          children: [
            /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-sheet__handle" }),
            d ? /* @__PURE__ */ r("div", { className: "nim-sheet__header", children: [
              /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: d }),
              /* @__PURE__ */ e(O, { label: i, name: "close", onClick: t, size: "sm" })
            ] }) : null,
            /* @__PURE__ */ e("div", { className: "nim-sheet__body", children: n }),
            a ? /* @__PURE__ */ e("div", { className: "nim-sheet__footer", children: a }) : null
          ]
        }
      )
    ] }),
    document.body
  );
}
function ut({
  className: n,
  label: l,
  max: i = 100,
  min: a = 0,
  scale: t,
  step: s = 1,
  value: d,
  ...o
}) {
  const c = i === a ? 0 : (d - a) / (i - a) * 100;
  return /* @__PURE__ */ r("div", { className: "nim-field", children: [
    l ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: l }) : null,
    /* @__PURE__ */ e(
      "input",
      {
        "aria-label": l,
        className: v("nim-slider", n),
        max: i,
        min: a,
        step: s,
        style: { "--nim-slider-progress": `${c}%` },
        type: "range",
        value: d,
        ...o
      }
    ),
    t ? /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-inline", style: { justifyContent: "space-between" }, children: t.map((m) => /* @__PURE__ */ e("span", { className: "nim-caption", children: m }, m)) }) : null
  ] });
}
function ht({ className: n, delta: l, deltaDirection: i = "up", label: a, unit: t, value: s, ...d }) {
  return /* @__PURE__ */ r("div", { className: v("nim-stat", n), ...d, children: [
    /* @__PURE__ */ r("p", { className: "nim-stat__value", children: [
      s,
      t ? /* @__PURE__ */ e("span", { className: "nim-stat__unit", children: t }) : null
    ] }),
    /* @__PURE__ */ e("p", { className: "nim-label nim-stat__label", children: a }),
    l ? /* @__PURE__ */ r("p", { className: "nim-stat__delta", "data-direction": i, children: [
      /* @__PURE__ */ e(M, { name: i === "up" ? "trend-up" : "trend-down", size: "xs" }),
      l
    ] }) : null
  ] });
}
function pt({ className: n, label: l = "Stages", stages: i }) {
  return /* @__PURE__ */ e("ol", { "aria-label": l, className: v("nim-stages", n), children: i.map((a, t) => {
    const s = /* @__PURE__ */ r(G, { children: [
      /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-stages__marker", children: a.status === "done" ? /* @__PURE__ */ e(M, { name: "check", size: "xs" }) : a.status === "blocked" ? /* @__PURE__ */ e(M, { name: "close", size: "xs" }) : t + 1 }),
      /* @__PURE__ */ r("span", { className: "nim-stages__text", children: [
        /* @__PURE__ */ e("span", { className: "nim-stages__label", children: a.label }),
        a.caption ? /* @__PURE__ */ e("span", { className: "nim-stages__caption", children: a.caption }) : null
      ] })
    ] });
    return /* @__PURE__ */ e(
      "li",
      {
        "aria-current": a.status === "active" ? "step" : void 0,
        className: "nim-stages__stage",
        "data-status": a.status,
        children: a.onSelect ? /* @__PURE__ */ e("button", { className: "nim-stages__body", onClick: a.onSelect, type: "button", children: s }) : /* @__PURE__ */ e("span", { className: "nim-stages__body", children: s })
      },
      a.id
    );
  }) });
}
function _t({
  className: n,
  decrementLabel: l = "Decrease",
  incrementLabel: i = "Increase",
  label: a,
  max: t = Number.MAX_SAFE_INTEGER,
  min: s = 0,
  onChange: d,
  step: o = 1,
  value: c
}) {
  const m = (u) => Math.min(Math.max(u, s), t);
  return /* @__PURE__ */ r(
    "div",
    {
      "aria-label": a,
      "aria-valuemax": t,
      "aria-valuemin": s,
      "aria-valuenow": c,
      className: v("nim-stepper", n),
      role: "spinbutton",
      tabIndex: 0,
      onKeyDown: (u) => {
        u.key === "ArrowUp" && (u.preventDefault(), d(m(c + o))), u.key === "ArrowDown" && (u.preventDefault(), d(m(c - o)));
      },
      children: [
        /* @__PURE__ */ e(
          "button",
          {
            "aria-label": l,
            className: "nim-stepper__button",
            disabled: c <= s,
            onClick: () => d(m(c - o)),
            tabIndex: -1,
            type: "button",
            children: /* @__PURE__ */ e(M, { name: "minus", size: "sm" })
          }
        ),
        /* @__PURE__ */ e("span", { className: "nim-stepper__value", children: c }),
        /* @__PURE__ */ e(
          "button",
          {
            "aria-label": i,
            className: "nim-stepper__button",
            disabled: c >= t,
            onClick: () => d(m(c + o)),
            tabIndex: -1,
            type: "button",
            children: /* @__PURE__ */ e(M, { name: "plus", size: "sm" })
          }
        )
      ]
    }
  );
}
const Ki = {
  of: (n, l) => `${n} of ${l} steps`,
  status: {
    active: "In progress",
    done: "Done",
    failed: "Failed",
    pending: "Waiting",
    skipped: "Skipped"
  }
}, Wi = {
  done: "check",
  failed: "close",
  pending: "clock",
  skipped: "minus"
};
function ft({
  action: n,
  caption: l,
  className: i,
  labels: a,
  steps: t,
  title: s,
  value: d
}) {
  const o = { ...Ki, ...a }, c = t.filter((h) => h.status === "done" || h.status === "skipped").length, m = d ?? (t.length ? Math.round(c / t.length * 100) : 0), u = t.some((h) => h.status === "failed");
  return /* @__PURE__ */ r(
    "section",
    {
      "aria-live": "polite",
      className: v("nim-task", u && "nim-task--failed", i),
      children: [
        /* @__PURE__ */ r("header", { className: "nim-task__head", children: [
          s ? /* @__PURE__ */ e("h2", { className: "nim-task__title", children: s }) : null,
          l ? /* @__PURE__ */ e("p", { className: "nim-task__caption", children: l }) : null,
          /* @__PURE__ */ e(Pa, { label: o.of(c, t.length), value: m })
        ] }),
        /* @__PURE__ */ e("ol", { className: "nim-task__steps", children: t.map((h) => /* @__PURE__ */ r("li", { className: "nim-task__step", "data-status": h.status, children: [
          /* @__PURE__ */ e("span", { className: "nim-task__marker", children: h.status === "active" ? /* @__PURE__ */ e(He, { size: "sm" }) : /* @__PURE__ */ e(M, { name: Wi[h.status], size: "xs" }) }),
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
function Nt({ className: n, density: l = "default", entries: i }) {
  return /* @__PURE__ */ e("ol", { className: v("nim-timeline", l === "compact" && "nim-timeline--compact", n), children: i.map((a) => /* @__PURE__ */ r("li", { className: "nim-timeline__entry", "data-tone": a.tone, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-timeline__marker", children: a.icon ? /* @__PURE__ */ e(M, { name: a.icon, size: "xs" }) : /* @__PURE__ */ e("span", { className: "nim-timeline__dot" }) }),
    /* @__PURE__ */ r("div", { className: "nim-timeline__content", children: [
      /* @__PURE__ */ r("div", { className: "nim-timeline__head", children: [
        /* @__PURE__ */ e("span", { className: "nim-timeline__title", children: a.title }),
        a.time ? /* @__PURE__ */ e("time", { className: "nim-timeline__time", children: a.time }) : null
      ] }),
      a.body && l !== "compact" ? /* @__PURE__ */ e("div", { className: "nim-timeline__body", children: a.body }) : null
    ] })
  ] }, a.id)) });
}
function bt({ className: n, label: l, onChange: i, options: a, value: t, ...s }) {
  const d = U(null), o = (c) => {
    var p, N;
    const m = c.key === "ArrowRight" ? 1 : c.key === "ArrowLeft" ? -1 : 0;
    if (m === 0) return;
    c.preventDefault();
    const u = a.filter((g) => !g.disabled), h = u.findIndex((g) => g.value === t), _ = u[(h + m + u.length) % u.length];
    _ && (i(_.value), (N = (p = d.current) == null ? void 0 : p.querySelector(`[data-value="${_.value}"]`)) == null || N.focus());
  };
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": l,
      className: v("nim-tabs", n),
      onKeyDown: o,
      ref: d,
      role: "tablist",
      ...s,
      children: a.map((c) => /* @__PURE__ */ r(
        "button",
        {
          "aria-selected": c.value === t,
          className: "nim-tab",
          "data-value": c.value,
          disabled: c.disabled,
          onClick: () => i(c.value),
          role: "tab",
          tabIndex: c.value === t ? 0 : -1,
          type: "button",
          children: [
            c.label,
            c.count === void 0 ? null : /* @__PURE__ */ e("span", { className: "nim-tab__count", children: c.count })
          ]
        },
        c.value
      ))
    }
  );
}
const Xe = Ce(null), Zi = {
  accent: "sparkle",
  danger: "danger",
  neutral: "info",
  success: "check-circle"
};
function vt({ children: n }) {
  const [l, i] = L([]), a = U(0), t = Z((o) => {
    i((c) => c.filter((m) => m.id !== o));
  }, []), s = Z(
    (o) => {
      const c = a.current++;
      i((u) => [...u, { ...o, id: c }]);
      const m = o.duration ?? 4e3;
      m > 0 && window.setTimeout(() => t(c), m);
    },
    [t]
  ), d = Y(() => s, [s]);
  return /* @__PURE__ */ r(Xe.Provider, { value: d, children: [
    n,
    typeof document < "u" ? he(
      /* @__PURE__ */ e("div", { "aria-live": "polite", className: "nim-toast-stack", children: l.map((o) => /* @__PURE__ */ r("div", { className: v("nim-toast", `nim-toast--${o.tone ?? "neutral"}`), children: [
        /* @__PURE__ */ e(M, { className: "nim-toast__icon", name: Zi[o.tone ?? "neutral"], size: "sm" }),
        /* @__PURE__ */ e("span", { className: "nim-toast__message", children: o.message }),
        o.action ? /* @__PURE__ */ e(
          "button",
          {
            className: "nim-toast__action",
            onClick: () => {
              var c;
              (c = o.action) == null || c.onPress(), t(o.id);
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
function gt() {
  const n = xe(Xe);
  if (!n) throw new Error("useToast must be used inside <ToastProvider>");
  return n;
}
function yt({ children: n, className: l, label: i }) {
  return /* @__PURE__ */ r("span", { className: v("nim-tooltip", l), children: [
    n,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-tooltip__bubble", role: "tooltip", children: i })
  ] });
}
const Yi = {
  back: "Back",
  close: "Close",
  step: (n, l) => `Step ${n + 1} of ${l}`
};
function kt({
  className: n,
  continueLabel: l,
  finishLabel: i,
  labels: a,
  onClose: t,
  onDone: s,
  onStep: d,
  steps: o
}) {
  const c = { ...Yi, ...a }, [m, u] = L(0), h = o[Math.min(m, o.length - 1)], _ = m === o.length - 1, p = Z(
    (N) => {
      u(N), d == null || d(N);
    },
    [d]
  );
  return /* @__PURE__ */ r("section", { className: v("nim-wizard", n), children: [
    /* @__PURE__ */ r("header", { className: "nim-wizard__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: m > 0 ? /* @__PURE__ */ e(O, { label: c.back, name: "chevron-back", onClick: () => p(m - 1), size: "sm" }) : null }),
      /* @__PURE__ */ e("ol", { "aria-label": c.step(m, o.length), className: "nim-wizard__dots", children: o.map((N, g) => /* @__PURE__ */ e(
        "li",
        {
          className: "nim-wizard__dot",
          "data-done": g < m ? "true" : void 0,
          "data-on": g === m ? "true" : void 0
        },
        N.id
      )) }),
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: t ? /* @__PURE__ */ e(O, { label: c.close, name: "close", onClick: t, size: "sm" }) : null })
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
        onClick: () => _ ? s() : p(m + 1),
        size: "lg",
        variant: "accent",
        children: h.continueLabel ?? (_ ? i : l)
      }
    ) })
  ] });
}
function wt({
  className: n,
  max: l,
  multiple: i = !1,
  onChange: a,
  options: t,
  selected: s
}) {
  const d = i && l !== void 0 && s.length >= l, o = (c) => {
    if (!i) {
      a([c]);
      return;
    }
    a(s.includes(c) ? s.filter((m) => m !== c) : [...s, c]);
  };
  return /* @__PURE__ */ e("div", { className: v("nim-choice-grid", n), role: i ? "group" : "radiogroup", children: t.map((c) => {
    const m = s.includes(c.id);
    return /* @__PURE__ */ r(
      "button",
      {
        "aria-checked": m,
        className: "nim-choice-grid__tile",
        "data-on": m ? "true" : void 0,
        disabled: c.disabled || d && !m,
        onClick: () => o(c.id),
        role: i ? "checkbox" : "radio",
        type: "button",
        children: [
          c.icon ? /* @__PURE__ */ e("span", { className: "nim-choice-grid__icon", children: c.icon }) : null,
          /* @__PURE__ */ e("span", { className: "nim-choice-grid__label", children: c.label })
        ]
      },
      c.id
    );
  }) });
}
const Je = (n = "default") => n === "default" ? void 0 : `nim-text--${n}`;
function ji({
  as: n = "h1",
  children: l,
  className: i,
  size: a = "md",
  ...t
}) {
  return /* @__PURE__ */ e(
    n,
    {
      className: v(
        "nim-display",
        a === "lg" && "nim-display--lg",
        a === "xl" && "nim-display--xl",
        i
      ),
      ...t,
      children: l
    }
  );
}
ji.Line = function({
  children: l,
  accent: i,
  indent: a,
  className: t,
  ...s
}) {
  return /* @__PURE__ */ e(
    "span",
    {
      className: v("nim-display__line", i && "nim-display__accent", t),
      "data-indent": a ? "true" : void 0,
      ...s,
      children: l
    }
  );
};
function Ct({
  as: n = "h2",
  children: l,
  className: i,
  size: a = "lg",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-title", a === "md" && "nim-title--md", i), ...t, children: l });
}
function xt({
  as: n = "p",
  children: l,
  className: i,
  size: a = "md",
  tone: t,
  ...s
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-body", a === "sm" && "nim-body--sm", Je(t), i), ...s, children: l });
}
function Mt({ as: n = "span", children: l, className: i, ...a }) {
  return /* @__PURE__ */ e(n, { className: v("nim-label", i), ...a, children: l });
}
function Tt({ as: n = "p", children: l, className: i, tone: a, ...t }) {
  return /* @__PURE__ */ e(n, { className: v("nim-caption", Je(a), i), ...t, children: l });
}
function St({ className: n, ...l }) {
  return /* @__PURE__ */ e("hr", { className: v("nim-rule", n), ...l });
}
export {
  xl as Accordion,
  Ll as ActionBar,
  il as ActivityFeed,
  el as AdminShell,
  nt as AppFrame,
  Ml as AppShell,
  El as AssistantThread,
  Ne as AuthScreen,
  de as Avatar,
  Tl as AvatarRing,
  Ka as Badge,
  Za as Banner,
  xt as Body,
  vl as Brand,
  gl as BrandMark,
  Sl as Breadcrumb,
  X as Button,
  ue as COUNTRIES,
  Ve as Calendar,
  Tt as Caption,
  zl as Card,
  Il as Chart,
  $l as Chat,
  Ul as ChatComposer,
  ze as Checkbox,
  hi as Chip,
  Gl as ChipInput,
  wt as ChoiceGrid,
  ml as CodeBlock,
  dl as Columns,
  Yl as Combobox,
  si as ConversationList,
  Nl as CopyChip,
  Hl as DataList,
  Cl as DataTable,
  ql as DateField,
  Ql as DatePicker,
  nl as DetailHeader,
  bl as DetailLayout,
  Xl as Dialog,
  ji as Display,
  $a as EmptyState,
  ol as Facts,
  Kl as Field,
  et as FileDrop,
  al as FilterChips,
  M as Icon,
  O as IconButton,
  it as Inline,
  pi as Input,
  Mt as Label,
  xi as List,
  Mi as ListRow,
  Rl as MapView,
  Ol as MediaPlayer,
  De as Menu,
  Pl as Messenger,
  rl as Metric,
  cl as MetricGrid,
  hl as Mono,
  jl as NimProvider,
  lt as Onboarding,
  Dl as OptionCard,
  Al as OrderSummary,
  Li as OtpInput,
  ll as Page,
  Ia as Pagination,
  tl as Panel,
  Ei as PasswordField,
  Bi as PhoneField,
  Ri as PlanCard,
  rt as PlanPicker,
  ja as Popover,
  Ha as ProfileHeader,
  ct as ProfileScreen,
  Pa as Progress,
  kl as Radio,
  wl as RadioGroup,
  _l as Rail,
  fl as RailSection,
  ot as Rating,
  pl as RecordLink,
  Jl as ResourceMeter,
  Fl as RoomHeader,
  St as Rule,
  Gi as SectionHeader,
  Oi as Segmented,
  Zl as Select,
  mt as Sheet,
  dt as SignInFlow,
  Fa as Skeleton,
  ut as Slider,
  Bl as Sparkline,
  He as Spinner,
  at as Stack,
  pt as StageTrack,
  ht as Stat,
  ul as StatusDot,
  _t as Stepper,
  Ba as Switch,
  Ua as TabBar,
  Se as Table,
  bt as Tabs,
  ft as TaskProgress,
  Wl as Textarea,
  Nt as Timeline,
  Ct as Title,
  vt as ToastProvider,
  sl as Toolbar,
  yt as Tooltip,
  kt as Wizard,
  ge as addDays,
  Ee as addMonths,
  yl as brandFor,
  v as cn,
  tt as countryByDial,
  Qe as countryByIso2,
  Ai as countryNamer,
  we as formatNumeric,
  te as fromParts,
  Ji as iconNames,
  je as monthLength,
  wi as parseNumeric,
  ne as partsOf,
  st as scorePassword,
  bi as startOfMonth,
  se as toAsciiDigits,
  Pi as toE164,
  _e as todayIso,
  pe as useNim,
  Vl as useSchemeToggle,
  gt as useToast
};
