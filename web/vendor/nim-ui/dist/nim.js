import { jsx as e, jsxs as r, Fragment as H } from "react/jsx-runtime";
import { forwardRef as Oe, useState as E, useCallback as Z, createContext as Ce, useContext as xe, useId as J, Fragment as ke, useRef as O, useLayoutEffect as en, useEffect as j, useMemo as Y, createElement as nn } from "react";
import { Wallet as an, VolumeX as ln, Volume2 as tn, User as sn, Video as rn, Upload as cn, TrendingUp as on, TrendingDown as dn, Trash2 as mn, Sun as un, Star as hn, Sparkles as pn, CircleStop as _n, LogOut as fn, Share2 as Nn, Settings as bn, Send as vn, Search as gn, Plus as yn, Play as kn, Pin as wn, Pause as Cn, Paperclip as xn, Moon as Mn, Minus as Tn, Mic as Sn, Menu as Dn, Lock as zn, Loader as An, Info as Ln, Home as $n, Heart as En, Hash as In, Forward as Bn, Filter as Pn, Maximize2 as Fn, SmilePlus as Rn, MessageCircle as On, Eye as Un, ExternalLink as Hn, Pencil as Kn, Download as Gn, FileText as Wn, CircleAlert as Zn, Copy as Yn, X as jn, Clock as Vn, ChevronUp as qn, ChevronRight as Qn, ChevronDown as Xn, ChevronLeft as Jn, CircleCheck as ea, Check as na, Camera as aa, Calendar as ia, Bookmark as la, Bell as ta, Users as sa, Terminal as ra, Tag as ca, ShieldCheck as oa, Server as da, Reply as ma, RefreshCw as ua, Package as ha, MoreHorizontal as pa, Link2 as _a, Layers as fa, KeyRound as Na, Globe as ba, Database as va, Cloud as ga, BarChart3 as ya, ArrowRight as ka, ArrowLeft as wa, AlertTriangle as Ca, Activity as xa } from "lucide-react";
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
  info: Ln,
  loading: An,
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
function T({ className: n, label: l, name: a, size: i = "md", tone: t = "default", ...s }) {
  const d = Ue[a];
  return /* @__PURE__ */ e(
    d,
    {
      "aria-hidden": l ? void 0 : !0,
      "aria-label": l,
      className: v("nim-icon", n),
      "data-flip": Ma.has(a) ? "true" : void 0,
      "data-tone": t === "default" ? void 0 : t,
      focusable: "false",
      height: Te[i],
      role: l ? "img" : void 0,
      strokeWidth: 1.75,
      width: Te[i],
      ...s
    }
  );
}
const el = Object.keys(Ue), Ta = { sm: "sm", md: "md", lg: "md" }, U = Oe(function({ className: l, label: a, name: i, size: t = "md", type: s = "button", variant: d = "ghost", ...c }, o) {
  return /* @__PURE__ */ e(
    "button",
    {
      "aria-label": a,
      className: v("nim-icon-button", `nim-icon-button--${d}`, `nim-icon-button--${t}`, l),
      ref: o,
      title: a,
      type: s,
      ...c,
      children: /* @__PURE__ */ e(T, { name: i, size: Ta[t] })
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
  children: l,
  className: a,
  collapsible: i = !1,
  contextualFooter: t,
  contextualGroups: s,
  contextualHeader: d,
  contextualValue: c,
  groups: o,
  labels: m,
  navigation: u = "sidebar",
  sidebarFooter: h,
  title: f,
  toolbar: p,
  value: N,
  titleRole: g = "page"
}) {
  const _ = { ...Sa, ...m }, [w, y] = E(!1), [D, I] = E(!1), k = g === "scope" ? "div" : "h1", x = (C, $, A) => /* @__PURE__ */ e("nav", { "aria-label": A, className: "nim-admin__nav", children: C.map((L) => /* @__PURE__ */ r("div", { className: "nim-admin__group", children: [
    L.label ? /* @__PURE__ */ r("p", { className: "nim-admin__group-label", children: [
      L.icon ? /* @__PURE__ */ e(T, { name: L.icon, size: "xs" }) : null,
      L.label
    ] }) : null,
    L.items.map((B) => {
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
  ] }, L.key)) }), b = x(o, N, _.nav), S = s != null && s.length ? x(s, c ?? N, `${_.nav} · current section`) : null;
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
              "aria-label": D ? _.expand : _.collapse,
              "aria-expanded": !D,
              className: "nim-admin__rail-toggle",
              onClick: () => I((C) => !C),
              type: "button",
              children: [
                /* @__PURE__ */ e(T, { name: D ? "chevron-forward" : "chevron-back", size: "sm" }),
                /* @__PURE__ */ e("span", { children: D ? _.expand : _.collapse })
              ]
            }
          ) : null
        ] }) : null,
        /* @__PURE__ */ r("div", { className: "nim-admin__drawer", hidden: !w, children: [
          /* @__PURE__ */ e("div", { className: "nim-admin__scrim", onClick: () => y(!1) }),
          /* @__PURE__ */ r("div", { className: "nim-admin__drawer-panel", children: [
            /* @__PURE__ */ r("div", { className: "nim-admin__drawer-head", children: [
              n,
              /* @__PURE__ */ e(U, { label: _.close, name: "close", onClick: () => y(!1), size: "sm" })
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
                label: _.menu,
                name: "menu",
                onClick: () => y(!0),
                size: "sm"
              }
            ),
            u === "sections" && n ? /* @__PURE__ */ e("div", { className: "nim-admin__masthead-brand", children: n }) : null,
            f ? /* @__PURE__ */ e(k, { className: "nim-admin__title", children: f }) : null,
            p ? /* @__PURE__ */ e("div", { className: "nim-admin__toolbar", children: p }) : null
          ] }),
          u === "sections" ? /* @__PURE__ */ e("div", { className: "nim-admin__sections", children: b }) : null,
          S ? /* @__PURE__ */ r("div", { className: "nim-admin__context-layout", children: [
            /* @__PURE__ */ r("aside", { className: "nim-admin__context", children: [
              d ? /* @__PURE__ */ e("div", { className: "nim-admin__context-head", children: d }) : null,
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
function al({
  actions: n,
  back: l,
  className: a,
  meta: i,
  status: t,
  subtitle: s,
  title: d
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
          /* @__PURE__ */ e("h1", { className: "nim-detail-header__title", children: d }),
          t ? /* @__PURE__ */ e("span", { className: "nim-detail-header__status", children: t }) : null
        ] }),
        s ? /* @__PURE__ */ e("p", { className: "nim-detail-header__subtitle", children: s }) : null,
        i ? /* @__PURE__ */ e("div", { className: "nim-detail-header__meta", children: i }) : null
      ] }),
      n ? /* @__PURE__ */ e("div", { className: "nim-detail-header__actions", children: n }) : null
    ] })
  ] });
}
function il({
  chips: n,
  className: l,
  clearLabel: a,
  labels: i,
  onClearAll: t
}) {
  if (n.length === 0) return null;
  const s = {
    remove: (d) => `Remove filter ${d}`,
    toolbar: "Active filters",
    ...i
  };
  return /* @__PURE__ */ r("div", { "aria-label": s.toolbar, className: v("nim-filter-chips", l), role: "toolbar", children: [
    n.map((d) => /* @__PURE__ */ r("span", { className: "nim-filter-chip", children: [
      /* @__PURE__ */ r("span", { className: "nim-filter-chip__label", children: [
        d.label,
        d.value !== void 0 ? /* @__PURE__ */ r(H, { children: [
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
          children: /* @__PURE__ */ e(T, { name: "close", size: "xs" })
        }
      )
    ] }, d.key)),
    t && a ? /* @__PURE__ */ e("button", { className: "nim-filter-chips__clear", onClick: t, type: "button", children: a }) : null
  ] });
}
function ll({ className: n, empty: l, events: a, locale: i }) {
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
function tl({ children: n, className: l, width: a = "wide", ...i }) {
  return /* @__PURE__ */ e("div", { className: v("nim-page", l), "data-width": a, ...i, children: n });
}
function sl({
  actions: n,
  caption: l,
  children: a,
  className: i,
  description: t,
  eyebrow: s,
  flush: d = !1,
  footer: c,
  marker: o,
  title: m,
  ...u
}) {
  const h = m || l || t || s || n;
  return /* @__PURE__ */ r("section", { className: v("nim-panel", i), ...u, children: [
    h ? /* @__PURE__ */ r("header", { className: "nim-panel__head", children: [
      o ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-panel__marker", children: o }) : null,
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
    a ? /* @__PURE__ */ e("div", { className: "nim-panel__body", "data-flush": d ? "true" : void 0, children: a }) : null,
    c ? /* @__PURE__ */ e("div", { className: "nim-panel__foot", children: c }) : null
  ] });
}
function rl({ actions: n, children: l, className: a, ...i }) {
  return /* @__PURE__ */ r("div", { className: v("nim-toolbar", a), role: "toolbar", ...i, children: [
    l ? /* @__PURE__ */ e("div", { className: "nim-toolbar__group", children: l }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-toolbar__actions", children: n }) : null
  ] });
}
function cl({
  className: n,
  delta: l,
  deltaDirection: a = "up",
  deltaIntent: i = "more-is-better",
  hint: t,
  icon: s,
  label: d,
  layout: c = "stacked",
  onClick: o,
  tone: m = "neutral",
  value: u,
  ...h
}) {
  const f = i === "more-is-better" ? a === "up" : a === "down";
  return /* @__PURE__ */ r(
    o ? "button" : "div",
    {
      className: v("nim-metric", o && "nim-metric--interactive", n),
      "data-layout": c === "stacked" ? void 0 : c,
      "data-tone": m === "neutral" ? void 0 : m,
      onClick: o,
      type: o ? "button" : void 0,
      ...h,
      children: [
        c === "inline" && s ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-metric__glyph", children: /* @__PURE__ */ e(T, { name: s, size: "sm" }) }) : null,
        /* @__PURE__ */ r("span", { className: "nim-metric__label", children: [
          c === "inline" ? null : s ? /* @__PURE__ */ e(T, { name: s, size: "xs" }) : null,
          d
        ] }),
        /* @__PURE__ */ e("span", { className: "nim-metric__value", children: u }),
        l || t ? /* @__PURE__ */ r("span", { className: "nim-metric__foot", children: [
          l ? /* @__PURE__ */ r("span", { className: "nim-metric__delta", "data-intent": f ? "good" : "bad", children: [
            /* @__PURE__ */ e(T, { name: a === "up" ? "trend-up" : "trend-down", size: "xs" }),
            l
          ] }) : null,
          t ? /* @__PURE__ */ e("span", { className: "nim-metric__hint", children: t }) : null
        ] }) : null
      ]
    }
  );
}
function ol({ children: n, className: l, columns: a = 4, dense: i = !1, ...t }) {
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
function dl({ className: n, columns: l = 2, items: a, ...i }) {
  return /* @__PURE__ */ e("dl", { className: v("nim-facts", n), "data-columns": l, ...i, children: a.map((t, s) => /* @__PURE__ */ r("div", { className: "nim-facts__item", children: [
    /* @__PURE__ */ e("dt", { className: "nim-facts__label", children: t.label }),
    /* @__PURE__ */ e("dd", { className: "nim-facts__value", "data-mono": t.mono ? "true" : void 0, children: t.value })
  ] }, t.key ?? s)) });
}
function ml({ align: n = "stretch", children: l, className: a, template: i = "halves", ...t }) {
  return /* @__PURE__ */ e("div", { className: v("nim-columns", a), "data-align": n === "start" ? "start" : void 0, "data-template": i, ...t, children: l });
}
function ul({ actions: n, className: l, description: a, icon: i, title: t, tone: s = "neutral", ...d }) {
  return /* @__PURE__ */ r("section", { className: v("nim-status-hero", l), "data-tone": s, ...d, children: [
    /* @__PURE__ */ e("span", { className: "nim-status-hero__mark", children: /* @__PURE__ */ e(T, { name: i, size: "xl" }) }),
    /* @__PURE__ */ r("div", { className: "nim-status-hero__copy", children: [
      /* @__PURE__ */ e("strong", { className: "nim-status-hero__title", children: t }),
      a ? /* @__PURE__ */ e("p", { className: "nim-status-hero__description", children: a }) : null
    ] }),
    n ? /* @__PURE__ */ e("div", { className: "nim-status-hero__actions", children: n }) : null
  ] });
}
function hl({
  children: n,
  className: l,
  copiedLabel: a = "Copied",
  copyLabel: i = "Copy",
  label: t,
  wrap: s = !1,
  ...d
}) {
  const [c, o] = E(!1), m = typeof navigator < "u" && !!navigator.clipboard, u = Z(() => {
    navigator.clipboard.writeText(n).then(() => {
      o(!0), window.setTimeout(() => o(!1), 1600);
    });
  }, [n]);
  return /* @__PURE__ */ r("figure", { className: v("nim-code", l), children: [
    t || m ? /* @__PURE__ */ r("figcaption", { className: "nim-code__head", children: [
      t ? /* @__PURE__ */ e("span", { className: "nim-code__label", children: t }) : /* @__PURE__ */ e("span", {}),
      m ? /* @__PURE__ */ r("button", { className: "nim-code__copy", onClick: u, type: "button", children: [
        /* @__PURE__ */ e(T, { name: c ? "check" : "copy", size: "xs" }),
        c ? a : i
      ] }) : null
    ] }) : null,
    /* @__PURE__ */ e("pre", { className: "nim-code__body", "data-wrap": s ? "true" : void 0, tabIndex: 0, ...d, children: n })
  ] });
}
function pl({ children: n, className: l, pulse: a = !1, tone: i = "neutral", ...t }) {
  return /* @__PURE__ */ r("span", { className: v("nim-status", l), "data-tone": i, ...t, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-status__dot", "data-pulse": a ? "true" : void 0 }),
    n
  ] });
}
function _l({ children: n, className: l, size: a = "sm", ...i }) {
  return /* @__PURE__ */ e("code", { className: v("nim-mono", l), "data-size": a, ...i, children: n });
}
function fl({ className: n, href: l, meta: a, onClick: i, title: t }) {
  const s = /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ e("strong", { className: "nim-record__title", children: t }),
    a ? /* @__PURE__ */ e("span", { className: "nim-record__meta", children: a }) : null
  ] });
  return l ? /* @__PURE__ */ e("a", { className: v("nim-record", n), href: l, children: s }) : i ? /* @__PURE__ */ e("button", { className: v("nim-record", n), onClick: i, type: "button", children: s }) : /* @__PURE__ */ e("span", { className: v("nim-record", n), children: s });
}
function Nl({ actions: n, children: l, className: a, footer: i, title: t, ...s }) {
  return /* @__PURE__ */ r("section", { className: v("nim-rail", a), ...s, children: [
    /* @__PURE__ */ r("header", { className: "nim-rail__head", children: [
      /* @__PURE__ */ e("h2", { className: "nim-rail__title", children: t }),
      n ? /* @__PURE__ */ e("div", { className: "nim-rail__actions", children: n }) : null
    ] }),
    /* @__PURE__ */ e("div", { className: "nim-rail__body", children: l }),
    i ? /* @__PURE__ */ e("div", { className: "nim-rail__foot", children: i }) : null
  ] });
}
function bl({ children: n, className: l, meta: a, title: i, tone: t = "neutral", ...s }) {
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
function vl({
  children: n,
  className: l,
  copiedLabel: a = "Copied",
  copyLabel: i = "Copy",
  ...t
}) {
  const [s, d] = E(!1), c = typeof navigator < "u" && !!navigator.clipboard, o = Z(() => {
    navigator.clipboard.writeText(n).then(() => {
      d(!0), window.setTimeout(() => d(!1), 1600);
    });
  }, [n]);
  return /* @__PURE__ */ r("span", { className: v("nim-copy-chip", l), ...t, children: [
    /* @__PURE__ */ e("span", { className: "nim-copy-chip__value", children: n }),
    c ? /* @__PURE__ */ e(
      "button",
      {
        "aria-label": s ? a : `${i} ${n}`,
        className: "nim-copy-chip__button",
        onClick: o,
        type: "button",
        children: /* @__PURE__ */ e(T, { name: s ? "check" : "copy", size: "xs" })
      }
    ) : null
  ] });
}
function gl({ aside: n, children: l, className: a, ...i }) {
  return /* @__PURE__ */ r("div", { className: v("nim-detail", a), ...i, children: [
    /* @__PURE__ */ e("div", { className: "nim-detail__main", children: l }),
    n ? /* @__PURE__ */ e("aside", { className: "nim-detail__aside", children: n }) : null
  ] });
}
function yl({
  className: n,
  href: l,
  mark: a,
  name: i,
  nameAccent: t,
  size: s = "md",
  tagline: d,
  ...c
}) {
  const o = /* @__PURE__ */ r(H, { children: [
    a ? /* @__PURE__ */ e("span", { className: "nim-brand__mark", children: a }) : null,
    /* @__PURE__ */ r("span", { className: "nim-brand__text", children: [
      /* @__PURE__ */ r("strong", { className: "nim-brand__name", children: [
        i,
        t ? /* @__PURE__ */ e("span", { className: "nim-brand__name-accent", children: t }) : null
      ] }),
      d ? /* @__PURE__ */ e("small", { className: "nim-brand__tagline", children: d }) : null
    ] })
  ] }), m = v("nim-brand", n);
  return l ? /* @__PURE__ */ e("a", { className: m, "data-size": s, href: l, ...c, children: o }) : /* @__PURE__ */ e("span", { className: m, "data-size": s, ...c, children: o });
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
}, Aa = /* @__PURE__ */ new Set(["github", "gitlab", "mongodb"]), La = { lg: 32, md: 24, sm: 20 };
function kl({ className: n, label: l, name: a, size: i = "md", ...t }) {
  const s = Aa.has(a), d = La[i];
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
      style: { color: Da[a] },
      viewBox: "0 0 24 24",
      width: d,
      ...t,
      children: za[a]
    }
  );
}
function wl(n) {
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
  className: a,
  fullWidth: i = !1,
  iconEnd: t,
  iconStart: s,
  size: d = "md",
  variant: c = "primary",
  ...o
}, m) {
  const u = v(
    "nim-button",
    `nim-button--${c}`,
    `nim-button--${d}`,
    i && "nim-button--full",
    a
  ), h = /* @__PURE__ */ r(H, { children: [
    s ? /* @__PURE__ */ e(T, { name: s, size: "sm" }) : null,
    /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
    t ? /* @__PURE__ */ e(T, { name: t, size: "sm" }) : null
  ] });
  if ("href" in o && o.href !== void 0) {
    const { href: _, rel: w, target: y, ...D } = o;
    return /* @__PURE__ */ e(
      "a",
      {
        className: u,
        href: _,
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
    loading: p = !1,
    type: N = "button",
    ...g
  } = o;
  return /* @__PURE__ */ r(
    "button",
    {
      "aria-busy": p || void 0,
      className: v(u, p && "nim-button--loading"),
      disabled: f || p,
      ref: m,
      type: N,
      ...g,
      children: [
        p ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-button__spinner" }) : null,
        p ? /* @__PURE__ */ r(H, { children: [
          /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
          t ? /* @__PURE__ */ e(T, { name: t, size: "sm" }) : null
        ] }) : h
      ]
    }
  );
});
function $a({ actions: n, className: l, description: a, icon: i = "search", title: t, ...s }) {
  return /* @__PURE__ */ r("div", { className: v("nim-empty", l), ...s, children: [
    /* @__PURE__ */ e("span", { className: "nim-empty__icon", children: /* @__PURE__ */ e(T, { name: i, size: "md" }) }),
    /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: t }),
    a ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-empty__body", children: a }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-empty__actions", children: n }) : null
  ] });
}
const Ea = (n, l) => {
  if (l <= 7) return Array.from({ length: l }, (t, s) => s + 1);
  const a = /* @__PURE__ */ new Set([1, l, n, n - 1, n + 1]);
  n <= 3 && [2, 3, 4].forEach((t) => a.add(t)), n >= l - 2 && [l - 3, l - 2, l - 1].forEach((t) => a.add(t));
  const i = [...a].filter((t) => t >= 1 && t <= l).sort((t, s) => t - s);
  return i.flatMap((t, s) => s > 0 && t - i[s - 1] > 1 ? ["gap", t] : [t]);
};
function Ia({
  className: n,
  label: l = "Pagination",
  nextLabel: a = "Next page",
  onChange: i,
  page: t,
  pageCount: s,
  previousLabel: d = "Previous page",
  summary: c
}) {
  return /* @__PURE__ */ r("nav", { "aria-label": l, className: v("nim-pagination", n), children: [
    c ? /* @__PURE__ */ e("p", { className: "nim-pagination__summary", children: c }) : /* @__PURE__ */ e("span", {}),
    /* @__PURE__ */ r("div", { className: "nim-pagination__list", children: [
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": d,
          className: "nim-pagination__item",
          disabled: t <= 1,
          onClick: () => i(t - 1),
          type: "button",
          children: /* @__PURE__ */ e(T, { name: "chevron-back", size: "sm" })
        }
      ),
      Ea(t, s).map(
        (o, m) => o === "gap" ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-pagination__ellipsis", children: "…" }, `gap-${m}`) : /* @__PURE__ */ e(
          "button",
          {
            "aria-current": o === t ? "page" : void 0,
            className: "nim-pagination__item",
            onClick: () => i(o),
            type: "button",
            children: o
          },
          o
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
function Se({ caption: n, className: l, columns: a, onSort: i, rowKey: t, rows: s, sort: d }) {
  return /* @__PURE__ */ e("div", { className: v("nim-table-wrap", l), children: /* @__PURE__ */ r("table", { className: "nim-table", children: [
    n ? /* @__PURE__ */ e("caption", { className: "nim-caption", children: n }) : null,
    /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ e("tr", { children: a.map((c) => {
      const o = (d == null ? void 0 : d.key) === c.key ? d.direction : void 0;
      return /* @__PURE__ */ e(
        "th",
        {
          "aria-sort": o,
          className: v(c.numeric && "nim-table__cell--numeric"),
          scope: "col",
          style: c.width ? { inlineSize: c.width } : void 0,
          children: c.sortable && i ? /* @__PURE__ */ r("button", { className: "nim-table__sort", onClick: () => i(c.key), type: "button", children: [
            c.header,
            o ? /* @__PURE__ */ e(T, { name: o === "ascending" ? "chevron-up" : "chevron-down", size: "xs" }) : null
          ] }) : c.header
        },
        c.key
      );
    }) }) }),
    /* @__PURE__ */ e("tbody", { children: s.map((c) => /* @__PURE__ */ e("tr", { children: a.map((o) => /* @__PURE__ */ e("td", { className: v(o.numeric && "nim-table__cell--numeric"), children: o.render(c) }, o.key)) }, t(c))) })
  ] }) });
}
function De({ children: n, className: l, description: a, ...i }) {
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--checkbox", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", type: "checkbox", ...i }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-checkbox__box", children: /* @__PURE__ */ e(T, { name: "check", size: "xs" }) }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      a ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: a }) : null
    ] })
  ] });
}
function Ba({ children: n, className: l, description: a, ...i }) {
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--switch", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", role: "switch", type: "checkbox", ...i }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-switch__track", children: /* @__PURE__ */ e("span", { className: "nim-switch__thumb" }) }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      a ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: a }) : null
    ] })
  ] });
}
function Cl({ children: n, className: l, description: a, ...i }) {
  const t = xe(He);
  return /* @__PURE__ */ r("label", { className: v("nim-choice nim-choice--radio", l), children: [
    /* @__PURE__ */ e(
      "input",
      {
        ...i,
        checked: t ? t.value === i.value : i.checked,
        className: "nim-choice__input",
        name: (t == null ? void 0 : t.name) ?? i.name,
        onChange: (s) => {
          var d;
          t == null || t.onChange(s.target.value), (d = i.onChange) == null || d.call(i, s);
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
const He = Ce(null);
function xl({
  children: n,
  className: l,
  error: a,
  hint: i,
  label: t,
  layout: s = "stack",
  name: d,
  onChange: c,
  value: o
}) {
  const m = J(), u = d ?? `nim-radio-${m}`, h = i ? `${u}-hint` : void 0, f = a ? `${u}-error` : void 0;
  return /* @__PURE__ */ e(He.Provider, { value: { name: u, onChange: c, value: o }, children: /* @__PURE__ */ r(
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
function Ke({ className: n, label: l = "Loading", size: a = "md", ...i }) {
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
function Pa({ className: n, label: l, value: a, ...i }) {
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
function Fa({ className: n, height: l = "1em", radius: a, width: i = "100%", ...t }) {
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
const Ra = (n) => Array.from({ length: n }, (l, a) => ({ __skeleton: a })), Oa = {
  selectAll: "Select all rows",
  selectRow: "Select row"
};
function Ml({
  caption: n,
  className: l,
  columns: a,
  empty: i,
  error: t,
  labels: s,
  loading: d = !1,
  onPageChange: c,
  onRetry: o,
  onSort: m,
  page: u,
  pageCount: h,
  refreshing: f = !1,
  retryLabel: p = "Try again",
  rowKey: N,
  rows: g,
  selection: _,
  skeletonRows: w = 6,
  sort: y,
  summary: D,
  toolbar: I
}) {
  const k = { ...Oa, ...s }, x = g.length > 0 && _ ? g.every((C) => _.isSelected(C)) : !1, b = _ ? [
    {
      header: _.onToggleAll ? /* @__PURE__ */ e(
        De,
        {
          "aria-label": k.selectAll,
          checked: x,
          onChange: (C) => {
            var $;
            return ($ = _.onToggleAll) == null ? void 0 : $.call(_, C.currentTarget.checked);
          }
        }
      ) : /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: k.selectAll }),
      key: "__select",
      render: (C) => {
        var $;
        return /* @__PURE__ */ e(
          De,
          {
            "aria-label": (($ = _.label) == null ? void 0 : $.call(_, C)) ?? k.selectRow,
            checked: _.isSelected(C),
            onChange: (A) => _.onToggle(C, A.currentTarget.checked)
          }
        );
      },
      width: "2.5rem"
    },
    ...a
  ] : a;
  let S;
  return t ? S = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: /* @__PURE__ */ e(
    $a,
    {
      actions: o ? /* @__PURE__ */ e(X, { onClick: o, size: "sm", variant: "secondary", children: p }) : void 0,
      icon: "danger",
      title: t
    }
  ) }) : d ? S = /* @__PURE__ */ e(
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
  ) : g.length === 0 ? S = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: i }) : S = /* @__PURE__ */ e(
    Se,
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
    u && h && h > 1 && c ? /* @__PURE__ */ e(Ia, { onChange: c, page: u, pageCount: h, summary: D }) : D ? /* @__PURE__ */ e("p", { className: "nim-data-table__summary", children: D }) : null
  ] });
}
function Tl({
  className: n,
  defaultOpen: l = [],
  items: a,
  mode: i = "multiple",
  onOpenChange: t,
  open: s,
  variant: d = "panel"
}) {
  const c = J(), [o, m] = E(l), u = s ?? o, h = (f) => {
    const p = u.includes(f), N = i === "single" ? p ? [] : [f] : p ? u.filter((g) => g !== f) : [...u, f];
    s || m(N), t == null || t(N);
  };
  return /* @__PURE__ */ e("div", { className: v("nim-accordion", `nim-accordion--${d}`, n), children: a.map((f) => {
    const p = u.includes(f.id), N = `${c}-${f.id}`;
    return /* @__PURE__ */ r("div", { className: "nim-accordion__item", "data-open": p || void 0, children: [
      /* @__PURE__ */ r(
        "button",
        {
          "aria-controls": N,
          "aria-expanded": p,
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
              inert: !p,
              children: f.content
            }
          )
        }
      )
    ] }, f.id);
  }) });
}
function Ua({ className: n, items: l, label: a, renderItem: i, value: t }) {
  return /* @__PURE__ */ e("nav", { "aria-label": a, className: v("nim-tab-bar", n), children: /* @__PURE__ */ e("div", { className: "nim-tab-bar__row", style: { "--nim-tab-count": l.length }, children: l.map((s) => {
    const d = s.key === t, c = /* @__PURE__ */ r(H, { children: [
      /* @__PURE__ */ e(T, { name: s.icon, size: s.center ? "lg" : "md" }),
      /* @__PURE__ */ e("span", { className: "nim-tab-bar__label", children: s.label })
    ] }), o = {
      "aria-current": d ? "page" : void 0,
      "aria-label": s.fullLabel ?? s.label,
      className: v("nim-tab-bar__item", s.center && "nim-tab-bar__item--center"),
      "data-active": d ? "true" : void 0
    };
    return i ? /* @__PURE__ */ e("div", { className: "nim-tab-bar__slot", children: i(s, c, o) }, s.key) : s.href ? /* @__PURE__ */ e("a", { href: s.href, ...o, children: c }, s.key) : /* @__PURE__ */ e("button", { onClick: s.onSelect, type: "button", ...o, children: c }, s.key);
  }) }) });
}
function Sl({ children: n, className: l, frame: a = "responsive", header: i, tabs: t }) {
  return /* @__PURE__ */ r("div", { className: v("nim-app-shell", l), "data-frame": a === "phone" ? "phone" : void 0, children: [
    i ? /* @__PURE__ */ e("header", { className: "nim-app-shell__header", children: i }) : null,
    /* @__PURE__ */ e("main", { className: "nim-app-shell__content", "data-has-tabs": t ? "true" : void 0, children: n }),
    t ? /* @__PURE__ */ e(Ua, { ...t }) : null
  ] });
}
function Ne({
  action: n,
  back: l,
  brand: a,
  children: i,
  className: t,
  footer: s,
  subtitle: d,
  title: c
}) {
  return /* @__PURE__ */ r("section", { className: v("nim-auth", t), children: [
    a ? /* @__PURE__ */ e("div", { className: "nim-auth__brand", children: a }) : null,
    /* @__PURE__ */ r("div", { className: "nim-auth__body", children: [
      l ? /* @__PURE__ */ e(X, { className: "nim-auth__back", iconStart: "chevron-back", onClick: l.onClick, size: "sm", variant: "ghost", children: l.label }) : null,
      /* @__PURE__ */ e("h1", { className: "nim-auth__title", children: c }),
      d ? /* @__PURE__ */ e("p", { className: "nim-auth__subtitle", children: d }) : null,
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
const Ha = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((l) => {
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
        t ? /* @__PURE__ */ e("img", { alt: "", src: t }) : /* @__PURE__ */ e("span", { "aria-hidden": "true", children: Ha(l) }),
        /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: l })
      ]
    }
  );
}
function Dl({
  caption: n,
  className: l,
  initials: a,
  label: i,
  size: t = 96,
  src: s,
  value: d
}) {
  const c = Math.max(4, Math.round(t * 0.05)), o = (t - c) / 2, m = 2 * Math.PI * o, u = Math.min(100, Math.max(0, d)) / 100 * m;
  return /* @__PURE__ */ r(
    "div",
    {
      "aria-label": i,
      className: v("nim-avatar-ring", l),
      role: "img",
      style: { "--nim-ring-size": `${t}px`, "--nim-ring-stroke": `${c}px` },
      children: [
        /* @__PURE__ */ r("svg", { "aria-hidden": "true", className: "nim-avatar-ring__arc", viewBox: `0 0 ${t} ${t}`, children: [
          /* @__PURE__ */ e(
            "circle",
            {
              className: "nim-avatar-ring__track",
              cx: t / 2,
              cy: t / 2,
              fill: "none",
              r: o,
              strokeWidth: c
            }
          ),
          /* @__PURE__ */ e(
            "circle",
            {
              className: "nim-avatar-ring__fill",
              cx: t / 2,
              cy: t / 2,
              fill: "none",
              r: o,
              strokeDasharray: `${u} ${m}`,
              strokeLinecap: "round",
              strokeWidth: c
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
function Ka({
  actions: n,
  avatar: l,
  chips: a,
  className: i,
  eyebrow: t,
  name: s,
  stats: d = []
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
    d.length ? /* @__PURE__ */ e("dl", { className: "nim-profile-header__stats", children: d.map((c, o) => /* @__PURE__ */ r("div", { className: "nim-profile-header__stat", children: [
      /* @__PURE__ */ e("dt", { className: "nim-profile-header__stat-label", children: c.label }),
      /* @__PURE__ */ e("dd", { className: "nim-profile-header__stat-value", children: c.value })
    ] }, o)) }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-profile-header__actions", children: n }) : null
  ] });
}
function Ga({
  children: n,
  className: l,
  dot: a = !1,
  pill: i = !1,
  size: t = "md",
  tone: s = "soft",
  variant: d = "neutral",
  ...c
}) {
  return /* @__PURE__ */ r(
    "span",
    {
      className: v(
        "nim-badge",
        `nim-badge--${d}`,
        `nim-badge--${s}`,
        t === "sm" && "nim-badge--sm",
        i && "nim-badge--pill",
        l
      ),
      ...c,
      children: [
        a ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-badge__dot" }) : null,
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
  className: a,
  icon: i,
  title: t,
  tone: s = "neutral",
  ...d
}) {
  return /* @__PURE__ */ r(
    "div",
    {
      className: v("nim-banner", `nim-banner--${s}`, a),
      role: s === "danger" ? "alert" : "status",
      ...d,
      children: [
        /* @__PURE__ */ e(T, { className: "nim-banner__icon", name: i ?? Wa[s], size: "sm" }),
        /* @__PURE__ */ r("div", { className: "nim-banner__content", children: [
          t ? /* @__PURE__ */ e("p", { className: "nim-banner__title", children: t }) : null,
          /* @__PURE__ */ e("div", { children: l })
        ] }),
        n ? /* @__PURE__ */ e("div", { className: "nim-banner__action", children: n }) : null
      ]
    }
  );
}
function zl({ className: n, items: l, label: a = "Breadcrumb" }) {
  return /* @__PURE__ */ e("nav", { "aria-label": a, className: v("nim-breadcrumb", n), children: l.map((i, t) => {
    const s = t === l.length - 1;
    return /* @__PURE__ */ r(ke, { children: [
      t > 0 ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-breadcrumb__separator", children: /* @__PURE__ */ e(T, { name: "chevron-forward", size: "xs" }) }) : null,
      s || !i.href ? /* @__PURE__ */ e("span", { "aria-current": s ? "page" : void 0, className: "nim-breadcrumb__current", children: i.label }) : /* @__PURE__ */ e("a", { className: "nim-breadcrumb__link", href: i.href, children: i.label })
    ] }, i.label);
  }) });
}
function Al({
  as: n = "article",
  children: l,
  className: a,
  footer: i,
  header: t,
  interactive: s = !1,
  padding: d = "md",
  variant: c = "default",
  ...o
}) {
  return /* @__PURE__ */ r(
    n,
    {
      className: v(
        "nim-card",
        `nim-card--${c}`,
        `nim-card--pad-${d}`,
        s && "nim-card--interactive",
        a
      ),
      ...o,
      children: [
        t ? /* @__PURE__ */ e("div", { className: "nim-card__header", children: t }) : null,
        l,
        i ? /* @__PURE__ */ e("div", { className: "nim-card__footer", children: i }) : null
      ]
    }
  );
}
function Ll({
  badge: n,
  className: l,
  description: a,
  detail: i,
  disabled: t = !1,
  icon: s,
  name: d,
  onSelect: c,
  selected: o,
  title: m
}) {
  return /* @__PURE__ */ r("label", { className: v("nim-option-card", o && "nim-option-card--selected", l), children: [
    /* @__PURE__ */ e(
      "input",
      {
        checked: o,
        className: "nim-option-card__input",
        disabled: t,
        name: d,
        onChange: c,
        type: "radio"
      }
    ),
    s ? /* @__PURE__ */ e("span", { className: "nim-option-card__icon", children: /* @__PURE__ */ e(T, { name: s, size: "md" }) }) : null,
    /* @__PURE__ */ r("span", { className: "nim-option-card__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-option-card__title", children: m }),
      a ? /* @__PURE__ */ e("span", { className: "nim-option-card__description", children: a }) : null,
      o && i ? /* @__PURE__ */ e("span", { className: "nim-option-card__detail", children: i }) : null
    ] }),
    n ? /* @__PURE__ */ e("span", { className: "nim-option-card__badge", children: n }) : null,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-option-card__dot" })
  ] });
}
function $l({ className: n, items: l, title: a, totals: i = [] }) {
  return /* @__PURE__ */ r("section", { className: v("nim-summary", n), children: [
    a ? /* @__PURE__ */ e("h2", { className: "nim-summary__title", children: a }) : null,
    /* @__PURE__ */ e("dl", { className: "nim-summary__lines", children: l.map((t) => /* @__PURE__ */ r("div", { className: "nim-summary__line", children: [
      /* @__PURE__ */ r("dt", { children: [
        /* @__PURE__ */ e("span", { className: "nim-summary__label", children: t.label }),
        t.meta ? /* @__PURE__ */ e("span", { className: "nim-summary__meta", children: t.meta }) : null
      ] }),
      /* @__PURE__ */ e("dd", { className: "nim-summary__value", children: t.value })
    ] }, t.key)) }),
    i.length ? /* @__PURE__ */ r(H, { children: [
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
function El({ action: n, className: l, note: a, total: i }) {
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
function Ge(n, l, { onDismiss: a, open: i }) {
  const [t, s] = E({ left: 0, top: 0 }), d = O(null), c = Z(() => {
    const o = n.current, m = l.current;
    if (!o || !m) return;
    const u = o.getBoundingClientRect(), { height: h, width: f } = m.getBoundingClientRect(), p = 4, N = 8, g = getComputedStyle(o).direction === "rtl", _ = u.bottom + p, y = _ + h > window.innerHeight && u.top - p - h > 0 ? u.top - p - h : _, D = g ? u.right - f : u.left, I = Math.min(Math.max(D, N), window.innerWidth - f - N);
    s({ left: I, top: y });
  }, [l, n]);
  return en(() => {
    i && c();
  }, [i, c]), j(() => {
    if (!i) return;
    d.current = document.activeElement;
    const o = (u) => {
      u.key === "Escape" && (u.stopPropagation(), a());
    }, m = (u) => {
      var f, p;
      const h = u.target;
      (f = l.current) != null && f.contains(h) || (p = n.current) != null && p.contains(h) || a();
    };
    return window.addEventListener("keydown", o), window.addEventListener("pointerdown", m), window.addEventListener("resize", c), window.addEventListener("scroll", c, !0), () => {
      var u, h;
      window.removeEventListener("keydown", o), window.removeEventListener("pointerdown", m), window.removeEventListener("resize", c), window.removeEventListener("scroll", c, !0), (h = (u = d.current) == null ? void 0 : u.focus) == null || h.call(u);
    };
  }, [a, i, l, c, n]), t;
}
const Ya = (n) => n.kind === void 0 || n.kind === "action";
function ze({ children: n, className: l, items: a, label: i }) {
  const [t, s] = E(!1), [d, c] = E(0), o = O(null), m = O(null), u = Ge(o, m, { onDismiss: () => s(!1), open: t }), f = a.filter(Ya).filter((_) => !_.disabled), p = () => {
    c(0), s((_) => !_);
  }, N = (_) => {
    s(!1), _.onSelect();
  }, g = (_) => {
    if (f.length !== 0) {
      if (_.key === "ArrowDown" || _.key === "ArrowUp") {
        _.preventDefault();
        const w = _.key === "ArrowDown" ? 1 : -1;
        c((y) => (y + w + f.length) % f.length);
      }
      if (_.key === "Home" && (_.preventDefault(), c(0)), _.key === "End" && (_.preventDefault(), c(f.length - 1)), _.key === "Enter" || _.key === " ") {
        _.preventDefault();
        const w = f[d];
        w && N(w);
      }
    }
  };
  return /* @__PURE__ */ r(H, { children: [
    n({ open: t, ref: o, toggle: p }),
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
          children: a.map((_, w) => _.kind === "separator" ? /* @__PURE__ */ e("hr", { className: "nim-menu__separator" }, `sep-${w}`) : _.kind === "heading" ? /* @__PURE__ */ e("p", { className: "nim-menu__label", children: _.label }, `head-${w}`) : /* @__PURE__ */ r(
            "button",
            {
              className: v("nim-menu__item", _.danger && "nim-menu__item--danger"),
              "data-active": f.indexOf(_) === d ? "true" : void 0,
              disabled: _.disabled,
              onClick: () => N(_),
              onPointerEnter: () => c(f.indexOf(_)),
              role: "menuitem",
              type: "button",
              children: [
                _.icon ? /* @__PURE__ */ e(T, { className: "nim-menu__icon", name: _.icon, size: "sm" }) : null,
                /* @__PURE__ */ e("span", { children: _.label }),
                _.shortcut ? /* @__PURE__ */ e("span", { className: "nim-menu__shortcut", children: _.shortcut }) : null
              ]
            },
            _.label
          ))
        }
      ),
      document.body
    ) : null
  ] });
}
function ja({ children: n, className: l, label: a, onClose: i, open: t, triggerRef: s }) {
  const d = O(null), c = Ge(s, d, { onDismiss: i, open: t });
  return !t || typeof document > "u" ? null : he(
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": a,
        className: v("nim-popover", l),
        ref: d,
        role: "dialog",
        style: { insetBlockStart: c.top, insetInlineStart: c.left },
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
  const a = ["B", "KB", "MB", "GB"];
  let i = n, t = 0;
  for (; i >= Ae && t < a.length - 1; )
    i /= Ae, t += 1;
  return `${new Intl.NumberFormat(l, { maximumFractionDigits: t === 0 ? 0 : 1 }).format(i)} ${a[t]}`;
}
function We(n, l) {
  const a = new Intl.NumberFormat(l, { minimumIntegerDigits: 2, useGrouping: !1 }), i = Math.max(0, Math.round(n));
  return `${new Intl.NumberFormat(l).format(Math.floor(i / 60))}:${a.format(i % 60)}`;
}
const ce = (n) => {
  const l = new Date(n);
  return new Date(l.getFullYear(), l.getMonth(), l.getDate()).getTime();
};
function Ja({
  attachment: n,
  labels: l,
  locale: a
}) {
  const i = O(null), [t, s] = E(!1), [d, c] = E(0), o = n.duration ?? 0, m = Y(
    () => n.waveform ?? Array.from({ length: 32 }, (h, f) => 0.35 + f * 7 % 11 / 18),
    [n.waveform]
  ), u = o > 0 ? Math.min(1, d / o) : 0;
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
    /* @__PURE__ */ e("span", { className: "nim-chat-voice__time", children: We(t || d ? Math.max(0, o - d) : o, a) }),
    /* @__PURE__ */ e(
      "audio",
      {
        onEnded: () => {
          s(!1), c(0);
        },
        onPause: () => s(!1),
        onPlay: () => s(!0),
        onTimeUpdate: (h) => c(h.currentTarget.currentTime),
        preload: "metadata",
        ref: i,
        src: n.url
      }
    )
  ] });
}
function ei({
  attachment: n,
  labels: l,
  locale: a
}) {
  return n.kind === "voice" ? /* @__PURE__ */ e(Ja, { attachment: n, labels: l, locale: a }) : n.kind === "video" ? /* @__PURE__ */ r("figure", { className: "nim-chat-media", children: [
    /* @__PURE__ */ e("video", { controls: !0, playsInline: !0, poster: n.poster, preload: "metadata", src: n.url }),
    n.duration ? /* @__PURE__ */ e("figcaption", { className: "nim-chat-media__meta", children: We(n.duration, a) }) : null
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
          n.size !== void 0 ? /* @__PURE__ */ e("span", { className: "nim-chat-file__size", children: Xa(n.size, a) }) : null
        ] }),
        /* @__PURE__ */ e(T, { className: "nim-chat-file__action", name: "download", size: "sm" })
      ]
    }
  );
}
function ni({
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
function Il({
  actions: n,
  className: l,
  composer: a,
  footer: i,
  group: t = !1,
  header: s,
  labels: d,
  locale: c,
  messages: o,
  onJump: m,
  onReact: u,
  reactions: h = qa,
  runGap: f = 300,
  typing: p
}) {
  const N = { ...Va, ...d }, g = O(null), _ = O(!0), w = Y(
    () => new Intl.DateTimeFormat(c, { hour: "2-digit", minute: "2-digit" }),
    [c]
  ), y = Y(
    () => new Intl.DateTimeFormat(c, { day: "numeric", month: "long", weekday: "long" }),
    [c]
  ), D = Y(() => {
    const I = ce((/* @__PURE__ */ new Date()).toISOString());
    return o.map((k, x) => {
      const b = o[x - 1], S = o[x + 1], C = k.at ? ce(k.at) : null, $ = b != null && b.at ? ce(b.at) : null, A = C !== null && C !== $ ? C === I ? N.today : C === I - Qa ? N.yesterday : y.format(new Date(k.at)) : null, L = (P, M) => {
        var F, W;
        return !!P && !(P != null && P.system) && !M.system && !!(P != null && P.own) == !!M.own && ((F = P == null ? void 0 : P.author) == null ? void 0 : F.name) === ((W = M.author) == null ? void 0 : W.name);
      }, B = (P, M) => !(P != null && P.at) || !M.at || Math.abs(new Date(M.at).getTime() - new Date(P.at).getTime()) <= f * 1e3, K = A !== null || !L(b, k) || !B(b, k), G = !S || (S.at ? ce(S.at) : null) !== C || !L(S, k) || !B(k, S);
      return { divider: A, first: K, last: G, message: k };
    });
  }, [y, o, f, N.today, N.yesterday]);
  return j(() => {
    const I = g.current;
    !I || !_.current || (I.scrollTop = I.scrollHeight);
  }, [o, p]), /* @__PURE__ */ r("section", { className: v("nim-chat", l), children: [
    s ? /* @__PURE__ */ e("header", { className: "nim-chat__header", children: s }) : null,
    /* @__PURE__ */ r(
      "div",
      {
        className: "nim-chat__scroll",
        onScroll: (I) => {
          const k = I.currentTarget;
          _.current = k.scrollHeight - k.scrollTop - k.clientHeight < 48;
        },
        ref: g,
        children: [
          /* @__PURE__ */ e("ol", { "aria-live": "polite", className: "nim-chat__list", children: D.map(({ divider: I, first: k, last: x, message: b }) => {
            var $, A;
            if (b.system)
              return /* @__PURE__ */ r(ke, { children: [
                I ? /* @__PURE__ */ e("li", { className: "nim-chat__day", children: I }) : null,
                /* @__PURE__ */ e("li", { className: "nim-chat__system", children: b.text })
              ] }, b.id);
            const S = (n == null ? void 0 : n(b)) ?? [], C = k && !b.own && (t || !!b.author);
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
                            ($ = b.attachments) == null ? void 0 : $.map((L, B) => /* @__PURE__ */ e(
                              ei,
                              {
                                attachment: L,
                                labels: N,
                                locale: c
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
                              items: h.map((L) => ({
                                label: L,
                                onSelect: () => u(b, L)
                              })),
                              label: N.react,
                              children: ({ ref: L, toggle: B }) => /* @__PURE__ */ e(
                                U,
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
                          S.length > 0 ? /* @__PURE__ */ e(ze, { items: S, label: N.more, children: ({ ref: L, toggle: B }) => /* @__PURE__ */ e(
                            U,
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
                      (A = b.reactions) != null && A.length ? /* @__PURE__ */ e(ni, { labels: N, message: b, onReact: u }) : null,
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
          p ? /* @__PURE__ */ r("p", { className: "nim-chat__typing", children: [
            typeof p == "string" ? `${p} ${N.typing}` : N.typing,
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
  className: l,
  composer: a,
  empty: i,
  labels: t,
  onCopy: s,
  onRate: d,
  onRetry: c,
  onStop: o,
  turns: m
}) {
  const u = { ...ai, ...t }, h = O(null), f = O(!0), [p, N] = E(null), g = m.some((_) => _.streaming);
  return j(() => {
    const _ = h.current;
    !_ || !f.current || (_.scrollTop = _.scrollHeight);
  }, [m]), /* @__PURE__ */ r("section", { className: v("nim-assistant", l), children: [
    /* @__PURE__ */ r(
      "div",
      {
        className: "nim-assistant__scroll",
        onScroll: (_) => {
          const w = _.currentTarget;
          f.current = w.scrollHeight - w.scrollTop - w.clientHeight < 48;
        },
        ref: h,
        children: [
          m.length === 0 && i ? /* @__PURE__ */ e("div", { className: "nim-assistant__empty", children: i }) : null,
          /* @__PURE__ */ e("ol", { "aria-live": "polite", className: "nim-assistant__list", children: m.map((_) => {
            var w, y;
            return /* @__PURE__ */ r("li", { className: "nim-turn", "data-role": _.role, children: [
              /* @__PURE__ */ e("span", { className: "nim-turn__mark", children: _.role === "assistant" ? /* @__PURE__ */ e("span", { className: "nim-turn__badge", children: /* @__PURE__ */ e(T, { name: (n == null ? void 0 : n.icon) ?? "sparkle", size: "sm" }) }) : null }),
              /* @__PURE__ */ r("div", { className: "nim-turn__body", children: [
                /* @__PURE__ */ e("span", { className: "nim-turn__who", children: _.role === "assistant" ? (n == null ? void 0 : n.name) ?? u.assistant : u.you }),
                (w = _.steps) != null && w.length ? /* @__PURE__ */ r("div", { className: "nim-turn__steps", children: [
                  /* @__PURE__ */ r(
                    "button",
                    {
                      "aria-expanded": p === _.id,
                      className: "nim-turn__steps-toggle",
                      onClick: () => N(p === _.id ? null : _.id),
                      type: "button",
                      children: [
                        /* @__PURE__ */ e(T, { name: p === _.id ? "chevron-down" : "chevron-forward", size: "xs" }),
                        u.steps,
                        /* @__PURE__ */ e("span", { className: "nim-turn__steps-count", children: _.steps.length })
                      ]
                    }
                  ),
                  /* @__PURE__ */ e(
                    "ul",
                    {
                      className: "nim-turn__step-list",
                      hidden: p !== _.id,
                      inert: p !== _.id,
                      children: _.steps.map((D) => /* @__PURE__ */ r("li", { className: "nim-turn__step", "data-status": D.status, children: [
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
                /* @__PURE__ */ e("div", { className: "nim-turn__content", "data-streaming": _.streaming ? "true" : void 0, children: _.content }),
                (y = _.sources) != null && y.length ? /* @__PURE__ */ r("ul", { className: "nim-turn__sources", children: [
                  /* @__PURE__ */ e("li", { className: "nim-turn__sources-label", children: u.sources }),
                  _.sources.map((D, I) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r("a", { className: "nim-turn__source", href: D.href, rel: "noreferrer", target: "_blank", children: [
                    /* @__PURE__ */ e("span", { className: "nim-turn__source-index", children: I + 1 }),
                    D.title
                  ] }) }, I))
                ] }) : null,
                _.role === "assistant" && !_.streaming && (s || c || d) ? /* @__PURE__ */ r("div", { className: "nim-turn__actions", children: [
                  s ? /* @__PURE__ */ e(U, { label: u.copy, name: "copy", onClick: () => s(_), size: "sm" }) : null,
                  c ? /* @__PURE__ */ e(U, { label: u.retry, name: "refresh", onClick: () => c(_), size: "sm" }) : null,
                  d ? /* @__PURE__ */ r(H, { children: [
                    /* @__PURE__ */ e(U, { label: u.up, name: "trend-up", onClick: () => d(_, "up"), size: "sm" }),
                    /* @__PURE__ */ e(U, { label: u.down, name: "trend-down", onClick: () => d(_, "down"), size: "sm" })
                  ] }) : null
                ] }) : null
              ] })
            ] }, _.id);
          }) }),
          g && o ? /* @__PURE__ */ e("div", { className: "nim-assistant__stop", children: /* @__PURE__ */ r("button", { className: "nim-assistant__stop-button", onClick: o, type: "button", children: [
            /* @__PURE__ */ e(T, { name: "stop", size: "sm" }),
            u.stop
          ] }) }) : null
        ]
      }
    ),
    a ? /* @__PURE__ */ e("div", { className: "nim-assistant__composer", children: a }) : null
  ] });
}
const be = 600, Le = 8, ii = (n, l) => {
  const a = n / Math.max(1, l), i = 10 ** Math.floor(Math.log10(a || 1)), t = a / i;
  return (t > 5 ? 10 : t > 2 ? 5 : t > 1 ? 2 : 1) * i;
};
function Pl({
  categories: n,
  className: l,
  format: a,
  height: i = 220,
  kind: t = "line",
  legend: s,
  locale: d,
  max: c,
  min: o,
  note: m,
  series: u,
  title: h
}) {
  const f = J(), [p, N] = E(null), g = Y(
    () => a ?? ((b) => new Intl.NumberFormat(d).format(b)),
    [a, d]
  ), _ = Y(() => {
    const b = u.flatMap((P) => P.values).filter((P) => P !== null), S = o ?? Math.min(...b, 0), C = c ?? Math.max(...b, 0), $ = t === "bar" ? Math.min(0, S) : S, A = C === $ ? $ + 1 : C, L = ii(A - $, 4), B = Math.floor($ / L) * L, K = Math.ceil(A / L) * L, G = [];
    for (let P = B; P <= K + L / 2; P += L) G.push(Number(P.toFixed(6)));
    return { bottom: B, ticks: G, top: K };
  }, [t, c, o, u]), w = i - Le * 2, y = (b) => Le + w - (b - _.bottom) / (_.top - _.bottom) * w, D = be / Math.max(1, n.length), I = (b) => D * b + D / 2, k = (b, S) => {
    let C = "", $ = !1;
    if (b.forEach((K, G) => {
      if (K === null) {
        $ = !1;
        return;
      }
      C += `${$ ? "L" : "M"}${I(G).toFixed(2)} ${y(K).toFixed(2)}`, $ = !0;
    }), !S || !C) return C;
    const A = b.map((K, G) => K === null ? null : G).filter((K) => K !== null), L = A[0], B = A[A.length - 1];
    return `${C}L${I(B).toFixed(2)} ${y(_.bottom).toFixed(2)}L${I(L).toFixed(2)} ${y(_.bottom).toFixed(2)}Z`;
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
          /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-chart__axis", children: [..._.ticks].reverse().map((b) => /* @__PURE__ */ e("span", { className: "nim-chart__tick", children: g(b) }, b)) }),
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
                  _.ticks.map((b) => /* @__PURE__ */ e(
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
                      ($, A) => $ === null ? null : /* @__PURE__ */ e(
                        "rect",
                        {
                          className: "nim-chart__bar",
                          fill: C,
                          height: Math.abs(y($) - y(Math.max(_.bottom, 0))),
                          width: x,
                          x: I(A) - x * u.length / 2 + x * S,
                          y: Math.min(y($), y(Math.max(_.bottom, 0)))
                        },
                        A
                      )
                    ) }, b.label) : /* @__PURE__ */ r("g", { children: [
                      t === "area" ? /* @__PURE__ */ e("path", { className: "nim-chart__area", d: k(b.values, !0), fill: C }) : null,
                      /* @__PURE__ */ e("path", { className: "nim-chart__line", d: k(b.values, !1), stroke: C }),
                      b.values.map(
                        ($, A) => $ === null ? null : /* @__PURE__ */ e(
                          "circle",
                          {
                            className: "nim-chart__dot",
                            cx: I(A),
                            cy: y($),
                            "data-on": p === A ? "true" : void 0,
                            fill: C,
                            r: 4
                          },
                          A
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
                  "data-on": p === S ? "true" : void 0,
                  onBlur: () => N(null),
                  onFocus: () => N(S),
                  onMouseEnter: () => N(S),
                  onMouseLeave: () => N(null),
                  type: "button",
                  children: /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: b })
                },
                S
              )),
              p !== null ? /* @__PURE__ */ r(
                "div",
                {
                  className: "nim-chart__tip",
                  style: { insetInlineStart: `${(p + 0.5) / n.length * 100}%` },
                  children: [
                    /* @__PURE__ */ e("span", { className: "nim-chart__tip-label", children: n[p] }),
                    u.map((b, S) => /* @__PURE__ */ r("span", { className: "nim-chart__tip-row", children: [
                      /* @__PURE__ */ e("i", { style: { background: `var(--nim-series-${b.series ?? S % 6 + 1})` } }),
                      /* @__PURE__ */ e("span", { className: "nim-chart__tip-name", children: b.label }),
                      /* @__PURE__ */ e("span", { className: "nim-chart__tip-value", children: b.values[p] === null ? "—" : g(b.values[p]) })
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
function Fl({ className: n, label: l, series: a = 1, values: i }) {
  const t = Math.min(...i), d = Math.max(...i) - t || 1, c = i.map((o, m) => {
    const u = m / Math.max(1, i.length - 1) * 100, h = 24 - (o - t) / d * 20 - 2;
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
        /* @__PURE__ */ e("path", { d: c, stroke: `var(--nim-series-${a})` })
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
  const a = new Date(n), i = /* @__PURE__ */ new Date(), t = new Date(i.getFullYear(), i.getMonth(), i.getDate()).getTime();
  return a.getTime() >= t ? new Intl.DateTimeFormat(l, { hour: "2-digit", minute: "2-digit" }).format(a) : a.getTime() >= t - 6 * 864e5 ? new Intl.DateTimeFormat(l, { weekday: "short" }).format(a) : new Intl.DateTimeFormat(l, { day: "numeric", month: "short" }).format(a);
}
function si({
  activeId: n,
  className: l,
  labels: a,
  locale: i,
  onSelect: t,
  sections: s
}) {
  const d = { ...Ze, ...a }, c = new Intl.NumberFormat(i);
  return /* @__PURE__ */ e("div", { className: v("nim-rooms", l), children: s.map((o) => /* @__PURE__ */ r("section", { className: "nim-rooms__section", children: [
    /* @__PURE__ */ e("p", { className: "nim-rooms__label", children: o.label }),
    /* @__PURE__ */ e("ul", { className: "nim-rooms__list", children: o.items.map((m) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r(
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
                m.muted ? /* @__PURE__ */ e(T, { className: "nim-room__mute", label: d.muted, name: "volume-off", size: "xs" }) : null
              ] }),
              m.at ? /* @__PURE__ */ e("span", { className: "nim-room__at", children: ti(m.at, i) }) : null
            ] }),
            /* @__PURE__ */ r("span", { className: "nim-room__bottom", children: [
              /* @__PURE__ */ e("span", { className: "nim-room__preview", "data-typing": m.typing ? "true" : void 0, children: m.typing ?? m.preview }),
              m.unread ? /* @__PURE__ */ r(Ga, { size: "sm", tone: "solid", variant: m.muted ? "neutral" : "accent", children: [
                c.format(m.unread),
                /* @__PURE__ */ r("span", { className: "nim-visually-hidden", children: [
                  " ",
                  d.unread
                ] })
              ] }) : m.members ? /* @__PURE__ */ r("span", { className: "nim-room__members", children: [
                /* @__PURE__ */ e(T, { name: li[m.kind], size: "xs" }),
                c.format(m.members)
              ] }) : null
            ] })
          ] })
        ]
      }
    ) }, m.id)) })
  ] }, o.key)) });
}
function Rl({
  activeId: n,
  brand: l,
  children: a,
  className: i,
  labels: t,
  locale: s,
  onBack: d,
  onCompose: c,
  onSelect: o,
  search: m,
  sections: u
}) {
  const h = { ...Ze, ...t };
  return /* @__PURE__ */ r("div", { className: v("nim-messenger", i), "data-open": n ? "true" : void 0, children: [
    /* @__PURE__ */ r("aside", { "aria-label": h.channels, className: "nim-messenger__rail", children: [
      /* @__PURE__ */ r("div", { className: "nim-messenger__rail-head", children: [
        l,
        c ? /* @__PURE__ */ e(U, { label: h.compose, name: "plus", onClick: c, size: "sm", variant: "outline" }) : null
      ] }),
      m ? /* @__PURE__ */ e("div", { className: "nim-messenger__search", children: m }) : null,
      /* @__PURE__ */ e("div", { className: "nim-messenger__rail-scroll", children: /* @__PURE__ */ e(
        si,
        {
          activeId: n,
          labels: t,
          locale: s,
          onSelect: o,
          sections: u
        }
      ) })
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-messenger__thread", children: [
      d ? /* @__PURE__ */ e(
        U,
        {
          className: "nim-messenger__back",
          label: h.back,
          name: "chevron-back",
          onClick: d,
          size: "sm"
        }
      ) : null,
      a
    ] })
  ] });
}
function Ol({ actions: n, avatar: l, className: a, kind: i = "direct", members: t, meta: s, name: d }) {
  return /* @__PURE__ */ r("div", { className: v("nim-room-head", a), children: [
    i === "channel" ? /* @__PURE__ */ e("span", { className: "nim-room__glyph", children: /* @__PURE__ */ e(T, { name: "hash", size: "sm" }) }) : /* @__PURE__ */ e(de, { name: d, size: "md", src: l }),
    /* @__PURE__ */ r("div", { className: "nim-room-head__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-room-head__name", children: d }),
      s ? /* @__PURE__ */ e("span", { className: "nim-room-head__meta", children: s }) : null
    ] }),
    t != null && t.length ? /* @__PURE__ */ e("ul", { className: "nim-facepile", children: t.slice(0, 6).map((c) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ e(de, { name: c.name, size: "sm", src: c.avatar }) }, c.name)) }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-room-head__actions", children: n }) : null
  ] });
}
const ri = {
  map: "Map",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out"
}, ve = (n) => {
  const a = Math.max(-85.05112878, Math.min(85.05112878, n)) * Math.PI / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + a / 2)) / (2 * Math.PI);
}, ci = (n, l) => {
  const a = l.west, i = l.east < l.west ? l.east + 360 : l.east, t = n.lng < a ? n.lng + 360 : n.lng, s = ve(l.north), d = ve(l.south);
  return {
    x: (t - a) / (i - a) * 100,
    y: (ve(n.lat) - s) / (d - s) * 100
  };
};
function Ul({
  attribution: n,
  bounds: l,
  className: a,
  controls: i,
  labels: t,
  markers: s = [],
  onSelect: d,
  onZoom: c,
  ratio: o = 16 / 10,
  tiles: m,
  title: u
}) {
  const h = { ...ri, ...t }, f = J();
  return /* @__PURE__ */ r(
    "section",
    {
      "aria-labelledby": f,
      className: v("nim-map", a),
      style: { aspectRatio: `${o}` },
      children: [
        /* @__PURE__ */ e("h3", { className: "nim-visually-hidden", id: f, children: u }),
        /* @__PURE__ */ e("div", { className: "nim-map__tiles", children: m }),
        /* @__PURE__ */ e("ul", { className: "nim-map__markers", children: s.map((p) => {
          const N = ci(p, l), g = { insetBlockStart: `${N.y}%`, insetInlineStart: `${N.x}%` };
          return /* @__PURE__ */ e("li", { className: "nim-map__marker", "data-self": p.self ? "true" : void 0, style: g, children: d ? /* @__PURE__ */ r("button", { className: "nim-map__pin", "data-tone": p.tone, onClick: () => d(p), type: "button", children: [
            p.self ? /* @__PURE__ */ e("span", { className: "nim-map__dot" }) : /* @__PURE__ */ e(T, { name: "globe", size: "sm" }),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: p.label })
          ] }) : /* @__PURE__ */ r("span", { className: "nim-map__pin", "data-tone": p.tone, children: [
            p.self ? /* @__PURE__ */ e("span", { className: "nim-map__dot" }) : /* @__PURE__ */ e(T, { name: "globe", size: "sm" }),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: p.label })
          ] }) }, p.id);
        }) }),
        c || i ? /* @__PURE__ */ r("div", { className: "nim-map__controls", children: [
          i,
          c ? /* @__PURE__ */ r(H, { children: [
            /* @__PURE__ */ e(U, { label: h.zoomIn, name: "plus", onClick: () => c(1), size: "sm", variant: "solid" }),
            /* @__PURE__ */ e(U, { label: h.zoomOut, name: "minus", onClick: () => c(-1), size: "sm", variant: "solid" })
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
  const a = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0, i = new Intl.NumberFormat(l, { minimumIntegerDigits: 2, useGrouping: !1 }), t = new Intl.NumberFormat(l), s = Math.floor(a / 3600), d = Math.floor(a % 3600 / 60), c = a % 60;
  return s > 0 ? `${t.format(s)}:${i.format(d)}:${i.format(c)}` : `${t.format(d)}:${i.format(c)}`;
}
function Hl({
  autoPlay: n = !1,
  className: l,
  kind: a = "audio",
  labels: i,
  locale: t,
  onError: s,
  poster: d,
  rates: c = [1, 1.5, 2],
  src: o,
  title: m,
  waveform: u
}) {
  const h = { ...oi, ...i }, f = O(null), p = O(null), [N, g] = E(!1), [_, w] = E(0), [y, D] = E(0), [I, k] = E(0), [x, b] = E(n), [S, C] = E(1), [$, A] = E(1), L = y > 0 ? _ / y : 0, B = Y(() => u ?? null, [u]), K = Z(() => {
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
      ref: p,
      children: [
        a === "video" ? /* @__PURE__ */ r("div", { className: "nim-player__stage", children: [
          /* @__PURE__ */ e(
            "video",
            {
              autoPlay: n,
              className: "nim-player__video",
              muted: n,
              playsInline: !0,
              poster: d,
              preload: "metadata",
              ref: (M) => {
                f.current = M;
              },
              src: o,
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
            src: o,
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
                  "data-played": F / B.length <= L ? "true" : void 0,
                  style: { blockSize: `${Math.max(8, Math.round(M * 100))}%` }
                },
                F
              )) }) : /* @__PURE__ */ r(H, { children: [
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__buffer", style: { inlineSize: `${y ? I / y * 100 : 0}%` } }),
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__played", style: { inlineSize: `${L * 100}%` } })
              ] }),
              /* @__PURE__ */ e(
                "input",
                {
                  "aria-label": h.seek,
                  "aria-valuetext": `${oe(_, t)} / ${oe(y, t)}`,
                  className: "nim-player__seek",
                  max: y || 0,
                  min: 0,
                  onChange: (M) => {
                    const F = Number(M.target.value);
                    w(F), f.current && (f.current.currentTime = F);
                  },
                  step: "any",
                  type: "range",
                  value: _
                }
              )
            ] }),
            /* @__PURE__ */ r("span", { className: "nim-player__times", children: [
              /* @__PURE__ */ e("time", { children: oe(_, t) }),
              /* @__PURE__ */ e("time", { children: oe(y, t) })
            ] })
          ] }),
          /* @__PURE__ */ r("div", { className: "nim-player__side", children: [
            c.length > 1 ? /* @__PURE__ */ r(
              "button",
              {
                "aria-label": h.rate,
                className: "nim-player__rate",
                onClick: () => A(c[(c.indexOf($) + 1) % c.length] ?? 1),
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
                  document.fullscreenElement ? document.exitFullscreen() : (F = (M = p.current) == null ? void 0 : M.requestFullscreen) == null || F.call(M);
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
  allow: l,
  className: a,
  disabled: i = !1,
  labels: t,
  onCancelReply: s,
  onFiles: d,
  onSend: c,
  onTyping: o,
  placeholder: m,
  replyTo: u
}) {
  const h = { ...di, ...t }, f = { file: !0, video: !0, voice: !0, ...l }, [p, N] = E(""), [g, _] = E([]), [w, y] = E(!1), [D, I] = E(0), [k] = E(mi), x = O([]), b = O(null), S = O(null), C = O(null), $ = O(0), A = O([]), L = O(null), B = Z(() => {
    var z;
    (z = C.current) == null || z.stream.getTracks().forEach((R) => R.stop()), C.current = null;
  }, []);
  j(() => B, [B]), j(() => {
    var z;
    u && ((z = L.current) == null || z.focus());
  }, [u]), j(() => {
    if (!w) return;
    const z = window.setInterval(() => I((Date.now() - $.current) / 1e3), 200);
    return () => window.clearInterval(z);
  }, [w]);
  const K = Z(
    (z) => {
      if (!(z != null && z.length)) return;
      const R = Array.from(z);
      x.current = [...x.current, ...R], _((q) => [
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
      A.current = [], R.ondataavailable = (q) => {
        q.data.size && A.current.push(q.data);
      }, R.onstop = () => {
        const q = new Blob(A.current, { type: R.mimeType }), Q = new File([q], "voice-message", { type: R.mimeType });
        x.current = [...x.current, Q], _((re) => [
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
    _((R) => (URL.revokeObjectURL(R[z].url), R.filter((q, Q) => Q !== z))), x.current = x.current.filter((R, q) => q !== z);
  }, F = () => {
    var z;
    !p.trim() && g.length === 0 || (c({ attachments: g, text: p.trim() }), d == null || d(x.current), x.current = [], _([]), N(""), (z = L.current) == null || z.focus());
  }, W = !p.trim() && g.length === 0;
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
    ] }) : /* @__PURE__ */ r(H, { children: [
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
            N(z.target.value), o == null || o();
          },
          onKeyDown: (z) => {
            z.key === "Enter" && !z.shiftKey && (z.preventDefault(), F());
          },
          placeholder: m,
          ref: L,
          rows: 1,
          value: p
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
  className: l,
  disabled: a = !1,
  icon: i,
  onClick: t,
  onRemove: s,
  removeLabel: d = "Remove",
  selected: c = !1,
  tone: o = "neutral"
}) {
  const m = !!t;
  return /* @__PURE__ */ r(
    "span",
    {
      className: v("nim-chip", m && "nim-chip--interactive", l),
      "data-selected": c || void 0,
      "data-tone": o === "neutral" ? void 0 : o,
      children: [
        m ? /* @__PURE__ */ r(
          "button",
          {
            "aria-pressed": c,
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
            "aria-label": d,
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
function Gl({
  className: n,
  disabled: l = !1,
  error: a,
  hint: i,
  label: t,
  onChange: s,
  placeholder: d,
  removeLabel: c = "Remove",
  separators: o = ["Enter", ",", "Tab"],
  validate: m,
  values: u
}) {
  const [h, f] = E(""), p = () => {
    const g = h.trim();
    if (g && !(m && !m(g))) {
      if (u.includes(g)) {
        f("");
        return;
      }
      s([...u, g]), f("");
    }
  }, N = (g) => {
    if (o.includes(g.key)) {
      if (g.key === "Tab" && !h.trim()) return;
      g.preventDefault(), p();
      return;
    }
    g.key === "Backspace" && !h && u.length > 0 && s(u.slice(0, -1));
  };
  return /* @__PURE__ */ r("div", { className: v("nim-field", a && "nim-field--invalid", n), children: [
    t ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: t }) : null,
    /* @__PURE__ */ r("div", { className: "nim-chip-input", "data-disabled": l || void 0, children: [
      u.map((g) => /* @__PURE__ */ e(
        hi,
        {
          disabled: l,
          onRemove: () => s(u.filter((_) => _ !== g)),
          removeLabel: `${c} ${g}`,
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
          onBlur: p,
          onChange: (g) => f(g.target.value),
          onKeyDown: N,
          placeholder: u.length === 0 ? d : void 0,
          value: h
        }
      )
    ] }),
    a ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: a }) : null,
    i && !a ? /* @__PURE__ */ e("p", { className: "nim-field__hint", children: i }) : null
  ] });
}
function Wl({ className: n, layout: l = "rows", rows: a }) {
  return /* @__PURE__ */ e("dl", { className: v("nim-data-list", `nim-data-list--${l}`, n), children: a.map((i) => /* @__PURE__ */ r("div", { className: "nim-data-list__row", children: [
    /* @__PURE__ */ e("dt", { className: "nim-data-list__label", children: i.label }),
    /* @__PURE__ */ e("dd", { className: v("nim-data-list__value", i.mono && "nim-data-list__value--mono"), children: i.value ?? /* @__PURE__ */ e("span", { className: "nim-data-list__empty", children: "—" }) })
  ] }, i.id)) });
}
function Zl({
  className: n,
  commands: l,
  emptyLabel: a = (c) => `Nothing matches “${c}”.`,
  label: i,
  onClose: t,
  open: s,
  placeholder: d = "Search…"
}) {
  const c = O(null), o = O(null), m = O(null), [u, h] = E(""), [f, p] = E(0), N = Y(() => pi(l, u), [l, u]), g = N.filter((k) => !k.disabled), _ = g[Math.min(f, Math.max(g.length - 1, 0))];
  j(() => {
    var x;
    const k = c.current;
    k && (s && !k.open && (k.showModal(), (x = m.current) == null || x.focus()), !s && k.open && k.close());
  }, [s]), j(() => {
    const k = c.current;
    if (!k) return;
    const x = () => {
      h(""), p(0), t();
    };
    return k.addEventListener("close", x), () => k.removeEventListener("close", x);
  }, [t]), j(() => {
    var k, x;
    (x = (k = o.current) == null ? void 0 : k.querySelector('[data-active="true"]')) == null || x.scrollIntoView({ block: "nearest" });
  }, [f, u]);
  const w = (k) => {
    !k || k.disabled || (t(), k.onRun());
  }, y = (k) => {
    g.length && (k.key === "ArrowDown" ? (k.preventDefault(), p((x) => (x + 1) % g.length)) : k.key === "ArrowUp" ? (k.preventDefault(), p((x) => (x - 1 + g.length) % g.length)) : k.key === "Home" ? (k.preventDefault(), p(0)) : k.key === "End" ? (k.preventDefault(), p(g.length - 1)) : k.key === "Enter" && (k.preventDefault(), w(_)));
  }, D = !u.trim();
  let I;
  return /* @__PURE__ */ r(
    "dialog",
    {
      "aria-label": i,
      className: v("nim-palette", n),
      onClick: (k) => {
        k.target === c.current && t();
      },
      ref: c,
      children: [
        /* @__PURE__ */ r("div", { className: "nim-palette__field", children: [
          /* @__PURE__ */ e(T, { name: "search", size: "sm" }),
          /* @__PURE__ */ e(
            "input",
            {
              "aria-activedescendant": _ ? `${_.id}-palette-row` : void 0,
              "aria-autocomplete": "list",
              "aria-controls": "nim-palette-list",
              "aria-expanded": !0,
              "aria-label": i,
              autoComplete: "off",
              className: "nim-palette__input",
              onChange: (k) => {
                h(k.target.value), p(0);
              },
              onKeyDown: y,
              placeholder: d,
              role: "combobox",
              spellCheck: !1,
              ref: m,
              value: u
            }
          )
        ] }),
        /* @__PURE__ */ e("div", { className: "nim-palette__list", id: "nim-palette-list", ref: o, role: "listbox", children: N.length ? N.map((k) => {
          const x = D && k.group && k.group !== I ? k.group : void 0;
          I = k.group;
          const b = k === _;
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
                  S >= 0 && S !== f && p(S);
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
function pi(n, l) {
  const a = l.trim().toLowerCase();
  if (!a) return n;
  const i = [];
  for (const t of n) {
    const s = t.label.toLowerCase(), d = `${t.group ?? ""} ${t.keywords ?? ""}`.toLowerCase(), c = s.startsWith(a) ? 0 : s.includes(` ${a}`) ? 1 : s.includes(a) ? 2 : d.includes(a) ? 3 : -1;
    c >= 0 && i.push({ command: t, rank: c });
  }
  return i.sort((t, s) => t.rank - s.rank).map((t) => t.command);
}
function ee({ children: n, className: l, error: a, hint: i, id: t, label: s, required: d }) {
  const c = J(), o = t ?? `nim-${c}`, m = i ? `${o}-hint` : void 0, u = a ? `${o}-error` : void 0, h = [u, m].filter(Boolean).join(" ") || void 0;
  return /* @__PURE__ */ r("div", { className: v("nim-field", a && "nim-field--invalid", l), children: [
    s ? /* @__PURE__ */ r("label", { className: "nim-field__label", htmlFor: o, children: [
      s,
      d ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    n({ control: o, describedBy: h }),
    a ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: u, children: a }) : null,
    i && !a ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: m, children: i }) : null
  ] });
}
function Yl({ children: n, ...l }) {
  return /* @__PURE__ */ e(ee, { ...l, children: () => n });
}
function _i({ className: n, error: l, hint: a, iconEnd: i, iconStart: t, id: s, label: d, required: c, ...o }) {
  return /* @__PURE__ */ e(ee, { error: l, hint: a, id: s, label: d, required: c, children: ({ control: m, describedBy: u }) => /* @__PURE__ */ r(
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
            required: c,
            ...o
          }
        ),
        i ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(T, { name: i, size: "sm" }) }) : null
      ]
    }
  ) });
}
function jl({ className: n, error: l, hint: a, id: i, label: t, required: s, rows: d = 4, ...c }) {
  return /* @__PURE__ */ e(ee, { error: l, hint: a, id: i, label: t, required: s, children: ({ control: o, describedBy: m }) => /* @__PURE__ */ e(
    "textarea",
    {
      "aria-describedby": m,
      "aria-invalid": l ? !0 : void 0,
      className: v("nim-textarea", n),
      id: o,
      required: s,
      rows: d,
      ...c
    }
  ) });
}
function Vl({
  className: n,
  error: l,
  hint: a,
  id: i,
  label: t,
  options: s,
  placeholder: d,
  required: c,
  ...o
}) {
  return /* @__PURE__ */ e(ee, { error: l, hint: a, id: i, label: t, required: c, children: ({ control: m, describedBy: u }) => /* @__PURE__ */ r("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
    /* @__PURE__ */ r(
      "select",
      {
        "aria-describedby": u,
        "aria-invalid": l ? !0 : void 0,
        className: v("nim-select", n),
        id: m,
        required: c,
        ...o,
        children: [
          d ? /* @__PURE__ */ e("option", { value: "", disabled: !0, children: d }) : null,
          s.map((h) => /* @__PURE__ */ e("option", { disabled: h.disabled, value: h.value, children: h.label }, h.value))
        ]
      }
    ),
    /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(T, { name: "chevron-down", size: "sm" }) })
  ] }) });
}
function ql({
  ariaLabel: n,
  className: l,
  emptyState: a,
  error: i,
  hint: t,
  id: s,
  label: d,
  onChange: c,
  options: o,
  placeholder: m,
  required: u,
  value: h
}) {
  const f = J(), p = o.find((C) => C.value === h) ?? null, [N, g] = E(""), [_, w] = E(!1), [y, D] = E(0), I = O(null), k = Y(() => {
    const C = N.trim().toLowerCase();
    return C ? o.filter(($) => $.label.toLowerCase().includes(C)) : o;
  }, [o, N]), x = (C) => {
    c(C.value), g(""), w(!1);
  }, b = (C) => {
    if (C.key === "Escape") {
      g(""), w(!1);
      return;
    }
    if (!_ && (C.key === "ArrowDown" || C.key === "ArrowUp")) {
      w(!0);
      return;
    }
    if (C.key === "ArrowDown" || C.key === "ArrowUp") {
      C.preventDefault();
      const $ = C.key === "ArrowDown" ? 1 : -1, A = k.filter((L) => !L.disabled);
      if (A.length === 0) return;
      D((L) => (L + $ + A.length) % A.length);
    }
    if (C.key === "Enter") {
      const A = k.filter((L) => !L.disabled)[y];
      A && (C.preventDefault(), x(A));
    }
  }, S = k.filter((C) => !C.disabled);
  return /* @__PURE__ */ e(ee, { className: l, error: i, hint: t, id: s, label: d, required: u, children: ({ control: C, describedBy: $ }) => /* @__PURE__ */ r("div", { className: "nim-combobox", children: [
    /* @__PURE__ */ r("div", { className: v("nim-input-shell", "nim-input-shell--has-end"), children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-label": n ?? d,
          "aria-autocomplete": "list",
          "aria-controls": _ ? f : void 0,
          "aria-describedby": $,
          "aria-expanded": _,
          className: "nim-input",
          id: C,
          onBlur: () => window.setTimeout(() => w(!1), 120),
          onChange: (A) => {
            g(A.target.value), D(0), w(!0);
          },
          onFocus: () => w(!0),
          onKeyDown: b,
          placeholder: m,
          ref: I,
          role: "combobox",
          value: _ ? N : (p == null ? void 0 : p.label) ?? ""
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(T, { name: "chevron-down", size: "sm" }) })
    ] }),
    _ ? /* @__PURE__ */ e("div", { className: "nim-combobox__list", id: f, role: "listbox", children: S.length === 0 ? /* @__PURE__ */ e("div", { className: "nim-combobox__empty", children: a ? a(N) : `Nothing matches “${N}”.` }) : k.map((A) => /* @__PURE__ */ r(
      "button",
      {
        "aria-selected": S.indexOf(A) === y,
        className: "nim-combobox__option",
        disabled: A.disabled,
        onClick: () => x(A),
        onPointerEnter: () => D(S.indexOf(A)),
        role: "option",
        type: "button",
        children: [
          /* @__PURE__ */ e("span", { children: A.label }),
          A.meta ? /* @__PURE__ */ e("span", { className: "nim-combobox__meta", children: A.meta }) : null
        ]
      },
      A.value
    )) }) : null
  ] }) });
}
const Ye = Ce(null);
function Ql({
  children: n,
  className: l,
  defaultColorway: a = "vermilion",
  defaultScheme: i = "light",
  defaultStyle: t = "ledger",
  direction: s = "ltr",
  locale: d,
  syncDocument: c = !0
}) {
  const [o, m] = E(t), [u, h] = E(a), [f, p] = E(i);
  j(() => {
    if (!c || typeof document > "u") return;
    const g = document.documentElement;
    g.dataset.nimStyle = o, g.dataset.nimColorway = u, f === "system" ? delete g.dataset.nimScheme : g.dataset.nimScheme = f, g.dir = s, d && (g.lang = d);
  }, [u, s, d, f, o, c]);
  const N = Y(
    () => ({ colorway: u, direction: s, locale: d, scheme: f, setColorway: h, setScheme: p, setStyle: m, style: o }),
    [u, s, d, f, o]
  );
  return /* @__PURE__ */ e(Ye.Provider, { value: N, children: /* @__PURE__ */ e(
    "div",
    {
      className: v("nim-root", l),
      "data-nim-colorway": u,
      "data-nim-scheme": f === "system" ? void 0 : f,
      "data-nim-style": o,
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
function Xl() {
  const { scheme: n, setScheme: l } = pe();
  return Z(() => l(n === "dark" ? "light" : "dark"), [n, l]);
}
const me = 864e5, fi = Date.UTC(622, 2, 22), Ni = 365.2422, ie = (n) => n.toISOString().slice(0, 10), le = (n) => /* @__PURE__ */ new Date(`${n}T00:00:00Z`), _e = () => ie(/* @__PURE__ */ new Date()), bi = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
  year: "numeric"
});
function ne(n, l) {
  const a = le(n);
  if (l === "gregory")
    return { day: a.getUTCDate(), month: a.getUTCMonth() + 1, year: a.getUTCFullYear() };
  const i = bi.formatToParts(a), t = (s) => {
    var d;
    return Number(((d = i.find((c) => c.type === s)) == null ? void 0 : d.value) ?? "0");
  };
  return { day: t("day"), month: t("month"), year: t("year") };
}
const $e = (n) => n.year * 1e4 + n.month * 100 + n.day;
function te(n, l) {
  if (l === "gregory")
    return ie(new Date(Date.UTC(n.year, n.month - 1, n.day)));
  const a = Math.floor((n.year - 1) * Ni) + (n.month <= 7 ? (n.month - 1) * 31 : 186 + (n.month - 7) * 30) + n.day - 1;
  let i = new Date(fi + a * me);
  const t = $e(n);
  for (let s = 0; s < 40; s += 1) {
    const d = ne(ie(i), "persian"), c = $e(d);
    if (c === t) break;
    const o = (n.year - d.year) * 365 + (n.month - d.month) * 30 + (n.day - d.day);
    i = new Date(i.getTime() + (o === 0 ? c < t ? 1 : -1 : o) * me);
  }
  return ie(i);
}
function vi(n, l) {
  const a = ne(n, l);
  return te({ ...a, day: 1 }, l);
}
function Ee(n, l, a) {
  const i = ne(n, a), t = i.year * 12 + (i.month - 1) + l, s = Math.floor(t / 12), d = t % 12 + 1, c = je(s, d, a);
  return te({ day: Math.min(i.day, c), month: d, year: s }, a);
}
function je(n, l, a) {
  const i = le(te({ day: 1, month: l, year: n }, a)).getTime(), t = l === 12 ? 1 : l + 1, s = l === 12 ? n + 1 : n, d = le(te({ day: 1, month: t, year: s }, a)).getTime();
  return Math.round((d - i) / me);
}
const ge = (n, l) => ie(new Date(le(n).getTime() + l * me)), gi = (n) => le(n).getUTCDay();
function yi(n, l) {
  const a = n ?? "en";
  return a.includes("-u-ca-") || a.includes("-u-") ? a : `${a}-u-ca-${l}`;
}
const Me = (n) => n != null && n.startsWith("fa") ? "persian" : "gregory", ki = (n) => n === "persian" ? 6 : 1, Ie = /* @__PURE__ */ new Map();
function wi(n) {
  const l = n ?? "en", a = Ie.get(l);
  if (a) return a;
  const i = new Intl.NumberFormat(l, { useGrouping: !1 }), t = Array.from({ length: 10 }, (s, d) => i.format(d));
  return Ie.set(l, t), t;
}
function we(n, l, a) {
  const i = ne(n, a), t = wi(l), s = (d, c = 1) => String(d).padStart(c, "0").replace(/\d/g, (o) => t[Number(o)]);
  return `${s(i.year)}/${s(i.month, 2)}/${s(i.day, 2)}`;
}
function Ci(n, l) {
  const i = xi(n).match(/\d+/g);
  if (!i || i.length < 3) return null;
  const [t, s, d] = i.map(Number);
  if (s < 1 || s > 12 || d < 1 || d > je(t, s, l)) return null;
  const c = te({ day: d, month: s, year: t }, l), o = ne(c, l);
  return o.year === t && o.month === s && o.day === d ? c : null;
}
function xi(n) {
  let l = "";
  for (const a of n) {
    const i = a.codePointAt(0) ?? 0;
    i >= 1776 && i <= 1785 ? l += String.fromCodePoint(i - 1776 + 48) : i >= 1632 && i <= 1641 ? l += String.fromCodePoint(i - 1632 + 48) : l += a;
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
  max: a,
  min: i,
  month: t,
  onMonthChange: s,
  onSelect: d,
  system: c,
  value: o,
  weekStart: m
}) {
  const { locale: u } = pe(), h = c ?? Me(u), f = m ?? ki(h), p = _e(), N = yi(u, h), g = Y(
    () => new Intl.DateTimeFormat(N, { month: "long", timeZone: "UTC", year: "numeric" }),
    [N]
  ), _ = Y(() => new Intl.NumberFormat(u), [u]), w = Y(
    () => new Intl.DateTimeFormat(N, { timeZone: "UTC", weekday: "short" }),
    [N]
  ), y = vi(t, h), D = ne(y, h).month, I = Y(() => {
    const x = (gi(y) - f + 7) % 7, b = ge(y, -x);
    return Array.from({ length: 42 }, (S, C) => {
      const $ = ge(b, C), A = ne($, h);
      return { date: $, day: A.day, outside: A.month !== D };
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
          "aria-selected": x.date === o,
          className: v(
            "nim-calendar__day",
            x.outside && "nim-calendar__day--outside",
            x.date === p && "nim-calendar__day--today",
            l.includes(x.date) && "nim-calendar__day--marked"
          ),
          disabled: i !== void 0 && x.date < i || a !== void 0 && x.date > a,
          onClick: () => d(x.date),
          role: "gridcell",
          type: "button",
          children: _.format(x.day)
        },
        x.date
      ))
    ] })
  ] });
}
function qe({
  calendar: n,
  describedBy: l,
  id: a,
  invalid: i,
  locale: t,
  onChange: s,
  value: d
}) {
  const [c, o] = E(null);
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
        value: d
      }
    );
  const m = c ?? (d ? we(d, t, n) : "");
  return /* @__PURE__ */ e(
    "input",
    {
      "aria-describedby": l,
      "aria-invalid": i ? !0 : void 0,
      className: "nim-input",
      dir: "ltr",
      id: a,
      inputMode: "numeric",
      onBlur: () => o(null),
      onChange: (u) => {
        o(u.target.value);
        const h = Ci(u.target.value, n);
        h ? s(h) : u.target.value.trim() === "" && s("");
      },
      placeholder: we(_e(), t, n),
      type: "text",
      value: m
    }
  );
}
function Jl({
  error: n,
  hint: l,
  id: a,
  label: i,
  onChange: t,
  required: s,
  value: d,
  ...c
}) {
  const { locale: o } = pe(), m = c.system ?? Me(o), [u, h] = E(d || _e());
  return /* @__PURE__ */ e(ee, { error: n, hint: l, id: a, label: i, required: s, children: ({ control: f, describedBy: p }) => /* @__PURE__ */ r("div", { className: "nim-stack nim-stack--tight", children: [
    /* @__PURE__ */ e(
      qe,
      {
        calendar: m,
        describedBy: p,
        id: f,
        invalid: !!n,
        locale: o,
        onChange: (N) => {
          t(N), N && h(N);
        },
        value: d
      }
    ),
    /* @__PURE__ */ e(
      Ve,
      {
        ...c,
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
function et({
  error: n,
  hint: l,
  id: a,
  label: i,
  labels: t,
  onChange: s,
  required: d,
  showEquivalent: c,
  value: o,
  ...m
}) {
  const { locale: u } = pe(), h = m.system ?? Me(u), [f, p] = E(!1), [N, g] = E(o || _e()), _ = O(null), w = { clear: "Clear date", open: "Open calendar", ...t }, y = c ?? h === "persian", D = h === "persian" ? "gregory" : "persian";
  return /* @__PURE__ */ e(ee, { error: n, hint: l, id: a, label: i, required: d, children: ({ control: I, describedBy: k }) => /* @__PURE__ */ r("div", { className: "nim-date-picker", children: [
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
          value: o
        }
      ),
      o ? /* @__PURE__ */ e(
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
          onClick: () => p((x) => !x),
          ref: _,
          size: "sm"
        }
      )
    ] }),
    y && o ? /* @__PURE__ */ r("p", { className: "nim-date-picker__equivalent", children: [
      /* @__PURE__ */ e(T, { name: "calendar", size: "xs" }),
      /* @__PURE__ */ e("span", { dir: D === "gregory" ? "ltr" : void 0, children: we(o, u, D) })
    ] }) : null,
    /* @__PURE__ */ e(
      ja,
      {
        label: i ?? w.open,
        onClose: () => p(!1),
        open: f,
        triggerRef: _,
        children: /* @__PURE__ */ e(
          Ve,
          {
            ...m,
            month: N,
            onMonthChange: g,
            onSelect: (x) => {
              s(x), g(x), p(!1);
            },
            system: h,
            value: o
          }
        )
      }
    )
  ] }) });
}
function nt({
  children: n,
  className: l,
  closeLabel: a = "Close",
  description: i,
  dismissible: t = !0,
  footer: s,
  onClose: d,
  open: c,
  title: o
}) {
  const m = O(null);
  return j(() => {
    const u = m.current;
    u && (c && !u.open && u.showModal(), !c && u.open && u.close());
  }, [c]), j(() => {
    const u = m.current;
    if (!u || t) return;
    const h = (f) => f.preventDefault();
    return u.addEventListener("cancel", h), () => u.removeEventListener("cancel", h);
  }, [t]), j(() => {
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
            /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: o }),
            i ? /* @__PURE__ */ e("p", { className: "nim-caption", children: i }) : null
          ] }),
          t ? /* @__PURE__ */ e(U, { label: a, name: "close", onClick: d, size: "sm" }) : null
        ] }),
        /* @__PURE__ */ e("div", { className: "nim-dialog__body", children: n }),
        s ? /* @__PURE__ */ e("div", { className: "nim-dialog__footer", children: s }) : null
      ]
    }
  );
}
function at({
  className: n,
  detail: l,
  label: a,
  percent: i,
  tone: t = "accent",
  value: s,
  ...d
}) {
  const c = typeof i == "number", o = Math.min(100, Math.max(0, i ?? 0)), m = typeof a == "string" ? a : void 0;
  return /* @__PURE__ */ r("div", { className: v("nim-resource-meter", n), "data-tone": t, ...d, children: [
    /* @__PURE__ */ r("div", { className: "nim-resource-meter__head", children: [
      /* @__PURE__ */ e("span", { className: "nim-resource-meter__label", children: a }),
      /* @__PURE__ */ e("span", { className: "nim-resource-meter__value", children: s })
    ] }),
    c ? /* @__PURE__ */ e(
      "div",
      {
        "aria-label": m,
        "aria-valuemax": 100,
        "aria-valuemin": 0,
        "aria-valuenow": o,
        className: "nim-resource-meter__track",
        role: "meter",
        children: /* @__PURE__ */ e("span", { className: "nim-resource-meter__fill", style: { inlineSize: `${o}%` } })
      }
    ) : null,
    l ? /* @__PURE__ */ e("span", { className: "nim-resource-meter__detail", children: l }) : null
  ] });
}
function it({
  accept: n,
  caption: l,
  className: a,
  disabled: i = !1,
  error: t,
  label: s,
  multiple: d = !1,
  onFiles: c,
  prompt: o
}) {
  const m = O(0), [u, h] = E(!1), f = (p) => {
    p.preventDefault(), p.stopPropagation();
  };
  return /* @__PURE__ */ r("div", { className: v("nim-field", t && "nim-field--invalid", a), children: [
    /* @__PURE__ */ r(
      "label",
      {
        className: "nim-file-drop",
        "data-over": u || void 0,
        "data-disabled": i || void 0,
        onDragEnter: (p) => {
          f(p), m.current += 1, i || h(!0);
        },
        onDragLeave: (p) => {
          f(p), m.current -= 1, m.current <= 0 && h(!1);
        },
        onDragOver: f,
        onDrop: (p) => {
          if (f(p), m.current = 0, h(!1), i) return;
          const N = Array.from(p.dataTransfer.files);
          N.length > 0 && c(d ? N : N.slice(0, 1));
        },
        children: [
          /* @__PURE__ */ e(
            "input",
            {
              accept: n,
              className: "nim-choice__input",
              disabled: i,
              multiple: d,
              onChange: (p) => {
                const N = Array.from(p.target.files ?? []);
                N.length > 0 && c(N), p.target.value = "";
              },
              type: "file"
            }
          ),
          /* @__PURE__ */ e(T, { className: "nim-file-drop__icon", name: "upload", size: "lg" }),
          /* @__PURE__ */ e("span", { className: "nim-file-drop__label", children: s }),
          o ? /* @__PURE__ */ e("span", { className: "nim-file-drop__prompt", children: o }) : null,
          l ? /* @__PURE__ */ e("span", { className: "nim-file-drop__caption", children: l }) : null
        ]
      }
    ),
    t ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: t }) : null
  ] });
}
function lt({ children: n, className: l, ...a }) {
  return /* @__PURE__ */ e("div", { className: v("nim-app-frame", l), ...a, children: n });
}
function tt({
  as: n = "div",
  children: l,
  className: a,
  gap: i = "md",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-stack", i !== "md" && `nim-stack--${i}`, a), ...t, children: l });
}
function st({
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
function Mi({ children: n, className: l, plain: a = !1, ...i }) {
  return /* @__PURE__ */ e("div", { className: v("nim-list", a && "nim-list--plain", l), ...i, children: n });
}
function Ti({
  className: n,
  href: l,
  leading: a,
  onClick: i,
  rel: t,
  subtitle: s,
  target: d,
  title: c,
  trailing: o,
  ...m
}) {
  const u = !!(l || i), h = /* @__PURE__ */ r(H, { children: [
    a ? /* @__PURE__ */ e("span", { className: "nim-list-row__leading", children: a }) : null,
    /* @__PURE__ */ r("span", { className: "nim-list-row__content", children: [
      /* @__PURE__ */ e("span", { className: "nim-list-row__title", children: c }),
      s ? /* @__PURE__ */ e("span", { className: "nim-list-row__subtitle", children: s }) : null
    ] }),
    o ? /* @__PURE__ */ e("span", { className: "nim-list-row__trailing", children: o }) : null,
    u && !o ? /* @__PURE__ */ e(T, { className: "nim-list-row__chevron", name: "chevron-forward", size: "sm" }) : null
  ] }), f = v("nim-list-row", u && "nim-list-row--interactive", n);
  return l ? /* @__PURE__ */ e(
    "a",
    {
      className: f,
      href: l,
      rel: d === "_blank" ? t ?? "noreferrer" : t,
      target: d,
      ...m,
      children: h
    }
  ) : i ? /* @__PURE__ */ e("button", { className: f, onClick: i, type: "button", ...m, children: h }) : /* @__PURE__ */ e("div", { className: f, ...m, children: h });
}
const Si = {
  back: "Back",
  dot: (n) => `Slide ${n + 1}`
};
function rt({
  brand: n,
  className: l,
  finishLabel: a,
  footnote: i,
  labels: t,
  nextLabel: s,
  onDone: d,
  onSkip: c,
  onStep: o,
  skipLabel: m,
  slides: u
}) {
  var w;
  const [h, f] = E(0), p = { ...Si, ...t }, N = u[Math.min(h, u.length - 1)], g = h === u.length - 1, _ = Z(
    (y) => {
      f(y), o == null || o(y);
    },
    [o]
  );
  return /* @__PURE__ */ r("section", { className: v("nim-onboarding", l), children: [
    /* @__PURE__ */ r("header", { className: "nim-onboarding__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-onboarding__brand", children: n }),
      m ? /* @__PURE__ */ e(
        X,
        {
          iconEnd: "chevron-forward",
          onClick: c ?? d,
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
          "aria-label": p.dot(D),
          className: "nim-onboarding__dot",
          onClick: () => _(D),
          type: "button"
        },
        y.id
      )) }),
      /* @__PURE__ */ r("div", { className: "nim-onboarding__cta", children: [
        h > 0 ? /* @__PURE__ */ e(
          U,
          {
            label: p.back,
            name: "chevron-back",
            onClick: () => _(h - 1),
            size: "lg",
            variant: "outline"
          }
        ) : null,
        /* @__PURE__ */ e(
          X,
          {
            fullWidth: !0,
            iconEnd: g ? "arrow-forward" : void 0,
            onClick: () => g ? d() : _(h + 1),
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
const Di = "AD:376 AE:971 AF:93 AG:1268 AI:1264 AL:355 AM:374 AO:244 AQ:672 AR:54 AS:1684 AT:43 AU:61 AW:297 AX:358 AZ:994 BA:387 BB:1246 BD:880 BE:32 BF:226 BG:359 BH:973 BI:257 BJ:229 BL:590 BM:1441 BN:673 BO:591 BQ:599 BR:55 BS:1242 BT:975 BW:267 BY:375 BZ:501 CA:1 CC:61 CD:243 CF:236 CG:242 CH:41 CI:225 CK:682 CL:56 CM:237 CN:86 CO:57 CR:506 CU:53 CV:238 CW:599 CX:61 CY:357 CZ:420 DE:49 DJ:253 DK:45 DM:1767 DO:1809 DZ:213 EC:593 EE:372 EG:20 EH:212 ER:291 ES:34 ET:251 FI:358 FJ:679 FK:500 FM:691 FO:298 FR:33 GA:241 GB:44 GD:1473 GE:995 GF:594 GG:44 GH:233 GI:350 GL:299 GM:220 GN:224 GP:590 GQ:240 GR:30 GT:502 GU:1671 GW:245 GY:592 HK:852 HN:504 HR:385 HT:509 HU:36 ID:62 IE:353 IL:972 IM:44 IN:91 IO:246 IQ:964 IR:98 IS:354 IT:39 JE:44 JM:1876 JO:962 JP:81 KE:254 KG:996 KH:855 KI:686 KM:269 KN:1869 KP:850 KR:82 KW:965 KY:1345 KZ:7 LA:856 LB:961 LC:1758 LI:423 LK:94 LR:231 LS:266 LT:370 LU:352 LV:371 LY:218 MA:212 MC:377 MD:373 ME:382 MF:590 MG:261 MH:692 MK:389 ML:223 MM:95 MN:976 MO:853 MP:1670 MQ:596 MR:222 MS:1664 MT:356 MU:230 MV:960 MW:265 MX:52 MY:60 MZ:258 NA:264 NC:687 NE:227 NF:672 NG:234 NI:505 NL:31 NO:47 NP:977 NR:674 NU:683 NZ:64 OM:968 PA:507 PE:51 PF:689 PG:675 PH:63 PK:92 PL:48 PM:508 PR:1787 PS:970 PT:351 PW:680 PY:595 QA:974 RE:262 RO:40 RS:381 RU:7 RW:250 SA:966 SB:677 SC:248 SD:249 SE:46 SG:65 SH:290 SI:386 SJ:47 SK:421 SL:232 SM:378 SN:221 SO:252 SR:597 SS:211 ST:239 SV:503 SX:1721 SY:963 SZ:268 TC:1649 TD:235 TG:228 TH:66 TJ:992 TK:690 TL:670 TM:993 TN:216 TO:676 TR:90 TT:1868 TV:688 TW:886 TZ:255 UA:380 UG:256 US:1 UY:598 UZ:998 VA:39 VC:1784 VE:58 VG:1284 VI:1340 VN:84 VU:678 WF:681 WS:685 YE:967 YT:262 ZA:27 ZM:260 ZW:263";
function zi(n) {
  return String.fromCodePoint(...[...n].map((l) => 127462 + l.charCodeAt(0) - 65));
}
const ue = Di.split(" ").map((n) => {
  const [l, a] = n.split(":");
  return { dial: a, flag: zi(l), iso2: l };
}), Ai = new Map(ue.map((n) => [n.iso2, n]));
function Qe(n) {
  return Ai.get(n.toUpperCase());
}
function ct(n) {
  const l = n.replace(/\D/g, "");
  let a;
  for (const i of ue)
    l.startsWith(i.dial) && (!a || i.dial.length > a.dial.length) && (a = i);
  return a;
}
const Pe = /* @__PURE__ */ new Map();
function Li(n) {
  const l = Pe.get(n);
  if (l) return l;
  let a;
  try {
    const i = new Intl.DisplayNames([n], { type: "region" });
    a = (t) => i.of(t) ?? t;
  } catch {
    a = (i) => i;
  }
  return Pe.set(n, a), a;
}
function se(n) {
  let l = "";
  for (const a of n) {
    const i = a.codePointAt(0) ?? 0;
    i >= 1776 && i <= 1785 ? l += String.fromCodePoint(i - 1776 + 48) : i >= 1632 && i <= 1641 ? l += String.fromCodePoint(i - 1632 + 48) : a >= "0" && a <= "9" && (l += a);
  }
  return l;
}
function $i({
  autoFocus: n = !1,
  className: l,
  digitLabel: a,
  error: i,
  label: t,
  length: s = 5,
  onChange: d,
  onComplete: c,
  value: o
}) {
  const m = O(null), u = o.slice(0, s).split(""), h = Z((_) => {
    var y, D;
    const w = (y = m.current) == null ? void 0 : y.querySelectorAll("input");
    (D = w == null ? void 0 : w[Math.max(0, Math.min(_, w.length - 1))]) == null || D.focus();
  }, []);
  j(() => {
    n && h(0);
  }, [n, h]);
  const f = Z(
    (_, w) => {
      const y = _.slice(0, s);
      d(y), y.length === s ? c == null || c(y) : h(w);
    },
    [h, s, d, c]
  ), p = Z(
    (_, w) => {
      const y = se(w);
      if (!y) return;
      const D = (o.slice(0, _) + y).slice(0, s);
      f(D, D.length);
    },
    [f, s, o]
  ), N = Z(
    (_, w) => {
      if (w.key === "Backspace") {
        w.preventDefault();
        const y = o[_] ? _ : _ - 1;
        if (y < 0) return;
        d(o.slice(0, y) + o.slice(y + 1)), h(y);
      } else w.key === "ArrowLeft" ? h(_ - 1) : w.key === "ArrowRight" && h(_ + 1);
    },
    [h, d, o]
  ), g = Z(
    (_) => {
      const w = se(_.clipboardData.getData("text"));
      w && (_.preventDefault(), f(w.slice(0, s), w.length));
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
        children: Array.from({ length: s }, (_, w) => /* @__PURE__ */ e(
          "input",
          {
            "aria-invalid": i ? !0 : void 0,
            "aria-label": a ? a(w) : `${t} ${w + 1}`,
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
    i ? /* @__PURE__ */ e("p", { className: "nim-otp__error", role: "alert", children: i }) : null
  ] });
}
const Ei = {
  hide: "Hide password",
  show: "Show password",
  strength: (n) => `Password strength: ${n}`
}, Fe = ["weak", "fair", "good", "strong"];
function Ii({
  className: n,
  error: l,
  hint: a,
  id: i,
  label: t,
  labels: s,
  required: d,
  strength: c,
  ...o
}) {
  const [m, u] = E(!1), h = { ...Ei, ...s };
  return /* @__PURE__ */ e(ee, { error: l, hint: a, id: i, label: t, required: d, children: ({ control: f, describedBy: p }) => /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ r("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-describedby": p,
          "aria-invalid": l ? !0 : void 0,
          autoComplete: o.autoComplete ?? "current-password",
          className: v("nim-input", n),
          id: f,
          required: d,
          ...o,
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
    c ? /* @__PURE__ */ e(
      "div",
      {
        "aria-label": h.strength(c),
        className: "nim-password__meter",
        "data-level": c,
        role: "img",
        children: Fe.map((N, g) => /* @__PURE__ */ e(
          "span",
          {
            className: "nim-password__step",
            "data-on": g <= Fe.indexOf(c) ? "true" : void 0
          },
          N
        ))
      }
    ) : null
  ] }) });
}
function ot(n) {
  if (n.length < 8) return "weak";
  const l = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((a) => a.test(n)).length;
  return n.length >= 14 && l >= 3 ? "strong" : n.length >= 10 && l >= 2 ? "good" : "fair";
}
const Bi = {
  noMatch: "No country matches",
  pickCountry: "Country code",
  search: "Search countries"
};
function Pi({
  className: n,
  country: l,
  error: a,
  hint: i,
  id: t,
  label: s,
  labels: d,
  locale: c,
  onChange: o,
  onCountryChange: m,
  onSubmit: u,
  placeholder: h,
  priority: f = [],
  required: p,
  value: N
}) {
  const g = J(), _ = t ?? `nim-${g}`, w = i ? `${_}-hint` : void 0, y = a ? `${_}-error` : void 0, D = { ...Bi, ...d }, [I, k] = E(!1), [x, b] = E(""), S = O(null), C = O(null), $ = O(null), A = c ?? (typeof document > "u" ? "en" : document.documentElement.lang || "en"), L = Y(() => Li(A), [A]), B = Qe(l) ?? ue[0], K = Y(() => {
    const M = new Intl.Collator(A), F = ue.map((z) => ({ ...z, name: L(z.iso2) })), W = (z) => {
      const R = f.indexOf(z);
      return R === -1 ? f.length : R;
    };
    return F.sort(
      (z, R) => W(z.iso2) - W(R.iso2) || M.compare(z.name, R.name)
    );
  }, [L, f, A]), G = Y(() => {
    const M = x.trim().toLocaleLowerCase(A);
    if (!M) return K;
    const F = se(M);
    return K.filter(
      (W) => W.name.toLocaleLowerCase(A).includes(M) || W.iso2.toLowerCase().includes(M) || (F ? W.dial.startsWith(F) : !1)
    );
  }, [K, x, A]);
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
    s ? /* @__PURE__ */ r("label", { className: "nim-field__label", htmlFor: _, children: [
      s,
      p ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    /* @__PURE__ */ r("div", { className: "nim-phone", ref: S, children: [
      /* @__PURE__ */ r("div", { className: "nim-phone__shell", dir: "ltr", children: [
        /* @__PURE__ */ r(
          "button",
          {
            "aria-expanded": I,
            "aria-haspopup": "listbox",
            "aria-label": `${D.pickCountry}: ${L(B.iso2)} +${B.dial}`,
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
            id: _,
            inputMode: "tel",
            onChange: (M) => o(se(M.target.value)),
            onKeyDown: (M) => {
              M.key === "Enter" && (u == null || u());
            },
            placeholder: h,
            required: p,
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
function Fi(n, l) {
  var i;
  return `+${((i = Qe(n)) == null ? void 0 : i.dial) ?? ""}${se(l).replace(/^0+/, "")}`;
}
const Ri = {
  excluded: "minus",
  included: "check",
  pending: "clock"
};
function Oi({
  badge: n,
  className: l,
  features: a = [],
  icon: i,
  name: t,
  onSelect: s,
  price: d,
  priceCaption: c,
  secondary: o,
  selected: m = !1,
  tagline: u
}) {
  const h = /* @__PURE__ */ r(H, { children: [
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
        c ? /* @__PURE__ */ e("span", { className: "nim-plan__price-caption", children: c }) : null,
        /* @__PURE__ */ e("strong", { className: "nim-plan__price", children: d })
      ] }),
      o ? /* @__PURE__ */ r("div", { className: "nim-plan__secondary", children: [
        /* @__PURE__ */ e("span", { className: "nim-plan__price-caption", children: o.caption }),
        /* @__PURE__ */ e("strong", { className: "nim-plan__secondary-value", children: o.value })
      ] }) : null
    ] }),
    a.length ? /* @__PURE__ */ e("ul", { className: "nim-plan__features", children: a.map((p, N) => {
      const g = p.state ?? "included";
      return /* @__PURE__ */ r("li", { className: "nim-plan__feature", "data-state": g, children: [
        /* @__PURE__ */ e(T, { name: Ri[g], size: "xs" }),
        /* @__PURE__ */ e("span", { className: "nim-plan__feature-label", children: p.label }),
        p.note ? /* @__PURE__ */ e("span", { className: "nim-plan__feature-note", children: p.note }) : null
      ] }, N);
    }) }) : null
  ] }), f = v("nim-plan", m && "nim-plan--selected", l);
  return s ? /* @__PURE__ */ e("button", { "aria-pressed": m, className: f, onClick: s, type: "button", children: h }) : /* @__PURE__ */ e("article", { className: f, children: h });
}
function Ui({
  className: n,
  fullWidth: l = !1,
  label: a,
  onChange: i,
  options: t,
  value: s,
  ...d
}) {
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": a,
      className: v("nim-segmented", l && "nim-segmented--full", n),
      role: "tablist",
      ...d,
      children: t.map((c) => /* @__PURE__ */ e(
        "button",
        {
          "aria-selected": c.value === s,
          className: "nim-segmented__option",
          disabled: c.disabled,
          onClick: () => i(c.value),
          role: "tab",
          type: "button",
          children: c.label
        },
        c.value
      ))
    }
  );
}
const Hi = {
  cycle: "Billing period",
  monthly: "Per month",
  price: "This package"
};
function dt({
  className: n,
  cycle: l,
  cycles: a = [],
  defaultCycle: i,
  defaultPlan: t,
  labels: s,
  note: d,
  onCycleChange: c,
  onPlanChange: o,
  onSubmit: m,
  plan: u,
  plans: h,
  submitLabel: f
}) {
  var b, S;
  const p = { ...Hi, ...s }, [N, g] = E(i ?? ((b = a[0]) == null ? void 0 : b.id) ?? ""), [_, w] = E(t ?? ((S = h[0]) == null ? void 0 : S.id) ?? ""), y = l ?? N, D = u ?? _, I = (C) => {
    w(C), o == null || o(C);
  }, k = (C) => {
    g(C), c == null || c(C);
  }, x = a.find((C) => C.id === y);
  return /* @__PURE__ */ r("section", { className: v("nim-plan-picker", n), children: [
    a.length > 1 ? /* @__PURE__ */ r("div", { className: "nim-plan-picker__cycles", children: [
      /* @__PURE__ */ e(
        Ui,
        {
          fullWidth: !0,
          label: p.cycle,
          onChange: k,
          options: a.map((C) => ({ label: C.label, value: C.id })),
          value: y
        }
      ),
      x != null && x.note ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__save", children: x.note }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-plan-picker__plans", children: h.map(({ id: C, prices: $, ...A }) => {
      const L = $[y] ?? Object.values($)[0];
      return /* @__PURE__ */ nn(
        Oi,
        {
          ...A,
          key: C,
          onSelect: () => I(C),
          price: (L == null ? void 0 : L.price) ?? "",
          priceCaption: p.price,
          secondary: (L == null ? void 0 : L.monthly) === void 0 ? void 0 : { caption: p.monthly, value: L.monthly },
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
      d ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__note", children: d }) : null
    ] }) : null
  ] });
}
function Ki({
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
function mt({
  className: n,
  footer: l,
  sections: a = [],
  ...i
}) {
  return /* @__PURE__ */ r("div", { className: v("nim-profile-screen", n), children: [
    /* @__PURE__ */ e(Ka, { ...i }),
    a.map((t) => /* @__PURE__ */ r("section", { className: "nim-profile-screen__section", children: [
      t.title ? /* @__PURE__ */ e(Ki, { description: t.description, title: t.title }) : null,
      /* @__PURE__ */ e(Mi, { children: t.rows.map((s) => /* @__PURE__ */ e(
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
                onChange: (d) => {
                  var c;
                  return (c = s.onToggle) == null ? void 0 : c.call(s, d.target.checked);
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
function ut({
  className: n,
  count: l = 5,
  label: a,
  onChange: i,
  readOnly: t = !1,
  size: s = "md",
  value: d
}) {
  const c = J(), [o, m] = E(null), u = o ?? d;
  return t || !i ? /* @__PURE__ */ e(
    "span",
    {
      "aria-label": `${a}: ${d}/${l}`,
      className: v("nim-rating", `nim-rating--${s}`, "nim-rating--static", n),
      role: "img",
      children: Array.from({ length: l }, (h, f) => /* @__PURE__ */ e(Re, { fill: Math.min(Math.max(d - f, 0), 1) }, f))
    }
  ) : /* @__PURE__ */ r(
    "fieldset",
    {
      className: v("nim-rating", `nim-rating--${s}`, n),
      onMouseLeave: () => m(null),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-visually-hidden", children: a }),
        Array.from({ length: l }, (h, f) => {
          const p = f + 1;
          return /* @__PURE__ */ r("label", { className: "nim-rating__star", onMouseEnter: () => m(p), children: [
            /* @__PURE__ */ e(
              "input",
              {
                checked: d === p,
                className: "nim-choice__input",
                name: c,
                onChange: () => i(p),
                type: "radio",
                value: p
              }
            ),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: p }),
            /* @__PURE__ */ e(Re, { fill: Math.min(Math.max(u - f, 0), 1) })
          ] }, p);
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
}, ye = (n, l) => n instanceof Error && n.message.trim() ? n.message.trim() : l;
function ht({
  brand: n,
  className: l,
  codeLength: a = 5,
  copy: i,
  defaultCountry: t = "IR",
  defaultMethod: s = "code",
  footer: d,
  methods: c = ["code", "password"],
  onPasswordSignIn: o,
  onRequestCode: m,
  onVerifyCode: u,
  priority: h = ["IR", "AE", "TR", "DE", "US", "GB"],
  resendSeconds: f = 60
}) {
  const p = { ...Gi, ...i }, [N, g] = E(
    c.includes(s) ? s : c[0]
  ), [_, w] = E(!1), [y, D] = E(t), [I, k] = E(""), [x, b] = E(""), [S, C] = E(""), [$, A] = E(""), [L, B] = E(!1), [K, G] = E(""), [P, M] = E(0), F = O(!1);
  j(() => {
    if (P <= 0) return;
    const V = window.setTimeout(() => M((ae) => ae - 1), 1e3);
    return () => window.clearTimeout(V);
  }, [P]);
  const W = Fi(y, I), z = I.replace(/\D/g, "").length >= 6, R = Z(
    async (V = !1) => {
      if (!(L || !V && !z)) {
        B(!0), G("");
        try {
          await (m == null ? void 0 : m(W)), w(!0), b(""), M(f);
        } catch (ae) {
          G(ye(ae, p.sendCode));
        } finally {
          B(!1);
        }
      }
    },
    [L, W, m, z, f, p.sendCode]
  ), q = Z(
    async (V) => {
      if (!(F.current || V.length !== a)) {
        F.current = !0, B(!0), G("");
        try {
          await (u == null ? void 0 : u(W, V));
        } catch (ae) {
          G(ye(ae, p.verify)), b("");
        } finally {
          F.current = !1, B(!1);
        }
      }
    },
    [a, W, u, p.verify]
  ), Q = Z(async () => {
    if (!(L || !S.trim() || !$)) {
      B(!0), G("");
      try {
        await (o == null ? void 0 : o(S.trim(), $));
      } catch (V) {
        G(ye(V, p.signIn));
      } finally {
        B(!1);
      }
    }
  }, [L, S, o, $, p.signIn]), re = c.length > 1 ? /* @__PURE__ */ e(
    X,
    {
      onClick: () => {
        g(N === "code" ? "password" : "code"), G("");
      },
      size: "sm",
      variant: "ghost",
      children: N === "code" ? p.usePassword : p.usePhone
    }
  ) : null, fe = K ? /* @__PURE__ */ e(Za, { tone: "danger", children: K }) : null;
  return N === "password" ? /* @__PURE__ */ r(
    Ne,
    {
      action: {
        disabled: !S.trim() || !$,
        label: p.signIn,
        loading: L,
        onClick: () => void Q()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ r(H, { children: [
        re,
        d
      ] }),
      subtitle: p.passwordSubtitle,
      title: p.passwordTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          _i,
          {
            autoComplete: "username",
            label: p.identifierLabel,
            onChange: (V) => C(V.target.value),
            type: "email",
            value: S
          }
        ),
        /* @__PURE__ */ e(
          Ii,
          {
            autoComplete: "current-password",
            label: p.passwordLabel,
            onChange: (V) => A(V.target.value),
            onKeyDown: (V) => {
              V.key === "Enter" && Q();
            },
            value: $
          }
        )
      ]
    }
  ) : _ ? /* @__PURE__ */ r(
    Ne,
    {
      action: {
        disabled: x.length !== a,
        label: p.verify,
        loading: L,
        onClick: () => void q(x)
      },
      back: {
        label: p.back,
        onClick: () => {
          w(!1), b(""), G("");
        }
      },
      className: l,
      footer: /* @__PURE__ */ r(H, { children: [
        P > 0 ? /* @__PURE__ */ e("p", { children: p.resendIn(P) }) : /* @__PURE__ */ e(X, { onClick: () => void R(!0), size: "sm", variant: "ghost", children: p.resend }),
        d
      ] }),
      subtitle: p.codeSubtitle(W),
      title: p.codeTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          $i,
          {
            autoFocus: !0,
            label: p.codeLabel,
            length: a,
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
        label: p.sendCode,
        loading: L,
        onClick: () => void R()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ r(H, { children: [
        re,
        d
      ] }),
      subtitle: p.phoneSubtitle,
      title: p.phoneTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          Pi,
          {
            country: y,
            label: p.phoneLabel,
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
function pt({ children: n, className: l, closeLabel: a = "Close", footer: i, onClose: t, open: s, title: d }) {
  const c = O(null), o = O(null), m = J();
  return j(() => {
    var f;
    if (!s) return;
    o.current = document.activeElement;
    const u = document.body.style.overflow;
    document.body.style.overflow = "hidden", (f = c.current) == null || f.focus();
    const h = (p) => {
      var w, y;
      if (p.key === "Escape" && t(), p.key !== "Tab") return;
      const N = (w = c.current) == null ? void 0 : w.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!(N != null && N.length)) {
        p.preventDefault(), (y = c.current) == null || y.focus();
        return;
      }
      const g = N[0], _ = N[N.length - 1];
      p.shiftKey && document.activeElement === g ? (p.preventDefault(), _.focus()) : !p.shiftKey && document.activeElement === _ && (p.preventDefault(), g.focus());
    };
    return window.addEventListener("keydown", h), () => {
      var p, N;
      document.body.style.overflow = u, window.removeEventListener("keydown", h), (N = (p = o.current) == null ? void 0 : p.focus) == null || N.call(p);
    };
  }, [t, s]), !s || typeof document > "u" ? null : he(
    /* @__PURE__ */ r(H, { children: [
      /* @__PURE__ */ e("div", { className: "nim-sheet__scrim", onClick: t }),
      /* @__PURE__ */ r(
        "div",
        {
          "aria-label": d ? void 0 : a,
          "aria-labelledby": d ? m : void 0,
          "aria-modal": "true",
          className: v("nim-sheet__panel", l),
          ref: c,
          role: "dialog",
          tabIndex: -1,
          children: [
            /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-sheet__handle" }),
            d ? /* @__PURE__ */ r("div", { className: "nim-sheet__header", children: [
              /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", id: m, children: d }),
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
function _t({
  className: n,
  label: l,
  max: a = 100,
  min: i = 0,
  scale: t,
  step: s = 1,
  value: d,
  ...c
}) {
  const o = a === i ? 0 : (d - i) / (a - i) * 100;
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
        style: { "--nim-slider-progress": `${o}%` },
        type: "range",
        value: d,
        ...c
      }
    ),
    t ? /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-inline", style: { justifyContent: "space-between" }, children: t.map((m) => /* @__PURE__ */ e("span", { className: "nim-caption", children: m }, m)) }) : null
  ] });
}
function ft({ className: n, delta: l, deltaDirection: a = "up", label: i, unit: t, value: s, ...d }) {
  return /* @__PURE__ */ r("div", { className: v("nim-stat", n), ...d, children: [
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
function Nt({ className: n, label: l = "Stages", stages: a }) {
  return /* @__PURE__ */ e("ol", { "aria-label": l, className: v("nim-stages", n), children: a.map((i, t) => {
    const s = /* @__PURE__ */ r(H, { children: [
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
function bt({
  className: n,
  decrementLabel: l = "Decrease",
  incrementLabel: a = "Increase",
  label: i,
  max: t = Number.MAX_SAFE_INTEGER,
  min: s = 0,
  onChange: d,
  step: c = 1,
  value: o
}) {
  const m = (u) => Math.min(Math.max(u, s), t);
  return /* @__PURE__ */ r(
    "div",
    {
      "aria-label": i,
      "aria-valuemax": t,
      "aria-valuemin": s,
      "aria-valuenow": o,
      className: v("nim-stepper", n),
      role: "spinbutton",
      tabIndex: 0,
      onKeyDown: (u) => {
        u.key === "ArrowUp" && (u.preventDefault(), d(m(o + c))), u.key === "ArrowDown" && (u.preventDefault(), d(m(o - c)));
      },
      children: [
        /* @__PURE__ */ e(
          "button",
          {
            "aria-label": l,
            className: "nim-stepper__button",
            disabled: o <= s,
            onClick: () => d(m(o - c)),
            tabIndex: -1,
            type: "button",
            children: /* @__PURE__ */ e(T, { name: "minus", size: "sm" })
          }
        ),
        /* @__PURE__ */ e("span", { className: "nim-stepper__value", children: o }),
        /* @__PURE__ */ e(
          "button",
          {
            "aria-label": a,
            className: "nim-stepper__button",
            disabled: o >= t,
            onClick: () => d(m(o + c)),
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
  of: (n, l) => `${n} of ${l} steps`,
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
function vt({
  action: n,
  caption: l,
  className: a,
  labels: i,
  steps: t,
  title: s,
  value: d
}) {
  const c = { ...Wi, ...i }, o = t.filter((h) => h.status === "done" || h.status === "skipped").length, m = d ?? (t.length ? Math.round(o / t.length * 100) : 0), u = t.some((h) => h.status === "failed");
  return /* @__PURE__ */ r(
    "section",
    {
      "aria-live": "polite",
      className: v("nim-task", u && "nim-task--failed", a),
      children: [
        /* @__PURE__ */ r("header", { className: "nim-task__head", children: [
          s ? /* @__PURE__ */ e("h2", { className: "nim-task__title", children: s }) : null,
          l ? /* @__PURE__ */ e("p", { className: "nim-task__caption", children: l }) : null,
          /* @__PURE__ */ e(Pa, { label: c.of(o, t.length), value: m })
        ] }),
        /* @__PURE__ */ e("ol", { className: "nim-task__steps", children: t.map((h) => /* @__PURE__ */ r("li", { className: "nim-task__step", "data-status": h.status, children: [
          /* @__PURE__ */ e("span", { className: "nim-task__marker", children: h.status === "active" ? /* @__PURE__ */ e(Ke, { size: "sm" }) : /* @__PURE__ */ e(T, { name: Zi[h.status], size: "xs" }) }),
          /* @__PURE__ */ r("span", { className: "nim-task__step-text", children: [
            /* @__PURE__ */ e("span", { className: "nim-task__step-label", children: h.label }),
            /* @__PURE__ */ e("span", { className: "nim-task__step-detail", children: h.detail ?? c.status[h.status] })
          ] })
        ] }, h.id)) }),
        n ? /* @__PURE__ */ e("div", { className: "nim-task__action", children: n }) : null
      ]
    }
  );
}
function gt({ className: n, density: l = "default", entries: a }) {
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
function yt({ className: n, label: l, onChange: a, options: i, value: t, ...s }) {
  const d = O(null), c = (o) => {
    var p, N;
    const m = o.key === "ArrowRight" ? 1 : o.key === "ArrowLeft" ? -1 : 0;
    if (m === 0) return;
    o.preventDefault();
    const u = i.filter((g) => !g.disabled), h = u.findIndex((g) => g.value === t), f = u[(h + m + u.length) % u.length];
    f && (a(f.value), (N = (p = d.current) == null ? void 0 : p.querySelector(`[data-value="${f.value}"]`)) == null || N.focus());
  };
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": l,
      className: v("nim-tabs", n),
      onKeyDown: c,
      ref: d,
      role: "tablist",
      ...s,
      children: i.map((o) => /* @__PURE__ */ r(
        "button",
        {
          "aria-selected": o.value === t,
          className: "nim-tab",
          "data-value": o.value,
          disabled: o.disabled,
          onClick: () => a(o.value),
          role: "tab",
          tabIndex: o.value === t ? 0 : -1,
          type: "button",
          children: [
            o.label,
            o.count === void 0 ? null : /* @__PURE__ */ e("span", { className: "nim-tab__count", children: o.count })
          ]
        },
        o.value
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
function kt({ children: n }) {
  const [l, a] = E([]), i = O(0), t = Z((c) => {
    a((o) => o.filter((m) => m.id !== c));
  }, []), s = Z(
    (c) => {
      const o = i.current++;
      a((u) => [...u, { ...c, id: o }]);
      const m = c.duration ?? 4e3;
      m > 0 && window.setTimeout(() => t(o), m);
    },
    [t]
  ), d = Y(() => s, [s]);
  return /* @__PURE__ */ r(Xe.Provider, { value: d, children: [
    n,
    typeof document < "u" ? he(
      /* @__PURE__ */ e("div", { "aria-live": "polite", className: "nim-toast-stack", children: l.map((c) => /* @__PURE__ */ r("div", { className: v("nim-toast", `nim-toast--${c.tone ?? "neutral"}`), children: [
        /* @__PURE__ */ e(T, { className: "nim-toast__icon", name: Yi[c.tone ?? "neutral"], size: "sm" }),
        /* @__PURE__ */ e("span", { className: "nim-toast__message", children: c.message }),
        c.action ? /* @__PURE__ */ e(
          "button",
          {
            className: "nim-toast__action",
            onClick: () => {
              var o;
              (o = c.action) == null || o.onPress(), t(c.id);
            },
            type: "button",
            children: c.action.label
          }
        ) : null
      ] }, c.id)) }),
      document.body
    ) : null
  ] });
}
function wt() {
  const n = xe(Xe);
  if (!n) throw new Error("useToast must be used inside <ToastProvider>");
  return n;
}
function Ct({ children: n, className: l, label: a }) {
  return /* @__PURE__ */ r("span", { className: v("nim-tooltip", l), children: [
    n,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-tooltip__bubble", role: "tooltip", children: a })
  ] });
}
const ji = {
  back: "Back",
  close: "Close",
  step: (n, l) => `Step ${n + 1} of ${l}`
};
function xt({
  className: n,
  continueLabel: l,
  finishLabel: a,
  labels: i,
  onClose: t,
  onDone: s,
  onStep: d,
  steps: c
}) {
  const o = { ...ji, ...i }, [m, u] = E(0), h = c[Math.min(m, c.length - 1)], f = m === c.length - 1, p = Z(
    (N) => {
      u(N), d == null || d(N);
    },
    [d]
  );
  return /* @__PURE__ */ r("section", { className: v("nim-wizard", n), children: [
    /* @__PURE__ */ r("header", { className: "nim-wizard__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: m > 0 ? /* @__PURE__ */ e(U, { label: o.back, name: "chevron-back", onClick: () => p(m - 1), size: "sm" }) : null }),
      /* @__PURE__ */ e("ol", { "aria-label": o.step(m, c.length), className: "nim-wizard__dots", children: c.map((N, g) => /* @__PURE__ */ e(
        "li",
        {
          className: "nim-wizard__dot",
          "data-done": g < m ? "true" : void 0,
          "data-on": g === m ? "true" : void 0
        },
        N.id
      )) }),
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: t ? /* @__PURE__ */ e(U, { label: o.close, name: "close", onClick: t, size: "sm" }) : null })
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
        onClick: () => f ? s() : p(m + 1),
        size: "lg",
        variant: "accent",
        children: h.continueLabel ?? (f ? a : l)
      }
    ) })
  ] });
}
function Mt({
  className: n,
  max: l,
  multiple: a = !1,
  onChange: i,
  options: t,
  selected: s
}) {
  const d = a && l !== void 0 && s.length >= l, c = (o) => {
    if (!a) {
      i([o]);
      return;
    }
    i(s.includes(o) ? s.filter((m) => m !== o) : [...s, o]);
  };
  return /* @__PURE__ */ e("div", { className: v("nim-choice-grid", n), role: a ? "group" : "radiogroup", children: t.map((o) => {
    const m = s.includes(o.id);
    return /* @__PURE__ */ r(
      "button",
      {
        "aria-checked": m,
        className: "nim-choice-grid__tile",
        "data-on": m ? "true" : void 0,
        disabled: o.disabled || d && !m,
        onClick: () => c(o.id),
        role: a ? "checkbox" : "radio",
        type: "button",
        children: [
          o.icon ? /* @__PURE__ */ e("span", { className: "nim-choice-grid__icon", children: o.icon }) : null,
          /* @__PURE__ */ e("span", { className: "nim-choice-grid__label", children: o.label })
        ]
      },
      o.id
    );
  }) });
}
const Je = (n = "default") => n === "default" ? void 0 : `nim-text--${n}`;
function Vi({
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
Vi.Line = function({
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
function Tt({
  as: n = "h2",
  children: l,
  className: a,
  size: i = "lg",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-title", i === "md" && "nim-title--md", a), ...t, children: l });
}
function St({
  as: n = "p",
  children: l,
  className: a,
  size: i = "md",
  tone: t,
  ...s
}) {
  return /* @__PURE__ */ e(n, { className: v("nim-body", i === "sm" && "nim-body--sm", Je(t), a), ...s, children: l });
}
function Dt({ as: n = "span", children: l, className: a, ...i }) {
  return /* @__PURE__ */ e(n, { className: v("nim-label", a), ...i, children: l });
}
function zt({ as: n = "p", children: l, className: a, tone: i, ...t }) {
  return /* @__PURE__ */ e(n, { className: v("nim-caption", Je(i), a), ...t, children: l });
}
function At({ className: n, ...l }) {
  return /* @__PURE__ */ e("hr", { className: v("nim-rule", n), ...l });
}
export {
  Tl as Accordion,
  El as ActionBar,
  ll as ActivityFeed,
  nl as AdminShell,
  lt as AppFrame,
  Sl as AppShell,
  Bl as AssistantThread,
  Ne as AuthScreen,
  de as Avatar,
  Dl as AvatarRing,
  Ga as Badge,
  Za as Banner,
  St as Body,
  yl as Brand,
  kl as BrandMark,
  zl as Breadcrumb,
  X as Button,
  ue as COUNTRIES,
  Ve as Calendar,
  zt as Caption,
  Al as Card,
  Pl as Chart,
  Il as Chat,
  Kl as ChatComposer,
  De as Checkbox,
  hi as Chip,
  Gl as ChipInput,
  Mt as ChoiceGrid,
  hl as CodeBlock,
  ml as Columns,
  ql as Combobox,
  Zl as CommandPalette,
  si as ConversationList,
  vl as CopyChip,
  Wl as DataList,
  Ml as DataTable,
  Jl as DateField,
  et as DatePicker,
  al as DetailHeader,
  gl as DetailLayout,
  nt as Dialog,
  Vi as Display,
  $a as EmptyState,
  dl as Facts,
  Yl as Field,
  it as FileDrop,
  il as FilterChips,
  T as Icon,
  U as IconButton,
  st as Inline,
  _i as Input,
  Dt as Label,
  Mi as List,
  Ti as ListRow,
  Ul as MapView,
  Hl as MediaPlayer,
  ze as Menu,
  Rl as Messenger,
  cl as Metric,
  ol as MetricGrid,
  _l as Mono,
  Ql as NimProvider,
  rt as Onboarding,
  Ll as OptionCard,
  $l as OrderSummary,
  $i as OtpInput,
  tl as Page,
  Ia as Pagination,
  sl as Panel,
  Ii as PasswordField,
  Pi as PhoneField,
  Oi as PlanCard,
  dt as PlanPicker,
  ja as Popover,
  Ka as ProfileHeader,
  mt as ProfileScreen,
  Pa as Progress,
  Cl as Radio,
  xl as RadioGroup,
  Nl as Rail,
  bl as RailSection,
  ut as Rating,
  fl as RecordLink,
  at as ResourceMeter,
  Ol as RoomHeader,
  At as Rule,
  Ki as SectionHeader,
  Ui as Segmented,
  Vl as Select,
  pt as Sheet,
  ht as SignInFlow,
  Fa as Skeleton,
  _t as Slider,
  Fl as Sparkline,
  Ke as Spinner,
  tt as Stack,
  Nt as StageTrack,
  ft as Stat,
  pl as StatusDot,
  ul as StatusHero,
  bt as Stepper,
  Ba as Switch,
  Ua as TabBar,
  Se as Table,
  yt as Tabs,
  vt as TaskProgress,
  jl as Textarea,
  gt as Timeline,
  Tt as Title,
  kt as ToastProvider,
  rl as Toolbar,
  Ct as Tooltip,
  xt as Wizard,
  ge as addDays,
  Ee as addMonths,
  wl as brandFor,
  v as cn,
  ct as countryByDial,
  Qe as countryByIso2,
  Li as countryNamer,
  we as formatNumeric,
  te as fromParts,
  el as iconNames,
  je as monthLength,
  Ci as parseNumeric,
  ne as partsOf,
  ot as scorePassword,
  vi as startOfMonth,
  se as toAsciiDigits,
  Fi as toE164,
  _e as todayIso,
  pe as useNim,
  Xl as useSchemeToggle,
  wt as useToast
};
