import { jsx as e, jsxs as r, Fragment as H } from "react/jsx-runtime";
import { forwardRef as Oe, useState as E, useCallback as Z, createContext as Ce, useContext as xe, useId as J, Fragment as ke, useRef as U, useLayoutEffect as en, useEffect as V, useMemo as Y, createElement as nn } from "react";
import { Wallet as an, VolumeX as ln, Volume2 as tn, User as sn, Video as rn, Upload as cn, TrendingUp as on, TrendingDown as dn, Trash2 as mn, Sun as un, Star as hn, Sparkles as _n, CircleStop as pn, LogOut as fn, Share2 as Nn, Settings as bn, Send as vn, Search as gn, Plus as yn, Play as kn, Pin as wn, Pause as Cn, Paperclip as xn, Moon as Mn, Minus as Tn, Mic as Sn, Menu as zn, Lock as Dn, Loader as An, Info as Ln, Home as En, Heart as $n, Hash as In, Forward as Bn, Filter as Pn, Maximize2 as Fn, SmilePlus as Rn, MessageCircle as On, Eye as Un, ExternalLink as Hn, Pencil as Gn, Download as Kn, FileText as Wn, CircleAlert as Zn, Copy as Yn, X as jn, Clock as Vn, ChevronUp as qn, ChevronRight as Qn, ChevronDown as Xn, ChevronLeft as Jn, CircleCheck as ea, Check as na, Camera as aa, Calendar as ia, Bookmark as la, Bell as ta, Users as sa, Terminal as ra, Tag as ca, ShieldCheck as oa, Server as da, Reply as ma, RefreshCw as ua, Package as ha, MoreHorizontal as _a, Link2 as pa, Layers as fa, KeyRound as Na, Globe as ba, Database as va, Cloud as ga, BarChart3 as ya, ArrowRight as ka, ArrowLeft as wa, AlertTriangle as Ca, Activity as xa } from "lucide-react";
import { createPortal as he } from "react-dom";
const b = (...n) => n.filter(Boolean).join(" "), Ue = {
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
  download: Kn,
  edit: Gn,
  external: Hn,
  eye: Un,
  chat: On,
  emoji: Rn,
  expand: Fn,
  filter: Pn,
  forward: Bn,
  hash: In,
  heart: $n,
  home: En,
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
function x({ className: n, label: l, name: i, size: a = "md", tone: t = "default", ...s }) {
  const d = Ue[i];
  return /* @__PURE__ */ e(
    d,
    {
      "aria-hidden": l ? void 0 : !0,
      "aria-label": l,
      className: b("nim-icon", n),
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
      className: b("nim-icon-button", `nim-icon-button--${d}`, `nim-icon-button--${t}`, l),
      ref: c,
      title: i,
      type: s,
      ...o,
      children: /* @__PURE__ */ e(x, { name: a, size: Ta[t] })
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
  contextualFooter: t,
  contextualGroups: s,
  contextualHeader: d,
  contextualValue: o,
  groups: c,
  labels: m,
  navigation: u = "sidebar",
  sidebarFooter: h,
  title: f,
  toolbar: _,
  value: N,
  titleRole: g = "page"
}) {
  const p = { ...Sa, ...m }, [w, y] = E(!1), [S, I] = E(!1), B = g === "scope" ? "div" : "h1", M = (k, L, D) => /* @__PURE__ */ e("nav", { "aria-label": D, className: "nim-admin__nav", children: k.map((A) => /* @__PURE__ */ r("div", { className: "nim-admin__group", children: [
    A.label ? /* @__PURE__ */ r("p", { className: "nim-admin__group-label", children: [
      A.icon ? /* @__PURE__ */ e(x, { name: A.icon, size: "xs" }) : null,
      A.label
    ] }) : null,
    A.items.map(($) => {
      const G = $.key === L, K = /* @__PURE__ */ r(H, { children: [
        $.icon ? /* @__PURE__ */ e(x, { name: $.icon, size: "sm" }) : null,
        /* @__PURE__ */ e("span", { children: $.label })
      ] }), P = {
        "aria-current": G ? "page" : void 0,
        className: "nim-admin__link",
        "data-active": G ? "true" : void 0,
        onClick: () => {
          var C;
          (C = $.onSelect) == null || C.call($), y(!1);
        },
        // The only text left in the rail is the icon, so the accessible
        // name has to survive the collapse — it is the label, always,
        // not a second string that can drift away from it.
        title: typeof $.label == "string" ? $.label : void 0
      };
      return $.href ? /* @__PURE__ */ e("a", { href: $.href, ...P, children: K }, $.key) : /* @__PURE__ */ e("button", { type: "button", ...P, children: K }, $.key);
    })
  ] }, A.key)) }), v = M(c, N, p.nav), T = s != null && s.length ? M(s, o ?? N, `${p.nav} · current section`) : null;
  return /* @__PURE__ */ r(
    "div",
    {
      className: b("nim-admin", i),
      "data-collapsed": a && S ? "true" : void 0,
      "data-drawer": w ? "open" : void 0,
      "data-navigation": u,
      children: [
        u === "sidebar" ? /* @__PURE__ */ r("aside", { className: "nim-admin__sidebar", children: [
          n || a ? /* @__PURE__ */ e("div", { className: "nim-admin__brand", children: n }) : null,
          v,
          h ? /* @__PURE__ */ e("div", { className: "nim-admin__sidebar-foot", children: h }) : null,
          a ? /* @__PURE__ */ r(
            "button",
            {
              "aria-label": S ? p.expand : p.collapse,
              "aria-expanded": !S,
              className: "nim-admin__rail-toggle",
              onClick: () => I((k) => !k),
              type: "button",
              children: [
                /* @__PURE__ */ e(x, { name: S ? "chevron-forward" : "chevron-back", size: "sm" }),
                /* @__PURE__ */ e("span", { children: S ? p.expand : p.collapse })
              ]
            }
          ) : null
        ] }) : null,
        /* @__PURE__ */ r("div", { className: "nim-admin__drawer", hidden: !w, children: [
          /* @__PURE__ */ e("div", { className: "nim-admin__scrim", onClick: () => y(!1) }),
          /* @__PURE__ */ r("div", { className: "nim-admin__drawer-panel", children: [
            /* @__PURE__ */ r("div", { className: "nim-admin__drawer-head", children: [
              n,
              /* @__PURE__ */ e(O, { label: p.close, name: "close", onClick: () => y(!1), size: "sm" })
            ] }),
            v
          ] })
        ] }),
        /* @__PURE__ */ r("div", { className: "nim-admin__workspace", children: [
          /* @__PURE__ */ r("header", { className: "nim-admin__topbar", children: [
            /* @__PURE__ */ e(
              O,
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
            f ? /* @__PURE__ */ e(B, { className: "nim-admin__title", children: f }) : null,
            _ ? /* @__PURE__ */ e("div", { className: "nim-admin__toolbar", children: _ }) : null
          ] }),
          u === "sections" ? /* @__PURE__ */ e("div", { className: "nim-admin__sections", children: v }) : null,
          T ? /* @__PURE__ */ r("div", { className: "nim-admin__context-layout", children: [
            /* @__PURE__ */ r("aside", { className: "nim-admin__context", children: [
              d ? /* @__PURE__ */ e("div", { className: "nim-admin__context-head", children: d }) : null,
              /* @__PURE__ */ e("div", { className: "nim-admin__context-nav", children: T }),
              t ? /* @__PURE__ */ e("div", { className: "nim-admin__context-foot", children: t }) : null
            ] }),
            /* @__PURE__ */ e("main", { className: "nim-admin__main", children: l })
          ] }) : /* @__PURE__ */ e("main", { className: "nim-admin__main", children: l })
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
  return /* @__PURE__ */ r("header", { className: b("nim-detail-header", i), children: [
    l ? l.href ? /* @__PURE__ */ r("a", { className: "nim-detail-header__back", href: l.href, children: [
      /* @__PURE__ */ e(x, { name: "chevron-back", size: "sm" }),
      l.label
    ] }) : /* @__PURE__ */ r("button", { className: "nim-detail-header__back", onClick: l.onClick, type: "button", children: [
      /* @__PURE__ */ e(x, { name: "chevron-back", size: "sm" }),
      l.label
    ] }) : null,
    /* @__PURE__ */ r("div", { className: "nim-detail-header__row", children: [
      /* @__PURE__ */ r("div", { className: "nim-detail-header__text", children: [
        /* @__PURE__ */ r("div", { className: "nim-detail-header__headline", children: [
          /* @__PURE__ */ e("h1", { className: "nim-detail-header__title", children: d }),
          t ? /* @__PURE__ */ e("span", { className: "nim-detail-header__status", children: t }) : null
        ] }),
        s ? /* @__PURE__ */ e("p", { className: "nim-detail-header__subtitle", children: s }) : null,
        a ? /* @__PURE__ */ e("div", { className: "nim-detail-header__meta", children: a }) : null
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
  return /* @__PURE__ */ r("div", { "aria-label": s.toolbar, className: b("nim-filter-chips", l), role: "toolbar", children: [
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
          children: /* @__PURE__ */ e(x, { name: "close", size: "xs" })
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
  return i.length === 0 ? /* @__PURE__ */ e("div", { className: b("nim-activity", n), children: l }) : /* @__PURE__ */ e("ol", { className: b("nim-activity", n), children: i.map((s) => /* @__PURE__ */ r("li", { className: "nim-activity__item", "data-tone": s.tone, children: [
    /* @__PURE__ */ e("span", { className: "nim-activity__marker", children: s.icon ? /* @__PURE__ */ e(x, { name: s.icon, size: "xs" }) : null }),
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
  return /* @__PURE__ */ e("div", { className: b("nim-page", l), "data-width": i, ...a, children: n });
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
  return /* @__PURE__ */ r("section", { className: b("nim-panel", a), ...u, children: [
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
  return /* @__PURE__ */ r("div", { className: b("nim-toolbar", i), role: "toolbar", ...a, children: [
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
  const f = a === "more-is-better" ? i === "up" : i === "down";
  return /* @__PURE__ */ r(
    c ? "button" : "div",
    {
      className: b("nim-metric", c && "nim-metric--interactive", n),
      "data-layout": o === "stacked" ? void 0 : o,
      "data-tone": m === "neutral" ? void 0 : m,
      onClick: c,
      type: c ? "button" : void 0,
      ...h,
      children: [
        o === "inline" && s ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-metric__glyph", children: /* @__PURE__ */ e(x, { name: s, size: "sm" }) }) : null,
        /* @__PURE__ */ r("span", { className: "nim-metric__label", children: [
          o === "inline" ? null : s ? /* @__PURE__ */ e(x, { name: s, size: "xs" }) : null,
          d
        ] }),
        /* @__PURE__ */ e("span", { className: "nim-metric__value", children: u }),
        l || t ? /* @__PURE__ */ r("span", { className: "nim-metric__foot", children: [
          l ? /* @__PURE__ */ r("span", { className: "nim-metric__delta", "data-intent": f ? "good" : "bad", children: [
            /* @__PURE__ */ e(x, { name: i === "up" ? "trend-up" : "trend-down", size: "xs" }),
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
      className: b("nim-metric-grid", l),
      "data-columns": i,
      "data-dense": a ? "true" : void 0,
      ...t,
      children: n
    }
  );
}
function ol({ className: n, columns: l = 2, items: i, ...a }) {
  return /* @__PURE__ */ e("dl", { className: b("nim-facts", n), "data-columns": l, ...a, children: i.map((t, s) => /* @__PURE__ */ r("div", { className: "nim-facts__item", children: [
    /* @__PURE__ */ e("dt", { className: "nim-facts__label", children: t.label }),
    /* @__PURE__ */ e("dd", { className: "nim-facts__value", "data-mono": t.mono ? "true" : void 0, children: t.value })
  ] }, t.key ?? s)) });
}
function dl({ children: n, className: l, template: i = "halves", ...a }) {
  return /* @__PURE__ */ e("div", { className: b("nim-columns", l), "data-template": i, ...a, children: n });
}
function ml({ className: n, description: l, icon: i, title: a, tone: t = "neutral", ...s }) {
  return /* @__PURE__ */ r("section", { className: b("nim-status-hero", n), "data-tone": t, ...s, children: [
    /* @__PURE__ */ e("span", { className: "nim-status-hero__mark", children: /* @__PURE__ */ e(x, { name: i, size: "xl" }) }),
    /* @__PURE__ */ r("div", { className: "nim-status-hero__copy", children: [
      /* @__PURE__ */ e("strong", { className: "nim-status-hero__title", children: a }),
      l ? /* @__PURE__ */ e("p", { className: "nim-status-hero__description", children: l }) : null
    ] })
  ] });
}
function ul({
  children: n,
  className: l,
  copiedLabel: i = "Copied",
  copyLabel: a = "Copy",
  label: t,
  wrap: s = !1,
  ...d
}) {
  const [o, c] = E(!1), m = typeof navigator < "u" && !!navigator.clipboard, u = Z(() => {
    navigator.clipboard.writeText(n).then(() => {
      c(!0), window.setTimeout(() => c(!1), 1600);
    });
  }, [n]);
  return /* @__PURE__ */ r("figure", { className: b("nim-code", l), children: [
    t || m ? /* @__PURE__ */ r("figcaption", { className: "nim-code__head", children: [
      t ? /* @__PURE__ */ e("span", { className: "nim-code__label", children: t }) : /* @__PURE__ */ e("span", {}),
      m ? /* @__PURE__ */ r("button", { className: "nim-code__copy", onClick: u, type: "button", children: [
        /* @__PURE__ */ e(x, { name: o ? "check" : "copy", size: "xs" }),
        o ? i : a
      ] }) : null
    ] }) : null,
    /* @__PURE__ */ e("pre", { className: "nim-code__body", "data-wrap": s ? "true" : void 0, tabIndex: 0, ...d, children: n })
  ] });
}
function hl({ children: n, className: l, pulse: i = !1, tone: a = "neutral", ...t }) {
  return /* @__PURE__ */ r("span", { className: b("nim-status", l), "data-tone": a, ...t, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-status__dot", "data-pulse": i ? "true" : void 0 }),
    n
  ] });
}
function _l({ children: n, className: l, size: i = "sm", ...a }) {
  return /* @__PURE__ */ e("code", { className: b("nim-mono", l), "data-size": i, ...a, children: n });
}
function pl({ className: n, href: l, meta: i, onClick: a, title: t }) {
  const s = /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ e("strong", { className: "nim-record__title", children: t }),
    i ? /* @__PURE__ */ e("span", { className: "nim-record__meta", children: i }) : null
  ] });
  return l ? /* @__PURE__ */ e("a", { className: b("nim-record", n), href: l, children: s }) : a ? /* @__PURE__ */ e("button", { className: b("nim-record", n), onClick: a, type: "button", children: s }) : /* @__PURE__ */ e("span", { className: b("nim-record", n), children: s });
}
function fl({ actions: n, children: l, className: i, footer: a, title: t, ...s }) {
  return /* @__PURE__ */ r("section", { className: b("nim-rail", i), ...s, children: [
    /* @__PURE__ */ r("header", { className: "nim-rail__head", children: [
      /* @__PURE__ */ e("h2", { className: "nim-rail__title", children: t }),
      n ? /* @__PURE__ */ e("div", { className: "nim-rail__actions", children: n }) : null
    ] }),
    /* @__PURE__ */ e("div", { className: "nim-rail__body", children: l }),
    a ? /* @__PURE__ */ e("div", { className: "nim-rail__foot", children: a }) : null
  ] });
}
function Nl({ children: n, className: l, meta: i, title: a, tone: t = "neutral", ...s }) {
  return /* @__PURE__ */ r(
    "div",
    {
      className: b("nim-rail__section", l),
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
function bl({
  children: n,
  className: l,
  copiedLabel: i = "Copied",
  copyLabel: a = "Copy",
  ...t
}) {
  const [s, d] = E(!1), o = typeof navigator < "u" && !!navigator.clipboard, c = Z(() => {
    navigator.clipboard.writeText(n).then(() => {
      d(!0), window.setTimeout(() => d(!1), 1600);
    });
  }, [n]);
  return /* @__PURE__ */ r("span", { className: b("nim-copy-chip", l), ...t, children: [
    /* @__PURE__ */ e("span", { className: "nim-copy-chip__value", children: n }),
    o ? /* @__PURE__ */ e(
      "button",
      {
        "aria-label": s ? i : `${a} ${n}`,
        className: "nim-copy-chip__button",
        onClick: c,
        type: "button",
        children: /* @__PURE__ */ e(x, { name: s ? "check" : "copy", size: "xs" })
      }
    ) : null
  ] });
}
function vl({ aside: n, children: l, className: i, ...a }) {
  return /* @__PURE__ */ r("div", { className: b("nim-detail", i), ...a, children: [
    /* @__PURE__ */ e("div", { className: "nim-detail__main", children: l }),
    n ? /* @__PURE__ */ e("aside", { className: "nim-detail__aside", children: n }) : null
  ] });
}
function gl({
  className: n,
  href: l,
  mark: i,
  name: a,
  nameAccent: t,
  size: s = "md",
  tagline: d,
  ...o
}) {
  const c = /* @__PURE__ */ r(H, { children: [
    i ? /* @__PURE__ */ e("span", { className: "nim-brand__mark", children: i }) : null,
    /* @__PURE__ */ r("span", { className: "nim-brand__text", children: [
      /* @__PURE__ */ r("strong", { className: "nim-brand__name", children: [
        a,
        t ? /* @__PURE__ */ e("span", { className: "nim-brand__name-accent", children: t }) : null
      ] }),
      d ? /* @__PURE__ */ e("small", { className: "nim-brand__tagline", children: d }) : null
    ] })
  ] }), m = b("nim-brand", n);
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
function yl({ className: n, label: l, name: i, size: a = "md", ...t }) {
  const s = Aa.has(i), d = La[a];
  return /* @__PURE__ */ e(
    "svg",
    {
      "aria-hidden": l ? void 0 : !0,
      "aria-label": l,
      className: b("nim-brand-mark", n),
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
function kl(n) {
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
  const u = b(
    "nim-button",
    `nim-button--${o}`,
    `nim-button--${d}`,
    a && "nim-button--full",
    i
  ), h = /* @__PURE__ */ r(H, { children: [
    s ? /* @__PURE__ */ e(x, { name: s, size: "sm" }) : null,
    /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
    t ? /* @__PURE__ */ e(x, { name: t, size: "sm" }) : null
  ] });
  if ("href" in c && c.href !== void 0) {
    const { href: p, rel: w, target: y, ...S } = c;
    return /* @__PURE__ */ e(
      "a",
      {
        className: u,
        href: p,
        ref: m,
        rel: y === "_blank" ? w ?? "noreferrer" : w,
        target: y,
        ...S,
        children: h
      }
    );
  }
  const {
    disabled: f = !1,
    loading: _ = !1,
    type: N = "button",
    ...g
  } = c;
  return /* @__PURE__ */ r(
    "button",
    {
      "aria-busy": _ || void 0,
      className: b(u, _ && "nim-button--loading"),
      disabled: f || _,
      ref: m,
      type: N,
      ...g,
      children: [
        _ ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-button__spinner" }) : null,
        _ ? /* @__PURE__ */ r(H, { children: [
          /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
          t ? /* @__PURE__ */ e(x, { name: t, size: "sm" }) : null
        ] }) : h
      ]
    }
  );
});
function Ea({ actions: n, className: l, description: i, icon: a = "search", title: t, ...s }) {
  return /* @__PURE__ */ r("div", { className: b("nim-empty", l), ...s, children: [
    /* @__PURE__ */ e("span", { className: "nim-empty__icon", children: /* @__PURE__ */ e(x, { name: a, size: "md" }) }),
    /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: t }),
    i ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-empty__body", children: i }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-empty__actions", children: n }) : null
  ] });
}
const $a = (n, l) => {
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
  return /* @__PURE__ */ r("nav", { "aria-label": l, className: b("nim-pagination", n), children: [
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
          children: /* @__PURE__ */ e(x, { name: "chevron-back", size: "sm" })
        }
      ),
      $a(t, s).map(
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
          children: /* @__PURE__ */ e(x, { name: "chevron-forward", size: "sm" })
        }
      )
    ] })
  ] });
}
function Se({ caption: n, className: l, columns: i, onSort: a, rowKey: t, rows: s, sort: d }) {
  return /* @__PURE__ */ e("div", { className: b("nim-table-wrap", l), children: /* @__PURE__ */ r("table", { className: "nim-table", children: [
    n ? /* @__PURE__ */ e("caption", { className: "nim-caption", children: n }) : null,
    /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ e("tr", { children: i.map((o) => {
      const c = (d == null ? void 0 : d.key) === o.key ? d.direction : void 0;
      return /* @__PURE__ */ e(
        "th",
        {
          "aria-sort": c,
          className: b(o.numeric && "nim-table__cell--numeric"),
          scope: "col",
          style: o.width ? { inlineSize: o.width } : void 0,
          children: o.sortable && a ? /* @__PURE__ */ r("button", { className: "nim-table__sort", onClick: () => a(o.key), type: "button", children: [
            o.header,
            c ? /* @__PURE__ */ e(x, { name: c === "ascending" ? "chevron-up" : "chevron-down", size: "xs" }) : null
          ] }) : o.header
        },
        o.key
      );
    }) }) }),
    /* @__PURE__ */ e("tbody", { children: s.map((o) => /* @__PURE__ */ e("tr", { children: i.map((c) => /* @__PURE__ */ e("td", { className: b(c.numeric && "nim-table__cell--numeric"), children: c.render(o) }, c.key)) }, t(o))) })
  ] }) });
}
function ze({ children: n, className: l, description: i, ...a }) {
  return /* @__PURE__ */ r("label", { className: b("nim-choice nim-choice--checkbox", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", type: "checkbox", ...a }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-checkbox__box", children: /* @__PURE__ */ e(x, { name: "check", size: "xs" }) }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
function Ba({ children: n, className: l, description: i, ...a }) {
  return /* @__PURE__ */ r("label", { className: b("nim-choice nim-choice--switch", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", role: "switch", type: "checkbox", ...a }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-switch__track", children: /* @__PURE__ */ e("span", { className: "nim-switch__thumb" }) }),
    /* @__PURE__ */ r("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
function wl({ children: n, className: l, description: i, ...a }) {
  const t = xe(He);
  return /* @__PURE__ */ r("label", { className: b("nim-choice nim-choice--radio", l), children: [
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
const He = Ce(null);
function Cl({
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
  const m = J(), u = d ?? `nim-radio-${m}`, h = a ? `${u}-hint` : void 0, f = i ? `${u}-error` : void 0;
  return /* @__PURE__ */ e(He.Provider, { value: { name: u, onChange: o, value: c }, children: /* @__PURE__ */ r(
    "fieldset",
    {
      "aria-describedby": [f, h].filter(Boolean).join(" ") || void 0,
      "aria-invalid": i ? !0 : void 0,
      className: b("nim-radio-group", i && "nim-radio-group--invalid", l),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-radio-group__legend", children: t }),
        /* @__PURE__ */ e("div", { className: b("nim-radio-group__options", `nim-radio-group__options--${s}`), children: n }),
        i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: f, children: i }) : null,
        a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: h, children: a }) : null
      ]
    }
  ) });
}
function Ge({ className: n, label: l = "Loading", size: i = "md", ...a }) {
  return /* @__PURE__ */ e(
    "span",
    {
      className: b("nim-spinner", i !== "md" && `nim-spinner--${i}`, n),
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
      className: b("nim-progress", t && "nim-progress--indeterminate", n),
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
      className: b("nim-skeleton", n),
      style: { blockSize: l, borderRadius: i, inlineSize: a },
      ...t
    }
  );
}
const Ra = (n) => Array.from({ length: n }, (l, i) => ({ __skeleton: i })), Oa = {
  selectAll: "Select all rows",
  selectRow: "Select row"
};
function xl({
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
  refreshing: f = !1,
  retryLabel: _ = "Try again",
  rowKey: N,
  rows: g,
  selection: p,
  skeletonRows: w = 6,
  sort: y,
  summary: S,
  toolbar: I
}) {
  const B = { ...Oa, ...s }, M = g.length > 0 && p ? g.every((k) => p.isSelected(k)) : !1, v = p ? [
    {
      header: p.onToggleAll ? /* @__PURE__ */ e(
        ze,
        {
          "aria-label": B.selectAll,
          checked: M,
          onChange: (k) => {
            var L;
            return (L = p.onToggleAll) == null ? void 0 : L.call(p, k.currentTarget.checked);
          }
        }
      ) : /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: B.selectAll }),
      key: "__select",
      render: (k) => {
        var L;
        return /* @__PURE__ */ e(
          ze,
          {
            "aria-label": ((L = p.label) == null ? void 0 : L.call(p, k)) ?? B.selectRow,
            checked: p.isSelected(k),
            onChange: (D) => p.onToggle(k, D.currentTarget.checked)
          }
        );
      },
      width: "2.5rem"
    },
    ...i
  ] : i;
  let T;
  return t ? T = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: /* @__PURE__ */ e(
    Ea,
    {
      actions: c ? /* @__PURE__ */ e(X, { onClick: c, size: "sm", variant: "secondary", children: _ }) : void 0,
      icon: "danger",
      title: t
    }
  ) }) : d ? T = /* @__PURE__ */ e(
    Se,
    {
      caption: n,
      columns: v.map((k) => ({
        ...k,
        render: () => /* @__PURE__ */ e(Fa, { height: "0.9em", width: k.numeric ? "3rem" : "70%" }),
        sortable: !1
      })),
      rowKey: (k) => `skeleton-${k.__skeleton}`,
      rows: Ra(w)
    }
  ) : g.length === 0 ? T = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: a }) : T = /* @__PURE__ */ e(
    Se,
    {
      caption: n,
      columns: v,
      onSort: m,
      rowKey: N,
      rows: g,
      sort: y
    }
  ), /* @__PURE__ */ r("div", { className: b("nim-data-table", l), "data-refreshing": f ? "true" : void 0, children: [
    I,
    /* @__PURE__ */ r("div", { className: "nim-data-table__body", children: [
      T,
      f ? /* @__PURE__ */ e("span", { className: "nim-data-table__pulse", children: /* @__PURE__ */ e(x, { name: "loading", size: "xs" }) }) : null
    ] }),
    u && h && h > 1 && o ? /* @__PURE__ */ e(Ia, { onChange: o, page: u, pageCount: h, summary: S }) : S ? /* @__PURE__ */ e("p", { className: "nim-data-table__summary", children: S }) : null
  ] });
}
function Ml({
  className: n,
  defaultOpen: l = [],
  items: i,
  mode: a = "multiple",
  onOpenChange: t,
  open: s,
  variant: d = "panel"
}) {
  const o = J(), [c, m] = E(l), u = s ?? c, h = (f) => {
    const _ = u.includes(f), N = a === "single" ? _ ? [] : [f] : _ ? u.filter((g) => g !== f) : [...u, f];
    s || m(N), t == null || t(N);
  };
  return /* @__PURE__ */ e("div", { className: b("nim-accordion", `nim-accordion--${d}`, n), children: i.map((f) => {
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
            /* @__PURE__ */ e(x, { className: "nim-accordion__chevron", name: "chevron-down", size: "sm" })
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
function Ua({ className: n, items: l, label: i, renderItem: a, value: t }) {
  return /* @__PURE__ */ e("nav", { "aria-label": i, className: b("nim-tab-bar", n), children: /* @__PURE__ */ e("div", { className: "nim-tab-bar__row", style: { "--nim-tab-count": l.length }, children: l.map((s) => {
    const d = s.key === t, o = /* @__PURE__ */ r(H, { children: [
      /* @__PURE__ */ e(x, { name: s.icon, size: s.center ? "lg" : "md" }),
      /* @__PURE__ */ e("span", { className: "nim-tab-bar__label", children: s.label })
    ] }), c = {
      "aria-current": d ? "page" : void 0,
      "aria-label": s.fullLabel ?? s.label,
      className: b("nim-tab-bar__item", s.center && "nim-tab-bar__item--center"),
      "data-active": d ? "true" : void 0
    };
    return a ? /* @__PURE__ */ e("div", { className: "nim-tab-bar__slot", children: a(s, o, c) }, s.key) : s.href ? /* @__PURE__ */ e("a", { href: s.href, ...c, children: o }, s.key) : /* @__PURE__ */ e("button", { onClick: s.onSelect, type: "button", ...c, children: o }, s.key);
  }) }) });
}
function Tl({ children: n, className: l, frame: i = "responsive", header: a, tabs: t }) {
  return /* @__PURE__ */ r("div", { className: b("nim-app-shell", l), "data-frame": i === "phone" ? "phone" : void 0, children: [
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
  return /* @__PURE__ */ r("section", { className: b("nim-auth", t), children: [
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
const Ha = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((l) => {
  var i;
  return ((i = l[0]) == null ? void 0 : i.toUpperCase()) ?? "";
}).join("");
function de({ className: n, name: l, shape: i = "round", size: a = "md", src: t, ...s }) {
  return /* @__PURE__ */ r(
    "span",
    {
      className: b("nim-avatar", a !== "md" && `nim-avatar--${a}`, i === "square" && "nim-avatar--square", n),
      ...s,
      children: [
        t ? /* @__PURE__ */ e("img", { alt: "", src: t }) : /* @__PURE__ */ e("span", { "aria-hidden": "true", children: Ha(l) }),
        /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: l })
      ]
    }
  );
}
function Sl({
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
      className: b("nim-avatar-ring", l),
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
function Ga({
  actions: n,
  avatar: l,
  chips: i,
  className: a,
  eyebrow: t,
  name: s,
  stats: d = []
}) {
  return /* @__PURE__ */ r("section", { className: b("nim-profile-header", a), children: [
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
      className: b(
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
      className: b("nim-banner", `nim-banner--${s}`, i),
      role: s === "danger" ? "alert" : "status",
      ...d,
      children: [
        /* @__PURE__ */ e(x, { className: "nim-banner__icon", name: a ?? Wa[s], size: "sm" }),
        /* @__PURE__ */ r("div", { className: "nim-banner__content", children: [
          t ? /* @__PURE__ */ e("p", { className: "nim-banner__title", children: t }) : null,
          /* @__PURE__ */ e("div", { children: l })
        ] }),
        n ? /* @__PURE__ */ e("div", { className: "nim-banner__action", children: n }) : null
      ]
    }
  );
}
function zl({ className: n, items: l, label: i = "Breadcrumb" }) {
  return /* @__PURE__ */ e("nav", { "aria-label": i, className: b("nim-breadcrumb", n), children: l.map((a, t) => {
    const s = t === l.length - 1;
    return /* @__PURE__ */ r(ke, { children: [
      t > 0 ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-breadcrumb__separator", children: /* @__PURE__ */ e(x, { name: "chevron-forward", size: "xs" }) }) : null,
      s || !a.href ? /* @__PURE__ */ e("span", { "aria-current": s ? "page" : void 0, className: "nim-breadcrumb__current", children: a.label }) : /* @__PURE__ */ e("a", { className: "nim-breadcrumb__link", href: a.href, children: a.label })
    ] }, a.label);
  }) });
}
function Dl({
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
      className: b(
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
function Al({
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
  return /* @__PURE__ */ r("label", { className: b("nim-option-card", c && "nim-option-card--selected", l), children: [
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
    s ? /* @__PURE__ */ e("span", { className: "nim-option-card__icon", children: /* @__PURE__ */ e(x, { name: s, size: "md" }) }) : null,
    /* @__PURE__ */ r("span", { className: "nim-option-card__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-option-card__title", children: m }),
      i ? /* @__PURE__ */ e("span", { className: "nim-option-card__description", children: i }) : null,
      c && a ? /* @__PURE__ */ e("span", { className: "nim-option-card__detail", children: a }) : null
    ] }),
    n ? /* @__PURE__ */ e("span", { className: "nim-option-card__badge", children: n }) : null,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-option-card__dot" })
  ] });
}
function Ll({ className: n, items: l, title: i, totals: a = [] }) {
  return /* @__PURE__ */ r("section", { className: b("nim-summary", n), children: [
    i ? /* @__PURE__ */ e("h2", { className: "nim-summary__title", children: i }) : null,
    /* @__PURE__ */ e("dl", { className: "nim-summary__lines", children: l.map((t) => /* @__PURE__ */ r("div", { className: "nim-summary__line", children: [
      /* @__PURE__ */ r("dt", { children: [
        /* @__PURE__ */ e("span", { className: "nim-summary__label", children: t.label }),
        t.meta ? /* @__PURE__ */ e("span", { className: "nim-summary__meta", children: t.meta }) : null
      ] }),
      /* @__PURE__ */ e("dd", { className: "nim-summary__value", children: t.value })
    ] }, t.key)) }),
    a.length ? /* @__PURE__ */ r(H, { children: [
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
function El({ action: n, className: l, note: i, total: a }) {
  return /* @__PURE__ */ r("div", { className: b("nim-action-bar", l), children: [
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
  const [t, s] = E({ left: 0, top: 0 }), d = U(null), o = Z(() => {
    const c = n.current, m = l.current;
    if (!c || !m) return;
    const u = c.getBoundingClientRect(), { height: h, width: f } = m.getBoundingClientRect(), _ = 4, N = 8, g = getComputedStyle(c).direction === "rtl", p = u.bottom + _, y = p + h > window.innerHeight && u.top - _ - h > 0 ? u.top - _ - h : p, S = g ? u.right - f : u.left, I = Math.min(Math.max(S, N), window.innerWidth - f - N);
    s({ left: I, top: y });
  }, [l, n]);
  return en(() => {
    a && o();
  }, [a, o]), V(() => {
    if (!a) return;
    d.current = document.activeElement;
    const c = (u) => {
      u.key === "Escape" && (u.stopPropagation(), i());
    }, m = (u) => {
      var f, _;
      const h = u.target;
      (f = l.current) != null && f.contains(h) || (_ = n.current) != null && _.contains(h) || i();
    };
    return window.addEventListener("keydown", c), window.addEventListener("pointerdown", m), window.addEventListener("resize", o), window.addEventListener("scroll", o, !0), () => {
      var u, h;
      window.removeEventListener("keydown", c), window.removeEventListener("pointerdown", m), window.removeEventListener("resize", o), window.removeEventListener("scroll", o, !0), (h = (u = d.current) == null ? void 0 : u.focus) == null || h.call(u);
    };
  }, [i, a, l, o, n]), t;
}
const Ya = (n) => n.kind === void 0 || n.kind === "action";
function De({ children: n, className: l, items: i, label: a }) {
  const [t, s] = E(!1), [d, o] = E(0), c = U(null), m = U(null), u = Ke(c, m, { onDismiss: () => s(!1), open: t }), f = i.filter(Ya).filter((p) => !p.disabled), _ = () => {
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
        const w = f[d];
        w && N(w);
      }
    }
  };
  return /* @__PURE__ */ r(H, { children: [
    n({ open: t, ref: c, toggle: _ }),
    t && typeof document < "u" ? he(
      /* @__PURE__ */ e(
        "div",
        {
          "aria-label": a,
          className: b("nim-menu", l),
          onKeyDown: g,
          ref: m,
          role: "menu",
          style: { insetBlockStart: u.top, insetInlineStart: u.left },
          tabIndex: -1,
          children: i.map((p, w) => p.kind === "separator" ? /* @__PURE__ */ e("hr", { className: "nim-menu__separator" }, `sep-${w}`) : p.kind === "heading" ? /* @__PURE__ */ e("p", { className: "nim-menu__label", children: p.label }, `head-${w}`) : /* @__PURE__ */ r(
            "button",
            {
              className: b("nim-menu__item", p.danger && "nim-menu__item--danger"),
              "data-active": f.indexOf(p) === d ? "true" : void 0,
              disabled: p.disabled,
              onClick: () => N(p),
              onPointerEnter: () => o(f.indexOf(p)),
              role: "menuitem",
              type: "button",
              children: [
                p.icon ? /* @__PURE__ */ e(x, { className: "nim-menu__icon", name: p.icon, size: "sm" }) : null,
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
function ja({ children: n, className: l, label: i, onClose: a, open: t, triggerRef: s }) {
  const d = U(null), o = Ke(s, d, { onDismiss: a, open: t });
  return !t || typeof document > "u" ? null : he(
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": i,
        className: b("nim-popover", l),
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
  const a = U(null), [t, s] = E(!1), [d, o] = E(0), c = n.duration ?? 0, m = Y(
    () => n.waveform ?? Array.from({ length: 32 }, (h, f) => 0.35 + f * 7 % 11 / 18),
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
        /* @__PURE__ */ e("span", { className: "nim-chat-file__icon", children: /* @__PURE__ */ e(x, { name: "document", size: "md" }) }),
        /* @__PURE__ */ r("span", { className: "nim-chat-file__text", children: [
          /* @__PURE__ */ e("span", { className: "nim-chat-file__name", children: n.name ?? l.download }),
          n.size !== void 0 ? /* @__PURE__ */ e("span", { className: "nim-chat-file__size", children: Xa(n.size, i) }) : null
        ] }),
        /* @__PURE__ */ e(x, { className: "nim-chat-file__action", name: "download", size: "sm" })
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
  runGap: f = 300,
  typing: _
}) {
  const N = { ...Va, ...d }, g = U(null), p = U(!0), w = Y(
    () => new Intl.DateTimeFormat(o, { hour: "2-digit", minute: "2-digit" }),
    [o]
  ), y = Y(
    () => new Intl.DateTimeFormat(o, { day: "numeric", month: "long", weekday: "long" }),
    [o]
  ), S = Y(() => {
    const I = ce((/* @__PURE__ */ new Date()).toISOString());
    return c.map((B, M) => {
      const v = c[M - 1], T = c[M + 1], k = B.at ? ce(B.at) : null, L = v != null && v.at ? ce(v.at) : null, D = k !== null && k !== L ? k === I ? N.today : k === I - Qa ? N.yesterday : y.format(new Date(B.at)) : null, A = (P, C) => {
        var F, W;
        return !!P && !(P != null && P.system) && !C.system && !!(P != null && P.own) == !!C.own && ((F = P == null ? void 0 : P.author) == null ? void 0 : F.name) === ((W = C.author) == null ? void 0 : W.name);
      }, $ = (P, C) => !(P != null && P.at) || !C.at || Math.abs(new Date(C.at).getTime() - new Date(P.at).getTime()) <= f * 1e3, G = D !== null || !A(v, B) || !$(v, B), K = !T || (T.at ? ce(T.at) : null) !== k || !A(T, B) || !$(B, T);
      return { divider: D, first: G, last: K, message: B };
    });
  }, [y, c, f, N.today, N.yesterday]);
  return V(() => {
    const I = g.current;
    !I || !p.current || (I.scrollTop = I.scrollHeight);
  }, [c, _]), /* @__PURE__ */ r("section", { className: b("nim-chat", l), children: [
    s ? /* @__PURE__ */ e("header", { className: "nim-chat__header", children: s }) : null,
    /* @__PURE__ */ r(
      "div",
      {
        className: "nim-chat__scroll",
        onScroll: (I) => {
          const B = I.currentTarget;
          p.current = B.scrollHeight - B.scrollTop - B.clientHeight < 48;
        },
        ref: g,
        children: [
          /* @__PURE__ */ e("ol", { "aria-live": "polite", className: "nim-chat__list", children: S.map(({ divider: I, first: B, last: M, message: v }) => {
            var L, D;
            if (v.system)
              return /* @__PURE__ */ r(ke, { children: [
                I ? /* @__PURE__ */ e("li", { className: "nim-chat__day", children: I }) : null,
                /* @__PURE__ */ e("li", { className: "nim-chat__system", children: v.text })
              ] }, v.id);
            const T = (n == null ? void 0 : n(v)) ?? [], k = B && !v.own && (t || !!v.author);
            return /* @__PURE__ */ r(ke, { children: [
              I ? /* @__PURE__ */ e("li", { className: "nim-chat__day", children: I }) : null,
              /* @__PURE__ */ r(
                "li",
                {
                  className: b("nim-chat-message", v.own && "nim-chat-message--own"),
                  "data-first": B ? "true" : void 0,
                  "data-last": M ? "true" : void 0,
                  id: `nim-message-${v.id}`,
                  children: [
                    v.own ? null : /* @__PURE__ */ e("span", { className: "nim-chat-message__gutter", children: M && v.author ? /* @__PURE__ */ e(de, { name: v.author.name, size: "sm", src: v.author.avatar }) : null }),
                    /* @__PURE__ */ r("div", { className: "nim-chat-message__stack", children: [
                      k && v.author ? /* @__PURE__ */ e("span", { className: "nim-chat-message__author", children: v.author.name }) : null,
                      /* @__PURE__ */ r("div", { className: "nim-chat-message__row", children: [
                        /* @__PURE__ */ r("div", { className: "nim-chat-message__bubble", "data-deleted": v.deleted ? "true" : void 0, children: [
                          v.replyTo ? /* @__PURE__ */ r(
                            "button",
                            {
                              className: "nim-chat-quote",
                              disabled: !m,
                              onClick: () => m == null ? void 0 : m(v.replyTo.id),
                              type: "button",
                              children: [
                                /* @__PURE__ */ e("span", { className: "nim-chat-quote__author", children: v.replyTo.author }),
                                /* @__PURE__ */ e("span", { className: "nim-chat-quote__text", children: v.replyTo.text })
                              ]
                            }
                          ) : null,
                          v.deleted ? /* @__PURE__ */ r("p", { className: "nim-chat-message__text nim-chat-message__text--gone", children: [
                            /* @__PURE__ */ e(x, { name: "trash", size: "xs" }),
                            " ",
                            N.deleted
                          ] }) : /* @__PURE__ */ r(H, { children: [
                            (L = v.attachments) == null ? void 0 : L.map((A, $) => /* @__PURE__ */ e(
                              ei,
                              {
                                attachment: A,
                                labels: N,
                                locale: o
                              },
                              `${v.id}-${$}`
                            )),
                            v.card ? /* @__PURE__ */ e("div", { className: "nim-chat-card", children: v.card }) : null,
                            v.text ? /* @__PURE__ */ e("p", { className: "nim-chat-message__text", children: v.text }) : null
                          ] })
                        ] }),
                        !v.deleted && (T.length > 0 || u) ? /* @__PURE__ */ r("div", { className: "nim-chat-message__tools", children: [
                          u ? /* @__PURE__ */ e(
                            De,
                            {
                              className: "nim-chat-picker",
                              items: h.map((A) => ({
                                label: A,
                                onSelect: () => u(v, A)
                              })),
                              label: N.react,
                              children: ({ ref: A, toggle: $ }) => /* @__PURE__ */ e(
                                O,
                                {
                                  label: N.react,
                                  name: "emoji",
                                  onClick: $,
                                  ref: A,
                                  size: "sm"
                                }
                              )
                            }
                          ) : null,
                          T.length > 0 ? /* @__PURE__ */ e(De, { items: T, label: N.more, children: ({ ref: A, toggle: $ }) => /* @__PURE__ */ e(
                            O,
                            {
                              label: N.more,
                              name: "more",
                              onClick: $,
                              ref: A,
                              size: "sm"
                            }
                          ) }) : null
                        ] }) : null
                      ] }),
                      (D = v.reactions) != null && D.length ? /* @__PURE__ */ e(ni, { labels: N, message: v, onReact: u }) : null,
                      M ? /* @__PURE__ */ r("span", { className: "nim-chat-message__meta", children: [
                        v.at ? /* @__PURE__ */ e("time", { dateTime: v.at, children: w.format(new Date(v.at)) }) : null,
                        v.edited ? /* @__PURE__ */ e("span", { children: N.edited }) : null,
                        v.own && v.status ? /* @__PURE__ */ e("span", { className: "nim-chat-message__status", "data-status": v.status, children: v.status === "sending" ? /* @__PURE__ */ e(Ge, { size: "sm" }) : /* @__PURE__ */ e(
                          x,
                          {
                            label: N[v.status],
                            name: v.status === "failed" ? "danger" : "check-circle",
                            size: "xs"
                          }
                        ) }) : null
                      ] }) : null
                    ] })
                  ]
                }
              )
            ] }, v.id);
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
function Il({
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
  const u = { ...ai, ...t }, h = U(null), f = U(!0), [_, N] = E(null), g = m.some((p) => p.streaming);
  return V(() => {
    const p = h.current;
    !p || !f.current || (p.scrollTop = p.scrollHeight);
  }, [m]), /* @__PURE__ */ r("section", { className: b("nim-assistant", l), children: [
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
              /* @__PURE__ */ e("span", { className: "nim-turn__mark", children: p.role === "assistant" ? /* @__PURE__ */ e("span", { className: "nim-turn__badge", children: /* @__PURE__ */ e(x, { name: (n == null ? void 0 : n.icon) ?? "sparkle", size: "sm" }) }) : null }),
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
                        /* @__PURE__ */ e(x, { name: _ === p.id ? "chevron-down" : "chevron-forward", size: "xs" }),
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
                      children: p.steps.map((S) => /* @__PURE__ */ r("li", { className: "nim-turn__step", "data-status": S.status, children: [
                        /* @__PURE__ */ e(
                          x,
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
                (y = p.sources) != null && y.length ? /* @__PURE__ */ r("ul", { className: "nim-turn__sources", children: [
                  /* @__PURE__ */ e("li", { className: "nim-turn__sources-label", children: u.sources }),
                  p.sources.map((S, I) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r("a", { className: "nim-turn__source", href: S.href, rel: "noreferrer", target: "_blank", children: [
                    /* @__PURE__ */ e("span", { className: "nim-turn__source-index", children: I + 1 }),
                    S.title
                  ] }) }, I))
                ] }) : null,
                p.role === "assistant" && !p.streaming && (s || o || d) ? /* @__PURE__ */ r("div", { className: "nim-turn__actions", children: [
                  s ? /* @__PURE__ */ e(O, { label: u.copy, name: "copy", onClick: () => s(p), size: "sm" }) : null,
                  o ? /* @__PURE__ */ e(O, { label: u.retry, name: "refresh", onClick: () => o(p), size: "sm" }) : null,
                  d ? /* @__PURE__ */ r(H, { children: [
                    /* @__PURE__ */ e(O, { label: u.up, name: "trend-up", onClick: () => d(p, "up"), size: "sm" }),
                    /* @__PURE__ */ e(O, { label: u.down, name: "trend-down", onClick: () => d(p, "down"), size: "sm" })
                  ] }) : null
                ] }) : null
              ] })
            ] }, p.id);
          }) }),
          g && c ? /* @__PURE__ */ e("div", { className: "nim-assistant__stop", children: /* @__PURE__ */ r("button", { className: "nim-assistant__stop-button", onClick: c, type: "button", children: [
            /* @__PURE__ */ e(x, { name: "stop", size: "sm" }),
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
function Bl({
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
  const f = J(), [_, N] = E(null), g = Y(
    () => i ?? ((v) => new Intl.NumberFormat(d).format(v)),
    [i, d]
  ), p = Y(() => {
    const v = u.flatMap((P) => P.values).filter((P) => P !== null), T = c ?? Math.min(...v, 0), k = o ?? Math.max(...v, 0), L = t === "bar" ? Math.min(0, T) : T, D = k === L ? L + 1 : k, A = ii(D - L, 4), $ = Math.floor(L / A) * A, G = Math.ceil(D / A) * A, K = [];
    for (let P = $; P <= G + A / 2; P += A) K.push(Number(P.toFixed(6)));
    return { bottom: $, ticks: K, top: G };
  }, [t, o, c, u]), w = a - Le * 2, y = (v) => Le + w - (v - p.bottom) / (p.top - p.bottom) * w, S = be / Math.max(1, n.length), I = (v) => S * v + S / 2, B = (v, T) => {
    let k = "", L = !1;
    if (v.forEach((G, K) => {
      if (G === null) {
        L = !1;
        return;
      }
      k += `${L ? "L" : "M"}${I(K).toFixed(2)} ${y(G).toFixed(2)}`, L = !0;
    }), !T || !k) return k;
    const D = v.map((G, K) => G === null ? null : K).filter((G) => G !== null), A = D[0], $ = D[D.length - 1];
    return `${k}L${I($).toFixed(2)} ${y(p.bottom).toFixed(2)}L${I(A).toFixed(2)} ${y(p.bottom).toFixed(2)}Z`;
  }, M = S * 0.62 / u.length;
  return /* @__PURE__ */ r(
    "figure",
    {
      "aria-labelledby": h ? f : void 0,
      className: b("nim-chart", l),
      "data-kind": t,
      children: [
        h || m ? /* @__PURE__ */ r("figcaption", { className: "nim-chart__head", children: [
          h ? /* @__PURE__ */ e("span", { className: "nim-chart__title", id: f, children: h }) : null,
          m ? /* @__PURE__ */ e("span", { className: "nim-chart__note", children: m }) : null
        ] }) : null,
        /* @__PURE__ */ r("div", { className: "nim-chart__frame", children: [
          /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-chart__axis", children: [...p.ticks].reverse().map((v) => /* @__PURE__ */ e("span", { className: "nim-chart__tick", children: g(v) }, v)) }),
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
                  p.ticks.map((v) => /* @__PURE__ */ e(
                    "line",
                    {
                      className: "nim-chart__rule",
                      x1: 0,
                      x2: be,
                      y1: y(v),
                      y2: y(v)
                    },
                    v
                  )),
                  u.map((v, T) => {
                    const k = `var(--nim-series-${v.series ?? T % 6 + 1})`;
                    return t === "bar" ? /* @__PURE__ */ e("g", { children: v.values.map(
                      (L, D) => L === null ? null : /* @__PURE__ */ e(
                        "rect",
                        {
                          className: "nim-chart__bar",
                          fill: k,
                          height: Math.abs(y(L) - y(Math.max(p.bottom, 0))),
                          width: M,
                          x: I(D) - M * u.length / 2 + M * T,
                          y: Math.min(y(L), y(Math.max(p.bottom, 0)))
                        },
                        D
                      )
                    ) }, v.label) : /* @__PURE__ */ r("g", { children: [
                      t === "area" ? /* @__PURE__ */ e("path", { className: "nim-chart__area", d: B(v.values, !0), fill: k }) : null,
                      /* @__PURE__ */ e("path", { className: "nim-chart__line", d: B(v.values, !1), stroke: k }),
                      v.values.map(
                        (L, D) => L === null ? null : /* @__PURE__ */ e(
                          "circle",
                          {
                            className: "nim-chart__dot",
                            cx: I(D),
                            cy: y(L),
                            "data-on": _ === D ? "true" : void 0,
                            fill: k,
                            r: 4
                          },
                          D
                        )
                      )
                    ] }, v.label);
                  })
                ]
              }
            ),
            /* @__PURE__ */ r("div", { className: "nim-chart__hits", children: [
              n.map((v, T) => /* @__PURE__ */ e(
                "button",
                {
                  className: "nim-chart__hit",
                  "data-on": _ === T ? "true" : void 0,
                  onBlur: () => N(null),
                  onFocus: () => N(T),
                  onMouseEnter: () => N(T),
                  onMouseLeave: () => N(null),
                  type: "button",
                  children: /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: v })
                },
                T
              )),
              _ !== null ? /* @__PURE__ */ r(
                "div",
                {
                  className: "nim-chart__tip",
                  style: { insetInlineStart: `${(_ + 0.5) / n.length * 100}%` },
                  children: [
                    /* @__PURE__ */ e("span", { className: "nim-chart__tip-label", children: n[_] }),
                    u.map((v, T) => /* @__PURE__ */ r("span", { className: "nim-chart__tip-row", children: [
                      /* @__PURE__ */ e("i", { style: { background: `var(--nim-series-${v.series ?? T % 6 + 1})` } }),
                      /* @__PURE__ */ e("span", { className: "nim-chart__tip-name", children: v.label }),
                      /* @__PURE__ */ e("span", { className: "nim-chart__tip-value", children: v.values[_] === null ? "—" : g(v.values[_]) })
                    ] }, v.label))
                  ]
                }
              ) : null
            ] }),
            /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-chart__categories", children: n.map((v, T) => /* @__PURE__ */ e("span", { className: "nim-chart__category", children: v }, T)) })
          ] })
        ] }),
        s ?? u.length > 1 ? /* @__PURE__ */ e("ul", { "aria-hidden": "true", className: "nim-chart__legend", children: u.map((v, T) => /* @__PURE__ */ r("li", { className: "nim-chart__key", children: [
          /* @__PURE__ */ e("i", { style: { background: `var(--nim-series-${v.series ?? T % 6 + 1})` } }),
          v.label
        ] }, v.label)) }) : null,
        /* @__PURE__ */ r("table", { className: "nim-visually-hidden", children: [
          h ? /* @__PURE__ */ e("caption", { children: h }) : null,
          /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ r("tr", { children: [
            /* @__PURE__ */ e("th", { scope: "col" }),
            u.map((v) => /* @__PURE__ */ e("th", { scope: "col", children: v.label }, v.label))
          ] }) }),
          /* @__PURE__ */ e("tbody", { children: n.map((v, T) => /* @__PURE__ */ r("tr", { children: [
            /* @__PURE__ */ e("th", { scope: "row", children: v }),
            u.map((k) => /* @__PURE__ */ e("td", { children: k.values[T] === null ? "—" : g(k.values[T]) }, k.label))
          ] }, T)) })
        ] })
      ]
    }
  );
}
function Pl({ className: n, label: l, series: i = 1, values: a }) {
  const t = Math.min(...a), d = Math.max(...a) - t || 1, o = a.map((c, m) => {
    const u = m / Math.max(1, a.length - 1) * 100, h = 24 - (c - t) / d * 20 - 2;
    return `${m === 0 ? "M" : "L"}${u.toFixed(2)} ${h.toFixed(2)}`;
  }).join("");
  return /* @__PURE__ */ r(
    "svg",
    {
      className: b("nim-sparkline", n),
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
  return /* @__PURE__ */ e("div", { className: b("nim-rooms", l), children: s.map((c) => /* @__PURE__ */ r("section", { className: "nim-rooms__section", children: [
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
          /* @__PURE__ */ e("span", { className: "nim-room__face", children: m.kind === "channel" ? /* @__PURE__ */ e("span", { className: "nim-room__glyph", children: /* @__PURE__ */ e(x, { name: "hash", size: "sm" }) }) : /* @__PURE__ */ e(de, { name: m.name, size: "sm", src: m.avatar }) }),
          /* @__PURE__ */ r("span", { className: "nim-room__body", children: [
            /* @__PURE__ */ r("span", { className: "nim-room__top", children: [
              /* @__PURE__ */ r("span", { className: "nim-room__name", children: [
                m.name,
                m.muted ? /* @__PURE__ */ e(x, { className: "nim-room__mute", label: d.muted, name: "volume-off", size: "xs" }) : null
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
                /* @__PURE__ */ e(x, { name: li[m.kind], size: "xs" }),
                o.format(m.members)
              ] }) : null
            ] })
          ] })
        ]
      }
    ) }, m.id)) })
  ] }, c.key)) });
}
function Fl({
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
  return /* @__PURE__ */ r("div", { className: b("nim-messenger", a), "data-open": n ? "true" : void 0, children: [
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
function Rl({ actions: n, avatar: l, className: i, kind: a = "direct", members: t, meta: s, name: d }) {
  return /* @__PURE__ */ r("div", { className: b("nim-room-head", i), children: [
    a === "channel" ? /* @__PURE__ */ e("span", { className: "nim-room__glyph", children: /* @__PURE__ */ e(x, { name: "hash", size: "sm" }) }) : /* @__PURE__ */ e(de, { name: d, size: "md", src: l }),
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
function Ol({
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
  const h = { ...ri, ...t }, f = J();
  return /* @__PURE__ */ r(
    "section",
    {
      "aria-labelledby": f,
      className: b("nim-map", i),
      style: { aspectRatio: `${c}` },
      children: [
        /* @__PURE__ */ e("h3", { className: "nim-visually-hidden", id: f, children: u }),
        /* @__PURE__ */ e("div", { className: "nim-map__tiles", children: m }),
        /* @__PURE__ */ e("ul", { className: "nim-map__markers", children: s.map((_) => {
          const N = ci(_, l), g = { insetBlockStart: `${N.y}%`, insetInlineStart: `${N.x}%` };
          return /* @__PURE__ */ e("li", { className: "nim-map__marker", "data-self": _.self ? "true" : void 0, style: g, children: d ? /* @__PURE__ */ r("button", { className: "nim-map__pin", "data-tone": _.tone, onClick: () => d(_), type: "button", children: [
            _.self ? /* @__PURE__ */ e("span", { className: "nim-map__dot" }) : /* @__PURE__ */ e(x, { name: "globe", size: "sm" }),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: _.label })
          ] }) : /* @__PURE__ */ r("span", { className: "nim-map__pin", "data-tone": _.tone, children: [
            _.self ? /* @__PURE__ */ e("span", { className: "nim-map__dot" }) : /* @__PURE__ */ e(x, { name: "globe", size: "sm" }),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: _.label })
          ] }) }, _.id);
        }) }),
        o || a ? /* @__PURE__ */ r("div", { className: "nim-map__controls", children: [
          a,
          o ? /* @__PURE__ */ r(H, { children: [
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
function Ul({
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
  const h = { ...oi, ...a }, f = U(null), _ = U(null), [N, g] = E(!1), [p, w] = E(0), [y, S] = E(0), [I, B] = E(0), [M, v] = E(n), [T, k] = E(1), [L, D] = E(1), A = y > 0 ? p / y : 0, $ = Y(() => u ?? null, [u]), G = Z(() => {
    const C = f.current;
    C && (C.paused ? C.play() : C.pause());
  }, []);
  V(() => {
    const C = f.current;
    C && (C.playbackRate = L);
  }, [L]);
  const K = (C) => {
    const F = C.buffered;
    B(F.length ? F.end(F.length - 1) : 0);
  }, P = {
    onDurationChange: (C) => S(Number.isFinite(C.currentTarget.duration) ? C.currentTarget.duration : 0),
    onEnded: () => g(!1),
    onPause: () => g(!1),
    onPlay: () => g(!0),
    onProgress: (C) => K(C.currentTarget),
    onTimeUpdate: (C) => w(C.currentTarget.currentTime),
    onVolumeChange: (C) => {
      v(C.currentTarget.muted), k(C.currentTarget.volume);
    },
    onError: s
  };
  return /* @__PURE__ */ r(
    "div",
    {
      className: b("nim-player", l),
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
              poster: d,
              preload: "metadata",
              ref: (C) => {
                f.current = C;
              },
              src: c,
              ...P
            }
          ),
          /* @__PURE__ */ e(
            "button",
            {
              "aria-label": N ? h.pause : h.play,
              className: "nim-player__surface",
              onClick: G,
              type: "button",
              children: N ? null : /* @__PURE__ */ e("span", { className: "nim-player__badge", children: /* @__PURE__ */ e(x, { name: "play", size: "lg" }) })
            }
          )
        ] }) : /* @__PURE__ */ e(
          "audio",
          {
            autoPlay: n,
            preload: "metadata",
            ref: (C) => {
              f.current = C;
            },
            src: c,
            ...P
          }
        ),
        /* @__PURE__ */ r("div", { className: "nim-player__transport", children: [
          /* @__PURE__ */ e(
            O,
            {
              label: N ? h.pause : h.play,
              name: N ? "pause" : "play",
              onClick: G,
              size: "md",
              variant: "solid"
            }
          ),
          /* @__PURE__ */ r("div", { className: "nim-player__track", children: [
            m ? /* @__PURE__ */ e("span", { className: "nim-player__title", children: m }) : null,
            /* @__PURE__ */ r("div", { className: "nim-player__rail", "data-wave": $ ? "true" : void 0, children: [
              $ ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-player__wave", children: $.map((C, F) => /* @__PURE__ */ e(
                "i",
                {
                  "data-played": F / $.length <= A ? "true" : void 0,
                  style: { blockSize: `${Math.max(8, Math.round(C * 100))}%` }
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
                  "aria-valuetext": `${oe(p, t)} / ${oe(y, t)}`,
                  className: "nim-player__seek",
                  max: y || 0,
                  min: 0,
                  onChange: (C) => {
                    const F = Number(C.target.value);
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
                onClick: () => D(o[(o.indexOf(L) + 1) % o.length] ?? 1),
                type: "button",
                children: [
                  new Intl.NumberFormat(t).format(L),
                  "×"
                ]
              }
            ) : null,
            /* @__PURE__ */ e(
              O,
              {
                label: M ? h.unmute : h.mute,
                name: M || T === 0 ? "volume-off" : "volume",
                onClick: () => {
                  const C = f.current;
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
                  const F = f.current;
                  F && (F.volume = Number(C.target.value), F.muted = Number(C.target.value) === 0);
                },
                step: 0.05,
                type: "range",
                value: M ? 0 : T
              }
            ),
            i === "video" ? /* @__PURE__ */ e(
              O,
              {
                label: h.fullscreen,
                name: "expand",
                onClick: () => {
                  var C, F;
                  document.fullscreenElement ? document.exitFullscreen() : (F = (C = _.current) == null ? void 0 : C.requestFullscreen) == null || F.call(C);
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
function Hl({
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
  const h = { ...di, ...t }, f = { file: !0, video: !0, voice: !0, ...l }, [_, N] = E(""), [g, p] = E([]), [w, y] = E(!1), [S, I] = E(0), [B] = E(mi), M = U([]), v = U(null), T = U(null), k = U(null), L = U(0), D = U([]), A = U(null), $ = Z(() => {
    var z;
    (z = k.current) == null || z.stream.getTracks().forEach((R) => R.stop()), k.current = null;
  }, []);
  V(() => $, [$]), V(() => {
    var z;
    u && ((z = A.current) == null || z.focus());
  }, [u]), V(() => {
    if (!w) return;
    const z = window.setInterval(() => I((Date.now() - L.current) / 1e3), 200);
    return () => window.clearInterval(z);
  }, [w]);
  const G = Z(
    (z) => {
      if (!(z != null && z.length)) return;
      const R = Array.from(z);
      M.current = [...M.current, ...R], p((q) => [
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
  ), K = Z(async () => {
    try {
      const z = await navigator.mediaDevices.getUserMedia({ audio: !0 }), R = new MediaRecorder(z);
      D.current = [], R.ondataavailable = (q) => {
        q.data.size && D.current.push(q.data);
      }, R.onstop = () => {
        const q = new Blob(D.current, { type: R.mimeType }), Q = new File([q], "voice-message", { type: R.mimeType });
        M.current = [...M.current, Q], p((re) => [
          ...re,
          {
            duration: (Date.now() - L.current) / 1e3,
            kind: "voice",
            size: q.size,
            url: URL.createObjectURL(q)
          }
        ]), $();
      }, k.current = R, R.start(), L.current = Date.now(), I(0), y(!0);
    } catch {
      y(!1), $();
    }
  }, [$]), P = Z(
    (z) => {
      const R = k.current;
      y(!1), R && (z || (R.onstop = $), R.stop());
    },
    [$]
  ), C = (z) => {
    p((R) => (URL.revokeObjectURL(R[z].url), R.filter((q, Q) => Q !== z))), M.current = M.current.filter((R, q) => q !== z);
  }, F = () => {
    var z;
    !_.trim() && g.length === 0 || (o({ attachments: g, text: _.trim() }), d == null || d(M.current), M.current = [], p([]), N(""), (z = A.current) == null || z.focus());
  }, W = !_.trim() && g.length === 0;
  return /* @__PURE__ */ r("div", { className: b("nim-composer", i), children: [
    u ? /* @__PURE__ */ r("div", { className: "nim-composer__reply", children: [
      /* @__PURE__ */ e(x, { className: "nim-composer__reply-mark", name: "reply", size: "sm" }),
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
    g.length ? /* @__PURE__ */ e("ul", { className: "nim-composer__tray", children: g.map((z, R) => /* @__PURE__ */ r("li", { className: "nim-composer__chip", children: [
      /* @__PURE__ */ e(
        x,
        {
          name: z.kind === "voice" ? "mic" : z.kind === "video" ? "video" : z.kind === "image" ? "camera" : "document",
          size: "xs"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-composer__chip-name", children: z.name ?? h.record }),
      /* @__PURE__ */ e(
        O,
        {
          label: h.discard,
          name: "close",
          onClick: () => C(R),
          size: "sm"
        }
      )
    ] }, z.url)) }) : null,
    /* @__PURE__ */ e("div", { className: "nim-composer__row", children: w ? /* @__PURE__ */ r("div", { className: "nim-composer__recording", role: "status", children: [
      /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-composer__pulse" }),
      /* @__PURE__ */ e("span", { className: "nim-composer__recording-label", children: h.recording }),
      /* @__PURE__ */ r("span", { className: "nim-composer__elapsed", children: [
        S.toFixed(1),
        "s"
      ] }),
      /* @__PURE__ */ e(
        O,
        {
          label: h.cancel,
          name: "close",
          onClick: () => P(!1),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e(
        O,
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
        O,
        {
          disabled: a,
          label: h.attach,
          name: "paperclip",
          onClick: () => {
            var z;
            return (z = v.current) == null ? void 0 : z.click();
          },
          size: "sm"
        }
      ) : null,
      f.video ? /* @__PURE__ */ e(
        O,
        {
          disabled: a,
          label: h.video,
          name: "video",
          onClick: () => {
            var z;
            return (z = T.current) == null ? void 0 : z.click();
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
            N(z.target.value), c == null || c();
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
      f.voice && B && W ? /* @__PURE__ */ e(
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
          G(z.target.files), z.target.value = "";
        },
        ref: v,
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
          G(z.target.files), z.target.value = "";
        },
        ref: T,
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
      className: b("nim-chip", m && "nim-chip--interactive", l),
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
              a ? /* @__PURE__ */ e(x, { name: a, size: "xs" }) : null,
              n
            ]
          }
        ) : /* @__PURE__ */ r("span", { className: "nim-chip__body", children: [
          a ? /* @__PURE__ */ e(x, { name: a, size: "xs" }) : null,
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
            children: /* @__PURE__ */ e(x, { name: "close", size: "xs" })
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
    if (c.includes(g.key)) {
      if (g.key === "Tab" && !h.trim()) return;
      g.preventDefault(), _();
      return;
    }
    g.key === "Backspace" && !h && u.length > 0 && s(u.slice(0, -1));
  };
  return /* @__PURE__ */ r("div", { className: b("nim-field", i && "nim-field--invalid", n), children: [
    t ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: t }) : null,
    /* @__PURE__ */ r("div", { className: "nim-chip-input", "data-disabled": l || void 0, children: [
      u.map((g) => /* @__PURE__ */ e(
        hi,
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
          "aria-invalid": i ? !0 : void 0,
          "aria-label": t,
          className: "nim-chip-input__field",
          disabled: l,
          onBlur: _,
          onChange: (g) => f(g.target.value),
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
function Kl({ className: n, layout: l = "rows", rows: i }) {
  return /* @__PURE__ */ e("dl", { className: b("nim-data-list", `nim-data-list--${l}`, n), children: i.map((a) => /* @__PURE__ */ r("div", { className: "nim-data-list__row", children: [
    /* @__PURE__ */ e("dt", { className: "nim-data-list__label", children: a.label }),
    /* @__PURE__ */ e("dd", { className: b("nim-data-list__value", a.mono && "nim-data-list__value--mono"), children: a.value ?? /* @__PURE__ */ e("span", { className: "nim-data-list__empty", children: "—" }) })
  ] }, a.id)) });
}
function ee({ children: n, className: l, error: i, hint: a, id: t, label: s, required: d }) {
  const o = J(), c = t ?? `nim-${o}`, m = a ? `${c}-hint` : void 0, u = i ? `${c}-error` : void 0, h = [u, m].filter(Boolean).join(" ") || void 0;
  return /* @__PURE__ */ r("div", { className: b("nim-field", i && "nim-field--invalid", l), children: [
    s ? /* @__PURE__ */ r("label", { className: "nim-field__label", htmlFor: c, children: [
      s,
      d ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    n({ control: c, describedBy: h }),
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: u, children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: m, children: a }) : null
  ] });
}
function Wl({ children: n, ...l }) {
  return /* @__PURE__ */ e(ee, { ...l, children: () => n });
}
function _i({ className: n, error: l, hint: i, iconEnd: a, iconStart: t, id: s, label: d, required: o, ...c }) {
  return /* @__PURE__ */ e(ee, { error: l, hint: i, id: s, label: d, required: o, children: ({ control: m, describedBy: u }) => /* @__PURE__ */ r(
    "div",
    {
      className: b(
        "nim-input-shell",
        t && "nim-input-shell--has-start",
        a && "nim-input-shell--has-end"
      ),
      children: [
        t ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--start", children: /* @__PURE__ */ e(x, { name: t, size: "sm" }) }) : null,
        /* @__PURE__ */ e(
          "input",
          {
            "aria-describedby": u,
            "aria-invalid": l ? !0 : void 0,
            className: b("nim-input", n),
            id: m,
            required: o,
            ...c
          }
        ),
        a ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(x, { name: a, size: "sm" }) }) : null
      ]
    }
  ) });
}
function Zl({ className: n, error: l, hint: i, id: a, label: t, required: s, rows: d = 4, ...o }) {
  return /* @__PURE__ */ e(ee, { error: l, hint: i, id: a, label: t, required: s, children: ({ control: c, describedBy: m }) => /* @__PURE__ */ e(
    "textarea",
    {
      "aria-describedby": m,
      "aria-invalid": l ? !0 : void 0,
      className: b("nim-textarea", n),
      id: c,
      required: s,
      rows: d,
      ...o
    }
  ) });
}
function Yl({
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
        className: b("nim-select", n),
        id: m,
        required: o,
        ...c,
        children: [
          d ? /* @__PURE__ */ e("option", { value: "", disabled: !0, children: d }) : null,
          s.map((h) => /* @__PURE__ */ e("option", { disabled: h.disabled, value: h.value, children: h.label }, h.value))
        ]
      }
    ),
    /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(x, { name: "chevron-down", size: "sm" }) })
  ] }) });
}
function jl({
  ariaLabel: n,
  className: l,
  emptyState: i,
  error: a,
  hint: t,
  id: s,
  label: d,
  onChange: o,
  options: c,
  placeholder: m,
  required: u,
  value: h
}) {
  const f = J(), _ = c.find((k) => k.value === h) ?? null, [N, g] = E(""), [p, w] = E(!1), [y, S] = E(0), I = U(null), B = Y(() => {
    const k = N.trim().toLowerCase();
    return k ? c.filter((L) => L.label.toLowerCase().includes(k)) : c;
  }, [c, N]), M = (k) => {
    o(k.value), g(""), w(!1);
  }, v = (k) => {
    if (k.key === "Escape") {
      g(""), w(!1);
      return;
    }
    if (!p && (k.key === "ArrowDown" || k.key === "ArrowUp")) {
      w(!0);
      return;
    }
    if (k.key === "ArrowDown" || k.key === "ArrowUp") {
      k.preventDefault();
      const L = k.key === "ArrowDown" ? 1 : -1, D = B.filter((A) => !A.disabled);
      if (D.length === 0) return;
      S((A) => (A + L + D.length) % D.length);
    }
    if (k.key === "Enter") {
      const D = B.filter((A) => !A.disabled)[y];
      D && (k.preventDefault(), M(D));
    }
  }, T = B.filter((k) => !k.disabled);
  return /* @__PURE__ */ e(ee, { className: l, error: a, hint: t, id: s, label: d, required: u, children: ({ control: k, describedBy: L }) => /* @__PURE__ */ r("div", { className: "nim-combobox", children: [
    /* @__PURE__ */ r("div", { className: b("nim-input-shell", "nim-input-shell--has-end"), children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-label": n ?? d,
          "aria-autocomplete": "list",
          "aria-controls": p ? f : void 0,
          "aria-describedby": L,
          "aria-expanded": p,
          className: "nim-input",
          id: k,
          onBlur: () => window.setTimeout(() => w(!1), 120),
          onChange: (D) => {
            g(D.target.value), S(0), w(!0);
          },
          onFocus: () => w(!0),
          onKeyDown: v,
          placeholder: m,
          ref: I,
          role: "combobox",
          value: p ? N : (_ == null ? void 0 : _.label) ?? ""
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(x, { name: "chevron-down", size: "sm" }) })
    ] }),
    p ? /* @__PURE__ */ e("div", { className: "nim-combobox__list", id: f, role: "listbox", children: T.length === 0 ? /* @__PURE__ */ e("div", { className: "nim-combobox__empty", children: i ? i(N) : `Nothing matches “${N}”.` }) : B.map((D) => /* @__PURE__ */ r(
      "button",
      {
        "aria-selected": T.indexOf(D) === y,
        className: "nim-combobox__option",
        disabled: D.disabled,
        onClick: () => M(D),
        onPointerEnter: () => S(T.indexOf(D)),
        role: "option",
        type: "button",
        children: [
          /* @__PURE__ */ e("span", { children: D.label }),
          D.meta ? /* @__PURE__ */ e("span", { className: "nim-combobox__meta", children: D.meta }) : null
        ]
      },
      D.value
    )) }) : null
  ] }) });
}
const Ye = Ce(null);
function Vl({
  children: n,
  className: l,
  defaultColorway: i = "vermilion",
  defaultScheme: a = "light",
  defaultStyle: t = "ledger",
  direction: s = "ltr",
  locale: d,
  syncDocument: o = !0
}) {
  const [c, m] = E(t), [u, h] = E(i), [f, _] = E(a);
  V(() => {
    if (!o || typeof document > "u") return;
    const g = document.documentElement;
    g.dataset.nimStyle = c, g.dataset.nimColorway = u, f === "system" ? delete g.dataset.nimScheme : g.dataset.nimScheme = f, g.dir = s, d && (g.lang = d);
  }, [u, s, d, f, c, o]);
  const N = Y(
    () => ({ colorway: u, direction: s, locale: d, scheme: f, setColorway: h, setScheme: _, setStyle: m, style: c }),
    [u, s, d, f, c]
  );
  return /* @__PURE__ */ e(Ye.Provider, { value: N, children: /* @__PURE__ */ e(
    "div",
    {
      className: b("nim-root", l),
      "data-nim-colorway": u,
      "data-nim-scheme": f === "system" ? void 0 : f,
      "data-nim-style": c,
      dir: s,
      lang: d,
      children: n
    }
  ) });
}
function _e() {
  const n = xe(Ye);
  if (!n) throw new Error("useNim must be used inside <NimProvider>");
  return n;
}
function ql() {
  const { scheme: n, setScheme: l } = _e();
  return Z(() => l(n === "dark" ? "light" : "dark"), [n, l]);
}
const me = 864e5, pi = Date.UTC(622, 2, 22), fi = 365.2422, ie = (n) => n.toISOString().slice(0, 10), le = (n) => /* @__PURE__ */ new Date(`${n}T00:00:00Z`), pe = () => ie(/* @__PURE__ */ new Date()), Ni = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
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
const Ee = (n) => n.year * 1e4 + n.month * 100 + n.day;
function te(n, l) {
  if (l === "gregory")
    return ie(new Date(Date.UTC(n.year, n.month - 1, n.day)));
  const i = Math.floor((n.year - 1) * fi) + (n.month <= 7 ? (n.month - 1) * 31 : 186 + (n.month - 7) * 30) + n.day - 1;
  let a = new Date(pi + i * me);
  const t = Ee(n);
  for (let s = 0; s < 40; s += 1) {
    const d = ne(ie(a), "persian"), o = Ee(d);
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
function $e(n, l, i) {
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
  const { locale: u } = _e(), h = o ?? Me(u), f = m ?? yi(h), _ = pe(), N = gi(u, h), g = Y(
    () => new Intl.DateTimeFormat(N, { month: "long", timeZone: "UTC", year: "numeric" }),
    [N]
  ), p = Y(() => new Intl.NumberFormat(u), [u]), w = Y(
    () => new Intl.DateTimeFormat(N, { timeZone: "UTC", weekday: "short" }),
    [N]
  ), y = bi(t, h), S = ne(y, h).month, I = Y(() => {
    const M = (vi(y) - f + 7) % 7, v = ge(y, -M);
    return Array.from({ length: 42 }, (T, k) => {
      const L = ge(v, k), D = ne(L, h);
      return { date: L, day: D.day, outside: D.month !== S };
    });
  }, [y, S, h, f]), B = Y(() => {
    const M = "2024-01-07";
    return Array.from({ length: 7 }, (v, T) => ({
      key: `${f}-${T}`,
      label: w.format(/* @__PURE__ */ new Date(`${ge(M, (f + T) % 7)}T00:00:00Z`))
    }));
  }, [f, w]);
  return /* @__PURE__ */ r("div", { className: b("nim-calendar", n), children: [
    /* @__PURE__ */ r("div", { className: "nim-calendar__header", children: [
      /* @__PURE__ */ e(
        O,
        {
          label: Be.previous,
          name: "chevron-back",
          onClick: () => s($e(y, -1, h)),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-calendar__month", children: g.format(/* @__PURE__ */ new Date(`${y}T00:00:00Z`)) }),
      /* @__PURE__ */ e(
        O,
        {
          label: Be.next,
          name: "chevron-forward",
          onClick: () => s($e(y, 1, h)),
          size: "sm"
        }
      )
    ] }),
    /* @__PURE__ */ r("div", { className: "nim-calendar__grid", role: "grid", children: [
      B.map((M) => /* @__PURE__ */ e("span", { className: "nim-calendar__weekday", children: M.label }, M.key)),
      I.map((M) => /* @__PURE__ */ e(
        "button",
        {
          "aria-selected": M.date === c,
          className: b(
            "nim-calendar__day",
            M.outside && "nim-calendar__day--outside",
            M.date === _ && "nim-calendar__day--today",
            l.includes(M.date) && "nim-calendar__day--marked"
          ),
          disabled: a !== void 0 && M.date < a || i !== void 0 && M.date > i,
          onClick: () => d(M.date),
          role: "gridcell",
          type: "button",
          children: p.format(M.day)
        },
        M.date
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
  const [o, c] = E(null);
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
      placeholder: we(pe(), t, n),
      type: "text",
      value: m
    }
  );
}
function Ql({
  error: n,
  hint: l,
  id: i,
  label: a,
  onChange: t,
  required: s,
  value: d,
  ...o
}) {
  const { locale: c } = _e(), m = o.system ?? Me(c), [u, h] = E(d || pe());
  return /* @__PURE__ */ e(ee, { error: n, hint: l, id: i, label: a, required: s, children: ({ control: f, describedBy: _ }) => /* @__PURE__ */ r("div", { className: "nim-stack nim-stack--tight", children: [
    /* @__PURE__ */ e(
      qe,
      {
        calendar: m,
        describedBy: _,
        id: f,
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
function Xl({
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
  const { locale: u } = _e(), h = m.system ?? Me(u), [f, _] = E(!1), [N, g] = E(c || pe()), p = U(null), w = { clear: "Clear date", open: "Open calendar", ...t }, y = o ?? h === "persian", S = h === "persian" ? "gregory" : "persian";
  return /* @__PURE__ */ e(ee, { error: n, hint: l, id: i, label: a, required: d, children: ({ control: I, describedBy: B }) => /* @__PURE__ */ r("div", { className: "nim-date-picker", children: [
    /* @__PURE__ */ r("div", { className: "nim-date-picker__group", children: [
      /* @__PURE__ */ e(
        qe,
        {
          calendar: h,
          describedBy: B,
          id: I,
          invalid: !!n,
          locale: u,
          onChange: (M) => {
            s(M), M && g(M);
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
          "aria-expanded": f,
          label: w.open,
          name: "calendar",
          onClick: () => _((M) => !M),
          ref: p,
          size: "sm"
        }
      )
    ] }),
    y && c ? /* @__PURE__ */ r("p", { className: "nim-date-picker__equivalent", children: [
      /* @__PURE__ */ e(x, { name: "calendar", size: "xs" }),
      /* @__PURE__ */ e("span", { dir: S === "gregory" ? "ltr" : void 0, children: we(c, u, S) })
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
            onSelect: (M) => {
              s(M), g(M), _(!1);
            },
            system: h,
            value: c
          }
        )
      }
    )
  ] }) });
}
function Jl({
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
    const h = (f) => f.preventDefault();
    return u.addEventListener("cancel", h), () => u.removeEventListener("cancel", h);
  }, [t]), V(() => {
    const u = m.current;
    if (!u) return;
    const h = () => d();
    return u.addEventListener("close", h), () => u.removeEventListener("close", h);
  }, [d]), /* @__PURE__ */ r(
    "dialog",
    {
      className: b("nim-dialog", l),
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
function et({
  className: n,
  detail: l,
  label: i,
  percent: a,
  tone: t = "accent",
  value: s,
  ...d
}) {
  const o = typeof a == "number", c = Math.min(100, Math.max(0, a ?? 0)), m = typeof i == "string" ? i : void 0;
  return /* @__PURE__ */ r("div", { className: b("nim-resource-meter", n), "data-tone": t, ...d, children: [
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
function nt({
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
  const m = U(0), [u, h] = E(!1), f = (_) => {
    _.preventDefault(), _.stopPropagation();
  };
  return /* @__PURE__ */ r("div", { className: b("nim-field", t && "nim-field--invalid", i), children: [
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
              onChange: (_) => {
                const N = Array.from(_.target.files ?? []);
                N.length > 0 && o(N), _.target.value = "";
              },
              type: "file"
            }
          ),
          /* @__PURE__ */ e(x, { className: "nim-file-drop__icon", name: "upload", size: "lg" }),
          /* @__PURE__ */ e("span", { className: "nim-file-drop__label", children: s }),
          c ? /* @__PURE__ */ e("span", { className: "nim-file-drop__prompt", children: c }) : null,
          l ? /* @__PURE__ */ e("span", { className: "nim-file-drop__caption", children: l }) : null
        ]
      }
    ),
    t ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: t }) : null
  ] });
}
function at({ children: n, className: l, ...i }) {
  return /* @__PURE__ */ e("div", { className: b("nim-app-frame", l), ...i, children: n });
}
function it({
  as: n = "div",
  children: l,
  className: i,
  gap: a = "md",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: b("nim-stack", a !== "md" && `nim-stack--${a}`, i), ...t, children: l });
}
function lt({
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
      className: b("nim-inline", a !== "md" && `nim-inline--${a}`, !t && "nim-inline--nowrap", i),
      ...s,
      children: l
    }
  );
}
function xi({ children: n, className: l, plain: i = !1, ...a }) {
  return /* @__PURE__ */ e("div", { className: b("nim-list", i && "nim-list--plain", l), ...a, children: n });
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
  const u = !!(l || a), h = /* @__PURE__ */ r(H, { children: [
    i ? /* @__PURE__ */ e("span", { className: "nim-list-row__leading", children: i }) : null,
    /* @__PURE__ */ r("span", { className: "nim-list-row__content", children: [
      /* @__PURE__ */ e("span", { className: "nim-list-row__title", children: o }),
      s ? /* @__PURE__ */ e("span", { className: "nim-list-row__subtitle", children: s }) : null
    ] }),
    c ? /* @__PURE__ */ e("span", { className: "nim-list-row__trailing", children: c }) : null,
    u && !c ? /* @__PURE__ */ e(x, { className: "nim-list-row__chevron", name: "chevron-forward", size: "sm" }) : null
  ] }), f = b("nim-list-row", u && "nim-list-row--interactive", n);
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
  ) : a ? /* @__PURE__ */ e("button", { className: f, onClick: a, type: "button", ...m, children: h }) : /* @__PURE__ */ e("div", { className: f, ...m, children: h });
}
const Ti = {
  back: "Back",
  dot: (n) => `Slide ${n + 1}`
};
function tt({
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
  const [h, f] = E(0), _ = { ...Ti, ...t }, N = u[Math.min(h, u.length - 1)], g = h === u.length - 1, p = Z(
    (y) => {
      f(y), c == null || c(y);
    },
    [c]
  );
  return /* @__PURE__ */ r("section", { className: b("nim-onboarding", l), children: [
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
      /* @__PURE__ */ e("div", { className: "nim-onboarding__dots", children: u.map((y, S) => /* @__PURE__ */ e(
        "button",
        {
          "aria-current": S === h ? "step" : void 0,
          "aria-label": _.dot(S),
          className: "nim-onboarding__dot",
          onClick: () => p(S),
          type: "button"
        },
        y.id
      )) }),
      /* @__PURE__ */ r("div", { className: "nim-onboarding__cta", children: [
        h > 0 ? /* @__PURE__ */ e(
          O,
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
            onClick: () => g ? d() : p(h + 1),
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
function st(n) {
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
  const m = U(null), u = c.slice(0, s).split(""), h = Z((p) => {
    var y, S;
    const w = (y = m.current) == null ? void 0 : y.querySelectorAll("input");
    (S = w == null ? void 0 : w[Math.max(0, Math.min(p, w.length - 1))]) == null || S.focus();
  }, []);
  V(() => {
    n && h(0);
  }, [n, h]);
  const f = Z(
    (p, w) => {
      const y = p.slice(0, s);
      d(y), y.length === s ? o == null || o(y) : h(w);
    },
    [h, s, d, o]
  ), _ = Z(
    (p, w) => {
      const y = se(w);
      if (!y) return;
      const S = (c.slice(0, p) + y).slice(0, s);
      f(S, S.length);
    },
    [f, s, c]
  ), N = Z(
    (p, w) => {
      if (w.key === "Backspace") {
        w.preventDefault();
        const y = c[p] ? p : p - 1;
        if (y < 0) return;
        d(c.slice(0, y) + c.slice(y + 1)), h(y);
      } else w.key === "ArrowLeft" ? h(p - 1) : w.key === "ArrowRight" && h(p + 1);
    },
    [h, d, c]
  ), g = Z(
    (p) => {
      const w = se(p.clipboardData.getData("text"));
      w && (p.preventDefault(), f(w.slice(0, s), w.length));
    },
    [f, s]
  );
  return /* @__PURE__ */ r("div", { className: b("nim-otp", a && "nim-otp--invalid", l), children: [
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
            "aria-invalid": a ? !0 : void 0,
            "aria-label": i ? i(w) : `${t} ${w + 1}`,
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
function $i({
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
  const [m, u] = E(!1), h = { ...Ei, ...s };
  return /* @__PURE__ */ e(ee, { error: l, hint: i, id: a, label: t, required: d, children: ({ control: f, describedBy: _ }) => /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ r("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-describedby": _,
          "aria-invalid": l ? !0 : void 0,
          autoComplete: c.autoComplete ?? "current-password",
          className: b("nim-input", n),
          id: f,
          required: d,
          ...c,
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
          children: /* @__PURE__ */ e(x, { name: "eye", size: "sm" })
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
function rt(n) {
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
  priority: f = [],
  required: _,
  value: N
}) {
  const g = J(), p = t ?? `nim-${g}`, w = a ? `${p}-hint` : void 0, y = i ? `${p}-error` : void 0, S = { ...Ii, ...d }, [I, B] = E(!1), [M, v] = E(""), T = U(null), k = U(null), L = U(null), D = o ?? (typeof document > "u" ? "en" : document.documentElement.lang || "en"), A = Y(() => Ai(D), [D]), $ = Qe(l) ?? ue[0], G = Y(() => {
    const C = new Intl.Collator(D), F = ue.map((z) => ({ ...z, name: A(z.iso2) })), W = (z) => {
      const R = f.indexOf(z);
      return R === -1 ? f.length : R;
    };
    return F.sort(
      (z, R) => W(z.iso2) - W(R.iso2) || C.compare(z.name, R.name)
    );
  }, [A, f, D]), K = Y(() => {
    const C = M.trim().toLocaleLowerCase(D);
    if (!C) return G;
    const F = se(C);
    return G.filter(
      (W) => W.name.toLocaleLowerCase(D).includes(C) || W.iso2.toLowerCase().includes(C) || (F ? W.dial.startsWith(F) : !1)
    );
  }, [G, M, D]);
  V(() => {
    var W;
    if (!I) return;
    (W = L.current) == null || W.focus();
    const C = (z) => {
      var R;
      (R = T.current) != null && R.contains(z.target) || B(!1);
    }, F = (z) => {
      var R;
      z.key === "Escape" && (B(!1), (R = k.current) == null || R.focus());
    };
    return document.addEventListener("mousedown", C), document.addEventListener("keydown", F), () => {
      document.removeEventListener("mousedown", C), document.removeEventListener("keydown", F);
    };
  }, [I]);
  const P = (C) => {
    var F;
    m(C), B(!1), v(""), (F = k.current) == null || F.focus();
  };
  return /* @__PURE__ */ r("div", { className: b("nim-field", i && "nim-field--invalid", n), children: [
    s ? /* @__PURE__ */ r("label", { className: "nim-field__label", htmlFor: p, children: [
      s,
      _ ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    /* @__PURE__ */ r("div", { className: "nim-phone", ref: T, children: [
      /* @__PURE__ */ r("div", { className: "nim-phone__shell", dir: "ltr", children: [
        /* @__PURE__ */ r(
          "button",
          {
            "aria-expanded": I,
            "aria-haspopup": "listbox",
            "aria-label": `${S.pickCountry}: ${A($.iso2)} +${$.dial}`,
            className: "nim-phone__country",
            onClick: () => B((C) => !C),
            ref: k,
            type: "button",
            children: [
              /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-phone__flag", children: $.flag }),
              /* @__PURE__ */ r("span", { className: "nim-phone__dial", children: [
                "+",
                $.dial
              ] }),
              /* @__PURE__ */ e(x, { className: "nim-phone__caret", name: "chevron-down", size: "xs" })
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
            onChange: (C) => c(se(C.target.value)),
            onKeyDown: (C) => {
              C.key === "Enter" && (u == null || u());
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
          /* @__PURE__ */ e(x, { name: "search", size: "sm" }),
          /* @__PURE__ */ e(
            "input",
            {
              "aria-label": S.search,
              className: "nim-phone__search-input",
              onChange: (C) => v(C.target.value),
              placeholder: S.search,
              ref: L,
              type: "search",
              value: M
            }
          )
        ] }),
        /* @__PURE__ */ r("ul", { className: "nim-phone__list", role: "listbox", children: [
          K.map((C) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ r(
            "button",
            {
              "aria-selected": C.iso2 === $.iso2,
              className: "nim-phone__option",
              onClick: () => P(C.iso2),
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
          K.length === 0 ? /* @__PURE__ */ e("li", { className: "nim-phone__empty", children: S.noMatch }) : null
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
  const h = /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ r("div", { className: "nim-plan__top", children: [
      a ? /* @__PURE__ */ e("span", { className: "nim-plan__icon", children: /* @__PURE__ */ e(x, { name: a, size: "md" }) }) : null,
      /* @__PURE__ */ r("div", { className: "nim-plan__heading", children: [
        /* @__PURE__ */ e("span", { className: "nim-plan__name", children: t }),
        u ? /* @__PURE__ */ e("span", { className: "nim-plan__tagline", children: u }) : null
      ] }),
      n ? /* @__PURE__ */ e("span", { className: "nim-plan__badge", children: n }) : null,
      s ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-plan__radio", children: m ? /* @__PURE__ */ e(x, { name: "check", size: "xs" }) : null }) : null
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
    i.length ? /* @__PURE__ */ e("ul", { className: "nim-plan__features", children: i.map((_, N) => {
      const g = _.state ?? "included";
      return /* @__PURE__ */ r("li", { className: "nim-plan__feature", "data-state": g, children: [
        /* @__PURE__ */ e(x, { name: Fi[g], size: "xs" }),
        /* @__PURE__ */ e("span", { className: "nim-plan__feature-label", children: _.label }),
        _.note ? /* @__PURE__ */ e("span", { className: "nim-plan__feature-note", children: _.note }) : null
      ] }, N);
    }) }) : null
  ] }), f = b("nim-plan", m && "nim-plan--selected", l);
  return s ? /* @__PURE__ */ e("button", { "aria-pressed": m, className: f, onClick: s, type: "button", children: h }) : /* @__PURE__ */ e("article", { className: f, children: h });
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
      className: b("nim-segmented", l && "nim-segmented--full", n),
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
function ct({
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
  submitLabel: f
}) {
  var v, T;
  const _ = { ...Ui, ...s }, [N, g] = E(a ?? ((v = i[0]) == null ? void 0 : v.id) ?? ""), [p, w] = E(t ?? ((T = h[0]) == null ? void 0 : T.id) ?? ""), y = l ?? N, S = u ?? p, I = (k) => {
    w(k), c == null || c(k);
  }, B = (k) => {
    g(k), o == null || o(k);
  }, M = i.find((k) => k.id === y);
  return /* @__PURE__ */ r("section", { className: b("nim-plan-picker", n), children: [
    i.length > 1 ? /* @__PURE__ */ r("div", { className: "nim-plan-picker__cycles", children: [
      /* @__PURE__ */ e(
        Oi,
        {
          fullWidth: !0,
          label: _.cycle,
          onChange: B,
          options: i.map((k) => ({ label: k.label, value: k.id })),
          value: y
        }
      ),
      M != null && M.note ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__save", children: M.note }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-plan-picker__plans", children: h.map(({ id: k, prices: L, ...D }) => {
      const A = L[y] ?? Object.values(L)[0];
      return /* @__PURE__ */ nn(
        Ri,
        {
          ...D,
          key: k,
          onSelect: () => I(k),
          price: (A == null ? void 0 : A.price) ?? "",
          priceCaption: _.price,
          secondary: (A == null ? void 0 : A.monthly) === void 0 ? void 0 : { caption: _.monthly, value: A.monthly },
          selected: k === S
        }
      );
    }) }),
    f ? /* @__PURE__ */ r("div", { className: "nim-plan-picker__foot", children: [
      /* @__PURE__ */ e(
        X,
        {
          fullWidth: !0,
          onClick: () => m == null ? void 0 : m(S, y),
          size: "lg",
          variant: "accent",
          children: f
        }
      ),
      d ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__note", children: d }) : null
    ] }) : null
  ] });
}
function Hi({
  action: n,
  className: l,
  description: i,
  eyebrow: a,
  title: t,
  ...s
}) {
  return /* @__PURE__ */ r("header", { className: b("nim-section-header", l), ...s, children: [
    /* @__PURE__ */ r("div", { children: [
      a ? /* @__PURE__ */ e("p", { className: "nim-label nim-section-header__eyebrow", children: a }) : null,
      /* @__PURE__ */ e("h2", { className: "nim-title nim-title--md", children: t }),
      i ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-section-header__description", children: i }) : null
    ] }),
    n ? /* @__PURE__ */ e("div", { className: "nim-section-header__action", children: n }) : null
  ] });
}
function ot({
  className: n,
  footer: l,
  sections: i = [],
  ...a
}) {
  return /* @__PURE__ */ r("div", { className: b("nim-profile-screen", n), children: [
    /* @__PURE__ */ e(Ga, { ...a }),
    i.map((t) => /* @__PURE__ */ r("section", { className: "nim-profile-screen__section", children: [
      t.title ? /* @__PURE__ */ e(Hi, { description: t.description, title: t.title }) : null,
      /* @__PURE__ */ e(xi, { children: t.rows.map((s) => /* @__PURE__ */ e(
        Mi,
        {
          className: b(s.danger && "nim-list-row--danger"),
          href: s.href,
          leading: s.icon ? /* @__PURE__ */ e(x, { name: s.icon, size: "md" }) : void 0,
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
function dt({
  className: n,
  count: l = 5,
  label: i,
  onChange: a,
  readOnly: t = !1,
  size: s = "md",
  value: d
}) {
  const o = J(), [c, m] = E(null), u = c ?? d;
  return t || !a ? /* @__PURE__ */ e(
    "span",
    {
      "aria-label": `${i}: ${d}/${l}`,
      className: b("nim-rating", `nim-rating--${s}`, "nim-rating--static", n),
      role: "img",
      children: Array.from({ length: l }, (h, f) => /* @__PURE__ */ e(Re, { fill: Math.min(Math.max(d - f, 0), 1) }, f))
    }
  ) : /* @__PURE__ */ r(
    "fieldset",
    {
      className: b("nim-rating", `nim-rating--${s}`, n),
      onMouseLeave: () => m(null),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-visually-hidden", children: i }),
        Array.from({ length: l }, (h, f) => {
          const _ = f + 1;
          return /* @__PURE__ */ r("label", { className: "nim-rating__star", onMouseEnter: () => m(_), children: [
            /* @__PURE__ */ e(
              "input",
              {
                checked: d === _,
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
    /* @__PURE__ */ e(x, { className: "nim-rating__outline", name: "star", size: "md" }),
    /* @__PURE__ */ e("span", { className: "nim-rating__fill", style: { inlineSize: `${n * 100}%` }, children: /* @__PURE__ */ e(x, { name: "star", size: "md" }) })
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
function mt({
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
  resendSeconds: f = 60
}) {
  const _ = { ...Gi, ...a }, [N, g] = E(
    o.includes(s) ? s : o[0]
  ), [p, w] = E(!1), [y, S] = E(t), [I, B] = E(""), [M, v] = E(""), [T, k] = E(""), [L, D] = E(""), [A, $] = E(!1), [G, K] = E(""), [P, C] = E(0), F = U(!1);
  V(() => {
    if (P <= 0) return;
    const j = window.setTimeout(() => C((ae) => ae - 1), 1e3);
    return () => window.clearTimeout(j);
  }, [P]);
  const W = Pi(y, I), z = I.replace(/\D/g, "").length >= 6, R = Z(
    async (j = !1) => {
      if (!(A || !j && !z)) {
        $(!0), K("");
        try {
          await (m == null ? void 0 : m(W)), w(!0), v(""), C(f);
        } catch (ae) {
          K(ye(ae, _.sendCode));
        } finally {
          $(!1);
        }
      }
    },
    [A, W, m, z, f, _.sendCode]
  ), q = Z(
    async (j) => {
      if (!(F.current || j.length !== i)) {
        F.current = !0, $(!0), K("");
        try {
          await (u == null ? void 0 : u(W, j));
        } catch (ae) {
          K(ye(ae, _.verify)), v("");
        } finally {
          F.current = !1, $(!1);
        }
      }
    },
    [i, W, u, _.verify]
  ), Q = Z(async () => {
    if (!(A || !T.trim() || !L)) {
      $(!0), K("");
      try {
        await (c == null ? void 0 : c(T.trim(), L));
      } catch (j) {
        K(ye(j, _.signIn));
      } finally {
        $(!1);
      }
    }
  }, [A, T, c, L, _.signIn]), re = o.length > 1 ? /* @__PURE__ */ e(
    X,
    {
      onClick: () => {
        g(N === "code" ? "password" : "code"), K("");
      },
      size: "sm",
      variant: "ghost",
      children: N === "code" ? _.usePassword : _.usePhone
    }
  ) : null, fe = G ? /* @__PURE__ */ e(Za, { tone: "danger", children: G }) : null;
  return N === "password" ? /* @__PURE__ */ r(
    Ne,
    {
      action: {
        disabled: !T.trim() || !L,
        label: _.signIn,
        loading: A,
        onClick: () => void Q()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ r(H, { children: [
        re,
        d
      ] }),
      subtitle: _.passwordSubtitle,
      title: _.passwordTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          _i,
          {
            autoComplete: "username",
            label: _.identifierLabel,
            onChange: (j) => k(j.target.value),
            type: "email",
            value: T
          }
        ),
        /* @__PURE__ */ e(
          $i,
          {
            autoComplete: "current-password",
            label: _.passwordLabel,
            onChange: (j) => D(j.target.value),
            onKeyDown: (j) => {
              j.key === "Enter" && Q();
            },
            value: L
          }
        )
      ]
    }
  ) : p ? /* @__PURE__ */ r(
    Ne,
    {
      action: {
        disabled: M.length !== i,
        label: _.verify,
        loading: A,
        onClick: () => void q(M)
      },
      back: {
        label: _.back,
        onClick: () => {
          w(!1), v(""), K("");
        }
      },
      className: l,
      footer: /* @__PURE__ */ r(H, { children: [
        P > 0 ? /* @__PURE__ */ e("p", { children: _.resendIn(P) }) : /* @__PURE__ */ e(X, { onClick: () => void R(!0), size: "sm", variant: "ghost", children: _.resend }),
        d
      ] }),
      subtitle: _.codeSubtitle(W),
      title: _.codeTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          Li,
          {
            autoFocus: !0,
            label: _.codeLabel,
            length: i,
            onChange: v,
            onComplete: (j) => void q(j),
            value: M
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
      className: l,
      footer: /* @__PURE__ */ r(H, { children: [
        re,
        d
      ] }),
      subtitle: _.phoneSubtitle,
      title: _.phoneTitle,
      children: [
        fe,
        /* @__PURE__ */ e(
          Bi,
          {
            country: y,
            label: _.phoneLabel,
            onChange: B,
            onCountryChange: S,
            onSubmit: () => void R(),
            priority: h,
            value: I
          }
        )
      ]
    }
  );
}
function ut({ children: n, className: l, closeLabel: i = "Close", footer: a, onClose: t, open: s, title: d }) {
  const o = U(null), c = U(null), m = J();
  return V(() => {
    var f;
    if (!s) return;
    c.current = document.activeElement;
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
      document.body.style.overflow = u, window.removeEventListener("keydown", h), (N = (_ = c.current) == null ? void 0 : _.focus) == null || N.call(_);
    };
  }, [t, s]), !s || typeof document > "u" ? null : he(
    /* @__PURE__ */ r(H, { children: [
      /* @__PURE__ */ e("div", { className: "nim-sheet__scrim", onClick: t }),
      /* @__PURE__ */ r(
        "div",
        {
          "aria-label": d ? void 0 : i,
          "aria-labelledby": d ? m : void 0,
          "aria-modal": "true",
          className: b("nim-sheet__panel", l),
          ref: o,
          role: "dialog",
          tabIndex: -1,
          children: [
            /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-sheet__handle" }),
            d ? /* @__PURE__ */ r("div", { className: "nim-sheet__header", children: [
              /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", id: m, children: d }),
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
function ht({
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
        className: b("nim-slider", n),
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
function _t({ className: n, delta: l, deltaDirection: i = "up", label: a, unit: t, value: s, ...d }) {
  return /* @__PURE__ */ r("div", { className: b("nim-stat", n), ...d, children: [
    /* @__PURE__ */ r("p", { className: "nim-stat__value", children: [
      s,
      t ? /* @__PURE__ */ e("span", { className: "nim-stat__unit", children: t }) : null
    ] }),
    /* @__PURE__ */ e("p", { className: "nim-label nim-stat__label", children: a }),
    l ? /* @__PURE__ */ r("p", { className: "nim-stat__delta", "data-direction": i, children: [
      /* @__PURE__ */ e(x, { name: i === "up" ? "trend-up" : "trend-down", size: "xs" }),
      l
    ] }) : null
  ] });
}
function pt({ className: n, label: l = "Stages", stages: i }) {
  return /* @__PURE__ */ e("ol", { "aria-label": l, className: b("nim-stages", n), children: i.map((a, t) => {
    const s = /* @__PURE__ */ r(H, { children: [
      /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-stages__marker", children: a.status === "done" ? /* @__PURE__ */ e(x, { name: "check", size: "xs" }) : a.status === "blocked" ? /* @__PURE__ */ e(x, { name: "close", size: "xs" }) : t + 1 }),
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
function ft({
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
      className: b("nim-stepper", n),
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
            children: /* @__PURE__ */ e(x, { name: "minus", size: "sm" })
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
            children: /* @__PURE__ */ e(x, { name: "plus", size: "sm" })
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
function Nt({
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
      className: b("nim-task", u && "nim-task--failed", i),
      children: [
        /* @__PURE__ */ r("header", { className: "nim-task__head", children: [
          s ? /* @__PURE__ */ e("h2", { className: "nim-task__title", children: s }) : null,
          l ? /* @__PURE__ */ e("p", { className: "nim-task__caption", children: l }) : null,
          /* @__PURE__ */ e(Pa, { label: o.of(c, t.length), value: m })
        ] }),
        /* @__PURE__ */ e("ol", { className: "nim-task__steps", children: t.map((h) => /* @__PURE__ */ r("li", { className: "nim-task__step", "data-status": h.status, children: [
          /* @__PURE__ */ e("span", { className: "nim-task__marker", children: h.status === "active" ? /* @__PURE__ */ e(Ge, { size: "sm" }) : /* @__PURE__ */ e(x, { name: Wi[h.status], size: "xs" }) }),
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
function bt({ className: n, density: l = "default", entries: i }) {
  return /* @__PURE__ */ e("ol", { className: b("nim-timeline", l === "compact" && "nim-timeline--compact", n), children: i.map((a) => /* @__PURE__ */ r("li", { className: "nim-timeline__entry", "data-tone": a.tone, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-timeline__marker", children: a.icon ? /* @__PURE__ */ e(x, { name: a.icon, size: "xs" }) : /* @__PURE__ */ e("span", { className: "nim-timeline__dot" }) }),
    /* @__PURE__ */ r("div", { className: "nim-timeline__content", children: [
      /* @__PURE__ */ r("div", { className: "nim-timeline__head", children: [
        /* @__PURE__ */ e("span", { className: "nim-timeline__title", children: a.title }),
        a.time ? /* @__PURE__ */ e("time", { className: "nim-timeline__time", children: a.time }) : null
      ] }),
      a.body && l !== "compact" ? /* @__PURE__ */ e("div", { className: "nim-timeline__body", children: a.body }) : null
    ] })
  ] }, a.id)) });
}
function vt({ className: n, label: l, onChange: i, options: a, value: t, ...s }) {
  const d = U(null), o = (c) => {
    var _, N;
    const m = c.key === "ArrowRight" ? 1 : c.key === "ArrowLeft" ? -1 : 0;
    if (m === 0) return;
    c.preventDefault();
    const u = a.filter((g) => !g.disabled), h = u.findIndex((g) => g.value === t), f = u[(h + m + u.length) % u.length];
    f && (i(f.value), (N = (_ = d.current) == null ? void 0 : _.querySelector(`[data-value="${f.value}"]`)) == null || N.focus());
  };
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": l,
      className: b("nim-tabs", n),
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
function gt({ children: n }) {
  const [l, i] = E([]), a = U(0), t = Z((o) => {
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
      /* @__PURE__ */ e("div", { "aria-live": "polite", className: "nim-toast-stack", children: l.map((o) => /* @__PURE__ */ r("div", { className: b("nim-toast", `nim-toast--${o.tone ?? "neutral"}`), children: [
        /* @__PURE__ */ e(x, { className: "nim-toast__icon", name: Zi[o.tone ?? "neutral"], size: "sm" }),
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
function yt() {
  const n = xe(Xe);
  if (!n) throw new Error("useToast must be used inside <ToastProvider>");
  return n;
}
function kt({ children: n, className: l, label: i }) {
  return /* @__PURE__ */ r("span", { className: b("nim-tooltip", l), children: [
    n,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-tooltip__bubble", role: "tooltip", children: i })
  ] });
}
const Yi = {
  back: "Back",
  close: "Close",
  step: (n, l) => `Step ${n + 1} of ${l}`
};
function wt({
  className: n,
  continueLabel: l,
  finishLabel: i,
  labels: a,
  onClose: t,
  onDone: s,
  onStep: d,
  steps: o
}) {
  const c = { ...Yi, ...a }, [m, u] = E(0), h = o[Math.min(m, o.length - 1)], f = m === o.length - 1, _ = Z(
    (N) => {
      u(N), d == null || d(N);
    },
    [d]
  );
  return /* @__PURE__ */ r("section", { className: b("nim-wizard", n), children: [
    /* @__PURE__ */ r("header", { className: "nim-wizard__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: m > 0 ? /* @__PURE__ */ e(O, { label: c.back, name: "chevron-back", onClick: () => _(m - 1), size: "sm" }) : null }),
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
        onClick: () => f ? s() : _(m + 1),
        size: "lg",
        variant: "accent",
        children: h.continueLabel ?? (f ? i : l)
      }
    ) })
  ] });
}
function Ct({
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
  return /* @__PURE__ */ e("div", { className: b("nim-choice-grid", n), role: i ? "group" : "radiogroup", children: t.map((c) => {
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
      className: b(
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
      className: b("nim-display__line", i && "nim-display__accent", t),
      "data-indent": a ? "true" : void 0,
      ...s,
      children: l
    }
  );
};
function xt({
  as: n = "h2",
  children: l,
  className: i,
  size: a = "lg",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: b("nim-title", a === "md" && "nim-title--md", i), ...t, children: l });
}
function Mt({
  as: n = "p",
  children: l,
  className: i,
  size: a = "md",
  tone: t,
  ...s
}) {
  return /* @__PURE__ */ e(n, { className: b("nim-body", a === "sm" && "nim-body--sm", Je(t), i), ...s, children: l });
}
function Tt({ as: n = "span", children: l, className: i, ...a }) {
  return /* @__PURE__ */ e(n, { className: b("nim-label", i), ...a, children: l });
}
function St({ as: n = "p", children: l, className: i, tone: a, ...t }) {
  return /* @__PURE__ */ e(n, { className: b("nim-caption", Je(a), i), ...t, children: l });
}
function zt({ className: n, ...l }) {
  return /* @__PURE__ */ e("hr", { className: b("nim-rule", n), ...l });
}
export {
  Ml as Accordion,
  El as ActionBar,
  il as ActivityFeed,
  el as AdminShell,
  at as AppFrame,
  Tl as AppShell,
  Il as AssistantThread,
  Ne as AuthScreen,
  de as Avatar,
  Sl as AvatarRing,
  Ka as Badge,
  Za as Banner,
  Mt as Body,
  gl as Brand,
  yl as BrandMark,
  zl as Breadcrumb,
  X as Button,
  ue as COUNTRIES,
  Ve as Calendar,
  St as Caption,
  Dl as Card,
  Bl as Chart,
  $l as Chat,
  Hl as ChatComposer,
  ze as Checkbox,
  hi as Chip,
  Gl as ChipInput,
  Ct as ChoiceGrid,
  ul as CodeBlock,
  dl as Columns,
  jl as Combobox,
  si as ConversationList,
  bl as CopyChip,
  Kl as DataList,
  xl as DataTable,
  Ql as DateField,
  Xl as DatePicker,
  nl as DetailHeader,
  vl as DetailLayout,
  Jl as Dialog,
  ji as Display,
  Ea as EmptyState,
  ol as Facts,
  Wl as Field,
  nt as FileDrop,
  al as FilterChips,
  x as Icon,
  O as IconButton,
  lt as Inline,
  _i as Input,
  Tt as Label,
  xi as List,
  Mi as ListRow,
  Ol as MapView,
  Ul as MediaPlayer,
  De as Menu,
  Fl as Messenger,
  rl as Metric,
  cl as MetricGrid,
  _l as Mono,
  Vl as NimProvider,
  tt as Onboarding,
  Al as OptionCard,
  Ll as OrderSummary,
  Li as OtpInput,
  ll as Page,
  Ia as Pagination,
  tl as Panel,
  $i as PasswordField,
  Bi as PhoneField,
  Ri as PlanCard,
  ct as PlanPicker,
  ja as Popover,
  Ga as ProfileHeader,
  ot as ProfileScreen,
  Pa as Progress,
  wl as Radio,
  Cl as RadioGroup,
  fl as Rail,
  Nl as RailSection,
  dt as Rating,
  pl as RecordLink,
  et as ResourceMeter,
  Rl as RoomHeader,
  zt as Rule,
  Hi as SectionHeader,
  Oi as Segmented,
  Yl as Select,
  ut as Sheet,
  mt as SignInFlow,
  Fa as Skeleton,
  ht as Slider,
  Pl as Sparkline,
  Ge as Spinner,
  it as Stack,
  pt as StageTrack,
  _t as Stat,
  hl as StatusDot,
  ml as StatusHero,
  ft as Stepper,
  Ba as Switch,
  Ua as TabBar,
  Se as Table,
  vt as Tabs,
  Nt as TaskProgress,
  Zl as Textarea,
  bt as Timeline,
  xt as Title,
  gt as ToastProvider,
  sl as Toolbar,
  kt as Tooltip,
  wt as Wizard,
  ge as addDays,
  $e as addMonths,
  kl as brandFor,
  b as cn,
  st as countryByDial,
  Qe as countryByIso2,
  Ai as countryNamer,
  we as formatNumeric,
  te as fromParts,
  Ji as iconNames,
  je as monthLength,
  wi as parseNumeric,
  ne as partsOf,
  rt as scorePassword,
  bi as startOfMonth,
  se as toAsciiDigits,
  Pi as toE164,
  pe as todayIso,
  _e as useNim,
  ql as useSchemeToggle,
  yt as useToast
};
