import { jsx as e, jsxs as d, Fragment as K } from "react/jsx-runtime";
import { forwardRef as Le, useState as D, useCallback as O, createContext as pe, useContext as fe, useId as q, Fragment as We, useRef as L, useMemo as Y, useEffect as Z, useLayoutEffect as He, createElement as Ye } from "react";
import { Wallet as Ze, User as Ve, Video as je, Upload as Je, TrendingUp as Qe, TrendingDown as Xe, Trash2 as qe, Sun as en, Star as nn, Sparkles as an, CircleStop as ln, LogOut as tn, Share2 as sn, Settings as rn, Send as cn, Search as on, Plus as dn, Play as mn, Pause as un, Paperclip as hn, Moon as _n, Minus as pn, Mic as fn, Menu as Nn, Loader as bn, Info as vn, Home as gn, Heart as yn, Filter as kn, Eye as wn, ExternalLink as Cn, Pencil as Sn, Download as Tn, FileText as An, CircleAlert as xn, Copy as Dn, X as En, Clock as Mn, ChevronUp as Ln, ChevronRight as zn, ChevronDown as $n, ChevronLeft as In, CircleCheck as Pn, Check as Bn, Camera as Rn, Calendar as Fn, Bookmark as On, Bell as Un, Users as Gn, Terminal as Kn, Tag as Wn, ShieldCheck as Hn, Server as Yn, RefreshCw as Zn, Package as Vn, MoreHorizontal as jn, Link2 as Jn, Layers as Qn, KeyRound as Xn, Globe as qn, Database as ea, Cloud as na, BarChart3 as aa, ArrowRight as ia, ArrowLeft as la, AlertTriangle as ta, Activity as sa } from "lucide-react";
import { createPortal as re } from "react-dom";
const f = (...n) => n.filter(Boolean).join(" "), ze = {
  activity: sa,
  alert: ta,
  "arrow-back": la,
  "arrow-forward": ia,
  chart: aa,
  cloud: na,
  database: ea,
  globe: qn,
  key: Xn,
  layers: Qn,
  link: Jn,
  more: jn,
  package: Vn,
  refresh: Zn,
  server: Yn,
  shield: Hn,
  tag: Wn,
  terminal: Kn,
  users: Gn,
  bell: Un,
  bookmark: On,
  calendar: Fn,
  camera: Rn,
  check: Bn,
  "check-circle": Pn,
  "chevron-back": In,
  "chevron-down": $n,
  "chevron-forward": zn,
  "chevron-up": Ln,
  clock: Mn,
  close: En,
  copy: Dn,
  danger: xn,
  document: An,
  download: Tn,
  edit: Sn,
  external: Cn,
  eye: wn,
  filter: kn,
  heart: yn,
  home: gn,
  info: vn,
  loading: bn,
  menu: Nn,
  mic: fn,
  minus: pn,
  moon: _n,
  paperclip: hn,
  pause: un,
  play: mn,
  plus: dn,
  search: on,
  send: cn,
  settings: rn,
  share: sn,
  "sign-out": tn,
  stop: ln,
  sparkle: an,
  star: nn,
  sun: en,
  trash: qe,
  "trend-down": Xe,
  "trend-up": Qe,
  upload: Je,
  video: je,
  user: Ve,
  wallet: Ze
}, ra = /* @__PURE__ */ new Set([
  "arrow-back",
  "arrow-forward",
  "chevron-back",
  "chevron-forward",
  "external",
  "send",
  "share",
  "sign-out"
]), ye = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 };
function w({ className: n, label: l, name: i, size: a = "md", tone: t = "default", ...s }) {
  const o = ze[i];
  return /* @__PURE__ */ e(
    o,
    {
      "aria-hidden": l ? void 0 : !0,
      "aria-label": l,
      className: f("nim-icon", n),
      "data-flip": ra.has(i) ? "true" : void 0,
      "data-tone": t === "default" ? void 0 : t,
      focusable: "false",
      height: ye[a],
      role: l ? "img" : void 0,
      strokeWidth: 1.75,
      width: ye[a],
      ...s
    }
  );
}
const bi = Object.keys(ze), ca = { sm: "sm", md: "md", lg: "md" }, F = Le(function({ className: l, label: i, name: a, size: t = "md", type: s = "button", variant: o = "ghost", ...c }, r) {
  return /* @__PURE__ */ e(
    "button",
    {
      "aria-label": i,
      className: f("nim-icon-button", `nim-icon-button--${o}`, `nim-icon-button--${t}`, l),
      ref: r,
      title: i,
      type: s,
      ...c,
      children: /* @__PURE__ */ e(w, { name: a, size: ca[t] })
    }
  );
}), oa = {
  close: "Close menu",
  menu: "Open menu",
  nav: "Admin navigation"
};
function vi({
  brand: n,
  children: l,
  className: i,
  groups: a,
  labels: t,
  sidebarFooter: s,
  title: o,
  toolbar: c,
  value: r
}) {
  const m = { ...oa, ...t }, [h, _] = D(!1), u = /* @__PURE__ */ e("nav", { "aria-label": m.nav, className: "nim-admin__nav", children: a.map((p) => /* @__PURE__ */ d("div", { className: "nim-admin__group", children: [
    /* @__PURE__ */ d("p", { className: "nim-admin__group-label", children: [
      p.icon ? /* @__PURE__ */ e(w, { name: p.icon, size: "xs" }) : null,
      p.label
    ] }),
    p.items.map((N) => {
      const v = N.key === r, b = /* @__PURE__ */ d(K, { children: [
        N.icon ? /* @__PURE__ */ e(w, { name: N.icon, size: "sm" }) : null,
        /* @__PURE__ */ e("span", { children: N.label })
      ] }), y = {
        "aria-current": v ? "page" : void 0,
        className: "nim-admin__link",
        "data-active": v ? "true" : void 0,
        onClick: () => {
          var k;
          (k = N.onSelect) == null || k.call(N), _(!1);
        }
      };
      return N.href ? /* @__PURE__ */ e("a", { href: N.href, ...y, children: b }, N.key) : /* @__PURE__ */ e("button", { type: "button", ...y, children: b }, N.key);
    })
  ] }, p.key)) });
  return /* @__PURE__ */ d("div", { className: f("nim-admin", i), "data-drawer": h ? "open" : void 0, children: [
    /* @__PURE__ */ d("aside", { className: "nim-admin__sidebar", children: [
      n ? /* @__PURE__ */ e("div", { className: "nim-admin__brand", children: n }) : null,
      u,
      s ? /* @__PURE__ */ e("div", { className: "nim-admin__sidebar-foot", children: s }) : null
    ] }),
    /* @__PURE__ */ d("div", { className: "nim-admin__drawer", hidden: !h, children: [
      /* @__PURE__ */ e("div", { className: "nim-admin__scrim", onClick: () => _(!1) }),
      /* @__PURE__ */ d("div", { className: "nim-admin__drawer-panel", children: [
        /* @__PURE__ */ d("div", { className: "nim-admin__drawer-head", children: [
          n,
          /* @__PURE__ */ e(F, { label: m.close, name: "close", onClick: () => _(!1), size: "sm" })
        ] }),
        u
      ] })
    ] }),
    /* @__PURE__ */ d("div", { className: "nim-admin__workspace", children: [
      /* @__PURE__ */ d("header", { className: "nim-admin__topbar", children: [
        /* @__PURE__ */ e(
          F,
          {
            "aria-expanded": h,
            className: "nim-admin__menu",
            label: m.menu,
            name: "menu",
            onClick: () => _(!0),
            size: "sm"
          }
        ),
        o ? /* @__PURE__ */ e("h1", { className: "nim-admin__title", children: o }) : null,
        c ? /* @__PURE__ */ e("div", { className: "nim-admin__toolbar", children: c }) : null
      ] }),
      /* @__PURE__ */ e("main", { className: "nim-admin__main", children: l })
    ] })
  ] });
}
function gi({
  actions: n,
  back: l,
  className: i,
  meta: a,
  status: t,
  subtitle: s,
  title: o
}) {
  return /* @__PURE__ */ d("header", { className: f("nim-detail-header", i), children: [
    l ? l.href ? /* @__PURE__ */ d("a", { className: "nim-detail-header__back", href: l.href, children: [
      /* @__PURE__ */ e(w, { name: "chevron-back", size: "sm" }),
      l.label
    ] }) : /* @__PURE__ */ d("button", { className: "nim-detail-header__back", onClick: l.onClick, type: "button", children: [
      /* @__PURE__ */ e(w, { name: "chevron-back", size: "sm" }),
      l.label
    ] }) : null,
    /* @__PURE__ */ d("div", { className: "nim-detail-header__row", children: [
      /* @__PURE__ */ d("div", { className: "nim-detail-header__text", children: [
        /* @__PURE__ */ d("div", { className: "nim-detail-header__headline", children: [
          /* @__PURE__ */ e("h1", { className: "nim-detail-header__title", children: o }),
          t ? /* @__PURE__ */ e("span", { className: "nim-detail-header__status", children: t }) : null
        ] }),
        s ? /* @__PURE__ */ e("p", { className: "nim-detail-header__subtitle", children: s }) : null,
        a ? /* @__PURE__ */ e("p", { className: "nim-detail-header__meta", children: a }) : null
      ] }),
      n ? /* @__PURE__ */ e("div", { className: "nim-detail-header__actions", children: n }) : null
    ] })
  ] });
}
function yi({
  chips: n,
  className: l,
  clearLabel: i,
  labels: a,
  onClearAll: t
}) {
  if (n.length === 0) return null;
  const s = {
    remove: (o) => `Remove filter ${o}`,
    toolbar: "Active filters",
    ...a
  };
  return /* @__PURE__ */ d("div", { "aria-label": s.toolbar, className: f("nim-filter-chips", l), role: "toolbar", children: [
    n.map((o) => /* @__PURE__ */ d("span", { className: "nim-filter-chip", children: [
      /* @__PURE__ */ d("span", { className: "nim-filter-chip__label", children: [
        o.label,
        o.value !== void 0 ? /* @__PURE__ */ d(K, { children: [
          ": ",
          o.value
        ] }) : null
      ] }),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": s.remove(typeof o.label == "string" ? o.label : o.key),
          className: "nim-filter-chip__remove",
          onClick: o.onRemove,
          type: "button",
          children: /* @__PURE__ */ e(w, { name: "close", size: "xs" })
        }
      )
    ] }, o.key)),
    t && i ? /* @__PURE__ */ e("button", { className: "nim-filter-chips__clear", onClick: t, type: "button", children: i }) : null
  ] });
}
function ki({ className: n, empty: l, events: i, locale: a }) {
  const t = new Intl.DateTimeFormat(a, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
  return i.length === 0 ? /* @__PURE__ */ e("div", { className: f("nim-activity", n), children: l }) : /* @__PURE__ */ e("ol", { className: f("nim-activity", n), children: i.map((s) => /* @__PURE__ */ d("li", { className: "nim-activity__item", "data-tone": s.tone, children: [
    /* @__PURE__ */ e("span", { className: "nim-activity__marker", children: s.icon ? /* @__PURE__ */ e(w, { name: s.icon, size: "xs" }) : null }),
    /* @__PURE__ */ d("div", { className: "nim-activity__body", children: [
      /* @__PURE__ */ d("p", { className: "nim-activity__action", children: [
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
function wi({ children: n, className: l, width: i = "wide", ...a }) {
  return /* @__PURE__ */ e("div", { className: f("nim-page", l), "data-width": i, ...a, children: n });
}
function Ci({
  actions: n,
  children: l,
  className: i,
  description: a,
  eyebrow: t,
  flush: s = !1,
  footer: o,
  title: c,
  ...r
}) {
  const m = c || a || t || n;
  return /* @__PURE__ */ d("section", { className: f("nim-panel", i), ...r, children: [
    m ? /* @__PURE__ */ d("header", { className: "nim-panel__head", children: [
      /* @__PURE__ */ d("div", { className: "nim-panel__heading", children: [
        t ? /* @__PURE__ */ e("p", { className: "nim-panel__eyebrow", children: t }) : null,
        c ? /* @__PURE__ */ e("h2", { className: "nim-panel__title", children: c }) : null,
        a ? /* @__PURE__ */ e("p", { className: "nim-panel__description", children: a }) : null
      ] }),
      n ? /* @__PURE__ */ e("div", { className: "nim-panel__actions", children: n }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-panel__body", "data-flush": s ? "true" : void 0, children: l }),
    o ? /* @__PURE__ */ e("div", { className: "nim-panel__foot", children: o }) : null
  ] });
}
function Si({ actions: n, children: l, className: i, ...a }) {
  return /* @__PURE__ */ d("div", { className: f("nim-toolbar", i), role: "toolbar", ...a, children: [
    l ? /* @__PURE__ */ e("div", { className: "nim-toolbar__group", children: l }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-toolbar__actions", children: n }) : null
  ] });
}
function Ti({
  className: n,
  delta: l,
  deltaDirection: i = "up",
  deltaIntent: a = "more-is-better",
  hint: t,
  icon: s,
  label: o,
  onClick: c,
  tone: r = "neutral",
  value: m,
  ...h
}) {
  const _ = a === "more-is-better" ? i === "up" : i === "down";
  return /* @__PURE__ */ d(
    c ? "button" : "div",
    {
      className: f("nim-metric", c && "nim-metric--interactive", n),
      "data-tone": r === "neutral" ? void 0 : r,
      onClick: c,
      type: c ? "button" : void 0,
      ...h,
      children: [
        /* @__PURE__ */ d("span", { className: "nim-metric__label", children: [
          s ? /* @__PURE__ */ e(w, { name: s, size: "xs" }) : null,
          o
        ] }),
        /* @__PURE__ */ e("span", { className: "nim-metric__value", children: m }),
        l || t ? /* @__PURE__ */ d("span", { className: "nim-metric__foot", children: [
          l ? /* @__PURE__ */ d("span", { className: "nim-metric__delta", "data-intent": _ ? "good" : "bad", children: [
            /* @__PURE__ */ e(w, { name: i === "up" ? "trend-up" : "trend-down", size: "xs" }),
            l
          ] }) : null,
          t ? /* @__PURE__ */ e("span", { className: "nim-metric__hint", children: t }) : null
        ] }) : null
      ]
    }
  );
}
function Ai({ children: n, className: l, columns: i = 4, ...a }) {
  return /* @__PURE__ */ e("div", { className: f("nim-metric-grid", l), "data-columns": i, ...a, children: n });
}
function xi({ className: n, columns: l = 2, items: i, ...a }) {
  return /* @__PURE__ */ e("dl", { className: f("nim-facts", n), "data-columns": l, ...a, children: i.map((t, s) => /* @__PURE__ */ d("div", { className: "nim-facts__item", children: [
    /* @__PURE__ */ e("dt", { className: "nim-facts__label", children: t.label }),
    /* @__PURE__ */ e("dd", { className: "nim-facts__value", "data-mono": t.mono ? "true" : void 0, children: t.value })
  ] }, t.key ?? s)) });
}
function Di({ children: n, className: l, template: i = "halves", ...a }) {
  return /* @__PURE__ */ e("div", { className: f("nim-columns", l), "data-template": i, ...a, children: n });
}
function Ei({
  children: n,
  className: l,
  copiedLabel: i = "Copied",
  copyLabel: a = "Copy",
  label: t,
  wrap: s = !1,
  ...o
}) {
  const [c, r] = D(!1), m = typeof navigator < "u" && !!navigator.clipboard, h = O(() => {
    navigator.clipboard.writeText(n).then(() => {
      r(!0), window.setTimeout(() => r(!1), 1600);
    });
  }, [n]);
  return /* @__PURE__ */ d("figure", { className: f("nim-code", l), children: [
    t || m ? /* @__PURE__ */ d("figcaption", { className: "nim-code__head", children: [
      t ? /* @__PURE__ */ e("span", { className: "nim-code__label", children: t }) : /* @__PURE__ */ e("span", {}),
      m ? /* @__PURE__ */ d("button", { className: "nim-code__copy", onClick: h, type: "button", children: [
        /* @__PURE__ */ e(w, { name: c ? "check" : "copy", size: "xs" }),
        c ? i : a
      ] }) : null
    ] }) : null,
    /* @__PURE__ */ e("pre", { className: "nim-code__body", "data-wrap": s ? "true" : void 0, tabIndex: 0, ...o, children: n })
  ] });
}
function Mi({ children: n, className: l, pulse: i = !1, tone: a = "neutral", ...t }) {
  return /* @__PURE__ */ d("span", { className: f("nim-status", l), "data-tone": a, ...t, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-status__dot", "data-pulse": i ? "true" : void 0 }),
    n
  ] });
}
function Li({ children: n, className: l, size: i = "sm", ...a }) {
  return /* @__PURE__ */ e("code", { className: f("nim-mono", l), "data-size": i, ...a, children: n });
}
function zi({ className: n, href: l, meta: i, onClick: a, title: t }) {
  const s = /* @__PURE__ */ d(K, { children: [
    /* @__PURE__ */ e("strong", { className: "nim-record__title", children: t }),
    i ? /* @__PURE__ */ e("span", { className: "nim-record__meta", children: i }) : null
  ] });
  return l ? /* @__PURE__ */ e("a", { className: f("nim-record", n), href: l, children: s }) : a ? /* @__PURE__ */ e("button", { className: f("nim-record", n), onClick: a, type: "button", children: s }) : /* @__PURE__ */ e("span", { className: f("nim-record", n), children: s });
}
function $i({ aside: n, children: l, className: i, ...a }) {
  return /* @__PURE__ */ d("div", { className: f("nim-detail", i), ...a, children: [
    /* @__PURE__ */ e("div", { className: "nim-detail__main", children: l }),
    n ? /* @__PURE__ */ e("aside", { className: "nim-detail__aside", children: n }) : null
  ] });
}
const j = Le(function({
  children: l,
  className: i,
  fullWidth: a = !1,
  iconEnd: t,
  iconStart: s,
  size: o = "md",
  variant: c = "primary",
  ...r
}, m) {
  const h = f(
    "nim-button",
    `nim-button--${c}`,
    `nim-button--${o}`,
    a && "nim-button--full",
    i
  ), _ = /* @__PURE__ */ d(K, { children: [
    s ? /* @__PURE__ */ e(w, { name: s, size: "sm" }) : null,
    /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
    t ? /* @__PURE__ */ e(w, { name: t, size: "sm" }) : null
  ] });
  if ("href" in r && r.href !== void 0) {
    const { href: b, rel: y, target: k, ...x } = r;
    return /* @__PURE__ */ e(
      "a",
      {
        className: h,
        href: b,
        ref: m,
        rel: k === "_blank" ? y ?? "noreferrer" : y,
        target: k,
        ...x,
        children: _
      }
    );
  }
  const {
    disabled: u = !1,
    loading: p = !1,
    type: N = "button",
    ...v
  } = r;
  return /* @__PURE__ */ d(
    "button",
    {
      "aria-busy": p || void 0,
      className: f(h, p && "nim-button--loading"),
      disabled: u || p,
      ref: m,
      type: N,
      ...v,
      children: [
        p ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-button__spinner" }) : null,
        p ? /* @__PURE__ */ d(K, { children: [
          /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
          t ? /* @__PURE__ */ e(w, { name: t, size: "sm" }) : null
        ] }) : _
      ]
    }
  );
});
function da({ actions: n, className: l, description: i, icon: a = "search", title: t, ...s }) {
  return /* @__PURE__ */ d("div", { className: f("nim-empty", l), ...s, children: [
    /* @__PURE__ */ e("span", { className: "nim-empty__icon", children: /* @__PURE__ */ e(w, { name: a, size: "md" }) }),
    /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: t }),
    i ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-empty__body", children: i }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-empty__actions", children: n }) : null
  ] });
}
const ma = (n, l) => {
  if (l <= 7) return Array.from({ length: l }, (t, s) => s + 1);
  const i = /* @__PURE__ */ new Set([1, l, n, n - 1, n + 1]);
  n <= 3 && [2, 3, 4].forEach((t) => i.add(t)), n >= l - 2 && [l - 3, l - 2, l - 1].forEach((t) => i.add(t));
  const a = [...i].filter((t) => t >= 1 && t <= l).sort((t, s) => t - s);
  return a.flatMap((t, s) => s > 0 && t - a[s - 1] > 1 ? ["gap", t] : [t]);
};
function ua({
  className: n,
  label: l = "Pagination",
  nextLabel: i = "Next page",
  onChange: a,
  page: t,
  pageCount: s,
  previousLabel: o = "Previous page",
  summary: c
}) {
  return /* @__PURE__ */ d("nav", { "aria-label": l, className: f("nim-pagination", n), children: [
    c ? /* @__PURE__ */ e("p", { className: "nim-pagination__summary", children: c }) : /* @__PURE__ */ e("span", {}),
    /* @__PURE__ */ d("div", { className: "nim-pagination__list", children: [
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": o,
          className: "nim-pagination__item",
          disabled: t <= 1,
          onClick: () => a(t - 1),
          type: "button",
          children: /* @__PURE__ */ e(w, { name: "chevron-back", size: "sm" })
        }
      ),
      ma(t, s).map(
        (r, m) => r === "gap" ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-pagination__ellipsis", children: "…" }, `gap-${m}`) : /* @__PURE__ */ e(
          "button",
          {
            "aria-current": r === t ? "page" : void 0,
            className: "nim-pagination__item",
            onClick: () => a(r),
            type: "button",
            children: r
          },
          r
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
          children: /* @__PURE__ */ e(w, { name: "chevron-forward", size: "sm" })
        }
      )
    ] })
  ] });
}
function ke({ caption: n, className: l, columns: i, onSort: a, rowKey: t, rows: s, sort: o }) {
  return /* @__PURE__ */ e("div", { className: f("nim-table-wrap", l), children: /* @__PURE__ */ d("table", { className: "nim-table", children: [
    n ? /* @__PURE__ */ e("caption", { className: "nim-caption", children: n }) : null,
    /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ e("tr", { children: i.map((c) => {
      const r = (o == null ? void 0 : o.key) === c.key ? o.direction : void 0;
      return /* @__PURE__ */ e(
        "th",
        {
          "aria-sort": r,
          className: f(c.numeric && "nim-table__cell--numeric"),
          scope: "col",
          style: c.width ? { inlineSize: c.width } : void 0,
          children: c.sortable && a ? /* @__PURE__ */ d("button", { className: "nim-table__sort", onClick: () => a(c.key), type: "button", children: [
            c.header,
            r ? /* @__PURE__ */ e(w, { name: r === "ascending" ? "chevron-up" : "chevron-down", size: "xs" }) : null
          ] }) : c.header
        },
        c.key
      );
    }) }) }),
    /* @__PURE__ */ e("tbody", { children: s.map((c) => /* @__PURE__ */ e("tr", { children: i.map((r) => /* @__PURE__ */ e("td", { className: f(r.numeric && "nim-table__cell--numeric"), children: r.render(c) }, r.key)) }, t(c))) })
  ] }) });
}
function we({ children: n, className: l, description: i, ...a }) {
  return /* @__PURE__ */ d("label", { className: f("nim-choice nim-choice--checkbox", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", type: "checkbox", ...a }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-checkbox__box", children: /* @__PURE__ */ e(w, { name: "check", size: "xs" }) }),
    /* @__PURE__ */ d("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
function ha({ children: n, className: l, description: i, ...a }) {
  return /* @__PURE__ */ d("label", { className: f("nim-choice nim-choice--switch", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", role: "switch", type: "checkbox", ...a }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-switch__track", children: /* @__PURE__ */ e("span", { className: "nim-switch__thumb" }) }),
    /* @__PURE__ */ d("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
function Ii({ children: n, className: l, description: i, ...a }) {
  const t = fe($e);
  return /* @__PURE__ */ d("label", { className: f("nim-choice nim-choice--radio", l), children: [
    /* @__PURE__ */ e(
      "input",
      {
        ...a,
        checked: t ? t.value === a.value : a.checked,
        className: "nim-choice__input",
        name: (t == null ? void 0 : t.name) ?? a.name,
        onChange: (s) => {
          var o;
          t == null || t.onChange(s.target.value), (o = a.onChange) == null || o.call(a, s);
        },
        type: "radio"
      }
    ),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-radio__mark" }),
    /* @__PURE__ */ d("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
const $e = pe(null);
function Pi({
  children: n,
  className: l,
  error: i,
  hint: a,
  label: t,
  layout: s = "stack",
  name: o,
  onChange: c,
  value: r
}) {
  const m = q(), h = o ?? `nim-radio-${m}`, _ = a ? `${h}-hint` : void 0, u = i ? `${h}-error` : void 0;
  return /* @__PURE__ */ e($e.Provider, { value: { name: h, onChange: c, value: r }, children: /* @__PURE__ */ d(
    "fieldset",
    {
      "aria-describedby": [u, _].filter(Boolean).join(" ") || void 0,
      "aria-invalid": i ? !0 : void 0,
      className: f("nim-radio-group", i && "nim-radio-group--invalid", l),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-radio-group__legend", children: t }),
        /* @__PURE__ */ e("div", { className: f("nim-radio-group__options", `nim-radio-group__options--${s}`), children: n }),
        i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: u, children: i }) : null,
        a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: _, children: a }) : null
      ]
    }
  ) });
}
function Ie({ className: n, label: l = "Loading", size: i = "md", ...a }) {
  return /* @__PURE__ */ e(
    "span",
    {
      className: f("nim-spinner", i !== "md" && `nim-spinner--${i}`, n),
      role: "status",
      ...a,
      children: /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: l })
    }
  );
}
function _a({ className: n, label: l, value: i, ...a }) {
  const t = i === void 0, s = t ? 0 : Math.min(100, Math.max(0, i));
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": l,
      "aria-valuemax": 100,
      "aria-valuemin": 0,
      "aria-valuenow": t ? void 0 : s,
      className: f("nim-progress", t && "nim-progress--indeterminate", n),
      role: "progressbar",
      ...a,
      children: /* @__PURE__ */ e("div", { className: "nim-progress__fill", style: t ? void 0 : { inlineSize: `${s}%` } })
    }
  );
}
function pa({ className: n, height: l = "1em", radius: i, width: a = "100%", ...t }) {
  return /* @__PURE__ */ e(
    "span",
    {
      "aria-hidden": "true",
      className: f("nim-skeleton", n),
      style: { blockSize: l, borderRadius: i, inlineSize: a },
      ...t
    }
  );
}
const fa = (n) => Array.from({ length: n }, (l, i) => ({ __skeleton: i })), Na = {
  selectAll: "Select all rows",
  selectRow: "Select row"
};
function Bi({
  caption: n,
  className: l,
  columns: i,
  empty: a,
  error: t,
  labels: s,
  loading: o = !1,
  onPageChange: c,
  onRetry: r,
  onSort: m,
  page: h,
  pageCount: _,
  refreshing: u = !1,
  retryLabel: p = "Try again",
  rowKey: N,
  rows: v,
  selection: b,
  skeletonRows: y = 6,
  sort: k,
  summary: x,
  toolbar: z
}) {
  const B = { ...Na, ...s }, C = v.length > 0 && b ? v.every((A) => b.isSelected(A)) : !1, I = b ? [
    {
      header: b.onToggleAll ? /* @__PURE__ */ e(
        we,
        {
          "aria-label": B.selectAll,
          checked: C,
          onChange: (A) => {
            var T;
            return (T = b.onToggleAll) == null ? void 0 : T.call(b, A.currentTarget.checked);
          }
        }
      ) : /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: B.selectAll }),
      key: "__select",
      render: (A) => {
        var T;
        return /* @__PURE__ */ e(
          we,
          {
            "aria-label": ((T = b.label) == null ? void 0 : T.call(b, A)) ?? B.selectRow,
            checked: b.isSelected(A),
            onChange: ($) => b.onToggle(A, $.currentTarget.checked)
          }
        );
      },
      width: "2.5rem"
    },
    ...i
  ] : i;
  let S;
  return t ? S = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: /* @__PURE__ */ e(
    da,
    {
      actions: r ? /* @__PURE__ */ e(j, { onClick: r, size: "sm", variant: "secondary", children: p }) : void 0,
      icon: "danger",
      title: t
    }
  ) }) : o ? S = /* @__PURE__ */ e(
    ke,
    {
      caption: n,
      columns: I.map((A) => ({
        ...A,
        render: () => /* @__PURE__ */ e(pa, { height: "0.9em", width: A.numeric ? "3rem" : "70%" }),
        sortable: !1
      })),
      rowKey: (A) => `skeleton-${A.__skeleton}`,
      rows: fa(y)
    }
  ) : v.length === 0 ? S = /* @__PURE__ */ e("div", { className: "nim-data-table__state", children: a }) : S = /* @__PURE__ */ e(
    ke,
    {
      caption: n,
      columns: I,
      onSort: m,
      rowKey: N,
      rows: v,
      sort: k
    }
  ), /* @__PURE__ */ d("div", { className: f("nim-data-table", l), "data-refreshing": u ? "true" : void 0, children: [
    z,
    /* @__PURE__ */ d("div", { className: "nim-data-table__body", children: [
      S,
      u ? /* @__PURE__ */ e("span", { className: "nim-data-table__pulse", children: /* @__PURE__ */ e(w, { name: "loading", size: "xs" }) }) : null
    ] }),
    h && _ && _ > 1 && c ? /* @__PURE__ */ e(ua, { onChange: c, page: h, pageCount: _, summary: x }) : x ? /* @__PURE__ */ e("p", { className: "nim-data-table__summary", children: x }) : null
  ] });
}
function Ri({
  className: n,
  defaultOpen: l = [],
  items: i,
  mode: a = "multiple",
  onOpenChange: t,
  open: s,
  variant: o = "panel"
}) {
  const c = q(), [r, m] = D(l), h = s ?? r, _ = (u) => {
    const p = h.includes(u), N = a === "single" ? p ? [] : [u] : p ? h.filter((v) => v !== u) : [...h, u];
    s || m(N), t == null || t(N);
  };
  return /* @__PURE__ */ e("div", { className: f("nim-accordion", `nim-accordion--${o}`, n), children: i.map((u) => {
    const p = h.includes(u.id), N = `${c}-${u.id}`;
    return /* @__PURE__ */ d("div", { className: "nim-accordion__item", "data-open": p || void 0, children: [
      /* @__PURE__ */ d(
        "button",
        {
          "aria-controls": N,
          "aria-expanded": p,
          className: "nim-accordion__trigger",
          disabled: u.disabled,
          id: `${N}-trigger`,
          onClick: () => _(u.id),
          type: "button",
          children: [
            /* @__PURE__ */ e("span", { className: "nim-accordion__title", children: u.title }),
            u.meta ? /* @__PURE__ */ e("span", { className: "nim-accordion__meta", children: u.meta }) : null,
            /* @__PURE__ */ e(w, { className: "nim-accordion__chevron", name: "chevron-down", size: "sm" })
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
              children: u.content
            }
          )
        }
      )
    ] }, u.id);
  }) });
}
function ba({ className: n, items: l, label: i, renderItem: a, value: t }) {
  return /* @__PURE__ */ e("nav", { "aria-label": i, className: f("nim-tab-bar", n), children: /* @__PURE__ */ e("div", { className: "nim-tab-bar__row", style: { "--nim-tab-count": l.length }, children: l.map((s) => {
    const o = s.key === t, c = /* @__PURE__ */ d(K, { children: [
      /* @__PURE__ */ e(w, { name: s.icon, size: s.center ? "lg" : "md" }),
      /* @__PURE__ */ e("span", { className: "nim-tab-bar__label", children: s.label })
    ] }), r = {
      "aria-current": o ? "page" : void 0,
      "aria-label": s.fullLabel ?? s.label,
      className: f("nim-tab-bar__item", s.center && "nim-tab-bar__item--center"),
      "data-active": o ? "true" : void 0
    };
    return a ? /* @__PURE__ */ e("div", { className: "nim-tab-bar__slot", children: a(s, c, r) }, s.key) : s.href ? /* @__PURE__ */ e("a", { href: s.href, ...r, children: c }, s.key) : /* @__PURE__ */ e("button", { onClick: s.onSelect, type: "button", ...r, children: c }, s.key);
  }) }) });
}
function Fi({ children: n, className: l, header: i, tabs: a }) {
  return /* @__PURE__ */ d("div", { className: f("nim-app-shell", l), children: [
    i ? /* @__PURE__ */ e("header", { className: "nim-app-shell__header", children: i }) : null,
    /* @__PURE__ */ e("main", { className: "nim-app-shell__content", "data-has-tabs": a ? "true" : void 0, children: n }),
    a ? /* @__PURE__ */ e(ba, { ...a }) : null
  ] });
}
function me({
  action: n,
  back: l,
  brand: i,
  children: a,
  className: t,
  footer: s,
  subtitle: o,
  title: c
}) {
  return /* @__PURE__ */ d("section", { className: f("nim-auth", t), children: [
    i ? /* @__PURE__ */ e("div", { className: "nim-auth__brand", children: i }) : null,
    /* @__PURE__ */ d("div", { className: "nim-auth__body", children: [
      l ? /* @__PURE__ */ e(j, { className: "nim-auth__back", iconStart: "chevron-back", onClick: l.onClick, size: "sm", variant: "ghost", children: l.label }) : null,
      /* @__PURE__ */ e("h1", { className: "nim-auth__title", children: c }),
      o ? /* @__PURE__ */ e("p", { className: "nim-auth__subtitle", children: o }) : null,
      /* @__PURE__ */ e("div", { className: "nim-auth__fields", children: a })
    ] }),
    /* @__PURE__ */ d("div", { className: "nim-auth__foot", children: [
      n ? /* @__PURE__ */ e(
        j,
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
const va = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((l) => {
  var i;
  return ((i = l[0]) == null ? void 0 : i.toUpperCase()) ?? "";
}).join("");
function ga({ className: n, name: l, shape: i = "round", size: a = "md", src: t, ...s }) {
  return /* @__PURE__ */ d(
    "span",
    {
      className: f("nim-avatar", a !== "md" && `nim-avatar--${a}`, i === "square" && "nim-avatar--square", n),
      ...s,
      children: [
        t ? /* @__PURE__ */ e("img", { alt: "", src: t }) : /* @__PURE__ */ e("span", { "aria-hidden": "true", children: va(l) }),
        /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: l })
      ]
    }
  );
}
function Oi({
  caption: n,
  className: l,
  initials: i,
  label: a,
  size: t = 96,
  src: s,
  value: o
}) {
  const c = Math.max(4, Math.round(t * 0.05)), r = (t - c) / 2, m = 2 * Math.PI * r, h = Math.min(100, Math.max(0, o)) / 100 * m;
  return /* @__PURE__ */ d(
    "div",
    {
      "aria-label": a,
      className: f("nim-avatar-ring", l),
      role: "img",
      style: { "--nim-ring-size": `${t}px`, "--nim-ring-stroke": `${c}px` },
      children: [
        /* @__PURE__ */ d("svg", { "aria-hidden": "true", className: "nim-avatar-ring__arc", viewBox: `0 0 ${t} ${t}`, children: [
          /* @__PURE__ */ e(
            "circle",
            {
              className: "nim-avatar-ring__track",
              cx: t / 2,
              cy: t / 2,
              fill: "none",
              r,
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
              r,
              strokeDasharray: `${h} ${m}`,
              strokeLinecap: "round",
              strokeWidth: c
            }
          )
        ] }),
        /* @__PURE__ */ d("span", { className: "nim-avatar-ring__face", children: [
          s ? /* @__PURE__ */ e("img", { alt: "", className: "nim-avatar-ring__image", src: s }) : /* @__PURE__ */ e("span", { className: "nim-avatar-ring__initials", children: i }),
          n && !s ? /* @__PURE__ */ e("span", { className: "nim-avatar-ring__caption", children: n }) : null
        ] })
      ]
    }
  );
}
function ya({
  actions: n,
  avatar: l,
  chips: i,
  className: a,
  eyebrow: t,
  name: s,
  stats: o = []
}) {
  return /* @__PURE__ */ d("section", { className: f("nim-profile-header", a), children: [
    /* @__PURE__ */ d("div", { className: "nim-profile-header__identity", children: [
      l,
      /* @__PURE__ */ d("div", { className: "nim-profile-header__who", children: [
        t ? /* @__PURE__ */ e("p", { className: "nim-profile-header__eyebrow", children: t }) : null,
        /* @__PURE__ */ e("h1", { className: "nim-profile-header__name", children: s }),
        i ? /* @__PURE__ */ e("div", { className: "nim-profile-header__chips", children: i }) : null
      ] })
    ] }),
    o.length ? /* @__PURE__ */ e("dl", { className: "nim-profile-header__stats", children: o.map((c, r) => /* @__PURE__ */ d("div", { className: "nim-profile-header__stat", children: [
      /* @__PURE__ */ e("dt", { className: "nim-profile-header__stat-label", children: c.label }),
      /* @__PURE__ */ e("dd", { className: "nim-profile-header__stat-value", children: c.value })
    ] }, r)) }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-profile-header__actions", children: n }) : null
  ] });
}
function Ui({
  children: n,
  className: l,
  dot: i = !1,
  pill: a = !1,
  size: t = "md",
  tone: s = "soft",
  variant: o = "neutral",
  ...c
}) {
  return /* @__PURE__ */ d(
    "span",
    {
      className: f(
        "nim-badge",
        `nim-badge--${o}`,
        `nim-badge--${s}`,
        t === "sm" && "nim-badge--sm",
        a && "nim-badge--pill",
        l
      ),
      ...c,
      children: [
        i ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-badge__dot" }) : null,
        n
      ]
    }
  );
}
const ka = {
  accent: "sparkle",
  danger: "danger",
  info: "info",
  neutral: "info",
  success: "check-circle",
  warning: "alert"
};
function wa({
  action: n,
  children: l,
  className: i,
  icon: a,
  title: t,
  tone: s = "neutral",
  ...o
}) {
  return /* @__PURE__ */ d(
    "div",
    {
      className: f("nim-banner", `nim-banner--${s}`, i),
      role: s === "danger" ? "alert" : "status",
      ...o,
      children: [
        /* @__PURE__ */ e(w, { className: "nim-banner__icon", name: a ?? ka[s], size: "sm" }),
        /* @__PURE__ */ d("div", { className: "nim-banner__content", children: [
          t ? /* @__PURE__ */ e("p", { className: "nim-banner__title", children: t }) : null,
          /* @__PURE__ */ e("div", { children: l })
        ] }),
        n ? /* @__PURE__ */ e("div", { children: n }) : null
      ]
    }
  );
}
function Gi({ className: n, items: l, label: i = "Breadcrumb" }) {
  return /* @__PURE__ */ e("nav", { "aria-label": i, className: f("nim-breadcrumb", n), children: l.map((a, t) => {
    const s = t === l.length - 1;
    return /* @__PURE__ */ d(We, { children: [
      t > 0 ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-breadcrumb__separator", children: /* @__PURE__ */ e(w, { name: "chevron-forward", size: "xs" }) }) : null,
      s || !a.href ? /* @__PURE__ */ e("span", { "aria-current": s ? "page" : void 0, className: "nim-breadcrumb__current", children: a.label }) : /* @__PURE__ */ e("a", { className: "nim-breadcrumb__link", href: a.href, children: a.label })
    ] }, a.label);
  }) });
}
function Ki({
  as: n = "article",
  children: l,
  className: i,
  footer: a,
  header: t,
  interactive: s = !1,
  padding: o = "md",
  variant: c = "default",
  ...r
}) {
  return /* @__PURE__ */ d(
    n,
    {
      className: f(
        "nim-card",
        `nim-card--${c}`,
        `nim-card--pad-${o}`,
        s && "nim-card--interactive",
        i
      ),
      ...r,
      children: [
        t ? /* @__PURE__ */ e("div", { className: "nim-card__header", children: t }) : null,
        l,
        a ? /* @__PURE__ */ e("div", { className: "nim-card__footer", children: a }) : null
      ]
    }
  );
}
function Wi({
  badge: n,
  className: l,
  description: i,
  detail: a,
  disabled: t = !1,
  icon: s,
  name: o,
  onSelect: c,
  selected: r,
  title: m
}) {
  return /* @__PURE__ */ d("label", { className: f("nim-option-card", r && "nim-option-card--selected", l), children: [
    /* @__PURE__ */ e(
      "input",
      {
        checked: r,
        className: "nim-option-card__input",
        disabled: t,
        name: o,
        onChange: c,
        type: "radio"
      }
    ),
    s ? /* @__PURE__ */ e("span", { className: "nim-option-card__icon", children: /* @__PURE__ */ e(w, { name: s, size: "md" }) }) : null,
    /* @__PURE__ */ d("span", { className: "nim-option-card__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-option-card__title", children: m }),
      i ? /* @__PURE__ */ e("span", { className: "nim-option-card__description", children: i }) : null,
      r && a ? /* @__PURE__ */ e("span", { className: "nim-option-card__detail", children: a }) : null
    ] }),
    n ? /* @__PURE__ */ e("span", { className: "nim-option-card__badge", children: n }) : null,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-option-card__dot" })
  ] });
}
function Hi({ className: n, items: l, title: i, totals: a = [] }) {
  return /* @__PURE__ */ d("section", { className: f("nim-summary", n), children: [
    i ? /* @__PURE__ */ e("h2", { className: "nim-summary__title", children: i }) : null,
    /* @__PURE__ */ e("dl", { className: "nim-summary__lines", children: l.map((t) => /* @__PURE__ */ d("div", { className: "nim-summary__line", children: [
      /* @__PURE__ */ d("dt", { children: [
        /* @__PURE__ */ e("span", { className: "nim-summary__label", children: t.label }),
        t.meta ? /* @__PURE__ */ e("span", { className: "nim-summary__meta", children: t.meta }) : null
      ] }),
      /* @__PURE__ */ e("dd", { className: "nim-summary__value", children: t.value })
    ] }, t.key)) }),
    a.length ? /* @__PURE__ */ d(K, { children: [
      /* @__PURE__ */ e("hr", { className: "nim-summary__rule" }),
      /* @__PURE__ */ e("dl", { className: "nim-summary__lines nim-summary__lines--totals", children: a.map((t) => /* @__PURE__ */ d(
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
function Yi({ action: n, className: l, note: i, total: a }) {
  return /* @__PURE__ */ d("div", { className: f("nim-action-bar", l), children: [
    /* @__PURE__ */ d("div", { className: "nim-action-bar__row", children: [
      a ? /* @__PURE__ */ d("div", { className: "nim-action-bar__total", children: [
        /* @__PURE__ */ e("span", { className: "nim-action-bar__total-label", children: a.label }),
        /* @__PURE__ */ e("strong", { className: "nim-action-bar__total-value", children: a.value })
      ] }) : null,
      /* @__PURE__ */ e("div", { className: "nim-action-bar__action", children: n })
    ] }),
    i ? /* @__PURE__ */ e("p", { className: "nim-action-bar__note", children: i }) : null
  ] });
}
const Ca = {
  download: "Download",
  failed: "Not delivered",
  pause: "Pause",
  play: "Play",
  read: "Read",
  sending: "Sending",
  sent: "Sent",
  today: "Today",
  typing: "is typing",
  yesterday: "Yesterday",
  voiceMessage: "Voice message"
}, Ce = 1024;
function Sa(n, l) {
  const i = ["B", "KB", "MB", "GB"];
  let a = n, t = 0;
  for (; a >= Ce && t < i.length - 1; )
    a /= Ce, t += 1;
  return `${new Intl.NumberFormat(l, { maximumFractionDigits: t === 0 ? 0 : 1 }).format(a)} ${i[t]}`;
}
function Pe(n, l) {
  const i = new Intl.NumberFormat(l, { minimumIntegerDigits: 2, useGrouping: !1 }), a = Math.max(0, Math.round(n));
  return `${new Intl.NumberFormat(l).format(Math.floor(a / 60))}:${i.format(a % 60)}`;
}
function Ta({
  attachment: n,
  labels: l,
  locale: i
}) {
  const a = L(null), [t, s] = D(!1), [o, c] = D(0), r = n.duration ?? 0, m = Y(
    () => n.waveform ?? Array.from({ length: 32 }, (_, u) => 0.35 + u * 7 % 11 / 18),
    [n.waveform]
  ), h = r > 0 ? Math.min(1, o / r) : 0;
  return /* @__PURE__ */ d("div", { className: "nim-chat-voice", children: [
    /* @__PURE__ */ e(
      F,
      {
        label: t ? l.pause : l.play,
        name: t ? "pause" : "play",
        onClick: () => {
          const _ = a.current;
          _ && (_.paused ? _.play() : _.pause());
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
        children: m.map((_, u) => /* @__PURE__ */ e(
          "span",
          {
            className: "nim-chat-voice__bar",
            "data-played": u / m.length <= h ? "true" : void 0,
            style: { blockSize: `${Math.round(_ * 100)}%` }
          },
          u
        ))
      }
    ),
    /* @__PURE__ */ e("span", { className: "nim-chat-voice__time", children: Pe(t || o ? Math.max(0, r - o) : r, i) }),
    /* @__PURE__ */ e(
      "audio",
      {
        onEnded: () => {
          s(!1), c(0);
        },
        onPause: () => s(!1),
        onPlay: () => s(!0),
        onTimeUpdate: (_) => c(_.currentTarget.currentTime),
        preload: "metadata",
        ref: a,
        src: n.url
      }
    )
  ] });
}
function Aa({
  attachment: n,
  labels: l,
  locale: i
}) {
  return n.kind === "voice" ? /* @__PURE__ */ e(Ta, { attachment: n, labels: l, locale: i }) : n.kind === "video" ? /* @__PURE__ */ d("figure", { className: "nim-chat-media", children: [
    /* @__PURE__ */ e("video", { controls: !0, playsInline: !0, poster: n.poster, preload: "metadata", src: n.url }),
    n.duration ? /* @__PURE__ */ e("figcaption", { className: "nim-chat-media__meta", children: Pe(n.duration, i) }) : null
  ] }) : n.kind === "image" ? /* @__PURE__ */ e("figure", { className: "nim-chat-media", children: /* @__PURE__ */ e("img", { alt: n.name ?? "", loading: "lazy", src: n.url }) }) : /* @__PURE__ */ d(
    "a",
    {
      className: "nim-chat-file",
      download: n.name,
      href: n.url,
      rel: "noreferrer",
      target: "_blank",
      children: [
        /* @__PURE__ */ e("span", { className: "nim-chat-file__icon", children: /* @__PURE__ */ e(w, { name: "document", size: "md" }) }),
        /* @__PURE__ */ d("span", { className: "nim-chat-file__text", children: [
          /* @__PURE__ */ e("span", { className: "nim-chat-file__name", children: n.name ?? l.download }),
          n.size !== void 0 ? /* @__PURE__ */ e("span", { className: "nim-chat-file__size", children: Sa(n.size, i) }) : null
        ] }),
        /* @__PURE__ */ e(w, { className: "nim-chat-file__action", name: "download", size: "sm" })
      ]
    }
  );
}
function Zi({
  className: n,
  composer: l,
  footer: i,
  header: a,
  labels: t,
  locale: s,
  messages: o,
  typing: c
}) {
  const r = { ...Ca, ...t }, m = L(null), h = L(!0), _ = Y(
    () => new Intl.DateTimeFormat(s, { hour: "2-digit", minute: "2-digit" }),
    [s]
  );
  return Z(() => {
    const u = m.current;
    !u || !h.current || (u.scrollTop = u.scrollHeight);
  }, [o, c]), /* @__PURE__ */ d("section", { className: f("nim-chat", n), children: [
    a ? /* @__PURE__ */ e("header", { className: "nim-chat__header", children: a }) : null,
    /* @__PURE__ */ d(
      "div",
      {
        className: "nim-chat__scroll",
        onScroll: (u) => {
          const p = u.currentTarget;
          h.current = p.scrollHeight - p.scrollTop - p.clientHeight < 48;
        },
        ref: m,
        children: [
          /* @__PURE__ */ e("ol", { "aria-live": "polite", className: "nim-chat__list", children: o.map((u) => {
            var p;
            return /* @__PURE__ */ d(
              "li",
              {
                className: f("nim-chat-message", u.own && "nim-chat-message--own"),
                children: [
                  !u.own && u.author ? /* @__PURE__ */ e(
                    ga,
                    {
                      className: "nim-chat-message__avatar",
                      name: u.author.name,
                      size: "sm",
                      src: u.author.avatar
                    }
                  ) : null,
                  /* @__PURE__ */ d("div", { className: "nim-chat-message__stack", children: [
                    !u.own && u.author ? /* @__PURE__ */ e("span", { className: "nim-chat-message__author", children: u.author.name }) : null,
                    /* @__PURE__ */ d("div", { className: "nim-chat-message__bubble", children: [
                      (p = u.attachments) == null ? void 0 : p.map((N, v) => /* @__PURE__ */ e(
                        Aa,
                        {
                          attachment: N,
                          labels: r,
                          locale: s
                        },
                        `${u.id}-${v}`
                      )),
                      u.text ? /* @__PURE__ */ e("p", { className: "nim-chat-message__text", children: u.text }) : null
                    ] }),
                    /* @__PURE__ */ d("span", { className: "nim-chat-message__meta", children: [
                      u.at ? /* @__PURE__ */ e("time", { dateTime: u.at, children: _.format(new Date(u.at)) }) : null,
                      u.own && u.status ? /* @__PURE__ */ e("span", { className: "nim-chat-message__status", "data-status": u.status, children: u.status === "sending" ? /* @__PURE__ */ e(Ie, { size: "sm" }) : /* @__PURE__ */ e(
                        w,
                        {
                          label: r[u.status],
                          name: u.status === "failed" ? "danger" : "check-circle",
                          size: "xs"
                        }
                      ) }) : null
                    ] })
                  ] })
                ]
              },
              u.id
            );
          }) }),
          c ? /* @__PURE__ */ d("p", { className: "nim-chat__typing", children: [
            typeof c == "string" ? `${c} ${r.typing}` : r.typing,
            /* @__PURE__ */ d("span", { "aria-hidden": "true", className: "nim-chat__dots", children: [
              /* @__PURE__ */ e("i", {}),
              /* @__PURE__ */ e("i", {}),
              /* @__PURE__ */ e("i", {})
            ] })
          ] }) : null,
          i ? /* @__PURE__ */ e("div", { className: "nim-chat__footer", children: i }) : null
        ]
      }
    ),
    l ? /* @__PURE__ */ e("div", { className: "nim-chat__composer", children: l }) : null
  ] });
}
const xa = {
  attach: "Attach a file",
  cancel: "Cancel recording",
  discard: "Remove attachment",
  record: "Record a voice message",
  recording: "Recording",
  send: "Send",
  stop: "Stop and attach",
  video: "Attach a video"
}, Da = () => {
  var n;
  return typeof navigator < "u" && typeof window < "u" && "MediaRecorder" in window && !!((n = navigator.mediaDevices) != null && n.getUserMedia);
}, Ea = (n) => n.type.startsWith("video/") ? "video" : n.type.startsWith("image/") ? "image" : "file";
function Vi({
  accept: n,
  allow: l,
  className: i,
  disabled: a = !1,
  labels: t,
  onFiles: s,
  onSend: o,
  placeholder: c
}) {
  const r = { ...xa, ...t }, m = { file: !0, video: !0, voice: !0, ...l }, [h, _] = D(""), [u, p] = D([]), [N, v] = D(!1), [b, y] = D(0), [k] = D(Da), x = L([]), z = L(null), B = L(null), C = L(null), I = L(0), S = L([]), A = L(null), T = O(() => {
    var g;
    (g = C.current) == null || g.stream.getTracks().forEach((E) => E.stop()), C.current = null;
  }, []);
  Z(() => T, [T]), Z(() => {
    if (!N) return;
    const g = window.setInterval(() => y((Date.now() - I.current) / 1e3), 200);
    return () => window.clearInterval(g);
  }, [N]);
  const $ = O(
    (g) => {
      if (!(g != null && g.length)) return;
      const E = Array.from(g);
      x.current = [...x.current, ...E], p((M) => [
        ...M,
        ...E.map((P) => ({
          kind: Ea(P),
          name: P.name,
          size: P.size,
          url: URL.createObjectURL(P)
        }))
      ]);
    },
    []
  ), R = O(async () => {
    try {
      const g = await navigator.mediaDevices.getUserMedia({ audio: !0 }), E = new MediaRecorder(g);
      S.current = [], E.ondataavailable = (M) => {
        M.data.size && S.current.push(M.data);
      }, E.onstop = () => {
        const M = new Blob(S.current, { type: E.mimeType }), P = new File([M], "voice-message", { type: E.mimeType });
        x.current = [...x.current, P], p((U) => [
          ...U,
          {
            duration: (Date.now() - I.current) / 1e3,
            kind: "voice",
            size: M.size,
            url: URL.createObjectURL(M)
          }
        ]), T();
      }, C.current = E, E.start(), I.current = Date.now(), y(0), v(!0);
    } catch {
      v(!1), T();
    }
  }, [T]), W = O(
    (g) => {
      const E = C.current;
      v(!1), E && (g || (E.onstop = T), E.stop());
    },
    [T]
  ), J = (g) => {
    p((E) => (URL.revokeObjectURL(E[g].url), E.filter((M, P) => P !== g))), x.current = x.current.filter((E, M) => M !== g);
  }, H = () => {
    var g;
    !h.trim() && u.length === 0 || (o({ attachments: u, text: h.trim() }), s == null || s(x.current), x.current = [], p([]), _(""), (g = A.current) == null || g.focus());
  }, V = !h.trim() && u.length === 0;
  return /* @__PURE__ */ d("div", { className: f("nim-composer", i), children: [
    u.length ? /* @__PURE__ */ e("ul", { className: "nim-composer__tray", children: u.map((g, E) => /* @__PURE__ */ d("li", { className: "nim-composer__chip", children: [
      /* @__PURE__ */ e(
        w,
        {
          name: g.kind === "voice" ? "mic" : g.kind === "video" ? "video" : g.kind === "image" ? "camera" : "document",
          size: "xs"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-composer__chip-name", children: g.name ?? r.record }),
      /* @__PURE__ */ e(
        F,
        {
          label: r.discard,
          name: "close",
          onClick: () => J(E),
          size: "sm"
        }
      )
    ] }, g.url)) }) : null,
    /* @__PURE__ */ e("div", { className: "nim-composer__row", children: N ? /* @__PURE__ */ d("div", { className: "nim-composer__recording", role: "status", children: [
      /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-composer__pulse" }),
      /* @__PURE__ */ e("span", { className: "nim-composer__recording-label", children: r.recording }),
      /* @__PURE__ */ d("span", { className: "nim-composer__elapsed", children: [
        b.toFixed(1),
        "s"
      ] }),
      /* @__PURE__ */ e(
        F,
        {
          label: r.cancel,
          name: "close",
          onClick: () => W(!1),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e(
        F,
        {
          label: r.stop,
          name: "stop",
          onClick: () => W(!0),
          size: "sm",
          variant: "solid"
        }
      )
    ] }) : /* @__PURE__ */ d(K, { children: [
      m.file ? /* @__PURE__ */ e(
        F,
        {
          disabled: a,
          label: r.attach,
          name: "paperclip",
          onClick: () => {
            var g;
            return (g = z.current) == null ? void 0 : g.click();
          },
          size: "sm"
        }
      ) : null,
      m.video ? /* @__PURE__ */ e(
        F,
        {
          disabled: a,
          label: r.video,
          name: "video",
          onClick: () => {
            var g;
            return (g = B.current) == null ? void 0 : g.click();
          },
          size: "sm"
        }
      ) : null,
      /* @__PURE__ */ e(
        "textarea",
        {
          className: "nim-composer__input",
          disabled: a,
          onChange: (g) => _(g.target.value),
          onKeyDown: (g) => {
            g.key === "Enter" && !g.shiftKey && (g.preventDefault(), H());
          },
          placeholder: c,
          ref: A,
          rows: 1,
          value: h
        }
      ),
      m.voice && k && V ? /* @__PURE__ */ e(
        F,
        {
          disabled: a,
          label: r.record,
          name: "mic",
          onClick: () => void R(),
          size: "sm"
        }
      ) : /* @__PURE__ */ e(
        F,
        {
          disabled: a || V,
          label: r.send,
          name: "send",
          onClick: H,
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
        onChange: (g) => {
          $(g.target.files), g.target.value = "";
        },
        ref: z,
        tabIndex: -1,
        type: "file"
      }
    ),
    /* @__PURE__ */ e(
      "input",
      {
        accept: "video/*",
        className: "nim-visually-hidden",
        onChange: (g) => {
          $(g.target.files), g.target.value = "";
        },
        ref: B,
        tabIndex: -1,
        type: "file"
      }
    )
  ] });
}
function Ma({
  children: n,
  className: l,
  disabled: i = !1,
  icon: a,
  onClick: t,
  onRemove: s,
  removeLabel: o = "Remove",
  selected: c = !1,
  tone: r = "neutral"
}) {
  const m = !!t;
  return /* @__PURE__ */ d(
    "span",
    {
      className: f("nim-chip", m && "nim-chip--interactive", l),
      "data-selected": c || void 0,
      "data-tone": r === "neutral" ? void 0 : r,
      children: [
        m ? /* @__PURE__ */ d(
          "button",
          {
            "aria-pressed": c,
            className: "nim-chip__body",
            disabled: i,
            onClick: t,
            type: "button",
            children: [
              a ? /* @__PURE__ */ e(w, { name: a, size: "xs" }) : null,
              n
            ]
          }
        ) : /* @__PURE__ */ d("span", { className: "nim-chip__body", children: [
          a ? /* @__PURE__ */ e(w, { name: a, size: "xs" }) : null,
          n
        ] }),
        s ? /* @__PURE__ */ e(
          "button",
          {
            "aria-label": o,
            className: "nim-chip__remove",
            disabled: i,
            onClick: s,
            type: "button",
            children: /* @__PURE__ */ e(w, { name: "close", size: "xs" })
          }
        ) : null
      ]
    }
  );
}
function ji({
  className: n,
  disabled: l = !1,
  error: i,
  hint: a,
  label: t,
  onChange: s,
  placeholder: o,
  removeLabel: c = "Remove",
  separators: r = ["Enter", ",", "Tab"],
  validate: m,
  values: h
}) {
  const [_, u] = D(""), p = () => {
    const v = _.trim();
    if (v && !(m && !m(v))) {
      if (h.includes(v)) {
        u("");
        return;
      }
      s([...h, v]), u("");
    }
  }, N = (v) => {
    if (r.includes(v.key)) {
      if (v.key === "Tab" && !_.trim()) return;
      v.preventDefault(), p();
      return;
    }
    v.key === "Backspace" && !_ && h.length > 0 && s(h.slice(0, -1));
  };
  return /* @__PURE__ */ d("div", { className: f("nim-field", i && "nim-field--invalid", n), children: [
    t ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: t }) : null,
    /* @__PURE__ */ d("div", { className: "nim-chip-input", "data-disabled": l || void 0, children: [
      h.map((v) => /* @__PURE__ */ e(
        Ma,
        {
          disabled: l,
          onRemove: () => s(h.filter((b) => b !== v)),
          removeLabel: `${c} ${v}`,
          children: v
        },
        v
      )),
      /* @__PURE__ */ e(
        "input",
        {
          "aria-invalid": i ? !0 : void 0,
          "aria-label": t,
          className: "nim-chip-input__field",
          disabled: l,
          onBlur: p,
          onChange: (v) => u(v.target.value),
          onKeyDown: N,
          placeholder: h.length === 0 ? o : void 0,
          value: _
        }
      )
    ] }),
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", children: a }) : null
  ] });
}
function Ji({ className: n, layout: l = "rows", rows: i }) {
  return /* @__PURE__ */ e("dl", { className: f("nim-data-list", `nim-data-list--${l}`, n), children: i.map((a) => /* @__PURE__ */ d("div", { className: "nim-data-list__row", children: [
    /* @__PURE__ */ e("dt", { className: "nim-data-list__label", children: a.label }),
    /* @__PURE__ */ e("dd", { className: f("nim-data-list__value", a.mono && "nim-data-list__value--mono"), children: a.value ?? /* @__PURE__ */ e("span", { className: "nim-data-list__empty", children: "—" }) })
  ] }, a.id)) });
}
function Q({ children: n, className: l, error: i, hint: a, id: t, label: s, required: o }) {
  const c = q(), r = t ?? `nim-${c}`, m = a ? `${r}-hint` : void 0, h = i ? `${r}-error` : void 0, _ = [h, m].filter(Boolean).join(" ") || void 0;
  return /* @__PURE__ */ d("div", { className: f("nim-field", i && "nim-field--invalid", l), children: [
    s ? /* @__PURE__ */ d("label", { className: "nim-field__label", htmlFor: r, children: [
      s,
      o ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    n({ control: r, describedBy: _ }),
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: h, children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: m, children: a }) : null
  ] });
}
function Qi({ children: n, ...l }) {
  return /* @__PURE__ */ e(Q, { ...l, children: () => n });
}
function La({ className: n, error: l, hint: i, iconEnd: a, iconStart: t, id: s, label: o, required: c, ...r }) {
  return /* @__PURE__ */ e(Q, { error: l, hint: i, id: s, label: o, required: c, children: ({ control: m, describedBy: h }) => /* @__PURE__ */ d(
    "div",
    {
      className: f(
        "nim-input-shell",
        t && "nim-input-shell--has-start",
        a && "nim-input-shell--has-end"
      ),
      children: [
        t ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--start", children: /* @__PURE__ */ e(w, { name: t, size: "sm" }) }) : null,
        /* @__PURE__ */ e(
          "input",
          {
            "aria-describedby": h,
            "aria-invalid": l ? !0 : void 0,
            className: f("nim-input", n),
            id: m,
            required: c,
            ...r
          }
        ),
        a ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(w, { name: a, size: "sm" }) }) : null
      ]
    }
  ) });
}
function Xi({ className: n, error: l, hint: i, id: a, label: t, required: s, rows: o = 4, ...c }) {
  return /* @__PURE__ */ e(Q, { error: l, hint: i, id: a, label: t, required: s, children: ({ control: r, describedBy: m }) => /* @__PURE__ */ e(
    "textarea",
    {
      "aria-describedby": m,
      "aria-invalid": l ? !0 : void 0,
      className: f("nim-textarea", n),
      id: r,
      required: s,
      rows: o,
      ...c
    }
  ) });
}
function qi({
  className: n,
  error: l,
  hint: i,
  id: a,
  label: t,
  options: s,
  placeholder: o,
  required: c,
  ...r
}) {
  return /* @__PURE__ */ e(Q, { error: l, hint: i, id: a, label: t, required: c, children: ({ control: m, describedBy: h }) => /* @__PURE__ */ d("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
    /* @__PURE__ */ d(
      "select",
      {
        "aria-describedby": h,
        "aria-invalid": l ? !0 : void 0,
        className: f("nim-select", n),
        id: m,
        required: c,
        ...r,
        children: [
          o ? /* @__PURE__ */ e("option", { value: "", disabled: !0, children: o }) : null,
          s.map((_) => /* @__PURE__ */ e("option", { disabled: _.disabled, value: _.value, children: _.label }, _.value))
        ]
      }
    ),
    /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(w, { name: "chevron-down", size: "sm" }) })
  ] }) });
}
function el({
  className: n,
  emptyState: l,
  error: i,
  hint: a,
  id: t,
  label: s,
  onChange: o,
  options: c,
  placeholder: r,
  required: m,
  value: h
}) {
  const _ = q(), u = c.find((S) => S.value === h) ?? null, [p, N] = D(""), [v, b] = D(!1), [y, k] = D(0), x = L(null), z = Y(() => {
    const S = p.trim().toLowerCase();
    return S ? c.filter((A) => A.label.toLowerCase().includes(S)) : c;
  }, [c, p]), B = (S) => {
    o(S.value), N(""), b(!1);
  }, C = (S) => {
    if (S.key === "Escape") {
      N(""), b(!1);
      return;
    }
    if (!v && (S.key === "ArrowDown" || S.key === "ArrowUp")) {
      b(!0);
      return;
    }
    if (S.key === "ArrowDown" || S.key === "ArrowUp") {
      S.preventDefault();
      const A = S.key === "ArrowDown" ? 1 : -1, T = z.filter(($) => !$.disabled);
      if (T.length === 0) return;
      k(($) => ($ + A + T.length) % T.length);
    }
    if (S.key === "Enter") {
      const T = z.filter(($) => !$.disabled)[y];
      T && (S.preventDefault(), B(T));
    }
  }, I = z.filter((S) => !S.disabled);
  return /* @__PURE__ */ e(Q, { className: n, error: i, hint: a, id: t, label: s, required: m, children: ({ control: S, describedBy: A }) => /* @__PURE__ */ d("div", { className: "nim-combobox", children: [
    /* @__PURE__ */ d("div", { className: f("nim-input-shell", "nim-input-shell--has-end"), children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-autocomplete": "list",
          "aria-controls": v ? _ : void 0,
          "aria-describedby": A,
          "aria-expanded": v,
          className: "nim-input",
          id: S,
          onBlur: () => window.setTimeout(() => b(!1), 120),
          onChange: (T) => {
            N(T.target.value), k(0), b(!0);
          },
          onFocus: () => b(!0),
          onKeyDown: C,
          placeholder: r,
          ref: x,
          role: "combobox",
          value: v ? p : (u == null ? void 0 : u.label) ?? ""
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(w, { name: "chevron-down", size: "sm" }) })
    ] }),
    v ? /* @__PURE__ */ e("div", { className: "nim-combobox__list", id: _, role: "listbox", children: I.length === 0 ? /* @__PURE__ */ e("div", { className: "nim-combobox__empty", children: l ? l(p) : `Nothing matches “${p}”.` }) : z.map((T) => /* @__PURE__ */ d(
      "button",
      {
        "aria-selected": I.indexOf(T) === y,
        className: "nim-combobox__option",
        disabled: T.disabled,
        onClick: () => B(T),
        onPointerEnter: () => k(I.indexOf(T)),
        role: "option",
        type: "button",
        children: [
          /* @__PURE__ */ e("span", { children: T.label }),
          T.meta ? /* @__PURE__ */ e("span", { className: "nim-combobox__meta", children: T.meta }) : null
        ]
      },
      T.value
    )) }) : null
  ] }) });
}
function Be(n, l, { onDismiss: i, open: a }) {
  const [t, s] = D({ left: 0, top: 0 }), o = L(null), c = O(() => {
    const r = n.current, m = l.current;
    if (!r || !m) return;
    const h = r.getBoundingClientRect(), { height: _, width: u } = m.getBoundingClientRect(), p = 4, N = 8, v = getComputedStyle(r).direction === "rtl", b = h.bottom + p, k = b + _ > window.innerHeight && h.top - p - _ > 0 ? h.top - p - _ : b, x = v ? h.right - u : h.left, z = Math.min(Math.max(x, N), window.innerWidth - u - N);
    s({ left: z, top: k });
  }, [l, n]);
  return He(() => {
    a && c();
  }, [a, c]), Z(() => {
    if (!a) return;
    o.current = document.activeElement;
    const r = (h) => {
      h.key === "Escape" && (h.stopPropagation(), i());
    }, m = (h) => {
      var u, p;
      const _ = h.target;
      (u = l.current) != null && u.contains(_) || (p = n.current) != null && p.contains(_) || i();
    };
    return window.addEventListener("keydown", r), window.addEventListener("pointerdown", m), window.addEventListener("resize", c), window.addEventListener("scroll", c, !0), () => {
      var h, _;
      window.removeEventListener("keydown", r), window.removeEventListener("pointerdown", m), window.removeEventListener("resize", c), window.removeEventListener("scroll", c, !0), (_ = (h = o.current) == null ? void 0 : h.focus) == null || _.call(h);
    };
  }, [i, a, l, c, n]), t;
}
const za = (n) => n.kind === void 0 || n.kind === "action";
function nl({ children: n, className: l, items: i, label: a }) {
  const [t, s] = D(!1), [o, c] = D(0), r = L(null), m = L(null), h = Be(r, m, { onDismiss: () => s(!1), open: t }), u = i.filter(za).filter((b) => !b.disabled), p = () => {
    c(0), s((b) => !b);
  }, N = (b) => {
    s(!1), b.onSelect();
  }, v = (b) => {
    if (u.length !== 0) {
      if (b.key === "ArrowDown" || b.key === "ArrowUp") {
        b.preventDefault();
        const y = b.key === "ArrowDown" ? 1 : -1;
        c((k) => (k + y + u.length) % u.length);
      }
      if (b.key === "Home" && (b.preventDefault(), c(0)), b.key === "End" && (b.preventDefault(), c(u.length - 1)), b.key === "Enter" || b.key === " ") {
        b.preventDefault();
        const y = u[o];
        y && N(y);
      }
    }
  };
  return /* @__PURE__ */ d(K, { children: [
    n({ open: t, ref: r, toggle: p }),
    t && typeof document < "u" ? re(
      /* @__PURE__ */ e(
        "div",
        {
          "aria-label": a,
          className: f("nim-menu", l),
          onKeyDown: v,
          ref: m,
          role: "menu",
          style: { insetBlockStart: h.top, insetInlineStart: h.left },
          tabIndex: -1,
          children: i.map((b, y) => b.kind === "separator" ? /* @__PURE__ */ e("hr", { className: "nim-menu__separator" }, `sep-${y}`) : b.kind === "heading" ? /* @__PURE__ */ e("p", { className: "nim-menu__label", children: b.label }, `head-${y}`) : /* @__PURE__ */ d(
            "button",
            {
              className: f("nim-menu__item", b.danger && "nim-menu__item--danger"),
              "data-active": u.indexOf(b) === o ? "true" : void 0,
              disabled: b.disabled,
              onClick: () => N(b),
              onPointerEnter: () => c(u.indexOf(b)),
              role: "menuitem",
              type: "button",
              children: [
                b.icon ? /* @__PURE__ */ e(w, { className: "nim-menu__icon", name: b.icon, size: "sm" }) : null,
                /* @__PURE__ */ e("span", { children: b.label }),
                b.shortcut ? /* @__PURE__ */ e("span", { className: "nim-menu__shortcut", children: b.shortcut }) : null
              ]
            },
            b.label
          ))
        }
      ),
      document.body
    ) : null
  ] });
}
function $a({ children: n, className: l, label: i, onClose: a, open: t, triggerRef: s }) {
  const o = L(null), c = Be(s, o, { onDismiss: a, open: t });
  return !t || typeof document > "u" ? null : re(
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": i,
        className: f("nim-popover", l),
        ref: o,
        role: "dialog",
        style: { insetBlockStart: c.top, insetInlineStart: c.left },
        children: n
      }
    ),
    document.body
  );
}
const Re = pe(null);
function al({
  children: n,
  className: l,
  defaultColorway: i = "vermilion",
  defaultScheme: a = "light",
  defaultStyle: t = "ledger",
  direction: s = "ltr",
  locale: o,
  syncDocument: c = !0
}) {
  const [r, m] = D(t), [h, _] = D(i), [u, p] = D(a);
  Z(() => {
    if (!c || typeof document > "u") return;
    const v = document.documentElement;
    v.dataset.nimStyle = r, v.dataset.nimColorway = h, u === "system" ? delete v.dataset.nimScheme : v.dataset.nimScheme = u, v.dir = s, o && (v.lang = o);
  }, [h, s, o, u, r, c]);
  const N = Y(
    () => ({ colorway: h, direction: s, locale: o, scheme: u, setColorway: _, setScheme: p, setStyle: m, style: r }),
    [h, s, o, u, r]
  );
  return /* @__PURE__ */ e(Re.Provider, { value: N, children: /* @__PURE__ */ e(
    "div",
    {
      className: f("nim-root", l),
      "data-nim-colorway": h,
      "data-nim-scheme": u === "system" ? void 0 : u,
      "data-nim-style": r,
      dir: s,
      lang: o,
      children: n
    }
  ) });
}
function ce() {
  const n = fe(Re);
  if (!n) throw new Error("useNim must be used inside <NimProvider>");
  return n;
}
function il() {
  const { scheme: n, setScheme: l } = ce();
  return O(() => l(n === "dark" ? "light" : "dark"), [n, l]);
}
const te = 864e5, Ia = Date.UTC(622, 2, 22), Pa = 365.2422, ne = (n) => n.toISOString().slice(0, 10), ae = (n) => /* @__PURE__ */ new Date(`${n}T00:00:00Z`), oe = () => ne(/* @__PURE__ */ new Date()), Ba = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
  year: "numeric"
});
function X(n, l) {
  const i = ae(n);
  if (l === "gregory")
    return { day: i.getUTCDate(), month: i.getUTCMonth() + 1, year: i.getUTCFullYear() };
  const a = Ba.formatToParts(i), t = (s) => {
    var o;
    return Number(((o = a.find((c) => c.type === s)) == null ? void 0 : o.value) ?? "0");
  };
  return { day: t("day"), month: t("month"), year: t("year") };
}
const Se = (n) => n.year * 1e4 + n.month * 100 + n.day;
function ie(n, l) {
  if (l === "gregory")
    return ne(new Date(Date.UTC(n.year, n.month - 1, n.day)));
  const i = Math.floor((n.year - 1) * Pa) + (n.month <= 7 ? (n.month - 1) * 31 : 186 + (n.month - 7) * 30) + n.day - 1;
  let a = new Date(Ia + i * te);
  const t = Se(n);
  for (let s = 0; s < 40; s += 1) {
    const o = X(ne(a), "persian"), c = Se(o);
    if (c === t) break;
    const r = (n.year - o.year) * 365 + (n.month - o.month) * 30 + (n.day - o.day);
    a = new Date(a.getTime() + (r === 0 ? c < t ? 1 : -1 : r) * te);
  }
  return ne(a);
}
function Ra(n, l) {
  const i = X(n, l);
  return ie({ ...i, day: 1 }, l);
}
function Te(n, l, i) {
  const a = X(n, i), t = a.year * 12 + (a.month - 1) + l, s = Math.floor(t / 12), o = t % 12 + 1, c = Fe(s, o, i);
  return ie({ day: Math.min(a.day, c), month: o, year: s }, i);
}
function Fe(n, l, i) {
  const a = ae(ie({ day: 1, month: l, year: n }, i)).getTime(), t = l === 12 ? 1 : l + 1, s = l === 12 ? n + 1 : n, o = ae(ie({ day: 1, month: t, year: s }, i)).getTime();
  return Math.round((o - a) / te);
}
const ue = (n, l) => ne(new Date(ae(n).getTime() + l * te)), Fa = (n) => ae(n).getUTCDay();
function Oa(n, l) {
  const i = n ?? "en";
  return i.includes("-u-ca-") || i.includes("-u-") ? i : `${i}-u-ca-${l}`;
}
const Ne = (n) => n != null && n.startsWith("fa") ? "persian" : "gregory", Ua = (n) => n === "persian" ? 6 : 1, Ae = /* @__PURE__ */ new Map();
function Ga(n) {
  const l = n ?? "en", i = Ae.get(l);
  if (i) return i;
  const a = new Intl.NumberFormat(l, { useGrouping: !1 }), t = Array.from({ length: 10 }, (s, o) => a.format(o));
  return Ae.set(l, t), t;
}
function _e(n, l, i) {
  const a = X(n, i), t = Ga(l), s = (o, c = 1) => String(o).padStart(c, "0").replace(/\d/g, (r) => t[Number(r)]);
  return `${s(a.year)}/${s(a.month, 2)}/${s(a.day, 2)}`;
}
function Ka(n, l) {
  const a = Wa(n).match(/\d+/g);
  if (!a || a.length < 3) return null;
  const [t, s, o] = a.map(Number);
  if (s < 1 || s > 12 || o < 1 || o > Fe(t, s, l)) return null;
  const c = ie({ day: o, month: s, year: t }, l), r = X(c, l);
  return r.year === t && r.month === s && r.day === o ? c : null;
}
function Wa(n) {
  let l = "";
  for (const i of n) {
    const a = i.codePointAt(0) ?? 0;
    a >= 1776 && a <= 1785 ? l += String.fromCodePoint(a - 1776 + 48) : a >= 1632 && a <= 1641 ? l += String.fromCodePoint(a - 1632 + 48) : l += i;
  }
  return l;
}
const xe = {
  next: "Next month",
  previous: "Previous month"
};
function Oe({
  className: n,
  marked: l = [],
  max: i,
  min: a,
  month: t,
  onMonthChange: s,
  onSelect: o,
  system: c,
  value: r,
  weekStart: m
}) {
  const { locale: h } = ce(), _ = c ?? Ne(h), u = m ?? Ua(_), p = oe(), N = Oa(h, _), v = Y(
    () => new Intl.DateTimeFormat(N, { month: "long", timeZone: "UTC", year: "numeric" }),
    [N]
  ), b = Y(() => new Intl.NumberFormat(h), [h]), y = Y(
    () => new Intl.DateTimeFormat(N, { timeZone: "UTC", weekday: "short" }),
    [N]
  ), k = Ra(t, _), x = X(k, _).month, z = Y(() => {
    const C = (Fa(k) - u + 7) % 7, I = ue(k, -C);
    return Array.from({ length: 42 }, (S, A) => {
      const T = ue(I, A), $ = X(T, _);
      return { date: T, day: $.day, outside: $.month !== x };
    });
  }, [k, x, _, u]), B = Y(() => {
    const C = "2024-01-07";
    return Array.from({ length: 7 }, (I, S) => ({
      key: `${u}-${S}`,
      label: y.format(/* @__PURE__ */ new Date(`${ue(C, (u + S) % 7)}T00:00:00Z`))
    }));
  }, [u, y]);
  return /* @__PURE__ */ d("div", { className: f("nim-calendar", n), children: [
    /* @__PURE__ */ d("div", { className: "nim-calendar__header", children: [
      /* @__PURE__ */ e(
        F,
        {
          label: xe.previous,
          name: "chevron-back",
          onClick: () => s(Te(k, -1, _)),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-calendar__month", children: v.format(/* @__PURE__ */ new Date(`${k}T00:00:00Z`)) }),
      /* @__PURE__ */ e(
        F,
        {
          label: xe.next,
          name: "chevron-forward",
          onClick: () => s(Te(k, 1, _)),
          size: "sm"
        }
      )
    ] }),
    /* @__PURE__ */ d("div", { className: "nim-calendar__grid", role: "grid", children: [
      B.map((C) => /* @__PURE__ */ e("span", { className: "nim-calendar__weekday", children: C.label }, C.key)),
      z.map((C) => /* @__PURE__ */ e(
        "button",
        {
          "aria-selected": C.date === r,
          className: f(
            "nim-calendar__day",
            C.outside && "nim-calendar__day--outside",
            C.date === p && "nim-calendar__day--today",
            l.includes(C.date) && "nim-calendar__day--marked"
          ),
          disabled: a !== void 0 && C.date < a || i !== void 0 && C.date > i,
          onClick: () => o(C.date),
          role: "gridcell",
          type: "button",
          children: b.format(C.day)
        },
        C.date
      ))
    ] })
  ] });
}
function Ue({
  calendar: n,
  describedBy: l,
  id: i,
  invalid: a,
  locale: t,
  onChange: s,
  value: o
}) {
  const [c, r] = D(null);
  if (n === "gregory")
    return /* @__PURE__ */ e(
      "input",
      {
        "aria-describedby": l,
        "aria-invalid": a ? !0 : void 0,
        className: "nim-input",
        id: i,
        onChange: (h) => s(h.target.value),
        type: "date",
        value: o
      }
    );
  const m = c ?? (o ? _e(o, t, n) : "");
  return /* @__PURE__ */ e(
    "input",
    {
      "aria-describedby": l,
      "aria-invalid": a ? !0 : void 0,
      className: "nim-input",
      dir: "ltr",
      id: i,
      inputMode: "numeric",
      onBlur: () => r(null),
      onChange: (h) => {
        r(h.target.value);
        const _ = Ka(h.target.value, n);
        _ ? s(_) : h.target.value.trim() === "" && s("");
      },
      placeholder: _e(oe(), t, n),
      type: "text",
      value: m
    }
  );
}
function ll({
  error: n,
  hint: l,
  id: i,
  label: a,
  onChange: t,
  required: s,
  value: o,
  ...c
}) {
  const { locale: r } = ce(), m = c.system ?? Ne(r), [h, _] = D(o || oe());
  return /* @__PURE__ */ e(Q, { error: n, hint: l, id: i, label: a, required: s, children: ({ control: u, describedBy: p }) => /* @__PURE__ */ d("div", { className: "nim-stack nim-stack--tight", children: [
    /* @__PURE__ */ e(
      Ue,
      {
        calendar: m,
        describedBy: p,
        id: u,
        invalid: !!n,
        locale: r,
        onChange: (N) => {
          t(N), N && _(N);
        },
        value: o
      }
    ),
    /* @__PURE__ */ e(
      Oe,
      {
        ...c,
        month: h,
        onMonthChange: _,
        onSelect: (N) => {
          t(N), _(N);
        },
        system: m,
        value: o
      }
    )
  ] }) });
}
function tl({
  error: n,
  hint: l,
  id: i,
  label: a,
  labels: t,
  onChange: s,
  required: o,
  showEquivalent: c,
  value: r,
  ...m
}) {
  const { locale: h } = ce(), _ = m.system ?? Ne(h), [u, p] = D(!1), [N, v] = D(r || oe()), b = L(null), y = { clear: "Clear date", open: "Open calendar", ...t }, k = c ?? _ === "persian", x = _ === "persian" ? "gregory" : "persian";
  return /* @__PURE__ */ e(Q, { error: n, hint: l, id: i, label: a, required: o, children: ({ control: z, describedBy: B }) => /* @__PURE__ */ d("div", { className: "nim-date-picker", children: [
    /* @__PURE__ */ d("div", { className: "nim-date-picker__group", children: [
      /* @__PURE__ */ e(
        Ue,
        {
          calendar: _,
          describedBy: B,
          id: z,
          invalid: !!n,
          locale: h,
          onChange: (C) => {
            s(C), C && v(C);
          },
          value: r
        }
      ),
      r ? /* @__PURE__ */ e(
        F,
        {
          label: y.clear,
          name: "close",
          onClick: () => s(""),
          size: "sm"
        }
      ) : null,
      /* @__PURE__ */ e(
        F,
        {
          "aria-expanded": u,
          label: y.open,
          name: "calendar",
          onClick: () => p((C) => !C),
          ref: b,
          size: "sm"
        }
      )
    ] }),
    k && r ? /* @__PURE__ */ d("p", { className: "nim-date-picker__equivalent", children: [
      /* @__PURE__ */ e(w, { name: "calendar", size: "xs" }),
      /* @__PURE__ */ e("span", { dir: x === "gregory" ? "ltr" : void 0, children: _e(r, h, x) })
    ] }) : null,
    /* @__PURE__ */ e(
      $a,
      {
        label: a ?? y.open,
        onClose: () => p(!1),
        open: u,
        triggerRef: b,
        children: /* @__PURE__ */ e(
          Oe,
          {
            ...m,
            month: N,
            onMonthChange: v,
            onSelect: (C) => {
              s(C), v(C), p(!1);
            },
            system: _,
            value: r
          }
        )
      }
    )
  ] }) });
}
function sl({
  children: n,
  className: l,
  closeLabel: i = "Close",
  description: a,
  footer: t,
  onClose: s,
  open: o,
  title: c
}) {
  const r = L(null);
  return Z(() => {
    const m = r.current;
    m && (o && !m.open && m.showModal(), !o && m.open && m.close());
  }, [o]), Z(() => {
    const m = r.current;
    if (!m) return;
    const h = () => s();
    return m.addEventListener("close", h), () => m.removeEventListener("close", h);
  }, [s]), /* @__PURE__ */ d(
    "dialog",
    {
      className: f("nim-dialog", l),
      onClick: (m) => {
        m.target === r.current && s();
      },
      ref: r,
      children: [
        /* @__PURE__ */ d("div", { className: "nim-dialog__header", children: [
          /* @__PURE__ */ d("div", { children: [
            /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: c }),
            a ? /* @__PURE__ */ e("p", { className: "nim-caption", children: a }) : null
          ] }),
          /* @__PURE__ */ e(F, { label: i, name: "close", onClick: s, size: "sm" })
        ] }),
        /* @__PURE__ */ e("div", { className: "nim-dialog__body", children: n }),
        t ? /* @__PURE__ */ e("div", { className: "nim-dialog__footer", children: t }) : null
      ]
    }
  );
}
function rl({
  className: n,
  detail: l,
  label: i,
  percent: a,
  tone: t = "accent",
  value: s,
  ...o
}) {
  const c = typeof a == "number", r = Math.min(100, Math.max(0, a ?? 0)), m = typeof i == "string" ? i : void 0;
  return /* @__PURE__ */ d("div", { className: f("nim-resource-meter", n), "data-tone": t, ...o, children: [
    /* @__PURE__ */ d("div", { className: "nim-resource-meter__head", children: [
      /* @__PURE__ */ e("span", { className: "nim-resource-meter__label", children: i }),
      /* @__PURE__ */ e("span", { className: "nim-resource-meter__value", children: s })
    ] }),
    c ? /* @__PURE__ */ e(
      "div",
      {
        "aria-label": m,
        "aria-valuemax": 100,
        "aria-valuemin": 0,
        "aria-valuenow": r,
        className: "nim-resource-meter__track",
        role: "meter",
        children: /* @__PURE__ */ e("span", { className: "nim-resource-meter__fill", style: { inlineSize: `${r}%` } })
      }
    ) : null,
    l ? /* @__PURE__ */ e("span", { className: "nim-resource-meter__detail", children: l }) : null
  ] });
}
function cl({
  accept: n,
  caption: l,
  className: i,
  disabled: a = !1,
  error: t,
  label: s,
  multiple: o = !1,
  onFiles: c,
  prompt: r
}) {
  const m = L(0), [h, _] = D(!1), u = (p) => {
    p.preventDefault(), p.stopPropagation();
  };
  return /* @__PURE__ */ d("div", { className: f("nim-field", t && "nim-field--invalid", i), children: [
    /* @__PURE__ */ d(
      "label",
      {
        className: "nim-file-drop",
        "data-over": h || void 0,
        "data-disabled": a || void 0,
        onDragEnter: (p) => {
          u(p), m.current += 1, a || _(!0);
        },
        onDragLeave: (p) => {
          u(p), m.current -= 1, m.current <= 0 && _(!1);
        },
        onDragOver: u,
        onDrop: (p) => {
          if (u(p), m.current = 0, _(!1), a) return;
          const N = Array.from(p.dataTransfer.files);
          N.length > 0 && c(o ? N : N.slice(0, 1));
        },
        children: [
          /* @__PURE__ */ e(
            "input",
            {
              accept: n,
              className: "nim-choice__input",
              disabled: a,
              multiple: o,
              onChange: (p) => {
                const N = Array.from(p.target.files ?? []);
                N.length > 0 && c(N), p.target.value = "";
              },
              type: "file"
            }
          ),
          /* @__PURE__ */ e(w, { className: "nim-file-drop__icon", name: "upload", size: "lg" }),
          /* @__PURE__ */ e("span", { className: "nim-file-drop__label", children: s }),
          r ? /* @__PURE__ */ e("span", { className: "nim-file-drop__prompt", children: r }) : null,
          l ? /* @__PURE__ */ e("span", { className: "nim-file-drop__caption", children: l }) : null
        ]
      }
    ),
    t ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: t }) : null
  ] });
}
function ol({ children: n, className: l, ...i }) {
  return /* @__PURE__ */ e("div", { className: f("nim-app-frame", l), ...i, children: n });
}
function dl({
  as: n = "div",
  children: l,
  className: i,
  gap: a = "md",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: f("nim-stack", a !== "md" && `nim-stack--${a}`, i), ...t, children: l });
}
function ml({
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
      className: f("nim-inline", a !== "md" && `nim-inline--${a}`, !t && "nim-inline--nowrap", i),
      ...s,
      children: l
    }
  );
}
function Ha({ children: n, className: l, plain: i = !1, ...a }) {
  return /* @__PURE__ */ e("div", { className: f("nim-list", i && "nim-list--plain", l), ...a, children: n });
}
function Ya({
  className: n,
  href: l,
  leading: i,
  onClick: a,
  rel: t,
  subtitle: s,
  target: o,
  title: c,
  trailing: r,
  ...m
}) {
  const h = !!(l || a), _ = /* @__PURE__ */ d(K, { children: [
    i ? /* @__PURE__ */ e("span", { className: "nim-list-row__leading", children: i }) : null,
    /* @__PURE__ */ d("span", { className: "nim-list-row__content", children: [
      /* @__PURE__ */ e("span", { className: "nim-list-row__title", children: c }),
      s ? /* @__PURE__ */ e("span", { className: "nim-list-row__subtitle", children: s }) : null
    ] }),
    r ? /* @__PURE__ */ e("span", { className: "nim-list-row__trailing", children: r }) : null,
    h && !r ? /* @__PURE__ */ e(w, { className: "nim-list-row__chevron", name: "chevron-forward", size: "sm" }) : null
  ] }), u = f("nim-list-row", h && "nim-list-row--interactive", n);
  return l ? /* @__PURE__ */ e(
    "a",
    {
      className: u,
      href: l,
      rel: o === "_blank" ? t ?? "noreferrer" : t,
      target: o,
      ...m,
      children: _
    }
  ) : a ? /* @__PURE__ */ e("button", { className: u, onClick: a, type: "button", ...m, children: _ }) : /* @__PURE__ */ e("div", { className: u, ...m, children: _ });
}
const Za = {
  back: "Back",
  dot: (n) => `Slide ${n + 1}`
};
function ul({
  brand: n,
  className: l,
  finishLabel: i,
  footnote: a,
  labels: t,
  nextLabel: s,
  onDone: o,
  onSkip: c,
  onStep: r,
  skipLabel: m,
  slides: h
}) {
  var y;
  const [_, u] = D(0), p = { ...Za, ...t }, N = h[Math.min(_, h.length - 1)], v = _ === h.length - 1, b = O(
    (k) => {
      u(k), r == null || r(k);
    },
    [r]
  );
  return /* @__PURE__ */ d("section", { className: f("nim-onboarding", l), children: [
    /* @__PURE__ */ d("header", { className: "nim-onboarding__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-onboarding__brand", children: n }),
      m ? /* @__PURE__ */ e(
        j,
        {
          iconEnd: "chevron-forward",
          onClick: c ?? o,
          size: "sm",
          variant: "ghost",
          children: m
        }
      ) : null
    ] }),
    /* @__PURE__ */ d("div", { "aria-live": "polite", className: "nim-onboarding__stage", children: [
      N.art ? /* @__PURE__ */ e("div", { className: "nim-onboarding__art", children: N.art }) : null,
      N.proof ? /* @__PURE__ */ d("div", { className: "nim-onboarding__proof", children: [
        N.proof.icon ? /* @__PURE__ */ e("span", { className: "nim-onboarding__proof-icon", children: N.proof.icon }) : null,
        /* @__PURE__ */ d("span", { className: "nim-onboarding__proof-text", children: [
          /* @__PURE__ */ e("span", { className: "nim-onboarding__proof-title", children: N.proof.title }),
          (y = N.proof.points) != null && y.length ? /* @__PURE__ */ e("span", { className: "nim-onboarding__proof-points", children: N.proof.points.join(" · ") }) : null
        ] })
      ] }) : null
    ] }),
    /* @__PURE__ */ d("div", { className: "nim-onboarding__copy", children: [
      N.label ? /* @__PURE__ */ e("span", { className: "nim-onboarding__chip", children: N.label }) : null,
      /* @__PURE__ */ e("h1", { className: "nim-onboarding__title", children: N.title }),
      N.body ? /* @__PURE__ */ e("p", { className: "nim-onboarding__body", children: N.body }) : null
    ] }),
    /* @__PURE__ */ d("footer", { className: "nim-onboarding__controls", children: [
      /* @__PURE__ */ e("div", { className: "nim-onboarding__dots", children: h.map((k, x) => /* @__PURE__ */ e(
        "button",
        {
          "aria-current": x === _ ? "step" : void 0,
          "aria-label": p.dot(x),
          className: "nim-onboarding__dot",
          onClick: () => b(x),
          type: "button"
        },
        k.id
      )) }),
      /* @__PURE__ */ d("div", { className: "nim-onboarding__cta", children: [
        _ > 0 ? /* @__PURE__ */ e(
          F,
          {
            label: p.back,
            name: "chevron-back",
            onClick: () => b(_ - 1),
            size: "lg",
            variant: "outline"
          }
        ) : null,
        /* @__PURE__ */ e(
          j,
          {
            fullWidth: !0,
            iconEnd: v ? "arrow-forward" : void 0,
            onClick: () => v ? o() : b(_ + 1),
            size: "lg",
            variant: "accent",
            children: v ? i : s
          }
        )
      ] }),
      a ? /* @__PURE__ */ e("p", { className: "nim-onboarding__footnote", children: a }) : null
    ] })
  ] });
}
const Va = "AD:376 AE:971 AF:93 AG:1268 AI:1264 AL:355 AM:374 AO:244 AQ:672 AR:54 AS:1684 AT:43 AU:61 AW:297 AX:358 AZ:994 BA:387 BB:1246 BD:880 BE:32 BF:226 BG:359 BH:973 BI:257 BJ:229 BL:590 BM:1441 BN:673 BO:591 BQ:599 BR:55 BS:1242 BT:975 BW:267 BY:375 BZ:501 CA:1 CC:61 CD:243 CF:236 CG:242 CH:41 CI:225 CK:682 CL:56 CM:237 CN:86 CO:57 CR:506 CU:53 CV:238 CW:599 CX:61 CY:357 CZ:420 DE:49 DJ:253 DK:45 DM:1767 DO:1809 DZ:213 EC:593 EE:372 EG:20 EH:212 ER:291 ES:34 ET:251 FI:358 FJ:679 FK:500 FM:691 FO:298 FR:33 GA:241 GB:44 GD:1473 GE:995 GF:594 GG:44 GH:233 GI:350 GL:299 GM:220 GN:224 GP:590 GQ:240 GR:30 GT:502 GU:1671 GW:245 GY:592 HK:852 HN:504 HR:385 HT:509 HU:36 ID:62 IE:353 IL:972 IM:44 IN:91 IO:246 IQ:964 IR:98 IS:354 IT:39 JE:44 JM:1876 JO:962 JP:81 KE:254 KG:996 KH:855 KI:686 KM:269 KN:1869 KP:850 KR:82 KW:965 KY:1345 KZ:7 LA:856 LB:961 LC:1758 LI:423 LK:94 LR:231 LS:266 LT:370 LU:352 LV:371 LY:218 MA:212 MC:377 MD:373 ME:382 MF:590 MG:261 MH:692 MK:389 ML:223 MM:95 MN:976 MO:853 MP:1670 MQ:596 MR:222 MS:1664 MT:356 MU:230 MV:960 MW:265 MX:52 MY:60 MZ:258 NA:264 NC:687 NE:227 NF:672 NG:234 NI:505 NL:31 NO:47 NP:977 NR:674 NU:683 NZ:64 OM:968 PA:507 PE:51 PF:689 PG:675 PH:63 PK:92 PL:48 PM:508 PR:1787 PS:970 PT:351 PW:680 PY:595 QA:974 RE:262 RO:40 RS:381 RU:7 RW:250 SA:966 SB:677 SC:248 SD:249 SE:46 SG:65 SH:290 SI:386 SJ:47 SK:421 SL:232 SM:378 SN:221 SO:252 SR:597 SS:211 ST:239 SV:503 SX:1721 SY:963 SZ:268 TC:1649 TD:235 TG:228 TH:66 TJ:992 TK:690 TL:670 TM:993 TN:216 TO:676 TR:90 TT:1868 TV:688 TW:886 TZ:255 UA:380 UG:256 US:1 UY:598 UZ:998 VA:39 VC:1784 VE:58 VG:1284 VI:1340 VN:84 VU:678 WF:681 WS:685 YE:967 YT:262 ZA:27 ZM:260 ZW:263";
function ja(n) {
  return String.fromCodePoint(...[...n].map((l) => 127462 + l.charCodeAt(0) - 65));
}
const se = Va.split(" ").map((n) => {
  const [l, i] = n.split(":");
  return { dial: i, flag: ja(l), iso2: l };
}), Ja = new Map(se.map((n) => [n.iso2, n]));
function Ge(n) {
  return Ja.get(n.toUpperCase());
}
function hl(n) {
  const l = n.replace(/\D/g, "");
  let i;
  for (const a of se)
    l.startsWith(a.dial) && (!i || a.dial.length > i.dial.length) && (i = a);
  return i;
}
const De = /* @__PURE__ */ new Map();
function Qa(n) {
  const l = De.get(n);
  if (l) return l;
  let i;
  try {
    const a = new Intl.DisplayNames([n], { type: "region" });
    i = (t) => a.of(t) ?? t;
  } catch {
    i = (a) => a;
  }
  return De.set(n, i), i;
}
function le(n) {
  let l = "";
  for (const i of n) {
    const a = i.codePointAt(0) ?? 0;
    a >= 1776 && a <= 1785 ? l += String.fromCodePoint(a - 1776 + 48) : a >= 1632 && a <= 1641 ? l += String.fromCodePoint(a - 1632 + 48) : i >= "0" && i <= "9" && (l += i);
  }
  return l;
}
function Xa({
  autoFocus: n = !1,
  className: l,
  digitLabel: i,
  error: a,
  label: t,
  length: s = 5,
  onChange: o,
  onComplete: c,
  value: r
}) {
  const m = L(null), h = r.slice(0, s).split(""), _ = O((b) => {
    var k, x;
    const y = (k = m.current) == null ? void 0 : k.querySelectorAll("input");
    (x = y == null ? void 0 : y[Math.max(0, Math.min(b, y.length - 1))]) == null || x.focus();
  }, []);
  Z(() => {
    n && _(0);
  }, [n, _]);
  const u = O(
    (b, y) => {
      const k = b.slice(0, s);
      o(k), k.length === s ? c == null || c(k) : _(y);
    },
    [_, s, o, c]
  ), p = O(
    (b, y) => {
      const k = le(y);
      if (!k) return;
      const x = (r.slice(0, b) + k).slice(0, s);
      u(x, x.length);
    },
    [u, s, r]
  ), N = O(
    (b, y) => {
      if (y.key === "Backspace") {
        y.preventDefault();
        const k = r[b] ? b : b - 1;
        if (k < 0) return;
        o(r.slice(0, k) + r.slice(k + 1)), _(k);
      } else y.key === "ArrowLeft" ? _(b - 1) : y.key === "ArrowRight" && _(b + 1);
    },
    [_, o, r]
  ), v = O(
    (b) => {
      const y = le(b.clipboardData.getData("text"));
      y && (b.preventDefault(), u(y.slice(0, s), y.length));
    },
    [u, s]
  );
  return /* @__PURE__ */ d("div", { className: f("nim-otp", a && "nim-otp--invalid", l), children: [
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": t,
        className: "nim-otp__boxes",
        dir: "ltr",
        onPaste: v,
        ref: m,
        role: "group",
        children: Array.from({ length: s }, (b, y) => /* @__PURE__ */ e(
          "input",
          {
            "aria-invalid": a ? !0 : void 0,
            "aria-label": i ? i(y) : `${t} ${y + 1}`,
            autoComplete: y === 0 ? "one-time-code" : "off",
            className: "nim-otp__box",
            "data-filled": h[y] ? "true" : void 0,
            enterKeyHint: "done",
            inputMode: "numeric",
            onChange: (k) => p(y, k.target.value),
            onFocus: (k) => k.currentTarget.select(),
            onKeyDown: (k) => N(y, k),
            type: "text",
            value: h[y] ?? ""
          },
          y
        ))
      }
    ),
    a ? /* @__PURE__ */ e("p", { className: "nim-otp__error", role: "alert", children: a }) : null
  ] });
}
const qa = {
  hide: "Hide password",
  show: "Show password",
  strength: (n) => `Password strength: ${n}`
}, Ee = ["weak", "fair", "good", "strong"];
function ei({
  className: n,
  error: l,
  hint: i,
  id: a,
  label: t,
  labels: s,
  required: o,
  strength: c,
  ...r
}) {
  const [m, h] = D(!1), _ = { ...qa, ...s };
  return /* @__PURE__ */ e(Q, { error: l, hint: i, id: a, label: t, required: o, children: ({ control: u, describedBy: p }) => /* @__PURE__ */ d(K, { children: [
    /* @__PURE__ */ d("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-describedby": p,
          "aria-invalid": l ? !0 : void 0,
          autoComplete: r.autoComplete ?? "current-password",
          className: f("nim-input", n),
          id: u,
          required: o,
          ...r,
          type: m ? "text" : "password"
        }
      ),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-controls": u,
          "aria-label": m ? _.hide : _.show,
          "aria-pressed": m,
          className: "nim-password__toggle",
          onClick: () => h((N) => !N),
          type: "button",
          children: /* @__PURE__ */ e(w, { name: "eye", size: "sm" })
        }
      )
    ] }),
    c ? /* @__PURE__ */ e(
      "div",
      {
        "aria-label": _.strength(c),
        className: "nim-password__meter",
        "data-level": c,
        role: "img",
        children: Ee.map((N, v) => /* @__PURE__ */ e(
          "span",
          {
            className: "nim-password__step",
            "data-on": v <= Ee.indexOf(c) ? "true" : void 0
          },
          N
        ))
      }
    ) : null
  ] }) });
}
function _l(n) {
  if (n.length < 8) return "weak";
  const l = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((i) => i.test(n)).length;
  return n.length >= 14 && l >= 3 ? "strong" : n.length >= 10 && l >= 2 ? "good" : "fair";
}
const ni = {
  noMatch: "No country matches",
  pickCountry: "Country code",
  search: "Search countries"
};
function ai({
  className: n,
  country: l,
  error: i,
  hint: a,
  id: t,
  label: s,
  labels: o,
  locale: c,
  onChange: r,
  onCountryChange: m,
  onSubmit: h,
  placeholder: _,
  priority: u = [],
  required: p,
  value: N
}) {
  const v = q(), b = t ?? `nim-${v}`, y = a ? `${b}-hint` : void 0, k = i ? `${b}-error` : void 0, x = { ...ni, ...o }, [z, B] = D(!1), [C, I] = D(""), S = L(null), A = L(null), T = L(null), $ = c ?? (typeof document > "u" ? "en" : document.documentElement.lang || "en"), R = Y(() => Qa($), [$]), W = Ge(l) ?? se[0], J = Y(() => {
    const g = new Intl.Collator($), E = se.map((P) => ({ ...P, name: R(P.iso2) })), M = (P) => {
      const U = u.indexOf(P);
      return U === -1 ? u.length : U;
    };
    return E.sort(
      (P, U) => M(P.iso2) - M(U.iso2) || g.compare(P.name, U.name)
    );
  }, [R, u, $]), H = Y(() => {
    const g = C.trim().toLocaleLowerCase($);
    if (!g) return J;
    const E = le(g);
    return J.filter(
      (M) => M.name.toLocaleLowerCase($).includes(g) || M.iso2.toLowerCase().includes(g) || (E ? M.dial.startsWith(E) : !1)
    );
  }, [J, C, $]);
  Z(() => {
    var M;
    if (!z) return;
    (M = T.current) == null || M.focus();
    const g = (P) => {
      var U;
      (U = S.current) != null && U.contains(P.target) || B(!1);
    }, E = (P) => {
      var U;
      P.key === "Escape" && (B(!1), (U = A.current) == null || U.focus());
    };
    return document.addEventListener("mousedown", g), document.addEventListener("keydown", E), () => {
      document.removeEventListener("mousedown", g), document.removeEventListener("keydown", E);
    };
  }, [z]);
  const V = (g) => {
    var E;
    m(g), B(!1), I(""), (E = A.current) == null || E.focus();
  };
  return /* @__PURE__ */ d("div", { className: f("nim-field", i && "nim-field--invalid", n), children: [
    s ? /* @__PURE__ */ d("label", { className: "nim-field__label", htmlFor: b, children: [
      s,
      p ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    /* @__PURE__ */ d("div", { className: "nim-phone", ref: S, children: [
      /* @__PURE__ */ d("div", { className: "nim-phone__shell", dir: "ltr", children: [
        /* @__PURE__ */ d(
          "button",
          {
            "aria-expanded": z,
            "aria-haspopup": "listbox",
            "aria-label": `${x.pickCountry}: ${R(W.iso2)} +${W.dial}`,
            className: "nim-phone__country",
            onClick: () => B((g) => !g),
            ref: A,
            type: "button",
            children: [
              /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-phone__flag", children: W.flag }),
              /* @__PURE__ */ d("span", { className: "nim-phone__dial", children: [
                "+",
                W.dial
              ] }),
              /* @__PURE__ */ e(w, { className: "nim-phone__caret", name: "chevron-down", size: "xs" })
            ]
          }
        ),
        /* @__PURE__ */ e(
          "input",
          {
            "aria-describedby": [k, y].filter(Boolean).join(" ") || void 0,
            "aria-invalid": i ? !0 : void 0,
            autoComplete: "tel-national",
            className: "nim-phone__input",
            enterKeyHint: "go",
            id: b,
            inputMode: "tel",
            onChange: (g) => r(le(g.target.value)),
            onKeyDown: (g) => {
              g.key === "Enter" && (h == null || h());
            },
            placeholder: _,
            required: p,
            type: "tel",
            value: N
          }
        )
      ] }),
      z ? /* @__PURE__ */ d("div", { className: "nim-phone__picker", children: [
        /* @__PURE__ */ d("div", { className: "nim-phone__search", children: [
          /* @__PURE__ */ e(w, { name: "search", size: "sm" }),
          /* @__PURE__ */ e(
            "input",
            {
              "aria-label": x.search,
              className: "nim-phone__search-input",
              onChange: (g) => I(g.target.value),
              placeholder: x.search,
              ref: T,
              type: "search",
              value: C
            }
          )
        ] }),
        /* @__PURE__ */ d("ul", { className: "nim-phone__list", role: "listbox", children: [
          H.map((g) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ d(
            "button",
            {
              "aria-selected": g.iso2 === W.iso2,
              className: "nim-phone__option",
              onClick: () => V(g.iso2),
              role: "option",
              type: "button",
              children: [
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-phone__flag", children: g.flag }),
                /* @__PURE__ */ e("span", { className: "nim-phone__name", children: g.name }),
                /* @__PURE__ */ d("span", { className: "nim-phone__option-dial", dir: "ltr", children: [
                  "+",
                  g.dial
                ] })
              ]
            }
          ) }, g.iso2)),
          H.length === 0 ? /* @__PURE__ */ e("li", { className: "nim-phone__empty", children: x.noMatch }) : null
        ] })
      ] }) : null
    ] }),
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: k, children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: y, children: a }) : null
  ] });
}
function ii(n, l) {
  var a;
  return `+${((a = Ge(n)) == null ? void 0 : a.dial) ?? ""}${le(l).replace(/^0+/, "")}`;
}
const li = {
  excluded: "minus",
  included: "check",
  pending: "clock"
};
function ti({
  badge: n,
  className: l,
  features: i = [],
  icon: a,
  name: t,
  onSelect: s,
  price: o,
  priceCaption: c,
  secondary: r,
  selected: m = !1,
  tagline: h
}) {
  const _ = /* @__PURE__ */ d(K, { children: [
    /* @__PURE__ */ d("div", { className: "nim-plan__top", children: [
      a ? /* @__PURE__ */ e("span", { className: "nim-plan__icon", children: /* @__PURE__ */ e(w, { name: a, size: "md" }) }) : null,
      /* @__PURE__ */ d("div", { className: "nim-plan__heading", children: [
        /* @__PURE__ */ e("span", { className: "nim-plan__name", children: t }),
        h ? /* @__PURE__ */ e("span", { className: "nim-plan__tagline", children: h }) : null
      ] }),
      n ? /* @__PURE__ */ e("span", { className: "nim-plan__badge", children: n }) : null,
      s ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-plan__radio", children: m ? /* @__PURE__ */ e(w, { name: "check", size: "xs" }) : null }) : null
    ] }),
    /* @__PURE__ */ d("div", { className: "nim-plan__price-box", children: [
      /* @__PURE__ */ d("div", { children: [
        c ? /* @__PURE__ */ e("span", { className: "nim-plan__price-caption", children: c }) : null,
        /* @__PURE__ */ e("strong", { className: "nim-plan__price", children: o })
      ] }),
      r ? /* @__PURE__ */ d("div", { className: "nim-plan__secondary", children: [
        /* @__PURE__ */ e("span", { className: "nim-plan__price-caption", children: r.caption }),
        /* @__PURE__ */ e("strong", { className: "nim-plan__secondary-value", children: r.value })
      ] }) : null
    ] }),
    i.length ? /* @__PURE__ */ e("ul", { className: "nim-plan__features", children: i.map((p, N) => {
      const v = p.state ?? "included";
      return /* @__PURE__ */ d("li", { className: "nim-plan__feature", "data-state": v, children: [
        /* @__PURE__ */ e(w, { name: li[v], size: "xs" }),
        /* @__PURE__ */ e("span", { className: "nim-plan__feature-label", children: p.label }),
        p.note ? /* @__PURE__ */ e("span", { className: "nim-plan__feature-note", children: p.note }) : null
      ] }, N);
    }) }) : null
  ] }), u = f("nim-plan", m && "nim-plan--selected", l);
  return s ? /* @__PURE__ */ e("button", { "aria-pressed": m, className: u, onClick: s, type: "button", children: _ }) : /* @__PURE__ */ e("article", { className: u, children: _ });
}
function si({
  className: n,
  fullWidth: l = !1,
  label: i,
  onChange: a,
  options: t,
  value: s,
  ...o
}) {
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": i,
      className: f("nim-segmented", l && "nim-segmented--full", n),
      role: "tablist",
      ...o,
      children: t.map((c) => /* @__PURE__ */ e(
        "button",
        {
          "aria-selected": c.value === s,
          className: "nim-segmented__option",
          disabled: c.disabled,
          onClick: () => a(c.value),
          role: "tab",
          type: "button",
          children: c.label
        },
        c.value
      ))
    }
  );
}
const ri = {
  cycle: "Billing period",
  monthly: "Per month",
  price: "This package"
};
function pl({
  className: n,
  cycle: l,
  cycles: i = [],
  defaultCycle: a,
  defaultPlan: t,
  labels: s,
  note: o,
  onCycleChange: c,
  onPlanChange: r,
  onSubmit: m,
  plan: h,
  plans: _,
  submitLabel: u
}) {
  var I, S;
  const p = { ...ri, ...s }, [N, v] = D(a ?? ((I = i[0]) == null ? void 0 : I.id) ?? ""), [b, y] = D(t ?? ((S = _[0]) == null ? void 0 : S.id) ?? ""), k = l ?? N, x = h ?? b, z = (A) => {
    y(A), r == null || r(A);
  }, B = (A) => {
    v(A), c == null || c(A);
  }, C = i.find((A) => A.id === k);
  return /* @__PURE__ */ d("section", { className: f("nim-plan-picker", n), children: [
    i.length > 1 ? /* @__PURE__ */ d("div", { className: "nim-plan-picker__cycles", children: [
      /* @__PURE__ */ e(
        si,
        {
          fullWidth: !0,
          label: p.cycle,
          onChange: B,
          options: i.map((A) => ({ label: A.label, value: A.id })),
          value: k
        }
      ),
      C != null && C.note ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__save", children: C.note }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-plan-picker__plans", children: _.map(({ id: A, prices: T, ...$ }) => {
      const R = T[k] ?? Object.values(T)[0];
      return /* @__PURE__ */ Ye(
        ti,
        {
          ...$,
          key: A,
          onSelect: () => z(A),
          price: (R == null ? void 0 : R.price) ?? "",
          priceCaption: p.price,
          secondary: (R == null ? void 0 : R.monthly) === void 0 ? void 0 : { caption: p.monthly, value: R.monthly },
          selected: A === x
        }
      );
    }) }),
    u ? /* @__PURE__ */ d("div", { className: "nim-plan-picker__foot", children: [
      /* @__PURE__ */ e(
        j,
        {
          fullWidth: !0,
          onClick: () => m == null ? void 0 : m(x, k),
          size: "lg",
          variant: "accent",
          children: u
        }
      ),
      o ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__note", children: o }) : null
    ] }) : null
  ] });
}
function ci({
  action: n,
  className: l,
  description: i,
  eyebrow: a,
  title: t,
  ...s
}) {
  return /* @__PURE__ */ d("header", { className: f("nim-section-header", l), ...s, children: [
    /* @__PURE__ */ d("div", { children: [
      a ? /* @__PURE__ */ e("p", { className: "nim-label nim-section-header__eyebrow", children: a }) : null,
      /* @__PURE__ */ e("h2", { className: "nim-title nim-title--md", children: t }),
      i ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-section-header__description", children: i }) : null
    ] }),
    n ? /* @__PURE__ */ e("div", { className: "nim-section-header__action", children: n }) : null
  ] });
}
function fl({
  className: n,
  footer: l,
  sections: i = [],
  ...a
}) {
  return /* @__PURE__ */ d("div", { className: f("nim-profile-screen", n), children: [
    /* @__PURE__ */ e(ya, { ...a }),
    i.map((t) => /* @__PURE__ */ d("section", { className: "nim-profile-screen__section", children: [
      t.title ? /* @__PURE__ */ e(ci, { description: t.description, title: t.title }) : null,
      /* @__PURE__ */ e(Ha, { children: t.rows.map((s) => /* @__PURE__ */ e(
        Ya,
        {
          className: f(s.danger && "nim-list-row--danger"),
          href: s.href,
          leading: s.icon ? /* @__PURE__ */ e(w, { name: s.icon, size: "md" }) : void 0,
          onClick: s.onToggle ? void 0 : s.onSelect,
          subtitle: s.subtitle,
          title: s.label,
          trailing: s.onToggle ? (
            // The row's own title names the switch, so the control
            // carries the name rather than repeating the text beside
            // itself. A toggle row is a div, never a button — a switch
            // inside a button is two controls in one target.
            /* @__PURE__ */ e(
              ha,
              {
                "aria-label": typeof s.label == "string" ? s.label : void 0,
                checked: s.checked ?? !1,
                onChange: (o) => {
                  var c;
                  return (c = s.onToggle) == null ? void 0 : c.call(s, o.target.checked);
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
function Nl({
  className: n,
  count: l = 5,
  label: i,
  onChange: a,
  readOnly: t = !1,
  size: s = "md",
  value: o
}) {
  const c = q(), [r, m] = D(null), h = r ?? o;
  return t || !a ? /* @__PURE__ */ e(
    "span",
    {
      "aria-label": `${i}: ${o}/${l}`,
      className: f("nim-rating", `nim-rating--${s}`, "nim-rating--static", n),
      role: "img",
      children: Array.from({ length: l }, (_, u) => /* @__PURE__ */ e(Me, { fill: Math.min(Math.max(o - u, 0), 1) }, u))
    }
  ) : /* @__PURE__ */ d(
    "fieldset",
    {
      className: f("nim-rating", `nim-rating--${s}`, n),
      onMouseLeave: () => m(null),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-visually-hidden", children: i }),
        Array.from({ length: l }, (_, u) => {
          const p = u + 1;
          return /* @__PURE__ */ d("label", { className: "nim-rating__star", onMouseEnter: () => m(p), children: [
            /* @__PURE__ */ e(
              "input",
              {
                checked: o === p,
                className: "nim-choice__input",
                name: c,
                onChange: () => a(p),
                type: "radio",
                value: p
              }
            ),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: p }),
            /* @__PURE__ */ e(Me, { fill: Math.min(Math.max(h - u, 0), 1) })
          ] }, p);
        })
      ]
    }
  );
}
function Me({ fill: n }) {
  return /* @__PURE__ */ d("span", { "aria-hidden": "true", className: "nim-rating__glyph", children: [
    /* @__PURE__ */ e(w, { className: "nim-rating__outline", name: "star", size: "md" }),
    /* @__PURE__ */ e("span", { className: "nim-rating__fill", style: { inlineSize: `${n * 100}%` }, children: /* @__PURE__ */ e(w, { name: "star", size: "md" }) })
  ] });
}
const oi = {
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
}, he = (n, l) => n instanceof Error && n.message.trim() ? n.message.trim() : l;
function bl({
  brand: n,
  className: l,
  codeLength: i = 5,
  copy: a,
  defaultCountry: t = "IR",
  defaultMethod: s = "code",
  footer: o,
  methods: c = ["code", "password"],
  onPasswordSignIn: r,
  onRequestCode: m,
  onVerifyCode: h,
  priority: _ = ["IR", "AE", "TR", "DE", "US", "GB"],
  resendSeconds: u = 60
}) {
  const p = { ...oi, ...a }, [N, v] = D(
    c.includes(s) ? s : c[0]
  ), [b, y] = D(!1), [k, x] = D(t), [z, B] = D(""), [C, I] = D(""), [S, A] = D(""), [T, $] = D(""), [R, W] = D(!1), [J, H] = D(""), [V, g] = D(0), E = L(!1);
  Z(() => {
    if (V <= 0) return;
    const G = window.setTimeout(() => g((ee) => ee - 1), 1e3);
    return () => window.clearTimeout(G);
  }, [V]);
  const M = ii(k, z), P = z.replace(/\D/g, "").length >= 6, U = O(
    async (G = !1) => {
      if (!(R || !G && !P)) {
        W(!0), H("");
        try {
          await (m == null ? void 0 : m(M)), y(!0), I(""), g(u);
        } catch (ee) {
          H(he(ee, p.sendCode));
        } finally {
          W(!1);
        }
      }
    },
    [R, M, m, P, u, p.sendCode]
  ), be = O(
    async (G) => {
      if (!(E.current || G.length !== i)) {
        E.current = !0, W(!0), H("");
        try {
          await (h == null ? void 0 : h(M, G));
        } catch (ee) {
          H(he(ee, p.verify)), I("");
        } finally {
          E.current = !1, W(!1);
        }
      }
    },
    [i, M, h, p.verify]
  ), ve = O(async () => {
    if (!(R || !S.trim() || !T)) {
      W(!0), H("");
      try {
        await (r == null ? void 0 : r(S.trim(), T));
      } catch (G) {
        H(he(G, p.signIn));
      } finally {
        W(!1);
      }
    }
  }, [R, S, r, T, p.signIn]), ge = c.length > 1 ? /* @__PURE__ */ e(
    j,
    {
      onClick: () => {
        v(N === "code" ? "password" : "code"), H("");
      },
      size: "sm",
      variant: "ghost",
      children: N === "code" ? p.usePassword : p.usePhone
    }
  ) : null, de = J ? /* @__PURE__ */ e(wa, { tone: "danger", children: J }) : null;
  return N === "password" ? /* @__PURE__ */ d(
    me,
    {
      action: {
        disabled: !S.trim() || !T,
        label: p.signIn,
        loading: R,
        onClick: () => void ve()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ d(K, { children: [
        ge,
        o
      ] }),
      subtitle: p.passwordSubtitle,
      title: p.passwordTitle,
      children: [
        de,
        /* @__PURE__ */ e(
          La,
          {
            autoComplete: "username",
            label: p.identifierLabel,
            onChange: (G) => A(G.target.value),
            type: "email",
            value: S
          }
        ),
        /* @__PURE__ */ e(
          ei,
          {
            autoComplete: "current-password",
            label: p.passwordLabel,
            onChange: (G) => $(G.target.value),
            onKeyDown: (G) => {
              G.key === "Enter" && ve();
            },
            value: T
          }
        )
      ]
    }
  ) : b ? /* @__PURE__ */ d(
    me,
    {
      action: {
        disabled: C.length !== i,
        label: p.verify,
        loading: R,
        onClick: () => void be(C)
      },
      back: {
        label: p.back,
        onClick: () => {
          y(!1), I(""), H("");
        }
      },
      className: l,
      footer: /* @__PURE__ */ d(K, { children: [
        V > 0 ? /* @__PURE__ */ e("p", { children: p.resendIn(V) }) : /* @__PURE__ */ e(j, { onClick: () => void U(!0), size: "sm", variant: "ghost", children: p.resend }),
        o
      ] }),
      subtitle: p.codeSubtitle(M),
      title: p.codeTitle,
      children: [
        de,
        /* @__PURE__ */ e(
          Xa,
          {
            autoFocus: !0,
            label: p.codeLabel,
            length: i,
            onChange: I,
            onComplete: (G) => void be(G),
            value: C
          }
        )
      ]
    }
  ) : /* @__PURE__ */ d(
    me,
    {
      action: {
        disabled: !P,
        label: p.sendCode,
        loading: R,
        onClick: () => void U()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ d(K, { children: [
        ge,
        o
      ] }),
      subtitle: p.phoneSubtitle,
      title: p.phoneTitle,
      children: [
        de,
        /* @__PURE__ */ e(
          ai,
          {
            country: k,
            label: p.phoneLabel,
            onChange: B,
            onCountryChange: x,
            onSubmit: () => void U(),
            priority: _,
            value: z
          }
        )
      ]
    }
  );
}
function vl({ children: n, className: l, closeLabel: i = "Close", footer: a, onClose: t, open: s, title: o }) {
  const c = L(null), r = L(null);
  return Z(() => {
    var _;
    if (!s) return;
    r.current = document.activeElement;
    const m = document.body.style.overflow;
    document.body.style.overflow = "hidden", (_ = c.current) == null || _.focus();
    const h = (u) => {
      u.key === "Escape" && t();
    };
    return window.addEventListener("keydown", h), () => {
      var u, p;
      document.body.style.overflow = m, window.removeEventListener("keydown", h), (p = (u = r.current) == null ? void 0 : u.focus) == null || p.call(u);
    };
  }, [t, s]), !s || typeof document > "u" ? null : re(
    /* @__PURE__ */ d(K, { children: [
      /* @__PURE__ */ e("div", { className: "nim-sheet__scrim", onClick: t }),
      /* @__PURE__ */ d(
        "div",
        {
          "aria-label": typeof o == "string" ? o : i,
          "aria-modal": "true",
          className: f("nim-sheet__panel", l),
          ref: c,
          role: "dialog",
          tabIndex: -1,
          children: [
            /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-sheet__handle" }),
            o ? /* @__PURE__ */ d("div", { className: "nim-sheet__header", children: [
              /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: o }),
              /* @__PURE__ */ e(F, { label: i, name: "close", onClick: t, size: "sm" })
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
function gl({
  className: n,
  label: l,
  max: i = 100,
  min: a = 0,
  scale: t,
  step: s = 1,
  value: o,
  ...c
}) {
  const r = i === a ? 0 : (o - a) / (i - a) * 100;
  return /* @__PURE__ */ d("div", { className: "nim-field", children: [
    l ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: l }) : null,
    /* @__PURE__ */ e(
      "input",
      {
        "aria-label": l,
        className: f("nim-slider", n),
        max: i,
        min: a,
        step: s,
        style: { "--nim-slider-progress": `${r}%` },
        type: "range",
        value: o,
        ...c
      }
    ),
    t ? /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-inline", style: { justifyContent: "space-between" }, children: t.map((m) => /* @__PURE__ */ e("span", { className: "nim-caption", children: m }, m)) }) : null
  ] });
}
function yl({ className: n, delta: l, deltaDirection: i = "up", label: a, unit: t, value: s, ...o }) {
  return /* @__PURE__ */ d("div", { className: f("nim-stat", n), ...o, children: [
    /* @__PURE__ */ d("p", { className: "nim-stat__value", children: [
      s,
      t ? /* @__PURE__ */ e("span", { className: "nim-stat__unit", children: t }) : null
    ] }),
    /* @__PURE__ */ e("p", { className: "nim-label nim-stat__label", children: a }),
    l ? /* @__PURE__ */ d("p", { className: "nim-stat__delta", "data-direction": i, children: [
      /* @__PURE__ */ e(w, { name: i === "up" ? "trend-up" : "trend-down", size: "xs" }),
      l
    ] }) : null
  ] });
}
function kl({
  className: n,
  decrementLabel: l = "Decrease",
  incrementLabel: i = "Increase",
  label: a,
  max: t = Number.MAX_SAFE_INTEGER,
  min: s = 0,
  onChange: o,
  step: c = 1,
  value: r
}) {
  const m = (h) => Math.min(Math.max(h, s), t);
  return /* @__PURE__ */ d(
    "div",
    {
      "aria-label": a,
      "aria-valuemax": t,
      "aria-valuemin": s,
      "aria-valuenow": r,
      className: f("nim-stepper", n),
      role: "spinbutton",
      tabIndex: 0,
      onKeyDown: (h) => {
        h.key === "ArrowUp" && (h.preventDefault(), o(m(r + c))), h.key === "ArrowDown" && (h.preventDefault(), o(m(r - c)));
      },
      children: [
        /* @__PURE__ */ e(
          "button",
          {
            "aria-label": l,
            className: "nim-stepper__button",
            disabled: r <= s,
            onClick: () => o(m(r - c)),
            tabIndex: -1,
            type: "button",
            children: /* @__PURE__ */ e(w, { name: "minus", size: "sm" })
          }
        ),
        /* @__PURE__ */ e("span", { className: "nim-stepper__value", children: r }),
        /* @__PURE__ */ e(
          "button",
          {
            "aria-label": i,
            className: "nim-stepper__button",
            disabled: r >= t,
            onClick: () => o(m(r + c)),
            tabIndex: -1,
            type: "button",
            children: /* @__PURE__ */ e(w, { name: "plus", size: "sm" })
          }
        )
      ]
    }
  );
}
const di = {
  of: (n, l) => `${n} of ${l} steps`,
  status: {
    active: "In progress",
    done: "Done",
    failed: "Failed",
    pending: "Waiting",
    skipped: "Skipped"
  }
}, mi = {
  done: "check",
  failed: "close",
  pending: "clock",
  skipped: "minus"
};
function wl({
  action: n,
  caption: l,
  className: i,
  labels: a,
  steps: t,
  title: s,
  value: o
}) {
  const c = { ...di, ...a }, r = t.filter((_) => _.status === "done" || _.status === "skipped").length, m = o ?? (t.length ? Math.round(r / t.length * 100) : 0), h = t.some((_) => _.status === "failed");
  return /* @__PURE__ */ d(
    "section",
    {
      "aria-live": "polite",
      className: f("nim-task", h && "nim-task--failed", i),
      children: [
        /* @__PURE__ */ d("header", { className: "nim-task__head", children: [
          s ? /* @__PURE__ */ e("h2", { className: "nim-task__title", children: s }) : null,
          l ? /* @__PURE__ */ e("p", { className: "nim-task__caption", children: l }) : null,
          /* @__PURE__ */ e(_a, { label: c.of(r, t.length), value: m })
        ] }),
        /* @__PURE__ */ e("ol", { className: "nim-task__steps", children: t.map((_) => /* @__PURE__ */ d("li", { className: "nim-task__step", "data-status": _.status, children: [
          /* @__PURE__ */ e("span", { className: "nim-task__marker", children: _.status === "active" ? /* @__PURE__ */ e(Ie, { size: "sm" }) : /* @__PURE__ */ e(w, { name: mi[_.status], size: "xs" }) }),
          /* @__PURE__ */ d("span", { className: "nim-task__step-text", children: [
            /* @__PURE__ */ e("span", { className: "nim-task__step-label", children: _.label }),
            /* @__PURE__ */ e("span", { className: "nim-task__step-detail", children: _.detail ?? c.status[_.status] })
          ] })
        ] }, _.id)) }),
        n ? /* @__PURE__ */ e("div", { className: "nim-task__action", children: n }) : null
      ]
    }
  );
}
function Cl({ className: n, density: l = "default", entries: i }) {
  return /* @__PURE__ */ e("ol", { className: f("nim-timeline", l === "compact" && "nim-timeline--compact", n), children: i.map((a) => /* @__PURE__ */ d("li", { className: "nim-timeline__entry", "data-tone": a.tone, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-timeline__marker", children: a.icon ? /* @__PURE__ */ e(w, { name: a.icon, size: "xs" }) : /* @__PURE__ */ e("span", { className: "nim-timeline__dot" }) }),
    /* @__PURE__ */ d("div", { className: "nim-timeline__content", children: [
      /* @__PURE__ */ d("div", { className: "nim-timeline__head", children: [
        /* @__PURE__ */ e("span", { className: "nim-timeline__title", children: a.title }),
        a.time ? /* @__PURE__ */ e("time", { className: "nim-timeline__time", children: a.time }) : null
      ] }),
      a.body && l !== "compact" ? /* @__PURE__ */ e("div", { className: "nim-timeline__body", children: a.body }) : null
    ] })
  ] }, a.id)) });
}
function Sl({ className: n, label: l, onChange: i, options: a, value: t, ...s }) {
  const o = L(null), c = (r) => {
    var p, N;
    const m = r.key === "ArrowRight" ? 1 : r.key === "ArrowLeft" ? -1 : 0;
    if (m === 0) return;
    r.preventDefault();
    const h = a.filter((v) => !v.disabled), _ = h.findIndex((v) => v.value === t), u = h[(_ + m + h.length) % h.length];
    u && (i(u.value), (N = (p = o.current) == null ? void 0 : p.querySelector(`[data-value="${u.value}"]`)) == null || N.focus());
  };
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": l,
      className: f("nim-tabs", n),
      onKeyDown: c,
      ref: o,
      role: "tablist",
      ...s,
      children: a.map((r) => /* @__PURE__ */ d(
        "button",
        {
          "aria-selected": r.value === t,
          className: "nim-tab",
          "data-value": r.value,
          disabled: r.disabled,
          onClick: () => i(r.value),
          role: "tab",
          tabIndex: r.value === t ? 0 : -1,
          type: "button",
          children: [
            r.label,
            r.count === void 0 ? null : /* @__PURE__ */ e("span", { className: "nim-tab__count", children: r.count })
          ]
        },
        r.value
      ))
    }
  );
}
const Ke = pe(null), ui = {
  accent: "sparkle",
  danger: "danger",
  neutral: "info",
  success: "check-circle"
};
function Tl({ children: n }) {
  const [l, i] = D([]), a = L(0), t = O((c) => {
    i((r) => r.filter((m) => m.id !== c));
  }, []), s = O(
    (c) => {
      const r = a.current++;
      i((h) => [...h, { ...c, id: r }]);
      const m = c.duration ?? 4e3;
      m > 0 && window.setTimeout(() => t(r), m);
    },
    [t]
  ), o = Y(() => s, [s]);
  return /* @__PURE__ */ d(Ke.Provider, { value: o, children: [
    n,
    typeof document < "u" ? re(
      /* @__PURE__ */ e("div", { "aria-live": "polite", className: "nim-toast-stack", children: l.map((c) => /* @__PURE__ */ d("div", { className: f("nim-toast", `nim-toast--${c.tone ?? "neutral"}`), children: [
        /* @__PURE__ */ e(w, { className: "nim-toast__icon", name: ui[c.tone ?? "neutral"], size: "sm" }),
        /* @__PURE__ */ e("span", { className: "nim-toast__message", children: c.message }),
        c.action ? /* @__PURE__ */ e(
          "button",
          {
            className: "nim-toast__action",
            onClick: () => {
              var r;
              (r = c.action) == null || r.onPress(), t(c.id);
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
function Al() {
  const n = fe(Ke);
  if (!n) throw new Error("useToast must be used inside <ToastProvider>");
  return n;
}
function xl({ children: n, className: l, label: i }) {
  return /* @__PURE__ */ d("span", { className: f("nim-tooltip", l), children: [
    n,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-tooltip__bubble", role: "tooltip", children: i })
  ] });
}
const hi = {
  back: "Back",
  close: "Close",
  step: (n, l) => `Step ${n + 1} of ${l}`
};
function Dl({
  className: n,
  continueLabel: l,
  finishLabel: i,
  labels: a,
  onClose: t,
  onDone: s,
  onStep: o,
  steps: c
}) {
  const r = { ...hi, ...a }, [m, h] = D(0), _ = c[Math.min(m, c.length - 1)], u = m === c.length - 1, p = O(
    (N) => {
      h(N), o == null || o(N);
    },
    [o]
  );
  return /* @__PURE__ */ d("section", { className: f("nim-wizard", n), children: [
    /* @__PURE__ */ d("header", { className: "nim-wizard__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: m > 0 ? /* @__PURE__ */ e(F, { label: r.back, name: "chevron-back", onClick: () => p(m - 1), size: "sm" }) : null }),
      /* @__PURE__ */ e("ol", { "aria-label": r.step(m, c.length), className: "nim-wizard__dots", children: c.map((N, v) => /* @__PURE__ */ e(
        "li",
        {
          className: "nim-wizard__dot",
          "data-done": v < m ? "true" : void 0,
          "data-on": v === m ? "true" : void 0
        },
        N.id
      )) }),
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: t ? /* @__PURE__ */ e(F, { label: r.close, name: "close", onClick: t, size: "sm" }) : null })
    ] }),
    _.question ? /* @__PURE__ */ d("div", { className: "nim-wizard__ask", children: [
      /* @__PURE__ */ e("h1", { className: "nim-wizard__question", children: _.question }),
      _.subtitle ? /* @__PURE__ */ e("p", { className: "nim-wizard__subtitle", children: _.subtitle }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-wizard__content", children: _.content }),
    /* @__PURE__ */ e("footer", { className: "nim-wizard__foot", children: /* @__PURE__ */ e(
      j,
      {
        disabled: _.canContinue === !1,
        fullWidth: !0,
        onClick: () => u ? s() : p(m + 1),
        size: "lg",
        variant: "accent",
        children: _.continueLabel ?? (u ? i : l)
      }
    ) })
  ] });
}
function El({
  className: n,
  max: l,
  multiple: i = !1,
  onChange: a,
  options: t,
  selected: s
}) {
  const o = i && l !== void 0 && s.length >= l, c = (r) => {
    if (!i) {
      a([r]);
      return;
    }
    a(s.includes(r) ? s.filter((m) => m !== r) : [...s, r]);
  };
  return /* @__PURE__ */ e("div", { className: f("nim-choice-grid", n), role: i ? "group" : "radiogroup", children: t.map((r) => {
    const m = s.includes(r.id);
    return /* @__PURE__ */ d(
      "button",
      {
        "aria-checked": m,
        className: "nim-choice-grid__tile",
        "data-on": m ? "true" : void 0,
        disabled: r.disabled || o && !m,
        onClick: () => c(r.id),
        role: i ? "checkbox" : "radio",
        type: "button",
        children: [
          r.icon ? /* @__PURE__ */ e("span", { className: "nim-choice-grid__icon", children: r.icon }) : null,
          /* @__PURE__ */ e("span", { className: "nim-choice-grid__label", children: r.label })
        ]
      },
      r.id
    );
  }) });
}
function Ml({ as: n = "h1", children: l, className: i, ...a }) {
  return /* @__PURE__ */ e(n, { className: f("nim-display", i), ...a, children: l });
}
function Ll({
  as: n = "h2",
  children: l,
  className: i,
  size: a = "lg",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: f("nim-title", a === "md" && "nim-title--md", i), ...t, children: l });
}
function zl({
  as: n = "p",
  children: l,
  className: i,
  size: a = "md",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: f("nim-body", a === "sm" && "nim-body--sm", i), ...t, children: l });
}
function $l({ as: n = "span", children: l, className: i, ...a }) {
  return /* @__PURE__ */ e(n, { className: f("nim-label", i), ...a, children: l });
}
function Il({ as: n = "p", children: l, className: i, ...a }) {
  return /* @__PURE__ */ e(n, { className: f("nim-caption", i), ...a, children: l });
}
function Pl({ className: n, ...l }) {
  return /* @__PURE__ */ e("hr", { className: f("nim-rule", n), ...l });
}
export {
  Ri as Accordion,
  Yi as ActionBar,
  ki as ActivityFeed,
  vi as AdminShell,
  ol as AppFrame,
  Fi as AppShell,
  me as AuthScreen,
  ga as Avatar,
  Oi as AvatarRing,
  Ui as Badge,
  wa as Banner,
  zl as Body,
  Gi as Breadcrumb,
  j as Button,
  se as COUNTRIES,
  Oe as Calendar,
  Il as Caption,
  Ki as Card,
  Zi as Chat,
  Vi as ChatComposer,
  we as Checkbox,
  Ma as Chip,
  ji as ChipInput,
  El as ChoiceGrid,
  Ei as CodeBlock,
  Di as Columns,
  el as Combobox,
  Ji as DataList,
  Bi as DataTable,
  ll as DateField,
  tl as DatePicker,
  gi as DetailHeader,
  $i as DetailLayout,
  sl as Dialog,
  Ml as Display,
  da as EmptyState,
  xi as Facts,
  Qi as Field,
  cl as FileDrop,
  yi as FilterChips,
  w as Icon,
  F as IconButton,
  ml as Inline,
  La as Input,
  $l as Label,
  Ha as List,
  Ya as ListRow,
  nl as Menu,
  Ti as Metric,
  Ai as MetricGrid,
  Li as Mono,
  al as NimProvider,
  ul as Onboarding,
  Wi as OptionCard,
  Hi as OrderSummary,
  Xa as OtpInput,
  wi as Page,
  ua as Pagination,
  Ci as Panel,
  ei as PasswordField,
  ai as PhoneField,
  ti as PlanCard,
  pl as PlanPicker,
  $a as Popover,
  ya as ProfileHeader,
  fl as ProfileScreen,
  _a as Progress,
  Ii as Radio,
  Pi as RadioGroup,
  Nl as Rating,
  zi as RecordLink,
  rl as ResourceMeter,
  Pl as Rule,
  ci as SectionHeader,
  si as Segmented,
  qi as Select,
  vl as Sheet,
  bl as SignInFlow,
  pa as Skeleton,
  gl as Slider,
  Ie as Spinner,
  dl as Stack,
  yl as Stat,
  Mi as StatusDot,
  kl as Stepper,
  ha as Switch,
  ba as TabBar,
  ke as Table,
  Sl as Tabs,
  wl as TaskProgress,
  Xi as Textarea,
  Cl as Timeline,
  Ll as Title,
  Tl as ToastProvider,
  Si as Toolbar,
  xl as Tooltip,
  Dl as Wizard,
  ue as addDays,
  Te as addMonths,
  f as cn,
  hl as countryByDial,
  Ge as countryByIso2,
  Qa as countryNamer,
  _e as formatNumeric,
  ie as fromParts,
  bi as iconNames,
  Fe as monthLength,
  Ka as parseNumeric,
  X as partsOf,
  _l as scorePassword,
  Ra as startOfMonth,
  le as toAsciiDigits,
  ii as toE164,
  oe as todayIso,
  ce as useNim,
  il as useSchemeToggle,
  Al as useToast
};
