import { jsx as e, jsxs as r, Fragment as H } from "react/jsx-runtime";
import { forwardRef as Oe, useState as E, useCallback as Z, createContext as Ce, useContext as xe, useId as J, Fragment as ke, useRef as O, useLayoutEffect as en, useEffect as j, useMemo as Y, createElement as nn } from "react";
import { Wallet as an, VolumeX as ln, Volume2 as tn, User as sn, Video as rn, Upload as cn, TrendingUp as on, TrendingDown as dn, Trash2 as mn, Sun as un, Star as hn, Sparkles as _n, CircleStop as pn, LogOut as fn, Share2 as Nn, Settings as vn, Send as bn, Search as gn, Plus as yn, Play as kn, Pin as wn, Pause as Cn, Paperclip as xn, Moon as Mn, Minus as Tn, Mic as Sn, Menu as Dn, Lock as zn, Loader as Ln, Info as An, Home as $n, Heart as En, Hash as In, Forward as Bn, Filter as Pn, Maximize2 as Fn, SmilePlus as Rn, MessageCircle as On, Eye as Un, ExternalLink as Hn, Pencil as Kn, Download as Gn, FileText as Wn, CircleAlert as Zn, Copy as Yn, X as jn, Clock as Vn, ChevronUp as qn, ChevronRight as Qn, ChevronDown as Xn, ChevronLeft as Jn, CircleCheck as ea, Check as na, Camera as aa, Calendar as ia, Bookmark as la, Bell as ta, Users as sa, Terminal as ra, Tag as ca, ShieldCheck as oa, Server as da, Reply as ma, RefreshCw as ua, Package as ha, MoreHorizontal as _a, Link2 as pa, Layers as fa, KeyRound as Na, Globe as va, Database as ba, Cloud as ga, BarChart3 as ya, ArrowRight as ka, ArrowLeft as wa, AlertTriangle as Ca, Activity as xa } from "lucide-react";
import { createPortal as he } from "react-dom";
const v = (...n) => n.filter(Boolean).join(" "), Ue = {
  activity: xa,
  alert: Ca,
  "arrow-back": wa,
  "arrow-forward": ka,
  chart: ya,
  cloud: ga,
  database: ba,
  globe: va,
  key: Na,
  layers: fa,
  link: pa,
  more: _a,
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
  download: Gn,
  edit: Kn,
  external: Hn,
  eye: Un,
  chat: On,
  emoji: Rn,
  expand: Fn,
  filter: Pn,
  forward: Bn,
  hash: In,
  heart: En,
  home: $n,
  info: An,
  loading: Ln,
  lock: zn,
  menu: Dn,
  mic: Sn,
  minus: Tn,
  moon: Mn,
  paperclip: xn,
  pause: Cn,
  pin: wn,
  play: kn,
  plus: yn,
  search: gn,
  send: bn,
  settings: vn,
  share: Nn,
  "sign-out": fn,
  stop: pn,
  sparkle: _n,
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
function T({ className: n, label: t, name: i, size: a = "md", tone: l = "default", ...s }) {
  const c = Ue[i];
  return /* @__PURE__ */ e(
    c,
    {
      "aria-hidden": t ? void 0 : !0,
      "aria-label": t,
      className: v("nim-icon", n),
      "data-flip": Ma.has(i) ? "true" : void 0,
      "data-tone": l === "default" ? void 0 : l,
      focusable: "false",
      height: Te[a],
      role: t ? "img" : void 0,
      strokeWidth: 1.75,
      width: Te[a],
      ...s
    }
  );
}
const el = Object.keys(Ue), Ta = { sm: "sm", md: "md", lg: "md" }, U = Oe(function({ className: t, label: i, name: a, size: l = "md", type: s = "button", variant: c = "ghost", ...o }, d) {
  return /* @__PURE__ */ e(
    "button",
    {
      "aria-label": i,
      className: v("nim-icon-button", `nim-icon-button--${c}`, `nim-icon-button--${l}`, t),
      ref: d,
      title: i,
      type: s,
      ...o,
      children: /* @__PURE__ */ e(T, { name: a, size: Ta[l] })
    }
  );
}), Sa = {
  close: "Close menu",
  collapse: "Collapse",
  expand: "Expand",
  menu: "Open menu",
  nav: "Admin navigation"
};
function nl({
  brand: n,
  children: t,
  className: i,
  collapsible: a = !1,
  contextualFooter: l,
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
  const p = { ...Sa, ...m }, [w, y] = E(!1), [D, I] = E(!1), k = g === "scope" ? "div" : "h1", x = (C, $, L) => /* @__PURE__ */ e("nav", { "aria-label": L, className: "nim-admin__nav", children: C.map((A) => /* @__PURE__ */ r("div", { className: "nim-admin__group", children: [
    A.label ? /* @__PURE__ */ r("p", { className: "nim-admin__group-label", children: [
      A.icon ? /* @__PURE__ */ e(T, { name: A.icon, size: "xs" }) : null,
      A.label
    ] }) : null,
    A.items.map((B) => {
      const K = B.key === $, G = /* @__PURE__ */ r(H, { children: [
        B.icon ? /* @__PURE__ */ e(T, { name: B.icon, size: "sm" }) : null,
        /* @__PURE__ */ e("span", { children: B.label })
      ] }), P = {
        "aria-current": K ? "page" : void 0,
        className: "nim-admin__link",
        "data-active": K ? "true" : void 0,
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
      className: v("nim-admin", i),
      "data-collapsed": a && D ? "true" : void 0,
      "data-drawer": w ? "open" : void 0,
      "data-navigation": u,
      children: [
        u !== "sections" ? /* @__PURE__ */ r("aside", { className: "nim-admin__sidebar", children: [
          n || a ? /* @__PURE__ */ e("div", { className: "nim-admin__brand", children: n }) : null,
          b,
          h ? /* @__PURE__ */ e("div", { className: "nim-admin__sidebar-foot", children: h }) : null,
          a ? /* @__PURE__ */ r(
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
              l ? /* @__PURE__ */ e("div", { className: "nim-admin__context-foot", children: l }) : null
            ] }),
            /* @__PURE__ */ e("main", { className: "nim-admin__main", children: t })
          ] }) : /* @__PURE__ */ e("main", { className: "nim-admin__main", children: t })
        ] })
      ]
    }
  );
}
function al({
  actions: n,
  back: t,
  className: i,
  meta: a,
  status: l,
  subtitle: s,
  title: c
}) {
  return /* @__PURE__ */ r("header", { className: v("nim-detail-header", i), children: [
    t ? t.href ? /* @__PURE__ */ r("a", { className: "nim-detail-header__back", href: t.href, children: [
      /* @__PURE__ */ e(T, { name: "chevron-back", size: "sm" }),
      t.label
    ] }) : /* @__PURE__ */ r("button", { className: "nim-detail-header__back", onClick: t.onClick, type: "button", children: [
      /* @__PURE__ */ e(T, { name: "chevron-back", size: "sm" }),
      t.label
    ] }) : null,
    /* @__PURE__ */ r("div", { className: "nim-detail-header__row", children: [
      /* @__PURE__ */ r("div", { className: "nim-detail-header__text", children: [
        /* @__PURE__ */ r("div", { className: "nim-detail-header__headline", children: [
          /* @__PURE__ */ e("h1", { className: "nim-detail-header__title", children: c }),
          l ? /* @__PURE__ */ e("span", { className: "nim-detail-header__status", children: l }) : null
        ] }),
        s ? /* @__PURE__ */ e("p", { className: "nim-detail-header__subtitle", children: s }) : null,
        a ? /* @__PURE__ */ e("div", { className: "nim-detail-header__meta", children: a }) : null
      ] }),
      n ? /* @__PURE__ */ e("div", { className: "nim-detail-header__actions", children: n }) : null
    ] })
  ] });
}
function il({
  chips: n,
  className: t,
  clearLabel: i,
  labels: a,
  onClearAll: l
}) {
  if (n.length === 0) return null;
  const s = {
    remove: (c) => `Remove filter ${c}`,
    toolbar: "Active filters",
    ...a
  };
  return /* @__PURE__ */ r("div", { "aria-label": s.toolbar, className: v("nim-filter-chips", t), role: "toolbar", children: [
    n.map((c) => /* @__PURE__ */ r("span", { className: "nim-filter-chip", children: [
      /* @__PURE__ */ r("span", { className: "nim-filter-chip__label", children: [
        c.label,
        c.value !== void 0 ? /* @__PURE__ */ r(H, { children: [
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
    l && i ? /* @__PURE__ */ e("button", { className: "nim-filter-chips__clear", onClick: l, type: "button", children: i }) : null
  ] });
}
function ll({ className: n, empty: t, events: i, locale: a }) {
  const l = new Intl.DateTimeFormat(a, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
  return i.length === 0 ? /* @__PURE__ */ e("div", { className: v("nim-activity", n), children: t }) : /* @__PURE__ */ e("ol", { className: v("nim-activity", n), children: i.map((s) => /* @__PURE__ */ r("li", { className: "nim-activity__item", "data-tone": s.tone, children: [
    /* @__PURE__ */ e("span", { className: "nim-activity__marker", children: s.icon ? /* @__PURE__ */ e(T, { name: s.icon, size: "xs" }) : null }),
    /* @__PURE__ */ r("div", { className: "nim-activity__body", children: [
      /* @__PURE__ */ r("p", { className: "nim-activity__action", children: [
        s.actor ? /* @__PURE__ */ e("strong", { children: s.actor }) : null,
        " ",
        s.action,
        " ",
        s.target ? /* @__PURE__ */ e("span", { className: "nim-activity__target", children: s.target }) : null
      ] }),
      s.at ? /* @__PURE__ */ e("time", { className: "nim-activity__time", dateTime: s.at, children: l.format(new Date(s.at)) }) : null
    ] })
  ] }, s.id)) });
}
function tl({ children: n, className: t, width: i = "wide", ...a }) {
  return /* @__PURE__ */ e("div", { className: v("nim-page", t), "data-width": i, ...a, children: n });
}
function sl({
  actions: n,
  caption: t,
  children: i,
  className: a,
  description: l,
  eyebrow: s,
  flush: c = !1,
  footer: o,
  marker: d,
  title: m,
  ...u
}) {
  const h = m || t || l || s || n;
  return /* @__PURE__ */ r("section", { className: v("nim-panel", a), ...u, children: [
    h ? /* @__PURE__ */ r("header", { className: "nim-panel__head", children: [
      d ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-panel__marker", children: d }) : null,
      /* @__PURE__ */ r("div", { className: "nim-panel__heading", children: [
        s ? /* @__PURE__ */ e("p", { className: "nim-panel__eyebrow", children: s }) : null,
        m ? /* @__PURE__ */ r("div", { className: "nim-panel__title-row", children: [
          /* @__PURE__ */ e("h2", { className: "nim-panel__title", children: m }),
          t ? /* @__PURE__ */ e("p", { className: "nim-panel__caption", children: t }) : null
        ] }) : null,
        l ? /* @__PURE__ */ e("p", { className: "nim-panel__description", children: l }) : null
      ] }),
      n ? /* @__PURE__ */ e("div", { className: "nim-panel__actions", children: n }) : null
    ] }) : null,
    i ? /* @__PURE__ */ e("div", { className: "nim-panel__body", "data-flush": c ? "true" : void 0, children: i }) : null,
    o ? /* @__PURE__ */ e("div", { className: "nim-panel__foot", children: o }) : null
  ] });
}
function rl({ actions: n, children: t, className: i, ...a }) {
  return /* @__PURE__ */ r("div", { className: v("nim-toolbar", i), role: "toolbar", ...a, children: [
    t ? /* @__PURE__ */ e("div", { className: "nim-toolbar__group", children: t }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-toolbar__actions", children: n }) : null
  ] });
}
function cl({
  className: n,
  delta: t,
  deltaDirection: i = "up",
  deltaIntent: a = "more-is-better",
  hint: l,
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
  const N = a === "more-is-better" ? i === "up" : i === "down";
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
        t || l ? /* @__PURE__ */ r("span", { className: "nim-metric__foot", children: [
          t ? /* @__PURE__ */ r("span", { className: "nim-metric__delta", "data-intent": N ? "good" : "bad", children: [
            /* @__PURE__ */ e(T, { name: i === "up" ? "trend-up" : "trend-down", size: "xs" }),
            t
          ] }) : null,
          l ? /* @__PURE__ */ e("span", { className: "nim-metric__hint", children: l }) : null,
          s ? /* @__PURE__ */ e("span", { className: "nim-metric__source", children: s }) : null
        ] }) : null
      ]
    }
  );
}
function ol({ children: n, className: t, columns: i = 4, dense: a = !1, ...l }) {
  return /* @__PURE__ */ e(
    "div",
    {
      className: v("nim-metric-grid", t),
      "data-columns": i,
      "data-dense": a ? "true" : void 0,
      ...l,
      children: n
    }
  );
}
function dl({ className: n, columns: t = 2, items: i, ...a }) {
  return /* @__PURE__ */ e("dl", { className: v("nim-facts", n), "data-columns": t, ...a, children: i.map((l, s) => /* @__PURE__ */ r(
    "div",
    {
      className: "nim-facts__item",
      "data-unmeasured": l.unmeasured ? "true" : void 0,
      children: [
        /* @__PURE__ */ r("dt", { className: "nim-facts__label", children: [
          l.label,
          l.source || l.why ? /* @__PURE__ */ e("span", { className: "nim-facts__source", children: l.unmeasured ? l.why : l.source }) : null
        ] }),
        /* @__PURE__ */ e("dd", { className: "nim-facts__value", "data-mono": l.mono ? "true" : void 0, children: l.value })
      ]
    },
    l.key ?? s
  )) });
}
function ml({ align: n = "stretch", children: t, className: i, template: a = "halves", ...l }) {
  return /* @__PURE__ */ e("div", { className: v("nim-columns", i), "data-align": n === "start" ? "start" : void 0, "data-template": a, ...l, children: t });
}
function ul({ actions: n, className: t, description: i, icon: a, title: l, tone: s = "neutral", ...c }) {
  return /* @__PURE__ */ r("section", { className: v("nim-status-hero", t), "data-tone": s, ...c, children: [
    /* @__PURE__ */ e("span", { className: "nim-status-hero__mark", children: /* @__PURE__ */ e(T, { name: a, size: "xl" }) }),
    /* @__PURE__ */ r("div", { className: "nim-status-hero__copy", children: [
      /* @__PURE__ */ e("strong", { className: "nim-status-hero__title", children: l }),
      i ? /* @__PURE__ */ e("p", { className: "nim-status-hero__description", children: i }) : null
    ] }),
    n ? /* @__PURE__ */ e("div", { className: "nim-status-hero__actions", children: n }) : null
  ] });
}
function hl({
  children: n,
  className: t,
  copiedLabel: i = "Copied",
  copyLabel: a = "Copy",
  label: l,
  wrap: s = !1,
  ...c
}) {
  const [o, d] = E(!1), m = typeof navigator < "u" && !!navigator.clipboard, u = Z(() => {
    navigator.clipboard.writeText(n).then(() => {
      d(!0), window.setTimeout(() => d(!1), 1600);
    });
  }, [n]);
  return /* @__PURE__ */ r("figure", { className: v("nim-code", t), children: [
    l || m ? /* @__PURE__ */ r("figcaption", { className: "nim-code__head", children: [
      l ? /* @__PURE__ */ e("span", { className: "nim-code__label", children: l }) : /* @__PURE__ */ e("span", {}),
      m ? /* @__PURE__ */ r("button", { className: "nim-code__copy", onClick: u, type: "button", children: [
        /* @__PURE__ */ e(T, { name: o ? "check" : "copy", size: "xs" }),
        o ? i : a
      ] }) : null
    ] }) : null,
    /* @__PURE__ */ e("pre", { className: "nim-code__body", "data-wrap": s ? "true" : void 0, tabIndex: 0, ...c, children: n })
  ] });
}
function _l({ children: n, className: t, pulse: i = !1, tone: a = "neutral", ...l }) {
  return /* @__PURE__ */ r("span", { className: v("nim-status", t), "data-tone": a, ...l, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-status__dot", "data-pulse": i ? "true" : void 0 }),
    n
  ] });
}
function pl({ children: n, className: t, size: i = "sm", ...a }) {
  return /* @__PURE__ */ e("code", { className: v("nim-mono", t), "data-size": i, ...a, children: n });
}
function fl({ className: n, href: t, meta: i, onClick: a, title: l }) {
  const s = /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ e("strong", { className: "nim-record__title", children: l }),
    i ? /* @__PURE__ */ e("span", { className: "nim-record__meta", children: i }) : null
  ] });
  return t ? /* @__PURE__ */ e("a", { className: v("nim-record", n), href: t, children: s }) : a ? /* @__PURE__ */ e("button", { className: v("nim-record", n), onClick: a, type: "button", children: s }) : /* @__PURE__ */ e("span", { className: v("nim-record", n), children: s });
}
function Nl({ actions: n, children: t, className: i, footer: a, title: l, ...s }) {
  return /* @__PURE__ */ r("section", { className: v("nim-rail", i), ...s, children: [
    /* @__PURE__ */ r("header", { className: "nim-rail__head", children: [
      /* @__PURE__ */ e("h2", { className: "nim-rail__title", children: l }),
      n ? /* @__PURE__ */ e("div", { className: "nim-rail__actions", children: n }) : null
    ] }),
    /* @__PURE__ */ e("div", { className: "nim-rail__body", children: t }),
    a ? /* @__PURE__ */ e("div", { className: "nim-rail__foot", children: a }) : null
  ] });
}
function vl({ children: n, className: t, meta: i, title: a, tone: l = "neutral", ...s }) {
  return /* @__PURE__ */ r(
    "div",
    {
      className: v("nim-rail__section", t),
      "data-tone": l === "neutral" ? void 0 : l,
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
function bl({
  children: n,
  className: t,
  copiedLabel: i = "Copied",
  copyLabel: a = "Copy",
  ...l
}) {
  const [s, c] = E(!1), o = typeof navigator < "u" && !!navigator.clipboard, d = Z(() => {
    navigator.clipboard.writeText(n).then(() => {
      c(!0), window.setTimeout(() => c(!1), 1600);
    });
  }, [n]);
  return /* @__PURE__ */ r("span", { className: v("nim-copy-chip", t), ...l, children: [
    /* @__PURE__ */ e("span", { className: "nim-copy-chip__value", children: n }),
    o ? /* @__PURE__ */ e(
      "button",
      {
        "aria-label": s ? i : `${a} ${n}`,
        className: "nim-copy-chip__button",
        onClick: d,
        type: "button",
        children: /* @__PURE__ */ e(T, { name: s ? "check" : "copy", size: "xs" })
      }
    ) : null
  ] });
}
function gl({ aside: n, children: t, className: i, ...a }) {
  return /* @__PURE__ */ r("div", { className: v("nim-detail", i), ...a, children: [
    /* @__PURE__ */ e("div", { className: "nim-detail__main", children: t }),
    n ? /* @__PURE__ */ e("aside", { className: "nim-detail__aside", children: n }) : null
  ] });
}
function yl({
  className: n,
  href: t,
  mark: i,
  name: a,
  nameAccent: l,
  size: s = "md",
  tagline: c,
  ...o
}) {
  const d = /* @__PURE__ */ r(H, { children: [
    i ? /* @__PURE__ */ e("span", { className: "nim-brand__mark", children: i }) : null,
    /* @__PURE__ */ r("span", { className: "nim-brand__text", children: [
      /* @__PURE__ */ r("strong", { className: "nim-brand__name", children: [
        a,
        l ? /* @__PURE__ */ e("span", { className: "nim-brand__name-accent", children: l }) : null
      ] }),
      c ? /* @__PURE__ */ e("small", { className: "nim-brand__tagline", children: c }) : null
    ] })
  ] }), m = v("nim-brand", n);
  return t ? /* @__PURE__ */ e("a", { className: m, "data-size": s, href: t, ...o, children: d }) : /* @__PURE__ */ e("span", { className: m, "data-size": s, ...o, children: d });
}
const Da = {
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
}, za = {
  gitea: /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ e("path", { d: "M7 4h7a6 6 0 0 1 0 12h-2" }),
    /* @__PURE__ */ e("circle", { cx: "7", cy: "8", r: "3" }),
    /* @__PURE__ */ e("path", { d: "M12 16v4" })
  ] }),
  github: /* @__PURE__ */ e("path", { d: "M12 2.6a9.4 9.4 0 0 0-3 18.3c.5.1.6-.2.6-.5v-1.7c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.8.8.1-.6.3-1.1.6-1.3-2.1-.2-4.3-1-4.3-4.6 0-1 .4-1.9 1-2.5-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.6.6.6 1 1.5 1 2.5 0 3.6-2.2 4.4-4.3 4.6.3.3.6.9.6 1.8v2.7c0 .3.2.6.7.5A9.4 9.4 0 0 0 12 2.6Z" }),
  gitlab: /* @__PURE__ */ e("path", { d: "m12 21-3.5-10.8H3.3L12 21l8.7-10.8h-5.2L12 21ZM8.5 10.2 6.6 4l-3.3 6.2h5.2Zm7 0L17.4 4l3.3 6.2h-5.2Z" }),
  grafana: /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ e("circle", { cx: "12", cy: "13", r: "5" }),
    /* @__PURE__ */ e("path", { d: "M12 4v4M6 6l2 3M18 6l-2 3" })
  ] }),
  jaeger: /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ e("circle", { cx: "12", cy: "12", r: "8" }),
    /* @__PURE__ */ e("circle", { cx: "12", cy: "12", r: "3" })
  ] }),
  loki: /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ e("path", { d: "M12 3 5 9v9h14V9l-7-6Z" }),
    /* @__PURE__ */ e("path", { d: "M9 18v-5h6v5" })
  ] }),
  mongodb: /* @__PURE__ */ e("path", { d: "M12 2.5c2.6 3.2 5 6 5 10 0 3.4-2.2 6.2-4.3 7.1L12 22l-.7-2.4C9.2 18.7 7 15.9 7 12.5c0-4 2.4-6.8 5-10Z" }),
  postgresql: /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ e("ellipse", { cx: "12", cy: "7", rx: "7", ry: "3.2" }),
    /* @__PURE__ */ e("path", { d: "M5 7v9c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2V7" }),
    /* @__PURE__ */ e("path", { d: "M5 12c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2" })
  ] }),
  prometheus: /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ e("path", { d: "M12 2c2.6 2.8 3.6 5 2.6 7.4C13.8 11.2 12 11.8 12 14" }),
    /* @__PURE__ */ e("circle", { cx: "12", cy: "14", r: "7" }),
    /* @__PURE__ */ e("path", { d: "M8 12h8" })
  ] }),
  redis: /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ e("path", { d: "m12 3 9 4-9 4-9-4 9-4Z" }),
    /* @__PURE__ */ e("path", { d: "m3 12 9 4 9-4M3 17l9 4 9-4" })
  ] }),
  valkey: /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ e("path", { d: "m12 3 9 4-9 4-9-4 9-4Z" }),
    /* @__PURE__ */ e("path", { d: "m3 12 9 4 9-4" })
  ] })
}, La = /* @__PURE__ */ new Set(["github", "gitlab", "mongodb"]), Aa = { lg: 32, md: 24, sm: 20 };
function kl({ className: n, label: t, name: i, size: a = "md", ...l }) {
  const s = La.has(i), c = Aa[a];
  return /* @__PURE__ */ e(
    "svg",
    {
      "aria-hidden": t ? void 0 : !0,
      "aria-label": t,
      className: v("nim-brand-mark", n),
      fill: s ? "currentColor" : "none",
      height: c,
      role: t ? "img" : void 0,
      stroke: s ? "none" : "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 1.6,
      style: { color: Da[i] },
      viewBox: "0 0 24 24",
      width: c,
      ...l,
      children: za[i]
    }
  );
}
function wl(n) {
  const t = n.toLowerCase();
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
  }[t];
}
const X = Oe(function({
  children: t,
  className: i,
  fullWidth: a = !1,
  iconEnd: l,
  iconStart: s,
  size: c = "md",
  variant: o = "primary",
  ...d
}, m) {
  const u = v(
    "nim-button",
    `nim-button--${o}`,
    `nim-button--${c}`,
    a && "nim-button--full",
    i
  ), h = /* @__PURE__ */ r(H, { children: [
    s ? /* @__PURE__ */ e(T, { name: s, size: "sm" }) : null,
    /* @__PURE__ */ e("span", { className: "nim-button__label", children: t }),
    l ? /* @__PURE__ */ e(T, { name: l, size: "sm" }) : null
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
        _ ? /* @__PURE__ */ r(H, { children: [
          /* @__PURE__ */ e("span", { className: "nim-button__label", children: t }),
          l ? /* @__PURE__ */ e(T, { name: l, size: "sm" }) : null
        ] }) : h
      ]
    }
  );
});
function $a({
  actions: n,
  className: t,
  description: i,
  icon: a = "search",
  reason: l = "empty",
  title: s,
  ...c
}) {
  return /* @__PURE__ */ r("div", { className: v("nim-empty", t), "data-reason": l === "empty" ? void 0 : l, ...c, children: [
    /* @__PURE__ */ e("span", { className: "nim-empty__icon", children: /* @__PURE__ */ e(T, { name: a, size: "md" }) }),
    /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: s }),
    i ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-empty__body", children: i }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-empty__actions", children: n }) : null
  ] });
}
const Ea = (n, t) => {
  if (t <= 7) return Array.from({ length: t }, (l, s) => s + 1);
  const i = /* @__PURE__ */ new Set([1, t, n, n - 1, n + 1]);
  n <= 3 && [2, 3, 4].forEach((l) => i.add(l)), n >= t - 2 && [t - 3, t - 2, t - 1].forEach((l) => i.add(l));
  const a = [...i].filter((l) => l >= 1 && l <= t).sort((l, s) => l - s);
  return a.flatMap((l, s) => s > 0 && l - a[s - 1] > 1 ? ["gap", l] : [l]);
};
function Ia({
  className: n,
  label: t = "Pagination",
  nextLabel: i = "Next page",
  onChange: a,
  page: l,
  pageCount: s,
  previousLabel: c = "Previous page",
  summary: o
}) {
  return /* @__PURE__ */ r("nav", { "aria-label": t, className: v("nim-pagination", n), children: [
    o ? /* @__PURE__ */ e("p", { className: "nim-pagination__summary", children: o }) : /* @__PURE__ */ e("span", {}),
    /* @__PURE__ */ r("div", { className: "nim-pagination__list", children: [
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": c,
          className: "nim-pagination__item",
          disabled: l <= 1,
          onClick: () => a(l - 1),
          type: "button",
          children: /* @__PURE__ */ e(T, { name: "chevron-back", size: "sm" })
        }
      ),
      Ea(l, s).map(
        (d, m) => d === "gap" ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-pagination__ellipsis", children: "…" }, `gap-${m}`) : /* @__PURE__ */ e(
          "button",
          {
            "aria-current": d === l ? "page" : void 0,
            className: "nim-pagination__item",
            onClick: () => a(d),
            type: "button",
            children: d
          },
          d
        )
      ),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": i,
          className: "nim-pagination__item",
          disabled: l >= s,
          onClick: () => a(l + 1),
          type: "button",
          children: /* @__PURE__ */ e(T, { name: "chevron-forward", size: "sm" })
        }
      )
    ] })
  ] });
}
function Se({ caption: n, className: t, columns: i, onSort: a, rowKey: l, rows: s, sort: c }) {
  return /* @__PURE__ */ e("div", { className: v("nim-table-wrap", t), children: /* @__PURE__ */ r("table", { className: "nim-table", children: [
    n ? /* @__PURE__ */ e("caption", { className: "nim-caption", children: n }) : null,
    /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ e("tr", { children: i.map((o) => {
      const d = (c == null ? void 0 : c.key) === o.key ? c.direction : void 0;
      return /* @__PURE__ */ e(
        "th",
        {
          "aria-sort": d,
          className: v(o.numeric && "nim-table__cell--numeric"),
          scope: "col",
          style: o.width ? { inlineSize: o.width } : void 0,
          children: o.sortable && a ? /* @__PURE__ */ r("button", { className: "nim-table__sort", onClick: () => a(o.key), type: "button", children: [
            o.header,
            d ? /* @__PURE__ */ e(T, { name: d === "ascending" ? "chevron-up" : "chevron-down", size: "xs" }) : null
          ] }) : o.header
        },
        o.key
      );
    }) }) }),
    /* @__PURE__ */ e("tbody", { children: s.map((o) => /* @__PURE__ */ e("tr", { children: i.map((d) => /* @__PURE__ */ e("td", { className: v(d.numeric && "nim-table__cell--numeric"), children: d.render(o) }, d.key)) }, l(o))) })
  ] }) });
}
function De({ children: n, className: t, description: i, ...a }) {
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--checkbox", t), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", type: "checkbox", ...a }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-checkbox__box", children: /* @__PURE__ */ e(T, { name: "check", size: "xs" }) }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
function Ba({ children: n, className: t, description: i, ...a }) {
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--switch", t), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", role: "switch", type: "checkbox", ...a }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-switch__track", children: /* @__PURE__ */ e("span", { className: "nim-switch__thumb" }) }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
function Cl({ children: n, className: t, description: i, ...a }) {
  const l = xe(He);
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--radio", t), children: [
    /* @__PURE__ */ e(
      "input",
      {
        ...a,
        checked: l ? l.value === a.value : a.checked,
        className: "nim-choice__input",
        name: (l == null ? void 0 : l.name) ?? a.name,
        onChange: (s) => {
          var c;
          l == null || l.onChange(s.target.value), (c = a.onChange) == null || c.call(a, s);
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
const He = Ce(null);
function xl({
  children: n,
  className: t,
  error: i,
  hint: a,
  label: l,
  layout: s = "stack",
  name: c,
  onChange: o,
  value: d
}) {
  const m = J(), u = c ?? `nim-radio-${m}`, h = a ? `${u}-hint` : void 0, f = i ? `${u}-error` : void 0;
  return /* @__PURE__ */ e(He.Provider, { value: { name: u, onChange: o, value: d }, children: /* @__PURE__ */ r(
    "fieldset",
    {
      "aria-describedby": [f, h].filter(Boolean).join(" ") || void 0,
      "aria-invalid": i ? !0 : void 0,
      className: v("nim-radio-group", i && "nim-radio-group--invalid", t),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-radio-group__legend", children: l }),
        /* @__PURE__ */ e("div", { className: v("nim-radio-group__options", `nim-radio-group__options--${s}`), children: n }),
        i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: f, children: i }) : null,
        a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: h, children: a }) : null
      ]
    }
  ) });
}
function Ke({ className: n, label: t = "Loading", size: i = "md", ...a }) {
  return /* @__PURE__ */ e(
    "span",
    {
      className: v("nim-spinner", i !== "md" && `nim-spinner--${i}`, n),
      role: "status",
      ...a,
      children: /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: t })
    }
  );
}
function Pa({ className: n, label: t, value: i, ...a }) {
  const l = i === void 0, s = l ? 0 : Math.min(100, Math.max(0, i));
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": t,
      "aria-valuemax": 100,
      "aria-valuemin": 0,
      "aria-valuenow": l ? void 0 : s,
      className: v("nim-progress", l && "nim-progress--indeterminate", n),
      role: "progressbar",
      ...a,
      children: /* @__PURE__ */ e("div", { className: "nim-progress__fill", style: l ? void 0 : { inlineSize: `${s}%` } })
    }
  );
}
function Fa({ className: n, height: t = "1em", radius: i, width: a = "100%", ...l }) {
  return /* @__PURE__ */ e(
    "span",
    {
      "aria-hidden": "true",
      className: v("nim-skeleton", n),
      style: { blockSize: t, borderRadius: i, inlineSize: a },
      ...l
    }
  );
}
const Ra = (n) => Array.from({ length: n }, (t, i) => ({ __skeleton: i })), Oa = {
  selectAll: "Select all rows",
  selectRow: "Select row"
};
function Ml({
  caption: n,
  className: t,
  columns: i,
  empty: a,
  error: l,
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
  const k = { ...Oa, ...s }, x = g.length > 0 && p ? g.every((C) => p.isSelected(C)) : !1, b = p ? [
    {
      header: p.onToggleAll ? /* @__PURE__ */ e(
        De,
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
          De,
          {
            "aria-label": (($ = p.label) == null ? void 0 : $.call(p, C)) ?? k.selectRow,
            checked: p.isSelected(C),
            onChange: (L) => p.onToggle(C, L.currentTarget.checked)
          }
        );
      },
      width: "2.5rem"
    },
    ...i
  ] : i;
  let S;
  return l ? S = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: /* @__PURE__ */ e(
    $a,
    {
      actions: d ? /* @__PURE__ */ e(X, { onClick: d, size: "sm", variant: "secondary", children: _ }) : void 0,
      icon: "danger",
      title: l
    }
  ) }) : c ? S = /* @__PURE__ */ e(
    Se,
    {
      caption: n,
      columns: b.map((C) => ({
        ...C,
        render: () => /* @__PURE__ */ e(Fa, { height: "0.9em", width: C.numeric ? "3rem" : "70%" }),
        sortable: !1
      })),
      rowKey: (C) => `skeleton-${C.__skeleton}`,
      rows: Ra(w)
    }
  ) : g.length === 0 ? S = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: a }) : S = /* @__PURE__ */ e(
    Se,
    {
      caption: n,
      columns: b,
      onSort: m,
      rowKey: N,
      rows: g,
      sort: y
    }
  ), /* @__PURE__ */ r("div", { className: v("nim-data-table", t), "data-refreshing": f ? "true" : void 0, children: [
    I,
    /* @__PURE__ */ r("div", { className: "nim-data-table__body", children: [
      S,
      f ? /* @__PURE__ */ e("span", { className: "nim-data-table__pulse", children: /* @__PURE__ */ e(T, { name: "loading", size: "xs" }) }) : null
    ] }),
    u && h && h > 1 && o ? /* @__PURE__ */ e(Ia, { onChange: o, page: u, pageCount: h, summary: D }) : D ? /* @__PURE__ */ e("p", { className: "nim-data-table__summary", children: D }) : null
  ] });
}
function Tl({
  className: n,
  defaultOpen: t = [],
  items: i,
  mode: a = "multiple",
  onOpenChange: l,
  open: s,
  variant: c = "panel"
}) {
  const o = J(), [d, m] = E(t), u = s ?? d, h = (f) => {
    const _ = u.includes(f), N = a === "single" ? _ ? [] : [f] : _ ? u.filter((g) => g !== f) : [...u, f];
    s || m(N), l == null || l(N);
  };
  return /* @__PURE__ */ e("div", { className: v("nim-accordion", `nim-accordion--${c}`, n), children: i.map((f) => {
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
function Ua({ className: n, items: t, label: i, renderItem: a, value: l }) {
  return /* @__PURE__ */ e("nav", { "aria-label": i, className: v("nim-tab-bar", n), children: /* @__PURE__ */ e("div", { className: "nim-tab-bar__row", style: { "--nim-tab-count": t.length }, children: t.map((s) => {
    const c = s.key === l, o = /* @__PURE__ */ r(H, { children: [
      /* @__PURE__ */ e(T, { name: s.icon, size: s.center ? "lg" : "md" }),
      /* @__PURE__ */ e("span", { className: "nim-tab-bar__label", children: s.label })
    ] }), d = {
      "aria-current": c ? "page" : void 0,
      "aria-label": s.fullLabel ?? s.label,
      className: v("nim-tab-bar__item", s.center && "nim-tab-bar__item--center"),
      "data-active": c ? "true" : void 0
    };
    return a ? /* @__PURE__ */ e("div", { className: "nim-tab-bar__slot", children: a(s, o, d) }, s.key) : s.href ? /* @__PURE__ */ e("a", { href: s.href, ...d, children: o }, s.key) : /* @__PURE__ */ e("button", { onClick: s.onSelect, type: "button", ...d, children: o }, s.key);
  }) }) });
}
function Sl({ children: n, className: t, frame: i = "responsive", header: a, tabs: l }) {
  return /* @__PURE__ */ r("div", { className: v("nim-app-shell", t), "data-frame": i === "phone" ? "phone" : void 0, children: [
    a ? /* @__PURE__ */ e("header", { className: "nim-app-shell__header", children: a }) : null,
    /* @__PURE__ */ e("main", { className: "nim-app-shell__content", "data-has-tabs": l ? "true" : void 0, children: n }),
    l ? /* @__PURE__ */ e(Ua, { ...l }) : null
  ] });
}
function Ne({
  action: n,
  back: t,
  brand: i,
  children: a,
  className: l,
  footer: s,
  subtitle: c,
  title: o
}) {
  return /* @__PURE__ */ r("section", { className: v("nim-auth", l), children: [
    i ? /* @__PURE__ */ e("div", { className: "nim-auth__brand", children: i }) : null,
    /* @__PURE__ */ r("div", { className: "nim-auth__body", children: [
      t ? /* @__PURE__ */ e(X, { className: "nim-auth__back", iconStart: "chevron-back", onClick: t.onClick, size: "sm", variant: "ghost", children: t.label }) : null,
      /* @__PURE__ */ e("h1", { className: "nim-auth__title", children: o }),
      c ? /* @__PURE__ */ e("p", { className: "nim-auth__subtitle", children: c }) : null,
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
const Ha = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((t) => {
  var i;
  return ((i = t[0]) == null ? void 0 : i.toUpperCase()) ?? "";
}).join("");
function de({ className: n, name: t, shape: i = "round", size: a = "md", src: l, ...s }) {
  return /* @__PURE__ */ r(
    "span",
    {
      className: v("nim-avatar", a !== "md" && `nim-avatar--${a}`, i === "square" && "nim-avatar--square", n),
      ...s,
      children: [
        l ? /* @__PURE__ */ e("img", { alt: "", src: l }) : /* @__PURE__ */ e("span", { "aria-hidden": "true", children: Ha(t) }),
        /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: t })
      ]
    }
  );
}
function Dl({
  caption: n,
  className: t,
  initials: i,
  label: a,
  size: l = 96,
  src: s,
  value: c
}) {
  const o = Math.max(4, Math.round(l * 0.05)), d = (l - o) / 2, m = 2 * Math.PI * d, u = Math.min(100, Math.max(0, c)) / 100 * m;
  return /* @__PURE__ */ r(
    "div",
    {
      "aria-label": a,
      className: v("nim-avatar-ring", t),
      role: "img",
      style: { "--nim-ring-size": `${l}px`, "--nim-ring-stroke": `${o}px` },
      children: [
        /* @__PURE__ */ r("svg", { "aria-hidden": "true", className: "nim-avatar-ring__arc", viewBox: `0 0 ${l} ${l}`, children: [
          /* @__PURE__ */ e(
            "circle",
            {
              className: "nim-avatar-ring__track",
              cx: l / 2,
              cy: l / 2,
              fill: "none",
              r: d,
              strokeWidth: o
            }
          ),
          /* @__PURE__ */ e(
            "circle",
            {
              className: "nim-avatar-ring__fill",
              cx: l / 2,
              cy: l / 2,
              fill: "none",
              r: d,
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
function Ka({
  actions: n,
  avatar: t,
  chips: i,
  className: a,
  eyebrow: l,
  name: s,
  stats: c = []
}) {
  return /* @__PURE__ */ r("section", { className: v("nim-profile-header", a), children: [
    /* @__PURE__ */ r("div", { className: "nim-profile-header__identity", children: [
      t,
      /* @__PURE__ */ r("div", { className: "nim-profile-header__who", children: [
        l ? /* @__PURE__ */ e("p", { className: "nim-profile-header__eyebrow", children: l }) : null,
        /* @__PURE__ */ e("h1", { className: "nim-profile-header__name", children: s }),
        i ? /* @__PURE__ */ e("div", { className: "nim-profile-header__chips", children: i }) : null
      ] })
    ] }),
    c.length ? /* @__PURE__ */ e("dl", { className: "nim-profile-header__stats", children: c.map((o, d) => /* @__PURE__ */ r("div", { className: "nim-profile-header__stat", children: [
      /* @__PURE__ */ e("dt", { className: "nim-profile-header__stat-label", children: o.label }),
      /* @__PURE__ */ e("dd", { className: "nim-profile-header__stat-value", children: o.value })
    ] }, d)) }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-profile-header__actions", children: n }) : null
  ] });
}
function Ga({
  children: n,
  className: t,
  dot: i = !1,
  pill: a = !1,
  size: l = "md",
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
        l === "sm" && "nim-badge--sm",
        a && "nim-badge--pill",
        t
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
  children: t,
  className: i,
  icon: a,
  title: l,
  tone: s = "neutral",
  ...c
}) {
  return /* @__PURE__ */ r(
    "div",
    {
      className: v("nim-banner", `nim-banner--${s}`, i),
      role: s === "danger" ? "alert" : "status",
      ...c,
      children: [
        /* @__PURE__ */ e(T, { className: "nim-banner__icon", name: a ?? Wa[s], size: "sm" }),
        /* @__PURE__ */ r("div", { className: "nim-banner__content", children: [
          l ? /* @__PURE__ */ e("p", { className: "nim-banner__title", children: l }) : null,
          /* @__PURE__ */ e("div", { children: t })
        ] }),
        n ? /* @__PURE__ */ e("div", { className: "nim-banner__action", children: n }) : null
      ]
    }
  );
}
function zl({ className: n, items: t, label: i = "Breadcrumb" }) {
  return /* @__PURE__ */ e("nav", { "aria-label": i, className: v("nim-breadcrumb", n), children: t.map((a, l) => {
    const s = l === t.length - 1;
    return /* @__PURE__ */ r(ke, { children: [
      l > 0 ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-breadcrumb__separator", children: /* @__PURE__ */ e(T, { name: "chevron-forward", size: "xs" }) }) : null,
      s || !a.href ? /* @__PURE__ */ e("span", { "aria-current": s ? "page" : void 0, className: "nim-breadcrumb__current", children: a.label }) : /* @__PURE__ */ e("a", { className: "nim-breadcrumb__link", href: a.href, children: a.label })
    ] }, a.label);
  }) });
}
function Ll({
  as: n = "article",
  children: t,
  className: i,
  footer: a,
  header: l,
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
        i
      ),
      ...d,
      children: [
        l ? /* @__PURE__ */ e("div", { className: "nim-card__header", children: l }) : null,
        t,
        a ? /* @__PURE__ */ e("div", { className: "nim-card__footer", children: a }) : null
      ]
    }
  );
}
function Al({
  badge: n,
  className: t,
  description: i,
  detail: a,
  disabled: l = !1,
  icon: s,
  name: c,
  onSelect: o,
  selected: d,
  title: m
}) {
  return /* @__PURE__ */ r("label", { className: v("nim-option-card", d && "nim-option-card--selected", t), children: [
    /* @__PURE__ */ e(
      "input",
      {
        checked: d,
        className: "nim-option-card__input",
        disabled: l,
        name: c,
        onChange: o,
        type: "radio"
      }
    ),
    s ? /* @__PURE__ */ e("span", { className: "nim-option-card__icon", children: /* @__PURE__ */ e(T, { name: s, size: "md" }) }) : null,
    /* @__PURE__ */ r("span", { className: "nim-option-card__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-option-card__title", children: m }),
      i ? /* @__PURE__ */ e("span", { className: "nim-option-card__description", children: i }) : null,
      d && a ? /* @__PURE__ */ e("span", { className: "nim-option-card__detail", children: a }) : null
    ] }),
    n ? /* @__PURE__ */ e("span", { className: "nim-option-card__badge", children: n }) : null,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-option-card__dot" })
  ] });
}
function $l({ className: n, items: t, title: i, totals: a = [] }) {
  return /* @__PURE__ */ r("section", { className: v("nim-summary", n), children: [
    i ? /* @__PURE__ */ e("h2", { className: "nim-summary__title", children: i }) : null,
    /* @__PURE__ */ e("dl", { className: "nim-summary__lines", children: t.map((l) => /* @__PURE__ */ r("div", { className: "nim-summary__line", children: [
      /* @__PURE__ */ r("dt", { children: [
        /* @__PURE__ */ e("span", { className: "nim-summary__label", children: l.label }),
        l.meta ? /* @__PURE__ */ e("span", { className: "nim-summary__meta", children: l.meta }) : null
      ] }),
      /* @__PURE__ */ e("dd", { className: "nim-summary__value", children: l.value })
    ] }, l.key)) }),
    a.length ? /* @__PURE__ */ r(H, { children: [
      /* @__PURE__ */ e("hr", { className: "nim-summary__rule" }),
      /* @__PURE__ */ e("dl", { className: "nim-summary__lines nim-summary__lines--totals", children: a.map((l) => /* @__PURE__ */ r(
        "div",
        {
          className: "nim-summary__line",
          "data-emphasis": l.emphasis ? "true" : void 0,
          children: [
            /* @__PURE__ */ e("dt", { children: /* @__PURE__ */ e("span", { className: "nim-summary__label", children: l.label }) }),
            /* @__PURE__ */ e("dd", { className: "nim-summary__value", children: l.value })
          ]
        },
        l.key
      )) })
    ] }) : null
  ] });
}
function El({ action: n, className: t, note: i, total: a }) {
  return /* @__PURE__ */ r("div", { className: v("nim-action-bar", t), children: [
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
function Ge(n, t, { onDismiss: i, open: a }) {
  const [l, s] = E({ left: 0, top: 0 }), c = O(null), o = Z(() => {
    const d = n.current, m = t.current;
    if (!d || !m) return;
    const u = d.getBoundingClientRect(), { height: h, width: f } = m.getBoundingClientRect(), _ = 4, N = 8, g = getComputedStyle(d).direction === "rtl", p = u.bottom + _, y = p + h > window.innerHeight && u.top - _ - h > 0 ? u.top - _ - h : p, D = g ? u.right - f : u.left, I = Math.min(Math.max(D, N), window.innerWidth - f - N);
    s({ left: I, top: y });
  }, [t, n]);
  return en(() => {
    a && o();
  }, [a, o]), j(() => {
    if (!a) return;
    c.current = document.activeElement;
    const d = (u) => {
      u.key === "Escape" && (u.stopPropagation(), i());
    }, m = (u) => {
      var f, _;
      const h = u.target;
      (f = t.current) != null && f.contains(h) || (_ = n.current) != null && _.contains(h) || i();
    };
    return window.addEventListener("keydown", d), window.addEventListener("pointerdown", m), window.addEventListener("resize", o), window.addEventListener("scroll", o, !0), () => {
      var u, h;
      window.removeEventListener("keydown", d), window.removeEventListener("pointerdown", m), window.removeEventListener("resize", o), window.removeEventListener("scroll", o, !0), (h = (u = c.current) == null ? void 0 : u.focus) == null || h.call(u);
    };
  }, [i, a, t, o, n]), l;
}
const Ya = (n) => n.kind === void 0 || n.kind === "action";
function ze({ children: n, className: t, items: i, label: a }) {
  const [l, s] = E(!1), [c, o] = E(0), d = O(null), m = O(null), u = Ge(d, m, { onDismiss: () => s(!1), open: l }), f = i.filter(Ya).filter((p) => !p.disabled), _ = () => {
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
  return /* @__PURE__ */ r(H, { children: [
    n({ open: l, ref: d, toggle: _ }),
    l && typeof document < "u" ? he(
      /* @__PURE__ */ e(
        "div",
        {
          "aria-label": a,
          className: v("nim-menu", t),
          onKeyDown: g,
          ref: m,
          role: "menu",
          style: { insetBlockStart: u.top, insetInlineStart: u.left },
          tabIndex: -1,
          children: i.map((p, w) => p.kind === "separator" ? /* @__PURE__ */ e("hr", { className: "nim-menu__separator" }, `sep-${w}`) : p.kind === "heading" ? /* @__PURE__ */ e("p", { className: "nim-menu__label", children: p.label }, `head-${w}`) : /* @__PURE__ */ r(
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
function ja({ children: n, className: t, label: i, onClose: a, open: l, triggerRef: s }) {
  const c = O(null), o = Ge(s, c, { onDismiss: a, open: l });
  return !l || typeof document > "u" ? null : he(
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": i,
        className: v("nim-popover", t),
        ref: c,
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
}, qa = ["👍", "❤️", "😂", "😮", "😢", "🙏"], Le = 1024, Qa = 864e5;
function Xa(n, t) {
  const i = ["B", "KB", "MB", "GB"];
  let a = n, l = 0;
  for (; a >= Le && l < i.length - 1; )
    a /= Le, l += 1;
  return `${new Intl.NumberFormat(t, { maximumFractionDigits: l === 0 ? 0 : 1 }).format(a)} ${i[l]}`;
}
function We(n, t) {
  const i = new Intl.NumberFormat(t, { minimumIntegerDigits: 2, useGrouping: !1 }), a = Math.max(0, Math.round(n));
  return `${new Intl.NumberFormat(t).format(Math.floor(a / 60))}:${i.format(a % 60)}`;
}
const ce = (n) => {
  const t = new Date(n);
  return new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
};
function Ja({
  attachment: n,
  labels: t,
  locale: i
}) {
  const a = O(null), [l, s] = E(!1), [c, o] = E(0), d = n.duration ?? 0, m = Y(
    () => n.waveform ?? Array.from({ length: 32 }, (h, f) => 0.35 + f * 7 % 11 / 18),
    [n.waveform]
  ), u = d > 0 ? Math.min(1, c / d) : 0;
  return /* @__PURE__ */ r("div", { className: "nim-chat-voice", children: [
    /* @__PURE__ */ e(
      U,
      {
        label: l ? t.pause : t.play,
        name: l ? "pause" : "play",
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
        "aria-label": t.voiceMessage,
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
    /* @__PURE__ */ e("span", { className: "nim-chat-voice__time", children: We(l || c ? Math.max(0, d - c) : d, i) }),
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
  labels: t,
  locale: i
}) {
  return n.kind === "voice" ? /* @__PURE__ */ e(Ja, { attachment: n, labels: t, locale: i }) : n.kind === "video" ? /* @__PURE__ */ r("figure", { className: "nim-chat-media", children: [
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
        /* @__PURE__ */ e("span", { className: "nim-chat-file__icon", children: /* @__PURE__ */ e(T, { name: "document", size: "md" }) }),
        /* @__PURE__ */ r("span", { className: "nim-chat-file__text", children: [
          /* @__PURE__ */ e("span", { className: "nim-chat-file__name", children: n.name ?? t.download }),
          n.size !== void 0 ? /* @__PURE__ */ e("span", { className: "nim-chat-file__size", children: Xa(n.size, i) }) : null
        ] }),
        /* @__PURE__ */ e(T, { className: "nim-chat-file__action", name: "download", size: "sm" })
      ]
    }
  );
}
function ni({
  labels: n,
  message: t,
  onReact: i
}) {
  var a;
  return /* @__PURE__ */ e("ul", { className: "nim-chat-reactions", children: (a = t.reactions) == null ? void 0 : a.map((l) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r(
    "button",
    {
      "aria-pressed": l.mine ? "true" : "false",
      className: "nim-chat-reaction",
      disabled: !i,
      onClick: () => i == null ? void 0 : i(t, l.emoji),
      type: "button",
      children: [
        /* @__PURE__ */ e("span", { "aria-hidden": "true", children: l.emoji }),
        /* @__PURE__ */ e("span", { className: "nim-chat-reaction__count", children: l.count }),
        /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: n.react })
      ]
    }
  ) }, l.emoji)) });
}
function Il({
  actions: n,
  className: t,
  composer: i,
  footer: a,
  group: l = !1,
  header: s,
  labels: c,
  locale: o,
  messages: d,
  onJump: m,
  onReact: u,
  reactions: h = qa,
  runGap: f = 300,
  typing: _
}) {
  const N = { ...Va, ...c }, g = O(null), p = O(!0), w = Y(
    () => new Intl.DateTimeFormat(o, { hour: "2-digit", minute: "2-digit" }),
    [o]
  ), y = Y(
    () => new Intl.DateTimeFormat(o, { day: "numeric", month: "long", weekday: "long" }),
    [o]
  ), D = Y(() => {
    const I = ce((/* @__PURE__ */ new Date()).toISOString());
    return d.map((k, x) => {
      const b = d[x - 1], S = d[x + 1], C = k.at ? ce(k.at) : null, $ = b != null && b.at ? ce(b.at) : null, L = C !== null && C !== $ ? C === I ? N.today : C === I - Qa ? N.yesterday : y.format(new Date(k.at)) : null, A = (P, M) => {
        var F, W;
        return !!P && !(P != null && P.system) && !M.system && !!(P != null && P.own) == !!M.own && ((F = P == null ? void 0 : P.author) == null ? void 0 : F.name) === ((W = M.author) == null ? void 0 : W.name);
      }, B = (P, M) => !(P != null && P.at) || !M.at || Math.abs(new Date(M.at).getTime() - new Date(P.at).getTime()) <= f * 1e3, K = L !== null || !A(b, k) || !B(b, k), G = !S || (S.at ? ce(S.at) : null) !== C || !A(S, k) || !B(k, S);
      return { divider: L, first: K, last: G, message: k };
    });
  }, [y, d, f, N.today, N.yesterday]);
  return j(() => {
    const I = g.current;
    !I || !p.current || (I.scrollTop = I.scrollHeight);
  }, [d, _]), /* @__PURE__ */ r("section", { className: v("nim-chat", t), children: [
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
              return /* @__PURE__ */ r(ke, { children: [
                I ? /* @__PURE__ */ e("li", { className: "nim-chat__day", children: I }) : null,
                /* @__PURE__ */ e("li", { className: "nim-chat__system", children: b.text })
              ] }, b.id);
            const S = (n == null ? void 0 : n(b)) ?? [], C = k && !b.own && (l || !!b.author);
            return /* @__PURE__ */ r(ke, { children: [
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
                          ] }) : /* @__PURE__ */ r(H, { children: [
                            ($ = b.attachments) == null ? void 0 : $.map((A, B) => /* @__PURE__ */ e(
                              ei,
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
                            ze,
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
                          S.length > 0 ? /* @__PURE__ */ e(ze, { items: S, label: N.more, children: ({ ref: A, toggle: B }) => /* @__PURE__ */ e(
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
                      (L = b.reactions) != null && L.length ? /* @__PURE__ */ e(ni, { labels: N, message: b, onReact: u }) : null,
                      x ? /* @__PURE__ */ r("span", { className: "nim-chat-message__meta", children: [
                        b.at ? /* @__PURE__ */ e("time", { dateTime: b.at, children: w.format(new Date(b.at)) }) : null,
                        b.edited ? /* @__PURE__ */ e("span", { children: N.edited }) : null,
                        b.own && b.status ? /* @__PURE__ */ e("span", { className: "nim-chat-message__status", "data-status": b.status, children: b.status === "sending" ? /* @__PURE__ */ e(Ke, { size: "sm" }) : /* @__PURE__ */ e(
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
function Bl({
  assistant: n,
  className: t,
  composer: i,
  empty: a,
  labels: l,
  onCopy: s,
  onRate: c,
  onRetry: o,
  onStop: d,
  turns: m
}) {
  const u = { ...ai, ...l }, h = O(null), f = O(!0), [_, N] = E(null), g = m.some((p) => p.streaming);
  return j(() => {
    const p = h.current;
    !p || !f.current || (p.scrollTop = p.scrollHeight);
  }, [m]), /* @__PURE__ */ r("section", { className: v("nim-assistant", t), children: [
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
          m.length === 0 && a ? /* @__PURE__ */ e("div", { className: "nim-assistant__empty", children: a }) : null,
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
                  c ? /* @__PURE__ */ r(H, { children: [
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
    i ? /* @__PURE__ */ e("div", { className: "nim-assistant__composer", children: i }) : null
  ] });
}
const ve = 600, Ae = 8, ii = (n, t) => {
  const i = n / Math.max(1, t), a = 10 ** Math.floor(Math.log10(i || 1)), l = i / a;
  return (l > 5 ? 10 : l > 2 ? 5 : l > 1 ? 2 : 1) * a;
};
function Pl({
  categories: n,
  className: t,
  format: i,
  height: a = 220,
  kind: l = "line",
  legend: s,
  locale: c,
  max: o,
  min: d,
  note: m,
  series: u,
  title: h
}) {
  const f = J(), [_, N] = E(null), g = Y(
    () => i ?? ((b) => new Intl.NumberFormat(c).format(b)),
    [i, c]
  ), p = Y(() => {
    const b = u.flatMap((P) => P.values).filter((P) => P !== null), S = d ?? Math.min(...b, 0), C = o ?? Math.max(...b, 0), $ = l === "bar" ? Math.min(0, S) : S, L = C === $ ? $ + 1 : C, A = ii(L - $, 4), B = Math.floor($ / A) * A, K = Math.ceil(L / A) * A, G = [];
    for (let P = B; P <= K + A / 2; P += A) G.push(Number(P.toFixed(6)));
    return { bottom: B, ticks: G, top: K };
  }, [l, o, d, u]), w = a - Ae * 2, y = (b) => Ae + w - (b - p.bottom) / (p.top - p.bottom) * w, D = ve / Math.max(1, n.length), I = (b) => D * b + D / 2, k = (b, S) => {
    let C = "", $ = !1;
    if (b.forEach((K, G) => {
      if (K === null) {
        $ = !1;
        return;
      }
      C += `${$ ? "L" : "M"}${I(G).toFixed(2)} ${y(K).toFixed(2)}`, $ = !0;
    }), !S || !C) return C;
    const L = b.map((K, G) => K === null ? null : G).filter((K) => K !== null), A = L[0], B = L[L.length - 1];
    return `${C}L${I(B).toFixed(2)} ${y(p.bottom).toFixed(2)}L${I(A).toFixed(2)} ${y(p.bottom).toFixed(2)}Z`;
  }, x = D * 0.62 / u.length;
  return /* @__PURE__ */ r(
    "figure",
    {
      "aria-labelledby": h ? f : void 0,
      className: v("nim-chart", t),
      "data-kind": l,
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
                style: { blockSize: `${a}px` },
                viewBox: `0 0 ${ve} ${a}`,
                children: [
                  p.ticks.map((b) => /* @__PURE__ */ e(
                    "line",
                    {
                      className: "nim-chart__rule",
                      x1: 0,
                      x2: ve,
                      y1: y(b),
                      y2: y(b)
                    },
                    b
                  )),
                  u.map((b, S) => {
                    const C = `var(--nim-series-${b.series ?? S % 6 + 1})`;
                    return l === "bar" ? /* @__PURE__ */ e("g", { children: b.values.map(
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
                      l === "area" ? /* @__PURE__ */ e("path", { className: "nim-chart__area", d: k(b.values, !0), fill: C }) : null,
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
function Fl({ className: n, label: t, series: i = 1, values: a }) {
  const l = Math.min(...a), c = Math.max(...a) - l || 1, o = a.map((d, m) => {
    const u = m / Math.max(1, a.length - 1) * 100, h = 24 - (d - l) / c * 20 - 2;
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
        /* @__PURE__ */ e("title", { children: t }),
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
function ti(n, t) {
  const i = new Date(n), a = /* @__PURE__ */ new Date(), l = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  return i.getTime() >= l ? new Intl.DateTimeFormat(t, { hour: "2-digit", minute: "2-digit" }).format(i) : i.getTime() >= l - 6 * 864e5 ? new Intl.DateTimeFormat(t, { weekday: "short" }).format(i) : new Intl.DateTimeFormat(t, { day: "numeric", month: "short" }).format(i);
}
function si({
  activeId: n,
  className: t,
  labels: i,
  locale: a,
  onSelect: l,
  sections: s
}) {
  const c = { ...Ze, ...i }, o = new Intl.NumberFormat(a);
  return /* @__PURE__ */ e("div", { className: v("nim-rooms", t), children: s.map((d) => /* @__PURE__ */ r("section", { className: "nim-rooms__section", children: [
    /* @__PURE__ */ e("p", { className: "nim-rooms__label", children: d.label }),
    /* @__PURE__ */ e("ul", { className: "nim-rooms__list", children: d.items.map((m) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r(
      "button",
      {
        "aria-current": m.id === n ? "true" : void 0,
        className: "nim-room",
        "data-unread": m.unread ? "true" : void 0,
        onClick: () => l == null ? void 0 : l(m),
        type: "button",
        children: [
          /* @__PURE__ */ e("span", { className: "nim-room__face", children: m.kind === "channel" ? /* @__PURE__ */ e("span", { className: "nim-room__glyph", children: /* @__PURE__ */ e(T, { name: "hash", size: "sm" }) }) : /* @__PURE__ */ e(de, { name: m.name, size: "sm", src: m.avatar }) }),
          /* @__PURE__ */ r("span", { className: "nim-room__body", children: [
            /* @__PURE__ */ r("span", { className: "nim-room__top", children: [
              /* @__PURE__ */ r("span", { className: "nim-room__name", children: [
                m.name,
                m.muted ? /* @__PURE__ */ e(T, { className: "nim-room__mute", label: c.muted, name: "volume-off", size: "xs" }) : null
              ] }),
              m.at ? /* @__PURE__ */ e("span", { className: "nim-room__at", children: ti(m.at, a) }) : null
            ] }),
            /* @__PURE__ */ r("span", { className: "nim-room__bottom", children: [
              /* @__PURE__ */ e("span", { className: "nim-room__preview", "data-typing": m.typing ? "true" : void 0, children: m.typing ?? m.preview }),
              m.unread ? /* @__PURE__ */ r(Ga, { size: "sm", tone: "solid", variant: m.muted ? "neutral" : "accent", children: [
                o.format(m.unread),
                /* @__PURE__ */ r("span", { className: "nim-visually-hidden", children: [
                  " ",
                  c.unread
                ] })
              ] }) : m.members ? /* @__PURE__ */ r("span", { className: "nim-room__members", children: [
                /* @__PURE__ */ e(T, { name: li[m.kind], size: "xs" }),
                o.format(m.members)
              ] }) : null
            ] })
          ] })
        ]
      }
    ) }, m.id)) })
  ] }, d.key)) });
}
function Rl({
  activeId: n,
  brand: t,
  children: i,
  className: a,
  labels: l,
  locale: s,
  onBack: c,
  onCompose: o,
  onSelect: d,
  search: m,
  sections: u
}) {
  const h = { ...Ze, ...l };
  return /* @__PURE__ */ r("div", { className: v("nim-messenger", a), "data-open": n ? "true" : void 0, children: [
    /* @__PURE__ */ r("aside", { "aria-label": h.channels, className: "nim-messenger__rail", children: [
      /* @__PURE__ */ r("div", { className: "nim-messenger__rail-head", children: [
        t,
        o ? /* @__PURE__ */ e(U, { label: h.compose, name: "plus", onClick: o, size: "sm", variant: "outline" }) : null
      ] }),
      m ? /* @__PURE__ */ e("div", { className: "nim-messenger__search", children: m }) : null,
      /* @__PURE__ */ e("div", { className: "nim-messenger__rail-scroll", children: /* @__PURE__ */ e(
        si,
        {
          activeId: n,
          labels: l,
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
      i
    ] })
  ] });
}
function Ol({ actions: n, avatar: t, className: i, kind: a = "direct", members: l, meta: s, name: c }) {
  return /* @__PURE__ */ r("div", { className: v("nim-room-head", i), children: [
    a === "channel" ? /* @__PURE__ */ e("span", { className: "nim-room__glyph", children: /* @__PURE__ */ e(T, { name: "hash", size: "sm" }) }) : /* @__PURE__ */ e(de, { name: c, size: "md", src: t }),
    /* @__PURE__ */ r("div", { className: "nim-room-head__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-room-head__name", children: c }),
      s ? /* @__PURE__ */ e("span", { className: "nim-room-head__meta", children: s }) : null
    ] }),
    l != null && l.length ? /* @__PURE__ */ e("ul", { className: "nim-facepile", children: l.slice(0, 6).map((o) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ e(de, { name: o.name, size: "sm", src: o.avatar }) }, o.name)) }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-room-head__actions", children: n }) : null
  ] });
}
const ri = {
  map: "Map",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out"
}, be = (n) => {
  const i = Math.max(-85.05112878, Math.min(85.05112878, n)) * Math.PI / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + i / 2)) / (2 * Math.PI);
}, ci = (n, t) => {
  const i = t.west, a = t.east < t.west ? t.east + 360 : t.east, l = n.lng < i ? n.lng + 360 : n.lng, s = be(t.north), c = be(t.south);
  return {
    x: (l - i) / (a - i) * 100,
    y: (be(n.lat) - s) / (c - s) * 100
  };
};
function Ul({
  attribution: n,
  bounds: t,
  className: i,
  controls: a,
  labels: l,
  markers: s = [],
  onSelect: c,
  onZoom: o,
  ratio: d = 16 / 10,
  tiles: m,
  title: u
}) {
  const h = { ...ri, ...l }, f = J();
  return /* @__PURE__ */ r(
    "section",
    {
      "aria-labelledby": f,
      className: v("nim-map", i),
      style: { aspectRatio: `${d}` },
      children: [
        /* @__PURE__ */ e("h3", { className: "nim-visually-hidden", id: f, children: u }),
        /* @__PURE__ */ e("div", { className: "nim-map__tiles", children: m }),
        /* @__PURE__ */ e("ul", { className: "nim-map__markers", children: s.map((_) => {
          const N = ci(_, t), g = { insetBlockStart: `${N.y}%`, insetInlineStart: `${N.x}%` };
          return /* @__PURE__ */ e("li", { className: "nim-map__marker", "data-self": _.self ? "true" : void 0, style: g, children: c ? /* @__PURE__ */ r("button", { className: "nim-map__pin", "data-tone": _.tone, onClick: () => c(_), type: "button", children: [
            _.self ? /* @__PURE__ */ e("span", { className: "nim-map__dot" }) : /* @__PURE__ */ e(T, { name: "globe", size: "sm" }),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: _.label })
          ] }) : /* @__PURE__ */ r("span", { className: "nim-map__pin", "data-tone": _.tone, children: [
            _.self ? /* @__PURE__ */ e("span", { className: "nim-map__dot" }) : /* @__PURE__ */ e(T, { name: "globe", size: "sm" }),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: _.label })
          ] }) }, _.id);
        }) }),
        o || a ? /* @__PURE__ */ r("div", { className: "nim-map__controls", children: [
          a,
          o ? /* @__PURE__ */ r(H, { children: [
            /* @__PURE__ */ e(U, { label: h.zoomIn, name: "plus", onClick: () => o(1), size: "sm", variant: "solid" }),
            /* @__PURE__ */ e(U, { label: h.zoomOut, name: "minus", onClick: () => o(-1), size: "sm", variant: "solid" })
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
function oe(n, t) {
  const i = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0, a = new Intl.NumberFormat(t, { minimumIntegerDigits: 2, useGrouping: !1 }), l = new Intl.NumberFormat(t), s = Math.floor(i / 3600), c = Math.floor(i % 3600 / 60), o = i % 60;
  return s > 0 ? `${l.format(s)}:${a.format(c)}:${a.format(o)}` : `${l.format(c)}:${a.format(o)}`;
}
function Hl({
  autoPlay: n = !1,
  className: t,
  kind: i = "audio",
  labels: a,
  locale: l,
  onError: s,
  poster: c,
  rates: o = [1, 1.5, 2],
  src: d,
  title: m,
  waveform: u
}) {
  const h = { ...oi, ...a }, f = O(null), _ = O(null), [N, g] = E(!1), [p, w] = E(0), [y, D] = E(0), [I, k] = E(0), [x, b] = E(n), [S, C] = E(1), [$, L] = E(1), A = y > 0 ? p / y : 0, B = Y(() => u ?? null, [u]), K = Z(() => {
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
      className: v("nim-player", t),
      "data-kind": i,
      "data-playing": N ? "true" : void 0,
      ref: _,
      children: [
        i === "video" ? /* @__PURE__ */ r("div", { className: "nim-player__stage", children: [
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
              onClick: K,
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
              onClick: K,
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
              )) }) : /* @__PURE__ */ r(H, { children: [
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__buffer", style: { inlineSize: `${y ? I / y * 100 : 0}%` } }),
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__played", style: { inlineSize: `${A * 100}%` } })
              ] }),
              /* @__PURE__ */ e(
                "input",
                {
                  "aria-label": h.seek,
                  "aria-valuetext": `${oe(p, l)} / ${oe(y, l)}`,
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
              /* @__PURE__ */ e("time", { children: oe(p, l) }),
              /* @__PURE__ */ e("time", { children: oe(y, l) })
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
                  new Intl.NumberFormat(l).format($),
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
            i === "video" ? /* @__PURE__ */ e(
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
function Kl({
  accept: n,
  allow: t,
  className: i,
  disabled: a = !1,
  labels: l,
  onCancelReply: s,
  onFiles: c,
  onSend: o,
  onTyping: d,
  placeholder: m,
  replyTo: u
}) {
  const h = { ...di, ...l }, f = { file: !0, video: !0, voice: !0, ...t }, [_, N] = E(""), [g, p] = E([]), [w, y] = E(!1), [D, I] = E(0), [k] = E(mi), x = O([]), b = O(null), S = O(null), C = O(null), $ = O(0), L = O([]), A = O(null), B = Z(() => {
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
  const K = Z(
    (z) => {
      if (!(z != null && z.length)) return;
      const R = Array.from(z);
      x.current = [...x.current, ...R], p((q) => [
        ...q,
        ...R.map((Q) => ({
          kind: ui(Q),
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
  return /* @__PURE__ */ r("div", { className: v("nim-composer", i), children: [
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
    ] }) : /* @__PURE__ */ r(H, { children: [
      f.file ? /* @__PURE__ */ e(
        U,
        {
          disabled: a,
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
          disabled: a,
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
          disabled: a,
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
          disabled: a,
          label: h.record,
          name: "mic",
          onClick: () => void G(),
          size: "sm"
        }
      ) : /* @__PURE__ */ e(
        U,
        {
          disabled: a || W,
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
          K(z.target.files), z.target.value = "";
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
          K(z.target.files), z.target.value = "";
        },
        ref: S,
        tabIndex: -1,
        type: "file"
      }
    )
  ] });
}
function hi({
  children: n,
  className: t,
  disabled: i = !1,
  icon: a,
  onClick: l,
  onRemove: s,
  removeLabel: c = "Remove",
  selected: o = !1,
  tone: d = "neutral"
}) {
  const m = !!l;
  return /* @__PURE__ */ r(
    "span",
    {
      className: v("nim-chip", m && "nim-chip--interactive", t),
      "data-selected": o || void 0,
      "data-tone": d === "neutral" ? void 0 : d,
      children: [
        m ? /* @__PURE__ */ r(
          "button",
          {
            "aria-pressed": o,
            className: "nim-chip__body",
            disabled: i,
            onClick: l,
            type: "button",
            children: [
              a ? /* @__PURE__ */ e(T, { name: a, size: "xs" }) : null,
              n
            ]
          }
        ) : /* @__PURE__ */ r("span", { className: "nim-chip__body", children: [
          a ? /* @__PURE__ */ e(T, { name: a, size: "xs" }) : null,
          n
        ] }),
        s ? /* @__PURE__ */ e(
          "button",
          {
            "aria-label": c,
            className: "nim-chip__remove",
            disabled: i,
            onClick: s,
            type: "button",
            children: /* @__PURE__ */ e(T, { name: "close", size: "xs" })
          }
        ) : null
      ]
    }
  );
}
function Gl({
  className: n,
  disabled: t = !1,
  error: i,
  hint: a,
  label: l,
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
  return /* @__PURE__ */ r("div", { className: v("nim-field", i && "nim-field--invalid", n), children: [
    l ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: l }) : null,
    /* @__PURE__ */ r("div", { className: "nim-chip-input", "data-disabled": t || void 0, children: [
      u.map((g) => /* @__PURE__ */ e(
        hi,
        {
          disabled: t,
          onRemove: () => s(u.filter((p) => p !== g)),
          removeLabel: `${o} ${g}`,
          children: g
        },
        g
      )),
      /* @__PURE__ */ e(
        "input",
        {
          "aria-invalid": i ? !0 : void 0,
          "aria-label": l,
          className: "nim-chip-input__field",
          disabled: t,
          onBlur: _,
          onChange: (g) => f(g.target.value),
          onKeyDown: N,
          placeholder: u.length === 0 ? c : void 0,
          value: h
        }
      )
    ] }),
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", children: a }) : null
  ] });
}
function Wl({ className: n, layout: t = "rows", rows: i }) {
  return /* @__PURE__ */ e("dl", { className: v("nim-data-list", `nim-data-list--${t}`, n), children: i.map((a) => /* @__PURE__ */ r("div", { className: "nim-data-list__row", children: [
    /* @__PURE__ */ e("dt", { className: "nim-data-list__label", children: a.label }),
    /* @__PURE__ */ e("dd", { className: v("nim-data-list__value", a.mono && "nim-data-list__value--mono"), children: a.value ?? /* @__PURE__ */ e("span", { className: "nim-data-list__empty", children: "—" }) })
  ] }, a.id)) });
}
function Zl({
  className: n,
  commands: t,
  emptyLabel: i = (o) => `Nothing matches “${o}”.`,
  label: a,
  onClose: l,
  open: s,
  placeholder: c = "Search…"
}) {
  const o = O(null), d = O(null), m = O(null), [u, h] = E(""), [f, _] = E(0), N = Y(() => _i(t, u), [t, u]), g = N.filter((k) => !k.disabled), p = g[Math.min(f, Math.max(g.length - 1, 0))];
  j(() => {
    var x;
    const k = o.current;
    k && (s && !k.open && (k.showModal(), (x = m.current) == null || x.focus()), !s && k.open && k.close());
  }, [s]), j(() => {
    const k = o.current;
    if (!k) return;
    const x = () => {
      h(""), _(0), l();
    };
    return k.addEventListener("close", x), () => k.removeEventListener("close", x);
  }, [l]), j(() => {
    var k, x;
    (x = (k = d.current) == null ? void 0 : k.querySelector('[data-active="true"]')) == null || x.scrollIntoView({ block: "nearest" });
  }, [f, u]);
  const w = (k) => {
    !k || k.disabled || (l(), k.onRun());
  }, y = (k) => {
    g.length && (k.key === "ArrowDown" ? (k.preventDefault(), _((x) => (x + 1) % g.length)) : k.key === "ArrowUp" ? (k.preventDefault(), _((x) => (x - 1 + g.length) % g.length)) : k.key === "Home" ? (k.preventDefault(), _(0)) : k.key === "End" ? (k.preventDefault(), _(g.length - 1)) : k.key === "Enter" && (k.preventDefault(), w(p)));
  }, D = !u.trim();
  let I;
  return /* @__PURE__ */ r(
    "dialog",
    {
      "aria-label": a,
      className: v("nim-palette", n),
      onClick: (k) => {
        k.target === o.current && l();
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
              "aria-label": a,
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
        }) : /* @__PURE__ */ e("p", { className: "nim-palette__empty", children: i(u) }) })
      ]
    }
  );
}
function _i(n, t) {
  const i = t.trim().toLowerCase();
  if (!i) return n;
  const a = [];
  for (const l of n) {
    const s = l.label.toLowerCase(), c = `${l.group ?? ""} ${l.keywords ?? ""}`.toLowerCase(), o = s.startsWith(i) ? 0 : s.includes(` ${i}`) ? 1 : s.includes(i) ? 2 : c.includes(i) ? 3 : -1;
    o >= 0 && a.push({ command: l, rank: o });
  }
  return a.sort((l, s) => l.rank - s.rank).map((l) => l.command);
}
function ee({ children: n, className: t, error: i, hint: a, id: l, label: s, required: c }) {
  const o = J(), d = l ?? `nim-${o}`, m = a ? `${d}-hint` : void 0, u = i ? `${d}-error` : void 0, h = [u, m].filter(Boolean).join(" ") || void 0;
  return /* @__PURE__ */ r("div", { className: v("nim-field", i && "nim-field--invalid", t), children: [
    s ? /* @__PURE__ */ r("label", { className: "nim-field__label", htmlFor: d, children: [
      s,
      c ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    n({ control: d, describedBy: h }),
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: u, children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: m, children: a }) : null
  ] });
}
function Yl({ children: n, ...t }) {
  return /* @__PURE__ */ e(ee, { ...t, children: () => n });
}
function pi({ className: n, error: t, hint: i, iconEnd: a, iconStart: l, id: s, label: c, required: o, ...d }) {
  return /* @__PURE__ */ e(ee, { error: t, hint: i, id: s, label: c, required: o, children: ({ control: m, describedBy: u }) => /* @__PURE__ */ r(
    "div",
    {
      className: v(
        "nim-input-shell",
        l && "nim-input-shell--has-start",
        a && "nim-input-shell--has-end"
      ),
      children: [
        l ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--start", children: /* @__PURE__ */ e(T, { name: l, size: "sm" }) }) : null,
        /* @__PURE__ */ e(
          "input",
          {
            "aria-describedby": u,
            "aria-invalid": t ? !0 : void 0,
            className: v("nim-input", n),
            id: m,
            required: o,
            ...d
          }
        ),
        a ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(T, { name: a, size: "sm" }) }) : null
      ]
    }
  ) });
}
function jl({ className: n, error: t, hint: i, id: a, label: l, required: s, rows: c = 4, ...o }) {
  return /* @__PURE__ */ e(ee, { error: t, hint: i, id: a, label: l, required: s, children: ({ control: d, describedBy: m }) => /* @__PURE__ */ e(
    "textarea",
    {
      "aria-describedby": m,
      "aria-invalid": t ? !0 : void 0,
      className: v("nim-textarea", n),
      id: d,
      required: s,
      rows: c,
      ...o
    }
  ) });
}
function Vl({
  className: n,
  error: t,
  hint: i,
  id: a,
  label: l,
  options: s,
  placeholder: c,
  required: o,
  ...d
}) {
  return /* @__PURE__ */ e(ee, { error: t, hint: i, id: a, label: l, required: o, children: ({ control: m, describedBy: u }) => /* @__PURE__ */ r("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
    /* @__PURE__ */ r(
      "select",
      {
        "aria-describedby": u,
        "aria-invalid": t ? !0 : void 0,
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
function ql({
  ariaLabel: n,
  className: t,
  emptyState: i,
  error: a,
  hint: l,
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
  return /* @__PURE__ */ e(ee, { className: t, error: a, hint: l, id: s, label: c, required: u, children: ({ control: C, describedBy: $ }) => /* @__PURE__ */ r("div", { className: "nim-combobox", children: [
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
    p ? /* @__PURE__ */ e("div", { className: "nim-combobox__list", id: f, role: "listbox", children: S.length === 0 ? /* @__PURE__ */ e("div", { className: "nim-combobox__empty", children: i ? i(N) : `Nothing matches “${N}”.` }) : k.map((L) => /* @__PURE__ */ r(
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
const Ye = Ce(null);
function Ql({
  children: n,
  className: t,
  defaultColorway: i = "vermilion",
  defaultScheme: a = "light",
  defaultStyle: l = "ledger",
  direction: s = "ltr",
  locale: c,
  syncDocument: o = !0
}) {
  const [d, m] = E(l), [u, h] = E(i), [f, _] = E(a);
  j(() => {
    if (!o || typeof document > "u") return;
    const g = document.documentElement;
    g.dataset.nimStyle = d, g.dataset.nimColorway = u, f === "system" ? delete g.dataset.nimScheme : g.dataset.nimScheme = f, g.dir = s, c && (g.lang = c);
  }, [u, s, c, f, d, o]);
  const N = Y(
    () => ({ colorway: u, direction: s, locale: c, scheme: f, setColorway: h, setScheme: _, setStyle: m, style: d }),
    [u, s, c, f, d]
  );
  return /* @__PURE__ */ e(Ye.Provider, { value: N, children: /* @__PURE__ */ e(
    "div",
    {
      className: v("nim-root", t),
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
  const n = xe(Ye);
  if (!n) throw new Error("useNim must be used inside <NimProvider>");
  return n;
}
function Xl() {
  const { scheme: n, setScheme: t } = _e();
  return Z(() => t(n === "dark" ? "light" : "dark"), [n, t]);
}
const me = 864e5, fi = Date.UTC(622, 2, 22), Ni = 365.2422, ie = (n) => n.toISOString().slice(0, 10), le = (n) => /* @__PURE__ */ new Date(`${n}T00:00:00Z`), pe = () => ie(/* @__PURE__ */ new Date()), vi = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
  year: "numeric"
});
function ne(n, t) {
  const i = le(n);
  if (t === "gregory")
    return { day: i.getUTCDate(), month: i.getUTCMonth() + 1, year: i.getUTCFullYear() };
  const a = vi.formatToParts(i), l = (s) => {
    var c;
    return Number(((c = a.find((o) => o.type === s)) == null ? void 0 : c.value) ?? "0");
  };
  return { day: l("day"), month: l("month"), year: l("year") };
}
const $e = (n) => n.year * 1e4 + n.month * 100 + n.day;
function te(n, t) {
  if (t === "gregory")
    return ie(new Date(Date.UTC(n.year, n.month - 1, n.day)));
  const i = Math.floor((n.year - 1) * Ni) + (n.month <= 7 ? (n.month - 1) * 31 : 186 + (n.month - 7) * 30) + n.day - 1;
  let a = new Date(fi + i * me);
  const l = $e(n);
  for (let s = 0; s < 40; s += 1) {
    const c = ne(ie(a), "persian"), o = $e(c);
    if (o === l) break;
    const d = (n.year - c.year) * 365 + (n.month - c.month) * 30 + (n.day - c.day);
    a = new Date(a.getTime() + (d === 0 ? o < l ? 1 : -1 : d) * me);
  }
  return ie(a);
}
function bi(n, t) {
  const i = ne(n, t);
  return te({ ...i, day: 1 }, t);
}
function Ee(n, t, i) {
  const a = ne(n, i), l = a.year * 12 + (a.month - 1) + t, s = Math.floor(l / 12), c = l % 12 + 1, o = je(s, c, i);
  return te({ day: Math.min(a.day, o), month: c, year: s }, i);
}
function je(n, t, i) {
  const a = le(te({ day: 1, month: t, year: n }, i)).getTime(), l = t === 12 ? 1 : t + 1, s = t === 12 ? n + 1 : n, c = le(te({ day: 1, month: l, year: s }, i)).getTime();
  return Math.round((c - a) / me);
}
const ge = (n, t) => ie(new Date(le(n).getTime() + t * me)), gi = (n) => le(n).getUTCDay();
function yi(n, t) {
  const i = n ?? "en";
  return i.includes("-u-ca-") || i.includes("-u-") ? i : `${i}-u-ca-${t}`;
}
const Me = (n) => n != null && n.startsWith("fa") ? "persian" : "gregory", ki = (n) => n === "persian" ? 6 : 1, Ie = /* @__PURE__ */ new Map();
function wi(n) {
  const t = n ?? "en", i = Ie.get(t);
  if (i) return i;
  const a = new Intl.NumberFormat(t, { useGrouping: !1 }), l = Array.from({ length: 10 }, (s, c) => a.format(c));
  return Ie.set(t, l), l;
}
function we(n, t, i) {
  const a = ne(n, i), l = wi(t), s = (c, o = 1) => String(c).padStart(o, "0").replace(/\d/g, (d) => l[Number(d)]);
  return `${s(a.year)}/${s(a.month, 2)}/${s(a.day, 2)}`;
}
function Ci(n, t) {
  const a = xi(n).match(/\d+/g);
  if (!a || a.length < 3) return null;
  const [l, s, c] = a.map(Number);
  if (s < 1 || s > 12 || c < 1 || c > je(l, s, t)) return null;
  const o = te({ day: c, month: s, year: l }, t), d = ne(o, t);
  return d.year === l && d.month === s && d.day === c ? o : null;
}
function xi(n) {
  let t = "";
  for (const i of n) {
    const a = i.codePointAt(0) ?? 0;
    a >= 1776 && a <= 1785 ? t += String.fromCodePoint(a - 1776 + 48) : a >= 1632 && a <= 1641 ? t += String.fromCodePoint(a - 1632 + 48) : t += i;
  }
  return t;
}
const Be = {
  next: "Next month",
  previous: "Previous month"
};
function Ve({
  className: n,
  marked: t = [],
  max: i,
  min: a,
  month: l,
  onMonthChange: s,
  onSelect: c,
  system: o,
  value: d,
  weekStart: m
}) {
  const { locale: u } = _e(), h = o ?? Me(u), f = m ?? ki(h), _ = pe(), N = yi(u, h), g = Y(
    () => new Intl.DateTimeFormat(N, { month: "long", timeZone: "UTC", year: "numeric" }),
    [N]
  ), p = Y(() => new Intl.NumberFormat(u), [u]), w = Y(
    () => new Intl.DateTimeFormat(N, { timeZone: "UTC", weekday: "short" }),
    [N]
  ), y = bi(l, h), D = ne(y, h).month, I = Y(() => {
    const x = (gi(y) - f + 7) % 7, b = ge(y, -x);
    return Array.from({ length: 42 }, (S, C) => {
      const $ = ge(b, C), L = ne($, h);
      return { date: $, day: L.day, outside: L.month !== D };
    });
  }, [y, D, h, f]), k = Y(() => {
    const x = "2024-01-07";
    return Array.from({ length: 7 }, (b, S) => ({
      key: `${f}-${S}`,
      label: w.format(/* @__PURE__ */ new Date(`${ge(x, (f + S) % 7)}T00:00:00Z`))
    }));
  }, [f, w]);
  return /* @__PURE__ */ r("div", { className: v("nim-calendar", n), children: [
    /* @__PURE__ */ r("div", { className: "nim-calendar__header", children: [
      /* @__PURE__ */ e(
        U,
        {
          label: Be.previous,
          name: "chevron-back",
          onClick: () => s(Ee(y, -1, h)),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-calendar__month", children: g.format(/* @__PURE__ */ new Date(`${y}T00:00:00Z`)) }),
      /* @__PURE__ */ e(
        U,
        {
          label: Be.next,
          name: "chevron-forward",
          onClick: () => s(Ee(y, 1, h)),
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
            t.includes(x.date) && "nim-calendar__day--marked"
          ),
          disabled: a !== void 0 && x.date < a || i !== void 0 && x.date > i,
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
function qe({
  calendar: n,
  describedBy: t,
  id: i,
  invalid: a,
  locale: l,
  onChange: s,
  value: c
}) {
  const [o, d] = E(null);
  if (n === "gregory")
    return /* @__PURE__ */ e(
      "input",
      {
        "aria-describedby": t,
        "aria-invalid": a ? !0 : void 0,
        className: "nim-input",
        id: i,
        onChange: (u) => s(u.target.value),
        type: "date",
        value: c
      }
    );
  const m = o ?? (c ? we(c, l, n) : "");
  return /* @__PURE__ */ e(
    "input",
    {
      "aria-describedby": t,
      "aria-invalid": a ? !0 : void 0,
      className: "nim-input",
      dir: "ltr",
      id: i,
      inputMode: "numeric",
      onBlur: () => d(null),
      onChange: (u) => {
        d(u.target.value);
        const h = Ci(u.target.value, n);
        h ? s(h) : u.target.value.trim() === "" && s("");
      },
      placeholder: we(pe(), l, n),
      type: "text",
      value: m
    }
  );
}
function Jl({
  error: n,
  hint: t,
  id: i,
  label: a,
  onChange: l,
  required: s,
  value: c,
  ...o
}) {
  const { locale: d } = _e(), m = o.system ?? Me(d), [u, h] = E(c || pe());
  return /* @__PURE__ */ e(ee, { error: n, hint: t, id: i, label: a, required: s, children: ({ control: f, describedBy: _ }) => /* @__PURE__ */ r("div", { className: "nim-stack nim-stack--tight", children: [
    /* @__PURE__ */ e(
      qe,
      {
        calendar: m,
        describedBy: _,
        id: f,
        invalid: !!n,
        locale: d,
        onChange: (N) => {
          l(N), N && h(N);
        },
        value: c
      }
    ),
    /* @__PURE__ */ e(
      Ve,
      {
        ...o,
        month: u,
        onMonthChange: h,
        onSelect: (N) => {
          l(N), h(N);
        },
        system: m,
        value: c
      }
    )
  ] }) });
}
function et({
  error: n,
  hint: t,
  id: i,
  label: a,
  labels: l,
  onChange: s,
  required: c,
  showEquivalent: o,
  value: d,
  ...m
}) {
  const { locale: u } = _e(), h = m.system ?? Me(u), [f, _] = E(!1), [N, g] = E(d || pe()), p = O(null), w = { clear: "Clear date", open: "Open calendar", ...l }, y = o ?? h === "persian", D = h === "persian" ? "gregory" : "persian";
  return /* @__PURE__ */ e(ee, { error: n, hint: t, id: i, label: a, required: c, children: ({ control: I, describedBy: k }) => /* @__PURE__ */ r("div", { className: "nim-date-picker", children: [
    /* @__PURE__ */ r("div", { className: "nim-date-picker__group", children: [
      /* @__PURE__ */ e(
        qe,
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
      /* @__PURE__ */ e("span", { dir: D === "gregory" ? "ltr" : void 0, children: we(d, u, D) })
    ] }) : null,
    /* @__PURE__ */ e(
      ja,
      {
        label: a ?? w.open,
        onClose: () => _(!1),
        open: f,
        triggerRef: p,
        children: /* @__PURE__ */ e(
          Ve,
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
function nt({
  children: n,
  className: t,
  closeLabel: i = "Close",
  description: a,
  dismissible: l = !0,
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
    if (!u || l) return;
    const h = (f) => f.preventDefault();
    return u.addEventListener("cancel", h), () => u.removeEventListener("cancel", h);
  }, [l]), j(() => {
    const u = m.current;
    if (!u) return;
    const h = () => c();
    return u.addEventListener("close", h), () => u.removeEventListener("close", h);
  }, [c]), /* @__PURE__ */ r(
    "dialog",
    {
      className: v("nim-dialog", t),
      onClick: (u) => {
        l && u.target === m.current && c();
      },
      ref: m,
      children: [
        /* @__PURE__ */ r("div", { className: "nim-dialog__header", children: [
          /* @__PURE__ */ r("div", { children: [
            /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: d }),
            a ? /* @__PURE__ */ e("p", { className: "nim-caption", children: a }) : null
          ] }),
          l ? /* @__PURE__ */ e(U, { label: i, name: "close", onClick: c, size: "sm" }) : null
        ] }),
        /* @__PURE__ */ e("div", { className: "nim-dialog__body", children: n }),
        s ? /* @__PURE__ */ e("div", { className: "nim-dialog__footer", children: s }) : null
      ]
    }
  );
}
function at({ caveat: n, className: t, links: i, resolution: a, ...l }) {
  return /* @__PURE__ */ r("div", { className: v("nim-causal", t), children: [
    /* @__PURE__ */ e("ol", { className: "nim-causal__list", ...l, children: i.map((s, c) => /* @__PURE__ */ r(
      "li",
      {
        className: "nim-causal__link",
        "data-lead": c === 0 ? "true" : void 0,
        "data-tone": s.tone ?? "neutral",
        "data-unevidenced": s.evidence ? void 0 : "true",
        children: [
          /* @__PURE__ */ r("div", { "aria-hidden": "true", className: "nim-causal__rail", children: [
            /* @__PURE__ */ e("span", { className: "nim-causal__node" }),
            c < i.length - 1 ? /* @__PURE__ */ e("span", { className: "nim-causal__thread" }) : null
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
    a ? /* @__PURE__ */ e("div", { className: "nim-causal__resolution", children: a }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-causal__caveat", children: n }) : null
  ] });
}
function it({ children: n, className: t, title: i, ...a }) {
  return /* @__PURE__ */ r("div", { className: v("nim-caveat", t), ...a, children: [
    /* @__PURE__ */ r("svg", { "aria-hidden": "true", className: "nim-caveat__glyph", viewBox: "0 0 24 24", children: [
      /* @__PURE__ */ e("circle", { cx: "12", cy: "12", r: "9" }),
      /* @__PURE__ */ e("path", { d: "M12 8v5" }),
      /* @__PURE__ */ e("path", { d: "M12 16.5v.5" })
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-caveat__body", children: [
      i ? /* @__PURE__ */ e("p", { className: "nim-caveat__title", children: i }) : null,
      /* @__PURE__ */ e("div", { className: "nim-caveat__detail", children: n })
    ] })
  ] });
}
function lt({ caption: n, className: t, lines: i, summary: a, ...l }) {
  const s = i.filter((m) => m.kind === "added").length, c = i.filter((m) => m.kind === "removed").length, o = a ?? `${s} line${s === 1 ? "" : "s"} added, ${c} removed`, d = { added: "added", context: "", removed: "removed" };
  return /* @__PURE__ */ r("figure", { className: v("nim-diff", t), ...l, children: [
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
      i.map((m, u) => /* @__PURE__ */ r("span", { className: "nim-diff__line", "data-kind": m.kind, children: [
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
function tt({ className: n, commands: t, costlyIndex: i, note: a, ...l }) {
  return /* @__PURE__ */ r("div", { className: v("nim-commands", n), ...l, children: [
    /* @__PURE__ */ e("ol", { className: "nim-commands__list", children: t.map((s, c) => /* @__PURE__ */ e(
      "li",
      {
        className: "nim-commands__item",
        "data-costly": c === i ? "true" : void 0,
        children: s
      },
      s
    )) }),
    a ? /* @__PURE__ */ e("p", { className: "nim-commands__note", children: a }) : null
  ] });
}
function st({ children: n, className: t, note: i, ...a }) {
  return /* @__PURE__ */ r("div", { className: v("nim-decide", t), ...a, children: [
    i ? /* @__PURE__ */ e("p", { className: "nim-decide__note", children: i }) : null,
    /* @__PURE__ */ e("div", { className: "nim-decide__actions", children: n })
  ] });
}
function rt({
  absent: n,
  className: t,
  coverage: i,
  labels: a,
  measured: l,
  ...s
}) {
  return /* @__PURE__ */ r("div", { className: v("nim-ledger", t), ...s, children: [
    /* @__PURE__ */ r("section", { className: "nim-ledger__col", "data-kind": "measured", children: [
      /* @__PURE__ */ r("header", { className: "nim-ledger__head", children: [
        /* @__PURE__ */ e("span", { children: (a == null ? void 0 : a.measured) ?? "Measured" }),
        i ? /* @__PURE__ */ e("span", { className: "nim-ledger__coverage", children: i }) : null
      ] }),
      /* @__PURE__ */ e("dl", { className: "nim-ledger__rows", children: l.map((c, o) => /* @__PURE__ */ r("div", { className: "nim-ledger__row", children: [
        /* @__PURE__ */ r("dt", { children: [
          c.label,
          /* @__PURE__ */ e("span", { className: "nim-ledger__meta", children: c.source })
        ] }),
        /* @__PURE__ */ e("dd", { children: c.value })
      ] }, o)) })
    ] }),
    /* @__PURE__ */ r("section", { className: "nim-ledger__col", "data-kind": "absent", children: [
      /* @__PURE__ */ r("header", { className: "nim-ledger__head", children: [
        /* @__PURE__ */ e("span", { children: (a == null ? void 0 : a.absent) ?? "Not evidence" }),
        /* @__PURE__ */ e("span", { className: "nim-ledger__coverage", children: (a == null ? void 0 : a.excluded) ?? "excluded from every figure" })
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
function ct({ caption: n, className: t, entries: i, ...a }) {
  return /* @__PURE__ */ r("section", { className: v("nim-trail", t), ...a, children: [
    n ? /* @__PURE__ */ e("p", { className: "nim-trail__caption", children: n }) : null,
    /* @__PURE__ */ e("dl", { className: "nim-trail__rows", children: i.map((l, s) => /* @__PURE__ */ r("div", { className: "nim-trail__row", children: [
      /* @__PURE__ */ r("dt", { children: [
        l.label,
        /* @__PURE__ */ e("span", { className: "nim-trail__source", children: l.source })
      ] }),
      /* @__PURE__ */ e("dd", { className: "nim-trail__age", children: l.age })
    ] }, s)) })
  ] });
}
function ot({
  className: n,
  detail: t,
  label: i,
  percent: a,
  tone: l = "accent",
  value: s,
  ...c
}) {
  const o = typeof a == "number", d = Math.min(100, Math.max(0, a ?? 0)), m = typeof i == "string" ? i : void 0;
  return /* @__PURE__ */ r("div", { className: v("nim-resource-meter", n), "data-tone": l, ...c, children: [
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
        "aria-valuenow": d,
        className: "nim-resource-meter__track",
        role: "meter",
        children: /* @__PURE__ */ e("span", { className: "nim-resource-meter__fill", style: { inlineSize: `${d}%` } })
      }
    ) : null,
    t ? /* @__PURE__ */ e("span", { className: "nim-resource-meter__detail", children: t }) : null
  ] });
}
function dt({
  accept: n,
  caption: t,
  className: i,
  disabled: a = !1,
  error: l,
  label: s,
  multiple: c = !1,
  onFiles: o,
  prompt: d
}) {
  const m = O(0), [u, h] = E(!1), f = (_) => {
    _.preventDefault(), _.stopPropagation();
  };
  return /* @__PURE__ */ r("div", { className: v("nim-field", l && "nim-field--invalid", i), children: [
    /* @__PURE__ */ r(
      "label",
      {
        className: "nim-file-drop",
        "data-over": u || void 0,
        "data-disabled": a || void 0,
        onDragEnter: (_) => {
          f(_), m.current += 1, a || h(!0);
        },
        onDragLeave: (_) => {
          f(_), m.current -= 1, m.current <= 0 && h(!1);
        },
        onDragOver: f,
        onDrop: (_) => {
          if (f(_), m.current = 0, h(!1), a) return;
          const N = Array.from(_.dataTransfer.files);
          N.length > 0 && o(c ? N : N.slice(0, 1));
        },
        children: [
          /* @__PURE__ */ e(
            "input",
            {
              accept: n,
              className: "nim-choice__input",
              disabled: a,
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
          t ? /* @__PURE__ */ e("span", { className: "nim-file-drop__caption", children: t }) : null
        ]
      }
    ),
    l ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: l }) : null
  ] });
}
function mt({ children: n, className: t, ...i }) {
  return /* @__PURE__ */ e("div", { className: v("nim-app-frame", t), ...i, children: n });
}
function ut({
  as: n = "div",
  children: t,
  className: i,
  gap: a = "md",
  ...l
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-stack", a !== "md" && `nim-stack--${a}`, i), ...l, children: t });
}
function ht({
  as: n = "div",
  children: t,
  className: i,
  gap: a = "md",
  wrap: l = !0,
  ...s
}) {
  return /* @__PURE__ */ e(
    n,
    {
      className: v("nim-inline", a !== "md" && `nim-inline--${a}`, !l && "nim-inline--nowrap", i),
      ...s,
      children: t
    }
  );
}
function Mi({ children: n, className: t, plain: i = !1, ...a }) {
  return /* @__PURE__ */ e("div", { className: v("nim-list", i && "nim-list--plain", t), ...a, children: n });
}
function Ti({
  className: n,
  href: t,
  leading: i,
  onClick: a,
  rel: l,
  subtitle: s,
  target: c,
  title: o,
  trailing: d,
  ...m
}) {
  const u = !!(t || a), h = /* @__PURE__ */ r(H, { children: [
    i ? /* @__PURE__ */ e("span", { className: "nim-list-row__leading", children: i }) : null,
    /* @__PURE__ */ r("span", { className: "nim-list-row__content", children: [
      /* @__PURE__ */ e("span", { className: "nim-list-row__title", children: o }),
      s ? /* @__PURE__ */ e("span", { className: "nim-list-row__subtitle", children: s }) : null
    ] }),
    d ? /* @__PURE__ */ e("span", { className: "nim-list-row__trailing", children: d }) : null,
    u && !d ? /* @__PURE__ */ e(T, { className: "nim-list-row__chevron", name: "chevron-forward", size: "sm" }) : null
  ] }), f = v("nim-list-row", u && "nim-list-row--interactive", n);
  return t ? /* @__PURE__ */ e(
    "a",
    {
      className: f,
      href: t,
      rel: c === "_blank" ? l ?? "noreferrer" : l,
      target: c,
      ...m,
      children: h
    }
  ) : a ? /* @__PURE__ */ e("button", { className: f, onClick: a, type: "button", ...m, children: h }) : /* @__PURE__ */ e("div", { className: f, ...m, children: h });
}
const Si = {
  back: "Back",
  dot: (n) => `Slide ${n + 1}`
};
function _t({
  brand: n,
  className: t,
  finishLabel: i,
  footnote: a,
  labels: l,
  nextLabel: s,
  onDone: c,
  onSkip: o,
  onStep: d,
  skipLabel: m,
  slides: u
}) {
  var w;
  const [h, f] = E(0), _ = { ...Si, ...l }, N = u[Math.min(h, u.length - 1)], g = h === u.length - 1, p = Z(
    (y) => {
      f(y), d == null || d(y);
    },
    [d]
  );
  return /* @__PURE__ */ r("section", { className: v("nim-onboarding", t), children: [
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
            children: g ? i : s
          }
        )
      ] }),
      a ? /* @__PURE__ */ e("p", { className: "nim-onboarding__footnote", children: a }) : null
    ] })
  ] });
}
const Di = "AD:376 AE:971 AF:93 AG:1268 AI:1264 AL:355 AM:374 AO:244 AQ:672 AR:54 AS:1684 AT:43 AU:61 AW:297 AX:358 AZ:994 BA:387 BB:1246 BD:880 BE:32 BF:226 BG:359 BH:973 BI:257 BJ:229 BL:590 BM:1441 BN:673 BO:591 BQ:599 BR:55 BS:1242 BT:975 BW:267 BY:375 BZ:501 CA:1 CC:61 CD:243 CF:236 CG:242 CH:41 CI:225 CK:682 CL:56 CM:237 CN:86 CO:57 CR:506 CU:53 CV:238 CW:599 CX:61 CY:357 CZ:420 DE:49 DJ:253 DK:45 DM:1767 DO:1809 DZ:213 EC:593 EE:372 EG:20 EH:212 ER:291 ES:34 ET:251 FI:358 FJ:679 FK:500 FM:691 FO:298 FR:33 GA:241 GB:44 GD:1473 GE:995 GF:594 GG:44 GH:233 GI:350 GL:299 GM:220 GN:224 GP:590 GQ:240 GR:30 GT:502 GU:1671 GW:245 GY:592 HK:852 HN:504 HR:385 HT:509 HU:36 ID:62 IE:353 IL:972 IM:44 IN:91 IO:246 IQ:964 IR:98 IS:354 IT:39 JE:44 JM:1876 JO:962 JP:81 KE:254 KG:996 KH:855 KI:686 KM:269 KN:1869 KP:850 KR:82 KW:965 KY:1345 KZ:7 LA:856 LB:961 LC:1758 LI:423 LK:94 LR:231 LS:266 LT:370 LU:352 LV:371 LY:218 MA:212 MC:377 MD:373 ME:382 MF:590 MG:261 MH:692 MK:389 ML:223 MM:95 MN:976 MO:853 MP:1670 MQ:596 MR:222 MS:1664 MT:356 MU:230 MV:960 MW:265 MX:52 MY:60 MZ:258 NA:264 NC:687 NE:227 NF:672 NG:234 NI:505 NL:31 NO:47 NP:977 NR:674 NU:683 NZ:64 OM:968 PA:507 PE:51 PF:689 PG:675 PH:63 PK:92 PL:48 PM:508 PR:1787 PS:970 PT:351 PW:680 PY:595 QA:974 RE:262 RO:40 RS:381 RU:7 RW:250 SA:966 SB:677 SC:248 SD:249 SE:46 SG:65 SH:290 SI:386 SJ:47 SK:421 SL:232 SM:378 SN:221 SO:252 SR:597 SS:211 ST:239 SV:503 SX:1721 SY:963 SZ:268 TC:1649 TD:235 TG:228 TH:66 TJ:992 TK:690 TL:670 TM:993 TN:216 TO:676 TR:90 TT:1868 TV:688 TW:886 TZ:255 UA:380 UG:256 US:1 UY:598 UZ:998 VA:39 VC:1784 VE:58 VG:1284 VI:1340 VN:84 VU:678 WF:681 WS:685 YE:967 YT:262 ZA:27 ZM:260 ZW:263";
function zi(n) {
  return String.fromCodePoint(...[...n].map((t) => 127462 + t.charCodeAt(0) - 65));
}
const ue = Di.split(" ").map((n) => {
  const [t, i] = n.split(":");
  return { dial: i, flag: zi(t), iso2: t };
}), Li = new Map(ue.map((n) => [n.iso2, n]));
function Qe(n) {
  return Li.get(n.toUpperCase());
}
function pt(n) {
  const t = n.replace(/\D/g, "");
  let i;
  for (const a of ue)
    t.startsWith(a.dial) && (!i || a.dial.length > i.dial.length) && (i = a);
  return i;
}
const Pe = /* @__PURE__ */ new Map();
function Ai(n) {
  const t = Pe.get(n);
  if (t) return t;
  let i;
  try {
    const a = new Intl.DisplayNames([n], { type: "region" });
    i = (l) => a.of(l) ?? l;
  } catch {
    i = (a) => a;
  }
  return Pe.set(n, i), i;
}
function se(n) {
  let t = "";
  for (const i of n) {
    const a = i.codePointAt(0) ?? 0;
    a >= 1776 && a <= 1785 ? t += String.fromCodePoint(a - 1776 + 48) : a >= 1632 && a <= 1641 ? t += String.fromCodePoint(a - 1632 + 48) : i >= "0" && i <= "9" && (t += i);
  }
  return t;
}
function $i({
  autoFocus: n = !1,
  className: t,
  digitLabel: i,
  error: a,
  label: l,
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
  return /* @__PURE__ */ r("div", { className: v("nim-otp", a && "nim-otp--invalid", t), children: [
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": l,
        className: "nim-otp__boxes",
        dir: "ltr",
        onPaste: g,
        ref: m,
        role: "group",
        children: Array.from({ length: s }, (p, w) => /* @__PURE__ */ e(
          "input",
          {
            "aria-invalid": a ? !0 : void 0,
            "aria-label": i ? i(w) : `${l} ${w + 1}`,
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
    a ? /* @__PURE__ */ e("p", { className: "nim-otp__error", role: "alert", children: a }) : null
  ] });
}
const Ei = {
  hide: "Hide password",
  show: "Show password",
  strength: (n) => `Password strength: ${n}`
}, Fe = ["weak", "fair", "good", "strong"];
function Ii({
  className: n,
  error: t,
  hint: i,
  id: a,
  label: l,
  labels: s,
  required: c,
  strength: o,
  ...d
}) {
  const [m, u] = E(!1), h = { ...Ei, ...s };
  return /* @__PURE__ */ e(ee, { error: t, hint: i, id: a, label: l, required: c, children: ({ control: f, describedBy: _ }) => /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ r("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-describedby": _,
          "aria-invalid": t ? !0 : void 0,
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
function ft(n) {
  if (n.length < 8) return "weak";
  const t = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((i) => i.test(n)).length;
  return n.length >= 14 && t >= 3 ? "strong" : n.length >= 10 && t >= 2 ? "good" : "fair";
}
const Bi = {
  noMatch: "No country matches",
  pickCountry: "Country code",
  search: "Search countries"
};
function Pi({
  className: n,
  country: t,
  error: i,
  hint: a,
  id: l,
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
  const g = J(), p = l ?? `nim-${g}`, w = a ? `${p}-hint` : void 0, y = i ? `${p}-error` : void 0, D = { ...Bi, ...c }, [I, k] = E(!1), [x, b] = E(""), S = O(null), C = O(null), $ = O(null), L = o ?? (typeof document > "u" ? "en" : document.documentElement.lang || "en"), A = Y(() => Ai(L), [L]), B = Qe(t) ?? ue[0], K = Y(() => {
    const M = new Intl.Collator(L), F = ue.map((z) => ({ ...z, name: A(z.iso2) })), W = (z) => {
      const R = f.indexOf(z);
      return R === -1 ? f.length : R;
    };
    return F.sort(
      (z, R) => W(z.iso2) - W(R.iso2) || M.compare(z.name, R.name)
    );
  }, [A, f, L]), G = Y(() => {
    const M = x.trim().toLocaleLowerCase(L);
    if (!M) return K;
    const F = se(M);
    return K.filter(
      (W) => W.name.toLocaleLowerCase(L).includes(M) || W.iso2.toLowerCase().includes(M) || (F ? W.dial.startsWith(F) : !1)
    );
  }, [K, x, L]);
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
  return /* @__PURE__ */ r("div", { className: v("nim-field", i && "nim-field--invalid", n), children: [
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
            "aria-invalid": i ? !0 : void 0,
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
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: y, children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: w, children: a }) : null
  ] });
}
function Fi(n, t) {
  var a;
  return `+${((a = Qe(n)) == null ? void 0 : a.dial) ?? ""}${se(t).replace(/^0+/, "")}`;
}
const Ri = {
  excluded: "minus",
  included: "check",
  pending: "clock"
};
function Oi({
  badge: n,
  className: t,
  features: i = [],
  icon: a,
  name: l,
  onSelect: s,
  price: c,
  priceCaption: o,
  secondary: d,
  selected: m = !1,
  tagline: u
}) {
  const h = /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ r("div", { className: "nim-plan__top", children: [
      a ? /* @__PURE__ */ e("span", { className: "nim-plan__icon", children: /* @__PURE__ */ e(T, { name: a, size: "md" }) }) : null,
      /* @__PURE__ */ r("div", { className: "nim-plan__heading", children: [
        /* @__PURE__ */ e("span", { className: "nim-plan__name", children: l }),
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
    i.length ? /* @__PURE__ */ e("ul", { className: "nim-plan__features", children: i.map((_, N) => {
      const g = _.state ?? "included";
      return /* @__PURE__ */ r("li", { className: "nim-plan__feature", "data-state": g, children: [
        /* @__PURE__ */ e(T, { name: Ri[g], size: "xs" }),
        /* @__PURE__ */ e("span", { className: "nim-plan__feature-label", children: _.label }),
        _.note ? /* @__PURE__ */ e("span", { className: "nim-plan__feature-note", children: _.note }) : null
      ] }, N);
    }) }) : null
  ] }), f = v("nim-plan", m && "nim-plan--selected", t);
  return s ? /* @__PURE__ */ e("button", { "aria-pressed": m, className: f, onClick: s, type: "button", children: h }) : /* @__PURE__ */ e("article", { className: f, children: h });
}
function Ui({
  className: n,
  fullWidth: t = !1,
  label: i,
  onChange: a,
  options: l,
  value: s,
  ...c
}) {
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": i,
      className: v("nim-segmented", t && "nim-segmented--full", n),
      role: "tablist",
      ...c,
      children: l.map((o) => /* @__PURE__ */ e(
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
const Hi = {
  cycle: "Billing period",
  monthly: "Per month",
  price: "This package"
};
function Nt({
  className: n,
  cycle: t,
  cycles: i = [],
  defaultCycle: a,
  defaultPlan: l,
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
  const _ = { ...Hi, ...s }, [N, g] = E(a ?? ((b = i[0]) == null ? void 0 : b.id) ?? ""), [p, w] = E(l ?? ((S = h[0]) == null ? void 0 : S.id) ?? ""), y = t ?? N, D = u ?? p, I = (C) => {
    w(C), d == null || d(C);
  }, k = (C) => {
    g(C), o == null || o(C);
  }, x = i.find((C) => C.id === y);
  return /* @__PURE__ */ r("section", { className: v("nim-plan-picker", n), children: [
    i.length > 1 ? /* @__PURE__ */ r("div", { className: "nim-plan-picker__cycles", children: [
      /* @__PURE__ */ e(
        Ui,
        {
          fullWidth: !0,
          label: _.cycle,
          onChange: k,
          options: i.map((C) => ({ label: C.label, value: C.id })),
          value: y
        }
      ),
      x != null && x.note ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__save", children: x.note }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-plan-picker__plans", children: h.map(({ id: C, prices: $, ...L }) => {
      const A = $[y] ?? Object.values($)[0];
      return /* @__PURE__ */ nn(
        Oi,
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
function Ki({
  action: n,
  className: t,
  description: i,
  eyebrow: a,
  title: l,
  ...s
}) {
  return /* @__PURE__ */ r("header", { className: v("nim-section-header", t), ...s, children: [
    /* @__PURE__ */ r("div", { children: [
      a ? /* @__PURE__ */ e("p", { className: "nim-label nim-section-header__eyebrow", children: a }) : null,
      /* @__PURE__ */ e("h2", { className: "nim-title nim-title--md", children: l }),
      i ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-section-header__description", children: i }) : null
    ] }),
    n ? /* @__PURE__ */ e("div", { className: "nim-section-header__action", children: n }) : null
  ] });
}
function vt({
  className: n,
  footer: t,
  sections: i = [],
  ...a
}) {
  return /* @__PURE__ */ r("div", { className: v("nim-profile-screen", n), children: [
    /* @__PURE__ */ e(Ka, { ...a }),
    i.map((l) => /* @__PURE__ */ r("section", { className: "nim-profile-screen__section", children: [
      l.title ? /* @__PURE__ */ e(Ki, { description: l.description, title: l.title }) : null,
      /* @__PURE__ */ e(Mi, { children: l.rows.map((s) => /* @__PURE__ */ e(
        Ti,
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
              Ba,
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
    ] }, l.key)),
    t ? /* @__PURE__ */ e("div", { className: "nim-profile-screen__footer", children: t }) : null
  ] });
}
function bt({
  className: n,
  count: t = 5,
  label: i,
  onChange: a,
  readOnly: l = !1,
  size: s = "md",
  value: c
}) {
  const o = J(), [d, m] = E(null), u = d ?? c;
  return l || !a ? /* @__PURE__ */ e(
    "span",
    {
      "aria-label": `${i}: ${c}/${t}`,
      className: v("nim-rating", `nim-rating--${s}`, "nim-rating--static", n),
      role: "img",
      children: Array.from({ length: t }, (h, f) => /* @__PURE__ */ e(Re, { fill: Math.min(Math.max(c - f, 0), 1) }, f))
    }
  ) : /* @__PURE__ */ r(
    "fieldset",
    {
      className: v("nim-rating", `nim-rating--${s}`, n),
      onMouseLeave: () => m(null),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-visually-hidden", children: i }),
        Array.from({ length: t }, (h, f) => {
          const _ = f + 1;
          return /* @__PURE__ */ r("label", { className: "nim-rating__star", onMouseEnter: () => m(_), children: [
            /* @__PURE__ */ e(
              "input",
              {
                checked: c === _,
                className: "nim-choice__input",
                name: o,
                onChange: () => a(_),
                type: "radio",
                value: _
              }
            ),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: _ }),
            /* @__PURE__ */ e(Re, { fill: Math.min(Math.max(u - f, 0), 1) })
          ] }, _);
        })
      ]
    }
  );
}
function Re({ fill: n }) {
  return /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "nim-rating__glyph", children: [
    /* @__PURE__ */ e(T, { className: "nim-rating__outline", name: "star", size: "md" }),
    /* @__PURE__ */ e("span", { className: "nim-rating__fill", style: { inlineSize: `${n * 100}%` }, children: /* @__PURE__ */ e(T, { name: "star", size: "md" }) })
  ] });
}
const Gi = {
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
}, ye = (n, t) => n instanceof Error && n.message.trim() ? n.message.trim() : t;
function gt({
  brand: n,
  className: t,
  codeLength: i = 5,
  copy: a,
  defaultCountry: l = "IR",
  defaultMethod: s = "code",
  footer: c,
  methods: o = ["code", "password"],
  onPasswordSignIn: d,
  onRequestCode: m,
  onVerifyCode: u,
  priority: h = ["IR", "AE", "TR", "DE", "US", "GB"],
  resendSeconds: f = 60
}) {
  const _ = { ...Gi, ...a }, [N, g] = E(
    o.includes(s) ? s : o[0]
  ), [p, w] = E(!1), [y, D] = E(l), [I, k] = E(""), [x, b] = E(""), [S, C] = E(""), [$, L] = E(""), [A, B] = E(!1), [K, G] = E(""), [P, M] = E(0), F = O(!1);
  j(() => {
    if (P <= 0) return;
    const V = window.setTimeout(() => M((ae) => ae - 1), 1e3);
    return () => window.clearTimeout(V);
  }, [P]);
  const W = Fi(y, I), z = I.replace(/\D/g, "").length >= 6, R = Z(
    async (V = !1) => {
      if (!(A || !V && !z)) {
        B(!0), G("");
        try {
          await (m == null ? void 0 : m(W)), w(!0), b(""), M(f);
        } catch (ae) {
          G(ye(ae, _.sendCode));
        } finally {
          B(!1);
        }
      }
    },
    [A, W, m, z, f, _.sendCode]
  ), q = Z(
    async (V) => {
      if (!(F.current || V.length !== i)) {
        F.current = !0, B(!0), G("");
        try {
          await (u == null ? void 0 : u(W, V));
        } catch (ae) {
          G(ye(ae, _.verify)), b("");
        } finally {
          F.current = !1, B(!1);
        }
      }
    },
    [i, W, u, _.verify]
  ), Q = Z(async () => {
    if (!(A || !S.trim() || !$)) {
      B(!0), G("");
      try {
        await (d == null ? void 0 : d(S.trim(), $));
      } catch (V) {
        G(ye(V, _.signIn));
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
  ) : null, fe = K ? /* @__PURE__ */ e(Za, { tone: "danger", children: K }) : null;
  return N === "password" ? /* @__PURE__ */ r(
    Ne,
    {
      action: {
        disabled: !S.trim() || !$,
        label: _.signIn,
        loading: A,
        onClick: () => void Q()
      },
      brand: n,
      className: t,
      footer: /* @__PURE__ */ r(H, { children: [
        re,
        c
      ] }),
      subtitle: _.passwordSubtitle,
      title: _.passwordTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          pi,
          {
            autoComplete: "username",
            label: _.identifierLabel,
            onChange: (V) => C(V.target.value),
            type: "email",
            value: S
          }
        ),
        /* @__PURE__ */ e(
          Ii,
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
    Ne,
    {
      action: {
        disabled: x.length !== i,
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
      className: t,
      footer: /* @__PURE__ */ r(H, { children: [
        P > 0 ? /* @__PURE__ */ e("p", { children: _.resendIn(P) }) : /* @__PURE__ */ e(X, { onClick: () => void R(!0), size: "sm", variant: "ghost", children: _.resend }),
        c
      ] }),
      subtitle: _.codeSubtitle(W),
      title: _.codeTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          $i,
          {
            autoFocus: !0,
            label: _.codeLabel,
            length: i,
            onChange: b,
            onComplete: (V) => void q(V),
            value: x
          }
        )
      ]
    }
  ) : /* @__PURE__ */ r(
    Ne,
    {
      action: {
        disabled: !z,
        label: _.sendCode,
        loading: A,
        onClick: () => void R()
      },
      brand: n,
      className: t,
      footer: /* @__PURE__ */ r(H, { children: [
        re,
        c
      ] }),
      subtitle: _.phoneSubtitle,
      title: _.phoneTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          Pi,
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
function yt({ children: n, className: t, closeLabel: i = "Close", footer: a, onClose: l, open: s, title: c }) {
  const o = O(null), d = O(null), m = J();
  return j(() => {
    var f;
    if (!s) return;
    d.current = document.activeElement;
    const u = document.body.style.overflow;
    document.body.style.overflow = "hidden", (f = o.current) == null || f.focus();
    const h = (_) => {
      var w, y;
      if (_.key === "Escape" && l(), _.key !== "Tab") return;
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
  }, [l, s]), !s || typeof document > "u" ? null : he(
    /* @__PURE__ */ r(H, { children: [
      /* @__PURE__ */ e("div", { className: "nim-sheet__scrim", onClick: l }),
      /* @__PURE__ */ r(
        "div",
        {
          "aria-label": c ? void 0 : i,
          "aria-labelledby": c ? m : void 0,
          "aria-modal": "true",
          className: v("nim-sheet__panel", t),
          ref: o,
          role: "dialog",
          tabIndex: -1,
          children: [
            /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-sheet__handle" }),
            c ? /* @__PURE__ */ r("div", { className: "nim-sheet__header", children: [
              /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", id: m, children: c }),
              /* @__PURE__ */ e(U, { label: i, name: "close", onClick: l, size: "sm" })
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
function kt({
  className: n,
  label: t,
  max: i = 100,
  min: a = 0,
  scale: l,
  step: s = 1,
  value: c,
  ...o
}) {
  const d = i === a ? 0 : (c - a) / (i - a) * 100;
  return /* @__PURE__ */ r("div", { className: "nim-field", children: [
    t ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: t }) : null,
    /* @__PURE__ */ e(
      "input",
      {
        "aria-label": t,
        className: v("nim-slider", n),
        max: i,
        min: a,
        step: s,
        style: { "--nim-slider-progress": `${d}%` },
        type: "range",
        value: c,
        ...o
      }
    ),
    l ? /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-inline", style: { justifyContent: "space-between" }, children: l.map((m) => /* @__PURE__ */ e("span", { className: "nim-caption", children: m }, m)) }) : null
  ] });
}
function wt({ className: n, delta: t, deltaDirection: i = "up", label: a, unit: l, value: s, ...c }) {
  return /* @__PURE__ */ r("div", { className: v("nim-stat", n), ...c, children: [
    /* @__PURE__ */ r("p", { className: "nim-stat__value", children: [
      s,
      l ? /* @__PURE__ */ e("span", { className: "nim-stat__unit", children: l }) : null
    ] }),
    /* @__PURE__ */ e("p", { className: "nim-label nim-stat__label", children: a }),
    t ? /* @__PURE__ */ r("p", { className: "nim-stat__delta", "data-direction": i, children: [
      /* @__PURE__ */ e(T, { name: i === "up" ? "trend-up" : "trend-down", size: "xs" }),
      t
    ] }) : null
  ] });
}
function Ct({ className: n, label: t = "Stages", stages: i }) {
  return /* @__PURE__ */ e("ol", { "aria-label": t, className: v("nim-stages", n), children: i.map((a, l) => {
    const s = /* @__PURE__ */ r(H, { children: [
      /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-stages__marker", children: a.status === "done" ? /* @__PURE__ */ e(T, { name: "check", size: "xs" }) : a.status === "blocked" ? /* @__PURE__ */ e(T, { name: "close", size: "xs" }) : l + 1 }),
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
function xt({
  className: n,
  decrementLabel: t = "Decrease",
  incrementLabel: i = "Increase",
  label: a,
  max: l = Number.MAX_SAFE_INTEGER,
  min: s = 0,
  onChange: c,
  step: o = 1,
  value: d
}) {
  const m = (u) => Math.min(Math.max(u, s), l);
  return /* @__PURE__ */ r(
    "div",
    {
      "aria-label": a,
      "aria-valuemax": l,
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
            "aria-label": t,
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
            "aria-label": i,
            className: "nim-stepper__button",
            disabled: d >= l,
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
const Wi = {
  of: (n, t) => `${n} of ${t} steps`,
  status: {
    active: "In progress",
    done: "Done",
    failed: "Failed",
    pending: "Waiting",
    skipped: "Skipped"
  }
}, Zi = {
  done: "check",
  failed: "close",
  pending: "clock",
  skipped: "minus"
};
function Mt({
  action: n,
  caption: t,
  className: i,
  labels: a,
  steps: l,
  title: s,
  value: c
}) {
  const o = { ...Wi, ...a }, d = l.filter((h) => h.status === "done" || h.status === "skipped").length, m = c ?? (l.length ? Math.round(d / l.length * 100) : 0), u = l.some((h) => h.status === "failed");
  return /* @__PURE__ */ r(
    "section",
    {
      "aria-live": "polite",
      className: v("nim-task", u && "nim-task--failed", i),
      children: [
        /* @__PURE__ */ r("header", { className: "nim-task__head", children: [
          s ? /* @__PURE__ */ e("h2", { className: "nim-task__title", children: s }) : null,
          t ? /* @__PURE__ */ e("p", { className: "nim-task__caption", children: t }) : null,
          /* @__PURE__ */ e(Pa, { label: o.of(d, l.length), value: m })
        ] }),
        /* @__PURE__ */ e("ol", { className: "nim-task__steps", children: l.map((h) => /* @__PURE__ */ r("li", { className: "nim-task__step", "data-status": h.status, children: [
          /* @__PURE__ */ e("span", { className: "nim-task__marker", children: h.status === "active" ? /* @__PURE__ */ e(Ke, { size: "sm" }) : /* @__PURE__ */ e(T, { name: Zi[h.status], size: "xs" }) }),
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
function Tt({ className: n, density: t = "default", entries: i }) {
  return /* @__PURE__ */ e("ol", { className: v("nim-timeline", t === "compact" && "nim-timeline--compact", n), children: i.map((a) => /* @__PURE__ */ r("li", { className: "nim-timeline__entry", "data-tone": a.tone, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-timeline__marker", children: a.icon ? /* @__PURE__ */ e(T, { name: a.icon, size: "xs" }) : /* @__PURE__ */ e("span", { className: "nim-timeline__dot" }) }),
    /* @__PURE__ */ r("div", { className: "nim-timeline__content", children: [
      /* @__PURE__ */ r("div", { className: "nim-timeline__head", children: [
        /* @__PURE__ */ e("span", { className: "nim-timeline__title", children: a.title }),
        a.time ? /* @__PURE__ */ e("time", { className: "nim-timeline__time", children: a.time }) : null
      ] }),
      a.body && t !== "compact" ? /* @__PURE__ */ e("div", { className: "nim-timeline__body", children: a.body }) : null
    ] })
  ] }, a.id)) });
}
function St({ className: n, label: t, onChange: i, options: a, value: l, ...s }) {
  const c = O(null), o = (d) => {
    var _, N;
    const m = d.key === "ArrowRight" ? 1 : d.key === "ArrowLeft" ? -1 : 0;
    if (m === 0) return;
    d.preventDefault();
    const u = a.filter((g) => !g.disabled), h = u.findIndex((g) => g.value === l), f = u[(h + m + u.length) % u.length];
    f && (i(f.value), (N = (_ = c.current) == null ? void 0 : _.querySelector(`[data-value="${f.value}"]`)) == null || N.focus());
  };
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": t,
      className: v("nim-tabs", n),
      onKeyDown: o,
      ref: c,
      role: "tablist",
      ...s,
      children: a.map((d) => /* @__PURE__ */ r(
        "button",
        {
          "aria-selected": d.value === l,
          className: "nim-tab",
          "data-value": d.value,
          disabled: d.disabled,
          onClick: () => i(d.value),
          role: "tab",
          tabIndex: d.value === l ? 0 : -1,
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
const Xe = Ce(null), Yi = {
  accent: "sparkle",
  danger: "danger",
  neutral: "info",
  success: "check-circle"
};
function Dt({ children: n }) {
  const [t, i] = E([]), a = O(0), l = Z((o) => {
    i((d) => d.filter((m) => m.id !== o));
  }, []), s = Z(
    (o) => {
      const d = a.current++;
      i((u) => [...u, { ...o, id: d }]);
      const m = o.duration ?? 4e3;
      m > 0 && window.setTimeout(() => l(d), m);
    },
    [l]
  ), c = Y(() => s, [s]);
  return /* @__PURE__ */ r(Xe.Provider, { value: c, children: [
    n,
    typeof document < "u" ? he(
      /* @__PURE__ */ e("div", { "aria-live": "polite", className: "nim-toast-stack", children: t.map((o) => /* @__PURE__ */ r("div", { className: v("nim-toast", `nim-toast--${o.tone ?? "neutral"}`), children: [
        /* @__PURE__ */ e(T, { className: "nim-toast__icon", name: Yi[o.tone ?? "neutral"], size: "sm" }),
        /* @__PURE__ */ e("span", { className: "nim-toast__message", children: o.message }),
        o.action ? /* @__PURE__ */ e(
          "button",
          {
            className: "nim-toast__action",
            onClick: () => {
              var d;
              (d = o.action) == null || d.onPress(), l(o.id);
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
function zt() {
  const n = xe(Xe);
  if (!n) throw new Error("useToast must be used inside <ToastProvider>");
  return n;
}
function Lt({ children: n, className: t, label: i }) {
  return /* @__PURE__ */ r("span", { className: v("nim-tooltip", t), children: [
    n,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-tooltip__bubble", role: "tooltip", children: i })
  ] });
}
const ji = {
  back: "Back",
  close: "Close",
  step: (n, t) => `Step ${n + 1} of ${t}`
};
function At({
  className: n,
  continueLabel: t,
  finishLabel: i,
  labels: a,
  onClose: l,
  onDone: s,
  onStep: c,
  steps: o
}) {
  const d = { ...ji, ...a }, [m, u] = E(0), h = o[Math.min(m, o.length - 1)], f = m === o.length - 1, _ = Z(
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
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: l ? /* @__PURE__ */ e(U, { label: d.close, name: "close", onClick: l, size: "sm" }) : null })
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
        children: h.continueLabel ?? (f ? i : t)
      }
    ) })
  ] });
}
function $t({
  className: n,
  max: t,
  multiple: i = !1,
  onChange: a,
  options: l,
  selected: s
}) {
  const c = i && t !== void 0 && s.length >= t, o = (d) => {
    if (!i) {
      a([d]);
      return;
    }
    a(s.includes(d) ? s.filter((m) => m !== d) : [...s, d]);
  };
  return /* @__PURE__ */ e("div", { className: v("nim-choice-grid", n), role: i ? "group" : "radiogroup", children: l.map((d) => {
    const m = s.includes(d.id);
    return /* @__PURE__ */ r(
      "button",
      {
        "aria-checked": m,
        className: "nim-choice-grid__tile",
        "data-on": m ? "true" : void 0,
        disabled: d.disabled || c && !m,
        onClick: () => o(d.id),
        role: i ? "checkbox" : "radio",
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
const Je = (n = "default") => n === "default" ? void 0 : `nim-text--${n}`;
function Vi({
  as: n = "h1",
  children: t,
  className: i,
  size: a = "md",
  ...l
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
      ...l,
      children: t
    }
  );
}
Vi.Line = function({
  children: t,
  accent: i,
  indent: a,
  className: l,
  ...s
}) {
  return /* @__PURE__ */ e(
    "span",
    {
      className: v("nim-display__line", i && "nim-display__accent", l),
      "data-indent": a ? "true" : void 0,
      ...s,
      children: t
    }
  );
};
function Et({
  as: n = "h2",
  children: t,
  className: i,
  size: a = "lg",
  ...l
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-title", a === "md" && "nim-title--md", i), ...l, children: t });
}
function It({
  as: n = "p",
  children: t,
  className: i,
  size: a = "md",
  tone: l,
  ...s
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-body", a === "sm" && "nim-body--sm", Je(l), i), ...s, children: t });
}
function Bt({ as: n = "span", children: t, className: i, ...a }) {
  return /* @__PURE__ */ e(n, { className: v("nim-label", i), ...a, children: t });
}
function Pt({ as: n = "p", children: t, className: i, tone: a, ...l }) {
  return /* @__PURE__ */ e(n, { className: v("nim-caption", Je(a), i), ...l, children: t });
}
function Ft({ className: n, ...t }) {
  return /* @__PURE__ */ e("hr", { className: v("nim-rule", n), ...t });
}
export {
  Tl as Accordion,
  El as ActionBar,
  ll as ActivityFeed,
  nl as AdminShell,
  mt as AppFrame,
  Sl as AppShell,
  Bl as AssistantThread,
  Ne as AuthScreen,
  de as Avatar,
  Dl as AvatarRing,
  Ga as Badge,
  Za as Banner,
  It as Body,
  yl as Brand,
  kl as BrandMark,
  zl as Breadcrumb,
  X as Button,
  ue as COUNTRIES,
  Ve as Calendar,
  Pt as Caption,
  Ll as Card,
  at as CausalChain,
  it as Caveat,
  Pl as Chart,
  Il as Chat,
  Kl as ChatComposer,
  De as Checkbox,
  hi as Chip,
  Gl as ChipInput,
  $t as ChoiceGrid,
  hl as CodeBlock,
  ml as Columns,
  ql as Combobox,
  tt as CommandList,
  Zl as CommandPalette,
  si as ConversationList,
  bl as CopyChip,
  Wl as DataList,
  Ml as DataTable,
  Jl as DateField,
  et as DatePicker,
  st as DecideBar,
  al as DetailHeader,
  gl as DetailLayout,
  nt as Dialog,
  lt as Diff,
  Vi as Display,
  $a as EmptyState,
  rt as EvidenceLedger,
  ct as EvidenceTrail,
  dl as Facts,
  Yl as Field,
  dt as FileDrop,
  il as FilterChips,
  T as Icon,
  U as IconButton,
  ht as Inline,
  pi as Input,
  Bt as Label,
  Mi as List,
  Ti as ListRow,
  Ul as MapView,
  Hl as MediaPlayer,
  ze as Menu,
  Rl as Messenger,
  cl as Metric,
  ol as MetricGrid,
  pl as Mono,
  Ql as NimProvider,
  _t as Onboarding,
  Al as OptionCard,
  $l as OrderSummary,
  $i as OtpInput,
  tl as Page,
  Ia as Pagination,
  sl as Panel,
  Ii as PasswordField,
  Pi as PhoneField,
  Oi as PlanCard,
  Nt as PlanPicker,
  ja as Popover,
  Ka as ProfileHeader,
  vt as ProfileScreen,
  Pa as Progress,
  Cl as Radio,
  xl as RadioGroup,
  Nl as Rail,
  vl as RailSection,
  bt as Rating,
  fl as RecordLink,
  ot as ResourceMeter,
  Ol as RoomHeader,
  Ft as Rule,
  Ki as SectionHeader,
  Ui as Segmented,
  Vl as Select,
  yt as Sheet,
  gt as SignInFlow,
  Fa as Skeleton,
  kt as Slider,
  Fl as Sparkline,
  Ke as Spinner,
  ut as Stack,
  Ct as StageTrack,
  wt as Stat,
  _l as StatusDot,
  ul as StatusHero,
  xt as Stepper,
  Ba as Switch,
  Ua as TabBar,
  Se as Table,
  St as Tabs,
  Mt as TaskProgress,
  jl as Textarea,
  Tt as Timeline,
  Et as Title,
  Dt as ToastProvider,
  rl as Toolbar,
  Lt as Tooltip,
  At as Wizard,
  ge as addDays,
  Ee as addMonths,
  wl as brandFor,
  v as cn,
  pt as countryByDial,
  Qe as countryByIso2,
  Ai as countryNamer,
  we as formatNumeric,
  te as fromParts,
  el as iconNames,
  je as monthLength,
  Ci as parseNumeric,
  ne as partsOf,
  ft as scorePassword,
  bi as startOfMonth,
  se as toAsciiDigits,
  Fi as toE164,
  pe as todayIso,
  _e as useNim,
  Xl as useSchemeToggle,
  zt as useToast
};
